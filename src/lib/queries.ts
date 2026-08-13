import { queryOptions } from "@tanstack/react-query";
import { Alarmes, Conducoes, Equipamentos, Frota, Garagens, ManutencaoKanban, Veiculos } from "@/lib/api";
import type { StatusComunicacao, StatusManutencao } from "@/types";

/**
 * Opções de query compartilhadas — um único lugar definindo chaves de cache e
 * frescor dos dados vindos da API de frota.
 */

const MINUTE = 60_000;

export const resumoQuery = () =>
  queryOptions({
    queryKey: ["frota", "resumo"],
    queryFn: () => Frota.resumo(),
    staleTime: MINUTE,
  });

export const posicoesQuery = () =>
  queryOptions({
    queryKey: ["frota", "posicoes"],
    queryFn: () => Frota.posicoes(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

export const veiculosQuery = (page = 1, pageSize = 50) =>
  queryOptions({
    queryKey: ["veiculos", page, pageSize],
    queryFn: () => Veiculos.list({ page, pageSize }),
    staleTime: 5 * MINUTE,
  });

export const manutencaoQuery = (veiculoId: string | undefined) =>
  queryOptions({
    queryKey: ["veiculos", veiculoId, "manutencao"],
    queryFn: () => Veiculos.manutencao(veiculoId!),
    enabled: Boolean(veiculoId),
    staleTime: 5 * MINUTE,
  });

export const alarmesQuery = () =>
  queryOptions({
    queryKey: ["alarmes"],
    queryFn: () => Alarmes.list(),
    staleTime: 5 * MINUTE,
  });

/** Rótulos de situação do veículo usados pela UI. */
export const SITUACAO_LABEL: Record<string, string> = {
  em_rota: "Em rota",
  parado: "Parado",
  manutencao: "Manutenção",
  sem_sinal: "Sem sinal",
};

export const SITUACAO_TONE: Record<string, "green" | "gold" | "sky" | "coral" | "neutral"> = {
  em_rota: "green",
  parado: "gold",
  manutencao: "sky",
  sem_sinal: "coral",
};

export const nf = (v: number, digits = 0) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v ?? 0);

/** "há 30s" / "há 4 min" a partir de um ISO. */
export function desde(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `há ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

/**
 * Converte lat/lng para coordenadas percentuais dentro do canvas ilustrativo
 * (recorte aproximado do Brasil).
 */
export function toCanvasXY(lat: number, lng: number) {
  const [minLng, maxLng, minLat, maxLat] = [-74, -34, -34, 6];
  const x = ((lng - minLng) / (maxLng - minLng)) * 100;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
  return { x: Math.min(96, Math.max(4, x)), y: Math.min(94, Math.max(6, y)) };
}

/* ------------------------------------------------------------------ */
/* Garagens, equipamentos, kanban e conduções                          */
/* ------------------------------------------------------------------ */

export const garagensQuery = () =>
  queryOptions({ queryKey: ["garagens"], queryFn: () => Garagens.list(), staleTime: 10 * MINUTE });

export const equipamentosQuery = () =>
  queryOptions({
    queryKey: ["equipamentos"],
    queryFn: () => Equipamentos.list(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

export const kanbanManutencaoQuery = () =>
  queryOptions({ queryKey: ["manutencao", "kanban"], queryFn: () => ManutencaoKanban.list(), staleTime: MINUTE });

export const conducoesVeiculoQuery = (veiculoId: string | undefined) =>
  queryOptions({
    queryKey: ["conducoes", "veiculo", veiculoId],
    queryFn: () => Conducoes.porVeiculo(veiculoId!),
    enabled: Boolean(veiculoId),
    staleTime: 5 * MINUTE,
  });

export const conducoesMotoristaQuery = (nome: string | undefined) =>
  queryOptions({
    queryKey: ["conducoes", "motorista", nome],
    queryFn: () => Conducoes.porNome(nome!),
    enabled: Boolean(nome),
    staleTime: 5 * MINUTE,
  });

/* ---- Comunicação de equipamentos ---- */

/**
 * Limiares de comunicação, em horas. Regra única para tela, filtro e alerta —
 * mudar aqui muda em todo o sistema.
 */
export const LIMIAR_COMUNICACAO = { online: 1, atencao: 24 };

export function statusComunicacao(iso: string | null): StatusComunicacao {
  if (!iso) return "nunca";
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h <= LIMIAR_COMUNICACAO.online) return "online";
  if (h <= LIMIAR_COMUNICACAO.atencao) return "atencao";
  return "sem_sinal";
}

export const COMUNICACAO_LABEL: Record<StatusComunicacao, string> = {
  online: "Comunicando",
  atencao: "Atraso",
  sem_sinal: "Sem sinal",
  nunca: "Nunca comunicou",
};

export const COMUNICACAO_TONE: Record<StatusComunicacao, "green" | "gold" | "coral" | "neutral"> = {
  online: "green",
  atencao: "gold",
  sem_sinal: "coral",
  nunca: "neutral",
};

/** Data absoluta em pt-BR, para tooltip ao lado do tempo relativo. */
export const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

/* ---- Manutenção (kanban) ---- */

export const MANUTENCAO_COLUNAS: { id: StatusManutencao; label: string; cor: string }[] = [
  { id: "em_dia", label: "Em dia", cor: "var(--leaf)" },
  { id: "preditiva", label: "Preditiva", cor: "var(--brand-sky)" },
  { id: "preventiva", label: "Preventiva", cor: "var(--gold)" },
  { id: "corretiva", label: "Corretiva", cor: "var(--coral)" },
  { id: "liberado", label: "Liberado", cor: "var(--brand-navy)" },
];
