import type { ReactNode } from "react";
import { SSOrb } from "@/components/ss/brand/SSOrb";

/**
 * Faixa de abertura em gradiente da marca — o mesmo tratamento do hero do Início
 * e do login. Serve para dar às telas internas o peso visual da identidade em
 * vez de abrir direto numa tabela.
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
    <section data-tour="hero" className="relative overflow-hidden rounded-2xl bg-gradient-hero p-6 text-white shadow-elegant md:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, var(--brand-sky), transparent 68%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full opacity-25"
        style={{ background: "radial-gradient(circle, var(--brand-green), transparent 70%)" }}
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          {orb && <SSOrb size={64} halo className="text-brand-green" />}
          <div>
            {eyebrow && (
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">{eyebrow}</p>
            )}
            <h2 className="mt-1 text-2xl font-bold leading-tight md:text-[26px]">{title}</h2>
            {subtitle && <p className="mt-1.5 max-w-xl text-sm text-white/70">{subtitle}</p>}
          </div>
        </div>
        {children && <div className="shrink-0">{children}</div>}
      </div>
    </section>
  );
}

/** Métrica clara sobre o gradiente do hero. */
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
      <div className="font-display text-2xl font-bold tabular-nums md:text-[28px]">
        {value}
        {unit && <span className="ml-0.5 text-base font-medium text-white/70">{unit}</span>}
      </div>
      <div className="mt-1 text-[11.5px] font-medium text-white/60">{label}</div>
    </div>
  );
}
