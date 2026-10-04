import { cn } from "@/lib/utils";

/**
 * Barras mensais com rótulo de valor — usadas nos painéis evolutivos. A última
 * barra (mês corrente) recebe a cor cheia; as demais, uma versão suave.
 */
export function MonthlyBars({
  data,
  labels,
  color = "var(--brand-sky)",
  unit = "",
  height = 150,
}: {
  data: number[];
  labels: string[];
  color?: string;
  unit?: string;
  height?: number;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((v, i) => {
        const last = i === data.length - 1;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="font-mono text-[12px] text-muted-foreground">
              {v}
              {unit}
            </span>
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${(v / max) * (height - 34)}px`,
                background: last ? color : `color-mix(in oklab, ${color} 40%, white)`,
              }}
            />
            <span className={cn("text-[12px]", last ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {labels[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
