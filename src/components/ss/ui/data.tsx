import * as React from "react";
import { Link } from "@/lib/router-compat";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Primitivas de dados compartilhadas entre as telas internas: cartão, faixa de
 * filtros, tabela estilizada, pílula de status e tile de KPI. Mantêm todas as
 * listas do sistema com o mesmo ritmo e a mesma paleta.
 */

export function Card({
  title,
  action,
  icon: Icon,
  children,
  className,
  bodyClassName,
  tourId,
}: {
  title?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  tourId?: string;
}) {
  return (
    <div data-tour={tourId} className={cn("rounded-2xl border border-border bg-card shadow-card", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-brand-navy" />}
            {title && <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

/** KPI compacto: ícone tonalizado, valor grande, rótulo. */
export function StatTile({
  icon: Icon,
  label,
  value,
  unit,
  color = "var(--brand-navy)",
  foot,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  color?: string;
  foot?: React.ReactNode;
  /** Se informado, o KPI vira um atalho clicável para essa rota. */
  to?: string;
}) {
  const inner = (
    <>
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in oklab, ${color} 14%, white)` }}
        >
          <Icon className="h-[17px] w-[17px]" style={{ color }} />
        </div>
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="font-display text-[24px] font-bold leading-none tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
      {foot && <p className="mt-1.5 text-[12px] text-muted-foreground">{foot}</p>}
    </>
  );

  const base = "rounded-2xl border border-border bg-card p-4 shadow-card";

  if (to) {
    return (
      <Link
        to={to}
        data-tour="stat"
        className={cn(base, "group relative block transition-all hover:-translate-y-0.5 hover:border-[#cdd7e2] hover:shadow-elegant")}
      >
        <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        {inner}
      </Link>
    );
  }

  return (
    <div data-tour="stat" className={base}>
      {inner}
    </div>
  );
}

export type PillTone = "green" | "sky" | "gold" | "coral" | "neutral";

const PILL: Record<PillTone, string> = {
  green: "bg-leaf-tint text-leaf",
  sky: "bg-navy-tint text-brand-blue",
  gold: "bg-gold-tint text-gold",
  coral: "bg-coral-tint text-coral",
  neutral: "bg-secondary text-muted-foreground",
};

export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold",
        PILL[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Ponto de status colorido para linhas de tabela. */
export function Dot({ tone = "neutral" }: { tone?: PillTone }) {
  const c: Record<PillTone, string> = {
    green: "bg-leaf",
    sky: "bg-brand-sky",
    gold: "bg-gold",
    coral: "bg-coral",
    neutral: "bg-muted-foreground",
  };
  return <span className={cn("inline-block h-2 w-2 rounded-full", c[tone])} />;
}

export type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  render?: (row: T) => React.ReactNode;
  className?: string;
};

/** Tabela estilizada, com rolagem horizontal própria e zebra. */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  onRowClick,
  empty = "Nada por aqui.",
}: {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  empty?: string;
}) {
  return (
    <div data-tour="table" className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-[14px]">
        <thead>
          <tr className="bg-secondary">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "whitespace-nowrap px-4 py-3 font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  (!c.align || c.align === "left") && "text-left",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-t border-border transition-colors",
                  i % 2 ? "bg-[#FafbfC]" : "bg-card",
                  onRowClick ? "cursor-pointer hover:bg-navy-tint/50" : "hover:bg-secondary/60",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-3 text-ink-soft",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className,
                    )}
                  >
                    {c.render ? c.render(row) : String(row[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Faixa de filtros no topo das telas — chips com rótulo e valor. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-card">
      {children}
    </div>
  );
}

export function FilterChip({
  icon: Icon,
  label,
  value,
  onClick,
  options,
  onSelect,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  onClick?: () => void;
  /** Quando informado, o chip abre um menu nativo de seleção. */
  options?: string[];
  onSelect?: (v: string) => void;
}) {
  // Com opções, o chip vira um select de verdade em vez de enfeite.
  if (options?.length) {
    return (
      <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-[13px] transition-colors hover:border-[#c7d2df]">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className="text-muted-foreground">{label}:</span>
        <select
          value={value}
          onChange={(e) => onSelect?.(e.target.value)}
          className="cursor-pointer appearance-none bg-transparent font-medium text-foreground outline-none"
        >
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-[13px] transition-colors hover:border-[#c7d2df]">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </button>
  );
}
