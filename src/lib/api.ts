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
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, detail || `HTTP ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
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

export const Motoristas = {
  list: (params?: Record<string, string | number>) =>
    api.get<Paginated<Motorista>>(`/api/motoristas${qs(params)}`),
  get: (id: string) => api.get<Motorista>(`/api/motoristas/${id}`),
  create: (data: Partial<Motorista>) => api.post<Motorista>(`/api/motoristas`, data),
  update: (id: string, data: Partial<Motorista>) => api.put<Motorista>(`/api/motoristas/${id}`, data),
  remove: (id: string) => api.del(`/api/motoristas/${id}`),
};

export const Veiculos = {
  list: (params?: Record<string, string | number>) =>
    api.get<Paginated<Veiculo>>(`/api/veiculos${qs(params)}`),
  get: (id: string) => api.get<Veiculo>(`/api/veiculos/${id}`),
  create: (data: Partial<Veiculo>) => api.post<Veiculo>(`/api/veiculos`, data),
  manutencao: (id: string) => api.get<Manutencao>(`/api/veiculos/${id}/manutencao`),
};

export const Frota = {
  posicoes: () => api.get<PosicaoVeiculo[]>(`/api/frota/posicoes`),
  resumo: () => api.get<ResumoOperacao>(`/api/frota/resumo`),
};

export const Viagens = {
  list: (params?: Record<string, string | number>) =>
    api.get<Paginated<Viagem>>(`/api/viagens${qs(params)}`),
  create: (data: Partial<Viagem>) => api.post<Viagem>(`/api/viagens`, data),
};

export const Alarmes = {
  list: () => api.get<Alarme[]>(`/api/alarmes`),
  create: (data: Partial<Alarme>) => api.post<Alarme>(`/api/alarmes`, data),
};

export const CO2 = {
  resumo: (params?: Record<string, string>) => api.get<EmissaoResumo>(`/api/co2/resumo${qs(params)}`),
};
