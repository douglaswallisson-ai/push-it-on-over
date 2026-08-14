/**
 * Cliente de API — a única porta de entrada para o back-end Python.
 *
 * Hoje as telas usam dados de exemplo inline. A migração é: mover cada
 * `const DADOS = [...]` para uma função de recurso aqui e, na tela, trocar o
 * array por uma chamada a este cliente (ver BACKEND.md). Assim o back Python
 * entra sem tocar no visual.
 *
 * A base vem de `VITE_API_BASE` (vazio = mesma origem; use o proxy do Vite em
 * desenvolvimento para evitar CORS).
 */
import type {
  Alarme,
  EmissaoResumo,
  Manutencao,
  Motorista,
  Paginated,
  PosicaoVeiculo,
  ResumoOperacao,
  Veiculo,
  Viagem,
} from "@/types";
import * as M from "@/lib/mock-data";

const BASE = import.meta.env.VITE_API_BASE ?? "";

/** Headers enviados em toda chamada. O `ngrok-skip-browser-warning` evita a
 *  página HTML de aviso do túnel ngrok (que quebraria o parse do JSON). */
const DEFAULT_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "ngrok-skip-browser-warning": "true",
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...DEFAULT_HEADERS, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, "Resposta inválida da API (não é JSON).");
  }
}

const qs = (params?: Record<string, string | number | undefined>) => {
  if (!params) return "";
  const clean = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  return clean.length ? "?" + new URLSearchParams(clean.map(([k, v]) => [k, String(v)])) : "";
};

/** Verbos genéricos, caso precise de um endpoint ainda não tipado. */
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  del: (path: string) => request<void>(path, { method: "DELETE" }),
};

/* ---------------- Recursos (contrato com o back Python) ---------------- */

/**
 * MODO MOCK — a API externa está desligada temporariamente.
 * Coloque `false` aqui para voltar a chamar o back-end real; nenhuma tela
 * precisa ser alterada.
 */
export const USE_MOCK = true;

const mock = <T>(value: T): Promise<T> => Promise.resolve(value);

export const Motoristas = {
  list: (params?: Record<string, string | number>) =>
    USE_MOCK
      ? mock<Paginated<Motorista>>({ items: M.MOCK_MOTORISTAS, total: M.MOCK_MOTORISTAS.length, page: 1, pageSize: 50 })
      : api.get<Paginated<Motorista>>(`/api/motoristas${qs(params)}`),
  get: (id: string) =>
    USE_MOCK
      ? mock<Motorista>(M.MOCK_MOTORISTAS.find((m) => m.id === id) ?? M.MOCK_MOTORISTAS[0])
      : api.get<Motorista>(`/api/motoristas/${id}`),
  create: (data: Partial<Motorista>) => api.post<Motorista>(`/api/motoristas`, data),
  update: (id: string, data: Partial<Motorista>) => api.put<Motorista>(`/api/motoristas/${id}`, data),
  remove: (id: string) => api.del(`/api/motoristas/${id}`),
};

export const Veiculos = {
  list: (params?: Record<string, string | number>) =>
    USE_MOCK
      ? mock(M.mockVeiculosPage(Number(params?.page ?? 1), Number(params?.pageSize ?? 50)))
      : api.get<Paginated<Veiculo>>(`/api/veiculos${qs(params)}`),
  get: (id: string) =>
    USE_MOCK
      ? mock<Veiculo>(M.MOCK_VEICULOS.find((v) => v.id === id) ?? M.MOCK_VEICULOS[0])
      : api.get<Veiculo>(`/api/veiculos/${id}`),
  create: (data: Partial<Veiculo>) => api.post<Veiculo>(`/api/veiculos`, data),
  manutencao: (id: string) =>
    USE_MOCK ? mock(M.mockManutencao(id)) : api.get<Manutencao>(`/api/veiculos/${id}/manutencao`),
};

export const Frota = {
  posicoes: () => (USE_MOCK ? mock(M.MOCK_POSICOES) : api.get<PosicaoVeiculo[]>(`/api/frota/posicoes`)),
  resumo: () => (USE_MOCK ? mock(M.MOCK_RESUMO) : api.get<ResumoOperacao>(`/api/frota/resumo`)),
};

export const Viagens = {
  list: (params?: Record<string, string | number>) =>
    USE_MOCK
      ? mock<Paginated<Viagem>>({ items: M.MOCK_VIAGENS, total: M.MOCK_VIAGENS.length, page: 1, pageSize: 50 })
      : api.get<Paginated<Viagem>>(`/api/viagens${qs(params)}`),
  create: (data: Partial<Viagem>) => api.post<Viagem>(`/api/viagens`, data),
};

