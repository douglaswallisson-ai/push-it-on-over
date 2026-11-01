import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Gestão de pneus sem sensores (ss-fleet-core endpoints/pneus.py). */

export type StatusPneu = "estoque" | "montado" | "recapagem" | "reparo" | "descartado";

export type Servico = {
  id: number;
  tipo: "recapagem" | "reparo";
  numero: number | null;
  fornecedor: string | null;
  enviado_em: string;
  prazo_dias: number | null;
  banda: string | null;
  custo_previsto: number | null;
  retorno_em: string | null;
  custo: number | null;
  resultado: string | null;
  garantia: string | null;
  dias_fora?: number;
  atrasado?: boolean;
};

export type LinhaPneu = {
  id: number;
  group_id: number;
  fogo: string;
  marca: string;
  modelo: string;
  medida: string;
  compra_em: string | null;
  preco: number | null;
  fornecedor: string | null;
  nota_fiscal: string | null;
  status: StatusPneu;
  status_rotulo: string;
  vida: number;
  recapagens: number;
  km_total: number;
  km_medido: number;
  km_informado: number;
  km_inconsistente: boolean;
  km_desatualizado: boolean;
  fonte_km: string | null;
  km_veiculo_lido_em: string | null;
  placa: string | null;
  unit_id: number | null;
  posicao: string | null;
  posicao_rotulo: string | null;
  custo_acumulado: number;
  preco_informado: boolean;
  servico: Servico | null;
};

export type Posicao = { chave: string; rotulo: string };

export type ListaPneus = {
  pneus: LinhaPneu[];
  motivos_saida: string[];
  tipos_ocorrencia: string[];
  resultados_ocorrencia: string[];
  modelos_eixos: { chave: string; rotulo: string; posicoes: Posicao[] }[];
  sugestoes: { marca: string[]; medida: string[]; fornecedor: string[] };
};

export type VeiculoPneu = {
  unit_id: number;
  placa: string;
  prefixo: string | null;
  km: number | null;
  lido_em: string | null;
  fonte_km: string;
  modelo_eixos: string | null;
};

export type EventoPneu = {
  id: number;
  vida: number;
  tipo: string;
  em: string;
  custo: number | null;
  dados: Record<string, string | number | null>;
  registrado_por: string | null;
  registrado_em: string;
};

export type DetalhePneu = {
  pneu: LinhaPneu;
  vidas: {
    vida: number;
    rotulo: string;
    km: number;
    montagens: number;
    ocorrencias: number;
    custo: number;
    inicio: string | null;
    atual: boolean;
  }[];
  km_medio_por_vida: number;
  servicos: Servico[];
  limite_recapagens: number;
  limite_atingido: boolean;
  eventos: EventoPneu[];
};

export type PneusDoVeiculo = {
  veiculo: VeiculoPneu;
  posicoes: (Posicao & { pneu: LinhaPneu | null })[];
  sem_posicao_no_modelo: LinhaPneu[];
};

const B = "/api/v1/cco/pneus";

export const pneusQuery = (grupo: string) =>
  queryOptions({
    queryKey: ["pneus", "lista", grupo],
    queryFn: () => api.get<ListaPneus>(`${B}${grupo ? `?group_id=${grupo}` : ""}`),
    staleTime: 30_000,
  });

export const detalhePneuQuery = (id: number) =>
  queryOptions({
    queryKey: ["pneus", "detalhe", id],
    queryFn: () => api.get<DetalhePneu>(`${B}/${id}`),
    staleTime: 30_000,
  });

export const veiculosPneuQuery = (grupo: number | string) =>
  queryOptions({
    queryKey: ["pneus", "veiculos", String(grupo)],
    queryFn: () => api.get<{ veiculos: VeiculoPneu[] }>(`${B}/veiculos?group_id=${grupo}`),
    enabled: Boolean(grupo),
    staleTime: 60_000,
  });

export const pneusDoVeiculoQuery = (grupo: number | string, unit: number | null) =>
  queryOptions({
    queryKey: ["pneus", "veiculo", String(grupo), unit],
    queryFn: () => api.get<PneusDoVeiculo>(`${B}/veiculos/${unit}?group_id=${grupo}`),
    enabled: Boolean(grupo && unit),
  });

export const configPneuQuery = (grupo: string) =>
  queryOptions({
    queryKey: ["pneus", "config", grupo],
    queryFn: () => api.get<{ limite_recapagens: number }>(`${B}/config?group_id=${grupo}`),
    enabled: Boolean(grupo),
  });

export const kmDoVeiculo = (grupo: number, unit: number, data: string) =>
  api.get<{ km: number | null; fonte: string; historico: boolean }>(
    `${B}/km-do-veiculo?group_id=${grupo}&unit_id=${unit}&data=${data}`,
  );

export const cadastrarPneus = (corpo: unknown) =>
  api.post<{ ids: number[]; aviso: string | null }>(B, corpo);
export const gravarConfigPneu = (group_id: number, limite_recapagens: number) =>
  api.put<unknown>(`${B}/config`, { group_id, limite_recapagens });
export const acaoPneu = (id: number, acao: string, corpo: unknown) =>
  api.post<unknown>(`${B}/${id}/${acao}`, corpo);
export const desmontarTodos = (unit: number, corpo: unknown) =>
  api.post<{ desmontados: number }>(`${B}/veiculos/${unit}/desmontar-todos`, corpo);

/** A recusa do servidor vem como `{"detail": ...}`: texto, ou código e mensagem quando a tela pode oferecer uma saída. */
export function lerRecusa(e: Error): { mensagem: string; codigo?: string; pneu_id?: number } {
  try {
    const d = JSON.parse(e.message).detail;
    if (typeof d === "string") return { mensagem: d };
    if (Array.isArray(d)) return { mensagem: "Confira os campos obrigatórios." };
    return d;
  } catch {
    return { mensagem: e.message };
  }
}
