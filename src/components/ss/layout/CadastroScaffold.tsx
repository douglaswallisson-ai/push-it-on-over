import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, Pill, type Column } from "@/components/ss/ui/data";

/**
 * Esqueleto comum das telas de cadastro: cabeçalho + faixa hero + KPIs + tabela
 * com busca e botão "novo". Cada cadastro (cerca, combustível, dispositivos…)
 * só configura os textos, os KPIs e as colunas — o padrão visual é o mesmo.
 */
export function CadastroScaffold<T extends Record<string, unknown>>({
  title,
  subtitle,
  newLabel,
  eyebrow,
  heroTitle,
  heroSubtitle,
  heroMetrics,
  stats,
  cardTitle,
  cardIcon,
  columns,
  rows,
  searchPlaceholder = "Buscar…",
}: {
  title: string;
  subtitle: string;
  newLabel: string;
  eyebrow: string;
  heroTitle: ReactNode;
  heroSubtitle: string;
  heroMetrics: ReactNode;
  stats?: ReactNode;
  cardTitle: string;
  cardIcon: LucideIcon;
  columns: Column<T>[];
  rows: T[];
  searchPlaceholder?: string;
}) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <button className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">
            <Plus className="h-[15px] w-[15px]" />
            {newLabel}
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner orb eyebrow={eyebrow} title={heroTitle} subtitle={heroSubtitle}>
          <div className="flex items-center gap-6">{heroMetrics}</div>
        </HeroBanner>

        {stats && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{stats}</div>}

        <Card
          title={cardTitle}
          icon={cardIcon}
          action={
            <div className="flex items-center gap-3">
              <Pill tone="sky">{rows.length} registros</Pill>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder={searchPlaceholder}
                  className="h-9 w-44 rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
                />
              </div>
            </div>
          }
          bodyClassName="p-4"
        >
          <DataTable columns={columns} rows={rows} />
        </Card>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}
