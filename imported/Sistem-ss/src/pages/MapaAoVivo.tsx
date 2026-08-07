import { useMemo, useState } from "react";
import { Gauge, MapPin, Navigation, Search, Truck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Dot, Pill, type PillTone } from "@/components/ui/data";
import { FleetFilters, type FleetFilterValue } from "@/components/ui/FleetFilters";
import { cn } from "@/lib/utils";

/**
 * Mapa ao vivo — posição da frota em tempo real.
 *
 * Layout de duas colunas: filtros de status + lista de veículos à esquerda,
 * área de mapa com marcadores à direita. O mapa aqui é uma representação
 * estilizada; a integração real (Google Maps / Leaflet) entra no lugar do
 * canvas quando houver a chave de API. Dados de exemplo.
 */

type Status = "movimento" | "parado" | "desligado" | "pane" | "sem-motorista";

const STATUS: Record<Status, { label: string; tone: PillTone; count: number }> = {
  movimento: { label: "Em movimento", tone: "green", count: 19 },
  parado: { label: "Motor ligado parado", tone: "gold", count: 6 },
  desligado: { label: "Motor desligado", tone: "neutral", count: 15 },
  pane: { label: "Risco de pane seca", tone: "coral", count: 3 },
  "sem-motorista": { label: "Sem motorista", tone: "sky", count: 21 },
};

type Veiculo = {
  placa: string;
  motorista: string;
  status: Status;
  vel: number;
  local: string;
  x: number;
  y: number;
};

const VEICULOS: Veiculo[] = [
  { placa: "BCA7A56", motorista: "Marco Taborda", status: "movimento", vel: 82, local: "BR-116, SP", x: 58, y: 62 },
  { placa: "SXD1J61", motorista: "Najla Maltaca", status: "movimento", vel: 74, local: "Goiânia, GO", x: 45, y: 48 },
  { placa: "EBZ3590", motorista: "Remildo N. de Lima", status: "parado", vel: 0, local: "Recife, PE", x: 78, y: 34 },
  { placa: "QHH1360", motorista: "Henrique", status: "parado", vel: 0, local: "Fortaleza, CE", x: 74, y: 24 },
  { placa: "LUO5I08", motorista: "Richard Acácio", status: "desligado", vel: 0, local: "Curitiba, PR", x: 50, y: 74 },
  { placa: "JBE6H85", motorista: "—", status: "sem-motorista", vel: 0, local: "Natal, RN", x: 80, y: 28 },
  { placa: "SB157940", motorista: "—", status: "pane", vel: 0, local: "Salvador, BA", x: 72, y: 46 },
  { placa: "AYK7080", motorista: "Rafael Sabini", status: "movimento", vel: 61, local: "Belo Horizonte", x: 60, y: 54 },
];

const TOTAL = Object.values(STATUS).reduce((a, s) => a + s.count, 0);

export default function MapaAoVivo() {
  const [active, setActive] = useState<Set<Status>>(new Set(Object.keys(STATUS) as Status[]));
  const [selected, setSelected] = useState<string | null>(null);

  const toggle = (s: Status) =>
    setActive((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const [filtros, setFiltros] = useState<FleetFilterValue>({ veiculo: "Todos", motorista: "Todos", data: "2026-07-24" });
  const visiveis = useMemo(
    () =>
      VEICULOS.filter(
        (v) =>
          active.has(v.status) &&
          (filtros.veiculo === "Todos" || v.placa === filtros.veiculo) &&
          (filtros.motorista === "Todos" || v.motorista === filtros.motorista),
      ),
    [active, filtros],
  );
  const motoristas = [...new Set(VEICULOS.map((v) => v.motorista))].filter((m) => m && m !== "—");

  return (
    <>
      <PageHeader title="Mapa ao vivo" subtitle={`${TOTAL} veículos · atualizado há 30s`} />

      <div className="px-6 py-6 md:px-8">
        <FleetFilters
          veiculos={VEICULOS.map((v) => v.placa)}
          motoristas={motoristas}
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
                <span className="font-mono text-[11px] text-muted-foreground">({STATUS[s].count})</span>
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
                  placeholder="Buscar placa ou motorista…"
                  className="h-10 w-full rounded-lg border border-border bg-secondary/60 pl-9 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {visiveis.map((v) => (
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
                    <div className="truncate text-[12px] text-muted-foreground">{v.motorista} · {v.local}</div>
                  </div>
                  {v.vel > 0 && (
                    <span className="shrink-0 font-mono text-[12px] font-semibold text-leaf">{v.vel} km/h</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Área de mapa. */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <MapCanvas veiculos={visiveis} selected={selected} onSelect={setSelected} />
            <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-white/90 px-3 py-2 text-xs shadow-card backdrop-blur">
              <span className="font-semibold text-foreground">{visiveis.length}</span>{" "}
              <span className="text-muted-foreground">veículos visíveis</span>
            </div>
            <div className="absolute bottom-4 right-4 rounded-lg border border-border bg-white/90 px-3 py-2 text-[11px] text-muted-foreground shadow-card backdrop-blur">
              Representação ilustrativa · integração de mapa real no lugar deste canvas
            </div>
          </div>
        </div>
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
  return (
    <div
      className="relative h-[520px] w-full lg:h-[640px]"
      style={{
        background:
          "radial-gradient(circle at 60% 40%, #EAF3EC 0%, #E3EDF3 45%, #DCE6EC 100%)",
      }}
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

      {/* Controles falsos de zoom. */}
      <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-card">
        <button className="flex h-8 w-8 items-center justify-center text-lg text-muted-foreground hover:bg-secondary">+</button>
        <div className="h-px bg-border" />
        <button className="flex h-8 w-8 items-center justify-center text-lg text-muted-foreground hover:bg-secondary">−</button>
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
        <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {veiculo.local}</p>
        <p className="flex items-center gap-2"><Navigation className="h-3.5 w-3.5 text-muted-foreground" /> {veiculo.motorista}</p>
        <p className="flex items-center gap-2"><Gauge className="h-3.5 w-3.5 text-muted-foreground" /> {veiculo.vel} km/h</p>
      </div>
    </div>
  );
}
