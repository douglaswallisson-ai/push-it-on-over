import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CloudRain,
  Database,
  Download,
  Droplets,
  Fuel,
  Gauge,
  Info,
  Loader2,
  MapPin,
  Route,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import {
  MAX_DIAS_CURSOR,
  urlExportCsv,
  useEstimativaExport,
  useRelatorioCursor,
  type TelemetriaApi,
} from "@/lib/relatorios-api";
import { usandoMock } from "@/lib/modo";
import { nf } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Telemetria por viagem.
 *
 * Primeira tela alimentada diretamente por `con_telemetry` — a tabela com 113
 * campos por viagem que existia desde sempre e nenhuma interface consumia.
 *
 * O que aparece aqui e não aparecia em lugar nenhum: tempo sob chuva, faixas de
 * condução por viagem, consumo real por trecho, ponto de interesse e cerca de
 * origem e destino, e linha quando o equipamento a envia.
 */

const hhmm = (segundos?: number | null) => {
  if (segundos == null) return "—";
  const m = Math.round(segundos / 60);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
};

const pct = (parte?: number | null, total?: number | null) =>
  parte != null && total ? Math.round((parte / total) * 100) : null;

/** Últimos 7 dias, que é a janela em que o gestor costuma trabalhar. */
function janelaPadrao() {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - 7 * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  return { inicio: iso(inicio), fim: iso(fim) };
}

