import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Gráfico de telemetria multi-série ao longo do tempo: combustível, RPM,
 * altitude e velocidade. A legenda liga/desliga cada série. Cada série é
 * normalizada na própria escala (eixos diferentes), como no gráfico de
 * referência — o que importa é a leitura conjunta (ex.: velocidade x altitude).
 */

export type Serie = { key: string; label: string; color: string; data: number[]; max: number; unit: string };

const W = 1000;
const H = 300;
const PAD = { t: 16, r: 12, b: 28, l: 12 };

export function TelemetryChart({ series, labels }: { series: Serie[]; labels: string[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const n = labels.length;
  const x = (i: number) => PAD.l + (i / (n - 1)) * plotW;
  const y = (v: number, max: number) => PAD.t + (1 - v / max) * plotH;

  const toggle = (k: string) =>
    setHidden((s) => {
      const next = new Set(s);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  // Faixa verde de RPM (referência), na escala do RPM.
  const rpm = series.find((s) => s.key === "rpm");

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-[300px] w-full min-w-[680px]">
          {/* Grade horizontal. */}
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <line key={g} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + g * plotH} y2={PAD.t + g * plotH} stroke="var(--border)" strokeWidth="1" />
          ))}

          {/* Faixa verde de RPM. */}
          {rpm && !hidden.has("rpm") && (
            <rect
              x={PAD.l}
              width={plotW}
              y={y(1300, rpm.max)}
              height={Math.max(0, y(900, rpm.max) - y(1300, rpm.max))}
              fill="var(--leaf)"
              opacity="0.08"
            />
          )}

          {/* Séries. */}
          {series.map((s) =>
            hidden.has(s.key) ? null : (
              <polyline
                key={s.key}
                points={s.data.map((v, i) => `${x(i).toFixed(1)},${y(v, s.max).toFixed(1)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth="1.6"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ),
          )}

          {/* Rótulos do eixo X. */}
          {labels.map((l, i) =>
            i % Math.ceil(n / 8) === 0 ? (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground" fontSize="10" fontFamily="var(--font-mono)">
                {l}
              </text>
            ) : null,
          )}
        </svg>
      </div>

      {/* Legenda (ligar/desligar). */}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
        {series.map((s) => {
          const off = hidden.has(s.key);
          return (
            <button
              key={s.key}
              onClick={() => toggle(s.key)}
              className={cn("inline-flex items-center gap-2 text-[12.5px] transition-opacity", off && "opacity-40")}
            >
              <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
              <span className={off ? "line-through" : "font-medium text-foreground"}>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Gera uma jornada de telemetria de exemplo (48 pontos, ~30 min cada). */
export function gerarTelemetria(seed = 1): { labels: string[]; series: Serie[] } {
  const n = 48;
  const rand = (i: number, base: number, amp: number, freq: number) =>
    base + Math.sin((i / n) * Math.PI * freq + seed) * amp + Math.sin(i * 0.9 + seed) * amp * 0.35;

  const labels = Array.from({ length: n }, (_, i) => {
    const h = Math.floor((i * 30) / 60) + 7;
    const m = (i * 30) % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  return {
    labels,
    series: [
      { key: "combustivel", label: "Combustível", color: "#C9A227", unit: "L", max: 800, data: Array.from({ length: n }, (_, i) => clamp(720 - i * 6 + Math.sin(i + seed) * 20, 200, 800)) },
      { key: "rpm", label: "RPM", color: "#7C4DFF", unit: "rpm", max: 2000, data: Array.from({ length: n }, (_, i) => clamp(rand(i, 1200, 500, 6), 0, 2000)) },
      { key: "altitude", label: "Altitude", color: "#3FA9F5", unit: "m", max: 1500, data: Array.from({ length: n }, (_, i) => clamp(rand(i, 800, 350, 2), 0, 1500)) },
      { key: "velocidade", label: "Velocidade", color: "#43A047", unit: "km/h", max: 100, data: Array.from({ length: n }, (_, i) => clamp(rand(i, 55, 30, 5), 0, 100)) },
    ],
  };
}
