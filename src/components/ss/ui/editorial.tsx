import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Primitivas de conteúdo herdadas do Business & Product Assessment
 * (dashboard-inicio-identidade-original.html), reescritas sobre os tokens SS.
 *
 * A gramática é sempre a mesma: eyebrow em mono → título → subtítulo em itálico
 * → blocos. É o que dá ao painel um tom de leitura, e não de painel de controle
 * genérico cheio de widget solto.
 */

export type Tone = "navy" | "coral" | "gold" | "teal" | "leaf";

const TONE: Record<Tone, { text: string; tint: string; line: string }> = {
  navy: { text: "text-primary", tint: "bg-navy-tint", line: "border-navy-line" },
  coral: { text: "text-coral", tint: "bg-coral-tint", line: "border-coral-line" },
  gold: { text: "text-gold", tint: "bg-gold-tint", line: "border-gold-line" },
  teal: { text: "text-teal", tint: "bg-teal-tint", line: "border-teal-line" },
  leaf: { text: "text-leaf", tint: "bg-leaf-tint", line: "border-leaf-line" },
};

/** Rótulo em versalete com o traço à esquerda — assinatura visual do documento. */
export function Eyebrow({ tone = "navy", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "mb-3 flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.13em]",
        TONE[tone].text,
      )}
    >
      <span className="inline-block h-px w-4 bg-current opacity-55" />
      {children}
    </p>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("mb-2.5 text-[clamp(22px,2.4vw,30px)] font-semibold leading-[1.12]", className)}>
      {children}
    </h2>
  );
}

export function SectionSub({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-7 max-w-[70ch] text-[16px] italic leading-[1.55] text-muted-foreground">
      {children}
    </p>
  );
}

/** Bloco de seção com o ritmo vertical do documento. */
export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mx-auto max-w-[1080px] px-[5vw] py-11", className)}>
      {children}
    </section>
  );
}

/** Cartão de indicador tintado — o `stat-card` do assessment. */
export function StatCard({
  value,
  label,
  delta,
  tone = "navy",
}: {
  value: string;
  label: string;
  delta?: string;
  tone?: Tone;
}) {
  const t = TONE[tone];
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-5 text-center transition-all hover:-translate-y-[3px] hover:shadow-card",
        t.tint,
        t.line,
      )}
    >
      <div className={cn("font-display text-[30px] font-semibold leading-[1.1] tabular-nums", t.text)}>
        {value}
      </div>
      <div className="mt-2 text-xs leading-[1.35] text-ink-soft">{label}</div>
      {delta && <div className="mt-1.5 font-mono text-[12px] text-muted-foreground">{delta}</div>}
    </div>
  );
}

/** Cartão de conteúdo branco com título tonalizado. */
export function InfoCard({
  title,
  tone = "navy",
  children,
  footer,
}: {
  title: string;
  tone?: Tone;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-5 shadow-[0_1px_2px_rgba(13,13,13,.05)] transition-all hover:-translate-y-0.5 hover:border-[#d7dee8] hover:shadow-card">
      <h4 className={cn("mb-2 text-[16px] font-semibold", TONE[tone].text)}>{title}</h4>
      <div className="text-sm leading-[1.58] text-ink-soft">{children}</div>
      {footer && <div className="mt-4 border-t border-border pt-3">{footer}</div>}
    </div>
  );
}

/** Bloco escuro de destaque — a "decisão do dia". */
export function Callout({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-6 rounded-2xl bg-deep px-8 py-7 text-[#e3eefa] shadow-card">
      {eyebrow && (
        <div className="mb-4 font-mono text-[12px] uppercase tracking-[0.06em] text-[#a9c4e3]">
          {eyebrow}
        </div>
      )}
      <h4 className="mb-3 text-[20px] font-semibold text-white">{title}</h4>
      <div className="text-[14px] leading-[1.62]">{children}</div>
    </div>
  );
}

/** Frase-conclusão com barra lateral colorida. */
export function InsightBar({ tone = "navy", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "my-6 border-l-[3px] py-4 pl-5 pr-4 text-[14px] font-semibold",
        TONE[tone].text,
        tone === "navy" ? "border-l-primary" : "border-l-current",
        TONE[tone].tint,
      )}
    >
      <span className="mr-2 opacity-60">›</span>
      {children}
    </p>
  );
}

/** Etiqueta compacta em mono para status de linha de tabela. */
export function Tag({ tone = "navy", children }: { tone?: Tone; children: React.ReactNode }) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-md px-2 py-0.5 font-mono text-[12px] font-semibold",
        t.tint,
        t.text,
      )}
    >
      {children}
    </span>
  );
}
