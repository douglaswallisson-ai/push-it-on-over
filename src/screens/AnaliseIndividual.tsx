import { useState } from "react";
import {
  ChevronDown,
  Fuel,
  Gauge,
  LineChart,
  Octagon,
  Printer,
  Route,
  Timer,
  TrendingUp,
  Truck,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card } from "@/components/ss/ui/data";
import { AccelBands, IndicatorCard, ScoreGauge } from "@/components/ss/ui/gauges";
import { Sparkline } from "@/components/ss/ui/Sparkline";
import { TelemetryModal } from "@/components/ss/frota/TelemetryModal";
import type { LucideIcon } from "lucide-react";

/**
 * Análise individual — desempenho detalhado de um veículo: nota, indicadores de
 * condução, pressão do acelerador e estatísticas do período. Espelha a análise
 * do produto de referência, no padrão visual da marca. Dados de exemplo.
 */

const INDICADORES: Array<{ label: string; value: number; tone: "leaf" | "gold" | "coral" | "sky" }> = [
  { label: "Início em faixa verde", value: 66, tone: "gold" },
  { label: "Aproveitamento de embalo", value: 31, tone: "coral" },
  { label: "Motor ligado parado", value: 36, tone: "coral" },
  { label: "Acelerando acima do verde", value: 2, tone: "leaf" },
  { label: "Excesso de velocidade", value: 8, tone: "gold" },
  { label: "Piloto automático", value: 1, tone: "coral" },
];

const STATS: Array<{ icon: LucideIcon; label: string; value: string; unit?: string }> = [
  { icon: Route, label: "Km total", value: "7.293", unit: "km" },
  { icon: Gauge, label: "Velocidade média", value: "63", unit: "km/h" },
  { icon: Fuel, label: "Consumo total", value: "2.443", unit: "L" },
  { icon: TrendingUp, label: "Média do bordo", value: "2,99", unit: "km/l" },
  { icon: Truck, label: "Odômetro", value: "812.977", unit: "km" },
  { icon: Octagon, label: "Freadas totais", value: "552" },
  { icon: Octagon, label: "Freadas alta veloc.", value: "116" },
  { icon: Timer, label: "Freadas / 100 km", value: "7,6" },
];

const NOTA_TREND = [40, 41, 38, 44, 39, 37, 41];

export default function AnaliseIndividual() {
  const [grafico, setGrafico] = useState(false);
  return (
    <>
      <PageHeader
        title="Acompanhamento do veículo"
        subtitle="Frota › Desempenho do veículo"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setGrafico(true)} className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">
              <LineChart className="h-[15px] w-[15px]" />
              Gráfico
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary">
              <Printer className="h-[15px] w-[15px]" />
              Imprimir
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Frota · Análise individual"
          title={
            <span className="flex flex-wrap items-center gap-3">
              DAF XF105 FT 460
              <button className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[12px] font-medium backdrop-blur">
                EBZ3590 · Najla Maltaca
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </span>
          }
          subtitle="Período: 01–30 jun 2026 · 2020 · placa LB109710"
        >
          <div className="flex items-center gap-6">
            <HeroMetric value="63" unit="km/h" label="Velocidade média" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value="2,99" unit="km/l" label="Média do bordo" />
          </div>
        </HeroBanner>

        {/* Desempenho + indicadores. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          <Card title="Desempenho" icon={Gauge} tourId="score">
            <div className="flex flex-col items-center gap-4">
              <ScoreGauge score={41} />
              <div className="flex w-full items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
                <span className="text-[12px] text-muted-foreground">Tendência (7 dias)</span>
                <Sparkline data={NOTA_TREND} color="var(--coral)" width={90} height={28} />
              </div>
              <p className="text-center text-[12px] leading-relaxed text-muted-foreground">
                Nota abaixo da meta (60). O maior peso vem de motor ligado parado e baixo
                aproveitamento de embalo.
              </p>
            </div>
          </Card>

          <div>
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="inline-block h-px w-4 bg-current opacity-50" />
              Indicadores de condução
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {INDICADORES.map((ind) => (
                <IndicatorCard key={ind.label} label={ind.label} value={ind.value} tone={ind.tone} />
              ))}
            </div>
          </div>
        </div>

        {/* Acelerador + estatísticas. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
          <Card title="Pressão do acelerador" icon={Gauge} tourId="accel">
            <AccelBands ideal={58} atencao={16} critico={26} />
          </Card>

          <Card title="Estatísticas do período" icon={TrendingUp}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-secondary/40 p-3">
                  <s.icon className="h-4 w-4 text-brand-navy" />
                  <p className="mt-2 font-display text-lg font-bold tabular-nums">
                    {s.value}
                    {s.unit && <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">{s.unit}</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>

      {grafico && (
        <TelemetryModal titulo="EBZ3590 · Najla Maltaca" periodo="01/06/2026 00:00 – 30/06/2026 23:59" onClose={() => setGrafico(false)} />
      )}
    </>
  );
}
