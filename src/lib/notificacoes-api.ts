import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Notificação inteligente (ss-fleet-core endpoints/notificacoes.py). Canal: só a plataforma. */

export type Notificacao = {
  chave: string;
  patamar: string;
  unit_id: number | string;
  veiculo: string;
  placa: string;
  titulo: string;
  detalhe: string;
  fonte: string;
  gravidade: "critico" | "moderado";
  quantidade: number;
  reincidente: boolean;
  modo: "imediato" | "resumo";
  prioridade: number;
  desde: string;
  lida: boolean;
};

export type RespostaNotificacoes = {
  precisa_empresa: boolean;
  imediatas: Notificacao[];
  nao_lidas: number;
  resumo: { fonte: string; rotulo: string; total: number; criticos: number }[];
  resumo_itens: Notificacao[];
  canal: string;
  atualizado_em?: string;
};

export type Preferencia = {
  fonte: string;
  rotulo: string;
  gravidade: "critico" | "moderado";
  modo: "imediato" | "resumo" | "desligado";
  padrao: string;
};

export const notificacoesQuery = (grupo: string) =>
  queryOptions({
    queryKey: ["notificacoes", grupo],
    queryFn: () =>
      api.get<RespostaNotificacoes>(`/api/v1/notificacoes${grupo ? `?group_id=${grupo}` : ""}`),
    // A cada 2 min: o dado novo dos rastreadores chega a cada 1 a 2 min, e o sino roda em toda tela aberta.
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

export const preferenciasQuery = () =>
  queryOptions({
    queryKey: ["notificacoes", "preferencias"],
    queryFn: () =>
      api.get<{ preferencias: Preferencia[]; observacao: string }>(
        `/api/v1/notificacoes/preferencias`,
      ),
  });

export const marcarLidas = (corpo: { chaves?: string[]; todas?: boolean; group_id?: number }) =>
  api.post<{ ok: boolean }>(`/api/v1/notificacoes/lidas`, corpo);

export const gravarPreferencias = (prefs: Pick<Preferencia, "fonte" | "gravidade" | "modo">[]) =>
  api.put<{ preferencias: Preferencia[] }>(`/api/v1/notificacoes/preferencias`, prefs);