export const Alarmes = {
  list: () => (USE_MOCK ? mock(M.MOCK_ALARMES) : api.get<Alarme[]>(`/api/alarmes`)),
  create: (data: Partial<Alarme>) => api.post<Alarme>(`/api/alarmes`, data),
};

export const CO2 = {
  resumo: (params?: Record<string, string>) =>
    USE_MOCK ? mock(M.MOCK_CO2) : api.get<EmissaoResumo>(`/api/co2/resumo${qs(params)}`),
};

/* ------------------------------------------------------------------ */
/* Garagens, equipamentos, kanban de manutenção e conduções            */
/* ------------------------------------------------------------------ */

export const Garagens = {
  list: () => (USE_MOCK ? mock(M.MOCK_GARAGENS) : api.get<import("@/types").Garagem[]>(`/api/garagens`)),
  create: (data: Partial<import("@/types").Garagem>) => api.post(`/api/garagens`, data),
  update: (id: string, data: Partial<import("@/types").Garagem>) => api.put(`/api/garagens/${id}`, data),
  remove: (id: string) => api.del(`/api/garagens/${id}`),
};

export const Equipamentos = {
  list: () => (USE_MOCK ? mock(M.MOCK_EQUIPAMENTOS) : api.get<import("@/types").Equipamento[]>(`/api/equipamentos`)),
};

export const ManutencaoKanban = {
  list: () => (USE_MOCK ? mock(M.MOCK_KANBAN) : api.get<import("@/types").CardManutencao[]>(`/api/manutencao/kanban`)),
};

export const Conducoes = {
  porVeiculo: (veiculoId: string) =>
    USE_MOCK
      ? mock(M.conducoesDoVeiculo(veiculoId))
      : api.get<import("@/types").Conducao[]>(`/api/veiculos/${veiculoId}/conducoes`),
  porMotorista: (motoristaId: string) =>
    USE_MOCK
      ? mock(M.conducoesDoMotorista(motoristaId))
      : api.get<import("@/types").Conducao[]>(`/api/motoristas/${motoristaId}/conducoes`),
  porNome: (nome: string) =>
    USE_MOCK
      ? mock(M.conducoesPorNome(nome))
      : api.get<import("@/types").Conducao[]>(`/api/conducoes${qs({ motorista: nome })}`),
};

/* ------------------------------------------------------------------ */
/* BLOCO 0 — Linhas, itinerários, pontos, programação e realizado      */
/* ------------------------------------------------------------------ */

export const Linhas = {
  list: () => (USE_MOCK ? mock(M.MOCK_LINHAS) : api.get<import("@/types").Linha[]>(`/api/linhas`)),
  create: (d: Partial<import("@/types").Linha>) => api.post(`/api/linhas`, d),
  update: (id: string, d: Partial<import("@/types").Linha>) => api.put(`/api/linhas/${id}`, d),
  remove: (id: string) => api.del(`/api/linhas/${id}`),
};

export const GruposLinhas = {
  list: () => (USE_MOCK ? mock(M.MOCK_GRUPOS_LINHAS) : api.get<import("@/types").GrupoLinhas[]>(`/api/linhas/grupos`)),
};

export const Pontos = {
  list: () => (USE_MOCK ? mock(M.MOCK_PONTOS) : api.get<import("@/types").PontoParada[]>(`/api/pontos`)),
  create: (d: Partial<import("@/types").PontoParada>) => api.post(`/api/pontos`, d),
  update: (id: string, d: Partial<import("@/types").PontoParada>) => api.put(`/api/pontos/${id}`, d),
  remove: (id: string) => api.del(`/api/pontos/${id}`),
};

export const Itinerarios = {
  list: (linhaId?: string) =>
    USE_MOCK
      ? mock(linhaId ? M.MOCK_ITINERARIOS.filter((i) => i.linhaId === linhaId) : M.MOCK_ITINERARIOS)
      : api.get<import("@/types").Itinerario[]>(`/api/itinerarios${qs({ linha: linhaId })}`),
};

export const Programacao = {
  list: (linhaId?: string, tipoDia?: string) =>
    USE_MOCK
      ? mock(M.MOCK_PROGRAMACAO.filter((p) => (!linhaId || p.linhaId === linhaId) && (!tipoDia || p.tipoDia === tipoDia)))
      : api.get<import("@/types").ViagemProgramada[]>(`/api/programacao${qs({ linha: linhaId, tipoDia })}`),
};

