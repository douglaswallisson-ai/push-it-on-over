import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, Truck, User } from "lucide-react";
import { api } from "@/lib/api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { cn } from "@/lib/utils";

/**
 * Linha do tempo de eventos (ss-fleet-core, endpoints/timeline.py).
 *
 * Um veículo (ou motorista) por vez, como no desenho de referência: à
 * esquerda a lista de quem mais precisa de atenção; à direita a linha do
 * tempo de quem foi escolhido — barra das viagens e uma faixa por tipo de
 * evento, no minuto em que aconteceu. Mostrar a frota inteira de uma vez
 * virava ruído (feedback do PM, 02/10/2026).
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
const duracao = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;

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
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const j = janela(periodo, data);

  const qs = new URLSearchParams({ horas: String(j.horas), agrupar });
  if (g) qs.set("group_id", g);
  if (j.inicio) qs.set("inicio", j.inicio);
  const q = useQuery({
    queryKey: ["timeline", qs.toString()],
    queryFn: () => api.get<Resposta>(`/api/v1/eventos/timeline?${qs}`),
    staleTime: 60_000,
    refetchInterval: periodo === "24h" ? 120_000 : false,
  });
  const r = q.data;
  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (r?.linhas ?? []).filter((l) => !b || `${l.titulo} ${l.sub ?? ""}`.toLowerCase().includes(b));
  }, [r, busca]);
  const atual = (r?.linhas ?? []).find((l) => l.id === selecionado) ?? lista[0] ?? null;

  return (
    <div className="space-y-4">
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
        <div className="flex gap-1 rounded-lg bg-secondary p-0.5" role="group" aria-label="Ver por">
          {(
            [
              ["veiculo", "Por veículo", Truck],
              ["motorista", "Por motorista", User],
            ] as const
          ).map(([id, rot, Ic]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setAgrupar(id);
                setSelecionado(null);
              }}
              aria-pressed={agrupar === id}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium", agrupar === id ? "bg-white shadow-sm" : "text-muted-foreground")}
            >
              <Ic className="h-3.5 w-3.5" /> {rot}
            </button>
          ))}
        </div>
        {q.isFetching && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {q.isLoading ? (
        <p className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-8 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando as viagens e eventos…
        </p>
      ) : q.isError ? (
        <p className="rounded-2xl border border-coral-line bg-coral-tint px-5 py-4 text-[13px]">Não foi possível carregar. Tente outro período.</p>
      ) : !r?.linhas.length ? (
        <p className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-[13px] text-muted-foreground">Nenhuma viagem ou evento neste período.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          {/* Lista */}
          <div className="flex max-h-[640px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
            <label className="relative border-b border-border p-2">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={agrupar === "veiculo" ? "Buscar placa ou prefixo" : "Buscar motorista"}
                aria-label="Buscar"
                className="h-9 w-full rounded-lg border border-border bg-secondary/40 pl-8 pr-3 text-[13px]"
              />
            </label>
            <p className="px-3 pt-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              {nf(lista.length)} {agrupar === "veiculo" ? "veículos" : "motoristas"} · mais críticos primeiro
            </p>
            <ul className="flex-1 overflow-y-auto p-2">
              {lista.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelecionado(l.id)}
                    className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left", atual?.id === l.id ? "bg-navy-tint" : "hover:bg-secondary/60")}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium" title={l.titulo}>{capital(l.titulo)}</span>
                      <span className="block text-[12px] text-muted-foreground">{duracao(l.minutos_em_viagem)} rodando</span>
                    </span>
                    <span className="text-right">
                      <span className={cn("block font-mono text-[13px] font-semibold", l.criticos ? "text-coral" : "text-foreground")}>{nf(l.criticos)}</span>
                      <span className="block text-[12px] text-muted-foreground">críticos</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Linha do tempo do escolhido */}
          {atual && <Detalhe r={r} l={atual} agrupar={agrupar} />}
        </div>
      )}
    </div>
  );
}

function Detalhe({ r, l, agrupar }: { r: Resposta; l: Linha; agrupar: "veiculo" | "motorista" }) {
  const [todos, setTodos] = useState(false);
  const eventos = todos ? l.eventos : l.eventos.slice(0, 6);
  const marcas = useMemo(() => {
    const ini = new Date(r.inicio);
    const out: { pct: number; rotulo: string }[] = [];
    for (let m = 0; m <= r.minutos; m += 120) {
      const d = new Date(ini.getTime() + m * 60_000);
      out.push({ pct: (100 * m) / r.minutos, rotulo: `${String(d.getHours()).padStart(2, "0")}h` });
    }
    return out;
  }, [r]);
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-semibold">{capital(l.titulo)}</p>
          {l.sub && <p className="truncate text-[13px] text-muted-foreground">{agrupar === "veiculo" ? "Motoristas: " : "Veículos: "}{capital(l.sub)}</p>}
        </div>
        <div className="flex gap-4 text-right">
          {[
            ["Rodando", duracao(l.minutos_em_viagem)],
            ["Eventos", nf(l.total_eventos)],
            ["Críticos", nf(l.criticos)],
            ["Por hora", l.eventos_por_hora != null ? nf(l.eventos_por_hora, 1) : "—"],
          ].map(([a, b]) => (
            <div key={a}>
              <p className="text-[12px] text-muted-foreground">{a}</p>
              <p className={cn("font-mono text-[16px] font-semibold", a === "Críticos" && l.criticos > 0 && "text-coral")}>{b}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[190px_1fr] items-end">
            <span />
            <div className="relative mr-4 h-5">
              {marcas.map((m, i) => (
                <span key={i} className="absolute -translate-x-1/2 font-mono text-[12px] text-muted-foreground" style={{ left: `${m.pct}%` }}>
                  {m.rotulo}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-[190px_1fr] items-center border-b border-border py-2">
            <span className="text-[12px] font-semibold">Viagens</span>
            <Faixa r={r} viagens={l.viagens} eventos={[]} compacta />
          </div>
          {eventos.map((e) => (
            <div key={e.cod} className="grid grid-cols-[190px_1fr] items-center border-b border-border/60 py-1.5 last:border-b-0">
              <span className="flex items-center gap-2 truncate pr-2 text-[12px]" title={e.nome}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COR[e.gravidade] }} />
                <span className="truncate">{capital(e.nome)}</span>
                <span className="font-mono text-muted-foreground">{nf(e.min.length)}</span>
              </span>
              <Faixa r={r} eventos={[e]} />
            </div>
          ))}
          {!l.eventos.length && <p className="py-4 text-[13px] text-muted-foreground">Nenhum evento no período.</p>}
        </div>
      </div>
      {l.eventos.length > 6 && (
        <button type="button" onClick={() => setTodos(!todos)} className="mt-3 text-[13px] font-medium text-brand-navy hover:underline">
          {todos ? "Mostrar só os 6 mais frequentes" : `Mostrar todos os ${l.eventos.length} tipos de evento`}
        </button>
      )}
      <p className="mt-3 text-[12px] text-muted-foreground">
        Barras verdes: viagens. Marcas: eventos no minuto em que aconteceram (vermelho crítico, amarelo atenção, azul leve). Passe o mouse para ver a hora.
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
