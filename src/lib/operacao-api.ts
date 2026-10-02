import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { chaveComGrupo, filtroGrupo } from "@/lib/escopo-ativo";
import { usandoMock } from "@/lib/modo";

/**
 * Operação de linhas (Fretamento e Transporte urbano).
 *
 * - Monitor: horários do dia × viagens executadas — clientes que registram a
 *   viagem no sistema (fretamento, ex.: VTR).
 * - Produtivas: viagens da telemetria com linha, sentido e número — clientes
 *   urbanos (ex.: Consórcio Fênix).
 */

export type SituacaoMonitor = "ok" | "atrasada" | "adiantada" | "nao_realizada" | "aguardando" | "em_andamento" | "reforco";

export type ViagemMonitor = {
  id: string;
  programadaId: string | null;
  linhaId: string;
  linha: string | null;
  linhaDescricao: string | null;
  tabela: string | null;
  sentido: "ida" | "volta";
  partidaProgramada: string | null;
  chegadaProgramada: string | null;
  partidaRealizada: string | null;
  chegadaRealizada: string | null;
  veiculoProgramadoId: string | null;
  veiculoProgramado: string | null;
  veiculoRealizadoId: string | null;
  veiculoRealizado: string | null;
  placaRealizada: string | null;
  motoristaRealizado: string | null;
  passageiros: number | null;
  lotacao: number | null;
  kmRodado: number | null;
  percursoPct: number | null;
  situacao: SituacaoMonitor;
};

export type MonitorDia = {
  dia: string;
  fonte: "programacao";
  tolerancias: { antes: number; depois: number; sem_inicio: number };
  feriado_considerado: boolean;
  linhas: { id: string; codigo: string; nome: string | null }[];
  viagens: ViagemMonitor[];
};

export type LinhaProdutiva = {
  linha: number;
  descricao: string | null;
  viagens: number;
  ida: number;
  volta: number;
  km: number;
  horas: number;
  minutos_medio: number | null;
  kml: number | null;
  veiculos: number;
  motoristas: number;
  eventos: number;
};

export type ViagemProdutiva = {
  linha: number | null;
  linhaDescricao: string | null;
  sentido: "ida" | "volta" | null;
  numero: number | null;
  produtiva: boolean;
  inicio: string;
  fim: string | null;
  minutos: number;
  km: number;
  kml: number | null;
  veiculo: string | null;
  placa: string | null;
  unit_id: number;
  motorista: string | null;
  origem: string | null;
  destino: string | null;
  vel_max: number | null;
  eventos: number;
};

export type Produtivas = {
  inicio: string;
  fim: string;
  total: number;
  produtivas?: number;
  veiculos?: number;
  motoristas?: number;
  truncado?: boolean;
  por_linha: LinhaProdutiva[];
  viagens: ViagemProdutiva[];
};

const qs = (p: Record<string, string | number | boolean | undefined>) => {
  const e = Object.entries(p).filter(([, v]) => v !== undefined && v !== "");
  return e.length ? "?" + new URLSearchParams(e.map(([k, v]) => [k, String(v)])) : "";
};

const semRepetir = (n: number, e: unknown) => {
  const s = (e as { status?: number })?.status;
  return s !== 401 && s !== 403 && s !== 503 && n < 2;
};

export const monitorQuery = (dia: string, linhaId?: string, tol?: { antes: number; depois: number }) =>
  queryOptions({
    queryKey: chaveComGrupo("operacao", "monitor", dia, linhaId ?? "", tol?.antes ?? 5, tol?.depois ?? 7),
    queryFn: () =>
      api.get<MonitorDia>(
        `/api/v1/operacao/monitor${qs({ ...filtroGrupo(), dia, linha_id: linhaId, tolerancia_antes: tol?.antes, tolerancia_depois: tol?.depois })}`,
      ),
    enabled: !usandoMock(),
    retry: semRepetir,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

export const produtivasQuery = (dia: string, linha?: string, todas = false) =>
  queryOptions({
    queryKey: chaveComGrupo("operacao", "produtivas", dia, linha ?? "", todas ? 1 : 0),
    queryFn: () =>
      api.get<Produtivas>(
        `/api/v1/operacao/produtivas${qs({ ...filtroGrupo(), inicio: dia, linha, incluir_nao_produtivas: todas || undefined })}`,
      ),
    enabled: !usandoMock(),
    retry: semRepetir,
    staleTime: 60_000,
  });
