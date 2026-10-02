import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";

/**
 * Jornada do motorista (ss-fleet-core, endpoints/jornada.py): Lei do
 * Motorista, escala planejada × realizada e espelho de ponto. A jornada vem
 * da telemetria (trechos com motorista identificado) ou do diário de bordo,
 * quando o cliente usa.
 */

export type Infracao = { regra: "direcao_continua" | "descanso" | "jornada" | "refeicao" | "interjornada"; titulo: string; detalhe: string };

export type Jornada = {
  inicio: string;
  fim: string;
  jornada_h: number;
  direcao_h: number;
  extra_h: number;
  noturno_h: number;
  maior_direcao_continua_min: number;
  maior_direcao_sem_descanso_min?: number;
  maior_pausa_min: number;
  pausas: { de: string; ate: string; min: number }[];
  interjornada_h: number | null;
  veiculos: string[];
  infracoes: Infracao[];
  a_conferir: boolean;
  fonte: "telemetria" | "diario";
  entrada_diario?: string;
  saida_diario?: string | null;
  nome: string;
};

export type ComparacaoEscala = {
  situacao: "no_horario" | "atrasou" | "fora_do_horario" | "falta" | "nao_escalado";
  planejado?: string;
  atraso_min?: number;
  saida_min?: number;
} | null;

export type Justificativa = { motivo: string; texto: string | null; folga: number } | null;

export type LinhaDia = { driver_id: number; nome: string; jornada: Jornada | null; escala: ComparacaoEscala; justificativa: Justificativa };

export type JornadaDia = {
  dia: string;
  operacao: "carga" | "passageiros";
  regra: { jornada_h: number; extra_max_h: number; extra_convencao_h?: number; direcao_continua_min: number; descanso_a_cada_min?: number; descanso_min?: number; refeicao_min: number; interjornada_h: number };
  pausa_min: number;
  motivos: string[];
  totais: {
    motoristas: number;
    com_infracao: number;
    a_conferir: number;
    trechos_sem_identificacao: number;
    infracoes: Partial<Record<Infracao["regra"], number>>;
    extra_h: number;
    faltas: number;
    fora_escala: number;
    escalados: number;
  };
  linhas: LinhaDia[];
};

export type Espelho = {
  driver_id: number;
  nome: string | null;
  inicio: string;
  fim: string;
  dias: { dia: string; jornada: Jornada | null; escala: ComparacaoEscala; justificativa: Justificativa }[];
  totais: { dias_trabalhados: number; jornada_h: number; direcao_h: number; extra_h: number; noturno_h: number; infracoes: number; faltas: number };
};

export type EscalaItem = { id: number; driver_id: number; dia: string; inicio: string; fim: string; unit_id: number | null; linha: string | null; obs: string | null };

const B = "/api/v1/jornada";
const ativo = (g?: string) => !usandoMock() && Boolean(g);

export const jornadaDiaQuery = (g: string | undefined, dia: string) =>
  queryOptions({
    queryKey: ["jornada", "dia", g ?? "", dia],
    queryFn: () => api.get<JornadaDia>(`${B}/dia?group_id=${g}&dia=${dia}`),
    enabled: ativo(g),
    staleTime: 2 * 60_000,
  });

export const espelhoQuery = (g: string | undefined, driver: number | null, inicio: string, fim: string) =>
  queryOptions({
    queryKey: ["jornada", "espelho", g ?? "", driver ?? "", inicio, fim],
    queryFn: () => api.get<Espelho>(`${B}/espelho?group_id=${g}&driver_id=${driver}&inicio=${inicio}&fim=${fim}`),
    enabled: ativo(g) && driver != null,
    staleTime: 5 * 60_000,
  });

export const motoristasJornadaQuery = (g?: string) =>
  queryOptions({
    queryKey: ["jornada", "motoristas", g ?? ""],
    queryFn: () => api.get<{ id: number; nome: string; matricula: string | null }[]>(`${B}/motoristas?group_id=${g}`),
    enabled: ativo(g),
    staleTime: 30 * 60_000,
  });

export const escalaQuery = (g: string | undefined, inicio: string, fim: string) =>
  queryOptions({
    queryKey: ["jornada", "escala", g ?? "", inicio, fim],
    queryFn: () => api.get<EscalaItem[]>(`${B}/escala?group_id=${g}&inicio=${inicio}&fim=${fim}`),
    enabled: ativo(g),
  });

export const JornadaApi = {
  salvarEscala: (d: { group_id: number; driver_id: number; dias: string[]; inicio: string; fim: string; linha?: string | null; obs?: string | null }) =>
    api.post<{ dias: number }>(`${B}/escala`, d),
  apagarEscala: (g: string, driver: number, dia: string) => api.del(`${B}/escala?group_id=${g}&driver_id=${driver}&dia=${dia}`),
  justificar: (d: { group_id: number; driver_id: number; dia: string; motivo: string; texto?: string | null; folga?: boolean }) =>
    api.post<{ ok: boolean }>(`${B}/justificativa`, d),
};
