import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";

/**
 * Contratos dos clientes (ss-fleet-core, endpoints/contratos.py).
 *
 * Todo cliente tem um contrato. Grupo novo só nasce de um contrato novo. Os
 * contratos dos clientes que já existiam vêm pré-preenchidos e não têm campo
 * obrigatório: o time completa à mão. O sistema nunca encerra contrato
 * sozinho: passar do fim só marca "vencido".
 */

export type DadosContrato = Partial<{
  nome_grupo: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  segmento: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  codigo_cliente: string;
  contato_nome: string;
  contato_email: string;
  contato_telefone: string;
  financeiro_nome: string;
  financeiro_email: string;
  financeiro_telefone: string;
  numero_contrato: string;
  data_assinatura: string;
  data_inicio: string;
  data_fim: string;
  tempo_meses: number;
  renovacao_automatica: boolean;
  aviso_previo_dias: number;
  indice_reajuste: string;
  mes_reajuste: string;
  qtd_veiculos: number;
  produtos: string[];
  equipamento_comodato: boolean;
  valor_parcela: number;
  valor_implantacao: number;
  valor_total: number;
  forma_pagamento: string;
  dia_vencimento: number;
  pro_rata: boolean;
  gasto_medio_combustivel_mes: number;
  custo_medio_combustivel_l: number;
  reducao_estimada_pct: number;
  vendedor: string;
  observacoes: string;
}>;

export type StatusContrato = "ativo" | "suspenso" | "encerrado";

export type Contrato = {
  id: number;
  group_id: number | null;
  origem: "existente" | "novo";
  status: StatusContrato;
  motivo_status: string | null;
  criado_em: string;
  atualizado_em: string;
  dados: DadosContrato;
  tempo_meses_calc: number | null;
  valor_total_calc: number | null;
  valor_por_veiculo: number | null;
  dias_para_vencer: number | null;
  vencido: boolean;
  pendencias: string[];
  veiculos_hoje: number | null;
  sem_veiculos: boolean;
  grupo_a_criar: boolean;
};

export type RespostaContratos = {
  contratos: Contrato[];
  criados_agora: number;
  resumo: {
    total: number;
    ativos: number;
    encerrados: number;
    vencidos: number;
    a_completar: number;
    grupos_a_criar: number;
    sem_veiculos: number;
    receita_mensal: number;
  };
  opcoes: { segmentos: string[]; produtos: string[]; reajustes: string[]; pagamentos: string[] };
};

const B = "/api/v1/contratos";

export const contratosQuery = () =>
  queryOptions({
    queryKey: ["contratos"],
    queryFn: () => api.get<RespostaContratos>(B),
    enabled: !usandoMock(),
  });

export const contratoDoGrupoQuery = (g?: string) =>
  queryOptions({
    queryKey: ["contratos", "grupo", g ?? ""],
    queryFn: () => api.get<Contrato>(`${B}/do-grupo?group_id=${g}`),
    enabled: !usandoMock() && Boolean(g),
  });

export const Contratos = {
  criar: (dados: DadosContrato) => api.post<{ id: number; aviso: string }>(B, { dados }),
  editar: (id: number, dados: DadosContrato, motivo?: string) =>
    api.put<Contrato>(`${B}/${id}`, { dados, motivo }),
  status: (id: number, status: StatusContrato, motivo?: string) =>
    api.post<Contrato>(`${B}/${id}/status`, { dados: { status }, motivo }),
};
