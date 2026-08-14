import type { PadraoLinha } from "@/types";
import { INDICADORES, type IndicadorMeta } from "@/lib/faixas";
import { CONFIG_PADRAO } from "@/lib/faixas";
import { faixaDe, resolverIndicador } from "@/lib/padrao-linha";

/**
 * Cálculo da nota do motorista contra o padrão da linha.
 *
 * Substitui a comparação contra a média geral da frota. Uma viagem é pontuada
 * contra o padrão resolvido para a linha e a faixa horária em que ela ocorreu;
 * a nota do motorista é a média das viagens dele, ponderada por quilômetro.
 *
 * A ponderação por km importa: sem ela, uma viagem curta de 3 km pesaria o
 * mesmo que uma de 30 km, e o motorista poderia melhorar a nota escolhendo
 * viagens curtas.
 */

/** Desempenho observado numa viagem, indicador a indicador. */
export type DesempenhoViagem = {
  id: string;
  motoristaId: string;
  linhaId: string;
  veiculoId: string;
  /** HH:MM da partida — define a faixa horária aplicável. */
  partida: string;
  data: string;
  km: number;
  /** Chave do indicador → valor observado. */
  observado: Record<string, number>;
};

/** Resultado de um indicador dentro de um contexto. */
export type ResultadoIndicador = {
  indicador: IndicadorMeta;
  observado: number;
  esperado: number | null;
  /** Diferença observada − esperada, com sinal cru. */
  desvio: number | null;
  /** true quando o desvio é favorável, considerando a direção do indicador. */
  favoravel: boolean | null;
  /** Nota de 0 a 100 deste indicador. */
  nota: number;
  peso: number;
  origem: "linha_faixa" | "linha" | "global";
};

export type ResultadoContexto = {
  linhaId: string;
  faixaHorariaId: string;
  faixaNome: string;
  viagens: number;
  km: number;
  nota: number;
  indicadores: ResultadoIndicador[];
};

/**
 * Nota de um indicador isolado.
 *
 * Atingir o esperado dá 100. Ficar aquém reduz proporcionalmente à distância
 * relativa, e superar o esperado dá bônus limitado a 110 — o teto existe para
 * que um único indicador excepcional não compense três ruins.
 */
function notaIndicador(observado: number, esperado: number, direcao: "maior" | "menor"): number {
  if (esperado === 0) return direcao === "menor" && observado === 0 ? 100 : 60;

  const razao = direcao === "maior" ? observado / esperado : esperado / Math.max(observado, 0.01);
  return Math.max(0, Math.min(110, Math.round(razao * 100)));
}

/** Peso do indicador, vindo da configuração de premiação já existente. */
const pesoDe = (chave: string) => {
  const c = CONFIG_PADRAO[chave];
  return c?.ativo ? c.peso : 0;
};

/**
 * Pontua uma viagem contra o padrão da linha/faixa em que ela ocorreu.
 *
 * Indicador sem valor esperado (nem na linha, nem no global) fica de fora do
 * cálculo — e o peso dele é redistribuído entre os demais pela normalização da
 * média ponderada. Assim a ausência de um indicador não derruba a nota.
 */
export function pontuarViagem(
  viagem: DesempenhoViagem,
  padroes: PadraoLinha[],
): { nota: number; indicadores: ResultadoIndicador[]; faixaId: string; faixaNome: string } {
  const faixa = faixaDe(viagem.partida);
  const resultados: ResultadoIndicador[] = [];

  for (const ind of INDICADORES) {
    const observado = viagem.observado[ind.chave];
    if (observado === undefined) continue;

    const peso = pesoDe(ind.chave);
    if (peso === 0) continue;

    const resolvido = resolverIndicador(ind.chave, padroes, viagem.linhaId, faixa.id);
    const esperado = resolvido.esperado;

    if (esperado === null) continue;

    const desvio = observado - esperado;
    const favoravel = ind.direcao === "maior" ? desvio >= 0 : desvio <= 0;

    resultados.push({
      indicador: ind,
      observado,
      esperado,
      desvio,
      favoravel,
      nota: notaIndicador(observado, esperado, ind.direcao),
      peso,
      origem: resolvido.origem,
    });
  }

  const somaPesos = resultados.reduce((a, r) => a + r.peso, 0);
  const nota = somaPesos
    ? Math.round(resultados.reduce((a, r) => a + r.nota * r.peso, 0) / somaPesos)
    : 0;

  return { nota, indicadores: resultados, faixaId: faixa.id, faixaNome: faixa.nome };
}

