import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";
import { grupoAtivo } from "@/lib/escopo-ativo";

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
  /**
   * O recorte por empresa é feito por veículo, não por grupo.
   *
   * Os endpoints de cursor aceitam `vehicle_ids` e nada mais — `group_ids` só
   * existe no relatório de jornada, e mandá-lo aqui faz o FastAPI rejeitar a
   * requisição inteira com 422.
   *
   * Quem seleciona os veículos é a tela, que já tem a frota da empresa ativa.
   */
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

/**
 * Relatórios disponíveis. Os caminhos seguem o backend, que usa kebab-case
 * em alguns e não em outros — mapear aqui evita espalhar a inconsistência.
 */
type Relatorio =
  | "telemetry"
  | "history"
  | "history/detailed"
  | "driver-km-fuel-hours"
  | "rpm-band-time"
  | "heatmap"
  | "weight-range";

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
    queryKey: ["relatorio", relatorio, filtro.inicio, filtro.fim, filtro.veiculos?.join(",") ?? "", grupoAtivo() ?? "todos"],
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
  time_eco_roll?: number | null;
  time_retarder?: number | null;
  time_autopilot?: number | null;
  time_low_speed?: number | null;
  /** Movimento sem tração. O relatório rotula como "marcha lenta", nome enganoso. */
  time_banguela?: number | null;
  /** Entra no denominador das faixas, apesar de não aparecer no relatório. */
  time_tolerancia?: number | null;
  // Chuva: o backend distingue, e nenhuma tela usava.
  time_raining?: number | null;
  time_dry?: number | null;
  // Eventos de condução, contados por viagem.
  count_hard_brake?: number | null;
  count_hard_acel?: number | null;
  count_harsh_turn?: number | null;
  count_speed_violation_l2?: number | null;
  count_speed_violation_l3?: number | null;
  count_stop_engine_on?: number | null;
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

/* ------------------------------------------------------------------ */
/* Relatórios que existiam no backend e nenhuma tela consumia          */
/* ------------------------------------------------------------------ */

/**
 * Posição com os sinais do barramento CAN.
 *
 * São 22 leituras por posição, e nenhuma aparecia na interface. Boa parte
 * responde perguntas que hoje ninguém consegue responder: nível de ARLA,
 * pressão pneumática, horímetro do motor, marcha engatada.
 */
export type HistoricoDetalhadoApi = {
  unit_id: number;
  local_time: string;
  latitude: number;
  longitude: number;
  speed?: number | null;
  ignition?: boolean | null;
  address?: string | null;
  can_rpm?: number | null;
  can_speed?: number | null;
  can_gear?: number | null;
  can_accel_pedal_percent?: number | null;
  can_engine_torque_percent?: number | null;
  can_engine_oil_pressure?: number | null;
  can_turbo_charger_pressure?: number | null;
  can_engine_coolant_temp?: number | null;
  can_engine_coolant_level?: number | null;
  can_fuel_level_percent?: number | null;
  /** Nível de ARLA. Motor entra em derate quando acaba. */
  can_def_level_percent?: number | null;
  can_total_used_fuel?: number | null;
  can_total_odometer?: number | null;
  /** Horímetro do motor: gatilho por horas da manutenção preventiva. */
  can_engine_hourmeter?: number | null;
  can_control_module_voltage?: number | null;
  can_pneumatic_system1_pressure?: number | null;
  can_pneumatic_system2_pressure?: number | null;
  can_cruise_control_state?: boolean | null;
  can_break_pedal_state?: boolean | null;
  can_parking_brake_state?: boolean | null;
  can_retarder_in_use?: boolean | null;
  can_retarder_torque?: number | null;
};

/** Km, combustível e horas por motorista. */
export type MotoristaKmApi = {
  driver_id: number;
  driver_name?: string | null;
  total_km?: number | null;
  total_fuel?: number | null;
  total_hours?: number | null;
  efficiency_kml?: number | null;
  trips?: number | null;
};

/** Tempo em cada faixa de RPM. */
export type FaixaRpmApi = {
  unit_id: number;
  unit_label?: string | null;
  driver_id?: number | null;
  driver_name?: string | null;
  time_blue?: number | null;
  time_green?: number | null;
  time_yellow?: number | null;
  time_red?: number | null;
};

/** Concentração de posições, para o mapa de calor. */
export type PontoCalorApi = {
  latitude: number;
  longitude: number;
  weight?: number | null;
  count?: number | null;
};

/** Meta e peso por faixa, de `mova.weight_range`. */
export type MetaPesoApi = {
  range_id: number;
  group_id?: number | null;
  subgroup_id?: number | null;
  weight?: number | null;
  goal?: number | null;
};
