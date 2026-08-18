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
import { requisicaoAutenticada } from "@/lib/auth-api";
import { gravar, ler } from "@/lib/session";

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
  // Passa pelo cliente autenticado: ele injeta o Bearer, renova o token
  // quando expira e repete a chamada uma vez. Sem isso, toda requisição
  // voltaria 401 assim que o access token vencesse.
  const res = await requisicaoAutenticada(`${BASE}${path}`, {
    ...init,
    headers: { ...DEFAULT_HEADERS, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    // 401 depois da renovação significa sessão realmente encerrada — quem
    // trata é a camada de rota, que redireciona para o login.
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

/**
 * Recursos sem endpoint no backend usam sempre a base de exemplo, mesmo em modo
 * API.
 *
 * Antes eles apontavam para caminhos que eu havia inventado na fase de
 * protótipo — `/api/ordens`, `/api/pneus`, `/api/multas` e outros vinte e tantos
 * que nunca existiram no servidor. Ligado à API real, cada tela desse grupo
 * disparava uma requisição condenada a 404, e o erro aparecia como se o sistema
 * tivesse quebrado.
 *
 * Enquanto esses módulos não tiverem backend, o dado de exemplo é a resposta
 * honesta: a tela funciona, e o selo já avisa que o dado não é real.
 */

/**
 * Modo efetivo, avaliado a cada chamada.
 *
 * `USE_MOCK` é o padrão de build; o interruptor da interface pode sobrepô-lo
 * durante a sessão, para validar a integração sem republicar.
 */
function modoMock(): boolean {
  if (typeof window === "undefined") return USE_MOCK;
  try {
    const bruto = window.sessionStorage.getItem("ss:modo-dados");
    if (!bruto) return USE_MOCK;
    return JSON.parse(bruto) === "mock";
  } catch {
    return USE_MOCK;
  }
}

const mock = <T>(value: T): Promise<T> => Promise.resolve(value);

export const Motoristas = {
  list: (params?: Record<string, string | number>) =>
      mock<Paginated<Motorista>>({ items: M.MOCK_MOTORISTAS, total: M.MOCK_MOTORISTAS.length, page: 1, pageSize: 50 }),
  get: (id: string) =>
    modoMock()
      ? mock<Motorista>(M.MOCK_MOTORISTAS.find((m) => m.id === id) ?? M.MOCK_MOTORISTAS[0])
      : mock(undefined as never),
  create: (data: Partial<Motorista>) => mock(data as never),
  update: (id: string, data: Partial<Motorista>) => mock({ ...data, id } as never),
  remove: (_id: string) => mock(undefined as never),
};

export const Veiculos = {
  list: (params?: Record<string, string | number>) =>
      mock(M.mockVeiculosPage(Number(params?.page ?? 1), Number(params?.pageSize ?? 50))),
  get: (id: string) =>
    modoMock()
      ? mock<Veiculo>(M.MOCK_VEICULOS.find((v) => v.id === id) ?? M.MOCK_VEICULOS[0])
      : mock(undefined as never),
  create: (data: Partial<Veiculo>) => mock(data as never),
  manutencao: (id: string) =>
    modoMock() ? mock(M.mockManutencao(id)) : mock(undefined as never),
};

export const Frota = {
  posicoes: () => (mock(M.MOCK_POSICOES)),
  resumo: () => (mock(M.MOCK_RESUMO)),
};

export const Viagens = {
  list: (params?: Record<string, string | number>) =>
      mock<Paginated<Viagem>>({ items: M.MOCK_VIAGENS, total: M.MOCK_VIAGENS.length, page: 1, pageSize: 50 }),
  create: (data: Partial<Viagem>) => mock(data as never),
};

export const Alarmes = {
  list: () => (mock(M.MOCK_ALARMES)),
  create: (data: Partial<Alarme>) => mock(data as never),
};

export const CO2 = {
  resumo: (params?: Record<string, string>) =>
    mock(M.MOCK_CO2),
};

/* ------------------------------------------------------------------ */
/* Garagens, equipamentos, kanban de manutenção e conduções            */
/* ------------------------------------------------------------------ */

export const Garagens = {
  list: () => (mock(M.MOCK_GARAGENS)),
  create: (data: Partial<import("@/types").Garagem>) => mock(data as never),
  update: (id: string, data: Partial<import("@/types").Garagem>) => mock({ ...data, id } as never),
  remove: (_id: string) => mock(undefined as never),
};

export const Equipamentos = {
  list: () => (mock(M.MOCK_EQUIPAMENTOS)),
};

export const ManutencaoKanban = {
  list: () => (mock(M.MOCK_KANBAN)),
};

export const Conducoes = {
  porVeiculo: (veiculoId: string) =>
    mock(M.conducoesDoVeiculo(veiculoId)),
  porMotorista: (motoristaId: string) =>
    mock(M.conducoesDoMotorista(motoristaId)),
  porNome: (nome: string) =>
    mock(M.conducoesPorNome(nome)),
};

/* ------------------------------------------------------------------ */
/* BLOCO 0 — Linhas, itinerários, pontos, programação e realizado      */
/* ------------------------------------------------------------------ */

export const Linhas = {
  list: () => (mock(M.MOCK_LINHAS)),
  create: (d: Partial<import("@/types").Linha>) => mock(d as never),
  update: (id: string, d: Partial<import("@/types").Linha>) => mock({ ...d, id } as never),
  remove: (_id: string) => mock(undefined as never),
};

export const GruposLinhas = {
  list: () => (mock(M.MOCK_GRUPOS_LINHAS)),
};

export const Pontos = {
  list: () => (mock(M.MOCK_PONTOS)),
  create: (d: Partial<import("@/types").PontoParada>) => mock(d as never),
  update: (id: string, d: Partial<import("@/types").PontoParada>) => mock({ ...d, id } as never),
  remove: (_id: string) => mock(undefined as never),
};

export const Itinerarios = {
  list: (linhaId?: string) =>
    modoMock()
      ? mock(linhaId ? M.MOCK_ITINERARIOS.filter((i) => i.linhaId === linhaId) : M.MOCK_ITINERARIOS)
      : mock(undefined as never),
};

export const Programacao = {
  list: (linhaId?: string, tipoDia?: string) =>
    modoMock()
      ? mock(M.MOCK_PROGRAMACAO.filter((p) => (!linhaId || p.linhaId === linhaId) && (!tipoDia || p.tipoDia === tipoDia)))
      : mock(undefined as never),
};

export const ViagensOperacao = {
  /** Realizado do dia de operação, já confrontado com a programação. */
  doDia: (data: string, linhaId?: string) =>
    modoMock()
      ? mock(M.MOCK_VIAGENS_REALIZADAS.filter((v) => !linhaId || v.linhaId === linhaId))
      : mock(undefined as never),
};

export const AlarmesOperacionais = {
  list: (linhaId?: string) =>
    modoMock()
      ? mock(M.MOCK_ALARMES_OPERACIONAIS.filter((a) => !linhaId || a.linhaId === linhaId))
      : mock(undefined as never),
};

export const Indicadores = {
  serie: () =>
    mock(M.MOCK_INDICADORES_PERIODO),
  falhas: () => (mock(M.MOCK_FALHAS)),
};

/* ---- Blocos 2, 4, 5, 6 ---- */
export const Ordens = {
  list: () => (mock(M.MOCK_ORDENS)),
};
export const Planos = {
  list: () => (mock(M.MOCK_PLANOS)),
};
export const Pneus = {
  list: () => (mock(M.MOCK_PNEUS)),
};
export const Video = {
  ocorrencias: () =>
    mock(M.MOCK_OCORRENCIAS_VIDEO),
  volume: () => mock(M.MOCK_VOLUME_VIDEO),
};
export const Jornadas = {
  list: (data?: string) =>
    mock(M.MOCK_JORNADAS),
};
export const Multas = {
  list: () => (mock(M.MOCK_MULTAS)),
};

export const CCO = {
  posicoes: (linhaId?: string) =>
    modoMock()
      ? mock(M.MOCK_POSICOES_LINHA.filter((p) => !linhaId || p.linhaId === linhaId))
      : mock(undefined as never),
  despachos: () => (mock(M.MOCK_DESPACHOS)),
};

export const VideoAoVivo = {
  dispositivos: () =>
    mock(M.MOCK_DISPOSITIVOS_VIDEO),
  trechos: (veiculoId?: string) =>
    modoMock()
      ? mock(M.MOCK_TRECHOS.filter((t) => !veiculoId || t.veiculoId === veiculoId))
      : mock(undefined as never),
  solicitacoes: () =>
    mock(M.MOCK_SOLICITACOES),
};

export const PadroesLinha = {
  list: () =>
    mock(M.MOCK_PADROES_LINHA),
  amostra: () =>
      mock(M.MOCK_AMOSTRA_CONTEXTO),
};

export const Desempenho = {
  porMotorista: (motoristaId: string) =>
    mock(M.desempenhoDoMotorista(motoristaId)),
  todos: () =>
    mock(M.MOCK_DESEMPENHO_VIAGENS),
};

/**
 * Recursos que leem direto da API real, sem passar pelo mock.
 *
 * Ficam separados dos demais porque a resposta vem no formato do banco
 * (`label`, `label2`, `status`) e é traduzida no consumo — misturar com os
 * mocks, que já vêm no formato do front, causaria confusão de tipos.
 */
export const Real = {
  veiculos: (params?: Record<string, string | number>) =>
    api.get<{ items: unknown[]; total: number }>(`/api/v1/vehicles/${qs(params)}`),
  motoristas: (params?: Record<string, string | number>) =>
    api.get<{ items: unknown[]; total: number }>(`/api/v1/drivers/${qs(params)}`),
  linhas: (params?: Record<string, string | number>) =>
    api.get<{ items: unknown[]; total: number }>(`/api/v1/bus-lines/${qs(params)}`),
  linha: (id: string | number) => api.get<unknown>(`/api/v1/bus-lines/${id}`),
  cumprimento: (id: string | number, data: string) =>
    api.get<unknown>(`/api/v1/bus-lines/${id}/compliance?operation_date=${data}`),
};

export const Catalogo = {
  montadoras: () =>
    mock(M.MOCK_MONTADORAS),
  modelos: () =>
    mock(M.MOCK_MODELOS),
  parametros: () =>
    mock(M.MOCK_PARAMETROS),
  regras: () =>
    mock(M.MOCK_REGRAS_AJUSTE),
};

export const Preventiva = {
  execucoes: () =>
    mock(M.MOCK_EXECUCOES),
  sinais: () =>
    mock(M.MOCK_SINAIS_OPERACAO),
  vinculos: () =>
      mock(M.MOCK_VEICULO_MODELO),
};

export const ContratosOrg = {
  list: () =>
    mock(M.MOCK_CONTRATOS_ORG),
};

export const DTC = {
  list: () => (mock(M.MOCK_DTC)),
};

export const Plataforma = {
  admins: () =>
    mock(M.MOCK_ADMINS),
  perfis: () =>
    mock(M.MOCK_PERFIS_ACESSO),
};

export const Tracking = {
  porVeiculo: (veiculoId: string) =>
    mock(M.trackingDoVeiculo(veiculoId)),
};

/**
 * Recursos escritos para este front: tracking, eventos e turnos.
 *
 * Ficam fora do bloco `Real` porque não têm equivalente em mock — quando a API
 * não está conectada, as telas correspondentes mostram dado de exemplo próprio,
 * e não uma versão simulada destas chamadas.
 */
export const Operacional = {
  tracking: (unitId: string | number, data: string) =>
    api.get<unknown>(`/api/v1/tracking/?unit_id=${unitId}&operation_date=${data}`),

  eventos: (params: Record<string, string | number | boolean>) =>
    // Booleano vira string porque a serialização de query não o aceita, e
    // `false` seria descartado silenciosamente se passasse direto.
    api.get<unknown>(
      `/api/v1/events/${qs(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])))}`,
    ),

  tratarEvento: (id: string | number, nota?: string) =>
    api.post<unknown>(`/api/v1/events/${id}/acknowledge`, { note: nota ?? "" }),

  turnos: (linhaId: string | number, params?: Record<string, string | number>) =>
    api.get<unknown>(`/api/v1/bus-lines/${linhaId}/shifts${qs(params)}`),
};

/** Vídeo, indicadores e pontos de interesse. */
export const Seguranca = {
  equipamentos: (soOffline = false) =>
    api.get<unknown>(`/api/v1/video/devices?only_offline=${soOffline}`),
  ocorrencias: (params: Record<string, string | number | boolean>) =>
    api.get<unknown>(
      `/api/v1/video/occurrences${qs(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])))}`,
    ),
};

export const IndicadoresApi = {
  consolidado: (inicio: string, fim: string, grupoId?: string) =>
    api.get<unknown>(
      `/api/v1/indicators/?start_date=${inicio}&end_date=${fim}${grupoId ? `&group_id=${grupoId}` : ""}`,
    ),
};

export const PontosApi = {
  lista: (dias = 30, busca?: string) =>
    api.get<unknown>(`/api/v1/pois/?days=${dias}${busca ? `&search=${encodeURIComponent(busca)}` : ""}`),
  visitas: (poiId: string | number, dias = 7) =>
    api.get<unknown>(`/api/v1/pois/${poiId}/visits?days=${dias}`),
};

/**
 * Vínculos de equipamento e autenticação integrada.
 *
 * Os vínculos definem qual rastreador e qual câmera estão em cada veículo — é o
 * cadastro que sustenta todo o resto: sem ele, posição e vídeo não têm a quem
 * pertencer.
 */
export const Vinculos = {
  rastreadores: (params?: Record<string, string | number>) =>
    api.get<unknown>(`/api/v1/device-associations/${qs(params)}`),
  cameras: (params?: Record<string, string | number>) =>
    api.get<unknown>(`/api/v1/video-device-associations/${qs(params)}`),
  vincularRastreador: (dados: Record<string, unknown>) =>
    api.post<unknown>(`/api/v1/device-associations/`, dados),
  vincularCamera: (dados: Record<string, unknown>) =>
    api.post<unknown>(`/api/v1/video-device-associations/`, dados),
  desvincularRastreador: (id: string | number) =>
    api.del(`/api/v1/device-associations/${id}`),
  desvincularCamera: (id: string | number) =>
    api.del(`/api/v1/video-device-associations/${id}`),
};

/**
 * API de checklist, no API Gateway da AWS.
 *
 * Backend separado do `ss-fleet-core`, com autenticação própria: `POST /login`
 * com usuário e senha devolvendo token, que vai no cabeçalho `token` — não em
 * `Authorization: Bearer`.
 *
 * Manter as duas autenticações vivas ao mesmo tempo é dívida conhecida; a
 * alternativa seria o `ss-fleet-core` absorver este módulo, o que é decisão de
 * arquitetura ainda em aberto.
 */
const BASE_CHECKLIST = (import.meta.env.VITE_CHECKLIST_BASE as string) || "";

async function requisicaoChecklist<T>(caminho: string): Promise<T> {
  const token = ler<string | null>("token-checklist", null);
  const res = await fetch(`${BASE_CHECKLIST}${caminho}`, {
    headers: { "Content-Type": "application/json", ...(token ? { token } : {}) },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => res.statusText));
  return res.json() as Promise<T>;
}

export const Checklist = {
  autenticar: async (user: string, pass: string) => {
    const res = await fetch(`${BASE_CHECKLIST}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, pass }),
    });
    if (!res.ok) throw new ApiError(res.status, "Falha ao autenticar no serviço de checklist.");
    const dados = await res.json();
    const token = Array.isArray(dados) ? dados[0]?.token : dados?.token;
    if (token) gravar("token-checklist", token);
    return token as string | undefined;
  },

  lista: () => requisicaoChecklist<unknown>(`/checklist`),
  porId: (id: string | number) => requisicaoChecklist<unknown>(`/checklist/${id}`),
  perguntas: () => requisicaoChecklist<unknown>(`/checklist/question`),
  respostas: () => requisicaoChecklist<unknown>(`/checklist/answers`),
  respostasPorChecklist: () => requisicaoChecklist<unknown>(`/checklist/answers/checklist`),
};
