import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";

/**
 * Manutenção por risco (ss-fleet-core, endpoints/manutencao_risco.py):
 * inspeção priorizada, alertas por tendência e linha do tempo de causa raiz.
 * Sem "previsão de quebra": não chega código de falha (DTC) nem há histórico
 * de corretivas — o que existe é evidência e tendência.
 */

export type Motivo = {
  pontos: number;
  texto: string;
  tipo: "alerta" | "plano" | "tendencia" | "conducao";
};
export type Tendencia = {
  chave: "bateria" | "temperatura" | "consumo";
  titulo: string;
  detalhe: string;
  por_dia: number | null;
};

export type VeiculoRisco = {
  unit_id: number;
  placa: string;
  prefixo: string | null;
  modelo: string | null;
  categoria_id: number | null;
  categoria: string | null;
  risco: number;
  classe: "alto" | "medio" | "baixo";
  motivos: Motivo[];
  tendencias: Tendencia[];
  conducao: {
    eventos_100km: number;
    percentil: number | null;
    km_30d: number;
    freadas: number;
    aceleracoes: number;
    embreagem: number;
  } | null;
  alertas: number;
  vencidos: number;
  ordens_abertas: number;
};

export type RespostaRisco = {
  veiculos: VeiculoRisco[];
  resumo: { alto: number; medio: number; baixo: number };
  pesos: Record<string, number>;
  dias_tendencia: number;
  gerado_em: string;
};

export type DiaCausaRaiz = {
  dia: string;
  /** Hoje: o consolidado de km e consumo só sai amanhã. */
  em_andamento?: boolean;
  km: number | null;
  horas: number | null;
  km_l: number | null;
  motoristas: string | null;
  temp_max: number | null;
  v_repouso: number | null;
  v_carga: number | null;
  rpm_max: number | null;
  arla_min: number | null;
  eventos: { evento: string; n: number }[];
  camera: { evento: string; n: number }[];
  alarmes: { evento: string; n: number }[];
  servicos: { data: string; servico: string; oficina: string | null; obs: string | null }[];
};

export type RespostaCausaRaiz = {
  veiculo: { id: number; placa: string; prefixo: string | null };
  inicio: string;
  fim: string;
  dias: DiaCausaRaiz[];
  pontos_de_atencao: string[];
  ordens: {
    id: number;
    aberta_em: string;
    concluida_em: string | null;
    status: string;
    tipo: string;
    titulo: string;
  }[];
  aviso: string;
};

const B = "/api/v1/manutencao-risco";

export const riscoQuery = (g?: string) =>
  queryOptions({
    queryKey: ["manut", "risco", g ?? ""],
    queryFn: () => api.get<RespostaRisco>(`${B}/painel?group_id=${g}`),
    enabled: !usandoMock() && Boolean(g),
    staleTime: 15 * 60_000,
  });

export const causaRaizQuery = (unitId: number | null, ate: string, dias: number) =>
  queryOptions({
    queryKey: ["manut", "causa-raiz", unitId, ate, dias],
    queryFn: () => api.get<RespostaCausaRaiz>(`${B}/causa-raiz/${unitId}?ate=${ate}&dias=${dias}`),
    enabled: !usandoMock() && unitId != null,
  });
