import { useState } from "react";
import { Area, ComposedChart, CartesianGrid, Legend, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { COR_EVENTO, ROTULO_EVENTO } from "@/lib/bi-api";
import { ExternalLink, MapPin, Mountain, TrendingDown, TrendingUp, X } from "lucide-react";
import { Card } from "@/components/ss/ui/data";
import { Link } from "@/lib/router-compat";
import { classeRelevo, type EventoTrajeto, type TrajetoRelevo } from "@/lib/relevo-api";

const nf = (v: number | null | undefined, c = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

type Serie = "elevacao" | "altitude_gps" | "velocidade" | "rpm";
const NOMES: Record<Serie, string> = {
  elevacao: "Elevação (mapa)",
  altitude_gps: "Altitude do equipamento",
  velocidade: "Velocidade",
  rpm: "RPM",
};

/**
 * Perfil do dia: altitude ao longo da distância, com velocidade e RPM por
 * cima, e os eventos no ponto do percurso onde aconteceram. A elevação vem do
 * mapa (SRTM); quando o equipamento grava altitude, ela aparece tracejada.
 *
 * Clicar numa bolinha de evento abre a caixa com tudo o que se sabe dele e
 * leva para o mapa ou para a tela de Eventos.
 */
export function PerfilElevacao({
  dados,
  carregando,
  erro,
  onHover,
  onVerNoMapa,
  linkMapa,
  rotuloVeiculo,
}: {
  dados?: TrajetoRelevo;
  carregando: boolean;
  erro?: unknown;
  onHover: (i: number | null) => void;
  /** Na tela de Percurso: centraliza o mapa da própria tela no evento. */
  onVerNoMapa?: (e: EventoTrajeto) => void;
  /** Fora dela (ex.: Veículos): endereço do Percurso do dia focado no evento. */
  linkMapa?: (e: EventoTrajeto) => string;
  rotuloVeiculo?: string;
}) {
  const r = dados?.resumo;
  const c = classeRelevo(r?.subida_por_100km);
  const pts = dados?.pontos ?? [];
  const temRpm = pts.some((p) => p.rpm);
  const [ocultas, setOcultas] = useState<Set<Serie>>(new Set());
  const [evento, setEvento] = useState<EventoTrajeto | null>(null);
  const alternar = (s: Serie) =>
    setOcultas((o) => {
      const n = new Set(o);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });
  const linkEventos = (e: EventoTrajeto) =>
    `/app/eventos?veiculo=${encodeURIComponent(rotuloVeiculo ?? String(dados?.unit_id ?? ""))}&data=${dados?.dia ?? ""}&hora=${e.hora.slice(0, 5)}`;

  return (
    <Card
      title="Perfil do percurso"
      icon={Mountain}
      action={r ? <span className="text-[12px] font-semibold" style={{ color: c.cor }}>Relevo {c.rotulo.toLowerCase()}</span> : undefined}
      bodyClassName="p-4"
    >
      {erro ? (
        <p className="py-8 text-center text-sm text-coral">{(erro as Error).message}</p>
      ) : carregando ? (
        <div className="h-[280px] animate-pulse rounded-xl bg-secondary" />
      ) : pts.length < 2 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Sem deslocamento neste dia para montar o perfil.</p>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { r: "Subida", v: `${nf(r?.subida_m)} m`, i: TrendingUp, cor: "var(--coral)" },
              { r: "Descida", v: `${nf(r?.descida_m)} m`, i: TrendingDown, cor: "var(--leaf)" },
              { r: "Subida /100 km", v: `${nf(r?.subida_por_100km)} m`, i: Mountain, cor: c.cor },
              { r: "Em aclive", v: `${nf(r?.pct_aclive, 1)}%`, i: TrendingUp, cor: "var(--gold)" },
              { r: "Altitude", v: `${nf(r?.elevacao_min)}–${nf(r?.elevacao_max)} m`, i: Mountain, cor: "var(--brand-navy)" },
            ].map((x) => (
              <div key={x.r} className="rounded-xl bg-secondary/60 px-3 py-2">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><x.i className="h-3.5 w-3.5" style={{ color: x.cor }} />{x.r}</p>
                <p className="font-display text-[17px] font-bold tabular-nums">{x.v}</p>
              </div>
            ))}
          </div>
          <div className="relative h-[300px]">
            <ResponsiveContainer>
              <ComposedChart
                data={pts}
                margin={{ left: 0, right: 8, top: 6 }}
                onMouseMove={(e) => onHover(typeof e?.activeTooltipIndex === "number" ? e.activeTooltipIndex : null)}
                onMouseLeave={() => onHover(null)}
              >
                <defs>
                  <linearGradient id="gElev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8A6A3A" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#C9B48A" stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="km" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => `${nf(v)} km`} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="e" tick={{ fontSize: 11 }} domain={["auto", "auto"]} unit=" m" width={62} />
                <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 11 }} domain={[0, "auto"]} unit=" km/h" width={64} hide={ocultas.has("velocidade")} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} domain={[0, "auto"]} width={52} hide={!temRpm || ocultas.has("rpm")} tickFormatter={(v) => `${nf(v)}`} />
                <Tooltip
                  content={({ active, payload }) => {
                    const p = active && (payload?.[0]?.payload as (typeof pts)[number] | undefined);
                    return p ? (
                      <div className="rounded-xl border border-border bg-white/95 px-3 py-2 text-[12px] shadow-elegant">
                        <p className="font-semibold">{p.hora} · km {nf(p.km, 1)}</p>
                        <p>Elevação: <b>{nf(p.elevacao)} m</b></p>
                        {p.altitude_gps != null && <p className="text-muted-foreground">Equipamento: {nf(p.altitude_gps)} m</p>}
                        <p>Velocidade: <b>{nf(p.velocidade)} km/h</b></p>
                        {p.rpm != null && <p>RPM: <b>{nf(p.rpm)}</b></p>}
                      </div>
                    ) : null;
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, cursor: "pointer" }}
                  onClick={(o) => alternar((o as { dataKey?: Serie }).dataKey as Serie)}
                  formatter={(v, o) => <span style={{ opacity: ocultas.has((o as { dataKey?: Serie }).dataKey as Serie) ? 0.4 : 1 }}>{v}</span>}
                />
                <Area yAxisId="e" dataKey="elevacao" name={NOMES.elevacao} hide={ocultas.has("elevacao")} stroke="#8A6A3A" fill="url(#gElev)" strokeWidth={2} connectNulls isAnimationActive animationDuration={1000} />
                {dados?.altitude_do_equipamento && (
                  <Line yAxisId="e" dataKey="altitude_gps" name={NOMES.altitude_gps} hide={ocultas.has("altitude_gps")} stroke="var(--brand-navy)" strokeDasharray="4 3" strokeWidth={1.2} dot={false} connectNulls />
                )}
                <Line yAxisId="v" dataKey="velocidade" name={NOMES.velocidade} hide={ocultas.has("velocidade")} stroke="var(--leaf)" strokeWidth={1.2} dot={false} strokeOpacity={0.75} />
                {temRpm && <Line yAxisId="r" dataKey="rpm" name={NOMES.rpm} hide={ocultas.has("rpm")} stroke="#7B4FBF" strokeWidth={1.1} dot={false} strokeOpacity={0.7} connectNulls />}
                {/* Eventos no km do percurso em que aconteceram, na altura do terreno. Clique abre o detalhe. */}
                {(dados?.eventos ?? []).filter((e) => e.km != null).map((e, i) => {
                  const perto = pts.reduce((m, p) => (Math.abs(p.km - (e.km ?? 0)) < Math.abs(m.km - (e.km ?? 0)) ? p : m), pts[0]);
                  return perto?.elevacao == null ? null : (
                    <ReferenceDot
                      key={i}
                      yAxisId="e"
                      x={perto.km}
                      y={perto.elevacao}
                      r={evento === e ? 7 : 5}
                      fill={COR_EVENTO[e.tipo]}
                      stroke="#fff"
                      strokeWidth={1.5}
                      ifOverflow="extendDomain"
                      style={{ cursor: "pointer" }}
                      onClick={() => setEvento(e)}
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>

            {evento && (
              <CaixaEvento
                e={evento}
                rotuloVeiculo={rotuloVeiculo}
                onClose={() => setEvento(null)}
                onVerNoMapa={onVerNoMapa ? () => onVerNoMapa(evento) : undefined}
                linkMapa={linkMapa?.(evento)}
                linkEventos={linkEventos(evento)}
              />
            )}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Elevação pelo mapa da NASA (SRTM, ~90 m). Clique numa bolinha para ver o evento; clique na legenda para mostrar ou esconder cada linha.
          </p>
        </>
      )}
    </Card>
  );
}

