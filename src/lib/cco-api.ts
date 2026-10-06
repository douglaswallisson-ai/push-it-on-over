import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";
import type { TipoVeiculo } from "@/components/ss/mapa/iconesVeiculo";

/**
 * Painel CCO com dado real (ss-fleet-core, endpoints/cco.py). Regras na
 * docstring do backend e em lib/cco.ts (catálogo e dados de exemplo).
 */

export type CorCarro = "vermelho" | "amarelo" | "verde" | "cinza";
export type FonteAviso = "seguranca" | "camera" | "manutencao" | "equipamento";

export type VeiculoPainel = {
  id: number | string;
  placa: string;
  prefixo: string;
  /** Descrição do veículo quando o cadastro usa o prefixo para isso. */
  descricao?: string | null;
  empresa: string | null;
  group_id?: number | null;
  tipo: TipoVeiculo;
  lat: number;
  lng: number;
  ignicao: boolean;
  velocidade: number;
  rpm: number | null;
  faixa: string | null;
  altitude: number | null;
  temperatura: number | null;
  combustivel: number | null;
  motorista: string | null;
  endereco?: string | null;
  ultima_comunicacao: string | null;
  comunicando: boolean;
  tem_camera: boolean;
  cor: CorCarro;
};

export type AvisoPainel = {
  id: string;
  unit_id: number | string;
  nome: string;
  fonte: FonteAviso;
  gravidade: "critico" | "moderado";
  quantidade: number;
  ultimo: string | null;
  /** Horário que o Visto/Tratado grava (manutenção: fim do dia). */
  ate?: string | null;
  detalhe: string;
  reaberto?: boolean;
};

export type RespostaPainel = {
  veiculos: VeiculoPainel[];
  avisos: AvisoPainel[];
  avisos_total: number;
  manutencao_disponivel: boolean;
  janela_horas: number;
  atualizado_em: string;
};

export const painelCCOQuery = (groupId: string | undefined, horas: number) =>
  queryOptions({
    queryKey: ["cco", groupId ?? "todos", horas],
    queryFn: () =>
      api.get<RespostaPainel>(
        `/api/v1/cco/painel?horas=${horas}${groupId ? `&group_id=${groupId}` : ""}`,
      ),
    enabled: !usandoMock(),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  });

export const consumoQuery = (unitId: number | string | null) =>
  queryOptions({
    queryKey: ["cco", "consumo", unitId],
    queryFn: () =>
      api.get<{ consumo_lh: number | null; consumo_minutos: number | null }>(
        `/api/v1/cco/veiculo/${unitId}`,
      ),
    enabled: !usandoMock() && typeof unitId === "number",
    refetchInterval: 60_000,
  });

/** Posição de um veículo a cada 10 s, para "Seguir veículo" (leve: uma linha). */
export type PosicaoVeiculo = {
  local_time: string | null;
  lat: number | null;
  lng: number | null;
  rumo: number | null;
  ignicao: boolean | null;
  velocidade: number | null;
  endereco: string | null;
};
export const posicaoQuery = (unitId: number | string | null) =>
  queryOptions({
    queryKey: ["cco", "posicao", unitId],
    queryFn: () => api.get<PosicaoVeiculo>(`/api/v1/cco/posicao/${unitId}`),
    enabled: !usandoMock() && unitId != null,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
  });

export const CCO = {
  marcar: (a: AvisoPainel, situacao: "visto" | "tratado", nota?: string) =>
    api.post<{ ok: boolean }>(`/api/v1/cco/avisos/${encodeURIComponent(a.id)}/marcar`, {
      situacao,
      ate: a.ate ?? a.ultimo ?? new Date().toISOString(),
      unit_id: a.unit_id,
      nota,
    }),
};
