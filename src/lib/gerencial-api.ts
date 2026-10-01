import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { chaveComGrupo, filtroGrupo } from "@/lib/escopo-ativo";
import { usandoMock } from "@/lib/modo";

/**
 * Relatórios gerenciais — séries do BI e as contas em cima delas.
 *
 * Cada regra aqui está no vault (BI/Dashboard-Start, Regras-de-Negocio/
 * indicadores-dashboard-start e indicadores-power-bi). Onde o vault não define,
 * o comentário diz que é decisão de tela.
 */

export type Faixas13 = {
  verde: number;
  extra_economica: number;
  inercia: number;
  eco_roll: number;
  baixa_velocidade: number;
  amarela: number;
  vermelha: number;
  batendo_transmissao: number;
  movimento_sem_tracao: number;
  parado_acelerando: number;
  parado_ocioso: number;
  parado_produtivo: number;
  tolerancia: number;
};

export type DiaGerencial = {
  dia: string;
  km: number;
  km_filtrado: number;
  litros: number;
  horas: number;
  horas_sem_condutor: number;
  aceleracao: number;
  freada: number;
  embreagem: number;
  velocidade: number;
  veiculos: number;
  motoristas: number;
  faixas: Faixas13;
  faixas_13: number;
  total_11: number;
  stop_engine_on: number;
};

export type SerieGerencial = {
  inicio: string;
  fim: string;
  meta_parado: number;
  meta_parado_cadastrada: boolean;
  dias: DiaGerencial[];
};

export type VeiculoOcioso = {
  unit_id: number;
  rotulo: string;
  motorista: string | null;
  segundos_parado: number;
  pct_parado: number | null;
  litros: number;
  serie: number[];
};

const qs = (p: Record<string, string | undefined>) => {
  const e = Object.entries(p).filter(([, v]) => v);
  return e.length ? "?" + new URLSearchParams(e as [string, string][]) : "";
};

export const serieGerencialQuery = (inicio?: string, fim?: string) =>
  queryOptions({
    queryKey: chaveComGrupo("gerencial", "serie", inicio ?? "", fim ?? ""),
    queryFn: () =>
      api.get<SerieGerencial>(`/api/v1/gerencial/serie-diaria/${qs({ ...filtroGrupo(), start_date: inicio, end_date: fim })}`),
    enabled: !usandoMock(),
    staleTime: 5 * 60_000,
  });

export const ociosoQuery = (inicio?: string, fim?: string) =>
  queryOptions({
    queryKey: chaveComGrupo("gerencial", "ocioso", inicio ?? "", fim ?? ""),
    queryFn: () =>
      api.get<{ inicio: string; fim: string; veiculos: VeiculoOcioso[] }>(
        `/api/v1/gerencial/ocioso/${qs({ ...filtroGrupo(), start_date: inicio, end_date: fim })}`,
      ),
    enabled: !usandoMock(),
    staleTime: 5 * 60_000,
  });

/* ------------------------------- Períodos ------------------------------- */

export const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const ontem = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
};

export type Periodo = "7d" | "30d" | "mes" | "mes_anterior" | "90d";

export const ROTULO_PERIODO: Record<Periodo, string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Mês atual",
  mes_anterior: "Mês anterior",
  "90d": "Últimos 90 dias",
};

/** Fim sempre em ontem: as tabelas consolidadas não têm o dia corrente. */
export function datasDoPeriodo(p: Periodo): { inicio: string; fim: string } {
  const f = ontem();
  const menos = (dias: number) => {
    const d = new Date(f);
    d.setDate(d.getDate() - dias + 1);
    return d;
  };
  if (p === "7d") return { inicio: iso(menos(7)), fim: iso(f) };
  if (p === "90d") return { inicio: iso(menos(90)), fim: iso(f) };
  if (p === "mes") return { inicio: iso(new Date(f.getFullYear(), f.getMonth(), 1)), fim: iso(f) };
  if (p === "mes_anterior")
    return { inicio: iso(new Date(f.getFullYear(), f.getMonth() - 1, 1)), fim: iso(new Date(f.getFullYear(), f.getMonth(), 0)) };
  return { inicio: iso(menos(30)), fim: iso(f) };
}