export const ViagensOperacao = {
  /** Realizado do dia de operação, já confrontado com a programação. */
  doDia: (data: string, linhaId?: string) =>
    USE_MOCK
      ? mock(M.MOCK_VIAGENS_REALIZADAS.filter((v) => !linhaId || v.linhaId === linhaId))
      : api.get<import("@/types").ViagemRealizada[]>(`/api/operacao/viagens${qs({ data, linha: linhaId })}`),
};

export const AlarmesOperacionais = {
  list: (linhaId?: string) =>
    USE_MOCK
      ? mock(M.MOCK_ALARMES_OPERACIONAIS.filter((a) => !linhaId || a.linhaId === linhaId))
      : api.get<import("@/types").AlarmeOperacional[]>(`/api/operacao/alarmes${qs({ linha: linhaId })}`),
};

export const Indicadores = {
  serie: () =>
    USE_MOCK
      ? mock(M.MOCK_INDICADORES_PERIODO)
      : api.get<import("@/types").IndicadoresPeriodo[]>(`/api/indicadores/serie`),
  falhas: () => (USE_MOCK ? mock(M.MOCK_FALHAS) : api.get<import("@/types").FalhaFrota[]>(`/api/indicadores/falhas`)),
};

/* ---- Blocos 2, 4, 5, 6 ---- */
export const Ordens = {
  list: () => (USE_MOCK ? mock(M.MOCK_ORDENS) : api.get<import("@/types").OrdemServico[]>(`/api/ordens`)),
};
export const Planos = {
  list: () => (USE_MOCK ? mock(M.MOCK_PLANOS) : api.get<import("@/types").PlanoManutencao[]>(`/api/planos`)),
};
export const Pneus = {
  list: () => (USE_MOCK ? mock(M.MOCK_PNEUS) : api.get<import("@/types").Pneu[]>(`/api/pneus`)),
};
export const Video = {
  ocorrencias: () =>
    USE_MOCK ? mock(M.MOCK_OCORRENCIAS_VIDEO) : api.get<import("@/types").OcorrenciaVideo[]>(`/api/video/ocorrencias`),
  volume: () => (USE_MOCK ? mock(M.MOCK_VOLUME_VIDEO) : api.get<Record<string, number>>(`/api/video/volume`)),
};
export const Jornadas = {
  list: (data?: string) =>
    USE_MOCK ? mock(M.MOCK_JORNADAS) : api.get<import("@/types").Jornada[]>(`/api/jornadas${qs({ data })}`),
};
export const Multas = {
  list: () => (USE_MOCK ? mock(M.MOCK_MULTAS) : api.get<import("@/types").Multa[]>(`/api/multas`)),
};

export const CCO = {
  posicoes: (linhaId?: string) =>
    USE_MOCK
      ? mock(M.MOCK_POSICOES_LINHA.filter((p) => !linhaId || p.linhaId === linhaId))
      : api.get<import("@/types").PosicaoNaLinha[]>(`/api/cco/posicoes${qs({ linha: linhaId })}`),
  despachos: () => (USE_MOCK ? mock(M.MOCK_DESPACHOS) : api.get<import("@/types").Despacho[]>(`/api/cco/despachos`)),
};

export const VideoAoVivo = {
  dispositivos: () =>
    USE_MOCK ? mock(M.MOCK_DISPOSITIVOS_VIDEO) : api.get<import("@/types").DispositivoVideo[]>(`/api/video/dispositivos`),
  trechos: (veiculoId?: string) =>
    USE_MOCK
      ? mock(M.MOCK_TRECHOS.filter((t) => !veiculoId || t.veiculoId === veiculoId))
      : api.get<import("@/types").TrechoGravacao[]>(`/api/video/gravacoes${qs({ veiculo: veiculoId })}`),
  solicitacoes: () =>
    USE_MOCK ? mock(M.MOCK_SOLICITACOES) : api.get<import("@/types").SolicitacaoGravacao[]>(`/api/video/solicitacoes`),
};

export const PadroesLinha = {
  list: () =>
    USE_MOCK ? mock(M.MOCK_PADROES_LINHA) : api.get<import("@/types").PadraoLinha[]>(`/api/padroes-linha`),
  amostra: () =>
    USE_MOCK
      ? mock(M.MOCK_AMOSTRA_CONTEXTO)
      : api.get<Record<string, { viagens: number; p75: Record<string, number> }>>(`/api/padroes-linha/amostra`),
};
