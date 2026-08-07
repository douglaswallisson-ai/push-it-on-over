import { Check, DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mapa de assentos de ônibus para fretamento — layout 2+2 com corredor central.
 *
 * Cada assento é desenhado como um assento de verdade (encosto + apoios de
 * braço, visto de cima). Estados: livre, ocupado (bloqueado) e selecionado
 * (com selo verde). O componente é controlado.
 */

export type SeatState = "livre" | "ocupado" | "selecionado";

/** Volante — o lucide não tem ícone de direção, então desenhamos. */
function Wheel({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 14.5V21M9.8 10.2 4.2 6.6M14.2 10.2l5.6-3.6" />
    </svg>
  );
}

export function SeatMap({
  rows = 11,
  occupied = new Set<number>(),
  selected = new Set<number>(),
  onToggle,
}: {
  rows?: number;
  occupied?: Set<number>;
  selected?: Set<number>;
  onToggle?: (seat: number) => void;
}) {
  const seatAt = (row: number, col: number) => row * 4 + col + 1;
  const stateOf = (n: number): SeatState =>
    occupied.has(n) ? "ocupado" : selected.has(n) ? "selecionado" : "livre";

  return (
    <div data-tour="seatmap" className="mx-auto w-fit">
      {/* Carroceria do ônibus: nariz arredondado em cima, traseira reta embaixo. */}
      <div className="relative rounded-b-[32px] rounded-t-[80px] border-2 border-[#cbd5dd] bg-gradient-to-b from-[#eef3f8] via-white to-[#e9eff4] px-6 pb-6 pt-5 shadow-card">
        {/* Cockpit: para-brisa + volante e porta. */}
        <div className="mb-4">
          <div className="mx-auto mb-3 h-9 w-[62%] rounded-t-[40px] border-2 border-b-0 border-[#cbd5dd] bg-gradient-to-b from-[#d6e6f2] to-transparent" />
          <div className="flex items-center justify-between px-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium text-brand-navy shadow-sm">
              <Wheel className="h-3.5 w-3.5" />
              Motorista
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
              Porta
              <DoorOpen className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>

        {/* Fileiras 2 + corredor + 2. */}
        <div className="space-y-2.5">
          {Array.from({ length: rows }, (_, row) => (
            <div key={row} className="flex items-center justify-center gap-2.5">
              <Seat n={seatAt(row, 0)} state={stateOf(seatAt(row, 0))} onToggle={onToggle} />
              <Seat n={seatAt(row, 1)} state={stateOf(seatAt(row, 1))} onToggle={onToggle} />
              <span className="w-7 text-center font-mono text-[10px] text-muted-foreground/50">
                {String(row + 1).padStart(2, "0")}
              </span>
              <Seat n={seatAt(row, 2)} state={stateOf(seatAt(row, 2))} onToggle={onToggle} />
              <Seat n={seatAt(row, 3)} state={stateOf(seatAt(row, 3))} onToggle={onToggle} />
            </div>
          ))}
        </div>

        {/* Traseira. */}
        <div className="mt-4 flex justify-center">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50">
            fundo
          </span>
        </div>
      </div>
    </div>
  );
}

const PALETTE: Record<SeatState, { back: string; cushion: string; arm: string; num: string }> = {
  livre: { back: "#dde5ec", cushion: "#cfd9e2", arm: "#c3cdd8", num: "#5b6672" },
  selecionado: { back: "var(--brand-navy)", cushion: "var(--brand-blue)", arm: "#17306a", num: "#ffffff" },
  ocupado: { back: "#e7eaee", cushion: "#e7eaee", arm: "#e1e4e9", num: "#b8c0c9" },
};

function Seat({
  n,
  state,
  onToggle,
}: {
  n: number;
  state: SeatState;
  onToggle?: (seat: number) => void;
}) {
  const p = PALETTE[state];
  const disabled = state === "ocupado";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onToggle?.(n)}
      title={`Assento ${n}`}
      className={cn(
        "group relative h-[46px] w-[46px] shrink-0 transition-transform",
        !disabled && "hover:-translate-y-0.5 hover:scale-[1.06]",
        disabled && "cursor-not-allowed",
      )}
    >
      <svg
        viewBox="0 0 46 46"
        className={cn(
          "h-full w-full transition-[filter]",
          state === "selecionado" && "drop-shadow-[0_4px_8px_rgba(18,42,82,0.35)]",
        )}
      >
        {/* apoios de braço */}
        <rect x="3" y="17" width="6" height="23" rx="3" fill={p.arm} />
        <rect x="37" y="17" width="6" height="23" rx="3" fill={p.arm} />
        {/* encosto */}
        <rect x="8" y="5" width="30" height="27" rx="9" fill={p.back} />
        {/* assento */}
        <rect x="6" y="24" width="34" height="16" rx="8" fill={p.cushion} />
        {/* brilho sutil no encosto */}
        <rect x="12" y="9" width="22" height="6" rx="3" fill="#ffffff" opacity={state === "ocupado" ? 0 : 0.16} />
      </svg>

      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center pt-1 text-[11px] font-bold"
        style={{ color: p.num }}
      >
        {n}
      </span>

      {/* Livre: contorno de destaque no hover. */}
      {state === "livre" && (
        <span className="pointer-events-none absolute inset-x-1 top-1 bottom-2 rounded-xl ring-brand-sky/0 transition-all group-hover:ring-2 group-hover:ring-brand-sky/50" />
      )}

      {/* Selecionado: selo verde. */}
      {state === "selecionado" && (
        <span className="absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-brand-green text-white shadow-sm ring-2 ring-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** Legenda dos estados — mini-assentos, consistente com o mapa. */
export function SeatLegend() {
  const items: Array<{ label: string; state: SeatState }> = [
    { label: "Livre", state: "livre" },
    { label: "Selecionado", state: "selecionado" },
    { label: "Ocupado", state: "ocupado" },
  ];
  return (
    <div className="flex flex-wrap gap-5">
      {items.map((i) => {
        const p = PALETTE[i.state];
        return (
          <span key={i.label} className="flex items-center gap-2 text-[12px] text-ink-soft">
            <svg viewBox="0 0 46 46" className="h-5 w-5">
              <rect x="3" y="17" width="6" height="23" rx="3" fill={p.arm} />
              <rect x="37" y="17" width="6" height="23" rx="3" fill={p.arm} />
              <rect x="8" y="5" width="30" height="27" rx="9" fill={p.back} />
              <rect x="6" y="24" width="34" height="16" rx="8" fill={p.cushion} />
            </svg>
            {i.label}
          </span>
        );
      })}
    </div>
  );
}
