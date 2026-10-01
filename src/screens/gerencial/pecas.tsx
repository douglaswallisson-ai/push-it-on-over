import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Info as InfoIcon, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ss/ui/data";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { nf } from "@/lib/gerencial-api";
import { cn } from "@/lib/utils";

/**
 * Peças das páginas do BI no Gerencial: indicador com explicação,
 * número animado, velocímetro contra a meta, matriz de calor e barras de
 * ranking. Tudo no visual do sistema (cartões, cores leaf/coral/gold/navy).
 */

export const ANIM = { animationDuration: 900, animationEasing: "ease-out" as const };

/** Ícone "i" com a explicação do indicador ao passar o mouse. */
export function Info({ texto, className }: { texto: ReactNode; className?: string }) {
  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>
        <button type="button" aria-label="O que é este indicador" className={cn("inline-flex text-muted-foreground/70 transition-colors hover:text-brand-navy", className)}>
          <InfoIcon className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[300px] rounded-xl border border-border bg-white px-3 py-2 text-[12px] leading-relaxed text-foreground shadow-elegant">
        {texto}
      </TooltipContent>
    </Tooltip>
  );
}

/** Conta de 0 até o valor quando ele chega ou muda. */
export function useContagem(alvo: number | null | undefined, ms = 900) {
  const [v, setV] = useState(0);
  const de = useRef(0);
  useEffect(() => {
    if (alvo == null || Number.isNaN(alvo)) return;
    const ini = performance.now();
    const origem = de.current;
    let raf = 0;
    const passo = (agora: number) => {
      const p = Math.min(1, (agora - ini) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      const atual = origem + (alvo - origem) * e;
      setV(atual);
      de.current = atual;
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, ms]);
  return alvo == null || Number.isNaN(alvo) ? null : v;
}

export function Numero({ valor, fmt = (n) => nf(n) }: { valor: number | null | undefined; fmt?: (n: number) => string }) {
  const v = useContagem(valor);
  return <>{v == null ? "—" : fmt(v)}</>;
}

export function Variacao({ atual, anterior, menorMelhor, rotulo = "vs. período anterior" }: { atual: number | null; anterior: number | null; menorMelhor?: boolean; rotulo?: string }) {
  if (atual == null || anterior == null || anterior === 0) return null;
  const v = (atual - anterior) / Math.abs(anterior);
  const bom = menorMelhor ? v < 0 : v > 0;
  const Icone = v >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-semibold", bom ? "text-leaf" : "text-coral")}>
      <Icone className="h-3.5 w-3.5" />
      {nf(Math.abs(v) * 100, 1)}% {rotulo}
    </span>
  );
}

export function Kpi({
  icon: Icone, label, valor, fmt, texto, unidade, dica, alerta, atual, anterior, menorMelhor, sub,
}: {
  icon: LucideIcon;
  label: string;
  /** Número a animar. Use `texto` quando o valor não é número. */
  valor?: number | null;
  fmt?: (n: number) => string;
  texto?: string;
  unidade?: string;
  dica?: ReactNode;
  alerta?: boolean;
  atual?: number | null;
  anterior?: number | null;
  menorMelhor?: boolean;
  sub?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group rounded-2xl border bg-card p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elegant",
        alerta ? "border-coral-line" : "border-border",
      )}
    >
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Icone className={cn("h-4 w-4 shrink-0", alerta ? "text-coral" : "text-brand-navy")} />
        <span className="truncate">{label}</span>
        {alerta && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-coral" />}
        {dica && <Info texto={dica} className="ml-auto" />}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">
        {texto ?? <Numero valor={valor} fmt={fmt} />}
        {unidade && <span className="ml-1 text-[12px] font-medium text-muted-foreground">{unidade}</span>}
      </p>
      <div className="mt-1 min-h-[16px] text-[11.5px] text-muted-foreground">
        {atual !== undefined ? <Variacao atual={atual ?? null} anterior={anterior ?? null} menorMelhor={menorMelhor} /> : sub}
      </div>
    </div>
  );
}

/**
 * Velocímetro de meio círculo, como os do Ranking de Condução do Power BI:
 * o arco é o valor, o traço escuro é a meta. Verde quando cumpre a meta.
 */