function CaixaEvento({
  e,
  rotuloVeiculo,
  onClose,
  onVerNoMapa,
  linkMapa,
  linkEventos,
}: {
  e: EventoTrajeto;
  rotuloVeiculo?: string;
  onClose: () => void;
  onVerNoMapa?: () => void;
  linkMapa?: string;
  linkEventos: string;
}) {
  const linhas: [string, string][] = [
    ["Hora", e.hora],
    ["Veículo", rotuloVeiculo ?? "—"],
    ["Motorista", e.motorista ?? "não identificado"],
    ["Velocidade", e.velocidade != null ? `${nf(e.velocidade)} km/h` : "—"],
    ["RPM", e.rpm != null ? nf(e.rpm) : "—"],
    ["Km do percurso no dia", e.km != null ? `${nf(e.km, 1)} km` : "—"],
    ["Elevação", e.elevacao != null ? `${nf(e.elevacao)} m` : "—"],
    ["Combustível", e.combustivel != null ? `${nf(e.combustivel)}%` : "—"],
    ["Local", e.endereco ?? "—"],
    ["Coordenadas", `${e.lat.toFixed(5)}, ${e.lon.toFixed(5)}`],
  ];
  return (
    <div className="absolute right-2 top-2 z-20 w-[320px] rounded-2xl border border-border bg-white p-4 shadow-elegant">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-[14px] font-semibold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_EVENTO[e.tipo] }} />
            {ROTULO_EVENTO[e.tipo]}
          </p>
          {e.evento && <p className="text-[11.5px] text-muted-foreground">{e.evento}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>
      <dl className="space-y-1 text-[12.5px]">
        {linhas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-border/60 pb-1 last:border-0">
            <dt className="shrink-0 text-muted-foreground">{k}</dt>
            <dd className="text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex gap-2">
        {onVerNoMapa ? (
          <button type="button" onClick={onVerNoMapa} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-[12.5px] font-medium text-white hover:opacity-90">
            <MapPin className="h-3.5 w-3.5" /> Ver no mapa
          </button>
        ) : linkMapa ? (
          <Link to={linkMapa} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-[12.5px] font-medium text-white hover:opacity-90">
            <MapPin className="h-3.5 w-3.5" /> Ver no mapa
          </Link>
        ) : null}
        <Link to={linkEventos} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12.5px] font-medium hover:bg-secondary">
          <ExternalLink className="h-3.5 w-3.5" /> Abrir em Eventos
        </Link>
      </div>
    </div>
  );
}