/** Mesmos dias do mês anterior (Dashboard Start, R8). */
export function periodoAnterior(inicio: string, fim: string) {
  const m = (s: string) => {
    const [a, b, c] = s.split("-").map(Number);
    const d = new Date(a, b - 2, c);
    // 31/03 → 28/02, não 03/03.
    if (d.getMonth() !== (b - 2 + 12) % 12) d.setDate(0);
    return iso(d);
  };
  return { inicio: m(inicio), fim: m(fim) };
}

/* -------------------------------- Somas --------------------------------- */

export type Totais = Omit<DiaGerencial, "dia"> & { dias: number };

export function somar(dias: DiaGerencial[]): Totais {
  const z: Totais = {
    km: 0, km_filtrado: 0, litros: 0, horas: 0, horas_sem_condutor: 0, aceleracao: 0, freada: 0, embreagem: 0,
    velocidade: 0, veiculos: 0, motoristas: 0, faixas_13: 0, total_11: 0, stop_engine_on: 0, dias: dias.length,
    faixas: {
      verde: 0, extra_economica: 0, inercia: 0, eco_roll: 0, baixa_velocidade: 0, amarela: 0, vermelha: 0,
      batendo_transmissao: 0, movimento_sem_tracao: 0, parado_acelerando: 0, parado_ocioso: 0, parado_produtivo: 0, tolerancia: 0,
    },
  };
  for (const d of dias) {
    for (const k of ["km", "km_filtrado", "litros", "horas", "horas_sem_condutor", "aceleracao", "freada", "embreagem", "velocidade", "faixas_13", "total_11", "stop_engine_on"] as const) {
      z[k] += d[k];
    }
    z.veiculos = Math.max(z.veiculos, d.veiculos);
    z.motoristas = Math.max(z.motoristas, d.motoristas);
    for (const f of Object.keys(z.faixas) as (keyof Faixas13)[]) z.faixas[f] += d.faixas[f];
  }
  return z;
}

/** Indicadores do topo do Dashboard Start (vault, seção 2). */
export function indicadoresDoTopo(t: Totais, fim: string, precoDiesel: number) {
  const [a, m] = fim.split("-").map(Number);
  const diasDoMes = new Date(a, m, 0).getDate();
  const estMes = t.dias > 0 ? (t.litros / t.dias) * diasDoMes : 0;
  const parado = t.total_11 > 0 ? t.stop_engine_on / t.total_11 : null;
  return {
    consumo: t.litros,
    estMes,
    custoEstimado: estMes * precoDiesel,
    km: t.km,
    horas: t.horas,
    kml: t.litros > 0 ? t.km_filtrado / t.litros : null,
    velocidade: t.horas > 0 ? t.km / t.horas : null,
    parado,
    eficiencia: parado == null ? null : 1 - parado,
  };
}

/** % de cada faixa sobre as 13 (Power BI, P3). */
export function pctFaixas13(t: { faixas: Faixas13; faixas_13: number }) {
  const r = {} as Record<keyof Faixas13, number>;
  for (const k of Object.keys(t.faixas) as (keyof Faixas13)[]) r[k] = t.faixas_13 > 0 ? t.faixas[k] / t.faixas_13 : 0;
  return r;
}

/** Lado bom × lado ruim (Power BI). Parado ligado inclui o produtivo. */
export function lados(t: { faixas: Faixas13; faixas_13: number }) {
  const p = pctFaixas13(t);
  const bom = p.inercia + p.extra_economica + p.verde + p.baixa_velocidade + p.eco_roll;
  const ruim =
    p.amarela + p.vermelha + p.parado_acelerando + p.batendo_transmissao + p.movimento_sem_tracao + p.tolerancia +
    p.parado_ocioso + p.parado_produtivo;
  return { bom, ruim };
}

