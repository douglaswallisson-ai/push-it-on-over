import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Truck, User } from "lucide-react";
import { api } from "@/lib/api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { cn } from "@/lib/utils";

/**
 * Linha do tempo de eventos (ss-fleet-core, endpoints/timeline.py).
 *
 * Cada linha é um veículo (ou um motorista): as barras verdes são as viagens
 * e as marcas são os eventos no minuto em que aconteceram. Clicando na linha,
 * ela abre uma faixa por tipo de evento, com a contagem — o desenho que o
 * gestor usa para ver "quando" o problema acontece, não só "quantas vezes".
 */

type Evento = { cod: number; nome: string; gravidade: "critico" | "atencao" | "leve"; min: number[] };
type Linha = {
  id: number;
  titulo: string;
  sub: string | null;
  viagens: { de: number; ate: number; motorista: string | null; produtiva: boolean }[];
  eventos: Evento[];
  total_eventos: number;
  criticos: number;
  minutos_em_viagem: number;
  eventos_por_hora: number | null;
};
type Resposta = {
  inicio: string;
  fim: string;
  minutos: number;
  tipos: { cod: number; nome: string; gravidade: Evento["gravidade"]; total: number }[];
  linhas: Linha[];
  motoristas: { id: number; nome: string }[];
};

const COR: Record<Evento["gravidade"], string> = { critico: "#c0392b", atencao: "#d6a419", leve: "#32A9D9" };
const nf = (v: number | null | undefined, c = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const capital = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase());

type Periodo = "24h" | "hoje" | "ontem" | "data";

