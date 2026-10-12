import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bus,
  ExternalLink,
  Loader2,
  MapPin,
  Maximize,
  Minimize,
  RefreshCw,
  Ruler,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { SSOrb } from "@/components/ss/brand/SSOrb";
import { Pill } from "@/components/ss/ui/data";
import { api } from "@/lib/api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { lerSessao } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * Painel sinótico do urbano com dados reais (ss-fleet-core, endpoints/sinotico.py). Um só no sistema:
 * a mesma tela abre no menu (Urbano › Painel sinótico), em tela separada (`/sinotico`, sem menu, para TV)
 * e pelo botão do Painel CCO (PM, 12/10/2026).
 *
 * - Escolha de uma, várias ou todas as linhas; as linhas ficam empilhadas com rolagem e cada uma só
 *   consulta o servidor quando está na tela.
 * - Atualiza a cada 15 s (o servidor guarda os ônibus da empresa por 10 s, compartilhado entre as linhas).
 * - Cada ônibus: adiantado, no horário ou atrasado. Sem tabela horária ligada ao urbano, vale o
 *   intervalo: colando no da frente = adiantado; buraco à frente = atrasado (critério TCQSM).
 * - Nome dos pontos inclinado e inteiro (antes era cortado em 118 px).
 */

type Situacao = "adiantado" | "no_horario" | "atrasado" | null;
type Onibus = {
  unit_id: number;
  prefixo: string;
  placa: string;
  viagem: number | null;
  velocidade: number | null;
  ultimo: string | null;
  motorista: string | null;
  m: number | null;
  pct: number | null;
  fora_rota: boolean;
  distancia_rota_m: number | null;
  frente_m?: number | null;
  frente_min?: number | null;
  espacamento?: "colado" | "buraco" | "regular" | null;
  situacao?: Situacao;
};
type Sentido = {
  sentido: number;
  nome: string;
  regua: {
    comprimento_m: number;
    duracao_min: number;
    pontos: { nome: string; m: number }[];
    base: { viagem: number; dia: string; inicio: string; fim: string };
  } | null;
  onibus: Onibus[];
  intervalo_medio_min: number | null;
  maior_buraco_min: number | null;
  colados: number;
  cvh?: number | null;
  nivel_servico?: string | null;
};
type Resposta = { linha: string; sentidos: Sentido[] };
type Linha = { linha: string; agora: number; carros_3h: number };

const SIT: Record<Exclude<Situacao, null>, { rotulo: string; cor: string }> = {
  adiantado: { rotulo: "Adiantado", cor: "#2e86c1" },
  no_horario: { rotulo: "No horário", cor: "var(--leaf)" },
  atrasado: { rotulo: "Atrasado", cor: "var(--coral)" },
};
const COR_SEM = "var(--muted-foreground)";
const ATUALIZA_MS = 15_000;
const nf = (v: number | null | undefined, c = 0) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const hora = (s: string | null) =>
  s ? new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

