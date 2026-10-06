import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";

/**
 * Estoque de equipamentos (ss-fleet-core, endpoints/estoque.py).
 *
 * Cada serial expedido: onde está (placa ao vivo do banco), em que situação e a
 * qual contrato ou aditivo pertence. Regra: especificação do MVP de Controle de
 * Estoque (Operações, 06/10/2026).
 */

export type StatusEquip = "ativo" | "estoque" | "manutencao" | "devolucao";
export type CodigoAlerta = "M" | "C" | "S" | "T" | "P" | "D";

export type Equipamento = {
  id: number;
  serial: string;
  modelo: string;
  tipo: "rastreador" | "camera";
  cliente: string;
  status: StatusEquip;
  subtipo: "desinstalado" | "matriz" | null;
  explicacao: string;
  origem_status: "calculado" | "manual";
  placa: string | null;
  grupo_placa: string | null;
  placa_anterior: string | null;
  retirado_em: string | null;
  ultima_leitura: string | null;
  leitura_planilha: string | null;
  no_cadastro: boolean;
  contrato_id: number | null;
  contrato_numero: string | null;
  contrato_nome: string | null;
  aditivo_id: number | null;
  aditivo_numero: string | null;
  vinculo: "automatico" | "manual" | null;
  alertas: { codigo: CodigoAlerta; texto: string }[];
  nf: string | null;
  motivo: string | null;
  chamado: string | null;
  origem: string;
};

export type ClienteEstoque = {
  cliente: string;
  total: number;
  ativo: number;
  estoque: number;
  manutencao: number;
  devolucao: number;
  group_id: number | null;
  grupo: string | null;
  como_ligado: "placas" | "nome" | "manual" | "sem_grupo";
  contrato_id: number | null;
};

export type ContratoEstoque = {
  id: number;
  numero: string;
  nome: string | null;
  status: "ativo" | "suspenso" | "encerrado";
  fim: string | null;
  vencido: boolean;
  contratado: number | null;
  rastreadores: number;
  cameras: number;
  saldo_rastreadores: number | null;
  saldo_cameras: number | null;
  acima: boolean;
  aditivos: { id: number; numero: string; qtd: number; tipo: "inclusao" | "retirada" }[];
};

export type RespostaEstoque = {
  itens: Equipamento[];
  clientes: ClienteEstoque[];
  contratos: ContratoEstoque[];
  resumo: {
    total: number;
    ativo?: number;
    estoque?: number;
    manutencao?: number;
    devolucao?: number;
    com_alerta: number;
    sem_contrato: number;
  };
  atualizado_em: string;
};

export type Movimento = { id: number; tipo: string; texto: string; em: string };

const B = "/api/v1/estoque";

export const estoqueQuery = () =>
  queryOptions({
    queryKey: ["estoque"],
    queryFn: () => api.get<RespostaEstoque>(B),
    enabled: !usandoMock(),
    staleTime: 60_000,
  });

export const historicoSerialQuery = (id: number | null) =>
  queryOptions({
    queryKey: ["estoque", "historico", id],
    queryFn: () => api.get<{ data: Movimento[] }>(`${B}/${id}/historico`),
    enabled: id != null,
  });

export type AcaoLancamento =
  | "manutencao"
  | "concluir_manutencao"
  | "devolucao"
  | "confirmar_devolucao"
  | "cancelar_devolucao"
  | "vincular";

export const Estoque = {
  expedir: (d: {
    cliente: string;
    contrato_id: number;
    aditivo_id?: number | null;
    modelo: string;
    seriais: string;
    nf?: string;
  }) =>
    api.post<{
      expedidos: string[];
      ignorados: string[];
      ja_no_cliente: string[];
      aviso: string | null;
    }>(`${B}/expedicao`, d),
  lancar: (
    id: number,
    d: {
      acao: AcaoLancamento;
      motivo?: string;
      chamado?: string;
      nf?: string;
      contrato_id?: number | null;
      aditivo_id?: number | null;
    },
  ) => api.post<{ ok: boolean; texto: string }>(`${B}/${id}/lancamento`, d),
};

/** Modelos aceitos na expedição (nomes da planilha de expedição). */
export const MODELOS_EXPEDICAO = [
  "VIRLOC 6",
  "VIRLOC 8",
  "VIRLOC 11",
  "JIMI JC450",
  "MV 03",
  "G40 PRO",
  "G40 BASICA",
  "ST310",
  "ST340",
  "MXT 140",
  "MXT 150",
  "MXT 151",
  "GV75MG",
  "VL CONE",
];

export const ROTULO_ALERTA: Record<CodigoAlerta, string> = {
  M: "Modelo divergente",
  C: "Cliente diverge",
  S: "Placa do grupo SS",
  T: "Transmitindo sem placa",
  P: "Placa sem comunicação",
  D: "Ligado a veículo desativado",
};
