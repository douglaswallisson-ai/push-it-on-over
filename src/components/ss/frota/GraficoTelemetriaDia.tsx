import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { telemetriaDiaQuery } from "@/lib/relevo-api";
import { cn } from "@/lib/utils";

/**
 * Gráfico de linhas do dia de um veículo (PM, 13/10/2026 — o gráfico de rpm, altitude, velocidade,
 * combustível e faixas da plataforma antiga): o dia inteiro no tempo, com as linhas de início e fim
 * de cada faixa de rotação tiradas da classificação do próprio rastreador. Legenda liga/desliga cada
 * série; a barra de baixo aproxima um trecho; tooltip com tudo do instante.
 */

const SERIES = [
  { k: "combustivel", rot: "Combustível", cor: "#C9A227", eixo: "c", un: "%" },
  { k: "rpm", rot: "RPM", cor: "#7B4FC9", eixo: "r", un: "rpm" },
  { k: "altitude", rot: "Altitude", cor: "#2E6FB0", eixo: "a", un: "m" },
  { k: "velocidade", rot: "Velocidade", cor: "#3E9B4F", eixo: "v", un: "km/h" },
] as const;
type Serie = (typeof SERIES)[number]["k"];

const COR_FAIXA: Record<string, string> = {
  Verde: "#2f9e44",
  "Extra econômica": "#1c7ed6",
  Amarela: "#e0a800",
  Vermelha: "#d6336c",
};

const nf = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR"));

