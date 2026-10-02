import { queryOptions } from "@tanstack/react-query";
import { api, type RankingMotoristasApi } from "@/lib/api";
import { chaveComGrupo, filtroGrupo } from "@/lib/escopo-ativo";
import { usandoMock } from "@/lib/modo";
import type { SerieGerencial, Totais, VeiculoOcioso } from "@/lib/gerencial-api";

/**
 * Páginas do Power BI "Indicadores de Condução" dentro de Relatórios
 * gerenciais. Todas as consultas recebem os mesmos filtros do painel:
 * período, garagem, placa e condutor (sempre além do escopo do usuário).
 *
 * Regras: vault, Regras-de-Negocio/indicadores-power-bi e
 * BI/Power-BI-Dicionario-Completo.
 */

export type FiltrosBI = {
  inicio: string;
  fim: string;
  /** subgroup_id */
  garagem?: string;
  /** unit_id */
  placa?: string;
  /** driver_id; "0" = não identificado */
  condutor?: string;
};

const qs = (p: Record<string, string | number | undefined>) => {
  const e = Object.entries(p).filter(([, v]) => v !== undefined && v !== "");
  return e.length ? "?" + new URLSearchParams(e.map(([k, v]) => [k, String(v)])) : "";
};

const params = (f: FiltrosBI, extra: Record<string, string | number | undefined> = {}) =>
  qs({
    ...filtroGrupo(),
    start_date: f.inicio,
    end_date: f.fim,
    subgroup_id: f.garagem,
    unit_id: f.placa,
    driver_id: f.condutor,
    ...extra,
  });

const chave = (nome: string, f: FiltrosBI, ...mais: (string | number | undefined)[]) =>
  chaveComGrupo("bi", nome, f.inicio, f.fim, f.garagem ?? "", f.placa ?? "", f.condutor ?? "", ...mais);

const semRepetirLogin = (n: number, e: unknown) => {
  const s = (e as { status?: number })?.status;
  return s !== 401 && s !== 403 && n < 2;
};

const base = { enabled: !usandoMock(), retry: semRepetirLogin, staleTime: 5 * 60_000 } as const;

/* --------------------------------- Tipos -------------------------------- */

export const TIPOS_EVENTO = [
  "aceleracao", "freada", "embreagem", "velocidade_seco", "velocidade_chuva", "faixa_amarela",
  "faixa_vermelha", "batendo_transmissao", "parado_acelerando", "sem_tracao",
] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];
export type ContagemEventos = Record<TipoEvento, number>;

export const ROTULO_EVENTO: Record<TipoEvento, string> = {
  aceleracao: "Aceleração brusca",
  freada: "Freada brusca",
  embreagem: "Embreagem excessiva",
  velocidade_seco: "Excesso de velocidade (seco)",
  velocidade_chuva: "Excesso de velocidade (chuva)",
  faixa_amarela: "Faixa amarela",
  faixa_vermelha: "Faixa vermelha",
  batendo_transmissao: "Batendo transmissão",
  parado_acelerando: "Parado acelerando",
  sem_tracao: "Movimento sem tração",
};

export const COR_EVENTO: Record<TipoEvento, string> = {
  aceleracao: "#E8A33A",
  freada: "#D2352A",
  embreagem: "#2E86C1",
  velocidade_seco: "#1B3A6B",
  velocidade_chuva: "#5DADE2",
  faixa_amarela: "#E8C63A",
  faixa_vermelha: "#B03A2E",
  batendo_transmissao: "#7FB3D5",
  parado_acelerando: "#E0483C",
  sem_tracao: "#7B3FA0",
};

/** Eventos de segurança (Central de Segurança): risco para pessoas, não só para o motor. */
export const EVENTOS_SEGURANCA: TipoEvento[] = ["velocidade_seco", "velocidade_chuva", "freada", "aceleracao"];

export type EventosBI = {
  inicio: string;
  fim: string;
  ultimo_evento: string | null;
  total: number;
  totais: ContagemEventos;
  por_placa: ({ unit_id: number; placa: string | null; total: number } & ContagemEventos)[];
  por_condutor: ({ driver_id: number; condutor: string | null; total: number } & ContagemEventos)[];
  /** dow: 0 = domingo. */
  matriz: { dow: number; hora: number; tipo: TipoEvento; n: number }[];
  por_dia: ({ dia: string } & ContagemEventos)[];
};

export type EventoItem = {
  id: number;
  hora: string | null;
  unit_id: number;
  placa: string;
  driver_id: number;
  condutor: string | null;
  evento: string | null;
  tipo: TipoEvento;
  endereco: string | null;
  cerca: string | null;
  latitude: number | null;
  longitude: number | null;
  velocidade?: number | null;
};

