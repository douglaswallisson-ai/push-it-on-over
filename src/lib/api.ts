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
    modoMock()
      ? mock<Paginated<Motorista>>({ items: M.MOCK_MOTORISTAS, total: M.MOCK_MOTORISTAS.length, page: 1, pageSize: 50 })
      : api.get<Paginated<Motorista>>(`/api/motoristas${qs(params)}`),
  get: (id: string) =>
    modoMock()
      ? mock<Motorista>(M.MOCK_MOTORISTAS.find((m) => m.id === id) ?? M.MOCK_MOTORISTAS[0])
      : api.get<Motorista>(`/api/motoristas/${id}`),
  create: (data: Partial<Motorista>) => api.post<Motorista>(`/api/motoristas`, data),
  update: (id: string, data: Partial<Motorista>) => api.put<Motorista>(`/api/motoristas/${id}`, data),
  remove: (id: string) => api.del(`/api/motoristas/${id}`),
};

export const Veiculos = {
  list: (params?: Record<string, string | number>) =>
    modoMock()
      ? mock(M.mockVeiculosPage(Number(params?.page ?? 1), Number(params?.pageSize ?? 50)))
      : api.get<Paginated<Veiculo>>(`/api/veiculos${qs(params)}`),
  get: (id: string) =>
    modoMock()
      ? mock<Veiculo>(M.MOCK_VEICULOS.find((v) => v.id === id) ?? M.MOCK_VEICULOS[0])
      : api.get<Veiculo>(`/api/veiculos/${id}`),
  create: (data: Partial<Veiculo>) => api.post<Veiculo>(`/api/veiculos`, data),
  manutencao: (id: string) =>
    modoMock() ? mock(M.mockManutencao(id)) : api.get<Manutencao>(`/api/veiculos/${id}/manutencao`),
};

export const Frota = {
  posicoes: () => (modoMock() ? mock(M.MOCK_POSICOES) : api.get<PosicaoVeiculo[]>(`/api/frota/posicoes`)),
  resumo: () => (modoMock() ? mock(M.MOCK_RESUMO) : api.get<ResumoOperacao>(`/api/frota/resumo`)),
};

export const Viagens = {
  list: (params?: Record<string, string | number>) =>
    modoMock()
      ? mock<Paginated<Viagem>>({ items: M.MOCK_VIAGENS, total: M.MOCK_VIAGENS.length, page: 1, pageSize: 50 })
      : api.get<Paginated<Viagem>>(`/api/viagens${qs(params)}`),
  create: (data: Partial<Viagem>) => api.post<Viagem>(`/api/viagens`, data),
};

export const Alarmes = {
  list: () => (modoMock() ? mock(M.MOCK_ALARMES) : api.get<Alarme[]>(`/api/alarmes`)),
  create: (data: Partial<Alarme>) => api.post<Alarme>(`/api/alarmes`, data),
};

export const CO2 = {
  resumo: (params?: Record<string, string>) =>
    modoMock() ? mock(M.MOCK_CO2) : api.get<EmissaoResumo>(`/api/co2/resumo${qs(params)}`),
};

/* ------------------------------------------------------------------ */
/* Garagens, equipamentos, kanban de manutenção e conduções            */
/* ------------------------------------------------------------------ */

export const Garagens = {
  list: () => (modoMock() ? mock(M.MOCK_GARAGENS) : api.get<import("@/types").Garagem[]>(`/api/garagens`)),
  create: (data: Partial<import("@/types").Garagem>) => api.post(`/api/garagens`, data),
  update: (id: string, data: Partial<import("@/types").Garagem>) => api.put(`/api/garagens/${id}`, data),
  remove: (id: string) => api.del(`/api/garagens/${id}`),
};

export const Equipamentos = {
  list: () => (modoMock() ? mock(M.MOCK_EQUIPAMENTOS) : api.get<import("@/types").Equipamento[]>(`/api/equipamentos`)),
};

export const ManutencaoKanban = {
  list: () => (modoMock() ? mock(M.MOCK_KANBAN) : api.get<import("@/types").CardManutencao[]>(`/api/manutencao/kanban`)),
};

export const Conducoes = {
  porVeiculo: (veiculoId: string) =>
    modoMock()
      ? mock(M.conducoesDoVeiculo(veiculoId))
      : api.get<import("@/types").Conducao[]>(`/api/veiculos/${veiculoId}/conducoes`),
  porMotorista: (motoristaId: string) =>
    modoMock()
      ? mock(M.conducoesDoMotorista(motoristaId))
      : api.get<import("@/types").Conducao[]>(`/api/motoristas/${motoristaId}/conducoes`),
  porNome: (nome: string) =>
    modoMock()
      ? mock(M.conducoesPorNome(nome))
      : api.get<import("@/types").Conducao[]>(`/api/conducoes${qs({ motorista: nome })}`),
};

