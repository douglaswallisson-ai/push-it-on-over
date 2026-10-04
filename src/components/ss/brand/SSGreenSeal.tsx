/**
 * Selo CO₂ Reduzido / SS Green — recriado em SVG a partir do badge oficial.
 * A marca SS certifica REDUÇÃO medida por telemetria, nunca "neutralidade".
 *
 * Hexágono com gradiente azul→verde da marca, "CO₂ NEUTRO", folha, selo de
 * verificação e texto circular "TELEMETRIA VERIFICADA · ECOROTA". Escalável
 * pelo `size`. Puramente decorativo (aria-hidden).
 */
export function SSGreenSeal({ size = 200 }: { size?: number }) {
  // Hexágono pontudo (vértices em cima e embaixo), centro (100,100), raio 92.
  const cx = 100;
  const cy = 100;
  const r = 92;
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = ((60 * i - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const hexPath = "M" + hex.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z";
  const rInner = r * 0.88;
  const hexInner =
    "M" +
    Array.from({ length: 6 }, (_, i) => {
      const a = ((60 * i - 90) * Math.PI) / 180;
      return `${(cx + rInner * Math.cos(a)).toFixed(1)},${(cy + rInner * Math.sin(a)).toFixed(1)}`;
    }).join("L") +
    "Z";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      aria-hidden="true"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id="seal-grad" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#2651A6" />
          <stop offset="45%" stopColor="#2E86C8" />
          <stop offset="100%" stopColor="#7FBF50" />
        </linearGradient>
        <path id="seal-arc-top" d="M 45 100 A 55 55 0 0 1 155 100" fill="none" />
        <path id="seal-arc-bottom" d="M 155 108 A 55 55 0 0 1 45 108" fill="none" />
        <filter id="seal-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#2651A6" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Anéis externos discretos. */}
      <circle cx={cx} cy={cy} r={99} fill="none" stroke="#CFE0F0" strokeWidth="1" opacity="0.6" />
      <circle
        cx={cx}
        cy={cy}
        r={97}
        fill="none"
        stroke="#BFE0D0"
        strokeWidth="1"
        strokeDasharray="1 6"
        opacity="0.7"
      />

      <path d={hexPath} fill="url(#seal-grad)" filter="url(#seal-shadow)" />
      <path d={hexInner} fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="1.5" />

      {/* Texto circular. */}
      <text
        fill="white"
        fillOpacity="0.9"
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="8.5"
        fontWeight="600"
        letterSpacing="2.5"
      >
        <textPath href="#seal-arc-top" startOffset="50%" textAnchor="middle">
          TELEMETRIA VERIFICADA
        </textPath>
      </text>
      <text
        fill="white"
        fillOpacity="0.9"
        fontFamily="'IBM Plex Mono', monospace"
        fontSize="8.5"
        fontWeight="600"
        letterSpacing="2.5"
      >
        <textPath href="#seal-arc-bottom" startOffset="50%" textAnchor="middle">
          ECOROTA · SS GREEN
        </textPath>
      </text>

      {/* CO₂ */}
      <text
        x="100"
        y="98"
        textAnchor="middle"
        fill="white"
        fontFamily="'Space Grotesk', sans-serif"
        fontSize="52"
        fontWeight="700"
        letterSpacing="-1"
      >
        CO
        <tspan fontSize="34" dy="8">
          2
        </tspan>
      </text>
      <text
        x="100"
        y="128"
        textAnchor="middle"
        fill="white"
        fontFamily="'Space Grotesk', sans-serif"
        fontSize="22"
        fontWeight="600"
        letterSpacing="2"
      >
        REDUZIDO
      </text>

      {/* Folha + verificação. */}
      <line x1="78" y1="140" x2="122" y2="140" stroke="white" strokeOpacity="0.5" strokeWidth="1" />
      <path
        d="M100 134 c-7 0 -12 4 -12 9 c6 0 12 -3 12 -9 z M100 134 c7 0 12 4 12 9 c-6 0 -12 -3 -12 -9 z"
        fill="white"
        opacity="0.9"
      />
      <circle cx="100" cy="158" r="8" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.8" />
      <path
        d="M96 158 l3 3 l5 -6"
        fill="none"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Cartão-assinatura compacto "SS GREEN · 2026" para rodapés e barras laterais. */
export function SSGreenBadge() {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-green shadow-glow">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 3c-5 0-8 3-8 8 4 0 8-2 8-8z M12 3c5 0 8 3 8 8-4 0-8-2-8-8z"
            fill="white"
          />
          <line x1="12" y1="8" x2="12" y2="21" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <p className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Frota certificada
        </p>
        <p className="font-display text-lg font-bold text-leaf">SS GREEN · 2026</p>
      </div>
    </div>
  );
}
