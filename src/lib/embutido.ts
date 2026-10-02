import { gravar, ler, limpar } from "@/lib/session";

/**
 * Modo embutido: a plataforma aberta dentro do sistema de um parceiro (ex.:
 * Citatti), como se fosse uma funcionalidade dele — sem o menu e a marca da
 * SS, com as cores e a logo do parceiro.
 *
 * A entrada acontece em /embed com um ticket assinado pelo servidor do
 * parceiro (ver ss-fleet-core, endpoints/embed.py). A configuração fica na
 * sessão do próprio iframe, então vale só ali dentro.
 */

export type Marca = { cor?: string; destaque?: string; logo?: string; nome?: string };

export type ConfigEmbutido = {
  parceiro: { id: string; nome: string; origens: string[] };
  marca: Marca;
  /** Mostra o menu lateral da plataforma (padrão: não — o menu é o do parceiro). */
  menu: boolean;
};

const CHAVE = "embutido";

/** Só vale dentro de um iframe: aberta direto no navegador, a plataforma é a normal. */
export const lerEmbutido = () => (dentroDeIframe() ? ler<ConfigEmbutido | null>(CHAVE, null) : null);
export const gravarEmbutido = (c: ConfigEmbutido) => gravar(CHAVE, c);
export const limparEmbutido = () => limpar(CHAVE);
export const estaEmbutido = () => Boolean(lerEmbutido());
export function dentroDeIframe() {
  try {
    return typeof window !== "undefined" && window.self !== window.top;
  } catch {
    return true;
  }
}

const COR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function corValida(c?: string | null) {
  if (!c) return undefined;
  const v = c.startsWith("#") ? c : `#${c}`;
  return COR.test(v) ? v : undefined;
}

/** Logo só por https (ou localhost em teste) ou imagem embutida — nada de javascript:. */
export function logoValida(u?: string | null) {
  if (!u) return undefined;
  if (/^data:image\/(png|jpe?g|svg\+xml|webp|gif);base64,/i.test(u)) return u;
  try {
    const url = new URL(u);
    if (url.protocol === "https:" || (url.protocol === "http:" && /^(localhost|127\.0\.0\.1)$/.test(url.hostname))) return url.href;
  } catch {
    /* inválida */
  }
  return undefined;
}

/** Mistura a cor com preto (fração 0–1) para o tom escuro do menu. */
function escurecer(hex: string, f: number) {
  const n = hex.length === 4 ? hex.slice(1).split("").map((c) => c + c).join("") : hex.slice(1);
  const v = [0, 2, 4].map((i) => Math.round(parseInt(n.slice(i, i + 2), 16) * (1 - f)));
  return `#${v.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Aplica as cores do parceiro nos tokens do tema (todas as telas usam esses tokens). */
export function aplicarMarca(m: Marca | undefined) {
  if (typeof document === "undefined" || !m) return;
  const raiz = document.documentElement.style;
  const cor = corValida(m.cor);
  const destaque = corValida(m.destaque);
  if (cor) {
    raiz.setProperty("--brand-navy", cor);
    raiz.setProperty("--brand-blue", cor);
    raiz.setProperty("--sidebar", escurecer(cor, 0.15));
    raiz.setProperty("--sidebar-dark", escurecer(cor, 0.3));
  }
  if (destaque) raiz.setProperty("--brand-sky", destaque);
}

/** Origem da página que abriu o iframe (o site do parceiro). */
export function origemDoPai(): string | null {
  const anc = (window.location as Location & { ancestorOrigins?: DOMStringList }).ancestorOrigins;
  if (anc && anc.length) return anc[anc.length - 1];
  try {
    return document.referrer ? new URL(document.referrer).origin : null;
  } catch {
    return null;
  }
}

export function origemPermitida(origens: string[]) {
  const o = origemDoPai();
  return Boolean(o && origens.some((p) => p.replace(/\/$/, "") === o));
}

/** Mensagem para o sistema do parceiro (só para a origem dele). */
export function avisarParceiro(msg: Record<string, unknown>) {
  const c = lerEmbutido();
  const o = origemDoPai();
  if (!c || !o || !c.parceiro.origens.includes(o) || !dentroDeIframe()) return;
  try {
    window.parent.postMessage({ origem: "ss-plataforma", ...msg }, o);
  } catch {
    /* ignora */
  }
}