/* ------------------------------------------------------------------ */
/* BLOCO 0 — Linhas, itinerários, pontos, programação e realizado      */
/* ------------------------------------------------------------------ */

export const Linhas = {
  list: () => (modoMock() ? mock(M.MOCK_LINHAS) : api.get<import("@/types").Linha[]>(`/api/linhas`)),
  create: (d: Partial<import("@/types").Linha>) => api.post(`/api/linhas`, d),
  update: (id: string, d: Partial<import("@/types").Linha>) => api.put(`/api/linhas/${id}`, d),
  remove: (id: string) => api.del(`/api/linhas/${id}`),
};

export const GruposLinhas = {
  list: () => (modoMock() ? mock(M.MOCK_GRUPOS_LINHAS) : api.get<import("@/types").GrupoLinhas[]>(`/api/linhas/grupos`)),
};

export const Pontos = {
  list: () => (modoMock() ? mock(M.MOCK_PONTOS) : api.get<import("@/types").PontoParada[]>(`/api/pontos`)),
  create: (d: Partial<import("@/types").PontoParada>) => api.post(`/api/pontos`, d),
  update: (id: string, d: Partial<import("@/types").PontoParada>) => api.put(`/api/pontos/${id}`, d),
  remove: (id: string) => api.del(`/api/pontos/${id}`),
};

export const Itinerarios = {
  list: (linhaId?: string) =>
    modoMock()
      ? mock(linhaId ? M.MOCK_ITINERARIOS.filter((i) => i.linhaId === linhaId) : M.MOCK_ITINERARIOS)
      : api.get<import("@/types").Itinerario[]>(`/api/itinerarios${qs({ linha: linhaId })}`),
};

export const Programacao = {
  list: (linhaId?: string, tipoDia?: string) =>
    modoMock()
      ? mock(M.MOCK_PROGRAMACAO.filter((p) => (!linhaId || p.linhaId === linhaId) && (!tipoDia || p.tipoDia === tipoDia)))
      : api.get<import("@/types").ViagemProgramada[]>(`/api/programacao${qs({ linha: linhaId, tipoDia })}`),
};

export const ViagensOperacao = {
  /** Realizado do dia de operação, já confrontado com a programação. */
  doDia: (data: string, linhaId?: string) =>
    modoMock()
      ? mock(M.MOCK_VIAGENS_REALIZADAS.filter((v) => !linhaId || v.linhaId === linhaId))
      : api.get<import("@/types").ViagemRealizada[]>(`/api/operacao/viagens${qs({ data, linha: linhaId })}`),
};

export const AlarmesOperacionais = {
  list: (linhaId?: string) =>
    modoMock()
      ? mock(M.MOCK_ALARMES_OPERACIONAIS.filter((a) => !linhaId || a.linhaId === linhaId))
      : api.get<import("@/types").AlarmeOperacional[]>(`/api/operacao/alarmes${qs({ linha: linhaId })}`),
};

export const Indicadores = {
  serie: () =>
    modoMock()
      ? mock(M.MOCK_INDICADORES_PERIODO)
      : api.get<import("@/types").IndicadoresPeriodo[]>(`/api/indicadores/serie`),
  falhas: () => (modoMock() ? mock(M.MOCK_FALHAS) : api.get<import("@/types").FalhaFrota[]>(`/api/indicadores/falhas`)),
};

/* ---- Blocos 2, 4, 5, 6 ---- */
export const Ordens = {
  list: () => (modoMock() ? mock(M.MOCK_ORDENS) : api.get<import("@/types").OrdemServico[]>(`/api/ordens`)),
};
export const Planos = {
  list: () => (modoMock() ? mock(M.MOCK_PLANOS) : api.get<import("@/types").PlanoManutencao[]>(`/api/planos`)),
};
export const Pneus = {
  list: () => (modoMock() ? mock(M.MOCK_PNEUS) : api.get<import("@/types").Pneu[]>(`/api/pneus`)),
};
export const Video = {
  ocorrencias: () =>
    modoMock() ? mock(M.MOCK_OCORRENCIAS_VIDEO) : api.get<import("@/types").OcorrenciaVideo[]>(`/api/video/ocorrencias`),
  volume: () => (modoMock() ? mock(M.MOCK_VOLUME_VIDEO) : api.get<Record<string, number>>(`/api/video/volume`)),
};
export const Jornadas = {
  list: (data?: string) =>
    modoMock() ? mock(M.MOCK_JORNADAS) : api.get<import("@/types").Jornada[]>(`/api/jornadas${qs({ data })}`),
};
export const Multas = {
  list: () => (modoMock() ? mock(M.MOCK_MULTAS) : api.get<import("@/types").Multa[]>(`/api/multas`)),
};