function janela(p: Periodo, data: string): { inicio?: string; horas: number } {
  const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T00:00:00`;
  if (p === "hoje") return { inicio: iso(meiaNoite(new Date())), horas: 24 };
  if (p === "ontem") {
    const d = meiaNoite(new Date());
    d.setDate(d.getDate() - 1);
    return { inicio: iso(d), horas: 24 };
  }
  if (p === "data" && data) return { inicio: `${data}T00:00:00`, horas: 24 };
  return { horas: 24 };
}

export default function TimelineEventos({ alternar }: { alternar: React.ReactNode }) {
  const g = grupoAtivo();
  const [periodo, setPeriodo] = useState<Periodo>("24h");
  const [data, setData] = useState("");
  const [agrupar, setAgrupar] = useState<"veiculo" | "motorista">("veiculo");
  const [veiculo, setVeiculo] = useState("");
  const [motorista, setMotorista] = useState("");
  const [ocultos, setOcultos] = useState<Set<number>>(new Set());
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const j = janela(periodo, data);

  const qs = new URLSearchParams({ horas: String(j.horas), agrupar });
  if (g) qs.set("group_id", g);
  if (j.inicio) qs.set("inicio", j.inicio);
  if (veiculo) qs.set("unit_id", veiculo);
  if (motorista) qs.set("driver_id", motorista);
  const q = useQuery({
    queryKey: ["timeline", qs.toString()],
    queryFn: () => api.get<Resposta>(`/api/v1/eventos/timeline?${qs}`),
    staleTime: 60_000,
    refetchInterval: periodo === "24h" ? 120_000 : false,
  });
  // Lista de veículos para o filtro: a da frota inteira (sem filtro aplicado).
  const frota = useQuery({
    queryKey: ["timeline", "frota", g ?? "", j.inicio ?? "24h"],
    queryFn: () => api.get<Resposta>(`/api/v1/eventos/timeline?horas=${j.horas}&agrupar=veiculo${g ? `&group_id=${g}` : ""}${j.inicio ? `&inicio=${j.inicio}` : ""}`),
    staleTime: 5 * 60_000,
    enabled: Boolean(veiculo || motorista),
  });
  const r = q.data;
  const listaVeiculos = (veiculo || motorista ? frota.data : r)?.linhas ?? [];
  const listaMotoristas = (veiculo || motorista ? frota.data : r)?.motoristas ?? [];

  const linhas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (r?.linhas ?? []).filter((l) => !b || `${l.titulo} ${l.sub ?? ""}`.toLowerCase().includes(b));
  }, [r, busca]);
  const unica = linhas.length === 1;

  const marcas = useMemo(() => {
    if (!r) return [];
    const ini = new Date(r.inicio);
    const out: { pct: number; rotulo: string }[] = [];
    for (let m = 0; m <= r.minutos; m += 60) {
      const d = new Date(ini.getTime() + m * 60_000);
      out.push({ pct: (100 * m) / r.minutos, rotulo: `${String(d.getHours()).padStart(2, "0")}h` });
    }
    return out;
  }, [r]);

  const alternarAberto = (k: string) =>
    setAbertos((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        {alternar}
        <span className="mx-1 h-6 w-px bg-border" />
        <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} aria-label="Período" className="h-9 rounded-lg border border-border bg-white px-3 text-[13px]">
          <option value="24h">Últimas 24 horas</option>
          <option value="hoje">Hoje</option>
          <option value="ontem">Ontem</option>
          <option value="data">Escolher dia</option>
        </select>
        {periodo === "data" && (
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Dia" className="h-9 rounded-lg border border-border bg-white px-3 text-[13px]" />
        )}
        <div className="flex gap-1 rounded-lg bg-secondary p-0.5" role="group" aria-label="Agrupar por">
          {(
            [
              ["veiculo", "Por veículo", Truck],
              ["motorista", "Por motorista", User],
            ] as const
          ).map(([id, rot, Ic]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAgrupar(id)}
              aria-pressed={agrupar === id}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium", agrupar === id ? "bg-white shadow-sm" : "text-muted-foreground")}
            >
              <Ic className="h-3.5 w-3.5" /> {rot}
            </button>
          ))}
        </div>
        <select value={veiculo} onChange={(e) => setVeiculo(e.target.value)} aria-label="Veículo" className="h-9 max-w-[220px] rounded-lg border border-border bg-white px-3 text-[13px]">
          <option value="">Todos os veículos</option>
          {(agrupar === "veiculo" || veiculo || motorista ? listaVeiculos : []).map((l) => (
            <option key={l.id} value={String(l.id)}>{l.titulo}</option>
          ))}
        </select>
        <select value={motorista} onChange={(e) => setMotorista(e.target.value)} aria-label="Motorista" className="h-9 max-w-[220px] rounded-lg border border-border bg-white px-3 text-[13px]">
          <option value="">Todos os motoristas</option>
          <option value="0">Sem motorista identificado</option>
          {listaMotoristas.map((m) => (
            <option key={m.id} value={String(m.id)}>{capital(m.nome)}</option>
          ))}
        </select>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na lista" aria-label="Buscar na lista" className="h-9 w-40 rounded-lg border border-border bg-white px-3 text-[13px]" />
        <span className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground">
          {q.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {r ? `${nf(linhas.length)} ${agrupar === "veiculo" ? "veículos" : "motoristas"}` : ""}
        </span>
      </div>

      {/* Tipos de evento (liga/desliga) */}
      {r && r.tipos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {r.tipos.map((t) => {
            const off = ocultos.has(t.cod);
            return (
              <button
                key={t.cod}
                type="button"
                onClick={() =>
                  setOcultos((s) => {
                    const n = new Set(s);
                    n.has(t.cod) ? n.delete(t.cod) : n.add(t.cod);
                    return n;
                  })
                }
                aria-pressed={!off}
                className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition", off ? "border-border bg-secondary text-muted-foreground opacity-60" : "border-border bg-white")}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: off ? "transparent" : COR[t.gravidade], border: `1.5px solid ${COR[t.gravidade]}` }} />
                {capital(t.nome)} <span className="font-mono text-muted-foreground">{nf(t.total)}</span>
              </button>
            );
          })}
        </div>
      )}

      {q.isLoading ? (
        <p className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-8 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Montando a linha do tempo da frota…
        </p>
      ) : q.isError ? (
        <p className="rounded-2xl border border-coral-line bg-coral-tint px-5 py-4 text-[13px]">Não foi possível carregar a linha do tempo. Tente escolher um veículo ou um dia.</p>
      ) : !linhas.length ? (
        <p className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-[13px] text-muted-foreground">Nenhuma viagem ou evento neste período.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <div className="min-w-[1100px]">
            {/* Eixo de horas */}
            <div className="sticky top-0 z-10 grid grid-cols-[280px_1fr] border-b border-border bg-card/95 backdrop-blur">
              <div className="px-4 py-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                {agrupar === "veiculo" ? "Veículo" : "Motorista"} · eventos
              </div>
              <div className="relative h-8 mr-4">
                {marcas.map((m, i) => (
                  <span key={i} className="absolute top-2 -translate-x-1/2 font-mono text-[10.5px] text-muted-foreground" style={{ left: `${m.pct}%` }}>
                    {i % 2 === 0 || marcas.length <= 13 ? m.rotulo : ""}
                  </span>
                ))}
              </div>
            </div>

            {linhas.map((l) => {
              const k = `${agrupar}-${l.id}`;
              const aberto = unica || abertos.has(k);
              const visiveis = l.eventos.filter((e) => !ocultos.has(e.cod));
              return (
                <div key={k} className="border-b border-border last:border-b-0">
                  <div className="grid grid-cols-[280px_1fr] items-center hover:bg-secondary/30">
                    <button type="button" onClick={() => alternarAberto(k)} className="flex min-w-0 items-start gap-2 px-4 py-2 text-left" aria-expanded={aberto}>
                      {aberto ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold" title={l.titulo}>{capital(l.titulo)}</span>
                        <span className="block truncate text-[11px] text-muted-foreground" title={l.sub ?? ""}>{l.sub ? capital(l.sub) : "—"}</span>
                        <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px]">
                          <span className="font-mono">{nf(l.total_eventos)} eventos</span>
                          {l.criticos > 0 && <span className="font-mono text-coral">{nf(l.criticos)} críticos</span>}
                          {l.eventos_por_hora != null && <span className="font-mono text-muted-foreground">{nf(l.eventos_por_hora, 1)}/h</span>}
                        </span>
                      </span>
                    </button>
                    <Faixa r={r!} viagens={l.viagens} eventos={visiveis} compacta />
                  </div>
                  {aberto && (
                    <div className="bg-secondary/20 pb-2">
                      {visiveis.map((e) => (
                        <div key={e.cod} className="grid grid-cols-[280px_1fr] items-center">
                          <span className="truncate px-4 pl-10 text-[11.5px] font-medium text-muted-foreground" title={e.nome}>
                            {capital(e.nome)} <span className="font-mono">({nf(e.min.length)})</span>
                          </span>
                          <Faixa r={r!} eventos={[e]} />
                        </div>
                      ))}
                      {!visiveis.length && <p className="px-10 py-1 text-[12px] text-muted-foreground">Sem eventos dos tipos escolhidos.</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="text-[11.5px] text-muted-foreground">
        Barras verdes: viagens (claras: trechos não produtivos). Marcas: eventos no minuto em que aconteceram — vermelho crítico, amarelo atenção, azul leve.
        Passe o mouse para ver a hora. Fonte: registros do equipamento em tempo real.
      </p>
    </div>
  );
}

/** Faixa de 24 h: barras de viagem (opcional) e marcas de evento, em SVG. */
function Faixa({ r, viagens, eventos, compacta }: { r: Resposta; viagens?: Linha["viagens"]; eventos: Evento[]; compacta?: boolean }) {
  const W = 1000;
  const H = compacta ? 34 : 18;
  const x = (m: number) => (m / r.minutos) * W;
  const ini = new Date(r.inicio).getTime();
  const hora = (m: number) => new Date(ini + m * 60_000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mr-4 block w-[calc(100%-1rem)]" style={{ height: H }}>
      {/* linhas de hora */}
      {Array.from({ length: Math.floor(r.minutos / 60) + 1 }, (_, i) => (
        <line key={i} x1={x(i * 60)} x2={x(i * 60)} y1={0} y2={H} stroke="var(--border)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
      ))}
      {viagens?.map((v, i) => (
        <rect key={i} x={x(v.de)} y={4} width={Math.max(1.5, x(v.ate) - x(v.de))} height={12} rx={2} fill="#2f9e44" opacity={v.produtiva ? 0.85 : 0.4}>
          <title>{`Viagem ${hora(v.de)} – ${hora(v.ate)}${v.motorista ? ` · ${v.motorista}` : ""}`}</title>
        </rect>
      ))}
      {eventos.map((e) =>
        e.min.map((m, i) => (
          <rect key={`${e.cod}-${i}`} x={x(m) - 0.9} y={compacta ? 19 : 2} width={1.8} height={compacta ? 13 : 14} fill={COR[e.gravidade]}>
            <title>{`${hora(m)} · ${e.nome}`}</title>
          </rect>
        )),
      )}
    </svg>
  );
}
