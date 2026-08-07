import { Award, CalendarDays, FileText, Printer, Star, Target, TrendingUp, Trophy, Truck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ui/HeroBanner";
import { Card, DataTable, FilterBar, FilterChip, Pill, StatTile, type Column, type PillTone } from "@/components/ui/data";
import { RingProgress } from "@/components/ui/gauges";

/**
 * Premiação — acompanhamento do programa de bônus dos motoristas: total apurado,
 * progresso da meta de km e o detalhamento por motorista. Dados de exemplo.
 */

type Premiado = {
  nome: string;
  km: string;
  nota: number;
  viagens: number;
  valor: string;
  pos: number;
};

const notaTone = (n: number): PillTone => (n >= 65 ? "green" : n >= 45 ? "gold" : "coral");

const DADOS: Premiado[] = [
  { pos: 1, nome: "Crísala Boni", km: "7.970", nota: 71, viagens: 18, valor: "R$ 2.985,00" },
  { pos: 2, nome: "Davi Nadalin", km: "10.955", nota: 68, viagens: 23, valor: "R$ 1.130,00" },
  { pos: 3, nome: "Celso Fiorani", km: "8.992", nota: 66, viagens: 23, valor: "R$ 846,76" },
  { pos: 4, nome: "Fernando Rocha", km: "7.277", nota: 61, viagens: 19, valor: "R$ 468,40" },
  { pos: 5, nome: "Éder Caetano", km: "3.320", nota: 57, viagens: 12, valor: "R$ 231,21" },
  { pos: 6, nome: "Gustavo Burkner", km: "6.437", nota: 46, viagens: 20, valor: "R$ 0,00" },
  { pos: 7, nome: "Guilherme Souza", km: "10.056", nota: 41, viagens: 24, valor: "R$ 0,00" },
];

const COLS: Column<Premiado>[] = [
  {
    key: "nome",
    header: "Motorista",
    render: (m) => (
      <div className="flex items-center gap-3">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${m.pos <= 3 ? "bg-gold-tint text-gold" : "bg-secondary text-muted-foreground"}`}>
          {m.pos}
        </div>
        <span className="font-semibold text-foreground">{m.nome}</span>
      </div>
    ),
  },
  { key: "km", header: "Km rodado", align: "right", render: (m) => <span className="font-mono">{m.km}</span> },
  { key: "nota", header: "Nota geral", align: "center", render: (m) => <Pill tone={notaTone(m.nota)}><Star className="h-3 w-3" />{m.nota}</Pill> },
  { key: "viagens", header: "Viagens", align: "right" },
  { key: "valor", header: "Premiação", align: "right", render: (m) => <span className="font-semibold text-foreground">{m.valor}</span> },
  {
    key: "acoes",
    header: "",
    align: "right",
    render: () => (
      <div className="flex justify-end gap-1.5">
        <button title="Demonstrativo" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-brand-navy">
          <Printer className="h-3.5 w-3.5" />
        </button>
        <button title="Relatório de viagens" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-brand-navy">
          <FileText className="h-3.5 w-3.5" />
        </button>
      </div>
    ),
  },
];

export default function Premiacao() {
  return (
    <>
      <PageHeader title="Premiação" subtitle="Acompanhamento do programa de bônus" />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Motoristas · Premiação"
          title={<span>R$ 6.912,92 em premiação neste ciclo</span>}
          subtitle="Bônus apurado por metas de quilometragem e desempenho de condução."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value="41" label="Performance média" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value="7" label="Motoristas premiados" />
          </div>
        </HeroBanner>

        <FilterBar>
          <FilterChip icon={Truck} label="Frota" value="Toda a frota" />
          <FilterChip icon={CalendarDays} label="Data de corte" value="01–31 jul 2026" />
          <FilterChip icon={CalendarDays} label="Ano" value="2026" />
        </FilterBar>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
          {/* Progresso da meta. */}
          <Card title="Meta de quilometragem" icon={Target}>
            <div className="flex flex-col items-center gap-4">
              <RingProgress value={64} size={150} sublabel="da meta" color="var(--gold)" />
              <div className="grid w-full grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-secondary/50 p-3">
                  <p className="font-display text-lg font-bold tabular-nums">128.367</p>
                  <p className="text-[11px] text-muted-foreground">Km rodados</p>
                </div>
                <div className="rounded-xl bg-secondary/50 p-3">
                  <p className="font-display text-lg font-bold tabular-nums">201.628</p>
                  <p className="text-[11px] text-muted-foreground">Meta</p>
                </div>
              </div>
            </div>
          </Card>

          {/* KPIs + pódio. */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={Trophy} label="Premiação total" value="R$ 6.912" color="var(--leaf)" />
              <StatTile icon={TrendingUp} label="Ticket médio" value="R$ 987" color="var(--brand-navy)" />
              <StatTile icon={Star} label="Nota média" value="58" color="var(--gold)" />
              <StatTile icon={Award} label="Elegíveis" value="5 de 7" color="var(--brand-sky)" />
            </div>

            <Card title="Pódio do ciclo" icon={Trophy}>
              <div className="grid grid-cols-3 gap-3">
                {DADOS.slice(0, 3).map((m, i) => (
                  <div
                    key={m.nome}
                    className={`rounded-xl border p-4 text-center ${i === 0 ? "border-gold-line bg-gold-tint/50" : "border-border bg-secondary/40"}`}
                  >
                    <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? "bg-gold text-white" : "bg-white text-muted-foreground"}`}>
                      {m.pos}
                    </div>
                    <p className="mt-2 truncate text-[13px] font-semibold">{m.nome}</p>
                    <p className="font-display text-lg font-bold text-leaf">{m.valor}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <Card title="Detalhamento por motorista" icon={Award} action={<Pill tone="sky">{DADOS.length} motoristas</Pill>} bodyClassName="p-4">
          <DataTable columns={COLS} rows={DADOS} />
        </Card>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}
