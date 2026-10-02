import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";

/**
 * Manutenção preventiva e corretiva com dados reais (ss-fleet-core,
 * endpoints/manutencao.py). Odômetro e sinais do motor vêm do banco; planos,
 * serviços feitos e ordens de serviço ficam num armazenamento provisório do
 * servidor até a engenharia definir a tabela definitiva.
 */

export type Situacao = "vencido" | "vence_em_breve" | "sem_registro" | "em_dia";

export type ItemSituacao = {
  servico: string;
  intervalo_km: number | null;
  intervalo_dias: number | null;
  ultimo: { data: string; odometro_km: number | null } | null;
  situacao: Situacao;
  falta_km: number | null;
  falta_dias: number | null;
  proximo_km: number | null;
  proxima_data: string | null;
};

export type Alerta = { chave: string; titulo: string; nivel: "critico" | "atencao"; valor: string; detalhe: string };

export type Sinais = {
  temp: number | null;
  oleo: number | null;
  voltage: number | null;
  arla: number | null;
  combustivel: number | null;
  ar_freio: number | null;
  rpm: number | null;
};

export type VeiculoManut = {
  unit_id: number;
  placa: string | null;
  prefixo: string | null;
  modelo: string | null;
  ano: string | null;
  categoria_id: number | null;
  categoria: string | null;
  odometro_km: number | null;
  odometro_travado: boolean;
  ultimo_sinal: string | null;
  sinais: Sinais;
  plano: { id: number; nome: string; escopo: string } | null;
  itens: ItemSituacao[];
  vencidos: number;
  vencendo: number;
  sem_registro: number;
  alertas: Alerta[];
  ordens_abertas: number;
  alertas_com_os: string[];
};

export type PainelManut = {
  totais: {
    veiculos: number;
    odometro_travado: number;
    com_plano: number;
    itens_vencidos: number;
    veiculos_com_vencido: number;
    itens_vencendo: number;
    alertas_criticos: number;
    alertas: number;
    ordens_abertas: number;
  };
  limites: Record<string, number>;
  veiculos: VeiculoManut[];
};

export type ItemPlano = { servico: string; km: number | null; dias: number | null };
export type Plano = { id: number; group_id: number; nome: string; escopo: "categoria" | "modelo" | "veiculo"; alvo: string; itens: ItemPlano[] };
export type ModeloPlano = { id: string; nome: string; categorias: number[]; itens: ItemPlano[] };

export type StatusOS = "aberta" | "em_andamento" | "aguardando_peca" | "concluida" | "cancelada";
export type OrdemServico = {
  id: number;
  group_id: number;
  unit_id: number;
  tipo: "corretiva" | "preventiva";
  titulo: string;
  descricao: string | null;
  prioridade: "baixa" | "media" | "alta" | "critica";
  status: StatusOS;
  origem: string | null;
  aberta_em: string;
  concluida_em: string | null;
  custo: number | null;
  responsavel: string | null;
  historico: { em: string; por: number | null; status: string; nota: string | null }[];
};

export const ROTULO_STATUS_OS: Record<StatusOS, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  aguardando_peca: "Aguardando peça",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const B = "/api/v1/manutencao";
const ativo = (g?: string) => !usandoMock() && Boolean(g);

export const painelManutQuery = (g?: string) =>
  queryOptions({
    queryKey: ["manut", "painel", g ?? ""],
    queryFn: () => api.get<PainelManut>(`${B}/painel?group_id=${g}`),
    enabled: ativo(g),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

export const planosQuery = (g?: string) =>
  queryOptions({ queryKey: ["manut", "planos", g ?? ""], queryFn: () => api.get<Plano[]>(`${B}/planos?group_id=${g}`), enabled: ativo(g) });

export const modelosPlanoQuery = () =>
  queryOptions({ queryKey: ["manut", "modelos"], queryFn: () => api.get<ModeloPlano[]>(`${B}/modelos-plano`), enabled: !usandoMock(), staleTime: Infinity });

export const ordensQueryReal = (g?: string) =>
  queryOptions({ queryKey: ["manut", "ordens", g ?? ""], queryFn: () => api.get<OrdemServico[]>(`${B}/ordens?group_id=${g}`), enabled: ativo(g) });

export const historicoServicosQuery = (g?: string, unitId?: number | null) =>
  queryOptions({
    queryKey: ["manut", "servicos", g ?? "", unitId ?? ""],
    queryFn: () => api.get<{ id: number; servico: string; data: string; odometro_km: number | null; custo: number | null; oficina: string | null; obs: string | null }[]>(
      `${B}/servicos?group_id=${g}&unit_id=${unitId}`,
    ),
    enabled: ativo(g) && unitId != null,
  });

export const Manut = {
  salvarPlano: (dados: Omit<Plano, "id"> & { id?: number }) =>
    api.post<{ id: number }>(`${B}/planos${dados.id ? `?plano_id=${dados.id}` : ""}`, dados),
  apagarPlano: (id: number, g: string) => api.del(`${B}/planos/${id}?group_id=${g}`),
  registrarServico: (d: {
    group_id: number;
    unit_id: number;
    servico: string;
    data: string;
    odometro_km?: number | null;
    custo?: number | null;
    oficina?: string | null;
    obs?: string | null;
    ordem_id?: number | null;
  }) => api.post<{ id: number }>(`${B}/servicos`, d),
  abrirOrdem: (d: {
    group_id: number;
    unit_id: number;
    tipo: "corretiva" | "preventiva";
    titulo: string;
    descricao?: string;
    prioridade: OrdemServico["prioridade"];
    origem?: string;
    responsavel?: string;
  }) => api.post<{ id: number; ja_existia: boolean }>(`${B}/ordens`, d),
  mudarOrdem: (id: number, d: { group_id: number; status?: StatusOS; responsavel?: string; custo?: number; nota?: string }) =>
    api.patch<{ ok: boolean }>(`${B}/ordens/${id}`, d),
};