export default function TelemetriaViagens() {
  const padrao = janelaPadrao();
  const [inicio, setInicio] = useState(padrao.inicio.slice(0, 10));
  const [fim, setFim] = useState(padrao.fim.slice(0, 10));
  const [pedirEstimativa, setPedirEstimativa] = useState(false);

  const filtro = useMemo(
    () => ({ inicio: `${inicio} 00:00:00`, fim: `${fim} 23:59:59`, limite: 500 }),
    [inicio, fim],
  );

  const q = useRelatorioCursor<TelemetriaApi>("telemetry", filtro);
  const estimativa = useEstimativaExport("telemetry", filtro, pedirEstimativa);

  const registros = q.registros;

  const totais = useMemo(() => {
    const km = registros.reduce((a, r) => a + (r.distance_traveled ?? 0), 0);
    const combustivel = registros.reduce((a, r) => a + (r.fuel_used ?? 0), 0);
    const chuva = registros.reduce((a, r) => a + (r.time_raining ?? 0), 0);
    const total = registros.reduce((a, r) => a + (r.total_time ?? 0), 0);
    return {
      km,
      combustivel,
      kml: combustivel ? km / combustivel : 0,
      chuvaPct: total ? Math.round((chuva / total) * 100) : 0,
      viagens: registros.length,
    };
  }, [registros]);

  const COLS: Column<TelemetriaApi & Record<string, unknown>>[] = [
    {
      key: "unit_label",
      header: "Veículo",
      render: (r) => (
        <div>
          <div className="font-mono text-[13px] font-bold text-foreground">{r.unit_label}</div>
          {r.driver_name && <div className="max-w-[150px] truncate text-[11px] text-muted-foreground">{r.driver_name}</div>}
        </div>
      ),
    },
    {
      key: "start_time",
      header: "Início / fim",
      render: (r) => (
        <span className="whitespace-nowrap font-mono text-[12px]">
          {r.start_time?.slice(5, 16)}
          <span className="mx-1 text-muted-foreground/50">→</span>
          {r.end_time ? r.end_time.slice(11, 16) : <span className="text-gold">em curso</span>}
        </span>
      ),
    },
    {
      key: "linha",
      header: "Linha",
      align: "center",
      render: (r) =>
        r.line_number ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="font-mono text-[12.5px] font-semibold text-foreground">{r.line_number}</span>
            {r.trip_direction != null && (
              <span className="rounded bg-secondary px-1.5 text-[10.5px] text-ink-soft">
                {r.trip_direction === 1 ? "volta" : "ida"}
              </span>
            )}
          </span>
        ) : (
          <span className="text-[11.5px] text-muted-foreground">—</span>
        ),
    },
    {
      key: "distance_traveled",
      header: "Distância",
      align: "right",
      render: (r) => <span className="font-mono text-[12.5px]">{r.distance_traveled?.toFixed(1) ?? "—"} km</span>,
    },
    {
      key: "tempos",
      header: "Movimento / parado",
      align: "right",
      render: (r) => (
        <span className="whitespace-nowrap font-mono text-[12px]">
          {hhmm(r.time_moving)}
          <span className="mx-1 text-muted-foreground/50">/</span>
          <span className={cn(pct(r.time_stopped, r.total_time)! > 30 ? "font-semibold text-gold" : "")}>
            {hhmm(r.time_stopped)}
          </span>
        </span>
      ),
    },
    {
      key: "efficiency_kml",
      header: "Consumo",
      align: "right",
      render: (r) => (
        <span className="font-mono text-[12.5px] font-semibold text-foreground">
          {r.efficiency_kml ? `${r.efficiency_kml.toFixed(2)} km/l` : "—"}
        </span>
      ),
    },
    {
      key: "faixas",
      header: "Faixa verde",
      align: "right",
      render: (r) => {
        const v = pct((r.time_green ?? 0) + (r.time_extra_eco ?? 0), r.time_moving);
        if (v == null) return <span className="text-[12px] text-muted-foreground">—</span>;
        return (
          <span className={cn("font-mono text-[12.5px] font-semibold", v >= 60 ? "text-leaf" : v >= 40 ? "text-gold" : "text-coral")}>
            {v}%
          </span>
        );
      },
    },
    {
      key: "time_raining",
      header: "Chuva",
      align: "right",
      render: (r) => {
        const v = pct(r.time_raining, r.total_time);
        if (!v) return <span className="text-[12px] text-muted-foreground">—</span>;
        return (
          <span className="inline-flex items-center gap-1 font-mono text-[12px] text-brand-sky">
            <CloudRain className="h-3 w-3" />
            {v}%
          </span>
        );
      },
    },
    {
      key: "max_speed",
      header: "Vel. máx.",
      align: "right",
      render: (r) => (
        <span className={cn("font-mono text-[12.5px]", (r.max_speed ?? 0) > 80 ? "font-semibold text-coral" : "")}>
          {r.max_speed ?? "—"}
        </span>
      ),
    },
    {
      key: "start_poi_name",
      header: "Origem → destino",
      render: (r) => (
        <span className="flex max-w-[220px] items-center gap-1 truncate text-[11.5px] text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          {r.start_poi_name || r.start_area_name || "—"}
          <span className="text-muted-foreground/50">→</span>
          {r.end_poi_name || r.end_area_name || "—"}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Telemetria por viagem"
        subtitle="Relatórios › Viagens consolidadas"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-2.5 text-[13px] outline-none focus:border-accent"
            />
            <span className="text-[12px] text-muted-foreground">até</span>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-2.5 text-[13px] outline-none focus:border-accent"
            />
            <button
              onClick={() => setPedirEstimativa(true)}
              disabled={usandoMock() || Boolean(q.erroJanela)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              <Download className="h-[15px] w-[15px]" />
              Exportar
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        {usandoMock() && (
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
            <p className="text-[12.5px] text-muted-foreground">
              Esta tela lê direto da API — não tem versão de exemplo. Alterne para <strong>API real</strong> em
              Console de gestão › Configurações para ver os dados.
            </p>
          </div>
        )}

        {q.erroJanela && (
          <div className="flex items-start gap-2.5 rounded-xl border border-coral-line bg-coral-tint/40 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
            <p className="text-[12.5px] text-coral">
              {q.erroJanela} As tabelas são particionadas por mês, e janelas maiores que {MAX_DIAS_CURSOR} dias
              obrigariam a varrer partições demais.
            </p>
          </div>
        )}

        {/* Estimativa antes de exportar. */}
        {pedirEstimativa && estimativa.data && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[12.5px] text-ink-soft">
              A exportação terá aproximadamente{" "}
              <strong className="text-foreground">{nf(estimativa.data.estimated_rows)} linhas</strong> e{" "}
              <strong className="text-foreground">{estimativa.data.estimated_size_mb.toFixed(1)} MB</strong>.
              {estimativa.data.warning && <span className="ml-1 text-gold">{estimativa.data.warning}</span>}
            </p>
            <span className="flex gap-2">
              <a
                href={urlExportCsv("telemetry", filtro)}
                onClick={() => {
                  toast.success("Download iniciado.");
                  setPedirEstimativa(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy px-3.5 py-1.5 text-[12.5px] font-semibold text-white"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar CSV
              </a>
              <button
                onClick={() => setPedirEstimativa(false)}
                className="rounded-full border border-border px-3.5 py-1.5 text-[12.5px] text-muted-foreground hover:bg-secondary"
              >
                Cancelar
              </button>
            </span>
          </div>
        )}

        {!usandoMock() && !q.erroJanela && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile icon={Route} label="Viagens" value={nf(totais.viagens)} color="var(--brand-navy)" />
              <StatTile icon={Gauge} label="Distância" value={nf(Math.round(totais.km))} unit="km" color="var(--brand-sky)" />
              <StatTile icon={Fuel} label="Combustível" value={nf(Math.round(totais.combustivel))} unit="L" color="var(--gold)" />
              <StatTile
                icon={Timer}
                label="Consumo médio"
                value={totais.kml.toFixed(2)}
                unit="km/l"
                color={totais.kml >= 2.5 ? "var(--leaf)" : "var(--coral)"}
              />
              <StatTile
                icon={Droplets}
                label="Tempo sob chuva"
                value={`${totais.chuvaPct}%`}
                color="var(--brand-sky)"
                foot="afeta consumo"
              />
            </div>

            <Card
              title="Viagens"
              icon={Route}
              action={
                <span className="flex items-center gap-2">
                  <Pill tone="sky">{nf(registros.length)} carregadas</Pill>
                  {q.hasNextPage && <Pill tone="neutral">há mais</Pill>}
                </span>
              }
              bodyClassName="p-4"
            >
              {q.isPending ? (
                <SkeletonRows rows={8} />
              ) : q.error ? (
                <ErrorBox error={q.error} onRetry={() => q.refetch()} />
              ) : registros.length === 0 ? (
                <EmptyNote>Nenhuma viagem no período selecionado.</EmptyNote>
              ) : (
                <>
                  <DataTable columns={COLS} rows={registros as (TelemetriaApi & Record<string, unknown>)[]} />

                  {/* Sem paginação numerada: o backend pagina por cursor, e
                      contar o total seria justamente a consulta cara que o
                      cursor evita. */}
                  {q.hasNextPage && (
                    <div className="mt-3 flex justify-center">
                      <button
                        onClick={() => q.fetchNextPage()}
                        disabled={q.isFetchingNextPage}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-2 text-[13px] font-medium text-brand-navy hover:bg-secondary disabled:opacity-60"
                      >
                        {q.isFetchingNextPage ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Carregando…
                          </>
                        ) : (
                          "Carregar mais viagens"
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}

              <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                Dados vindos de <span className="font-mono">con_telemetry</span>, com 113 campos por viagem. A coluna
                de chuva usa o tempo que o equipamento registrou com sensor de chuva ativo — é o fator que mais
                distorce comparação de consumo entre períodos.
              </p>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
