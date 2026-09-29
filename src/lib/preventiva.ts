import { fatorAntecipacao } from "@/lib/dtc";
import type {
  ExecucaoManutencao,
  ModeloVeiculo,
  ParametroManutencao,
  PreventivaPrevista,
  RecomendacaoDTC,
  RegraAjuste,
  TipoOperacao,
  UrgenciaPreventiva,
  Veiculo,
} from "@/types";

/**
 * Motor da manutenção preventiva.
 *
 * Fecha o ciclo: catálogo do fabricante + odômetro do veículo + histórico de
 * execução → quando cada item vence.
 *
 * Duas regras herdadas diretamente dos fabricantes:
 *
 * 1. **O que ocorrer primeiro** entre quilometragem, horas de motor e tempo.
 *    Um item pode vencer por prazo mesmo com o veículo rodando pouco.
 * 2. **A operação encurta o intervalo.** A Volvo publica que marcha-lenta acima
 *    de 30% obriga a usar o intervalo imediatamente menor, e o percentual de
 *    motor ligado parado já é coletado. É o que transforma um catálogo estático
 *    em plano adaptativo.
 */

/** Faixas de urgência, em percentual do intervalo consumido. */
export const LIMIAR_URGENCIA = { critica: 90, proxima: 75, programada: 50 };

const dias = (de: string, ate = new Date()) =>
  Math.round((ate.getTime() - new Date(de).getTime()) / 86_400_000);

/**
 * Classifica o tipo de operação do veículo a partir da telemetria.
 *
 * O perfil urbano segue a definição da Scania para a Operação 4: marcha-lenta
 * somada ao PTO acima de 25%, mais de 250 paradas por dia e velocidade média
 * abaixo de 40 km/h. Todos os três são mensuráveis pelo sistema.
 */
export function classificarOperacao(sinais: {
  marchaLentaPct?: number;
  velocidadeMediaKmh?: number;
  paradasPorDia?: number;
}): TipoOperacao {
  const { marchaLentaPct = 0, velocidadeMediaKmh = 60, paradasPorDia = 0 } = sinais;

  if (marchaLentaPct > 25 || paradasPorDia > 250 || velocidadeMediaKmh < 40) return "urbano";
  if (velocidadeMediaKmh < 50) return "longa_pesado";
  return "longa";
}

/**
 * Aplica as regras de ajuste ao intervalo do catálogo.
 *
 * Devolve também a justificativa de cada ajuste: o gestor precisa saber por que
 * o sistema encurtou o prazo, senão o número parece arbitrário e ele desconfia.
 */
export function ajustarIntervalo(
  intervaloKm: number | null,
  regras: RegraAjuste[],
  sinais: Record<string, number>,
  montadoraId?: string,
): { aplicado: number | null; ajustes: { nome: string; fator: number; motivo: string }[] } {
  if (intervaloKm === null) return { aplicado: null, ajustes: [] };

  const ajustes: { nome: string; fator: number; motivo: string }[] = [];
  let fatorTotal = 1;

  for (const r of regras) {
    if (!r.ativa) continue;
    // Regra de fabricante só vale para a marca dela; regra sem marca é geral.
    if (r.montadoraId && montadoraId && r.montadoraId !== montadoraId) continue;
    if (r.fator === 1) continue;

    const valor = sinais[r.indicador];
    if (valor === undefined) continue;

    const dispara = r.operador === "maior_que" ? valor > r.limiar : valor < r.limiar;
    if (!dispara) continue;

    fatorTotal *= r.fator;
    ajustes.push({
      nome: r.nome,
      fator: r.fator,
      motivo: `${r.indicador.replace(/_/g, " ")} em ${valor}${r.indicador.includes("pct") || r.indicador.includes("parado") ? "%" : ""} (limiar ${r.limiar})`,
    });
  }

  return { aplicado: Math.round(intervaloKm * fatorTotal), ajustes };
}

function urgenciaDe(consumidoPct: number, kmRestante: number | null, diasRestante: number | null): UrgenciaPreventiva {
  if ((kmRestante !== null && kmRestante < 0) || (diasRestante !== null && diasRestante < 0)) return "vencida";
  if (consumidoPct >= LIMIAR_URGENCIA.critica) return "critica";
  if (consumidoPct >= LIMIAR_URGENCIA.proxima) return "proxima";
  if (consumidoPct >= LIMIAR_URGENCIA.programada) return "programada";
  return "em_dia";
}

/**
 * Calcula todas as preventivas de um veículo.
 *
 * Parâmetro sem intervalo definido é ignorado — é o caso dos itens marcados
 * como "não localizado" no catálogo, que ficam registrados mas não disparam
 * alerta. Melhor não avisar do que avisar com número inventado.
 */
