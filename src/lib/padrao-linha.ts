import type { EsperadoIndicador, FaixaHoraria, OrigemPadrao, PadraoLinha } from "@/types";
import { CONFIG_PADRAO, INDICADORES } from "@/lib/faixas";

/**
 * Resolução do padrão de condução.
 *
 * Regra em uma frase: **o valor mais específico vence, e o que não foi definido
 * é herdado.**
 *
 *     linha + faixa horária  →  linha  →  padrão global
 *
 * A cadeia importa porque o cadastro é um delta. Uma linha que só ajusta a
 * faixa verde no pico grava um único indicador; os outros vinte e três
 * continuam vindo do global e continuam se atualizando quando o global mudar.
 *
 * Linha sem nada cadastrado funciona normalmente — usa o padrão global do
 * começo ao fim. Cadastrar é opcional por desenho.
 */

/** Faixas padrão. Configuráveis por organização quando o back-end existir. */
export const FAIXAS_HORARIAS: FaixaHoraria[] = [
  { id: "pico_manha", nome: "Pico manhã", inicio: "05:30", fim: "08:30", ordem: 1 },
  { id: "entrepico", nome: "Entrepico", inicio: "08:30", fim: "16:30", ordem: 2 },
  { id: "pico_tarde", nome: "Pico tarde", inicio: "16:30", fim: "19:30", ordem: 3 },
  { id: "noturno", nome: "Noturno", inicio: "19:30", fim: "05:30", ordem: 4 },
];

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/**
 * Faixa horária de um horário de partida.
 *
 * Usa a **partida** da viagem, não o instante do evento: viagem que atravessa
 * o limite de faixa seria contada em duas, e o mesmo trajeto acabaria avaliado
 * por dois padrões diferentes.
 */
export function faixaDe(horaPartida: string): FaixaHoraria {
  const m = minutos(horaPartida);
  for (const f of FAIXAS_HORARIAS) {
    const ini = minutos(f.inicio);
    const fim = minutos(f.fim);
    // Faixa que cruza a meia-noite (noturno) inverte a comparação.
    const dentro = ini <= fim ? m >= ini && m < fim : m >= ini || m < fim;
    if (dentro) return f;
  }
  return FAIXAS_HORARIAS[1];
}

/** Valor global do indicador, vindo da configuração de metas já existente. */
function globalDe(chave: string): EsperadoIndicador {
  const cfg = CONFIG_PADRAO[chave];
  return { esperado: cfg?.ativo ? cfg.meta : null, toleranciaPct: null };
}

export type ValorResolvido = EsperadoIndicador & { origem: OrigemPadrao };

/**
 * Resolve um indicador para uma linha e faixa, indicando de onde veio o valor.
 * A origem é devolvida junto porque a tela precisa mostrá-la — sem isso o
 * gestor não sabe se está olhando um valor dele ou herdado.
 */
export function resolverIndicador(
  chave: string,
  padroes: PadraoLinha[],
  linhaId: string,
  faixaHorariaId: string | null,
): ValorResolvido {
  if (faixaHorariaId) {
    const p = padroes.find((x) => x.linhaId === linhaId && x.faixaHorariaId === faixaHorariaId);
    const v = p?.indicadores[chave];
    if (v && v.esperado !== null && v.esperado !== undefined) return { ...v, origem: "linha_faixa" };
  }

  const pLinha = padroes.find((x) => x.linhaId === linhaId && x.faixaHorariaId === null);
  const vLinha = pLinha?.indicadores[chave];
  if (vLinha && vLinha.esperado !== null && vLinha.esperado !== undefined) {
    return { ...vLinha, origem: "linha" };
  }

  return { ...globalDe(chave), origem: "global" };
}

/** Todos os indicadores resolvidos de uma vez, para montar a tela. */
export function resolverTodos(
  padroes: PadraoLinha[],
  linhaId: string,
  faixaHorariaId: string | null,
): Record<string, ValorResolvido> {
  return Object.fromEntries(
    INDICADORES.map((i) => [i.chave, resolverIndicador(i.chave, padroes, linhaId, faixaHorariaId)]),
  );
}

/** Quantos indicadores foram definidos neste nível — usado nos contadores. */
export function contarDefinidos(
  padroes: PadraoLinha[],
  linhaId: string,
  faixaHorariaId: string | null,
): number {
  const p = padroes.find((x) => x.linhaId === linhaId && x.faixaHorariaId === faixaHorariaId);
  if (!p) return 0;
  return Object.values(p.indicadores).filter((v) => v.esperado !== null && v.esperado !== undefined).length;
}

/** Linhas que têm ao menos um padrão cadastrado. */
export const linhasComPadrao = (padroes: PadraoLinha[]) =>
  new Set(padroes.filter((p) => Object.keys(p.indicadores).length > 0).map((p) => p.linhaId));

/**
 * Sugestão a partir do histórico.
 *
 * Devolve o percentil 75 das viagens observadas naquele contexto — não a média.
 * A média incorporaria a ineficiência de quem dirige mal; o P75 responde "o que
 * o quarto superior consegue fazer nesta linha", que é a pergunta do gestor
 * quando ele não sabe qual número colocar.
 *
 * É apoio, não imposição: o valor entra no campo e continua editável.
 */
export function percentil(valores: number[], p = 75): number | null {
  if (!valores.length) return null;
  const ord = [...valores].sort((a, b) => a - b);
  const idx = Math.min(ord.length - 1, Math.floor((p / 100) * ord.length));
  return ord[idx];
}
