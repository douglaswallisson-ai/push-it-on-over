import { DollarSign, Droplet, Fuel, MapPin } from "lucide-react";
import { CadastroScaffold } from "@/components/layout/CadastroScaffold";
import { HeroMetric } from "@/components/ui/HeroBanner";
import { StatTile, type Column } from "@/components/ui/data";

/** Cadastro de abastecimentos. Dados de exemplo. */

type Abastecimento = {
  data: string;
  veiculo: string;
  posto: string;
  litros: string;
  preco: string;
  total: string;
  km: string;
};

const DADOS: Abastecimento[] = [
  { data: "24/07 08:12", veiculo: "BCA7A56", posto: "Posto Trevo — SP", litros: "320 L", preco: "R$ 6,02", total: "R$ 1.926,40", km: "812.977" },
  { data: "24/07 06:40", veiculo: "TPA1106", posto: "Ipiranga — Guarulhos", litros: "280 L", preco: "R$ 5,98", total: "R$ 1.674,40", km: "634.210" },
  { data: "23/07 19:55", veiculo: "SXD1J61", posto: "Shell — Osasco", litros: "300 L", preco: "R$ 6,05", total: "R$ 1.815,00", km: "489.020" },
  { data: "23/07 14:20", veiculo: "GAP4C73", posto: "Posto Trevo — SP", litros: "150 L", preco: "R$ 6,02", total: "R$ 903,00", km: "201.774" },
  { data: "22/07 22:10", veiculo: "EBZ3590", posto: "BR — Recife", litros: "310 L", preco: "R$ 6,10", total: "R$ 1.891,00", km: "913.006" },
];

const COLS: Column<Abastecimento>[] = [
  { key: "data", header: "Data", render: (r) => <span className="font-mono text-[12.5px]">{r.data}</span> },
  { key: "veiculo", header: "Veículo", render: (r) => <span className="font-mono font-semibold text-foreground">{r.veiculo}</span> },
  { key: "posto", header: "Posto" },
  { key: "litros", header: "Litros", align: "right", render: (r) => <span className="font-mono text-coral">{r.litros}</span> },
  { key: "preco", header: "R$/L", align: "right", render: (r) => <span className="font-mono">{r.preco}</span> },
  { key: "total", header: "Total", align: "right", render: (r) => <span className="font-semibold text-foreground">{r.total}</span> },
  { key: "km", header: "Odômetro", align: "right", render: (r) => <span className="font-mono text-muted-foreground">{r.km}</span> },
];

export default function Combustivel() {
  return (
    <CadastroScaffold<Abastecimento>
      title="Combustível"
      subtitle="Cadastros › Combustível"
      newLabel="Novo abastecimento"
      eyebrow="Cadastros · Combustível"
      heroTitle="Registro de abastecimentos"
      heroSubtitle="Cada abastecimento alimenta o consumo, o KML e a apuração de economia."
      heroMetrics={
        <>
          <HeroMetric value="12.480" unit="L" label="Litros no mês" />
          <div className="h-10 w-px bg-white/15" />
          <HeroMetric value="R$ 74.880" label="Gasto no mês" />
        </>
      }
      stats={
        <>
          <StatTile icon={Fuel} label="Abastecimentos" value="214" color="var(--brand-navy)" />
          <StatTile icon={Droplet} label="Litros no mês" value="12.480" color="var(--brand-sky)" />
          <StatTile icon={DollarSign} label="R$/L médio" value="R$ 6,00" color="var(--gold)" />
          <StatTile icon={MapPin} label="Postos" value="8" color="var(--leaf)" />
        </>
      }
      cardTitle="Últimos abastecimentos"
      cardIcon={Fuel}
      columns={COLS}
      rows={DADOS}
      searchPlaceholder="Buscar placa ou posto…"
    />
  );
}