/** `fonte`: "tempo_real" quando o dia ainda não chegou ao heatmap e veio do histórico de posições. */
export type ListaEventosBI = { dia: string; ultimo_carregado: string | null; fonte?: "heatmap" | "tempo_real"; itens: EventoItem[] };

type Agrupado = { nome: string; horas: number; paradas: number };
export type ParadoBI = {
  inicio: string;
  fim: string;
  horas: number;
  paradas: number;
  por_local: Agrupado[];
  por_veiculo: (Agrupado & { unit_id: number })[];
  por_condutor: (Agrupado & { driver_id: number })[];
  detalhe: { inicio: string; veiculo: string; condutor: string; local: string; horas: number; latitude: number | null; longitude: number | null }[];
  por_hora: { hora: number; horas: number }[];
  por_dia_mes: { dia: number; horas: number }[];
};

export type NaoIdentificadoBI = {
  inicio: string;
  fim: string;
  horas_ni: number;
  registros: number;
  itens: { dia: string; unit_id: number; placa: string | null; horas: number; horas_ni: number; pct: number | null; registros: number }[];
};

export type GaragemBI = { id: number; name: string };

/* -------------------------------- Consultas ------------------------------ */

export const serieBIQuery = (f: FiltrosBI) =>
  queryOptions({
    ...base,
    queryKey: chave("serie", f),
    queryFn: () => api.get<SerieGerencial>(`/api/v1/gerencial/serie-diaria${params(f)}`),
  });

export const ociosoBIQuery = (f: FiltrosBI) =>
  queryOptions({
    ...base,
    queryKey: chave("ocioso", f),
    queryFn: () => api.get<{ inicio: string; fim: string; veiculos: VeiculoOcioso[] }>(`/api/v1/gerencial/ocioso${params(f)}`),
  });

/** O ranking não filtra por condutor no servidor: a tela recorta a lista. */
export const rankingBIQuery = (f: FiltrosBI, por: "motorista" | "veiculo") =>
  queryOptions({
    ...base,
    queryKey: chave("ranking", { ...f, condutor: undefined }, por),
    queryFn: () =>
      api.get<RankingMotoristasApi>(
        `/api/v1/driver-ranking/${params({ ...f, condutor: undefined }, { por })}`,
      ),
  });

export const eventosBIQuery = (f: FiltrosBI) =>
  queryOptions({ ...base, queryKey: chave("eventos", f), queryFn: () => api.get<EventosBI>(`/api/v1/bi/eventos${params(f)}`) });

export const listaEventosBIQuery = (dia: string, f: Omit<FiltrosBI, "inicio" | "fim">, limite = 1000) =>
  queryOptions({
    ...base,
    staleTime: 60_000,
    queryKey: chaveComGrupo("bi", "lista", dia, f.garagem ?? "", f.placa ?? "", f.condutor ?? "", limite),
    queryFn: () =>
      api.get<ListaEventosBI>(
        `/api/v1/bi/eventos/lista${qs({ ...filtroGrupo(), dia, subgroup_id: f.garagem, unit_id: f.placa, driver_id: f.condutor, limit: limite })}`,
      ),
  });

export const paradoBIQuery = (f: FiltrosBI, dur?: { min?: number; max?: number }) =>
  queryOptions({
    ...base,
    queryKey: chave("parado", f, dur?.min, dur?.max),
    queryFn: () => api.get<ParadoBI>(`/api/v1/bi/parado${params(f, { duracao_min: dur?.min, duracao_max: dur?.max })}`),
  });

export const naoIdentificadoBIQuery = (f: FiltrosBI) =>
  queryOptions({
    ...base,
    queryKey: chave("nao-identificado", f),
    queryFn: () => api.get<NaoIdentificadoBI>(`/api/v1/bi/nao-identificado${params(f)}`),
  });

export const garagensBIQuery = () =>
  queryOptions({
    ...base,
    staleTime: 30 * 60_000,
    queryKey: chaveComGrupo("bi", "garagens"),
    queryFn: () => api.get<GaragemBI[]>(`/api/v1/subgroups/${qs({ ...filtroGrupo(), limit: 1000 })}`),
  });

/* ------------------------------- Pontuação ------------------------------- */

/**
 * Componentes da Pontuação do Power BI (P6), com os ids de Metas e Pesos.
 * `frac` lê a fração do total das 13 faixas; `porHora` lê eventos por hora.
 */
