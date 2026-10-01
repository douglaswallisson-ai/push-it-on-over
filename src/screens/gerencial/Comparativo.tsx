import { useEffect, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { nf } from "@/lib/gerencial-api";
import { cn } from "@/lib/utils";
import { Info, Numero } from "./pecas";

/**
 * Período × período anterior em cartões, no lugar da tabela de indicadores:
 * valor animado, barras atual × anterior, variação colorida pelo sentido bom
 * do indicador e a evolução dia a dia em minigráfico.
 */

export type ItemComparativo = {
  rotulo: string;
  unidade?: string;
  atual: number | null;
  anterior: number | null;
  /** Sem isso, cair é bom (consumo, eventos, ociosidade). */
  maiorEhMelhor?: boolean;
  casas?: number;
  dica: ReactNode;
  serie?: number[];
};

export type GrupoComparativo = { titulo: string; itens: ItemComparativo[] };

function Minigrafico({ valores, cor }: { valores: number[]; cor: string }) {
  const [desenhado, setDesenhado] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setDesenhado(true));
    return () => cancelAnimationFrame(t);
  }, []);
  if (valores.length < 2) return <div className="h-9" />;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const amp = max - min || 1;
  const pts = valores.map((v, i) => [(i / (valores.length - 1)) * 100, 32 - ((v - min) / amp) * 28]);
  const linha = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const id = `g${Math.round(Math.random() * 1e9)}`;
  return (
    <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="h-9 w-full">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity={0.28} />
          <stop offset="100%" stopColor={cor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,34 ${linha} 100,34`} fill={`url(#${id})`} className="transition-opacity duration-700" opacity={desenhado ? 1 : 0} />
      <polyline
        points={linha}
        fill="none"
        stroke={cor}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={desenhado ? 0 : 1}
        style={{ transition: "stroke-dashoffset 1.2s ease-out" }}
      />
    </svg>
  );
}

function Cartao({ it, i }: { it: ItemComparativo; i: number }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const casas = it.casas ?? 0;
  const v = it.atual != null && it.anterior ? (it.atual - it.anterior) / Math.abs(it.anterior) : null;
  const neutro = v == null || Math.abs(v) < 0.005;
  const bom = v == null ? null : it.maiorEhMelhor ? v > 0 : v < 0;
  const cor = neutro ? "var(--muted-foreground)" : bom ? "var(--leaf)" : "var(--coral)";
  const max = Math.max(it.atual ?? 0, it.anterior ?? 0) || 1;
  const Seta = neutro ? Minus : (v ?? 0) > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className="group flex flex-col rounded-2xl border border-border bg-card p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elegant animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${i * 45}ms`, animationFillMode: "both" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12.5px] font-medium text-muted-foreground">{it.rotulo}</span>
        <Info texto={it.dica} />
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="font-display text-[26px] font-bold leading-none tabular-nums text-foreground">
          <Numero valor={it.atual} fmt={(n) => nf(n, casas)} />
          {it.unidade && <span className="ml-1 text-[12px] font-medium text-muted-foreground">{it.unidade}</span>}
        </p>
        <span
          className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-semibold"
          style={{ color: cor, background: neutro ? "var(--secondary)" : bom ? "var(--leaf-tint)" : "var(--coral-tint)" }}
          title="Variação contra o período anterior de mesmo tamanho"
        >
          <Seta className="h-3.5 w-3.5" />
          {v == null ? "—" : `${nf(Math.abs(v) * 100, 1)}%`}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {[
          { r: "Período", val: it.atual, c: "var(--brand-navy)" },
          { r: "Anterior", val: it.anterior, c: "#C3CBD6" },
        ].map((b) => (
          <div key={b.r} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">{b.r}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-1.5 rounded-full"
                style={{ width: montado && b.val != null ? `${(100 * b.val) / max}%` : "0%", background: b.c, transition: `width 900ms cubic-bezier(.2,.8,.2,1) ${i * 45}ms` }}
              />
            </div>
            <span className="font-mono tabular-nums text-muted-foreground">{b.val == null ? "—" : nf(b.val, casas)}</span>
          </div>
        ))}
      </div>

      {it.serie && it.serie.length > 1 && (
        <div className="mt-2 border-t border-border pt-2" title="Evolução dia a dia no período">
          <Minigrafico valores={it.serie} cor={neutro ? "var(--brand-navy)" : cor} />
        </div>
      )}
    </div>
  );
}

export function ComparativoIndicadores({ grupos }: { grupos: GrupoComparativo[] }) {
  let n = 0;
  return (
    <TooltipProvider>
    <div className="space-y-5">
      {grupos.map((g) => (
        <div key={g.titulo}>
          <p className="mb-2 flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <span className="h-px w-5 bg-border" />
            {g.titulo}
          </p>
          <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", g.itens.length >= 5 ? "lg:grid-cols-3 xl:grid-cols-5" : "xl:grid-cols-4")}>
            {g.itens.map((it) => <Cartao key={it.rotulo} it={it} i={n++} />)}
          </div>
        </div>
      ))}
    </div>
    </TooltipProvider>
  );
}
