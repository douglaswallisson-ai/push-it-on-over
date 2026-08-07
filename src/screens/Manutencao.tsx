import { useState } from "react";
import {
  Activity,
  CalendarClock,
  ChevronDown,
  ClipboardList,
  History,
  Sparkles,
  TrendingDown,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner } from "@/components/ss/ui/HeroBanner";
import { Card, Pill } from "@/components/ss/ui/data";
import { ScoreGauge } from "@/components/ss/ui/gauges";
import { BusInspection, HOTSPOTS } from "@/components/ss/frota/BusInspection";
import { cn } from "@/lib/utils";

/**
 * Manutenção — inspeção visual do veículo com hotspots de saúde, predições de
 * manutenção e fatores de risco. Inspirado no módulo que o cliente trouxe, com
 * ônibus e no padrão visual da marca. Dados de exemplo.
 */

const TABS = [
  { id: "geral", label: "Visão geral", icon: Activity },
  { id: "consumiveis", label: "Consumíveis", icon: Wrench },
  { id: "telemetria", label: "Telemetria", icon: Activity },
  { id: "predicoes", label: "Predições", icon: Sparkles },
  { id: "historico", label: "Histórico", icon: History },
];

const PREDICOES = [
  { titulo: "Troca de óleo do motor", prazo: "8 dias", custo: "R$ 850", tone: "crit" as const },
  { titulo: "Substituição do filtro de ar", prazo: "25 dias", custo: "R$ 320", tone: "warn" as const },
  { titulo: "Rodízio de pneus", prazo: "30 dias", custo: "R$ 200", tone: "warn" as const },
];

const RISCOS = [
  { fator: "Troca de óleo próxima do limite", pts: -15, tone: "coral" },
  { fator: "Pressão do pneu traseiro baixa", pts: -5, tone: "gold" },
  { fator: "Filtro de ar com 25% de vida útil", pts: -3, tone: "gold" },
];

/**
 * Foto real do veículo. Coloque o arquivo em `public/` (ex.: public/onibus.jpg,
 * de preferência perfil lateral) e troque para "/onibus.jpg". Enquanto for null,
 * usa a ilustração de reserva.
 */
const BUS_PHOTO: string | null = "/onibus.webp";

export default function Manutencao() {
  const [tab, setTab] = useState("geral");
  const [selected, setSelected] = useState<string | null>("oleo");
  const comp = HOTSPOTS.find((h) => h.id === selected) ?? null;
  const totalPts = RISCOS.reduce((a, r) => a + r.pts, 0);

  return (
    <>
      <PageHeader
        title="Manutenção"
        subtitle="Frota › Inspeção visual e predições"
        actions={
          <button className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary">
            TWIN004 · VW Constellation
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-5 px-6 py-6 md:px-8">
        {/* Cabeçalho do veículo + índice de saúde, na faixa da marca. */}
        <HeroBanner
          orb
          eyebrow="Frota · Manutenção"
          title={
            <span className="flex flex-wrap items-center gap-2.5">
              TWIN004
              <span className="rounded-full bg-coral-tint px-2.5 py-0.5 text-[12px] font-semibold text-coral">
                Óleo crítico
              </span>
            </span>
          }
          subtitle="Volkswagen Constellation 25.460 · 2023 — inspeção visual e predições, atualizado às 10:27."
        >
          <div
            data-tour="score"
            className="flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-elegant"
          >
            <ScoreGauge score={45} size={84} />
            <div className="text-[12px] leading-tight text-muted-foreground">
              <p className="font-semibold text-foreground">Índice de saúde</p>
              <p>atualizado 10:27</p>
            </div>
          </div>
        </HeroBanner>

        {/* Abas. */}
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-card">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-medium transition-colors",
                tab === t.id ? "bg-brand-navy text-white" : "text-muted-foreground hover:bg-secondary",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
          {/* Predições + riscos. */}
          <div data-tour="predicoes" className="space-y-5">
            <Card title="Predições de manutenção" icon={CalendarClock} action={<Pill tone="sky">Confiança 87%</Pill>}>
              <div className="space-y-3">
                {PREDICOES.map((p) => (
                  <div
                    key={p.titulo}
                    className={cn(
                      "rounded-xl border p-3",
                      p.tone === "crit" ? "border-coral-line bg-coral-tint/50" : "border-gold-line bg-gold-tint/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13.5px] font-semibold text-foreground">{p.titulo}</p>
                      <span className={cn("shrink-0 font-mono text-[12px] font-bold", p.tone === "crit" ? "text-coral" : "text-gold")}>
                        {p.prazo}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <button className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-navy hover:text-brand-blue">
                        <Wrench className="h-3.5 w-3.5" />
                        Agendar manutenção
                      </button>
                      <span className="font-mono text-[12.5px] font-semibold text-foreground">{p.custo}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Fatores de risco" icon={TrendingDown}>
              <div className="space-y-2.5">
                {RISCOS.map((r) => (
                  <div key={r.fator} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                      <span className={cn("inline-block h-2 w-2 rounded-full", r.tone === "coral" ? "bg-coral" : "bg-gold")} />
                      {r.fator}
                    </span>
                    <span className={cn("shrink-0 font-mono text-[12.5px] font-semibold", r.tone === "coral" ? "text-coral" : "text-gold")}>
                      {r.pts} pts
                    </span>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[13px] font-semibold text-foreground">Impacto total no índice</span>
                  <span className="font-display text-lg font-bold text-coral">{totalPts} pts</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Inspeção visual. */}
          <Card title="Inspeção visual" icon={ClipboardList} action={<span className="text-[12px] text-muted-foreground">clique nos componentes</span>}>
            <div className="rounded-xl bg-gradient-to-b from-secondary/40 to-transparent p-4">
              <BusInspection selected={selected} onSelect={setSelected} image={BUS_PHOTO} />
            </div>

            {/* Legenda. */}
            <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-ink-soft">
              <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-leaf" /> Saudável</span>
              <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-gold" /> Atenção</span>
              <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-coral" /> Crítico</span>
            </div>

            {/* Detalhe do componente selecionado. */}
            {comp && (
              <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", comp.tone === "crit" ? "bg-coral-tint" : comp.tone === "warn" ? "bg-gold-tint" : "bg-leaf-tint")}>
                      <comp.icon className={cn("h-5 w-5", comp.tone === "crit" ? "text-coral" : comp.tone === "warn" ? "text-gold" : "text-leaf")} />
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-foreground">{comp.label}</p>
                      <p className="font-mono text-[12px] text-muted-foreground">Leitura atual: {comp.value}</p>
                    </div>
                  </div>
                  <Pill tone={comp.tone === "crit" ? "coral" : comp.tone === "warn" ? "gold" : "green"}>
                    {comp.tone === "crit" ? "Crítico" : comp.tone === "warn" ? "Atenção" : "Saudável"}
                  </Pill>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{comp.detail}</p>
                <p className="mt-2 flex items-start gap-2 text-[13px] leading-relaxed text-brand-navy">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
                  {comp.recomendacao}
                </p>
              </div>
            )}
          </Card>
        </div>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Dados de exemplo · ilustração vetorial no lugar da foto real do veículo.
        </p>
      </div>
    </>
  );
}
