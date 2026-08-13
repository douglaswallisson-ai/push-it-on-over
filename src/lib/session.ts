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
  perfil: "Administrador" | "Gestor" | "Operador" | "Consulta";
  organizacao: string;
  entrouEm: string;
};

const CHAVE_SESSAO = "sessao";

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

  gravar<Sessao>(CHAVE_SESSAO, {
    email: email.trim(),
    nome: nome || "Usuário",
    perfil: "Administrador",
    organizacao: "SS Telemática (interno)",
    entrouEm: new Date().toISOString(),
  });
  return { ok: true };
}

export function sair(): void {
  limpar(CHAVE_SESSAO);
}

/** Registra o pedido de redefinição para o fluxo de "esqueci minha senha". */
export function pedirRedefinicaoSenha(email: string): { ok: boolean; erro?: string } {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { ok: false, erro: "Informe um e-mail válido." };
  }
  acrescentar("redefinicoes", { email: email.trim(), pedidoEm: new Date().toISOString() });
  return { ok: true };
}
