import type { LucideIcon } from "lucide-react";
import {
  BatteryCharging,
  Disc3,
  Droplet,
  Filter,
  Fuel,
  Thermometer,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Inspeção visual do veículo: uma imagem do ônibus com os componentes plotados
 * como "hotspots" de saúde (verde/atenção/crítico). Clicar num ponto seleciona
 * o componente.
 *
 * `image` recebe a URL de uma FOTO REAL do veículo (ex.: "/onibus.jpg" em
 * public/). Sem foto, cai numa ilustração vetorial de reserva. Os hotspots são
 * posicionados em % e funcionam igual nos dois casos — troque a arte pela foto
 * e nada mais muda.
 */

export type Tone = "ok" | "warn" | "crit";

export type Hotspot = {
  id: string;
  label: string;
  icon: LucideIcon;
  value: string;
  tone: Tone;
  detail: string;
  recomendacao: string;
  x: number;
  y: number;
};

// Coordenadas ajustadas à foto real (public/onibus.webp) — ônibus urbano em
// vista 3/4 com a frente à direita: motor/arrefecimento ao fundo à esquerda,
// roda traseira à esquerda e dianteira à direita.
export const HOTSPOTS: Hotspot[] = [
  { id: "oleo", label: "Óleo do motor", icon: Droplet, value: "16%", tone: "crit", x: 11, y: 56, detail: "Nível do óleo do motor em 16% — abaixo do mínimo seguro.", recomendacao: "Troca urgente. Agende nas próximas 48 h para evitar desgaste do motor." },
  { id: "arref", label: "Arrefecimento", icon: Thermometer, value: "92°C", tone: "ok", x: 15, y: 40, detail: "Temperatura do líquido de arrefecimento em 92°C — normal.", recomendacao: "Sem ação. Faixa operacional saudável." },
  { id: "filtro", label: "Filtro de ar", icon: Filter, value: "25%", tone: "warn", x: 26, y: 38, detail: "Filtro de ar com 25% de vida útil restante.", recomendacao: "Substituir em ~25 dias. Filtro saturado eleva o consumo." },
  { id: "bateria", label: "Bateria", icon: BatteryCharging, value: "12,8V", tone: "ok", x: 42, y: 56, detail: "Tensão da bateria em 12,8V com motor desligado.", recomendacao: "Sem ação. Carga adequada." },
  { id: "combustivel", label: "Combustível", icon: Fuel, value: "62%", tone: "ok", x: 50, y: 63, detail: "Tanque em 62% da capacidade.", recomendacao: "Autonomia estimada suficiente para a próxima viagem." },
  { id: "freios", label: "Freios", icon: Wind, value: "68%", tone: "ok", x: 56, y: 70, detail: "Pastilhas de freio com 68% de vida útil.", recomendacao: "Monitorar. Próxima verificação no rodízio de pneus." },
  { id: "pneu-tras", label: "Pneu traseiro", icon: Disc3, value: "108", tone: "warn", x: 25, y: 67, detail: "Pressão do pneu traseiro em 108 psi — levemente baixa.", recomendacao: "Calibrar para 115 psi no próximo abastecimento." },
  { id: "pneu-diant", label: "Pneu dianteiro", icon: Disc3, value: "110", tone: "ok", x: 66, y: 74, detail: "Pressão do pneu dianteiro em 110 psi.", recomendacao: "Dentro do especificado." },
];

const TONE: Record<Tone, { badge: string; ring: string }> = {
  ok: { badge: "bg-leaf", ring: "ring-leaf/25" },
  warn: { badge: "bg-gold", ring: "ring-gold/25" },
  crit: { badge: "bg-coral", ring: "ring-coral/25" },
};

export function BusInspection({
  selected,
  onSelect,
  image,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
  image?: string | null;
}) {
  return (
    <div
      data-tour="bus"
      className="relative mx-auto w-full max-w-[620px]"
      style={{ aspectRatio: image ? "477 / 280" : "640 / 300" }}
    >
      {image ? (
        <img src={image} alt="Veículo" className="h-full w-full rounded-xl object-cover" />
      ) : (
        <BusArt />
      )}

      {HOTSPOTS.map((h) => {
        const t = TONE[h.tone];
        const active = selected === h.id;
        return (
          <button
            key={h.id}
            onClick={() => onSelect(h.id)}
            title={h.label}
            style={{ left: `${h.x}%`, top: `${h.y}%` }}
            className={cn(
              "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-2 py-1 text-[12px] font-bold text-white shadow-card ring-4 transition-transform hover:scale-110",
              t.badge,
              t.ring,
              active && "scale-[1.18] ring-8",
              h.tone === "crit" && "animate-[pulse-ring_2s_infinite]",
            )}
          >
            <h.icon className="h-3 w-3" />
            {h.value}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Ilustração de reserva — ônibus rodoviário em perfil (frente à direita).
 * Mais detalhada e com sombreamento; ainda assim, o alvo é substituí-la pela
 * foto real via `image`.
 */
function BusArt() {
  return (
    <svg viewBox="0 0 640 300" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="coach-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#f3f6f9" />
          <stop offset="100%" stopColor="#dbe3ea" />
        </linearGradient>
        <linearGradient id="coach-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dcecf6" />
          <stop offset="100%" stopColor="#9cc4dd" />
        </linearGradient>
        <linearGradient id="coach-skirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9d3dc" />
          <stop offset="100%" stopColor="#aebcc8" />
        </linearGradient>
        <linearGradient id="coach-stripe" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#20448C" />
          <stop offset="60%" stopColor="#2651A6" />
          <stop offset="100%" stopColor="#32A9D9" />
        </linearGradient>
      </defs>

      {/* sombra no chão */}
      <ellipse cx="322" cy="268" rx="290" ry="13" fill="#0d0d0d" opacity="0.07" />

      {/* espelho retrovisor */}
      <g stroke="#8b97a5" strokeWidth="3">
        <line x1="600" y1="120" x2="618" y2="112" />
        <rect x="612" y="100" width="14" height="22" rx="3" fill="#c9d3dc" />
      </g>

      {/* corpo */}
      <path
        d="M28 214
           L28 150
           Q28 120 58 116
           L556 116
           Q596 118 616 150
           L626 196
           Q628 206 628 214
           L628 220
           Q628 232 614 232
           L42 232
           Q28 232 28 220 Z"
        fill="url(#coach-body)"
        stroke="#c4cdd6"
        strokeWidth="2"
      />

      {/* saia inferior / bagageiro */}
      <path d="M30 196 L626 196 L626 214 Q626 232 612 232 L44 232 Q30 232 30 214 Z" fill="url(#coach-skirt)" />

      {/* faixa da marca */}
      <path d="M32 172 L622 168 L624 186 L30 190 Z" fill="url(#coach-stripe)" />
      <rect x="30" y="190" width="596" height="3" fill="#7FBF50" />

      {/* janelas panorâmicas */}
      <g stroke="#a9c4d6" strokeWidth="1.5">
        <rect x="66" y="130" width="470" height="34" rx="9" fill="url(#coach-glass)" />
        {[130, 194, 258, 322, 386, 450].map((x) => (
          <line key={x} x1={x} y1="132" x2={x} y2="162" stroke="#bcd6e6" />
        ))}
      </g>

      {/* para-brisa */}
      <path d="M556 128 L586 128 Q606 132 618 156 L560 156 Q556 140 556 128 Z" fill="url(#coach-glass)" stroke="#a9c4d6" />

      {/* porta dianteira */}
      <rect x="500" y="150" width="30" height="46" rx="4" fill="#c7d2dc" stroke="#aebcc8" />
      <line x1="515" y1="152" x2="515" y2="194" stroke="#aebcc8" />

      {/* faróis */}
      <ellipse cx="620" cy="176" rx="7" ry="9" fill="#ffe08a" stroke="#e6c14e" />

      {/* arcos de roda */}
      {[150, 520].map((cx) => (
        <path key={cx} d={`M${cx - 42} 232 a42 42 0 0 1 84 0 Z`} fill="#cdd6de" />
      ))}

      {/* rodas */}
      {[150, 520].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="232" r="34" fill="#1c2530" />
          <circle cx={cx} cy="232" r="18" fill="#9aa6b4" />
          <circle cx={cx} cy="232" r="16" fill="none" stroke="#7b8896" strokeWidth="2" />
          <circle cx={cx} cy="232" r="6" fill="#5b6674" />
        </g>
      ))}
    </svg>
  );
}
