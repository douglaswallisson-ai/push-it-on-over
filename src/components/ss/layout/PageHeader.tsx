import type { ReactNode } from "react";
import { useMarcaEmbutido } from "@/components/ss/layout/PonteEmbutido";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { usandoMock } from "@/lib/modo";

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
  // Parceiro (embutido) primeiro; senão, a logo do cliente aberto.
  const g = grupoAtivo();
  const logoCliente = useQuery({
    queryKey: ["cliente-logo", g],
    queryFn: () => api.get<{ logo: string | null }>(`/api/v1/cliente/logo?group_id=${g}`),
    enabled: !!g && !usandoMock() && !embutido?.marca.logo,
    staleTime: 3_600_000,
  });
  const logo = embutido?.marca.logo ?? logoCliente.data?.logo ?? undefined;
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
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("ss:abrir-busca"))}
            title="Buscar (Ctrl+K)"
            aria-label="Buscar"
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-white px-3 text-[13px] text-muted-foreground hover:bg-secondary"
          >
            <Search className="h-4 w-4" />
            <span className="hidden lg:inline">Buscar</span>
            <kbd className="hidden rounded border border-border bg-secondary px-1.5 text-[12px] lg:inline">Ctrl K</kbd>
          </button>
        </div>
      </div>
      {/* TESTE visual câmeras: subtítulo como faixa de migalhas (CoreUI c-subheader). */}
      {subtitle && (
        <div className={`subheader-cameras flex items-center px-8 ${semMenu ? "pl-4 sm:pl-8" : "pl-16 lg:pl-8"}`}>
          <span><b>Início</b> / {subtitle}</span>
        </div>
      )}
    </header>
  );
}
