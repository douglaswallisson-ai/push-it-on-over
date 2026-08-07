import type { ReactNode } from "react";

/**
 * Cabeçalho branco sticky de cada página — título à esquerda, ações à direita.
 * É o topo do wireframe do sistema, generalizado para servir todas as telas.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header data-tour="page-header" className="sticky top-0 z-10 border-b border-border bg-white">
      <div className="flex items-center justify-between gap-4 px-8 py-4 pl-16 lg:pl-8">
        <div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
