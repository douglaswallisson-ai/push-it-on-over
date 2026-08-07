import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Campo de formulário com label sempre visível e ícone à esquerda.
 *
 * O sistema antigo usava placeholder como label — some assim que a pessoa
 * digita, e num formulário de acesso isso custa caro em erro de preenchimento.
 */
export function Field({
  label,
  icon: Icon,
  trailing,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
}) {
  const autoId = React.useId();
  const inputId = id ?? autoId;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <input
          id={inputId}
          className={cn(
            "h-12 w-full rounded-lg border border-input bg-secondary/60 text-sm text-foreground placeholder:text-muted-foreground/70",
            "transition-colors outline-none focus:border-accent focus:bg-background focus:ring-4 focus:ring-accent/15",
            Icon ? "pl-10" : "pl-3.5",
            trailing ? "pr-11" : "pr-3.5",
            className,
          )}
          {...props}
        />
        {trailing && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</div>
        )}
      </div>
    </div>
  );
}