export function GraficoTelemetriaDia({
  unitId,
  dia,
  driverId,
  rotulo,
  altura = 360,
}: {
  unitId: string | number | undefined;
  dia: string;
  driverId?: string | number;
  rotulo?: string;
  altura?: number;
}) {
  const q = useQuery(telemetriaDiaQuery(unitId, dia, driverId));
  const [ativas, setAtivas] = useState<Set<Serie>>(
    new Set(["combustivel", "rpm", "altitude", "velocidade"]),
  );
  const alternar = (k: Serie) =>
    setAtivas((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const d = q.data;
  const pontos = d?.pontos ?? [];
  const rodou = pontos.some((p) => p.velocidade > 3);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-[13px] font-semibold">
          Telemetria do dia{rotulo ? ` · ${rotulo}` : ""} · {dia.split("-").reverse().join("/")}
        </p>
        {d && <span className="text-[12px] text-muted-foreground">{nf(d.leituras)} leituras</span>}
        {q.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {q.isPending ? (
        <p className="flex h-[200px] items-center justify-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando as leituras do dia…
        </p>
      ) : q.error ? (
        <p className="py-6 text-center text-[13px] text-coral">{(q.error as Error).message}</p>
      ) : !pontos.length ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          Sem leituras deste veículo neste dia.
        </p>
      ) : (
        <>
          {!rodou && (
            <p className="mb-2 text-[12px] text-muted-foreground">
              O veículo não rodou neste dia (só leituras paradas).
            </p>
          )}
          <div style={{ height: altura }}>
            <ResponsiveContainer>
              <ComposedChart data={pontos} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hora" tick={{ fontSize: 11 }} minTickGap={40} />
                <YAxis
                  yAxisId="c"
                  tick={{ fontSize: 10, fill: "#C9A227" }}
                  width={34}
                  domain={[0, 100]}
                  hide={!ativas.has("combustivel")}
                />
                <YAxis
                  yAxisId="r"
                  tick={{ fontSize: 10, fill: "#7B4FC9" }}
                  width={42}
                  domain={[0, (m: number) => Math.max(2000, Math.ceil(m / 500) * 500)]}
                  hide={!ativas.has("rpm")}
                />
                <YAxis
                  yAxisId="a"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#2E6FB0" }}
                  width={42}
                  domain={["auto", "auto"]}
                  hide={!ativas.has("altitude")}
                />
                <YAxis
                  yAxisId="v"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#3E9B4F" }}
                  width={34}
                  domain={[0, (m: number) => Math.max(80, Math.ceil(m / 20) * 20)]}
                  hide={!ativas.has("velocidade")}
                />
                {ativas.has("rpm") &&
                  (d?.faixas_rpm ?? []).flatMap((f) => [
                    <ReferenceLine
                      key={`${f.faixa}-de`}
                      yAxisId="r"
                      y={f.de}
                      stroke={COR_FAIXA[f.nome] ?? "#888"}
                      strokeDasharray="4 3"
                      label={{
                        value: `Início da faixa ${f.nome.toLowerCase()} · ${nf(f.de)} rpm`,
                        position: "insideBottomLeft",
                        fontSize: 10,
                        fill: COR_FAIXA[f.nome] ?? "#888",
                      }}
                    />,
                    <ReferenceLine
                      key={`${f.faixa}-ate`}
                      yAxisId="r"
                      y={f.ate}
                      stroke={COR_FAIXA[f.nome] ?? "#888"}
                      strokeDasharray="4 3"
                      label={{
                        value: `Fim da faixa ${f.nome.toLowerCase()} · ${nf(f.ate)} rpm`,
                        position: "insideTopRight",
                        fontSize: 10,
                        fill: COR_FAIXA[f.nome] ?? "#888",
                      }}
                    />,
                  ])}
                <Tooltip
                  content={({ active, payload }) => {
                    const p = active
                      ? (payload?.[0]?.payload as (typeof pontos)[number] | undefined)
                      : undefined;
                    if (!p) return null;
                    return (
                      <div className="rounded-xl border border-border bg-white/95 px-3 py-2 text-[12px] shadow-elegant">
                        <p className="font-semibold">{p.hora}</p>
                        <p style={{ color: "#7B4FC9" }}>
                          RPM: <b>{nf(p.rpm)}</b>
                        </p>
                        <p style={{ color: "#3E9B4F" }}>
                          Velocidade: <b>{nf(p.velocidade)} km/h</b>
                        </p>
                        <p style={{ color: "#2E6FB0" }}>
                          Altitude: <b>{nf(p.altitude)} m</b>
                        </p>
                        <p style={{ color: "#C9A227" }}>
                          Combustível:{" "}
                          <b>{p.combustivel == null ? "—" : `${nf(p.combustivel)}%`}</b>
                        </p>
                        <p>
                          Faixa: <b>{p.faixa ?? "—"}</b> · ignição{" "}
                          {p.ignicao ? "ligada" : "desligada"}
                        </p>
                        {p.motorista && <p className="text-muted-foreground">{p.motorista}</p>}
                      </div>
                    );
                  }}
                />
                {SERIES.map((s) =>
                  ativas.has(s.k) ? (
                    <Line
                      key={s.k}
                      yAxisId={s.eixo}
                      dataKey={s.k}
                      stroke={s.cor}
                      strokeWidth={s.k === "combustivel" || s.k === "altitude" ? 1.8 : 1.3}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ) : null,
                )}
                <Brush dataKey="hora" height={22} stroke="var(--brand-navy)" travellerWidth={8} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[12px]">
            <span className="text-muted-foreground">Clique para ligar/desligar:</span>
            {SERIES.map((s) => (
              <button
                key={s.k}
                type="button"
                onClick={() => alternar(s.k)}
                aria-pressed={ativas.has(s.k)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5",
                  ativas.has(s.k)
                    ? "border-border bg-white"
                    : "border-dashed border-border opacity-50",
                )}
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} /> {s.rot}
              </button>
            ))}
          </div>
          {!!d?.tempo_por_faixa.length && (
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
              <span className="text-muted-foreground">Tempo em cada faixa:</span>
              {d.tempo_por_faixa
                .filter((t) => t.min > 0)
                .slice(0, 10)
                .map((t) => (
                  <span key={t.faixa} className="rounded-full bg-secondary px-2 py-0.5">
                    {t.faixa.charAt(0) + t.faixa.slice(1).toLowerCase()} · {nf(t.min)} min (
                    {t.pct.toLocaleString("pt-BR")}%)
                  </span>
                ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            As linhas tracejadas mostram onde cada faixa começou e terminou neste dia, pela
            classificação do próprio rastreador (a maior parte das leituras, sem os 5% das pontas).
            Arraste a barra de baixo para aproximar um trecho.
            {d &&
              !d.altitude_do_equipamento &&
              " Altitude pelo mapa de relevo (o equipamento não grava altitude)."}
          </p>
        </>
      )}
    </div>
  );
}
