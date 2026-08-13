import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Gauge, MapPin, Navigation, Search, Truck } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Dot, Pill, type PillTone } from "@/components/ss/ui/data";
import { FleetFilters, type FleetFilterValue } from "@/components/ss/ui/FleetFilters";
import { ErrorBox, SkeletonBlock } from "@/components/ss/ui/QueryState";
import { desde, nf, posicoesQuery, toCanvasXY } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { PosicaoVeiculo } from "@/types";

/**
 * Mapa ao vivo — posição da frota em tempo real, alimentado por
 * `GET /api/frota/posicoes`. O canvas é uma representação estilizada; as
 * posições são reais (lat/lng projetadas em percentuais).
 */

type Status = "movimento" | "parado" | "desligado" | "sem-sinal";

const STATUS: Record<Status, { label: string; tone: PillTone }> = {
  movimento: { label: "Em movimento", tone: "green" },
  parado: { label: "Motor ligado parado", tone: "gold" },
  desligado: { label: "Motor desligado", tone: "neutral" },
  "sem-sinal": { label: "Sem sinal recente", tone: "coral" },
};

type Veiculo = {
  placa: string;
  status: Status;
  vel: number;
  local: string;
  atualizado: string;
  x: number;
  y: number;
};

function statusDe(p: PosicaoVeiculo): Status {
  const minutos = (Date.now() - new Date(p.atualizadoEm).getTime()) / 60000;
  if (Number.isNaN(minutos) || minutos > 20) return "sem-sinal";
  if (p.velocidade > 0) return "movimento";
  return p.ignicao ? "parado" : "desligado";
}