export const COMPONENTES_PONTUACAO: {
  id: number;
  nome: string;
  tipo: "faixa" | "evento";
  ler: (t: Totais) => number;
}[] = [
  { id: 4, nome: "Verde", tipo: "faixa", ler: (t) => t.faixas.verde },
  { id: 5, nome: "Extra econômica", tipo: "faixa", ler: (t) => t.faixas.extra_economica },
  { id: 10, nome: "Inércia", tipo: "faixa", ler: (t) => t.faixas.inercia },
  { id: 22, nome: "Eco-roll", tipo: "faixa", ler: (t) => t.faixas.eco_roll },
  { id: 23, nome: "Baixa velocidade", tipo: "faixa", ler: (t) => t.faixas.baixa_velocidade },
  { id: 6, nome: "Amarela", tipo: "faixa", ler: (t) => t.faixas.amarela },
  { id: 7, nome: "Vermelha", tipo: "faixa", ler: (t) => t.faixas.vermelha },
  { id: 3, nome: "Batendo transmissão", tipo: "faixa", ler: (t) => t.faixas.batendo_transmissao },
  { id: 2, nome: "Movimento sem tração", tipo: "faixa", ler: (t) => t.faixas.movimento_sem_tracao },
  { id: 9, nome: "Parado acelerando", tipo: "faixa", ler: (t) => t.faixas.parado_acelerando },
  { id: 0, nome: "Parado ligado", tipo: "faixa", ler: (t) => t.faixas.parado_ocioso + t.faixas.parado_produtivo },
  { id: 11, nome: "Acima do turbo", tipo: "faixa", ler: (t) => t.turbo_acima },
  { id: 12, nome: "Abaixo do turbo", tipo: "faixa", ler: (t) => t.turbo_abaixo },
  { id: 15, nome: "Aceleração + freada", tipo: "evento", ler: (t) => t.aceleracao + t.freada },
  { id: 13, nome: "Excesso de velocidade", tipo: "evento", ler: (t) => t.velocidade },
  { id: 14, nome: "Embreagem", tipo: "evento", ler: (t) => t.embreagem },
];

const mesesTocados = (inicio: string, fim: string) => {
  const [a1, m1] = inicio.split("-").map(Number);
  const [a2, m2] = fim.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1) + 1;
};

/**
 * Pontuação da frota (ou do recorte filtrado) pela fórmula do Power BI, e a
 * contribuição de cada componente — a base da Gestão da Pontuação.
 *
 * O "abaixo do turbo" vale 0 fora de (0; 1,1], como a medida do BI.
 */
export function pontuacaoDetalhada(t: Totais, pesos: Record<string, number>, inicio: string, fim: string, motoristas: number) {
  const peso = (id: number) => pesos[String(id)] ?? 0;
  // Denominador: as 13 faixas (a tolerância entra aqui, mas não na nota).
  const fx = t.faixas_13;
  const componentes = COMPONENTES_PONTUACAO.map((c) => {
    let valor: number;
    if (c.tipo === "faixa") {
      valor = fx > 0 ? c.ler(t) / fx : 0;
      if (c.id === 12 && !(valor > 0 && valor <= 1.1)) valor = 0;
    } else {
      valor = t.horas > 0 ? c.ler(t) / t.horas : 0;
    }
    return { ...c, valor, peso: peso(c.id), pontos: valor * peso(c.id) };
  });
  const meses = mesesTocados(inicio, fim);
  const volume = motoristas > 0 ? ((t.horas * peso(18) + t.km * peso(18)) / meses) / motoristas : 0;
  const ganhos = componentes.filter((c) => c.pontos > 0).reduce((a, c) => a + c.pontos, 0) + Math.max(volume, 0);
  const perdas = componentes.filter((c) => c.pontos < 0).reduce((a, c) => a + c.pontos, 0) + Math.min(volume, 0);
  const total = fx > 0 ? Math.trunc((ganhos + perdas) * 100) / 100 : null;
  return { componentes, volume, ganhos, perdas, total };
}

export const estrelasDe = (nota: number | null) => {
  if (nota == null) return 0;
  for (const [corte, e] of [[90, 5], [80, 4], [70, 3], [60, 2], [50, 1]] as const) if (nota >= corte) return e;
  return 0;
};

/** Metas das faixas (fração) pelo id de Metas e Pesos. */
export const ID_META_FAIXA = {
  verde: 4, extra_economica: 5, inercia: 10, eco_roll: 22, baixa_velocidade: 23, amarela: 6, vermelha: 7,
  batendo_transmissao: 3, movimento_sem_tracao: 2, parado_acelerando: 9, parado_ligado: 0, tolerancia: 1,
} as const;
