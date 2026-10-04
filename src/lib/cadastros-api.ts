import { api } from "@/lib/api";

/**
 * Cadastros (ss-fleet-core, endpoints/cadastros.py): leitura do banco e
 * gravação provisória na plataforma, com as regras do sistema atual.
 */

export type TipoCadastro =
  | "empresa" | "subgrupo" | "garagem" | "veiculo" | "dispositivo" | "vinculo"
  | "usuario" | "alarme" | "cerca" | "poi" | "ponto_parada" | "linha";

export type Registro = Record<string, unknown> & {
  id: string;
  origem_id: number | null;
  origem: "banco" | "plataforma";
  provisorio: boolean;
  editado_em?: string;
};

export type Opcao = { id: number | string; nome: string; [k: string]: unknown };
export type Opcoes = {
  subgrupos: Opcao[]; tipos_veiculo: Opcao[]; categorias: (Opcao & { tipo_id: number })[]; motoristas: Opcao[];
  fabricantes: Opcao[]; modelos: (Opcao & { fabricante_id: number })[]; produtos: (Opcao & { codigo: string })[]; operadoras: string[];
  motivos_remocao: Opcao[]; categorias_cerca: Opcao[]; categorias_poi: Opcao[];
  parametros_alarme: (Opcao & { tipo_id: number; operadores: string | null; nomes_operadores: string | null })[];
  eventos: Opcao[]; modalidades_linha: Opcao[]; veiculos: Opcao[]; dispositivos: (Opcao & { placa: string | null })[];
  account_id: number | null;
};

export const CadastrosApi = {
  listar: (tipo: TipoCadastro, g: string) =>
    api.get<{ data: Registro[]; total: number; provisorios: number }>(`/api/v1/cadastros/${tipo}?group_id=${g}`),
  opcoes: (g: string) => api.get<Opcoes>(`/api/v1/cadastros/opcoes/todas?group_id=${g}`),
  criar: (tipo: TipoCadastro, g: string, dados: Record<string, unknown>) =>
    api.post<{ id: string; avisos: string[] }>(`/api/v1/cadastros/${tipo}`, { group_id: Number(g), dados }),
  editar: (tipo: TipoCadastro, g: string, id: string, dados: Record<string, unknown>) =>
    api.put<{ id: string; avisos: string[] }>(`/api/v1/cadastros/${tipo}/${id}`, { group_id: Number(g), dados }),
  excluir: (tipo: TipoCadastro, g: string, id: string, motivo?: string) =>
    api.post<{ ok: boolean }>(`/api/v1/cadastros/${tipo}/${id}/excluir`, { group_id: Number(g), dados: {}, motivo }),
};
