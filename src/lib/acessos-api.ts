import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";

/**
 * Acessos à plataforma (exclusivo SS). Fonte: `mova.session` do sistema
 * antigo, só pessoas — integrações vêm separadas. Ver ss-fleet-core,
 * endpoints/acessos.py.
 */

export type PessoaAcesso = {
  user_id: number;
  nome: string;
  login: string;
  group_id: number | null;
  empresa: string;
  acessos: number;
  dias: number;
  ultimo: string;
  dispositivo: "computador" | "celular" | "tablet";
  navegador: string;
  ss: boolean;
};

export type EmpresaAcesso = {
  group_id: number | null;
  nome: string;
  pessoas: number;
  cadastrados: number | null;
  adocao_pct: number | null;
  acessos: number;
  dias_por_pessoa: number;
  ultimo: string;
};

export type PainelAcessos = {
  periodo: { inicio: string; fim: string; dias: number; anterior: { inicio: string; fim: string } };
  totais: {
    pessoas: number;
    acessos: number;
    dias_pessoa: number;
    empresas: number;
    acessos_por_pessoa_dia: number | null;
    dias_por_pessoa: number | null;
    anterior: { pessoas: number; acessos: number };
    sumidos: number;
  };
  /** dia: 1 = segunda … 7 = domingo (ISO). */
  matriz: { dia: number; hora: number; acessos: number; pessoas: number }[];
  por_dia: { dia: string; acessos: number; pessoas: number }[];
  pessoas: PessoaAcesso[];
  empresas: EmpresaAcesso[];
  dispositivos: { dispositivo: string; navegador: string; acessos: number; pessoas: number }[];
  integracoes: { user_id: number; nome: string; empresa: string; tipo: string; acessos: number; ultimo: string }[];
  sumidos: { user_id: number; nome: string; login: string; empresa: string; ultimo: string; dias_antes: number }[];
};

export type DetalhePessoa = {
  usuario: { id: number; nome: string; login: string; email: string | null; empresa: string; ativo: boolean };
  matriz: { dia: number; hora: number; acessos: number }[];
  por_dia: { dia: string; acessos: number }[];
  ultimos: { em: string; dispositivo: string; navegador: string }[];
};

const qs = (o: Record<string, string | number | boolean | undefined | null>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

export const painelAcessosQuery = (f: { inicio: string; fim: string; grupo?: string; incluirSS: boolean }) =>
  queryOptions({
    queryKey: ["acessos", "painel", f.inicio, f.fim, f.grupo ?? "", f.incluirSS],
    queryFn: () =>
      api.get<PainelAcessos>(`/api/v1/acessos/painel?${qs({ inicio: f.inicio, fim: f.fim, group_id: f.grupo, incluir_ss: f.incluirSS })}`),
    enabled: !usandoMock(),
    staleTime: 5 * 60_000,
  });

export const detalhePessoaQuery = (id: number | null, f: { inicio: string; fim: string }) =>
  queryOptions({
    queryKey: ["acessos", "pessoa", id, f.inicio, f.fim],
    queryFn: () => api.get<DetalhePessoa>(`/api/v1/acessos/pessoa/${id}?${qs({ inicio: f.inicio, fim: f.fim })}`),
    enabled: !usandoMock() && id != null,
    staleTime: 5 * 60_000,
  });
