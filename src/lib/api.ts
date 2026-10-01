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
  CardManutencao,
  EmissaoResumo,
  Manutencao,
  Motorista,
  OrdemServico,
  Paginated,
  Pneu,
  PosicaoVeiculo,
  ResumoOperacao,
  Veiculo,
  Viagem,
} from "@/types";
import * as M from "@/lib/mock-data";
import { exemploOuVazio, usandoMock } from "@/lib/modo";

const BASE = import.meta.env.VITE_API_BASE ?? "";

/** Headers enviados em toda chamada. O `ngrok-skip-browser-warning` evita a
 *  página HTML de aviso do túnel ngrok (que quebraria o parse do JSON). */
import { requisicaoAutenticada } from "@/lib/auth-api";
import { gravar, ler } from "@/lib/session";
import { filtroGrupo } from "@/lib/escopo-ativo";

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
  // Sem endereço de API não há para onde consultar, e o exemplo é a única
  // resposta possível.
  const padrao = !import.meta.env.VITE_API_BASE;
  if (typeof window === "undefined") return padrao;
  try {
    const bruto = window.sessionStorage.getItem("ss:modo-dados");
    if (!bruto) return padrao;
    return JSON.parse(bruto) === "mock";
  } catch {
    return padrao;
  }
}

/**
 * Erro de módulo que ainda não tem origem real no backend.
 *
 * Status 501 ("não implementado") para as telas tratarem como qualquer falha
 * de API — com mensagem, e não com número inventado.
 */
export class SemFonteReal extends ApiError {
  constructor() {
    super(501, "Este módulo ainda não tem fonte de dados real no sistema novo.");
  }
}

/**
 * Resposta dos módulos sem endpoint.
 *
 * Com dados de exemplo ligados (sem `VITE_API_BASE`), devolve o exemplo. Ligado
 * à API real, **nunca**: o exemplo ali se misturava ao dado verdadeiro e nada
 * na tela distinguia os dois — garagens, linhas, multas e desempenho de
 * motorista que não existem apareciam ao lado da frota real.
 *
 * Fora do modo de exemplo: lista vira lista vazia, página vira página vazia, e
 * o resto (objetos de resumo e gravações) falha com `SemFonteReal`. Gravação
 * falhar é o certo — antes ela "salvava" sem gravar nada.
 */
const mock = <T>(value: T): Promise<T> => {
  if (modoMock()) return Promise.resolve(value);
  if (Array.isArray(value)) return Promise.resolve([] as unknown as T);
  if (value && typeof value === "object" && Array.isArray((value as { items?: unknown }).items)) {
    return Promise.resolve({ ...(value as object), items: [], total: 0 } as T);
  }
  return Promise.reject(new SemFonteReal());
};

export const Motoristas = {
  list: (params?: Record<string, string | number>) =>
      mock<Paginated<Motorista>>({ items: M.MOCK_MOTORISTAS, total: M.MOCK_MOTORISTAS.length, page: 1, pageSize: 50 }),
  get: (id: string) =>
    mock<Motorista>(M.MOCK_MOTORISTAS.find((m) => m.id === id) ?? M.MOCK_MOTORISTAS[0]),
  create: (data: Partial<Motorista>) => mock(data as never),
  update: (id: string, data: Partial<Motorista>) => mock({ ...data, id } as never),
  // Exclusão não devolve corpo — undefined aqui é o resultado correto.
  remove: (_id: string) => mock(undefined as never),
};

export const Veiculos = {
  list: (params?: Record<string, string | number>) =>
      mock(M.mockVeiculosPage(Number(params?.page ?? 1), Number(params?.pageSize ?? 50))),
  get: (id: string) =>
    mock<Veiculo>(M.MOCK_VEICULOS.find((v) => v.id === id) ?? M.MOCK_VEICULOS[0]),
  create: (data: Partial<Veiculo>) => mock(data as never),
  manutencao: (id: string) =>
    mock(usandoMock() ? M.mockManutencao(id) : (undefined as never)),
};