/**
 * Agrupa as viagens do motorista por contexto (linha × faixa) e devolve a nota
 * de cada um, mais a nota geral ponderada por quilômetro.
 *
 * A visão por contexto é o que torna a nota defensável perante o motorista: ele
 * consegue ver em qual linha e em qual horário ficou aquém, em vez de receber um
 * número único sem explicação.
 */
export function avaliarMotorista(
  viagens: DesempenhoViagem[],
  padroes: PadraoLinha[],
): { nota: number; km: number; contextos: ResultadoContexto[] } {
  const porContexto = new Map<string, { linhaId: string; faixaId: string; faixaNome: string; viagens: DesempenhoViagem[] }>();

  for (const v of viagens) {
    const faixa = faixaDe(v.partida);
    const chave = `${v.linhaId}|${faixa.id}`;
    if (!porContexto.has(chave)) {
      porContexto.set(chave, { linhaId: v.linhaId, faixaId: faixa.id, faixaNome: faixa.nome, viagens: [] });
    }
    porContexto.get(chave)!.viagens.push(v);
  }

  const contextos: ResultadoContexto[] = [];

  for (const grupo of porContexto.values()) {
    const km = grupo.viagens.reduce((a, v) => a + v.km, 0);
    const pontuadas = grupo.viagens.map((v) => ({ v, r: pontuarViagem(v, padroes) }));

    const nota = km
      ? Math.round(pontuadas.reduce((a, p) => a + p.r.nota * p.v.km, 0) / km)
      : 0;

    // Consolida os indicadores do contexto: média ponderada por km das viagens.
    const mapa = new Map<string, ResultadoIndicador & { _km: number }>();
    for (const { v, r } of pontuadas) {
      for (const ind of r.indicadores) {
        const atual = mapa.get(ind.indicador.chave);
        if (!atual) {
          mapa.set(ind.indicador.chave, { ...ind, observado: ind.observado * v.km, _km: v.km });
        } else {
          atual.observado += ind.observado * v.km;
          atual._km += v.km;
        }
      }
    }

    const indicadores = [...mapa.values()].map((i) => {
      const observado = i._km ? i.observado / i._km : 0;
      const esperado = i.esperado ?? 0;
      const desvio = observado - esperado;
      return {
        ...i,
        observado: Math.round(observado * 10) / 10,
        desvio: Math.round(desvio * 10) / 10,
        favoravel: i.indicador.direcao === "maior" ? desvio >= 0 : desvio <= 0,
        nota: notaIndicador(observado, esperado, i.indicador.direcao),
      } as ResultadoIndicador;
    });

    contextos.push({
      linhaId: grupo.linhaId,
      faixaHorariaId: grupo.faixaId,
      faixaNome: grupo.faixaNome,
      viagens: grupo.viagens.length,
      km,
      nota,
      indicadores: indicadores.sort((a, b) => b.peso - a.peso),
    });
  }

  const kmTotal = contextos.reduce((a, c) => a + c.km, 0);
  const nota = kmTotal
    ? Math.round(contextos.reduce((a, c) => a + c.nota * c.km, 0) / kmTotal)
    : 0;

  return { nota, km: kmTotal, contextos: contextos.sort((a, b) => b.km - a.km) };
}

/**
 * Nota calculada contra o padrão global, ignorando a linha.
 *
 * Serve só para comparação na interface: mostrar lado a lado quanto a nota do
 * motorista muda quando o contexto é considerado é o argumento mais direto de
 * que a contextualização importa.
 */
export function avaliarSemContexto(viagens: DesempenhoViagem[]): number {
  return avaliarMotorista(viagens, []).nota;
}