export function useLinhasUrbanas() {
  const g = grupoAtivo();
  return useQuery({
    queryKey: ["sinotico", "linhas", g ?? ""],
    queryFn: () => api.get<Linha[]>(`/api/v1/sinotico/linhas?group_id=${g}`),
    enabled: Boolean(g),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

const chaveSel = (g?: string) => `ss:sinotico:linhas:${g ?? ""}`;

export default function SinoticoUrbano({
  linhas,
  telao = false,
}: {
  linhas: Linha[];
  telao?: boolean;
}) {
  const g = grupoAtivo();
  const ordenadas = useMemo(
    () =>
      [...linhas].sort(
        (a, b) => b.agora - a.agora || a.linha.localeCompare(b.linha, "pt-BR", { numeric: true }),
      ),
    [linhas],
  );
  const [sel, setSel] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(chaveSel(g)) ?? "null");
      if (Array.isArray(v) && v.length) return v.map(String);
    } catch {
      /* sem armazenamento */
    }
    return [];
  });
  // Sem escolha salva: as 6 linhas com mais ônibus agora.
  const escolhidas = sel.length
    ? sel.filter((l) => linhas.some((x) => x.linha === l))
    : ordenadas.slice(0, 6).map((l) => l.linha);
  useEffect(() => {
    try {
      localStorage.setItem(chaveSel(g), JSON.stringify(sel));
    } catch {
      /* sem armazenamento */
    }
  }, [sel, g]);
  const alternar = (l: string) => {
    const base = sel.length ? sel : escolhidas;
    setSel(base.includes(l) ? base.filter((x) => x !== l) : [...base, l]);
  };
  const [busca, setBusca] = useState("");
  const [sinal, setSinal] = useState(0);
  const [cheia, setCheia] = useState(false);
  useEffect(() => {
    const f = () => setCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);
  const [relogio, setRelogio] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setRelogio(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const filtradas = ordenadas.filter((l) => !busca.trim() || l.linha.includes(busca.trim()));
  const emOperacao = ordenadas.filter((l) => l.agora > 0).map((l) => l.linha);
  const ordemSel = ordenadas.map((l) => l.linha).filter((l) => escolhidas.includes(l));

  const seletor = (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card px-4 py-3",
        telao && "rounded-none border-x-0 border-t-0",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Linhas · {ordemSel.length} de {linhas.length} na tela
        </span>
        <label className="relative ml-2 flex items-center">
          <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            id="sinotico-busca"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar linha"
            className="h-7 w-[140px] rounded-md border border-border bg-white pl-7 pr-2 text-[12px]"
          />
        </label>
        <button
          type="button"
          onClick={() => setSel(emOperacao)}
          className="h-7 rounded-md border border-border bg-white px-2.5 text-[12px] hover:bg-secondary"
        >
          Todas em operação ({emOperacao.length})
        </button>
        <button
          type="button"
          onClick={() => setSel(ordenadas.map((l) => l.linha))}
          className="h-7 rounded-md border border-border bg-white px-2.5 text-[12px] hover:bg-secondary"
        >
          Todas ({linhas.length})
        </button>
        <button
          type="button"
          onClick={() => setSel(ordenadas.slice(0, 6).map((l) => l.linha))}
          className="h-7 rounded-md border border-border bg-white px-2.5 text-[12px] hover:bg-secondary"
        >
          As 6 com mais ônibus
        </button>
      </div>
      <div className="flex max-h-[84px] flex-wrap gap-1.5 overflow-y-auto">
        {filtradas.map((l) => {
          const on = escolhidas.includes(l.linha);
          return (
            <button
              key={l.linha}
              type="button"
              onClick={() => alternar(l.linha)}
              aria-pressed={on}
              title={`${l.agora} ônibus agora · ${l.carros_3h} nas últimas 3 h`}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 font-mono text-[13px] font-semibold transition",
                on
                  ? "border-brand-navy bg-brand-navy text-white"
                  : "border-border bg-white hover:border-brand-sky",
                l.agora === 0 && !on && "opacity-50",
              )}
            >
              {l.linha}
              <span
                className={cn(
                  "rounded px-1 text-[11px]",
                  on ? "bg-white/20" : "bg-secondary text-muted-foreground",
                )}
              >
                {l.agora}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const legenda = (
    <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
      {Object.values(SIT).map((s) => (
        <span key={s.rotulo} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: s.cor }} /> {s.rotulo}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full" style={{ background: COR_SEM }} /> primeiro da fila
      </span>
      <span>
        Sem tabela horária ligada: adiantado = colando no ônibus da frente (menos da metade do
        intervalo); atrasado = buraco à frente (mais de 1,5× o intervalo). Critério TCQSM. Atualiza
        a cada 15 s.
      </span>
    </div>
  );

  const linhasNaTela = (
    <div className="space-y-3">
      {ordemSel.length === 0 && (
        <p className="rounded-2xl border border-border bg-card px-5 py-8 text-[13px] text-muted-foreground">
          Escolha uma ou mais linhas acima.
        </p>
      )}
      {ordemSel.map((l) => (
        <CartaoLinha key={l} linha={l} sinal={sinal} onTirar={() => alternar(l)} />
      ))}
    </div>
  );

  if (telao) {
    const empresa = lerSessao()?.organizacaoAtiva;
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <header className="flex h-11 shrink-0 items-center gap-3 overflow-x-auto whitespace-nowrap border-b border-border bg-card px-3 text-[12px]">
          <SSOrb size={20} />
          <span className="text-[14px] font-semibold">Painel sinótico</span>
          {empresa && <span className="text-muted-foreground">{empresa}</span>}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSinal((n) => n + 1)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 hover:bg-secondary"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </button>
            <button
              type="button"
              onClick={() =>
                document.fullscreenElement
                  ? void document.exitFullscreen()
                  : void document.documentElement.requestFullscreen().catch(() => {})
              }
              aria-label="Tela cheia"
              title={cheia ? "Sair da tela cheia" : "Tela cheia"}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-secondary"
            >
              {cheia ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
            </button>
            <span className="ml-1 font-mono text-muted-foreground">
              {new Date(relogio).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </header>
        {seletor}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {linhasNaTela}
          {legenda}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Painel sinótico"
        subtitle="Operação › Cada linha esticada, com cada ônibus onde ele está"
        actions={
          <div className="flex gap-2">
            <a
              href="/sinotico"
              target="_blank"
              rel="opener"
              title="Abre o sinótico sozinho, sem o menu, para deixar numa TV"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-secondary"
            >
              <ExternalLink className="h-[15px] w-[15px]" /> Abrir em tela separada
            </a>
            <button
              type="button"
              onClick={() => setSinal((n) => n + 1)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-secondary"
            >
              <RefreshCw className="h-[15px] w-[15px]" /> Atualizar
            </button>
          </div>
        }
      />
      <div className="mx-auto max-w-[1700px] space-y-4 px-4 py-5 sm:px-8">
        {seletor}
        {linhasNaTela}
        {legenda}
      </div>
    </>
  );
}

/** Só consulta o servidor quando o cartão está na tela (rolagem com muitas linhas). */
function useNaTela<T extends Element>() {
  const ref = useRef<T>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisivel(true);
      return;
    }
    const o = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), {
      rootMargin: "300px 0px",
    });
    o.observe(el);
    return () => o.disconnect();
  }, []);
  return { ref, visivel };
}

function CartaoLinha({
  linha,
  sinal,
  onTirar,
}: {
  linha: string;
  sinal: number;
  onTirar: () => void;
}) {
  const g = grupoAtivo();
  const { ref, visivel } = useNaTela<HTMLElement>();
  const q = useQuery({
    queryKey: ["sinotico", g ?? "", linha],
    queryFn: () => api.get<Resposta>(`/api/v1/sinotico?group_id=${g}&linha=${linha}`),
    enabled: Boolean(g && linha && visivel),
    staleTime: 10_000,
    refetchInterval: visivel ? ATUALIZA_MS : false,
  });
  useEffect(() => {
    if (sinal && visivel) void q.refetch();
  }, [sinal]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = q.data;
  const todos = (r?.sentidos ?? []).flatMap((s) => s.onibus);
  const conta = (s: Situacao) => todos.filter((o) => o.situacao === s).length;
  return (
    <section ref={ref} className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <span className="rounded-lg bg-brand-navy px-2.5 py-0.5 font-mono text-[16px] font-bold text-white">
          {linha}
        </span>
        <span className="text-[13px] font-semibold">{todos.length} ônibus</span>
        {todos.length > 0 && (
          <>
            <Pill tone="green">{conta("no_horario")} no horário</Pill>
            <Pill tone="sky">{conta("adiantado")} adiantados</Pill>
            <Pill tone="coral">{conta("atrasado")} atrasados</Pill>
          </>
        )}
        {q.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <button
          type="button"
          onClick={onTirar}
          aria-label={`Tirar a linha ${linha} da tela`}
          title="Tirar da tela"
          className="ml-auto rounded p-1 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1 px-4 py-2">
        {!visivel && !r ? (
          <div className="h-[260px]" />
        ) : q.isLoading ? (
          <p className="flex h-[120px] items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Montando a linha {linha}… na primeira vez
            leva alguns segundos.
          </p>
        ) : q.isError ? (
          <p className="py-4 text-[13px] text-coral">
            Não foi possível carregar a linha agora. Tente atualizar.
          </p>
        ) : (
          (r?.sentidos ?? []).map((s) => <Regua key={s.sentido} s={s} />)
        )}
      </div>
    </section>
  );
}

/** Altura da área dos nomes (inclinados) acima da linha. */
const TOPO = 175;

function Regua({ s }: { s: Sentido }) {
  const rg = s.regua;
  const naRota = s.onibus.filter((o) => !o.fora_rota && o.pct != null);
  const fora = s.onibus.filter((o) => o.fora_rota);
  return (
    <div className="py-1">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <b className="text-[13px]">{s.nome}</b>
        {rg && (
          <span className="text-muted-foreground">
            {nf(rg.comprimento_m / 1000, 1)} km · ~{rg.duracao_min} min
          </span>
        )}
        <span className="text-muted-foreground">· {naRota.length} na rota</span>
        {s.intervalo_medio_min != null && (
          <span className="text-muted-foreground">
            · intervalo ~{nf(s.intervalo_medio_min)} min
          </span>
        )}
        {s.nivel_servico && (
          <Pill
            tone={
              "ABC".includes(s.nivel_servico) ? "green" : s.nivel_servico === "D" ? "gold" : "coral"
            }
          >
            regularidade {s.nivel_servico}
          </Pill>
        )}
      </div>
      {!rg ? (
        <p className="py-2 text-[12px] text-muted-foreground">
          Ainda não há uma viagem completa deste sentido hoje ou ontem para desenhar a linha.
          {s.onibus.length ? ` ${s.onibus.length} ônibus estão nele agora.` : ""}
        </p>
      ) : (
        <>
          <div className="relative overflow-x-auto">
            {/* Margem à direita: o nome inclinado do último ponto precisa de espaço. */}
            <div className="relative ml-4 mr-[210px] min-w-[1000px]" style={{ height: TOPO + 62 }}>
              {/* Pontos: nome inteiro, inclinado; perto demais do anterior fica só a marca (nome no mouse). */}
              {(() => {
                let ultimo = -100;
                return rg.pontos.map((p) => {
                  const pct = (100 * p.m) / rg.comprimento_m;
                  const mostra = pct - ultimo >= 2.6;
                  if (mostra) ultimo = pct;
                  return (
                    <div
                      key={`${p.nome}-${p.m}`}
                      className="group absolute top-0"
                      style={{ left: `${pct}%` }}
                      title={p.nome}
                    >
                      {mostra && (
                        <span
                          className="absolute whitespace-nowrap text-[11.5px] leading-none text-foreground/75 group-hover:font-semibold group-hover:text-brand-navy"
                          style={{
                            bottom: -TOPO + 6,
                            left: 0,
                            transform: "rotate(-40deg)",
                            transformOrigin: "left bottom",
                            maxWidth: 260,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {p.nome}
                        </span>
                      )}
                      <span
                        className="absolute -translate-x-1/2 border-l border-dashed border-border group-hover:border-brand-navy"
                        style={{ top: mostra ? TOPO - 4 : TOPO - 2, height: 10 }}
                      />
                    </div>
                  );
                });
              })()}
              {/* Linha */}
              <div
                className="absolute left-0 right-0 h-2 rounded-full bg-brand-navy/15"
                style={{ top: TOPO + 6 }}
              />
              {/* Ônibus */}
              {naRota.map((o) => {
                const cor = o.situacao ? SIT[o.situacao].cor : COR_SEM;
                return (
                  <div
                    key={o.unit_id}
                    className="group absolute"
                    style={{ left: `${o.pct}%`, top: TOPO - 7 }}
                  >
                    <div
                      className="flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border-[2.5px] border-white text-white shadow-md"
                      style={{ background: cor }}
                    >
                      <Bus className="h-4 w-4" strokeWidth={2.2} />
                    </div>
                    <span className="absolute left-0 top-9 -translate-x-1/2 whitespace-nowrap rounded bg-white px-1 font-mono text-[11.5px] font-bold shadow-sm">
                      {o.prefixo}
                    </span>
                    <div className="pointer-events-none absolute bottom-10 left-0 z-10 hidden w-60 -translate-x-1/2 rounded-xl border border-border bg-white p-3 text-[12px] shadow-elegant group-hover:block">
                      <p className="font-semibold">
                        {o.prefixo}{" "}
                        <span className="font-normal text-muted-foreground">· {o.placa}</span>
                      </p>
                      <p style={{ color: cor }} className="font-semibold">
                        {o.situacao ? SIT[o.situacao].rotulo : "Primeiro da fila"}
                      </p>
                      <p>
                        Viagem {o.viagem ?? "—"} · {nf(o.velocidade)} km/h ·{" "}
                        {nf((o.m ?? 0) / 1000, 1)} km do início
                      </p>
                      {o.frente_min != null && (
                        <p>
                          Ônibus da frente: {nf(o.frente_min)} min (
                          {nf((o.frente_m ?? 0) / 1000, 1)} km)
                        </p>
                      )}
                      {o.motorista && <p className="text-muted-foreground">{o.motorista}</p>}
                      <p className="text-muted-foreground">posição às {hora(o.ultimo)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
            {fora.length > 0 && (
              <span className="flex flex-wrap items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Fora do trajeto:
                {fora.map((o) => (
                  <Pill key={o.unit_id} tone="neutral">
                    {o.prefixo}
                    {o.distancia_rota_m != null ? ` · ${nf(o.distancia_rota_m / 1000, 1)} km` : ""}
                  </Pill>
                ))}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Ruler className="h-3.5 w-3.5" /> trajeto da viagem {rg.base.viagem} de{" "}
              {rg.base.dia.split("-").reverse().join("/")}, {rg.base.inicio}–{rg.base.fim}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
