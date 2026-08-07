import { CalendarDays, Download, Leaf, TreePine, Truck, Wind } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { SSGreenSeal, SSGreenBadge } from "@/components/ss/brand/SSGreenSeal";
import { Card, DataTable, FilterBar, FilterChip, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { Sparkline } from "@/components/ss/ui/Sparkline";

/**
 * Emissão de CO₂ — pegada de carbono da frota + certificação SS Green.
 *
 * Abertura com o selo CO₂ Reduzido e a leitura principal (toneladas emitidas e
 * árvores necessárias para compensar), depois a evolução mensal e o panorama
 * por veículo. Dados de exemplo.
 *
 * Espaço reservado para o conteúdo que o cliente ainda vai enviar sobre a
 * narrativa da certificação (ver bloco "Sobre o selo").
 */

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"];
const EMISSAO_MES = [378, 49, 70, 388, 434, 341, 333];
const KG_POR_KM = [1.06, 0.96, 0.94, 1.01, 1.07, 1.06, 1.04];

type Row = {
  periodo: string;
  placa: string;
  marca: string;
  operacao: string;
  consumo: string;
  km: string;
  tco2: string;
  kgkm: string;
};

const ROWS: Row[] = [
  { periodo: "Jul 2026", placa: "TPA1106", marca: "DAF", operacao: "Refrigerado", consumo: "8.665 L", km: "13.301", tco2: "22,55 t", kgkm: "1,696" },
  { periodo: "Jul 2026", placa: "BCA7A56", marca: "Volvo", operacao: "Seco", consumo: "6.054 L", km: "12.194", tco2: "21,08 t", kgkm: "1,729" },
  { periodo: "Jul 2026", placa: "SXE2B73", marca: "DAF", operacao: "Refrigerado", consumo: "7.437 L", km: "11.193", tco2: "19,36 t", kgkm: "1,730" },
  { periodo: "Jul 2026", placa: "GHH8E36", marca: "DAF", operacao: "Seco", consumo: "11.878 L", km: "18.864", tco2: "18,17 t", kgkm: "1,764" },
  { periodo: "Jul 2026", placa: "GAP4C73", marca: "Mercedes", operacao: "Frigorífico", consumo: "4.462 L", km: "7.106", tco2: "12,30 t", kgkm: "1,731" },
];

const COLS: Column<Row>[] = [
  { key: "periodo", header: "Período" },
  { key: "placa", header: "Placa", render: (r) => <span className="font-mono font-semibold text-foreground">{r.placa}</span> },
  { key: "marca", header: "Marca" },
  { key: "operacao", header: "Operação", render: (r) => <Pill tone="sky">{r.operacao}</Pill> },
  { key: "consumo", header: "Consumo", align: "right" },
  { key: "km", header: "Km", align: "right" },
  { key: "tco2", header: "t CO₂", align: "right", render: (r) => <span className="font-semibold text-foreground">{r.tco2}</span> },
  { key: "kgkm", header: "kg CO₂/km", align: "right" },
];

export default function EmissaoCO2() {
  return (
    <>
      <PageHeader
        title="Emissão de CO₂"
        subtitle="Pegada de carbono da frota · período selecionado"
        actions={
          <button className="inline-flex items-center gap-2 rounded-full bg-brand-green px-4 py-2 text-sm font-semibold text-white shadow-glow transition-transform hover:-translate-y-0.5">
            <Download className="h-[15px] w-[15px]" />
            Exportar
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
        <FilterBar>
          <FilterChip icon={Truck} label="Frota" value="Toda a frota" />
          <FilterChip icon={CalendarDays} label="Ano" value="2026" />
          <FilterChip icon={CalendarDays} label="Período" value="Jul 2026" />
        </FilterBar>

        {/* Hero: selo + leitura principal. */}
        <section className="mb-6 overflow-hidden rounded-2xl border border-leaf-line bg-gradient-to-br from-leaf-tint via-white to-navy-tint shadow-card">
          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="flex justify-center">
              <SSGreenSeal size={210} />
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf">
                <Leaf className="h-3.5 w-3.5" />
                Compensação ambiental
              </div>
              <h2 className="text-2xl font-bold leading-tight md:text-[30px]">
                Sua frota emitiu <span className="text-leaf">332,85 toneladas</span> de CO₂ no
                período.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
                Para compensar essa emissão seria necessário o plantio de aproximadamente{" "}
                <strong className="font-semibold text-foreground">2.377 árvores</strong>. A
                certificação SS Green é emitida a partir dos dados de telemetria da própria operação
                — verificável, sem autodeclaração.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <MiniStat value="332,85" unit="t" label="CO₂ no período" />
                <MiniStat value="1,04" unit="kg/km" label="Emissão média por km" />
                <MiniStat value="2.377" label="Árvores p/ compensar" />
              </div>
            </div>
          </div>
        </section>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Wind} label="Consumo total" value="637.706" unit="L" color="var(--brand-sky)" />
          <StatTile icon={Leaf} label="t CO₂ acumulado" value="1.659,95" color="var(--leaf)" />
          <StatTile icon={Truck} label="Km rodados" value="1,59M" color="var(--brand-navy)" />
          <StatTile icon={TreePine} label="Árvores estimadas" value="11.852" color="var(--leaf)" foot="compensação total do ano" />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Emissões totais por mês" icon={Leaf} bodyClassName="p-4">
            <Bars data={EMISSAO_MES} labels={MESES} suffix=" t" />
          </Card>
          <Card title="Emissão média por km" icon={Wind} bodyClassName="p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-4xl font-bold tabular-nums">1,04</p>
                <p className="mt-1 text-sm text-muted-foreground">kg CO₂/km · média do período</p>
                <p className="mt-4 text-xs leading-relaxed text-ink-soft">
                  Estável ao longo do ano, com leve queda em março. Rotas refrigeradas puxam a média
                  para cima.
                </p>
              </div>
              <Sparkline data={KG_POR_KM} color="var(--teal)" width={160} height={70} />
            </div>
          </Card>
        </div>

        <Card
          title="Panorama de emissões da frota"
          icon={Truck}
          action={<Pill tone="green">CSV disponível</Pill>}
          bodyClassName="p-4"
        >
          <DataTable columns={COLS} rows={ROWS} />
        </Card>

        {/* Bloco reservado para o conteúdo da certificação que o cliente vai enviar. */}
        <section className="mt-6 rounded-2xl border border-dashed border-leaf-line bg-leaf-tint/40 p-6">
          <SSGreenBadge />
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">
            <strong className="text-foreground">Sobre o selo.</strong> Este bloco está reservado para
            a narrativa da certificação SS Green — critérios, metodologia de cálculo e o que a frota
            precisa cumprir para emitir o selo CO₂ Reduzido. Assim que você me enviar o conteúdo, ele
            entra aqui.
          </p>
        </section>

        <p className="py-6 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}

function MiniStat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-white/70 px-4 py-3 backdrop-blur">
      <p className="font-display text-xl font-bold tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

/** Barras verticais simples com rótulo — evolução mensal. */
function Bars({ data, labels, suffix = "" }: { data: number[]; labels: string[]; suffix?: string }) {
  const max = Math.max(...data);
  return (
    <div className="flex h-52 items-end gap-2">
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">{v}{suffix}</span>
          <div
            className="w-full rounded-t-md bg-gradient-to-t from-leaf to-brand-green transition-all hover:opacity-80"
            style={{ height: `${Math.max(4, (v / max) * 150)}px` }}
          />
          <span className="text-[10.5px] text-muted-foreground">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}
