import { queryOptions } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { usandoMock } from "@/lib/modo";

/**
 * Chamados de suporte (Zendesk). O backend usa o e-mail do usuário logado
 * como solicitante e, enquanto a integração não estiver ligada, registra o
 * chamado localmente e avisa (`integrado: false`).
 */

export type ServicosSuporte = {
  integrado: boolean;
  padrao: string;
  prioridades: { valor: string; rotulo: string }[];
  grupos: { nome: string; servicos: string[] }[];
};

export type Chamado = {
  id: number | string;
  assunto: string;
  status: string;
  status_codigo: string;
  prioridade: string;
  criado_em: string;
  atualizado_em: string;
  descricao?: string | null;
  anexo?: string | null;
};

export type Resposta = {
  autor: string;
  do_suporte: boolean;
  texto: string;
  em: string;
  anexos: { nome: string; url: string }[];
};

export const servicosSuporteQuery = () =>
  queryOptions({
    queryKey: ["suporte", "servicos"],
    queryFn: () => api.get<ServicosSuporte>("/api/v1/suporte/servicos"),
    enabled: !usandoMock(),
    staleTime: 60 * 60_000,
  });

export const meusChamadosQuery = () =>
  queryOptions({
    queryKey: ["suporte", "chamados"],
    queryFn: () => api.get<{ integrado: boolean; chamados: Chamado[] }>("/api/v1/suporte/chamados"),
    enabled: !usandoMock(),
    staleTime: 60_000,
  });

export const respostasQuery = (id: number | string | null) =>
  queryOptions({
    queryKey: ["suporte", "respostas", String(id)],
    queryFn: () => api.get<{ respostas: Resposta[] }>(`/api/v1/suporte/chamados/${id}/respostas`),
    enabled: !usandoMock() && id != null,
    staleTime: 60_000,
  });

export const abrirChamado = (dados: {
  assunto: string;
  descricao: string;
  prioridade: string;
  anexo?: { nome: string; tipo: string; base64: string } | null;
  contexto?: Record<string, string>;
}) => api.post<{ id: number | string; integrado: boolean; status: string }>("/api/v1/suporte/chamados", dados);

/** Texto amigável a partir do erro da API (o FastAPI devolve {"detail": "..."}). */
export function mensagemErro(e: unknown): string {
  if (e instanceof ApiError) {
    try {
      const d = JSON.parse(e.message)?.detail;
      if (typeof d === "string") return d;
      if (Array.isArray(d)) return "Confira os campos: a descrição precisa ter pelo menos 10 letras.";
    } catch {
      /* não era JSON */
    }
    return e.status >= 500 ? "O servidor não respondeu. Tente de novo em instantes." : e.message;
  }
  return "Não foi possível falar com o servidor. Verifique a internet e tente de novo.";
}

export function arquivoParaBase64(f: File): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => erro(r.error);
    r.readAsDataURL(f);
  });
}
