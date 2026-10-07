import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";

/**
 * Rotas seguras (ss-fleet-core: areas_risco.py, roteirizacao.py /rotograma).
 *
 * Decisão do PM com o CEO (06/10/2026): o motor de rotas só desvia das áreas
 * que NÓS informamos. As áreas vêm das cercas com categoria "Área de Risco",
 * das cercas marcadas aqui e das desenhadas aqui; o rotograma mostra o que
 * fica perto da rota e o CCO avisa quando o veículo entra numa delas.
 */

export type NivelRisco = "evitar" | "atencao";
export const ROTULO_NIVEL: Record<NivelRisco, string> = { evitar: "Evitar", atencao: "Atenção" };
export const COR_NIVEL: Record<NivelRisco, string> = { evitar: "#d84a3a", atencao: "#d4a017" };

export type AreaRisco = {
  chave: string;
  nome: string;
  nivel: NivelRisco;
  motivo: string | null;
  origem: "categoria" | "marcada" | "desenhada";
  group_id: number;
  cerca_id?: number;
  area_id?: number;
  criado_por?: string | null;
  criado_em?: string | null;
  /** [[lat, lng], ...] por polígono. */
  poligonos: [number, number][][];
};

export type CercaParaMarcar = {
  id: number;
  nome: string;
  tipo: "circular" | "poligono" | "linha";
  categoria: string | null;
  nivel: NivelRisco | null;
  motivo: string | null;
  /** Já é risco pela categoria do sistema atual (não dá para desmarcar aqui). */
  por_categoria: boolean;
  poligonos: [number, number][][];
};

export type Programacao = {
  id: number;
  group_id: number;
  unit_id: number;
  veiculo?: string;
  nome: string;
  pontos: { nome: string; latitude: number; longitude: number }[];
  trajeto?: [number, number][];
  trajeto_pontos?: number;
  dias: number[];
  hora_ini: string;
  hora_fim: string;
  tolerancia_m: number;
  desvio_min: number;
  parada_max_min: number;
  ativo: boolean;
  em_execucao?: boolean;
  criado_por_nome?: string | null;
};

export type ItemRotograma = {
  tipo: "area_risco" | "atencao" | "velocidade" | "apoio" | "pedagio" | "pausa" | "critico";
  km: number;
  lat: number | null;
  lng: number | null;
  titulo: string;
  detalhe: string;
};

export const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const B = "/api/v1/areas-risco";
const ativo = () => !usandoMock();

export const areasRiscoQuery = (g?: string) =>
  queryOptions({
    queryKey: ["areas-risco", g ?? ""],
    queryFn: () => api.get<{ data: AreaRisco[] }>(`${B}/?group_id=${g}`),
    enabled: ativo() && Boolean(g),
    staleTime: 60_000,
  });

export const cercasParaMarcarQuery = (g?: string) =>
  queryOptions({
    queryKey: ["areas-risco", "cercas", g ?? ""],
    queryFn: () =>
      api.get<{ data: CercaParaMarcar[]; cortado: boolean }>(`${B}/cercas?group_id=${g}`),
    enabled: ativo() && Boolean(g),
    staleTime: 60_000,
  });

export const programacoesQuery = (g?: string) =>
  queryOptions({
    queryKey: ["programacao", g ?? ""],
    queryFn: () => api.get<{ data: Programacao[] }>(`${B}/programacao?group_id=${g}`),
    enabled: ativo() && Boolean(g),
    refetchInterval: 60_000,
  });

export const RotasSeguras = {
  marcarCerca: (cercaId: number, group_id: number, nivel: NivelRisco | null, motivo?: string) =>
    api.put<{ ok: boolean }>(`${B}/cercas/${cercaId}`, { group_id, nivel, motivo: motivo || null }),
  criarArea: (a: {
    group_id: number;
    nome: string;
    nivel: NivelRisco;
    motivo?: string;
    pontos: [number, number][];
  }) => api.post<{ id: number }>(`${B}/`, a),
  editarArea: (id: number, a: { nome?: string; nivel?: NivelRisco; motivo?: string }) =>
    api.put<{ ok: boolean }>(`${B}/${id}`, a),
  removerArea: (id: number) => api.del(`${B}/${id}`),
  verProgramacao: (id: number) => api.get<Programacao>(`${B}/programacao/${id}`),
  criarProgramacao: (p: Omit<Programacao, "id">) => api.post<{ id: number }>(`${B}/programacao`, p),
  editarProgramacao: (id: number, p: Omit<Programacao, "id">) =>
    api.put<{ ok: boolean }>(`${B}/programacao/${id}`, p),
  removerProgramacao: (id: number) => api.del(`${B}/programacao/${id}`),
};

/** Pedido do rotograma: o mesmo da roteirização, guardado para a aba do rotograma ler. */
export const CHAVE_ROTOGRAMA = "ss:rotograma:pedido";
