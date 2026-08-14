import type { CodigoDTC, RecomendacaoDTC } from "@/types";

/**
 * Tradução de códigos de falha em ação de manutenção.
 *
 * A leitura crua do CAN não muda comportamento: o gestor recebe uma lista de
 * códigos que ele não sabe interpretar, e ela vira ruído. O valor está em
 * responder "o que eu faço com isso".
 *
 * A análise trabalha com **padrão**, não com evento isolado. Um código que
 * aparece uma vez pode ser oscilação de sensor; o mesmo código recorrente, ou
 * dois códigos do mesmo sistema convivendo, indicam degradação real — e é isso
 * que justifica antecipar um item do plano preventivo.
 *
 * A confiança de cada recomendação é declarada. Uma sugestão que se apresenta
 * como certeza e erra queima a credibilidade de todas as outras.
 */

/** Códigos que, isolados, já indicam ação. */
const REGRAS_DIRETAS: Record<string, { acao: string; sistema: string; urgencia: RecomendacaoDTC["urgencia"] }> = {
  P0299: { acao: "Verificar turbo e mangueiras de pressurização", sistema: "Admissão", urgencia: "corretiva" },
  P2002: { acao: "Avaliar saturação do filtro de partículas (DPF)", sistema: "Pós-tratamento", urgencia: "antecipar" },
  P20EE: { acao: "Verificar eficiência do catalisador SCR e qualidade do ARLA", sistema: "Pós-tratamento", urgencia: "corretiva" },
  P0087: { acao: "Verificar pressão da linha de combustível e filtros", sistema: "Alimentação", urgencia: "antecipar" },
  P0128: { acao: "Verificar válvula termostática e arrefecimento", sistema: "Arrefecimento", urgencia: "antecipar" },
  P0521: { acao: "Verificar pressão do óleo do motor — risco de dano", sistema: "Motor", urgencia: "imediata" },
};

/** Quantas ocorrências transformam "oscilação" em "padrão". */
export const LIMIAR_RECORRENCIA = 3;

/**
 * Gera recomendações a partir dos códigos ativos de um veículo.
 *
 * Três caminhos, em ordem de prioridade:
 *
 * 1. Severidade de parada imediata — não espera padrão nem recorrência.
 * 2. Regra direta conhecida para o código.
 * 3. Concentração de falhas no mesmo sistema, que sugere antecipar a revisão
 *    daquele conjunto mesmo sem um código conclusivo.
 */
export function recomendarPorDTC(codigos: CodigoDTC[]): RecomendacaoDTC[] {
  const ativos = codigos.filter((c) => c.ativo);
  if (!ativos.length) return [];

  const out: RecomendacaoDTC[] = [];
  const jaTratados = new Set<string>();

  // 1. Parada imediata.
  for (const c of ativos.filter((x) => x.severidade === "parada_imediata")) {
    jaTratados.add(c.codigo);
    out.push({
      id: `rec-${c.id}`,
      veiculoId: c.veiculoId,
      codigos: [c.codigo],
      sistema: c.sistema,
      acao: "Recolher o veículo e abrir corretiva",
      justificativa: `${c.codigo} é falha de parada imediata: ${c.descricao}. Seguir rodando arrisca dano maior.`,
      urgencia: "imediata",
      confianca: "alta",
    });
  }

  // 2. Regras diretas por código.
  for (const c of ativos) {
    if (jaTratados.has(c.codigo)) continue;
    const regra = REGRAS_DIRETAS[c.codigo];
    if (!regra) continue;
    jaTratados.add(c.codigo);

    const recorrente = c.ocorrencias >= LIMIAR_RECORRENCIA;
    out.push({
      id: `rec-${c.id}`,
      veiculoId: c.veiculoId,
      codigos: [c.codigo],
      sistema: regra.sistema,
      acao: regra.acao,
      justificativa: recorrente
        ? `${c.codigo} apareceu ${c.ocorrencias} vezes desde ${new Date(c.primeiraOcorrencia).toLocaleDateString("pt-BR")}. Recorrência indica degradação, não oscilação de sensor.`
        : `${c.codigo} registrado ${c.ocorrencias}× — ainda pode ser evento isolado, mas o sistema afetado justifica verificação.`,
      antecipacaoPct: regra.urgencia === "antecipar" ? (recorrente ? 30 : 15) : undefined,
      urgencia: recorrente ? regra.urgencia : "monitorar",
      confianca: recorrente ? "alta" : "media",
    });
  }

  // 3. Concentração por sistema.
  const porSistema = new Map<string, CodigoDTC[]>();
  for (const c of ativos) {
    if (jaTratados.has(c.codigo)) continue;
    if (!porSistema.has(c.sistema)) porSistema.set(c.sistema, []);
    porSistema.get(c.sistema)!.push(c);
  }

  for (const [sistema, lista] of porSistema) {
    if (lista.length < 2) continue;
    const total = lista.reduce((a, c) => a + c.ocorrencias, 0);
    out.push({
      id: `rec-sis-${sistema}-${lista[0].veiculoId}`,
      veiculoId: lista[0].veiculoId,
      codigos: lista.map((c) => c.codigo),
      sistema,
      acao: `Antecipar a revisão de ${sistema.toLowerCase()}`,
      justificativa: `${lista.length} códigos distintos no mesmo sistema, ${total} ocorrências no total. Falhas concentradas costumam ter causa comum a montante.`,
      antecipacaoPct: 25,
      urgencia: "antecipar",
      confianca: "media",
    });
  }

  const ordem = { imediata: 0, corretiva: 1, antecipar: 2, monitorar: 3 };
  return out.sort((a, b) => ordem[a.urgencia] - ordem[b.urgencia]);
}

/**
 * Fator de antecipação a aplicar no intervalo do plano preventivo.
 *
 * Devolve 1 quando nada justifica mexer. Só recomendações de alta confiança
 * encurtam o intervalo automaticamente — as de confiança média aparecem na tela
 * para o gestor decidir, mas não alteram o cálculo sozinhas.
 */
export function fatorAntecipacao(recs: RecomendacaoDTC[], sistema: string): { fator: number; motivo: string | null } {
  const relevante = recs.find(
    (r) => r.sistema.toLowerCase() === sistema.toLowerCase() && r.antecipacaoPct && r.confianca === "alta",
  );
  if (!relevante) return { fator: 1, motivo: null };

  return {
    fator: 1 - (relevante.antecipacaoPct ?? 0) / 100,
    motivo: `código ${relevante.codigos.join(", ")} recorrente em ${sistema.toLowerCase()}`,
  };
}
