import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usandoMock } from "@/lib/modo";
import { rankingMotoristasQuery, veiculosApiQuery } from "@/lib/queries";
import { distribuicaoDoRanking } from "@/lib/api";
import { FaixasConducao } from "@/components/ss/frota/FaixasConducao";
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
import { useNavigate } from "@/lib/router-compat";
import { imprimir } from "@/lib/export";
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

function AnaliseIndividualExemplo() {
  const navigate = useNavigate();
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
            <button onClick={imprimir}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary">
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
              <button
                onClick={() => navigate("/app/veiculos")}
                title="Escolher outro veículo"
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[12px] font-medium backdrop-blur transition-colors hover:bg-white/20"
              >
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
            <p className="mb-3 flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
                    {s.unit && <span className="ml-0.5 text-[12px] font-medium text-muted-foreground">{s.unit}</span>}
                  </p>
                  <p className="mt-0.5 text-[12px] leading-tight text-muted-foreground">{s.label}</p>
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

/** Com dados de exemplo, a demonstração; ligado à API, o veículo real. */
export default function AnaliseIndividual() {
  return usandoMock() ? <AnaliseIndividualExemplo /> : <AnaliseIndividualReal />;
}

/* --------------------------------- Real --------------------------------- */

const fmt = (v: number | null | undefined, casas = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/**
 * Acompanhamento de um veículo, com a Pontuação do BI agrupada por placa
 * (`/driver-ranking?por=veiculo`, a "RANK POR PLACA" do Power BI).
 *
 * Fluxo corrigido: trocar de veículo acontece aqui, no seletor — antes o botão
 * mandava para a lista de Veículos, e o clique na lista mandava para
 * Manutenção, de modo que não havia caminho de volta para esta tela.
 */
function AnaliseIndividualReal() {
  const navigate = useNavigate();
  const veiculosQ = useQuery(veiculosApiQuery(1, 200));
  const rankingQ = useQuery(rankingMotoristasQuery(undefined, undefined, "veiculo"));
  const veiculos = useMemo(
    () => [...(veiculosQ.data?.items ?? [])].sort((a, b) => (a.prefixo ?? a.placa).localeCompare(b.prefixo ?? b.placa, "pt-BR", { numeric: true })),
    [veiculosQ.data],
  );

  const pedido = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("veiculo") : null;
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const id = escolhido ?? (veiculos.find((v) => v.id === pedido || v.placa === pedido)?.id ?? veiculos[0]?.id);
  const v = veiculos.find((x) => x.id === id);
  const r = rankingQ.data?.motoristas.find((m) => String(m.driver_id) === id);
  const total = rankingQ.data?.motoristas.filter((m) => m.posicao != null).length ?? 0;

  const trocar = (novo: string) => {
    setEscolhido(novo);
    // Mantém o endereço em dia: recarregar ou compartilhar abre o mesmo veículo.
    window.history.replaceState(null, "", `?veiculo=${novo}`);
  };

  const velMedia = r && r.horas > 0 ? r.km / r.horas : null;
  const e = r?.eventos_por_hora;
  const stats: { icon: LucideIcon; label: string; value: string; unit?: string }[] = [
    { icon: Route, label: "Km no período", value: fmt(r?.km), unit: "km" },
    { icon: Timer, label: "Horas trabalhadas", value: fmt(r?.horas, 1), unit: "h" },
    { icon: Gauge, label: "Velocidade média", value: fmt(velMedia, 1), unit: "km/h" },
    { icon: Fuel, label: "Combustível", value: fmt(r?.litros), unit: "L" },
    { icon: TrendingUp, label: "Média", value: fmt(r?.kml, 2), unit: "km/l" },
    { icon: Truck, label: "Odômetro", value: fmt(v?.odometro), unit: "km" },
    { icon: Octagon, label: "Freada brusca / h", value: fmt(e?.freada_brusca, 2) },
    { icon: Octagon, label: "Aceleração brusca / h", value: fmt(e?.aceleracao_brusca, 2) },
  ];
  const f = r?.faixas;

  return (
    <>
      <PageHeader
        title="Acompanhamento do veículo"
        subtitle={`Frota › Desempenho do veículo${rankingQ.data ? ` · ${new Date(rankingQ.data.inicio + "T12:00").toLocaleDateString("pt-BR")} a ${new Date(rankingQ.data.fim + "T12:00").toLocaleDateString("pt-BR")}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={id ?? ""}
              onChange={(ev) => trocar(ev.target.value)}
              className="h-9 max-w-[280px] rounded-full border border-border bg-white px-3 text-[13px]"
              title="Trocar de veículo"
            >
              {veiculos.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.prefixo ? `${x.prefixo} · ` : ""}
                  {x.placa}
                </option>
              ))}
            </select>
            {id && (
              <>
                <button onClick={() => navigate(`/app/frota/tracking?veiculo=${id}`)} className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-white">
                  <Route className="h-[15px] w-[15px]" />
                  Tracking
                </button>
                <button onClick={() => navigate(`/app/manutencao?placa=${v?.placa ?? ""}`)} className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-secondary">
                  Manutenção
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        {!v ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {veiculosQ.isPending ? "Carregando a frota…" : veiculosQ.error ? `Não foi possível carregar: ${(veiculosQ.error as Error).message}` : "Nenhum veículo na frota."}
          </p>
        ) : (
          <>
            <HeroBanner orb eyebrow="Frota · Análise individual" title={`${v.prefixo ? `${v.prefixo} · ` : ""}${v.placa}`} subtitle={`${v.marca} ${v.modelo}${v.ano ? ` · ${v.ano}` : ""}`}>
              <div className="flex items-center gap-6">
                <HeroMetric value={fmt(velMedia, 1)} unit="km/h" label="Velocidade média" />
                <div className="h-10 w-px bg-white/15" />
                <HeroMetric value={fmt(r?.kml, 2)} unit="km/l" label="Média" />
              </div>
            </HeroBanner>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
              <Card title="Pontuação" icon={Gauge}>
                <div className="flex flex-col items-center gap-3">
                  {rankingQ.isPending ? (
                    <p className="py-10 text-sm text-muted-foreground">Calculando…</p>
                  ) : r?.pontuacao == null ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Sem faixas de condução nos últimos 30 dias.</p>
                  ) : (
                    <>
                      <ScoreGauge score={Math.max(0, Math.min(100, r.pontuacao))} />
                      <p className="font-mono text-sm font-bold">{fmt(r.pontuacao, 2)} pontos</p>
                      <p className="text-[12px] text-muted-foreground">
                        {r.posicao}º de {fmt(total)} veículos
                      </p>
                    </>
                  )}
                </div>
              </Card>

              <div>
                <p className="mb-3 flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <span className="inline-block h-px w-4 bg-current opacity-50" />
                  Indicadores de condução (% do tempo nas 13 faixas)
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <IndicatorCard label="Faixa verde" value={f?.verde ?? 0} tone="leaf" />
                  <IndicatorCard label="Inércia" value={f?.inercia ?? 0} tone="leaf" />
                  <IndicatorCard label="Extra econômica" value={f?.extra_economica ?? 0} tone="leaf" />
                  <IndicatorCard label="Parado com motor ligado" value={f?.parado_ligado ?? 0} tone="gold" />
                  <IndicatorCard label="Faixa amarela" value={f?.amarela ?? 0} tone="gold" />
                  <IndicatorCard label="Faixa vermelha" value={f?.vermelha ?? 0} tone="coral" />
                </div>
              </div>
            </div>

            <Card title="Estatísticas do período" icon={TrendingUp}>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-border bg-secondary/40 p-3">
                    <s.icon className="h-4 w-4 text-brand-navy" />
                    <p className="mt-2 font-display text-lg font-bold tabular-nums">
                      {s.value}
                      {s.unit && <span className="ml-0.5 text-[12px] font-medium text-muted-foreground">{s.unit}</span>}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-tight text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </Card>

            {f && r?.pontuacao != null && (
              <FaixasConducao distribuicao={distribuicaoDoRanking(f)} titulo="Faixas de condução" subtitulo="Últimos 30 dias, nas 13 faixas do Power BI." />
            )}
          </>
        )}
      </div>
    </>
  );
}
