import { gravar, ler, limpar } from "@/lib/session";

/**
 * Autenticação contra a API real (`ss-fleet-core`).
 *
 * Substitui o login que validava no navegador. O fluxo é o padrão do backend:
 *
 *     POST /auth/login    → access token (curto) + refresh token (longo)
 *     POST /auth/refresh  → novo access, sem pedir senha de novo
 *     GET  /auth/me       → dados do usuário
 *     POST /auth/logout   → invalida o refresh no Redis
 *
 * O access token vai em `Authorization: Bearer` a cada requisição. Quando
 * expira, o cliente renova sozinho e repete a chamada — o usuário não percebe.
 */

const BASE = (import.meta.env.VITE_API_BASE as string) || "";
const V1 = `${BASE}/api/v1`;

type Tokens = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  /** Instante calculado de expiração, para renovar antes de falhar. */
  expira_em: number;
};

const CHAVE = "auth-tokens";

export const lerTokens = () => ler<Tokens | null>(CHAVE, null);
const gravarTokens = (t: Omit<Tokens, "expira_em">) =>
  gravar(CHAVE, { ...t, expira_em: Date.now() + t.expires_in * 1000 });

/**
 * Renovação em andamento.
 *
 * Sem isto, várias requisições que recebem 401 ao mesmo tempo disparariam
 * vários refresh em paralelo — e o backend invalida o refresh anterior a cada
 * uso, então todas menos uma falhariam. Compartilhar a promessa resolve.
 */
let renovacaoEmCurso: Promise<string | null> | null = null;

export class ErroAutenticacao extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ErroAutenticacao";
  }
}

export async function entrarNaApi(login: string, senha: string) {
  const resp = await fetch(`${V1}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login, password: senha }),
  });

  if (!resp.ok) {
    const detalhe = await resp.json().catch(() => ({}));
    throw new ErroAutenticacao(
      resp.status === 401
        ? "Usuário ou senha incorretos."
        : resp.status === 403
          ? "Este usuário está desativado."
          : detalhe.detail || "Não foi possível entrar.",
      resp.status,
    );
  }

  const tokens = await resp.json();
  gravarTokens(tokens);

  // Busca o perfil logo após entrar: o login devolve só os tokens, e a
  // interface precisa do nome e da conta para montar a sessão.
  const perfil = await buscarPerfil();
  return { tokens, perfil };
}

export async function buscarPerfil() {
  const resp = await requisicaoAutenticada(`${V1}/auth/me`);
  if (!resp.ok) throw new ErroAutenticacao("Não foi possível carregar o perfil.", resp.status);
  return resp.json();
}

/** Renova o access token. Devolve `null` quando o refresh também expirou. */
async function renovar(): Promise<string | null> {
  const atual = lerTokens();
  if (!atual?.refresh_token) return null;

  try {
    const resp = await fetch(`${V1}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: atual.refresh_token }),
    });
    if (!resp.ok) return null;

    const novos = await resp.json();
    gravarTokens(novos);
    return novos.access_token;
  } catch {
    return null;
  }
}

/** Garante um access token válido, renovando com folga antes de expirar. */
async function tokenValido(): Promise<string | null> {
  const t = lerTokens();
  if (!t) return null;

  // 60 segundos de folga: renovar exatamente no vencimento deixaria
  // requisições em voo falharem.
  if (Date.now() < t.expira_em - 60_000) return t.access_token;

  renovacaoEmCurso ??= renovar().finally(() => {
    renovacaoEmCurso = null;
  });
  return renovacaoEmCurso;
}

/**
 * Requisição com token, renovando e repetindo uma vez em caso de 401.
 *
 * A repetição é única de propósito: se o segundo 401 vier, o problema não é
 * token expirado e insistir viraria laço.
 */
export async function requisicaoAutenticada(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await tokenValido();

  const comToken = (t: string | null): RequestInit => ({
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });

  let resp = await fetch(url, comToken(token));

  if (resp.status === 401) {
    const novo = await (renovacaoEmCurso ??= renovar().finally(() => {
      renovacaoEmCurso = null;
    }));
    if (novo) resp = await fetch(url, comToken(novo));
  }

  return resp;
}

export async function sairDaApi() {
  const t = lerTokens();
  if (t?.refresh_token) {
    // Melhor esforço: se a chamada falhar, a sessão local é limpa do mesmo
    // jeito. Deixar o usuário preso por causa de rede seria pior.
    await fetch(`${V1}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t.access_token}`,
      },
      body: JSON.stringify({ refresh_token: t.refresh_token }),
    }).catch(() => undefined);
  }
  limpar(CHAVE);
}

export const temTokenValido = () => {
  const t = lerTokens();
  return Boolean(t && Date.now() < t.expira_em);
};
