/**
 * Sessão e armazenamento local.
 *
 * Enquanto o back-end não existe, os dados criados pelas telas precisam sobreviver
 * à navegação — senão cadastrar um motorista e voltar para a lista faz o registro
 * sumir, que era o comportamento anterior.
 *
 * Guarda em `sessionStorage`: some ao fechar a aba, o que é o correto para dado
 * de protótipo. Quando a API entrar, cada `store.*` vira uma chamada HTTP e o
 * resto das telas não muda.
 *
 * Tudo aqui é client-only. Em SSR as funções retornam o valor inicial sem tocar
 * em `window`.
 */

import type { Perfil } from "@/lib/permissoes";

const isBrowser = typeof window !== "undefined";

/* ------------------------------------------------------------------ */
/* Persistência genérica com assinatura                                */
/* ------------------------------------------------------------------ */

type Ouvinte = () => void;
const ouvintes = new Map<string, Set<Ouvinte>>();

function notificar(chave: string) {
  ouvintes.get(chave)?.forEach((fn) => fn());
}

export function assinar(chave: string, fn: Ouvinte): () => void {
  if (!ouvintes.has(chave)) ouvintes.set(chave, new Set());
  ouvintes.get(chave)!.add(fn);
  return () => ouvintes.get(chave)?.delete(fn);
}

