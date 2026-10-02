import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Mountain, X } from "lucide-react";
import { PerfilElevacao } from "@/components/ss/frota/PerfilElevacao";
import { datasDoPeriodo, iso, ontem } from "@/lib/gerencial-api";
import { classeRelevo, relevoResumoQuery, relevoTrajetoQuery } from "@/lib/relevo-api";
import { usandoMock } from "@/lib/modo";

/**
 * Relevo nas tabelas de Veículos e de Motoristas: a coluna (metros subidos a
 * cada 100 km nos últimos 30 dias) e, ao clicar, a janela com o gráfico.
 */

const nf = (v: number | null | undefined, c = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

/** Relevo dos últimos 30 dias de toda a empresa ativa, por veículo e por motorista. */
export function useRelevoDaTabela() {
  const d = datasDoPeriodo("30d");
  const q = useQuery(relevoResumoQuery({ inicio: d.inicio, fim: d.fim }));
  const porVeiculo = useMemo(() => new Map((q.data?.por_veiculo ?? []).map((v) => [String(v.unit_id), v])), [q.data]);
  const porMotorista = useMemo(() => new Map((q.data?.por_motorista ?? []).map((m) => [m.driver_id, m])), [q.data]);
  return {
    porVeiculo,
    porMotorista,
    calculando: Boolean(q.data?.calculando) || q.isPending,
    progresso: q.data?.progresso ?? 0,
    erro: q.error as Error | null,
  };
}

/** Célula da coluna Relevo: valor, cor da classe e clique para o gráfico. */
export function CelulaRelevo({
  valor,
  km,
  calculando,
  progresso,
  onClick,
}: {
  valor: number | null | undefined;
  km?: number;
  calculando: boolean;
  progresso: number;
  onClick: () => void;
}) {
  if (usandoMock()) return <span className="text-muted-foreground">—</span>;
  if (calculando && valor == null)
    return <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">calculando {nf(progresso * 100)}%</span>;
  if (valor == null) return <span className="text-muted-foreground">—</span>;
  const c = classeRelevo(valor);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${nf(valor)} m de subida a cada 100 km${km ? ` (${nf(km)} km medidos)` : ""} — clique para ver o gráfico`}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2 py-1 text-[12px] transition-colors hover:bg-secondary"
    >
      <span className="h-2 w-2 rounded-full" style={{ background: c.cor }} />
      <span className="font-mono font-semibold">{nf(valor)} m</span>
      <span className="text-muted-foreground">{c.rotulo}</span>
    </button>
  );
}

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Janela com o relevo de um veículo ou motorista. */
export function RelevoDetalhe({
  tipo,
  id,
  nome,
  onClose,
}: {
  tipo: "veiculo" | "motorista";
  id: string;
  nome: string;
  onClose: () => void;
}) {
  const d = datasDoPeriodo("30d");
  const q = useQuery(
    relevoResumoQuery({ inicio: d.inicio, fim: d.fim, placa: tipo === "veiculo" ? id : undefined, condutor: tipo === "motorista" ? id : undefined }),
  );
  const [dia, setDia] = useState(iso(ontem()));
  const trajQ = useQuery(relevoTrajetoQuery(tipo === "veiculo" ? id : undefined, dia));
  const t = q.data?.totais;
  const c = classeRelevo(t?.subida_por_100km);
  const porDia = (q.data?.por_dia ?? []).map((x) => ({
    dia: x.dia,
    rotulo: ddmm(x.dia),
    "Subida por 100 km": x.subida_por_100km ?? 0,
    "Km": x.km,
  }));

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-[rgba(10,16,28,0.5)] p-4 md:p-10" onClick={onClose}>
      <div className="w-full max-w-[1000px] rounded-2xl bg-canvas shadow-elegant" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 rounded-t-2xl border-b border-border bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-tint">
              <Mountain className="h-5 w-5 text-brand-navy" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold">Relevo · {nome}</h2>
              <p className="text-[12px] text-muted-foreground">
                Últimos 30 dias · {tipo === "veiculo" ? "veículo" : "motorista"} ·{" "}
                <span style={{ color: c.cor }} className="font-semibold">{c.rotulo}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {q.data?.calculando ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Calculando o relevo… {nf((q.data.progresso ?? 0) * 100)}%</p>
          ) : q.error ? (
            <p className="py-8 text-center text-sm text-coral">{(q.error as Error).message}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  { r: "Subida /100 km", v: `${nf(t?.subida_por_100km)} m`, cor: c.cor },
                  { r: "Em aclive", v: `${nf(t?.pct_aclive, 1)}%` },
                  { r: "Em declive", v: `${nf(t?.pct_declive, 1)}%` },
                  { r: "Subida total", v: `${nf(t?.subida_m)} m` },
                  { r: "Km medidos", v: nf(t?.km) },
                ].map((x) => (
                  <div key={x.r} className="rounded-xl border border-border bg-card px-3 py-2.5">
                    <p className="text-[11px] text-muted-foreground">{x.r}</p>
                    <p className="font-display text-[18px] font-bold tabular-nums" style={x.cor ? { color: x.cor } : undefined}>{x.v}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-2 text-[13px] font-semibold">Relevo por dia</p>
                <div className="h-[220px]">
                  <ResponsiveContainer>
                    <ComposedChart
                      data={porDia}
                      onClick={(e) => {
                        const p = (e as { activePayload?: { payload: { dia: string } }[] })?.activePayload?.[0]?.payload;
                        if (p && tipo === "veiculo") setDia(p.dia);
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="rotulo" tick={{ fontSize: 10.5 }} />
                      <YAxis yAxisId="s" tick={{ fontSize: 11 }} unit=" m" width={60} />
                      <YAxis yAxisId="k" orientation="right" tick={{ fontSize: 11 }} width={50} />
                      <Tooltip formatter={(v: number, n: string) => (n === "Km" ? `${nf(v)} km` : `${nf(v)} m`)} />
                      <Bar yAxisId="s" dataKey="Subida por 100 km" fill="#8A6A3A" radius={[4, 4, 0, 0]} animationDuration={900} />
                      <Line yAxisId="k" dataKey="Km" stroke="var(--brand-navy)" strokeWidth={2} dot={false} animationDuration={900} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                {tipo === "veiculo" && <p className="mt-1 text-[11px] text-muted-foreground">Clique numa barra para ver o perfil daquele dia abaixo.</p>}
              </div>
              {tipo === "veiculo" && (
                <>
                  <div className="flex items-center justify-end gap-2 text-[12.5px]">
                    Dia do perfil
                    <input type="date" value={dia} max={iso(ontem())} onChange={(e) => e.target.value && setDia(e.target.value)} className="h-8 rounded-lg border border-border bg-white px-2" />
                  </div>
                  <PerfilElevacao
                    dados={trajQ.data}
                    carregando={trajQ.isLoading}
                    erro={trajQ.error}
                    onHover={() => {}}
                    rotuloVeiculo={nome}
                    linkMapa={(e) => `/app/frota/tracking?veiculo=${encodeURIComponent(id)}&dia=${dia}&foco=${e.lat},${e.lon}&focoTitulo=${encodeURIComponent(`${e.evento ?? "Evento"} · ${e.hora.slice(0, 5)}`)}`}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
