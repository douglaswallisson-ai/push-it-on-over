import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Download, MapPin, Navigation, Power, RefreshCw, Truck } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, Dot, Pill, type Column, type PillTone } from "@/components/ss/ui/data";
import { FleetFilters, type FleetFilterValue } from "@/components/ss/ui/FleetFilters";
import { EmptyNote, ErrorBox, SkeletonBlock, SkeletonRows } from "@/components/ss/ui/QueryState";
import { desde, nf, posicoesQuery, toCanvasXY } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { PosicaoVeiculo } from "@/types";

/**
 * Posicionamento da frota — retrato da posição atual de cada veículo (último
 * ping). Dados reais da API (`GET /api/frota/posicoes`).
 */

type Pos = {
  placa: string;
  endereco: string;
  velocidade: number;
  ignicao: "Ligada" | "Desligada";
  atualizado: string;
  status: PillTone;
  x: number;
  y: number;
};

/** Regra de status: em movimento, parado com ignição, desligado ou sem sinal. */
function statusDe(p: PosicaoVeiculo): PillTone {
  const minutos = (Date.now() - new Date(p.atualizadoEm).getTime()) / 60000;
  if (Number.isNaN(minutos) || minutos > 20) return "coral";
  if (p.velocidade > 0) return "green";
  return p.ignicao ? "gold" : "neutral";
}

function mapear(p: PosicaoVeiculo): Pos {
  const { x, y } = toCanvasXY(p.lat, p.lng);
  return {
    placa: p.placa,
    endereco: p.endereco || "—",
    velocidade: p.velocidade,
    ignicao: p.ignicao ? "Ligada" : "Desligada",
    atualizado: desde(p.atualizadoEm),
    status: statusDe(p),
    x,
    y,
  };
}

const COLS: Column<Pos>[] = [
  {
    key: "placa",
    header: "Veículo",
    render: (p) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-tint">
          <Truck className="h-4 w-4 text-brand-navy" />
        </div>
        <div className="font-mono font-semibold text-foreground">{p.placa}</div>
      </div>
    ),
  },
  {
    key: "endereco",
    header: "Localização",
    render: (p) => (
      <span className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="line-clamp-1">{p.endereco}</span>
      </span>
    ),
  },
  { key: "velocidade", header: "Veloc.", align: "right", render: (p) => <span className="font-mono">{p.velocidade} km/h</span> },
  {
    key: "ignicao",
    header: "Ignição",
    align: "center",
    render: (p) => (
      <span className={cn("inline-flex items-center gap-1.5 text-[13px]", p.ignicao === "Ligada" ? "text-leaf" : "text-muted-foreground")}>
        <Power className="h-3.5 w-3.5" />
        {p.ignicao}
      </span>
    ),
  },
  {
    key: "atualizado",
    header: "Último sinal",
    align: "right",
    render: (p) => (
      <span className="flex items-center justify-end gap-1.5 text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        {p.atualizado}
      </span>
    ),
  },
];

export default function Posicionamento() {
  const { data, isPending, error, refetch, isFetching } = useQuery(posicoesQuery());
  const [filtros, setFiltros] = useState<FleetFilterValue>({ veiculo: "Todos", motorista: "Todos", data: "" });

  const posicoes = useMemo(() => (data ?? []).map(mapear), [data]);
  const visiveis = useMemo(
    () => posicoes.filter((p) => filtros.veiculo === "Todos" || p.placa === filtros.veiculo),
    [posicoes, filtros],
  );

  const conta = (t: PillTone) => posicoes.filter((p) => p.status === t).length;
  const ultimo = posicoes[0]?.atualizado ?? "—";

  return (
    <>
      <PageHeader
        title="Posicionamento"
        subtitle="Frota › Posição atual"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <RefreshCw className={`h-[15px] w-[15px] ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <button className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary">
              <Download className="h-[15px] w-[15px]" />
              Exportar
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Frota · Posicionamento"
          title="Posição atual da frota"
          subtitle="Último sinal de cada veículo — dados em tempo real da API."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value={nf(conta("green"))} label="Em movimento" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value={nf(conta("gold") + conta("neutral"))} label="Parados" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value={ultimo} label="Última atualização" />
          </div>
        </HeroBanner>

        {error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : isPending ? (
          <div className="space-y-5">
            <SkeletonBlock className="h-[120px]" />
            <SkeletonBlock className="h-[360px]" />
          </div>
        ) : (
          <>
            <FleetFilters
              veiculos={posicoes.map((p) => p.placa)}
              motoristas={[]}
              value={filtros}
              onChange={setFiltros}
            />

            <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
              {/* Mapa. */}
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <div
                  className="relative h-[360px] w-full lg:h-full lg:min-h-[420px]"
                  style={{ background: "radial-gradient(circle at 55% 45%, #EAF3EC 0%, #E3EDF3 50%, #DCE6EC 100%)" }}
                >
                  <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                    <path d="M-50 180 Q 320 120 640 240 T 1200 280" fill="none" stroke="white" strokeWidth="6" opacity="0.7" />
                    <path d="M-50 400 Q 400 480 700 360 T 1300 440" fill="none" stroke="white" strokeWidth="6" opacity="0.7" />
                  </svg>
                  {visiveis.slice(0, 60).map((p) => (
                    <div key={p.placa} style={{ left: `${p.x}%`, top: `${p.y}%` }} className="absolute -translate-x-1/2 -translate-y-full">
                      <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-semibold shadow-card">
                        <Dot tone={p.status} />
                        {p.placa}
                      </div>
                      <div className="mx-auto h-2.5 w-2.5 -translate-y-1 rotate-45 border-b border-r border-border bg-white" />
                    </div>
                  ))}
                  <div className="absolute bottom-4 right-4 rounded-lg border border-border bg-white/90 px-3 py-2 text-[11px] text-muted-foreground shadow-card backdrop-blur">
                    Representação ilustrativa · posições reais plotadas por lat/lng
                  </div>
                </div>
              </div>

              {/* Resumo lateral. */}
              <Card title="Resumo" icon={Navigation}>
                <div className="space-y-3">
                  {[
                    { label: "Em movimento", value: conta("green"), tone: "green" as PillTone },
                    { label: "Parados com ignição", value: conta("gold"), tone: "gold" as PillTone },
                    { label: "Desligados", value: conta("neutral"), tone: "neutral" as PillTone },
                    { label: "Sem sinal recente", value: conta("coral"), tone: "coral" as PillTone },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                      <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                        <Dot tone={r.tone} />
                        {r.label}
                      </span>
                      <span className="font-display text-lg font-bold tabular-nums">{nf(r.value)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card
              title="Posições"
              icon={MapPin}
              action={<Pill tone="sky">{nf(visiveis.length)} de {nf(posicoes.length)}</Pill>}
              bodyClassName="p-4"
            >
              {visiveis.length ? (
                <DataTable columns={COLS} rows={visiveis.slice(0, 100)} />
              ) : (
                <EmptyNote>Nenhuma posição retornada pela API.</EmptyNote>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
