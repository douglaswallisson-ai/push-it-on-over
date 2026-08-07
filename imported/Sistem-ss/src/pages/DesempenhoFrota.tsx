import { useState } from "react";
import { BarChart3, Gauge, Layers, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ui/HeroBanner";
import { Card, DataTable, Pill, type Column, type PillTone } from "@/components/ui/data";
import { ScoreGauge } from "@/components/ui/gauges";
import { cn } from "@/lib/utils";

/**
 * Desempenho por categoria de frota — distribui as placas em Excelente /
 * Regular / Atenção / Crítico e mostra a evolução mês a mês. Dados de exemplo.
 */

const CATEGORIAS: Array<{ label: string; qtd: number; pct: number; nota: string; tone: PillTone }> = [
  { label: "Excelente", qtd: 0, pct: 0, nota: "—", tone: "green" },
  { label: "Regular", qtd: 5, pct: 11, nota: "63", tone: "sky" },
  { label: "Atenção", qtd: 2, pct: 5, nota: "51", tone: "gold" },
  { label: "Crítico", qtd: 37, pct: 84, nota: "29", tone: "coral" },
];

type MesRow = { mes: string; excelente: number; regular: number; atencao: number; critico: number; total: number };
const MESES: MesRow[] = [
  { mes: "Janeiro/26", excelente: 1, regular: 11, atencao: 7, critico: 21, total: 40 },
  { mes: "Fevereiro/26", excelente: 0, regular: 2, atencao: 1, critico: 5, total: 8 },
  { mes: "Março/26", excelente: 0, regular: 1, atencao: 2, critico: 5, total: 8 },
  { mes: "Abril/26", excelente: 0, regular: 7, atencao: 7, critico: 30, total: 44 },
  { mes: "Maio/26", excelente: 1, regular: 5, atencao: 5, critico: 33, total: 44 },
  { mes: "Junho/26", excelente: 0, regular: 5, atencao: 2, critico: 37, total: 44 },
];

const cellClasses = "px-4 py-2.5 text-center font-mono";
const MES_COLS: Column<MesRow>[] = [
  { key: "mes", header: "Mês", render: (r) => <span className="font-medium text-foreground">{r.mes}</span> },
  { key: "excelente", header: "Excelente", align: "center", render: (r) => <BarCell value={r.excelente} color="var(--leaf)" /> },
  { key: "regular", header: "Regular", align: "center", render: (r) => <BarCell value={r.regular} color="var(--brand-sky)" /> },
  { key: "atencao", header: "Atenção", align: "center", render: (r) => <BarCell value={r.atencao} color="var(--gold)" /> },
  { key: "critico", header: "Crítico", align: "center", render: (r) => <BarCell value={r.critico} color="var(--coral)" /> },
  { key: "total", header: "Total", align: "center", render: (r) => <span className="font-mono font-bold">{r.total}</span> },
];

function BarCell({ value, color }: { value: number; color: string }) {
  return (
    <div className="mx-auto w-16">
      <div className="font-mono text-[13px] text-ink-soft">{value}</div>
      <div className="mt-0.5 h-1 w-full rounded-full" style={{ background: color, opacity: value === 0 ? 0.2 : 1 }} />
    </div>
  );
}

const RANKING = [
  { nome: "Marco Taborda", nota: 88, tone: "green" as PillTone },
  { nome: "Rosemeri Tuono", nota: 81, tone: "green" as PillTone },
  { nome: "Najla Maltaca", nota: 65, tone: "gold" as PillTone },
  { nome: "Guilherme Souza", nota: 41, tone: "coral" as PillTone },
  { nome: "Davi Nadalin", nota: 13, tone: "coral" as PillTone },
];

export default function DesempenhoFrota() {
  const [modo, setModo] = useState<"placas" | "nota">("placas");

  return (
    <>
      <PageHeader title="Desempenho da frota" subtitle="Distribuição por categoria · média dos últimos 12 meses" />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner orb eyebrow="Frota · Desempenho por categoria" title="Onde a frota está" subtitle="Cada placa classificada em Excelente, Regular, Atenção ou Crítico — e como isso evolui mês a mês.">
          <div className="flex items-center gap-4">
            <ScoreGauge score={39} size={92} />
            <div className="text-[12px] leading-tight text-white/70">
              <p className="font-semibold text-white">Nota geral</p>
              <p>44 placas</p>
            </div>
          </div>
        </HeroBanner>

        {/* Categorias. */}
        <Card
          title="Desempenho por categoria de frota"
          icon={Layers}
          action={
            <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
              {(["placas", "nota"] as const).map((m) => (
                <button key={m} onClick={() => setModo(m)} className={cn("rounded-md px-3 py-1 text-[12px] font-medium transition-colors", modo === m ? "bg-white text-foreground shadow-sm" : "text-muted-foreground")}>
                  {m === "placas" ? "Quantidade de placas" : "Nota de performance"}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {CATEGORIAS.map((c) => (
              <div key={c.label} className="rounded-xl border border-border p-4">
                <Pill tone={c.tone}>{c.label}</Pill>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-bold tabular-nums">{modo === "placas" ? c.qtd : c.nota}</span>
                  {modo === "placas" && <span className="text-[12px] text-muted-foreground">· {c.pct}%</span>}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{modo === "placas" ? `nota média: ${c.nota}` : `${c.qtd} placas`}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className={cn("h-1.5 rounded-full", c.tone === "green" ? "bg-leaf" : c.tone === "sky" ? "bg-brand-sky" : c.tone === "gold" ? "bg-gold" : "bg-coral")} style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Evolução mensal. */}
        <Card title="Evolução por mês" icon={BarChart3} bodyClassName="p-4">
          <DataTable columns={MES_COLS} rows={MESES} />
        </Card>

        {/* Motoristas por desempenho. */}
        <Card title="Motoristas por desempenho" icon={Trophy}>
          <ol className="space-y-2">
            {RANKING.map((r, i) => (
              <li key={r.nome} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary font-mono text-[11px] font-bold text-muted-foreground">{i + 1}</span>
                <span className="flex-1 text-[13.5px] font-medium">{r.nome}</span>
                <Pill tone={r.tone}><Gauge className="h-3 w-3" />{r.nota}</Pill>
              </li>
            ))}
          </ol>
        </Card>

        <p className="pb-4 text-center text-xs text-muted-foreground">Dados de exemplo — protótipo de interface, sem dados reais.</p>
      </div>
    </>
  );
}
