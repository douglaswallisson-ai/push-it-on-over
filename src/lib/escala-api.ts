import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";

/**
 * Escala de Viagem — plano declarado à gerenciadora de risco × realizado pelo
 * rastreador. O plano fica num armazenamento provisório do backend (o banco de
 * produção é só leitura); o realizado vem das paradas e do último sinal.
 */

export type TipoPonto = "origem" | "destino" | "posto" | "lanchonete" | "pernoite" | "carga" | "descarga";

export const ROTULO_TIPO: Record<TipoPonto, string> = {
  origem: "Origem",
  destino: "Destino",
  posto: "Posto credenciado",
  lanchonete: "Lanchonete autorizada",
  pernoite: "Pátio de pernoite",
  carga: "Carregamento",
  descarga: "Descarga",
};

export type PontoPlano = {
  tipo: TipoPonto;
  nome: string;
  poi_id?: number | null;
  latitude: number;
  longitude: number;
  raio_m: number;
  previsto?: string | null;
};

export type Destinatario = { nome: string; papel?: string | null; email?: string | null };

export type ParadaReal = {
  inicio: string;
  fim: string | null;
  em_andamento: boolean;
  minutos: number;
  latitude: number;
  longitude: number;
  endereco: string | null;
  poi_proximo: string | null;
  conforme: boolean;
  ponto: string | null;
  tipo: TipoPonto | null;
  ponto_mais_proximo: string | null;
  distancia_ponto_m: number | null;
};

export type Ocorrencia = {
  id: string;
  tipo: "parada_fora_de_ponto" | "atraso";
  titulo: string;
  inicio: string;
  em_andamento: boolean;
  minutos: number;
  latitude?: number;
  longitude?: number;
  endereco?: string | null;
  ponto_mais_proximo?: string | null;
  distancia_ponto_m?: number | null;
  notificacao: string;
  destinatarios: string[];
};

export type Realizado = {
  situacao: "aguardando_saida" | "em_rota" | "concluida" | "cancelada";
  com_desvio: boolean;
  saida_real: string | null;
  chegada_real: string | null;
  km: number;
  vel_max: number;
  paradas: ParadaReal[];
  paradas_cumpridas: number;
  paradas_previstas: number;
  ocorrencias: Ocorrencia[];
  motoristas_identificados: string[];
  ultimo_sinal: { hora: string | null; latitude: number | null; longitude: number | null; velocidade: number | null; endereco: string | null };
};

export type Viagem = {
  id: number;
  codigo: string;
  group_id: number;
  unit_id: number;
  motorista: string | null;
  rota_nome: string | null;
  rodovia: string | null;
  carga_cliente: string | null;
  carga_descricao: string | null;
  carga_valor: number | null;
  saida_prevista: string;
  chegada_prevista: string;
  pontos: PontoPlano[];
  destinatarios: Destinatario[];
  status_gr: "aguardando" | "aprovada" | "reprovada";
  observacao?: string | null;
  cancelada?: boolean;
  historico?: { em: string; por: number | null; mudou: string[] }[];
  veiculo?: { id: number; label: string; label2: string | null; model: string | null } | null;
  realizado: Realizado;
  gerado_em?: string;
};

export type PoiEscala = { id: number; nome: string; latitude: number; longitude: number; raio_m: number };
export type RotaPadrao = { id: number; nome: string; pontos: PontoPlano[]; destinatarios: Destinatario[] };

const ativo = (g?: string) => !usandoMock() && Boolean(g);

export const escalaDiaQuery = (grupo: string | undefined, dia: string) =>
  queryOptions({
    queryKey: ["escala", "dia", grupo ?? "", dia],
    queryFn: () => api.get<{ dia: string; viagens: Viagem[] }>(`/api/v1/escala-viagem/viagens?group_id=${grupo}&dia=${dia}`),
    enabled: ativo(grupo),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

export const escalaIndicadoresQuery = (grupo: string | undefined) =>
  queryOptions({
    queryKey: ["escala", "indicadores", grupo ?? ""],
    queryFn: () =>
      api.get<{ mes: string; concluidas: number; conformes: number; conformidade_pct: number | null; meta_pct: number }>(
        `/api/v1/escala-viagem/indicadores?group_id=${grupo}`,
      ),
    enabled: ativo(grupo),
    staleTime: 5 * 60_000,
  });

export const escalaPoisQuery = (grupo: string | undefined) =>
  queryOptions({
    queryKey: ["escala", "pois", grupo ?? ""],
    queryFn: () => api.get<PoiEscala[]>(`/api/v1/escala-viagem/pois?group_id=${grupo}`),
    enabled: ativo(grupo),
    staleTime: 30 * 60_000,
  });

export const escalaRotasQuery = (grupo: string | undefined) =>
  queryOptions({
    queryKey: ["escala", "rotas", grupo ?? ""],
    queryFn: () => api.get<RotaPadrao[]>(`/api/v1/escala-viagem/rotas?group_id=${grupo}`),
    enabled: ativo(grupo),
    staleTime: 5 * 60_000,
  });

export const Escala = {
  criar: (dados: Record<string, unknown>) => api.post<{ id: number; codigo: string }>(`/api/v1/escala-viagem/viagens`, dados),
  alterar: (id: number, dados: Record<string, unknown>) =>
    api.patch<{ ok: boolean }>(`/api/v1/escala-viagem/viagens/${id}`, dados),
  salvarRota: (dados: Record<string, unknown>) => api.post<{ id: number }>(`/api/v1/escala-viagem/rotas`, dados),
};