export function Velocimetro({
  rotulo, valor, meta, max = 1, menorMelhor, dica, fmt = (n) => `${nf(n * 100, 1)}%`,
}: {
  rotulo: string;
  valor: number | null;
  meta?: number | null;
  max?: number;
  menorMelhor?: boolean;
  dica?: ReactNode;
  fmt?: (n: number) => string;
}) {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const r = 46;
  const comp = Math.PI * r;
  const lim = Math.max(max, meta ?? 0, valor ?? 0) || 1;
  const p = valor == null ? 0 : Math.min(1, valor / lim);
  // Compara no arredondamento exibido: 0,0% contra meta 0% é "cumprida".
  const arred = (x: number) => (lim > 1.5 ? Math.round(x * 10) / 10 : Math.round(x * 1000) / 1000);
  const cumpre = valor == null || meta == null ? null : menorMelhor ? arred(valor) <= arred(meta) : arred(valor) >= arred(meta);
  const cor = cumpre == null ? "var(--brand-sky)" : cumpre ? "var(--leaf)" : "var(--coral)";
  const ang = meta == null ? null : Math.PI * (1 - Math.min(1, meta / lim));
  const animado = useContagem(valor ?? null);

  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-3 pb-3 pt-2 shadow-card transition-all duration-300 hover:shadow-elegant">
      <div className="flex w-full items-center justify-center gap-1 text-[12px] font-semibold text-foreground">
        <span className="truncate">{rotulo}</span>
        {dica && <Info texto={dica} />}
      </div>
      <svg viewBox="0 0 120 70" className="mt-1 w-full max-w-[170px]">
        <path d={`M 14 62 A ${r} ${r} 0 0 1 106 62`} fill="none" stroke="var(--secondary)" strokeWidth="11" strokeLinecap="round" />
        <path
          d={`M 14 62 A ${r} ${r} 0 0 1 106 62`}
          fill="none"
          stroke={cor}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${comp} ${comp}`}
          strokeDashoffset={montado ? comp * (1 - p) : comp}
          opacity={p > 0.002 ? 1 : 0}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1), stroke .3s" }}
        />
        {ang != null && (
          <line
            x1={60 + (r - 9) * Math.cos(ang)}
            y1={62 - (r - 9) * Math.sin(ang)}
            x2={60 + (r + 9) * Math.cos(ang)}
            y2={62 - (r + 9) * Math.sin(ang)}
            stroke="var(--brand-navy)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
        <text x="60" y="58" textAnchor="middle" className="fill-foreground font-display" style={{ fontSize: 15, fontWeight: 700 }}>
          {animado == null ? "—" : fmt(animado)}
        </text>
      </svg>
      <p className="text-[11px] text-muted-foreground">
        {meta == null ? "sem meta cadastrada" : <>Meta {fmt(meta)} {cumpre != null && <span className={cumpre ? "text-leaf" : "text-coral"}>· {cumpre ? "cumprida" : "fora"}</span>}</>}
      </p>
    </div>
  );
}

export function Grafico({ titulo, icon, children, altura = 280, rodape, dica, acao }: { titulo: string; icon: LucideIcon; children: ReactNode; altura?: number; rodape?: ReactNode; dica?: ReactNode; acao?: ReactNode }) {
  return (
    <Card
      title={titulo}
      icon={icon}
      action={(dica || acao) && <div className="flex items-center gap-2">{acao}{dica && <Info texto={dica} />}</div>}
      bodyClassName="p-4"
    >
      <div style={{ height: altura }}>
        <ResponsiveContainer>{children as ReactElement}</ResponsiveContainer>
      </div>
      {rodape && <p className="mt-2 text-[11.5px] text-muted-foreground">{rodape}</p>}
    </Card>
  );
}

export function DicaGrafico({ active, payload, label, fmt }: { active?: boolean; payload?: { name: string; value: number; color: string; payload?: Record<string, unknown> }[]; label?: string; fmt?: (v: number, nome: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-white/95 px-3 py-2 text-[12px] shadow-elegant backdrop-blur">
      {label != null && <p className="mb-1 font-semibold text-foreground">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-semibold">{fmt ? fmt(p.value, p.name) : nf(p.value, 1)}</span>
        </p>
      ))}
    </div>
  );
}

export const Carregando = ({ q, children, vazio }: { q: { isPending: boolean; error: unknown; data?: unknown }; children: ReactNode; vazio?: boolean }) =>
  q.error ? (
    <p className="rounded-2xl border border-coral-line bg-coral-tint/30 py-10 text-center text-sm text-coral">Não foi possível carregar: {(q.error as Error).message}</p>
  ) : q.isPending ? (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-secondary" />)}
    </div>
  ) : vazio ? (
    <p className="rounded-2xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">Sem dados para os filtros escolhidos.</p>
  ) : (
    <>{children}</>
  );

/** Barras horizontais animadas para rankings (top N). */
export function BarrasRank({
  itens, fmt = (n) => nf(n), cor = "var(--brand-navy)", vazio = "Sem dados.", onClick,
}: {
  itens: { nome: string; valor: number; detalhe?: ReactNode; chave?: string | number }[];
  fmt?: (n: number) => string;
  cor?: string | ((i: number) => string);
  vazio?: string;
  onClick?: (chave: string | number | undefined) => void;
}) {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const max = Math.max(...itens.map((i) => i.valor), 0) || 1;
  if (!itens.length) return <p className="py-6 text-center text-sm text-muted-foreground">{vazio}</p>;
  return (
    <ol className="space-y-1.5">
      {itens.map((it, i) => (
        <li
          key={it.chave ?? it.nome + i}
          onClick={onClick ? () => onClick(it.chave) : undefined}
          className={cn("group grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1.5 py-1 text-[12.5px]", onClick && "cursor-pointer hover:bg-secondary/70")}
          title={`${it.nome}: ${fmt(it.valor)}`}
        >
          <span className="text-right font-mono text-[11px] text-muted-foreground">{i + 1}</span>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-medium text-foreground">{it.nome}</span>
            </div>
            <div className="mt-0.5 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-2 rounded-full"
                style={{
                  width: montado ? `${(100 * it.valor) / max}%` : "0%",
                  background: typeof cor === "function" ? cor(i) : cor,
                  transition: `width 900ms cubic-bezier(.2,.8,.2,1) ${i * 35}ms`,
                }}
              />
            </div>
            {it.detalhe && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{it.detalhe}</div>}
          </div>
          <span className="font-mono text-[12px] font-semibold tabular-nums">{fmt(it.valor)}</span>
        </li>
      ))}
    </ol>
  );
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Matriz dia da semana × hora (Matriz Calor Eventos / Excesso Parado). */
export function MatrizCalor({ celulas, fmt = (n) => nf(n), unidade = "eventos", cor = "210 70% 35%" }: { celulas: { dow: number; hora: number; n: number }[]; fmt?: (n: number) => string; unidade?: string; cor?: string }) {
  const mapa = new Map(celulas.map((c) => [`${c.dow}-${c.hora}`, c.n]));
  const max = Math.max(...celulas.map((c) => c.n), 0) || 1;
  const totLinha = (d: number) => celulas.filter((c) => c.dow === d).reduce((a, c) => a + c.n, 0);
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMontado(true), 30);
    return () => clearTimeout(t);
  }, []);
  // Começa na segunda, como o BI.
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-[3px] text-[10.5px]">
        <thead>
          <tr>
            <th />
            {Array.from({ length: 24 }, (_, h) => <th key={h} className="font-mono font-normal text-muted-foreground">{String(h).padStart(2, "0")}</th>)}
            <th className="pl-2 text-right font-mono font-normal text-muted-foreground">Total</th>
          </tr>
        </thead>
        <tbody>
          {ordem.map((d, li) => (
            <tr key={d}>
              <td className="pr-2 text-right font-semibold text-muted-foreground">{DIAS_SEMANA[d]}</td>
              {Array.from({ length: 24 }, (_, h) => {
                const n = mapa.get(`${d}-${h}`) ?? 0;
                const a = n / max;
                return (
                  <td
                    key={h}
                    title={`${DIAS_SEMANA[d]} ${String(h).padStart(2, "0")}h: ${fmt(n)} ${unidade}`}
                    className="h-7 rounded-[5px] text-center font-mono transition-all duration-500 hover:scale-110 hover:ring-2 hover:ring-brand-navy/40"
                    style={{
                      background: n ? `hsl(${cor} / ${montado ? 0.08 + a * 0.85 : 0})` : "var(--secondary)",
                      color: a > 0.55 ? "white" : "var(--muted-foreground)",
                      transitionDelay: `${li * 40 + h * 8}ms`,
                    }}
                  >
                    {n ? (n >= 1000 ? `${nf(n / 1000, 1)}k` : fmt(n)) : ""}
                  </td>
                );
              })}
              <td className="pl-2 text-right font-mono font-semibold">{fmt(totLinha(d))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Aviso({ children, tom = "gold" }: { children: ReactNode; tom?: "gold" | "sky" }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[12.5px]", tom === "gold" ? "border-gold-line bg-gold-tint text-foreground" : "border-border bg-navy-tint")}>
      <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-navy" />
      <div>{children}</div>
    </div>
  );
}

export const dataBR = (s: string | null | undefined) => (s ? new Date(s.length <= 10 ? s + "T12:00" : s).toLocaleDateString("pt-BR") : "—");
export const dataHoraBR = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