export const Frota = {
  /**
   * Posições atuais, de `dev_status`.
   *
   * Uma linha por veículo, sempre a leitura mais recente — diferente do
   * histórico, que traz o rastro. A janela de 24 h vem por padrão do
   * servidor: sem ela, veículo que parou de transmitir há meses apareceria
   * no mapa como se estivesse em campo.
   */
  posicoes: async (): Promise<PosicaoVeiculo[]> => {
    if (modoMock()) return M.MOCK_POSICOES;

    const r = await api.get<{
      items: {
        unit_id: number;
        placa?: string | null;
        prefixo?: string | null;
        latitude: number;
        longitude: number;
        speed?: number | null;
        ignition?: boolean | null;
        address?: string | null;
        local_time?: string | null;
        sem_sinal?: boolean;
      }[];
    }>(`/api/v1/positions/${qs(filtroGrupo())}`);

    return (r.items ?? []).map<PosicaoVeiculo>((p) => ({
      veiculoId: String(p.unit_id),
      // Prefixo quando existe: é como a operação chama o carro. A placa fica
      // de reserva, e o id quando nem ela veio.
      placa: p.prefixo ?? p.placa ?? String(p.unit_id),
      lat: p.latitude,
      lng: p.longitude,
      endereco: p.address ?? "",
      velocidade: p.speed ?? 0,
      ignicao: Boolean(p.ignition),
      atualizadoEm: p.local_time ?? new Date().toISOString(),
    }));
  },
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
  /**
   * Quadro de manutenção.
   *
   * Sem tabela no backend: a ordem de serviço de frota não existe em `mova`.
   * O que existe é `device_maintenance`, que registra manutenção do
   * **rastreador** — se o GPS, o GSM e o CAN do equipamento funcionam.
   *
   * Em modo real a lista vai vazia, e a tela monta os cartões a partir da
   * frota e da preventiva calculada. O exemplo só aparece sem API.
   */
  list: () => mock<CardManutencao[]>(exemploOuVazio(M.MOCK_KANBAN)),
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
      mock(linhaId ? M.MOCK_ITINERARIOS.filter((i) => i.linhaId === linhaId) : M.MOCK_ITINERARIOS),
};

export const Programacao = {
  list: (linhaId?: string, tipoDia?: string) =>
      mock(M.MOCK_PROGRAMACAO.filter((p) => (!linhaId || p.linhaId === linhaId) && (!tipoDia || p.tipoDia === tipoDia))),
};

export const ViagensOperacao = {
  /** Realizado do dia de operação, já confrontado com a programação. */
  doDia: (data: string, linhaId?: string) =>
      mock(M.MOCK_VIAGENS_REALIZADAS.filter((v) => !linhaId || v.linhaId === linhaId)),
};

export const AlarmesOperacionais = {
  list: (linhaId?: string) =>
      mock(M.MOCK_ALARMES_OPERACIONAIS.filter((a) => !linhaId || a.linhaId === linhaId)),
};

export const Indicadores = {
  serie: () =>
    mock(M.MOCK_INDICADORES_PERIODO),
  falhas: () => (mock(M.MOCK_FALHAS)),
};

/* ---- Blocos 2, 4, 5, 6 ---- */
export const Ordens = {
  /** Ordem de serviço de frota — sem tabela no backend. */
  list: () => mock<OrdemServico[]>(exemploOuVazio(M.MOCK_ORDENS)),
};
export const Planos = {
  list: () => (mock(M.MOCK_PLANOS)),
};
export const Pneus = {
  /** Controle de pneu — sem tabela no backend. */
  list: () => mock<Pneu[]>(exemploOuVazio(M.MOCK_PNEUS)),
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
      mock(M.MOCK_POSICOES_LINHA.filter((p) => !linhaId || p.linhaId === linhaId)),
  despachos: () => (mock(M.MOCK_DESPACHOS)),
};

