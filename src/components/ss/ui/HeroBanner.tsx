import type { ReactNode } from "react";
import { SSOrb } from "@/components/ss/brand/SSOrb";

/**
 * Faixa de abertura das telas internas, no layout denso aprovado em 02/10/2026:
 * uma linha clara com título à esquerda e os números à direita, em vez do
 * banner em gradiente que ocupava meia tela antes do dado.
 * O conteúdo antigo (texto branco sobre o gradiente) é reajustado pela classe
 * `.hero-compacto` em styles.css, sem precisar mexer em cada tela.
 */
export function HeroBanner({
  eyebrow,
  title,
  subtitle,
  orb = false,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  orb?: boolean;
  children?: ReactNode;
}) {
  return (
    <section data-tour="hero" className="hero-compacto rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {orb && <SSOrb size={32} className="shrink-0 text-brand-green" />}
          <div className="min-w-0">
            {eyebrow && <p className="text-[12px] font-medium text-muted-foreground">{eyebrow}</p>}
            <h2 className="text-[16px] font-semibold leading-tight text-foreground">{title}</h2>
            {subtitle && <p className="mt-0.5 max-w-2xl text-[13px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </section>
  );
}

/** Número da faixa de abertura. */
export function HeroMetric({
  value,
  unit,
  label,
}: {
  value: string;
  unit?: string;
  label: string;
}) {
  return (
    <div>
      <div className="text-[20px] font-semibold leading-tight tabular-nums text-foreground">
        {value}
        {unit && <span className="ml-0.5 text-[13px] font-medium text-muted-foreground">{unit}</span>}
      </div>
      <div className="text-[12px] text-muted-foreground">{label}</div>
    </div>
  );
}
