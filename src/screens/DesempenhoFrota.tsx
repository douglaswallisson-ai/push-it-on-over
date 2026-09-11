import { useMemo, useState } from "react";
import { BarChart3, Clock, Droplet, Gauge, Layers, Leaf, TrendingDown, Trophy, Truck } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { Sparkline } from "@/components/ss/ui/Sparkline";
import { FaixasConducao } from "@/components/ss/frota/FaixasConducao";
import { MOCK_FAIXAS_FROTA } from "@/lib/mock-data";
import { usandoMock } from "@/lib/modo";
import { useIndicadoresPorVeiculo } from "@/hooks/use-indicadores-veiculo";
import { ScoreGauge } from "@/components/ss/ui/gauges";
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
  /**
   * Distribuição de faixas a partir da telemetria do período.
   *
   * Sem medição a lista vai vazia, e o componente mostra o estado
   * correspondente — melhor que exibir a curva de uma frota inventada ao lado
   * de indicadores reais.
   */
  const indicadoresFrota = useIndicadoresPorVeiculo(30);
  const distribuicaoReal = useMemo<Record<string, number>>(() => {
    const vals = [...indicadoresFrota.porVeiculo.values()];
    if (!vals.length) return {} as Record<string, number>;

    const media = (sel: (v: (typeof vals)[number]) => number | null) => {
      const uteis = vals.map(sel).filter((n): n is number => n != null);
      return uteis.length ? Math.round(uteis.reduce((a, n) => a + n, 0) / uteis.length) : 0;
    };

    return {
      verde: media((v) => v.faixaVerdePct),
      motor_ligado_parado: media((v) => v.motorLigadoParadoPct),
    };
  }, [indicadoresFrota.porVeiculo]);

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

        {/* Faixas de condução — média da frota. */}
        <FaixasConducao
          distribuicao={usandoMock() ? MOCK_FAIXAS_FROTA : distribuicaoReal}
          titulo="Faixas de condução — média da frota"
          subtitulo="Como o tempo da frota se distribui entre as 14 faixas. Comparável com a leitura por veículo e por motorista."
        />

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

        {/* Motor ligado parado — antes era rota separada. */}
        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-foreground">Motor ligado parado</h2>
            <span className="text-[11.5px] text-muted-foreground">últimos 7 dias · toda a frota</span>
          </div>
          <MotorLigadoParado />
        </div>

        <p className="pb-4 text-center text-xs text-muted-foreground">Dados de exemplo — protótipo de interface, sem dados reais.</p>
      </div>
    </>
  );
}

/* --------------------------- Motor ligado parado --------------------------- */

/**
 * Motor ligado parado passou a viver aqui dentro: é um indicador de eficiência
 * de condução, não um módulo próprio. Antes ocupava uma rota e um item de menu
 * separados, o que quebrava a leitura de "desempenho da frota" em dois lugares.
 */

type OciosoRow = {
  placa: string;
  motorista: string;
  tempo: string;
  litros: string;
  custo: string;
  trend: number[];
};

const OCIOSO: OciosoRow[] = [
  { placa: "EBZ3590", motorista: "Remildo N. Lima", tempo: "03:44", litros: "11,2 L", custo: "R$ 67,20", trend: [2, 3, 3, 4, 3, 4, 4] },
  { placa: "QHH1360", motorista: "Henrique", tempo: "02:27", litros: "7,4 L", custo: "R$ 44,40", trend: [1, 2, 2, 3, 2, 3, 3] },
  { placa: "GAP4C73", motorista: "Roberto Tomaz", tempo: "01:50", litros: "5,5 L", custo: "R$ 33,00", trend: [3, 2, 2, 2, 1, 2, 2] },
  { placa: "OUH0C81", motorista: "Thiago Bora", tempo: "01:31", litros: "4,6 L", custo: "R$ 27,60", trend: [1, 1, 2, 2, 2, 1, 2] },
  { placa: "SMS1J35", motorista: "\u2014", tempo: "01:17", litros: "3,9 L", custo: "R$ 23,40", trend: [2, 1, 1, 1, 2, 1, 1] },
];

const OCIOSO_COLS: Column<OciosoRow & Record<string, unknown>>[] = [
  {
    key: "placa",
    header: "Ve\u00edculo",
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
  { key: "litros", header: "Combust\u00edvel", align: "right", render: (r) => <span className="font-mono text-coral">{r.litros}</span> },
  { key: "custo", header: "Custo estimado", align: "right", render: (r) => <span className="font-semibold text-foreground">{r.custo}</span> },
  { key: "trend", header: "Tend\u00eancia (7d)", align: "right", render: (r) => <div className="flex justify-end"><Sparkline data={r.trend} color="var(--coral)" width={80} height={26} /></div> },
];

function MotorLigadoParado() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Clock} label="Tempo total ocioso" value="41h" color="var(--gold)" />
        <StatTile icon={Droplet} label="Litros desperdi\u00e7ados" value="530" unit="L" color="var(--coral)" />
        <StatTile icon={TrendingDown} label="Custo estimado" value="R$ 3.180" color="var(--brand-navy)" />
        <StatTile icon={Leaf} label="CO\u2082 evit\u00e1vel" value="1,4" unit="t" color="var(--leaf)" />
      </div>

      <Card title="Ranking \u2014 maiores tempos parados" icon={Clock} bodyClassName="p-4">
        <DataTable columns={OCIOSO_COLS} rows={OCIOSO as (OciosoRow & Record<string, unknown>)[]} />
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Motor ligado com o ve\u00edculo parado \u2014 combust\u00edvel queimado sem rodar um metro.
        </p>
      </Card>
    </div>
  );
}
