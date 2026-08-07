import { CalendarDays, Clock, Download, Droplet, Leaf, TrendingDown, Truck } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, StatTile, type Column } from "@/components/ss/ui/data";
import { Sparkline } from "@/components/ss/ui/Sparkline";
import { FilterBar, FilterChip } from "@/components/ss/ui/data";

/**
 * Motor ligado parado — tempo de marcha lenta ocioso e o combustível/dinheiro
 * que isso queima. O hero traz o desperdício em destaque; a tabela ordena os
 * veículos por tempo parado. Dados de exemplo.
 */

type Row = {
  placa: string;
  motorista: string;
  tempo: string;
  litros: string;
  custo: string;
  trend: number[];
};

const DADOS: Row[] = [
  { placa: "EBZ3590", motorista: "Remildo N. Lima", tempo: "03:44", litros: "11,2 L", custo: "R$ 67,20", trend: [2, 3, 3, 4, 3, 4, 4] },
  { placa: "QHH1360", motorista: "Henrique", tempo: "02:27", litros: "7,4 L", custo: "R$ 44,40", trend: [1, 2, 2, 3, 2, 3, 3] },
  { placa: "GAP4C73", motorista: "Roberto Tomaz", tempo: "01:50", litros: "5,5 L", custo: "R$ 33,00", trend: [3, 2, 2, 2, 1, 2, 2] },
  { placa: "OUH0C81", motorista: "Thiago Bora", tempo: "01:31", litros: "4,6 L", custo: "R$ 27,60", trend: [1, 1, 2, 2, 2, 1, 2] },
  { placa: "SMS1J35", motorista: "—", tempo: "01:17", litros: "3,9 L", custo: "R$ 23,40", trend: [2, 1, 1, 1, 2, 1, 1] },
];

const COLS: Column<Row>[] = [
  {
    key: "placa",
    header: "Veículo",
    render: (r) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-tint">
          <Truck className="h-4 w-4 text-brand-navy" />
        </div>
        <div>
          <div className="font-mono font-semibold text-foreground">{r.placa}</div>
          <div className="text-[11.5px] text-muted-foreground">{r.motorista}</div>
        </div>
      </div>
    ),
  },
  { key: "tempo", header: "Tempo parado", align: "right", render: (r) => <span className="font-mono font-semibold text-foreground">{r.tempo}</span> },
  { key: "litros", header: "Combustível", align: "right", render: (r) => <span className="font-mono text-coral">{r.litros}</span> },
  { key: "custo", header: "Custo estimado", align: "right", render: (r) => <span className="font-semibold text-foreground">{r.custo}</span> },
  { key: "trend", header: "Tendência (7d)", align: "right", render: (r) => <div className="flex justify-end"><Sparkline data={r.trend} color="var(--coral)" width={80} height={26} /></div> },
];

export default function MotorLigadoParado() {
  return (
    <>
      <PageHeader
        title="Motor ligado parado"
        subtitle="Frota › Marcha lenta ociosa"
        actions={
          <button className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary">
            <Download className="h-[15px] w-[15px]" />
            Exportar
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Frota · Motor ligado parado"
          title={
            <span>
              A frota queimou <span className="text-brand-green">R$ 3.180</span> em marcha lenta esta
              semana.
            </span>
          }
          subtitle="Motor ligado com o veículo parado — combustível gasto sem rodar um metro."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value="41h" label="Tempo total parado" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value="530" unit="L" label="Combustível" />
          </div>
        </HeroBanner>

        <FilterBar>
          <FilterChip icon={CalendarDays} label="Período" value="Últimos 7 dias" />
          <FilterChip icon={Truck} label="Frota" value="Toda a frota" />
        </FilterBar>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Clock} label="Tempo total ocioso" value="41h" color="var(--gold)" />
          <StatTile icon={Droplet} label="Litros desperdiçados" value="530" unit="L" color="var(--coral)" />
          <StatTile icon={TrendingDown} label="Custo estimado" value="R$ 3.180" color="var(--brand-navy)" />
          <StatTile icon={Leaf} label="CO₂ evitável" value="1,4" unit="t" color="var(--leaf)" />
        </div>

        <Card title="Ranking — maiores tempos parados" icon={Clock} bodyClassName="p-4">
          <DataTable columns={COLS} rows={DADOS} />
        </Card>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}