export function calcularPreventivas(
  veiculo: Veiculo & { modeloId?: string; montadoraId?: string; horimetro?: number | null },
  modelo: ModeloVeiculo | undefined,
  parametros: ParametroManutencao[],
  execucoes: ExecucaoManutencao[],
  regras: RegraAjuste[],
  sinais: Record<string, number>,
  /**
   * Recomendações vindas dos códigos de falha. Só as de confiança alta chegam
   * a alterar o intervalo — as demais aparecem na tela de diagnóstico para o
   * gestor decidir, mas não mexem no cálculo sozinhas.
   */
  recomendacoesDTC: RecomendacaoDTC[] = [],
): PreventivaPrevista[] {
  if (!modelo) return [];

  const operacao = classificarOperacao({
    marchaLentaPct: sinais.parado_motor_ligado,
    velocidadeMediaKmh: sinais.velocidade_media,
    paradasPorDia: sinais.paradas_por_dia,
  });

  const doModelo = parametros.filter((p) => p.modeloId === modelo.id && p.ativo);

  const out: PreventivaPrevista[] = [];

  for (const p of doModelo) {
    // Sem nenhum intervalo, o item não é calculável.
    if (!p.intervaloKm && !p.intervaloMeses && !p.intervaloHoras) continue;
    // Parâmetro específico de outra operação não se aplica.
    if (p.tipoOperacao && p.tipoOperacao !== operacao) continue;

    const exec = execucoes
      .filter((e) => e.veiculoId === veiculo.id && e.parametroId === p.id)
      .sort((a, b) => b.em.localeCompare(a.em))[0];

    const base = ajustarIntervalo(p.intervaloKm, regras, sinais, veiculo.montadoraId);

    // Códigos de falha no mesmo sistema antecipam o item.
    const dtc = fatorAntecipacao(recomendacoesDTC, p.sistema);
    const aplicado =
      base.aplicado !== null && dtc.fator < 1 ? Math.round(base.aplicado * dtc.fator) : base.aplicado;
    const ajustes =
      dtc.motivo && dtc.fator < 1
        ? [
            ...base.ajustes,
            {
              nome: "Código de falha ativo",
              fator: dtc.fator,
              motivo: dtc.motivo,
            },
          ]
        : base.ajustes;

    // Sem histórico, assume-se o odômetro atual como marco zero e o item entra
    // como programado — não como vencido, que seria alarme falso em massa.
    // Sem odômetro, o gatilho por quilometragem não é calculável. Assumir zero
    // marcaria tudo como vencido; assumir o intervalo marcaria tudo em dia.
    const odoBase = exec?.odometro ?? veiculo.odometro ?? null;
    const dataBase = exec?.em ?? null;

    const kmRodados = veiculo.odometro != null && odoBase != null ? veiculo.odometro - odoBase : null;
    const kmRestante = aplicado !== null && kmRodados !== null ? aplicado - kmRodados : null;

    const diasDecorridos = dataBase ? dias(dataBase) : 0;
    const diasIntervalo = p.intervaloMeses ? p.intervaloMeses * 30 : null;
    const diasRestante = diasIntervalo !== null && dataBase ? diasIntervalo - diasDecorridos : null;

    const pctKm = aplicado && kmRodados !== null ? (kmRodados / aplicado) * 100 : 0;
    const pctTempo = diasIntervalo && dataBase ? (diasDecorridos / diasIntervalo) * 100 : 0;
    const consumidoPct = Math.round(Math.max(pctKm, pctTempo));

    // Qual dos gatilhos chega primeiro.
    const disparoPor: PreventivaPrevista["disparoPor"] =
      pctKm >= pctTempo ? (aplicado ? "km" : null) : "tempo";

    out.push({
      veiculoId: veiculo.id,
      parametroId: p.id,
      modeloId: modelo.id,
      sistema: p.sistema,
      item: p.item,
      acao: p.acao,
      especificacao: p.especificacao,
      intervaloOriginalKm: p.intervaloKm,
      intervaloAplicadoKm: aplicado,
      ajustes,
      ultimaExecucaoEm: dataBase,
      odometroUltimaExecucao: exec?.odometro ?? null,
      kmRestante,
      diasRestante,
      disparoPor,
      urgencia: urgenciaDe(consumidoPct, kmRestante, diasRestante),
      consumidoPct: Math.min(150, consumidoPct),
    });
  }

  return out.sort((a, b) => b.consumidoPct - a.consumidoPct);
}

/** A preventiva mais urgente do veículo — é ela que define o card do kanban. */
export function preventivaMaisUrgente(lista: PreventivaPrevista[]): PreventivaPrevista | null {
  return lista.length ? lista[0] : null;
}

/** Traduz a urgência para a coluna correspondente no kanban de manutenção. */
export function colunaKanban(u: UrgenciaPreventiva): "em_dia" | "preventiva" | "corretiva" {
  if (u === "vencida") return "corretiva";
  if (u === "critica" || u === "proxima") return "preventiva";
  return "em_dia";
}
