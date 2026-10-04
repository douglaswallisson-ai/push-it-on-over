import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Primitivas de formulário para as telas de cadastro. Rótulo sempre visível,
 * campos claros sobre o canvas, agrupados por seção. Estilo de aplicação (mais
 * compacto que o login).
 */

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 border-b border-border py-7 last:border-b-0 lg:grid-cols-[260px_1fr]">
      <div>
        <h3 className="text-[16px] font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const baseInput =
  "h-10 w-full rounded-lg border border-border bg-white px-3 text-[14px] text-foreground outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/12";

export function Field({
  label,
  hint,
  full,
  children,
}: {
  label: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block space-y-1.5", full && "sm:col-span-2")}>
      <span className="block text-[12px] font-medium text-ink-soft">{label}</span>
      {children}
      {hint && <span className="block text-[12px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(baseInput, props.className)} />;
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(baseInput, "cursor-pointer", props.className)}>
      {children}
    </select>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(baseInput, "h-auto min-h-20 resize-y py-2.5", props.className)}
    />
  );
}

/** Chave liga/desliga controlada. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-left"
    >
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand-green" : "bg-[#cbd5dd]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "left-0.5 translate-x-5" : "left-0.5",
          )}
        />
      </span>
      <span className="text-[13px] text-ink-soft">{label}</span>
    </button>
  );
}

export function FormActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 mt-2 flex items-center justify-end gap-3 border-t border-border bg-card/95 px-6 py-4 backdrop-blur">
      {children}
    </div>
  );
}
