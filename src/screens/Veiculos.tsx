import { useNavigate } from "@/lib/router-compat";
import { Navigation, Plus, Radio, Search, Truck, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, Dot, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";

/**
 * Veículos — cadastro/lista da frota com situação operacional e telemetria.
 * Dados de exemplo.
 */

type Veiculo = {
  placa: string;
  modelo: string;
  marca: string;
  ano: number;
  operacao: string;
  situacao: "Em rota" | "Parado" | "Manutenção" | "Sem sinal";
  kml: string;
  odometro: string;
};

const situTone: Record<Veiculo["situacao"], PillTone> = {
  "Em rota": "green",
  Parado: "gold",
  Manutenção: "sky",
  "Sem sinal": "coral",
};

const DADOS: Veiculo[] = [
  { placa: "BCA7A56", modelo: "FH 460", marca: "Volvo", ano: 2022, operacao: "Refrigerado", situacao: "Em rota", kml: "2,71", odometro: "812.977" },
  { placa: "TPA1106", modelo: "XF 105", marca: "DAF", ano: 2020, operacao: "Refrigerado", situacao: "Em rota", kml: "2,99", odometro: "634.210" },
  { placa: "SXD1J61", modelo: "R 450", marca: "Scania", ano: 2021, operacao: "Seco", situacao: "Parado", kml: "3,12", odometro: "489.020" },
  { placa: "GAP4C73", modelo: "Actros", marca: "Mercedes", ano: 2023, operacao: "Frigorífico", situacao: "Manutenção", kml: "2,64", odometro: "201.774" },
  { placa: "EBZ3590", modelo: "XF FT", marca: "DAF", ano: 2019, operacao: "Seco", situacao: "Sem sinal", kml: "2,88", odometro: "913.006" },
  { placa: "LUO5I08", modelo: "FH 540", marca: "Volvo", ano: 2022, operacao: "Seco", situacao: "Em rota", kml: "3,04", odometro: "356.481" },
];

const COLS: Column<Veiculo>[] = [
  {
    key: "placa",
    header: "Veículo",
    render: (v) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-tint">
          <Truck className="h-4 w-4 text-brand-navy" />
        </div>
        <div>
          <div className="font-mono font-semibold text-foreground">{v.placa}</div>
          <div className="text-[11.5px] text-muted-foreground">{v.marca} {v.modelo} · {v.ano}</div>
        </div>
      </div>
    ),
  },
  { key: "operacao", header: "Operação", render: (v) => <Pill tone="sky">{v.operacao}</Pill> },
  {
    key: "situacao",
    header: "Situação",
    render: (v) => (
      <span className="inline-flex items-center gap-2 text-[13px]">
        <Dot tone={situTone[v.situacao]} />
        {v.situacao}
      </span>
    ),
  },
  { key: "kml", header: "KML", align: "right", render: (v) => <span className="font-mono">{v.kml} <span className="text-muted-foreground">km/l</span></span> },
  { key: "odometro", header: "Odômetro", align: "right", render: (v) => <span className="font-mono">{v.odometro} km</span> },
];

export default function Veiculos() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="Veículos"
        subtitle="48 veículos na frota"
        actions={
          <button
            onClick={() => navigate("/app/veiculos/novo")}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-[15px] w-[15px]" />
            Novo veículo
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Frota · Veículos"
          title="48 veículos na operação"
          subtitle="Situação, telemetria e consumo de cada veículo da frota."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value="15" label="Em rota agora" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value="2,89" unit="km/l" label="KML médio da frota" />
          </div>
        </HeroBanner>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Navigation} label="Em rota" value="15" color="var(--leaf)" />
          <StatTile icon={Truck} label="Parados" value="33" color="var(--gold)" />
          <StatTile icon={Wrench} label="Em manutenção" value="2" color="var(--brand-sky)" />
          <StatTile icon={Radio} label="Sem sinal" value="3" color="var(--coral)" />
        </div>

        <Card
          title="Frota cadastrada"
          icon={Truck}
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Buscar placa…"
                className="h-9 w-44 rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
              />
            </div>
          }
          bodyClassName="p-4"
        >
          <DataTable columns={COLS} rows={DADOS} />
        </Card>

        <p className="py-6 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}
