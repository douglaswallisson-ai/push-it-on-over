import { useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import {
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  Check,
  Eye,
  Fuel,
  Gauge,
  IdCard,
  LineChart,
  Octagon,
  Play,
  Route,
  Smartphone,
  Timer,
  TrendingUp,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, Pill } from "@/components/ss/ui/data";
import { AccelBands, IndicatorCard, ScoreGauge } from "@/components/ss/ui/gauges";
import { Sparkline } from "@/components/ss/ui/Sparkline";
import { TelemetryModal } from "@/components/ss/frota/TelemetryModal";
import { HistoricoConducao } from "@/components/ss/frota/HistoricoConducao";
import { FaixasConducao } from "@/components/ss/frota/FaixasConducao";
import { DesempenhoPorContexto } from "@/components/ss/frota/DesempenhoPorContexto";
import { faixasDoMotorista, MOCK_CNH } from "@/lib/mock-data";
import { CNH_LABEL, CNH_TONE, dataBR, exigeAtencao, prazoCNH, statusCNH } from "@/lib/cnh";
import { cn } from "@/lib/utils";

/**
 * Acompanhamento do motorista — desempenho detalhado de um motorista:
 * nota, indicadores de condução, pressão do acelerador, estatísticas, o gráfico
 * de telemetria e os eventos de vídeo com validação (a IA pode se enganar).
 * Dados de exemplo.
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
  { icon: Route, label: "Km rodado", value: "7.216", unit: "km" },
  { icon: Gauge, label: "Velocidade média", value: "58", unit: "km/h" },
  { icon: Fuel, label: "Consumo total", value: "3.422", unit: "L" },
  { icon: TrendingUp, label: "Média do bordo", value: "2,11", unit: "km/l" },
  { icon: Octagon, label: "Freadas totais", value: "38" },
  { icon: Timer, label: "Freadas / 100 km", value: "5,3" },
];

const NOTA_TREND = [58, 61, 66, 63, 68, 71, 71];

type VideoEvento = { id: string; tipo: string; hora: string; icon: LucideIcon };
const VIDEOS: VideoEvento[] = [
  { id: "v1", tipo: "Fadiga detectada", hora: "07:12", icon: BedDouble },
  { id: "v2", tipo: "Uso de celular", hora: "10:41", icon: Smartphone },
  { id: "v3", tipo: "Distração", hora: "14:22", icon: Eye },
];

export default function AcompanhamentoMotorista() {
  const navigate = useNavigate();
  const { nome } = useParams();
  const motorista = nome ? decodeURIComponent(nome) : "Crísala Boni";
  const [grafico, setGrafico] = useState(false);
  const [validacao, setValidacao] = useState<Record<string, "correto" | "falso">>({});

  return (
    <>
      <PageHeader
        title="Acompanhamento do motorista"
        subtitle="Motoristas › Desempenho"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setGrafico(true)} className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">
              <LineChart className="h-[15px] w-[15px]" />
              Gráfico
            </button>
            <button onClick={() => navigate("/app/motoristas")} className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-secondary">
              <ArrowLeft className="h-[15px] w-[15px]" />
              Voltar
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner orb eyebrow="Motoristas · Acompanhamento" title={motorista} subtitle="Filial RJ · período 01–30 set 2026">
          <div className="flex items-center gap-6">
            <HeroMetric value="7.216" unit="km" label="Rodados no período" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value="2,11" unit="km/l" label="Média do bordo" />
          </div>
        </HeroBanner>

        {/* Situação da CNH — o alerta de vencimento vive aqui, não só na lista. */}
        <CartaoCNH nome={motorista} />

        {/* Desempenho + indicadores. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          <Card title="Desempenho" icon={Gauge}>
            <div className="flex flex-col items-center gap-4">
              <ScoreGauge score={71} />
              <div className="flex w-full items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
                <span className="text-[12px] text-muted-foreground">Tendência (7 dias)</span>
                <Sparkline data={NOTA_TREND} color="var(--leaf)" width={90} height={28} />
              </div>
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
          <Card title="Pressão do acelerador" icon={Gauge}>
            <AccelBands ideal={64} atencao={22} critico={14} />
          </Card>

          <Card title="Estatísticas do período" icon={TrendingUp}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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

        {/* Eventos de vídeo com validação. */}
        <Card title="Eventos de vídeo do período" icon={Play} action={<Pill tone="sky">{VIDEOS.length} eventos</Pill>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {VIDEOS.map((v) => (
              <div key={v.id} className="rounded-xl border border-border p-3">
                <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-[#122a52]">
                  <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 50% 40%, #2651A6, transparent 70%)" }} />
                  <Play className="relative h-7 w-7 text-white/90" fill="currentColor" />
                  <span className="absolute bottom-1.5 left-2 font-mono text-[10px] text-white/70">{v.hora}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <v.icon className="h-4 w-4 text-coral" />
                  <span className="text-[13px] font-semibold text-foreground">{v.tipo}</span>
                </div>
                {validacao[v.id] ? (
                  <span className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold", validacao[v.id] === "correto" ? "bg-leaf-tint text-leaf" : "bg-secondary text-muted-foreground")}>
                    {validacao[v.id] === "correto" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {validacao[v.id] === "correto" ? "Correto" : "Falso positivo"}
                    <button onClick={() => setValidacao((m) => ({ ...m, [v.id]: m[v.id] === "correto" ? "falso" : "correto" }))} className="ml-1 underline opacity-70">alterar</button>
                  </span>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => setValidacao((m) => ({ ...m, [v.id]: "correto" }))} className="inline-flex flex-1 items-center justify-center gap-1 rounded-full bg-brand-green px-2.5 py-1.5 text-[12px] font-semibold text-[oklch(0.15_0.03_260)]">
                      <Check className="h-3.5 w-3.5" /> Correto
                    </button>
                    <button onClick={() => setValidacao((m) => ({ ...m, [v.id]: "falso" }))} className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-border bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink-soft hover:bg-secondary">
                      <X className="h-3.5 w-3.5" /> Falso
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">A IA pode se enganar — confirme cada evento ou marque como falso positivo.</p>
        </Card>

        {/* Nota contra o padrão de cada linha que ele rodou. */}
        <div data-tour="contexto">
          <DesempenhoPorContexto motorista={motorista} />
        </div>

        {/* Faixas de condução do motorista. */}
        <FaixasConducao
          distribuicao={faixasDoMotorista(motorista)}
          titulo="Faixas de condução"
          subtitulo="Distribuição do tempo de condução deste motorista nas 14 faixas."
        />

        {/* Veículos que este motorista dirigiu. */}
        <HistoricoConducao modo="motorista" motoristaNome={motorista} />

        <p className="pb-4 text-center text-xs text-muted-foreground">Dados de exemplo — protótipo de interface, sem dados reais.</p>
      </div>

      {grafico && (
        <TelemetryModal titulo={`${motorista} · veículo OUH0C81`} periodo="14/09/2026 00:00 – 23:59" onClose={() => setGrafico(false)} />
      )}
    </>
  );
}

/* ---------------------------------- CNH ---------------------------------- */

/**
 * Situação do documento do motorista. A validade é opcional no cadastro, então
 * "sem informação" é um estado legítimo — e visível, para o gestor saber que
 * falta digitalizar, em vez de assumir que está tudo certo.
 */
function CartaoCNH({ nome }: { nome: string }) {
  const cnh = MOCK_CNH[nome] ?? {};
  const status = statusCNH(cnh.validade);
  const alerta = exigeAtencao(status);

  const tone = CNH_TONE[status];
  const cls =
    tone === "coral"
      ? "border-coral-line bg-coral-tint/40 text-coral"
      : tone === "gold"
        ? "border-gold-line bg-gold-tint/40 text-gold"
        : tone === "green"
          ? "border-leaf-line bg-leaf-tint/40 text-leaf"
          : "border-border bg-secondary/40 text-muted-foreground";

  return (
    <div data-tour="cnh" className={cn("flex flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-3", cls)}>
      <div className="flex items-center gap-3">
        {alerta ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <IdCard className="h-5 w-5 shrink-0" />}
        <div>
          <p className="text-[13.5px] font-semibold">
            {CNH_LABEL[status]}
            {cnh.validade ? ` — ${prazoCNH(cnh.validade)}` : ""}
          </p>
          <p className="text-[12px] opacity-80">
            {cnh.numero ? `CNH ${cnh.numero}` : "Número não informado"}
            {cnh.categoria ? ` · categoria ${cnh.categoria}` : ""}
            {cnh.validade ? ` · válida até ${dataBR(cnh.validade)}` : " · validade não informada"}
          </p>
        </div>
      </div>
      {alerta && (
        <span className="rounded-full bg-white/70 px-3 py-1 text-[12px] font-semibold">
          Renovação necessária antes de escalar
        </span>
      )}
    </div>
  );
}