export const VideoAoVivo = {
  dispositivos: () =>
    mock(M.MOCK_DISPOSITIVOS_VIDEO),
  trechos: (veiculoId?: string) =>
      mock(M.MOCK_TRECHOS.filter((t) => !veiculoId || t.veiculoId === veiculoId)),
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
/**
 * Envelope de paginação por cursor.
 *
 * É o formato que veículos, motoristas e grupos usam — o mesmo dos relatórios.
 * Eu havia escrito `items` e `total`, que não existem na resposta: as listas
 * chegavam com 200 e vinham vazias, porque o campo lido nunca existiu.
 */
export type RespostaCursorApi<T> = {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
  total_returned: number;
};

export const Real = {
  // O grupo ativo entra em toda consulta de cadastro: sem ele, trocar de
  // empresa no seletor não muda o que a tela mostra.
  veiculos: (params?: Record<string, string | number>) =>
    api.get<RespostaCursorApi<unknown>>(`/api/v1/vehicles/${qs({ ...filtroGrupo(), ...params })}`),
  motoristas: (params?: Record<string, string | number>) =>
    api.get<RespostaCursorApi<unknown>>(`/api/v1/drivers/${qs({ ...filtroGrupo(), ...params })}`),
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
  /**
   * Códigos de falha.
   *
   * Sem tabela no backend. O dado bruto existe no barramento — os sinais CAN
   * chegam por posição — mas a decodificação para SPN e FMI não é feita em
   * lugar nenhum hoje.
   */
  list: () => mock<(typeof M.MOCK_DTC)>(exemploOuVazio(M.MOCK_DTC)),
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
export type FaixasMotoristaApi = {
  verde: number | null;
  extra_economica: number | null;
  inercia: number | null;
  eco_roll: number | null;
  baixa_velocidade: number | null;
  amarela: number | null;
  vermelha: number | null;
  batendo_transmissao: number | null;
  movimento_sem_tracao: number | null;
  parado_acelerando: number | null;
  parado_ligado: number | null;
  parado_produtivo: number | null;
  tolerancia: number | null;
};

/**
 * Faixas do ranking no formato do gráfico de faixas (`lib/faixas`).
 *
 * Freio motor não tem coluna de origem e fica de fora — zero ali seria lido
 * como "não usou", e o dado simplesmente não existe.
 */
export function distribuicaoDoRanking(f: FaixasMotoristaApi): Record<string, number> {
  const v = (x: number | null) => x ?? 0;
  return {
    parado_ocioso: Math.max(0, v(f.parado_ligado) - v(f.parado_produtivo)),
    parado_produtivo: v(f.parado_produtivo),
    parado_acelerando: v(f.parado_acelerando),
    baixa_velocidade: v(f.baixa_velocidade),
    sem_tracao: v(f.movimento_sem_tracao),
    eco_roll: v(f.eco_roll),
    giro_baixo: v(f.batendo_transmissao),
    verde: v(f.verde),
    extra_economica: v(f.extra_economica),
    amarela: v(f.amarela),
    vermelha: v(f.vermelha),
    inercia_simples: v(f.inercia),
    tolerancia: v(f.tolerancia),
  };
}

export type MotoristaRankingApi = {
  posicao: number | null;
  driver_id: number;
  nome: string | null;
  cnh_validade: string | null;
  cnh_numero: string | null;
  cnh_categoria: string | null;
  km: number;
  horas: number;
  litros: number;
  kml: number | null;
  pontuacao: number | null;
  estrelas: number;
  faixas: FaixasMotoristaApi;
  eventos_por_hora: {
    aceleracao_brusca: number | null;
    freada_brusca: number | null;
    velocidade_excessiva: number | null;
    embreagem: number | null;
  };
  sem_faixas: boolean;
};

export type RankingMotoristasApi = {
  inicio: string;
  fim: string;
  resumo: {
    motoristas: number;
    km_total: number;
    horas_total: number;
    nota_media: number | null;
    pct_horas_nao_identificado: number | null;
    pesos_cadastrados: boolean;
  };
  motoristas: MotoristaRankingApi[];
};

export const Operacional = {
  tracking: (unitId: string | number, data: string) =>
    api.get<unknown>(`/api/v1/tracking/?unit_id=${unitId}&operation_date=${data}`),

  eventos: (params: Record<string, string | number | boolean>) =>
    // Booleano vira string porque a serialização de query não o aceita, e
    // `false` seria descartado silenciosamente se passasse direto.
    api.get<unknown>(
      `/api/v1/events/${qs(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])))}`,
    ),

  /**
   * Disparos do Monitor de Alarmes ainda não vistos, na janela pedida.
   *
   * Vem de `alarm_violation`, a mesma fonte do monitor do sistema atual — e
   * não de `/events`, que lê `fleet_events`, vazia em produção.
   */
  /** Lista de disparos do Monitor de Alarmes, mais recentes primeiro. */
  alarmes: (horas = 24) =>
    api.get<{
      janela_horas: number;
      total: number;
      nao_visualizados: number;
      itens: {
        id: number;
        alarme: string;
        nivel: number | null;
        inicio: string | null;
        unit_id: number;
        placa: string;
        prefixo: string | null;
        motorista: string | null;
        velocidade: number | null;
        endereco: string | null;
        latitude: number | null;
        longitude: number | null;
        visualizado: boolean;
        observacao: string | null;
      }[];
    }>(`/api/v1/events/alarmes${qs({ horas, ...filtroGrupo() })}`),

  alarmesNaoVisualizados: (horas = 24) =>
    api.get<{ nao_visualizados: number; janela_horas: number }>(
      `/api/v1/events/alarmes/nao-visualizados?horas=${horas}`,
    ),

  /**
   * Ranking de motoristas pela Pontuação do Power BI (vault: indicadores-power-bi, P6).
   *
   * Datas puras e fim inclusivo; sem elas o servidor usa os 30 dias até ontem.
   */
  rankingMotoristas: (p: { inicio?: string; fim?: string; por?: "motorista" | "veiculo" } = {}) =>
    api.get<RankingMotoristasApi>(
      `/api/v1/driver-ranking/${qs({ ...filtroGrupo(), start_date: p.inicio, end_date: p.fim, por: p.por })}`,
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

/**
 * Empresas clientes — `mova.group`.
 *
 * A hierarquia real, confirmada nos dados:
 *
 *     account   a operadora do software (SS Telemática)
 *     group     a EMPRESA CLIENTE — Transcon, Saritur, Aperam, Gardênia
 *     subgroup  as unidades dentro dela: filial, garagem, contrato
 *
 * O seletor lista grupos. Listar subgrupos, como eu fazia antes, misturava
 * contratos de uma mesma empresa — "Viação Triunfo - Prefeitura Sarzedo",
 * "- Saúde JM", "- Vans" — e mostrava vários itens chamados só "Geral", que
 * sem a empresa ao lado são indistinguíveis.
 */
export type EmpresaApi = {
  id: number;
  name: string;
  account_id?: number | null;
  cnpj?: string | null;
  corporate_name?: string | null;
  client_cod?: string | null;
};

export const Empresas = {
  /**
   * Lista direta, sem envelope de paginação — como subgrupos e dispositivos.
   * Só veículos, motoristas e relatórios usam cursor com `data`.
   */
  lista: () => api.get<EmpresaApi[]>(`/api/v1/groups/?limit=500`),
};

/**
 * Unidades operacionais — o que o usuário seleciona para trabalhar.
 *
 * A hierarquia real do schema `mova` é:
 *
 *     group     conta no sistema (uma por operadora do software)
 *     subgroup  unidade operacional: filial, garagem ou contrato
 *     company   empresa dona da unidade, campo do próprio subgrupo
 *
 * Eu havia mapeado `group` como empresa cliente, o que estava errado nos dois
 * sentidos: um grupo abriga dezenas de empresas diferentes, e uma mesma empresa
 * pode ter vários subgrupos — Fertran aparece em Mutuca e em Leiber Luiz.
 *
 * Quem seleciona é o subgrupo. `company` serve para agrupar visualmente, e
 * resolve o caso de dois subgrupos chamados só "MATRIZ", que sem ela ficariam
 * indistinguíveis na lista.
 */
export type UnidadeApi = {
  id: number;
  name: string;
  group_id: number;
  company?: string | null;
  cnpj?: string | null;
  client_cod?: string | null;
  color?: string | null;
  suspended?: boolean | null;
};

export const Unidades = {
  /**
   * Devolve uma lista direta, sem envelope de paginação — diferente de
   * veículos e motoristas, que usam cursor. Eu lia `r.data` aqui e recebia
   * `undefined`, então a lista chegava sempre vazia.
   */
  lista: (grupoId?: string) =>
    api.get<UnidadeApi[]>(
      `/api/v1/subgroups/${qs({ limit: 500, ...filtroGrupo(), ...(grupoId ? { group_id: grupoId } : {}) })}`,
    ),
};

export type SaudeFrotaApi = {
  referencia: string | null;
  total_unidades: number;
  unidades_saudaveis: number;
  unidades_nao_saudaveis: number;
  percentual_saudavel: number | null;
  por_motivo: Record<string, number>;
  nao_saudaveis: {
    unit_id: number;
    label?: string | null;
    categoria: number;
    motivo: string;
    valor?: number | null;
  }[];
};

export const SaudeFrota = {
  atual: () => api.get<SaudeFrotaApi>(`/api/v1/fleet-health/${qs(filtroGrupo())}`),
};