export const CCO = {
  posicoes: (linhaId?: string) =>
    modoMock()
      ? mock(M.MOCK_POSICOES_LINHA.filter((p) => !linhaId || p.linhaId === linhaId))
      : api.get<import("@/types").PosicaoNaLinha[]>(`/api/cco/posicoes${qs({ linha: linhaId })}`),
  despachos: () => (modoMock() ? mock(M.MOCK_DESPACHOS) : api.get<import("@/types").Despacho[]>(`/api/cco/despachos`)),
};

export const VideoAoVivo = {
  dispositivos: () =>
    modoMock() ? mock(M.MOCK_DISPOSITIVOS_VIDEO) : api.get<import("@/types").DispositivoVideo[]>(`/api/video/dispositivos`),
  trechos: (veiculoId?: string) =>
    modoMock()
      ? mock(M.MOCK_TRECHOS.filter((t) => !veiculoId || t.veiculoId === veiculoId))
      : api.get<import("@/types").TrechoGravacao[]>(`/api/video/gravacoes${qs({ veiculo: veiculoId })}`),
  solicitacoes: () =>
    modoMock() ? mock(M.MOCK_SOLICITACOES) : api.get<import("@/types").SolicitacaoGravacao[]>(`/api/video/solicitacoes`),
};

export const PadroesLinha = {
  list: () =>
    modoMock() ? mock(M.MOCK_PADROES_LINHA) : api.get<import("@/types").PadraoLinha[]>(`/api/padroes-linha`),
  amostra: () =>
    modoMock()
      ? mock(M.MOCK_AMOSTRA_CONTEXTO)
      : api.get<Record<string, { viagens: number; p75: Record<string, number> }>>(`/api/padroes-linha/amostra`),
};

export const Desempenho = {
  porMotorista: (motoristaId: string) =>
    modoMock()
      ? mock(M.desempenhoDoMotorista(motoristaId))
      : api.get<import("@/lib/scoring").DesempenhoViagem[]>(`/api/desempenho${qs({ motorista: motoristaId })}`),
  todos: () =>
    modoMock() ? mock(M.MOCK_DESEMPENHO_VIAGENS) : api.get<import("@/lib/scoring").DesempenhoViagem[]>(`/api/desempenho`),
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
    modoMock() ? mock(M.MOCK_MONTADORAS) : api.get<import("@/types").Montadora[]>(`/api/catalogo/montadoras`),
  modelos: () =>
    modoMock() ? mock(M.MOCK_MODELOS) : api.get<import("@/types").ModeloVeiculo[]>(`/api/catalogo/modelos`),
  parametros: () =>
    modoMock() ? mock(M.MOCK_PARAMETROS) : api.get<import("@/types").ParametroManutencao[]>(`/api/catalogo/parametros`),
  regras: () =>
    modoMock() ? mock(M.MOCK_REGRAS_AJUSTE) : api.get<import("@/types").RegraAjuste[]>(`/api/catalogo/regras`),
};

export const Preventiva = {
  execucoes: () =>
    modoMock() ? mock(M.MOCK_EXECUCOES) : api.get<import("@/types").ExecucaoManutencao[]>(`/api/preventiva/execucoes`),
  sinais: () =>
    modoMock() ? mock(M.MOCK_SINAIS_OPERACAO) : api.get<Record<string, Record<string, number>>>(`/api/preventiva/sinais`),
  vinculos: () =>
    modoMock()
      ? mock(M.MOCK_VEICULO_MODELO)
      : api.get<Record<string, { modeloId: string; montadoraId: string }>>(`/api/preventiva/vinculos`),
};

export const ContratosOrg = {
  list: () =>
    modoMock() ? mock(M.MOCK_CONTRATOS_ORG) : api.get<import("@/types").ContratoOrganizacao[]>(`/api/contratos-organizacao`),
};

export const DTC = {
  list: () => (modoMock() ? mock(M.MOCK_DTC) : api.get<import("@/types").CodigoDTC[]>(`/api/dtc`)),
};

export const Plataforma = {
  admins: () =>
    modoMock() ? mock(M.MOCK_ADMINS) : api.get<import("@/types").AdministradorPlataforma[]>(`/api/plataforma/admins`),
  perfis: () =>
    modoMock() ? mock(M.MOCK_PERFIS_ACESSO) : api.get<import("@/types").PerfilAcesso[]>(`/api/plataforma/perfis`),
};

export const Tracking = {
  porVeiculo: (veiculoId: string) =>
    modoMock()
      ? mock(M.trackingDoVeiculo(veiculoId))
      : api.get<import("@/types").EventoTracking[]>(`/api/tracking${qs({ veiculo: veiculoId })}`),
};
