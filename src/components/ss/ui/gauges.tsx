import { cn } from "@/lib/utils";

/**
 * Medidor de nota em arco de 270° (estilo velocímetro), com a cor variando por
 * faixa. Usado para a "nota geral" de desempenho.
 */
export function ScoreGauge({ score, size = 150 }: { score: number; size?: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const arc = 0.75; // 270°
  const color = score >= 70 ? "var(--leaf)" : score >= 45 ? "var(--gold)" : "var(--coral)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="h-full w-full">
        <g transform="rotate(135 60 60)">
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="var(--secondary)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${c * arc} ${c}`}
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${c * arc * (score / 100)} ${c}`}
          />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold tabular-nums" style={{ color }}>
          {score}
        </span>
        <span className="text-[12px] uppercase tracking-wide text-muted-foreground">nota geral</span>
      </div>
    </div>
  );
}

/**
 * Avaliação em estrelas (0–5, meia estrela permitida) para os indicadores de
 * condução. `null` = não avaliado.
 */
export function StarRating({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="whitespace-nowrap text-[12px] text-muted-foreground">Não avaliado</span>;
  }
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = value >= i ? "full" : value >= i - 0.5 ? "half" : "empty";
        return (
          <svg key={i} viewBox="0 0 20 20" className="h-3.5 w-3.5">
            <defs>
              <linearGradient id={`star-${i}-${fill}`}>
                <stop offset={fill === "half" ? "50%" : fill === "full" ? "100%" : "0%"} stopColor="var(--gold)" />
                <stop offset={fill === "half" ? "50%" : fill === "full" ? "100%" : "0%"} stopColor="#d8dee6" />
              </linearGradient>
            </defs>
            <path
              d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 15.9 4.8 18.6l1-5.8L1.5 8.7l5.9-.9z"
              fill={`url(#star-${i}-${fill})`}
            />
          </svg>
        );
      })}
    </span>
  );
}

/** Anel de progresso simples com % (ou valor livre) no centro. */
export function RingProgress({
  value,
  size = 120,
  centerLabel,
  sublabel,
  color = "var(--brand-sky)",
}: {
  value: number;
  size?: number;
  centerLabel?: string;
  sublabel?: string;
  color?: string;
}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--secondary)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${c * (value / 100)} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold tabular-nums">{centerLabel ?? `${value}%`}</span>
        {sublabel && <span className="text-[12px] uppercase tracking-wide text-muted-foreground">{sublabel}</span>}
      </div>
    </div>
  );
}

/** Faixas de pressão do acelerador: Ideal / Atenção / Crítico, em barras. */
export function AccelBands({
  ideal,
  atencao,
  critico,
}: {
  ideal: number;
  atencao: number;
  critico: number;
}) {
  const bands = [
    { label: "Ideal", value: ideal, fill: "bg-leaf", text: "text-leaf", track: "bg-leaf-tint" },
    { label: "Atenção", value: atencao, fill: "bg-gold", text: "text-gold", track: "bg-gold-tint" },
    { label: "Crítico", value: critico, fill: "bg-coral", text: "text-coral", track: "bg-coral-tint" },
  ];
  return (
    <div className="flex h-40 items-end justify-around gap-4">
      {bands.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
          <span className={cn("font-display text-lg font-bold tabular-nums", b.text)}>{b.value}%</span>
          <div className={cn("flex w-full flex-1 items-end rounded-lg", b.track)}>
            <div className={cn("w-full rounded-lg transition-all", b.fill)} style={{ height: `${b.value}%` }} />
          </div>
          <span className="text-[12px] font-medium text-muted-foreground">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Indicador percentual com barra — para o painel de indicadores de condução. */
export function IndicatorCard({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: number;
  tone: "leaf" | "gold" | "coral" | "sky";
  caption?: string;
}) {
  const map = {
    leaf: { text: "text-leaf", bar: "bg-leaf", track: "bg-leaf-tint" },
    gold: { text: "text-gold", bar: "bg-gold", track: "bg-gold-tint" },
    coral: { text: "text-coral", bar: "bg-coral", track: "bg-coral-tint" },
    sky: { text: "text-brand-blue", bar: "bg-brand-sky", track: "bg-navy-tint" },
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-baseline justify-between">
        <span className={cn("font-display text-2xl font-bold tabular-nums", map.text)}>{value}%</span>
      </div>
      <p className="mt-1 text-[13px] font-medium text-foreground">{label}</p>
      <div className={cn("mt-2.5 h-1.5 w-full overflow-hidden rounded-full", map.track)}>
        <div className={cn("h-1.5 rounded-full", map.bar)} style={{ width: `${value}%` }} />
      </div>
      {caption && <p className="mt-2 text-[12px] text-muted-foreground">{caption}</p>}
    </div>
  );
}
