import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Painel Operacional do CCO (ss-fleet-core endpoints/painel_operacional.py). */

export type ColunaConsumo = {
  chave: string;
  rotulo: string;
  tipo: "mes" | "atual" | "anterior" | "hoje";
  inicio: string;
  fim: string;
  oculta: boolean;
  /** Coluna contra a qual a variação é calculada. */
  base?: string;
};

export type CelulaConsumo = {
  km: number;
  km_comb: number;
  litros: number;
  veiculos: number;
  kml: number | null;
  insuficiente: boolean;
};

type PorColuna<T> = Record<string, T>;

export type PainelOperacional = {
  colunas: ColunaConsumo[];
  modelos: { modelo: string; celulas: PorColuna<CelulaConsumo> }[];
  frota: PorColuna<CelulaConsumo>;
  diesel: PorColuna<number | null>;
  custo_km: PorColuna<number | null>;
  velocidade: PorColuna<number | null>;
  altitude: PorColuna<number | null>;
  qualidade: Record<"rpm" | "pedal" | "velocidade" | "offline" | "total", PorColuna<number | null>>;
  qualidade_andamento: { feitos: number; total: number; erro: string | null };
  km_minimo: number;
  ultimo_dado: string | null;
  atualizado_em: string;
  fonte: string;
};

export const painelOperacionalQuery = (grupo: string, meses: number) =>
  queryOptions({
    queryKey: ["cco", "painel-operacional", grupo, meses],
    queryFn: () =>
      api.get<PainelOperacional>(
        `/api/v1/cco/painel-operacional?meses=${meses}${grupo ? `&group_id=${grupo}` : ""}`,
      ),
    staleTime: 60_000,
    // Enquanto o histórico da qualidade do dado é calculado, as células vão se completando.
    refetchInterval: (q) => {
      const a = q.state.data?.qualidade_andamento;
      return a && !a.erro && a.feitos < a.total ? 30_000 : 10 * 60_000;
    },
  });

export type HojeAoVivo = {
  modelos: PorColuna<CelulaConsumo>;
  frota: CelulaConsumo;
  velocidade: number | null;
  altitude: number | null;
  diesel: number | null;
  custo_km: number | null;
  qualidade: Record<"rpm" | "pedal" | "velocidade" | "offline" | "total", number>;
  km_minimo: number;
  lido_em: string;
  intervalo_s: number;
};

/** Coluna de hoje. A tela busca a cada 10 s; o dado novo chega conforme os rastreadores mandam (1 a 2 min). */
export const hojeAoVivoQuery = (grupo: string) =>
  queryOptions({
    queryKey: ["cco", "painel-operacional", "hoje", grupo],
    queryFn: () =>
      api.get<HojeAoVivo>(
        `/api/v1/cco/painel-operacional/hoje${grupo ? `?group_id=${grupo}` : ""}`,
      ),
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    staleTime: 5_000,
  });

export type RegraVariacao = "subir_bom" | "subir_ruim" | "neutra";

/** Direção, sinal e cor da variação. Abaixo de 0,5% não há direção; a seta e o sinal não dependem da cor. */
export function variacao(
  atual: number | null | undefined,
  base: number | null | undefined,
  regra: RegraVariacao,
): { seta: "▲" | "▼" | "–"; texto: string; tom: "bom" | "ruim" | "neutro" } | null {
  if (atual == null || base == null) return null;
  if (base === 0) {
    if (atual === 0) return { seta: "–", texto: "0%", tom: "neutro" };
    return { seta: "▲", texto: "novo", tom: regra === "subir_ruim" ? "ruim" : "neutro" };
  }
  const pct = ((atual - base) / base) * 100;
  if (Math.abs(pct) < 0.5) return { seta: "–", texto: `${fmtPct(pct)}%`, tom: "neutro" };
  const subiu = pct > 0;
  const tom = regra === "neutra" ? "neutro" : subiu === (regra === "subir_bom") ? "bom" : "ruim";
  return { seta: subiu ? "▲" : "▼", texto: `${subiu ? "+" : "−"}${fmtPct(pct)}%`, tom };
}

const fmtPct = (p: number) =>
  Math.abs(p).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
