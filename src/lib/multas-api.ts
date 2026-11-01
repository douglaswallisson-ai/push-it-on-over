import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { requisicaoAutenticada } from "@/lib/auth-api";

/** Quadro de multas (ss-fleet-core endpoints/multas.py). */

export type ChaveColuna = "autuacao" | "infracao" | "recorrida" | "paga" | "cancelada";

export type CardMulta = {
  id: number;
  ait: string;
  placa: string;
  veiculo: string | null;
  motorista: string | null;
  uf: string | null;
  orgao: string | null;
  infracao: string | null;
  local: string | null;
  valor: number | null;
  autuada_em: string;
  prazo_recurso: string | null;
  prazo_pagamento: string | null;
  status_oficial: ChaveColuna;
  coluna: ChaveColuna;
  destaque_recurso: boolean;
  destaque_pagamento: boolean;
  pontos: number | null;
  codigo_barras: string | null;
  pix: string | null;
  tem_boleto: boolean;
  exemplo: boolean;
};

export type ColunaMultas = {
  chave: ChaveColuna;
  rotulo: string;
  interna: boolean;
  quantidade: number;
  valor_total: number;
  cards: CardMulta[];
};

export type AvisoMulta = {
  id: number;
  multa_id: number;
  em: string;
  de: ChaveColuna;
  para: ChaveColuna;
  ait: string;
  placa: string;
};

export type QuadroMultas = {
  colunas: ColunaMultas[];
  sincronizacao: {
    situacao: "ok" | "falha" | "nao_configurada";
    ultima_em: string | null;
    tentativa_em: string | null;
  };
  avisos: AvisoMulta[];
  pode_dados_pessoais: boolean;
  aviso_so_oficial: string;
};

export type DetalheMulta = {
  multa: CardMulta;
  motorista: {
    nome: string;
    matricula?: string | null;
    telefone?: string | null;
    cnh_categoria?: string | null;
    cnh_validade?: string | null;
  } | null;
  telemetria: {
    local_time: string;
    latitude: number | null;
    longitude: number | null;
    address: string | null;
    speed: number | null;
    can_speed: number | null;
    rpm: number | null;
    faixa: string | null;
  } | null;
  local_aproximado: { lat: number; lng: number; precisao?: string } | null;
  auditoria: {
    id: number;
    tipo: string;
    origem: string;
    usuario_id: number | null;
    em: string;
    de: ChaveColuna | null;
    para: ChaveColuna | null;
  }[];
  pode_dados_pessoais: boolean;
  janela_telemetria_min: number;
  gerado_em?: string;
};

export const quadroMultasQuery = (grupo: string) =>
  queryOptions({
    queryKey: ["multas", "quadro", grupo],
    queryFn: () => api.get<QuadroMultas>(`/api/v1/cco/multas${grupo ? `?group_id=${grupo}` : ""}`),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

export const detalheMultaQuery = (id: number) =>
  queryOptions({
    queryKey: ["multas", "detalhe", id],
    queryFn: () => api.get<DetalheMulta>(`/api/v1/cco/multas/${id}`),
    staleTime: 60_000,
  });

export const moverMulta = (id: number, para: ChaveColuna) =>
  api.post<{ coluna: ChaveColuna }>(`/api/v1/cco/multas/${id}/mover`, { para });

export const marcarAvisosVistos = (ultimo_id: number) =>
  api.post<{ ok: boolean }>(`/api/v1/cco/multas/avisos/visto`, { ultimo_id });

const BASE = import.meta.env.VITE_API_BASE ?? "";

/** O envio não passa por `api`: o navegador precisa montar o cabeçalho do arquivo. */
export async function anexarBoleto(id: number, arquivo: File): Promise<void> {
  const corpo = new FormData();
  corpo.append("arquivo", arquivo);
  const res = await requisicaoAutenticada(`${BASE}/api/v1/cco/multas/${id}/boleto`, {
    method: "POST",
    body: corpo,
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function abrirBoleto(id: number): Promise<void> {
  const res = await requisicaoAutenticada(`${BASE}/api/v1/cco/multas/${id}/boleto`);
  if (!res.ok) throw new Error(await res.text());
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Registra a geração na auditoria e devolve os dados do relatório. */
export const gerarRelatorioMulta = (id: number) =>
  api.post<DetalheMulta>(`/api/v1/cco/multas/${id}/relatorio`, {});
