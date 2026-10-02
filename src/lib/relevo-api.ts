import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { chaveComGrupo, filtroGrupo } from "@/lib/escopo-ativo";
import { usandoMock } from "@/lib/modo";
import type { FiltrosBI } from "@/lib/bi-api";

/**
 * Relevo das rotas, calculado pelo mapa de elevação SRTM (NASA) a partir das
 * posições — vale para qualquer equipamento, inclusive os que não gravam
 * altitude.
 *
 * `subida_por_100km` é a medida principal: metros subidos a cada 100 km
 * rodados. Rota plana fica perto de 100; serra passa de 1.000.
 */

export type MetricasRelevo = {
  km: number;
  km_posicoes?: number;
  subida_m: number;
  descida_m: number;
  subida_por_100km: number | null;
  pct_aclive: number | null;
  pct_declive: number | null;
};

export type ResumoRelevo = {
  inicio: string;
  fim: string;
  calculando: boolean;
  progresso: number;
  totais: (MetricasRelevo & { veiculos: number; kml: number | null }) | null;
  por_veiculo: (MetricasRelevo & { unit_id: number; placa: string; kml: number | null })[];
  por_motorista: (MetricasRelevo & { driver_id: number; nome: string | null; kml: number | null })[];
  por_dia: (MetricasRelevo & { dia: string })[];
  correlacao_kml: number | null;
  fonte?: string;
};

export type PontoTrajeto = {
  hora: string;
  km: number;
  elevacao: number | null;
  altitude_gps: number | null;
  velocidade: number | null;
  lat: number;
  lon: number;
};

export type EventoTrajeto = {
  hora: string;
  tipo: import("@/lib/bi-api").TipoEvento;
  evento: string | null;
  lat: number;
  lon: number;
  velocidade: number | null;
  km: number | null;
};

export type TrajetoRelevo = {
  /** Eventos de condução no ponto exato (da própria posição). */
  eventos?: EventoTrajeto[];
  unit_id: number;
  dia: string;
  altitude_do_equipamento: boolean;
  pontos: PontoTrajeto[];
  resumo: (MetricasRelevo & { elevacao_min: number | null; elevacao_max: number | null }) | null;
};

const qs = (p: Record<string, string | number | undefined>) => {
  const e = Object.entries(p).filter(([, v]) => v !== undefined && v !== "");
  return e.length ? "?" + new URLSearchParams(e.map(([k, v]) => [k, String(v)])) : "";
};

const semRepetir = (n: number, e: unknown) => {
  const s = (e as { status?: number })?.status;
  return s !== 401 && s !== 403 && s !== 503 && n < 2;
};

export const relevoResumoQuery = (f: FiltrosBI) =>
  queryOptions({
    queryKey: chaveComGrupo("relevo", "resumo", f.inicio, f.fim, f.garagem ?? "", f.placa ?? "", f.condutor ?? ""),
    queryFn: () =>
      api.get<ResumoRelevo>(
        `/api/v1/relevo/resumo${qs({ ...filtroGrupo(), start_date: f.inicio, end_date: f.fim, subgroup_id: f.garagem, unit_id: f.placa, driver_id: f.condutor })}`,
      ),
    enabled: !usandoMock(),
    retry: semRepetir,
    staleTime: 10 * 60_000,
    // Primeira vez de um período longo: o servidor calcula em segundo plano e
    // a tela pergunta de novo até terminar.
    refetchInterval: (q) => (q.state.data?.calculando ? 3000 : false),
  });

export const relevoTrajetoQuery = (unitId: string | undefined, dia: string) =>
  queryOptions({
    queryKey: ["relevo", "trajeto", unitId ?? "", dia],
    queryFn: () => api.get<TrajetoRelevo>(`/api/v1/relevo/trajeto${qs({ unit_id: unitId, dia })}`),
    enabled: !usandoMock() && Boolean(unitId),
    retry: semRepetir,
    staleTime: 5 * 60_000,
  });

/** Leitura simples do relevo para o gestor. */
export function classeRelevo(subidaPor100km: number | null | undefined) {
  if (subidaPor100km == null) return { rotulo: "—", cor: "var(--muted-foreground)" };
  if (subidaPor100km < 400) return { rotulo: "Plano", cor: "var(--leaf)" };
  if (subidaPor100km < 900) return { rotulo: "Ondulado", cor: "var(--gold)" };
  if (subidaPor100km < 1500) return { rotulo: "Montanhoso", cor: "#E0803C" };
  return { rotulo: "Serra", cor: "var(--coral)" };
}
