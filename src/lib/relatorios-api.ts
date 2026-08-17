import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";

/**
 * Relatórios do `ss-fleet-core`.
 *
 * O backend pagina por **cursor**, não por página numerada — e isso não é
 * detalhe de implementação: as tabelas são particionadas por mês, e o cursor
 * composto (`start_time`, `id`) permite ao Postgres descartar partições
 * inteiras. Com `OFFSET` em 3,7 milhões de linhas, a consulta varreria tudo.
 *
 * Consequência para a interface: não existe "ir para a página 7". A navegação é
 * sempre para a frente, carregando mais conforme o usuário rola.
 */

/** Janela máxima aceita pelos endpoints de cursor. */
export const MAX_DIAS_CURSOR = 93;

export type RespostaCursor<T> = {
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
  total_returned: number;
};

export type FiltroRelatorio = {
  inicio: string;
  fim: string;
  /** Ids de veículo. Vazio consulta todos os que o usuário enxerga. */
  veiculos?: string[];
  limite?: number;
};

const paramsDe = (f: FiltroRelatorio, cursor?: string) => {
  const p = new URLSearchParams({
    start_date: f.inicio,
    end_date: f.fim,
    limit: String(f.limite ?? 1000),
  });
  if (f.veiculos?.length) p.set("vehicle_ids", f.veiculos.join(","));
  if (cursor) p.set("cursor", cursor);
  return p.toString();
};

/**
 * Valida a janela antes de chamar.
 *
 * O backend rejeita acima de 93 dias com 400. Barrar aqui permite explicar o
 * motivo em vez de mostrar um erro cru vindo do servidor.
 */
export function validarJanela(inicio: string, fim: string): string | null {
  const d1 = new Date(inicio);
  const d2 = new Date(fim);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) return "Datas inválidas.";
  if (d2 < d1) return "A data final é anterior à inicial.";
  const dias = (d2.getTime() - d1.getTime()) / 86_400_000;
  if (dias > MAX_DIAS_CURSOR) {
    return `O período máximo é de ${MAX_DIAS_CURSOR} dias. Selecionado: ${Math.round(dias)}.`;
  }
  return null;
}

type Relatorio = "Telemetry" | "History" | "DriverKmFuel" | "RpmBandTime" | "Heatmap" | "WeightRange";

/**
 * Consulta paginada por cursor.
 *
 * Usa `useInfiniteQuery` porque o modelo do backend é "próxima página", e não
 * acesso aleatório: forçar paginação numerada por cima exigiria contar o total,
 * que é justamente a consulta cara que o cursor evita.
 */
export function useRelatorioCursor<T>(relatorio: Relatorio, filtro: FiltroRelatorio, habilitado = true) {
  const erroJanela = validarJanela(filtro.inicio, filtro.fim);

  const q = useInfiniteQuery({
    queryKey: ["relatorio", relatorio, filtro.inicio, filtro.fim, filtro.veiculos?.join(",") ?? ""],
    enabled: habilitado && !erroJanela && !usandoMock(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.get<RespostaCursor<T>>(`/api/v1/reports/${relatorio}/cursor?${paramsDe(filtro, pageParam)}`),
    getNextPageParam: (ultima) => (ultima.has_more ? (ultima.next_cursor ?? undefined) : undefined),
    staleTime: 5 * 60_000,
  });

  return {
    ...q,
    /** Todas as páginas achatadas — é o que a tabela consome. */
    registros: (q.data?.pages ?? []).flatMap((p) => p.data),
    erroJanela,
  };
}

/**
 * Estimativa de tamanho antes de exportar.
 *
 * O backend oferece isso de propósito: exportar três meses de telemetria de uma
 * frota inteira pode gerar milhões de linhas. Avisar antes evita o usuário
 * disparar um download que trava o navegador e ocupa o servidor por minutos.
 */
export function useEstimativaExport(relatorio: Relatorio, filtro: FiltroRelatorio, habilitado = false) {
  return useQuery({
    queryKey: ["relatorio", relatorio, "estimativa", filtro.inicio, filtro.fim],
    enabled: habilitado && !validarJanela(filtro.inicio, filtro.fim) && !usandoMock(),
    queryFn: () =>
      api.get<{ estimated_rows: number; estimated_size_mb: number; warning?: string }>(
        `/api/v1/reports/${relatorio}/export/estimate?${paramsDe(filtro)}`,
      ),
    staleTime: 60_000,
  });
}

/**
 * Baixa o CSV direto do servidor.
 *
 * A exportação é em streaming: o servidor envia conforme lê, sem montar o
 * arquivo inteiro em memória. Por isso o download vai pelo navegador, e não
 * passa por `fetch` seguido de `Blob` — carregar centenas de MB na aba
 * derrubaria a página.
 */
export function urlExportCsv(relatorio: Relatorio, filtro: FiltroRelatorio): string {
  const base = (import.meta.env.VITE_API_BASE as string) || "";
  return `${base}/api/v1/reports/${relatorio}/export/csv?${paramsDe(filtro)}`;
}

/* ------------------------------------------------------------------ */
/* Formatos devolvidos                                                 */
/* ------------------------------------------------------------------ */

/** Viagem consolidada. É o registro com os 113 campos de `con_telemetry`. */
export type TelemetriaApi = {
  id: number;
  trip_id: number;
  trip_number?: number | null;
  unit_id: number;
  unit_label: string;
  device_id: number;
  driver_id?: number | null;
  driver_name?: string | null;
  start_time: string;
  end_time?: string | null;
  total_time?: number | null;
  time_moving?: number | null;
  time_stopped?: number | null;
  start_odometer?: number | null;
  end_odometer?: number | null;
  distance_traveled?: number | null;
  start_lat?: number | null;
  start_lon?: number | null;
  start_poi_name?: string | null;
  start_area_name?: string | null;
  end_lat?: number | null;
  end_lon?: number | null;
  end_poi_name?: string | null;
  end_area_name?: string | null;
  max_speed?: number | null;
  avg_speed?: number | null;
  fuel_used?: number | null;
  efficiency_kml?: number | null;
  // Faixas de condução — as mesmas 14 que o front já modela.
  time_green?: number | null;
  time_extra_eco?: number | null;
  time_yellow?: number | null;
  time_red?: number | null;
  time_stop_engine_on?: number | null;
  time_inercia?: number | null;
  // Chuva: o backend distingue, e nenhuma tela usava.
  time_raining?: number | null;
  time_dry?: number | null;
  // Linha, quando o equipamento envia.
  line_number?: number | null;
  trip_direction?: number | null;
  journey_status?: boolean | null;
};

/** Posição bruta do histórico. */
export type HistoricoApi = {
  unit_id: number;
  local_time: string;
  latitude: number;
  longitude: number;
  ignition?: boolean | null;
  speed?: number | null;
  odom?: number | null;
  rpm?: number | null;
  address?: string | null;
};