/** Economia potencial do Dashboard Start (vault, seção 6). */
export function economiaPotencial(t: Totais, precoDiesel: number) {
  const custo = t.litros * precoDiesel;
  const parado = t.total_11 > 0 ? t.stop_engine_on / t.total_11 : 0;
  const vermelha = t.total_11 > 0 ? t.faixas.vermelha / t.total_11 : 0;
  const amarela = t.total_11 > 0 ? t.faixas.amarela / t.total_11 : 0;
  const ociosidade = custo * parado * 0.5;
  const altaRotacao = custo * vermelha * 0.15;
  const alerta = custo * amarela * 0.08;
  const total = ociosidade + altaRotacao + alerta;
  return { custo, ociosidade, altaRotacao, alerta, total, pct: custo > 0 ? total / custo : 0, parado, vermelha, amarela };
}

/** CO₂ do Power BI: litros × 3,21 (kg). */
export const co2Kg = (litros: number) => litros * 3.21;

/**
 * Agrupamento da evolução (Dashboard Start, R10): dia até 45 dias, mês de 46 a
 * 180, trimestre acima.
 */
export function agrupar(dias: DiaGerencial[]) {
  const n = dias.length;
  const chave = (d: string) => {
    const [a, m, dd] = d.split("-");
    if (n <= 45) return `${dd}/${m}`;
    if (n <= 180) return `${m}/${a.slice(2)}`;
    return `T${Math.ceil(Number(m) / 3)}/${a.slice(2)}`;
  };
  const grupos = new Map<string, DiaGerencial[]>();
  for (const d of dias) {
    const k = chave(d.dia);
    grupos.set(k, [...(grupos.get(k) ?? []), d]);
  }
  return [...grupos.entries()].map(([rotulo, ds]) => ({ rotulo, ...somar(ds) }));
}

/** Preço padrão do diesel: o valor que o Dashboard Start usa quando a API de preço falha. */
export const PRECO_DIESEL_PADRAO = 6.0;

export const CORES_FAIXA: Record<keyof Faixas13, string> = {
  verde: "#2E9E4F",
  extra_economica: "#1E7A38",
  inercia: "#9BD5A0",
  eco_roll: "#1B3A6B",
  baixa_velocidade: "#B8A21A",
  amarela: "#E8C63A",
  vermelha: "#D2352A",
  batendo_transmissao: "#2E86C1",
  movimento_sem_tracao: "#7B3FA0",
  parado_acelerando: "#E0483C",
  parado_ocioso: "#F0A868",
  parado_produtivo: "#8A9199",
  tolerancia: "#C9CFD4",
};

export const ROTULO_FAIXA: Record<keyof Faixas13, string> = {
  verde: "Verde",
  extra_economica: "Extra econômica",
  inercia: "Inércia",
  eco_roll: "Eco-roll",
  baixa_velocidade: "Baixa velocidade",
  amarela: "Amarela",
  vermelha: "Vermelha",
  batendo_transmissao: "Batendo transmissão",
  movimento_sem_tracao: "Movimento sem tração",
  parado_acelerando: "Parado acelerando",
  parado_ocioso: "Parado ligado (ocioso)",
  parado_produtivo: "Parado ligado produtivo",
  tolerancia: "Tolerância",
};

export const nf = (v: number | null | undefined, casas = 0) =>
  v == null || Number.isNaN(v) ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
export const pct = (v: number | null | undefined, casas = 1) => (v == null ? "—" : `${nf(v * 100, casas)}%`);
export const brl = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const hhmm = (seg: number) => `${Math.floor(seg / 3600)}h${String(Math.round((seg % 3600) / 60)).padStart(2, "0")}`;
