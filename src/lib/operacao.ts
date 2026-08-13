import type {
  DiaFiscal,
  SituacaoViagem,
  ViagemProgramada,
  ViagemRealizada,
} from "@/types";

/**
 * Dia fiscal e aderência à programação.
 *
 * Duas regras que o sistema não tinha e que mudam praticamente todo cálculo por
 * data em operação de passageiros.
 */

/* ------------------------------------------------------------------ */
/* Dia fiscal                                                          */
/* ------------------------------------------------------------------ */

/**
 * Padrão da operação de ônibus: o dia começa às 03:00 e vai até 02:59 do dia
 * seguinte. Uma viagem que parte 23:40 e chega 00:20 pertence ao mesmo dia
 * operacional — agrupar por data de calendário parte essa viagem em dois dias e
 * distorce todo indicador diário.
 */
export const DIA_FISCAL_PADRAO: DiaFiscal = { inicio: "03:00", fuso: "America/Sao_Paulo" };

const minutosDe = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Data de operação (YYYY-MM-DD) à qual um instante pertence. */
export function dataOperacao(instante: Date | string, dia: DiaFiscal = DIA_FISCAL_PADRAO): string {
  const d = typeof instante === "string" ? new Date(instante) : instante;
  const minutosNoDia = d.getHours() * 60 + d.getMinutes();
  const ref = new Date(d);
  // Antes do início do dia fiscal, o instante pertence ao dia anterior.
  if (minutosNoDia < minutosDe(dia.inicio)) ref.setDate(ref.getDate() - 1);
  return ref.toISOString().slice(0, 10);
}

/** Início e fim, em instantes reais, de uma data de operação. */
export function janelaDiaFiscal(data: string, dia: DiaFiscal = DIA_FISCAL_PADRAO): { de: Date; ate: Date } {
  const [h, m] = dia.inicio.split(":").map(Number);
  const de = new Date(`${data}T00:00:00`);
  de.setHours(h, m, 0, 0);
  const ate = new Date(de);
  ate.setDate(ate.getDate() + 1);
  ate.setMilliseconds(-1);
  return { de, ate };
}

/** Rótulo legível da janela, para exibir junto ao filtro de data. */
export const rotuloDiaFiscal = (dia: DiaFiscal = DIA_FISCAL_PADRAO) => {
  const fim = minutosDe(dia.inicio) - 1;
  const hh = String(Math.floor(((fim + 1440) % 1440) / 60)).padStart(2, "0");
  const mm = String(((fim + 1440) % 1440) % 60).padStart(2, "0");
  return `Dia fiscal: ${dia.inicio} às ${hh}:${mm} do dia seguinte`;
};

/**
 * Tipo de dia de uma data. Feriados entram por lista da organização — aqui só a
 * distinção de fim de semana, que é a base.
 */
export function tipoDiaDe(data: string): "util" | "sabado" | "domingo" {
  const d = new Date(`${data}T12:00:00`).getDay();
  if (d === 0) return "domingo";
  if (d === 6) return "sabado";
  return "util";
}

/* ------------------------------------------------------------------ */
/* Aderência: programado × realizado                                   */
/* ------------------------------------------------------------------ */

/**
 * Tolerâncias em minutos. Fora dessa janela a viagem é classificada como
 * adiantada ou atrasada. Valores típicos de contrato de concessão; devem virar
 * configuração por organização quando o back-end existir.
 */
export const TOLERANCIA = { adiantamentoMin: 3, atrasoMin: 5 };

/** Diferença em minutos entre realizado e programado. Negativo = adiantado. */
export function desvioMin(programado?: string, realizado?: string): number | null {
  if (!programado || !realizado) return null;
  return minutosDe(realizado) - minutosDe(programado);
}

/**
 * Classifica a viagem no confronto com a programação.
 *
 * A ordem importa: uma viagem sem partida realizada cujo horário já passou é
 * "não realizada", não "aguardando" — é justamente esse caso que o poder
 * concedente cobra.
 */