export default function MapaAoVivo() {
  const { data, isPending, error, refetch } = useQuery(posicoesQuery());
  const [active, setActive] = useState<Set<Status>>(new Set(Object.keys(STATUS) as Status[]));
  const [selected, setSelected] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtros, setFiltros] = useState<FleetFilterValue>({ veiculo: "Todos", motorista: "Todos", data: "" });

  const veiculos: Veiculo[] = useMemo(
    () =>
      (data ?? []).map((p) => {
        const { x, y } = toCanvasXY(p.lat, p.lng);
        return {
          placa: p.placa,
          status: statusDe(p),
          vel: p.velocidade,
          local: p.endereco || "—",
          atualizado: desde(p.atualizadoEm),
          x,
          y,
        };
      }),
    [data],
  );

  const contagem = (s: Status) => veiculos.filter((v) => v.status === s).length;

  const toggle = (s: Status) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const visiveis = useMemo(
    () =>
      veiculos.filter(
        (v) =>
          active.has(v.status) &&
          (filtros.veiculo === "Todos" || v.placa === filtros.veiculo) &&
          (!busca || v.placa.toLowerCase().includes(busca.toLowerCase())),
      ),
    [veiculos, active, filtros, busca],
  );

  return (
    <>
      <PageHeader
        title="Mapa ao vivo"
        subtitle={isPending ? "Carregando posições…" : `${nf(veiculos.length)} veículos · ${veiculos[0]?.atualizado ?? "—"}`}
      />

      <div className="px-6 py-6 md:px-8">
        {error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : isPending ? (
          <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
            <SkeletonBlock className="h-[520px]" />
            <SkeletonBlock className="h-[520px]" />
          </div>
        ) : (
          <>
            <FleetFilters
              veiculos={veiculos.map((v) => v.placa)}
              motoristas={[]}
              value={filtros}
              onChange={setFiltros}
            />

            {/* Filtros de status. */}
            <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-card">
              {(Object.keys(STATUS) as Status[]).map((s) => {
                const on = active.has(s);
                return (
                  <button
                    key={s}
                    onClick={() => toggle(s)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-all",
                      on ? "border-border bg-white text-foreground" : "border-transparent bg-secondary text-muted-foreground opacity-60",
                    )}
                  >
                    <Dot tone={STATUS[s].tone} />
                    {STATUS[s].label}
                    <span className="font-mono text-[11px] text-muted-foreground">({nf(contagem(s))})</span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
              {/* Lista de veículos. */}
              <div className="flex max-h-[640px] flex-col rounded-2xl border border-border bg-card shadow-card">
                <div className="border-b border-border p-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar placa…"
                      className="h-10 w-full rounded-lg border border-border bg-secondary/60 pl-9 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {visiveis.slice(0, 200).map((v) => (
                    <button
                      key={v.placa}
                      onClick={() => setSelected(v.placa)}
                      className={cn(
                        "mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        selected === v.placa ? "bg-navy-tint" : "hover:bg-secondary/70",
                      )}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                        <Truck className="h-4 w-4 text-brand-navy" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[13px] font-semibold">{v.placa}</span>
                          <Dot tone={STATUS[v.status].tone} />
                        </div>
                        <div className="truncate text-[12px] text-muted-foreground">{v.local}</div>
                      </div>
                      {v.vel > 0 && <span className="shrink-0 font-mono text-[12px] font-semibold text-leaf">{v.vel} km/h</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Área de mapa. */}
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                <MapCanvas veiculos={visiveis.slice(0, 80)} selected={selected} onSelect={setSelected} />
                <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-white/90 px-3 py-2 text-xs shadow-card backdrop-blur">
                  <span className="font-semibold text-foreground">{nf(visiveis.length)}</span>{" "}
                  <span className="text-muted-foreground">veículos visíveis</span>
                </div>
                <div className="absolute bottom-4 right-4 rounded-lg border border-border bg-white/90 px-3 py-2 text-[11px] text-muted-foreground shadow-card backdrop-blur">
                  Representação ilustrativa · posições reais por lat/lng
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Canvas estilizado de mapa: fundo topográfico + marcadores posicionados. */
function MapCanvas({
  veiculos,
  selected,
  onSelect,
}: {
  veiculos: Veiculo[];
  selected: string | null;
  onSelect: (p: string) => void;
}) {
  // Zoom do canvas. 1 = enquadramento inteiro; até 3× para separar marcadores
  // sobrepostos em região de frota densa.
  const [zoom, setZoom] = useState(1);

  return (
    <div
      className="relative h-[520px] w-full overflow-hidden lg:h-[640px]"
      style={{
        background: "radial-gradient(circle at 60% 40%, #EAF3EC 0%, #E3EDF3 45%, #DCE6EC 100%)",
      }}
    >
      <div
        className="absolute inset-0 origin-center transition-transform duration-200"
        style={{ transform: `scale(${zoom})` }}
      >
      {/* "Rodovias" decorativas. */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <path d="M-50 200 Q 300 120 620 260 T 1200 300" fill="none" stroke="white" strokeWidth="6" opacity="0.7" />
        <path d="M-50 420 Q 400 500 700 380 T 1300 460" fill="none" stroke="white" strokeWidth="6" opacity="0.7" />
        <path d="M200 -20 Q 260 300 420 500 T 520 900" fill="none" stroke="white" strokeWidth="5" opacity="0.55" />
      </svg>

      {veiculos.map((v) => {
        const isSel = selected === v.placa;
        return (
          <button
            key={v.placa}
            onClick={() => onSelect(v.placa)}
            style={{ left: `${v.x}%`, top: `${v.y}%` }}
            className="group absolute -translate-x-1/2 -translate-y-full"
          >
            <div
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-card transition-transform group-hover:-translate-y-0.5",
                isSel ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-white text-foreground",
              )}
            >
              <Dot tone={STATUS[v.status].tone} />
              {v.placa}
            </div>
            <div
              className={cn(
                "mx-auto h-2.5 w-2.5 -translate-y-1 rotate-45 border-b border-r",
                isSel ? "border-brand-navy bg-brand-navy" : "border-border bg-white",
              )}
            />
          </button>
        );
      })}

      </div>

      {/* Zoom do canvas — antes os botões não faziam nada. */}
      <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-card">
        <button
          onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
          disabled={zoom >= 3}
          aria-label="Aproximar"
          className="flex h-8 w-8 items-center justify-center text-lg text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
        >
          +
        </button>
        <div className="h-px bg-border" />
        <button
          onClick={() => setZoom(1)}
          aria-label="Restaurar zoom"
          title={`${Math.round(zoom * 100)}%`}
          className="flex h-8 w-8 items-center justify-center font-mono text-[10px] text-muted-foreground transition-colors hover:bg-secondary"
        >
          {Math.round(zoom * 100)}
        </button>
        <div className="h-px bg-border" />
        <button
          onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))}
          disabled={zoom <= 1}
          aria-label="Afastar"
          className="flex h-8 w-8 items-center justify-center text-lg text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
        >
          −
        </button>
      </div>

      {selected && <SelectedCard veiculo={veiculos.find((v) => v.placa === selected)} />}
    </div>
  );
}

function SelectedCard({ veiculo }: { veiculo?: Veiculo }) {
  if (!veiculo) return null;
  return (
    <div className="absolute bottom-4 left-4 w-64 rounded-xl border border-border bg-white p-4 shadow-elegant">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold">{veiculo.placa}</span>
        <Pill tone={STATUS[veiculo.status].tone}>{STATUS[veiculo.status].label}</Pill>
      </div>
      <div className="mt-3 space-y-1.5 text-[12.5px] text-ink-soft">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {veiculo.local}
        </p>
        <p className="flex items-center gap-2">
          <Navigation className="h-3.5 w-3.5 text-muted-foreground" /> {veiculo.atualizado}
        </p>
        <p className="flex items-center gap-2">
          <Gauge className="h-3.5 w-3.5 text-muted-foreground" /> {veiculo.vel} km/h
        </p>
      </div>
    </div>
  );
}
