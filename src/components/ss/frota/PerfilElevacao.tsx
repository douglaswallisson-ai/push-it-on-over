import { Area, ComposedChart, CartesianGrid, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Mountain, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ss/ui/data";
import { classeRelevo, type TrajetoRelevo } from "@/lib/relevo-api";

const nf = (v: number | null | undefined, c = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

/**
 * Perfil de elevação do dia: altitude ao longo da distância, com a velocidade
 * por cima. A elevação vem do mapa (SRTM); quando o equipamento também grava
 * altitude, ela aparece tracejada para conferência.
 */
export function PerfilElevacao({
  dados,
  carregando,
  erro,
  onHover,
}: {
  dados?: TrajetoRelevo;
  carregando: boolean;
  erro?: unknown;
  onHover: (i: number | null) => void;
}) {
  const r = dados?.resumo;
  const c = classeRelevo(r?.subida_por_100km);
  const pts = dados?.pontos ?? [];

  return (
    <Card
      title="Perfil de elevação"
      icon={Mountain}
      action={r ? <span className="text-[12px] font-semibold" style={{ color: c.cor }}>Relevo {c.rotulo.toLowerCase()}</span> : undefined}
      bodyClassName="p-4"
    >
      {erro ? (
        <p className="py-8 text-center text-sm text-coral">{(erro as Error).message}</p>
      ) : carregando ? (
        <div className="h-[260px] animate-pulse rounded-xl bg-secondary" />
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
          <div className="h-[260px]">
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
                <YAxis yAxisId="v" orientation="right" tick={{ fontSize: 11 }} domain={[0, "auto"]} unit=" km/h" width={64} />
                <Tooltip
                  content={({ active, payload }) => {
                    const p = active && (payload?.[0]?.payload as (typeof pts)[number] | undefined);
                    return p ? (
                      <div className="rounded-xl border border-border bg-white/95 px-3 py-2 text-[12px] shadow-elegant">
                        <p className="font-semibold">{p.hora} · km {nf(p.km, 1)}</p>
                        <p>Elevação: <b>{nf(p.elevacao)} m</b></p>
                        {p.altitude_gps != null && <p className="text-muted-foreground">Equipamento: {nf(p.altitude_gps)} m</p>}
                        <p>Velocidade: <b>{nf(p.velocidade)} km/h</b></p>
                      </div>
                    ) : null;
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="e" dataKey="elevacao" name="Elevação (mapa)" stroke="#8A6A3A" fill="url(#gElev)" strokeWidth={2} connectNulls isAnimationActive animationDuration={1000} />
                {dados?.altitude_do_equipamento && (
                  <Line yAxisId="e" dataKey="altitude_gps" name="Altitude do equipamento" stroke="var(--brand-navy)" strokeDasharray="4 3" strokeWidth={1.2} dot={false} connectNulls />
                )}
                <Line yAxisId="v" dataKey="velocidade" name="Velocidade" stroke="var(--leaf)" strokeWidth={1.2} dot={false} strokeOpacity={0.7} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Elevação pelo mapa da NASA (SRTM, ~90 m) em cada posição com o veículo andando. Passe o mouse no gráfico para ver o ponto no mapa.
          </p>
        </>
      )}
    </Card>
  );
}