export function ler<T>(chave: string, padrao: T): T {
  if (!isBrowser) return padrao;
  try {
    const bruto = window.sessionStorage.getItem(`ss:${chave}`);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

export function gravar<T>(chave: string, valor: T): void {
  if (!isBrowser) return;
  try {
    window.sessionStorage.setItem(`ss:${chave}`, JSON.stringify(valor));
    notificar(chave);
  } catch {
    /* cota estourada ou modo privativo — segue sem persistir */
  }
}

export function limpar(chave: string): void {
  if (!isBrowser) return;
  window.sessionStorage.removeItem(`ss:${chave}`);
  notificar(chave);
}

/** Acrescenta um item ao início de uma coleção e devolve a lista nova. */
export function acrescentar<T>(chave: string, item: T): T[] {
  const atual = ler<T[]>(chave, []);
  const nova = [item, ...atual];
  gravar(chave, nova);
  return nova;
}

/* ------------------------------------------------------------------ */
/* Sessão de autenticação                                              */
/* ------------------------------------------------------------------ */

export type Sessao = {
  email: string;
  nome: string;
  perfil: Perfil;
  /** Organização de origem do usuário — não muda. */
  organizacao: string;
  organizacaoId: string;
  /**
   * Organização cujos dados estão sendo exibidos. Para todo mundo é igual à de
   * origem; só o super admin consegue apontar para outra.
   */
  organizacaoAtivaId: string;
  organizacaoAtiva: string;
  /**
   * Garagens que o usuário pode acessar. Vazio com perfil restrito significa
   * sem acesso a dado operacional. Ignorado para super admin e administrador
   * da organização, que veem todas.
   */
  garagens: string[];
  /** Garagem escolhida para focar a navegação. null = todas as do escopo. */
  garagemFocoId: string | null;
  entrouEm: string;
};

const CHAVE_SESSAO = "sessao";
const CHAVE_AUDITORIA = "auditoria";

export const lerSessao = (): Sessao | null => ler<Sessao | null>(CHAVE_SESSAO, null);

export const estaAutenticado = (): boolean => Boolean(lerSessao());

/**
 * Login de protótipo: valida formato e cria a sessão local.
 *
 * Não há verificação de senha porque não há servidor — o ponto aqui é que a
 * sessão passe a existir de fato, para o guard de rota funcionar e o "sair"
 * ter efeito. Trocar por chamada à API de autenticação depois.
 */
export function entrar(email: string, senha: string): { ok: boolean; erro?: string } {
  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  if (!emailValido) return { ok: false, erro: "Informe um e-mail válido." };
  if (senha.length < 4) return { ok: false, erro: "A senha precisa ter ao menos 4 caracteres." };

  const nome = email
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");

  // Enquanto não há servidor, quem entra com domínio da SS assume o perfil de
  // super admin. Trocar pela claim do token quando a API de auth existir.
  const interno = /@sstelematica\.com(\.br)?$/i.test(email.trim());
  const perfil: Perfil = interno ? "super_admin" : "admin_empresa";
  const org = interno ? "SS Telemática (interno)" : "Organização do usuário";
  const orgId = interno ? "ss-matriz" : "cliente";

  gravar<Sessao>(CHAVE_SESSAO, {
    email: email.trim(),
    nome: nome || "Usuário",
    perfil,
    organizacao: org,
    organizacaoId: orgId,
    organizacaoAtivaId: orgId,
    organizacaoAtiva: org,
    garagens: [],
    garagemFocoId: null,
    entrouEm: new Date().toISOString(),
  });
  registrarAuditoria("login", `Entrou no sistema como ${perfil}.`);
  return { ok: true };
}

export function sair(): void {
  registrarAuditoria("logout", "Encerrou a sessão.");
  limpar(CHAVE_SESSAO);
}

/* ------------------------------------------------------------------ */
/* Troca de organização (super admin)                                  */
/* ------------------------------------------------------------------ */

/**
 * Aponta a sessão para a base de outra organização. Antes o seletor só trocava
 * o rótulo na barra lateral — o comentário no código dizia "TODO: disparar
 * troca de contexto real aqui".
 */
export function trocarOrganizacao(id: string, nome: string): boolean {
  const s = lerSessao();
  if (!s) return false;
  if (s.perfil !== "super_admin" && id !== s.organizacaoId) return false;
  gravar<Sessao>(CHAVE_SESSAO, { ...s, organizacaoAtivaId: id, organizacaoAtiva: nome });
  registrarAuditoria("troca_organizacao", `Passou a visualizar a base de ${nome}.`, nome);
  return true;
}

/** true quando o super admin está olhando a base de outro cliente. */
export function estaVisitandoOutraOrg(): boolean {
  const s = lerSessao();
  return Boolean(s && s.organizacaoAtivaId !== s.organizacaoId);
}

/* ------------------------------------------------------------------ */
/* Escopo de garagem                                                   */
/* ------------------------------------------------------------------ */

/** Foca a navegação numa garagem específica. `null` volta para todas. */
export function focarGaragem(id: string | null, nome?: string): void {
  const s = lerSessao();
  if (!s) return;
  gravar<Sessao>(CHAVE_SESSAO, { ...s, garagemFocoId: id });
  registrarAuditoria(
    "foco_garagem",
    id ? `Passou a visualizar apenas ${nome ?? id}.` : "Voltou a visualizar todas as garagens do escopo.",
  );
}

/** Define as garagens do usuário. Usado pelo cadastro de usuários. */
export function definirGaragens(ids: string[]): void {
  const s = lerSessao();
  if (!s) return;
  gravar<Sessao>(CHAVE_SESSAO, { ...s, garagens: ids, garagemFocoId: null });
}

/* ------------------------------------------------------------------ */
/* Auditoria                                                           */
/* ------------------------------------------------------------------ */

export type RegistroAuditoria = {
  id: string;
  em: string;
  usuario: string;
  perfil: string;
  organizacao: string;
  acao: string;
  detalhe: string;
};

/**
 * Registra uma ação. Como o super admin pode tudo e em qualquer base, o log é o
 * que permite responder depois "quem alterou o dado deste cliente e quando".
 */
export function registrarAuditoria(acao: string, detalhe: string, orgForcada?: string): void {
  const s = lerSessao();
  const registro: RegistroAuditoria = {
    id: `log${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    em: new Date().toISOString(),
    usuario: s?.email ?? "anônimo",
    perfil: s?.perfil ?? "—",
    organizacao: orgForcada ?? s?.organizacaoAtiva ?? "—",
    acao,
    detalhe,
  };
  const atual = ler<RegistroAuditoria[]>(CHAVE_AUDITORIA, []);
  // Mantém os 500 mais recentes para não estourar a cota do sessionStorage.
  gravar(CHAVE_AUDITORIA, [registro, ...atual].slice(0, 500));
}

export const lerAuditoria = (): RegistroAuditoria[] => ler<RegistroAuditoria[]>(CHAVE_AUDITORIA, []);

/** Registra o pedido de redefinição para o fluxo de "esqueci minha senha". */
export function pedirRedefinicaoSenha(email: string): { ok: boolean; erro?: string } {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { ok: false, erro: "Informe um e-mail válido." };
  }
  acrescentar("redefinicoes", { email: email.trim(), pedidoEm: new Date().toISOString() });
  return { ok: true };
}

/**
 * Cria a sessão a partir do usuário devolvido pela API.
 *
 * Diferente de `entrar()`, que valida credencial localmente, aqui a
 * autenticação já aconteceu no servidor — esta função só espelha o resultado
 * para a interface, que continua lendo nome, organização e perfil da sessão.
 *
 * O token de verdade vive em `auth-api.ts`; o que fica aqui é apresentação.
 */
export function entrarComPerfil(dados: {
  nome: string;
  email: string;
  organizacao: string;
  organizacaoId: string;
  perfil: Perfil;
}) {
  const sessao: Sessao = {
    nome: dados.nome,
    email: dados.email,
    organizacao: dados.organizacao,
    organizacaoId: dados.organizacaoId,
    organizacaoAtivaId: dados.organizacaoId,
    organizacaoAtiva: dados.organizacao,
    perfil: dados.perfil,
    garagens: [],
    garagemFocoId: null,
    entrouEm: new Date().toISOString(),
  };
  gravar("sessao", sessao);
  registrarAuditoria("login", `Entrada autenticada pela API: ${dados.email}.`);
  return sessao;
}