export function classificarViagem(
  v: Pick<
    ViagemRealizada,
    "partidaProgramada" | "partidaRealizada" | "chegadaRealizada" | "percursoPct" | "programadaId"
  >,
  agoraHHMM: string,
): SituacaoViagem {
  if (!v.programadaId) return "reforco";

  if (!v.partidaRealizada) {
    const prog = v.partidaProgramada ? minutosDe(v.partidaProgramada) : null;
    if (prog !== null && minutosDe(agoraHHMM) > prog + TOLERANCIA.atrasoMin) return "nao_realizada";
    return "aguardando";
  }

  if (!v.chegadaRealizada) return "em_andamento";

  const d = desvioMin(v.partidaProgramada, v.partidaRealizada);
  if (d === null) return "ok";
  if (d < -TOLERANCIA.adiantamentoMin) return "adiantada";
  if (d > TOLERANCIA.atrasoMin) return "atrasada";
  return "ok";
}

/** Eficiência da programação: realizadas sobre programadas, em %. */
export function eficienciaProgramacao(viagens: ViagemRealizada[]): number {
  const programadas = viagens.filter((v) => v.programadaId).length;
  if (!programadas) return 0;
  const cumpridas = viagens.filter(
    (v) => v.programadaId && v.situacao !== "nao_realizada" && v.situacao !== "aguardando",
  ).length;
  return Math.round((cumpridas / programadas) * 100);
}

/** Contagem por situação, para os contadores do painel. */
export function resumoViagens(viagens: ViagemRealizada[]) {
  const conta = (s: SituacaoViagem) => viagens.filter((v) => v.situacao === s).length;
  return {
    programadas: viagens.filter((v) => v.programadaId).length,
    realizadas: viagens.filter((v) => v.partidaRealizada).length,
    ok: conta("ok"),
    atrasadas: conta("atrasada"),
    adiantadas: conta("adiantada"),
    naoRealizadas: conta("nao_realizada"),
    emAndamento: conta("em_andamento"),
    reforco: conta("reforco"),
    aguardando: conta("aguardando"),
    eficiencia: eficienciaProgramacao(viagens),
  };
}

/**
 * Cobertura de km: quanto do rodado aconteceu dentro de um itinerário
 * cadastrado. Km sem itinerário costuma ser deslocamento de garagem, desvio ou
 * viagem não identificada — e é o primeiro lugar onde se procura perda.
 */
export function coberturaKm(viagens: ViagemRealizada[], kmTotalFrota: number) {
  const comItinerario = viagens.reduce((a, v) => a + (v.kmRodado ?? 0), 0);
  const sem = Math.max(0, kmTotalFrota - comItinerario);
  return {
    comItinerario,
    semItinerario: sem,
    pctCobertura: kmTotalFrota ? Math.round((comItinerario / kmTotalFrota) * 100) : 0,
  };
}

/** Headway realizado a partir das partidas de um mesmo sentido, em minutos. */
export function headwaysDe(partidas: string[]): number[] {
  const ordenadas = [...partidas].sort();
  const out: number[] = [];
  for (let i = 1; i < ordenadas.length; i++) {
    out.push(minutosDe(ordenadas[i]) - minutosDe(ordenadas[i - 1]));
  }
  return out;
}

/** Índice de regularidade: quanto o headway realizado desvia do programado. */
export function regularidadeHeadway(programado: number, realizados: number[]): number {
  if (!realizados.length || !programado) return 100;
  const desvioMedio =
    realizados.reduce((a, r) => a + Math.abs(r - programado), 0) / realizados.length;
  return Math.max(0, Math.round(100 - (desvioMedio / programado) * 100));
}

/* ------------------------------------------------------------------ */
/* Indicadores do setor                                                */
/* ------------------------------------------------------------------ */

/** IPK — passageiros transportados por quilômetro rodado. */
export const ipk = (passageiros: number, km: number) => (km ? passageiros / km : 0);

/** CPK — custo por quilômetro. */
export const cpk = (custo: number, km: number) => (km ? custo / km : 0);

/** MKBF — quilômetros médios entre falhas. */
export const mkbf = (km: number, falhas: number) => (falhas ? km / falhas : km);

/** Custo por passageiro transportado. */
export const custoPorPassageiro = (custo: number, passageiros: number) =>
  passageiros ? custo / passageiros : 0;

/** Score de condução normalizado: eventos por 100 km. */
export const eventosPor100km = (eventos: number, km: number) => (km ? (eventos / km) * 100 : 0);
