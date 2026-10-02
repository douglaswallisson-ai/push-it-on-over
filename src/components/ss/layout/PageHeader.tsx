import type { ReactNode } from "react";
import { useMarcaEmbutido } from "@/components/ss/layout/PonteEmbutido";

/**
 * Cabeçalho branco sticky de cada página — título à esquerda, ações à direita.
 * É o topo do wireframe do sistema, generalizado para servir todas as telas.
 *
 * Com marca de cliente (hoje: modo embutido de parceiro), a logo dele aparece
 * à esquerda do título.
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
  const embutido = useMarcaEmbutido();
  const logo = embutido?.marca.logo;
  const semMenu = embutido && !embutido.menu;

  return (
    <header data-tour="page-header" className="sticky top-0 z-10 border-b border-border bg-white">
      <div className={`flex items-center justify-between gap-4 px-8 py-4 ${semMenu ? "pl-4 sm:pl-8" : "pl-16 lg:pl-8"}`}>
        <div className="flex min-w-0 items-center gap-4">
          {logo && (
            <>
              <img src={logo} alt={embutido?.marca.nome ?? "Logo"} className="h-9 max-w-[140px] shrink-0 object-contain" />
              <span className="h-8 w-px shrink-0 bg-border" aria-hidden />
            </>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
