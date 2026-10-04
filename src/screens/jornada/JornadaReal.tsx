import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, Clock, Download, FileText, Loader2, Moon, Scale, Search, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { api } from "@/lib/api";
import { mensagemErro } from "@/lib/suporte-api";
import {
  JornadaApi,
  escalaQuery,
  espelhoQuery,
  jornadaDiaQuery,
  motoristasJornadaQuery,
  type ComparacaoEscala,
  type Infracao,
  type Jornada,
  type LinhaDia,
} from "@/lib/jornada-api";
import { cn } from "@/lib/utils";

/**
 * Jornada do motorista com dados reais: Lei do Motorista (infrações do dia),
 * escala planejada × realizada e espelho de ponto com justificativas.
 */

type Aba = "jornada" | "escala" | "ponto" | "identificacao";
const isoDia = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const ontem = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return isoDia(d);
};
const hm = (s?: string | null) => (s ? s.slice(11, 16) : "—");
const dm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const horas = (h: number | null | undefined) => {
  if (h == null) return "—";
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
};
const minutos = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
const capital = (s: string) => s.toLowerCase().replace(/(^|[\s/])\S/g, (x) => x.toUpperCase());
const DIA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const ROTULO_INF: Record<Infracao["regra"], string> = {
  direcao_continua: "Direção contínua",
  descanso: "Descanso de 30 min",
  jornada: "Jornada acima do limite",
  refeicao: "Sem intervalo de refeição",
  interjornada: "Interjornada curta",
};
const ESCALA: Record<NonNullable<ComparacaoEscala>["situacao"], { rotulo: string; tom: PillTone }> = {
  no_horario: { rotulo: "No horário", tom: "green" },
  atrasou: { rotulo: "Atrasou", tom: "gold" },
  fora_do_horario: { rotulo: "Fora do horário", tom: "gold" },
  falta: { rotulo: "Falta", tom: "coral" },
  nao_escalado: { rotulo: "Não escalado", tom: "neutral" },
};

export default function JornadaReal({ abaInicial = "jornada" }: { abaInicial?: Aba }) {
  const g = grupoAtivo();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [dia, setDia] = useState(ontem());
  const [detalhe, setDetalhe] = useState<LinhaDia | null>(null);
  const [espelhoDe, setEspelhoDe] = useState<number | null>(null);

  if (!g) {
    return (
      <>
        <PageHeader title="Jornada e ponto" subtitle="Lei do Motorista, escala e espelho de ponto" />
        <p className="px-8 py-6 text-[13px] text-muted-foreground">Escolha uma empresa no topo do menu.</p>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Jornada e ponto" subtitle="Lei do Motorista · escala planejada × realizada · espelho de ponto" />
      <main className="space-y-5 px-4 py-6 sm:px-8">
        <nav className="flex gap-1 rounded-2xl border border-border bg-card p-1" aria-label="Seções">
          {(
            [
              ["jornada", "Jornada do dia", Scale],
              ["escala", "Escala", CalendarDays],
              ["ponto", "Espelho de ponto", FileText],
              ["identificacao", "Identificação", UserX],
            ] as const
          ).map(([id, rot, Ic]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              aria-current={aba === id ? "page" : undefined}
              className={cn("flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium", aba === id ? "bg-brand-navy text-white" : "text-muted-foreground hover:bg-secondary")}
            >
              <Ic className="h-4 w-4" /> {rot}
            </button>
          ))}
        </nav>
        {aba === "jornada" && <JornadaDoDia g={g} dia={dia} setDia={setDia} onLinha={setDetalhe} />}
        {aba === "escala" && <EscalaAba g={g} dia={dia} setDia={setDia} onLinha={setDetalhe} />}
        {aba === "ponto" && <EspelhoAba g={g} motorista={espelhoDe} setMotorista={setEspelhoDe} />}
        {aba === "identificacao" && <IdentificacaoAba g={g} />}
      </main>
      <DetalheJornada
        g={g}
        dia={dia}
        l={detalhe}
        onClose={() => setDetalhe(null)}
        onEspelho={(id) => {
          setDetalhe(null);
          setEspelhoDe(id);
          setAba("ponto");
        }}
      />
    </>
  );
}

// ------------------------------------------------------------ Jornada do dia

function JornadaDoDia({ g, dia, setDia, onLinha }: { g: string; dia: string; setDia: (d: string) => void; onLinha: (l: LinhaDia) => void }) {
  const q = useQuery(jornadaDiaQuery(g, dia));
  const [filtro, setFiltro] = useState<Infracao["regra"] | "todas" | "conferir">("todas");
  const [busca, setBusca] = useState("");
  const r = q.data;
  const linhas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (r?.linhas ?? [])
      .filter((l) => l.jornada)
      .filter((l) => !b || l.nome.toLowerCase().includes(b))
      .filter((l) =>
        filtro === "todas" ? true : filtro === "conferir" ? l.jornada!.a_conferir : l.jornada!.infracoes.some((i) => i.regra === filtro) && !l.jornada!.a_conferir,
      );
  }, [r, filtro, busca]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <input type="date" value={dia} max={isoDia(new Date())} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="h-9 rounded-lg border border-border bg-white px-3 text-[13px]" />
        {r && (
          <span className="text-[13px] text-muted-foreground">
            Regras de transporte de <b>{r.operacao}</b>: jornada {r.regra.jornada_h} h + até {r.regra.extra_max_h} h extras · direção contínua até{" "}
            {minutos(r.regra.direcao_continua_min)} · 30 min de descanso a cada {minutos(r.regra.descanso_a_cada_min ?? r.regra.direcao_continua_min)} · refeição {r.regra.refeicao_min} min · interjornada {r.regra.interjornada_h} h seguidas (CLT 235-C, CTB 67-C, STF ADI 5322)
          </span>
        )}
        {q.isFetching && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {q.isLoading ? (
        <p className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-8 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Apurando as jornadas do dia…
        </p>
      ) : !r ? (
        <p className="rounded-2xl border border-coral-line bg-coral-tint px-5 py-4 text-[13px]">{mensagemErro(q.error)}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatTile icon={Users} label="Motoristas com jornada" value={String(r.totais.motoristas)} color="var(--brand-navy)" foot={`em ${dm(r.dia)}`} />
            <StatTile icon={AlertTriangle} label="Com infração" value={String(r.totais.com_infracao)} color="var(--coral)" foot="Lei 13.103/2015" />
            <StatTile icon={Clock} label="Horas extras" value={horas(r.totais.extra_h)} color="var(--gold)" foot="acima de 8 h por jornada" />
            <StatTile icon={Search} label="A conferir" value={String(r.totais.a_conferir)} color="var(--muted-foreground)" foot="jornada acima de 16 h" />
            <StatTile icon={UserX} label="Trechos sem motorista" value={r.totais.trechos_sem_identificacao.toLocaleString("pt-BR")} color="var(--muted-foreground)" foot="não entram na apuração" />
          </div>

          {r.totais.trechos_sem_identificacao > 0 && (
            <p className="rounded-xl border border-gold-line bg-gold-tint px-4 py-2.5 text-[13px]">
              {r.totais.trechos_sem_identificacao.toLocaleString("pt-BR")} trechos de viagem rodaram sem motorista identificado (ou com o cadastro "Não Informado").
              A jornada desses motoristas não pode ser apurada — vale reforçar a identificação no veículo.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <Chip ativo={filtro === "todas"} onClick={() => setFiltro("todas")}>Todos ({r.totais.motoristas})</Chip>
            {(Object.keys(ROTULO_INF) as Infracao["regra"][]).map((k) => (
              <Chip key={k} ativo={filtro === k} onClick={() => setFiltro(k)} tom="coral">
                {ROTULO_INF[k]} ({r.totais.infracoes[k] ?? 0})
              </Chip>
            ))}
            <Chip ativo={filtro === "conferir"} onClick={() => setFiltro("conferir")}>A conferir ({r.totais.a_conferir})</Chip>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar motorista" aria-label="Buscar motorista" className="ml-auto h-8 w-48 rounded-lg border border-border bg-white px-3 text-[13px]" />
          </div>

          <Card title="Jornadas" icon={Scale} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-[13px]">
                <thead className="bg-secondary/60 text-[12px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Motorista</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Início – fim</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Jornada</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Direção</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Maior direção contínua</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Maior pausa</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Interjornada</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {linhas.slice(0, 500).map((l) => {
                    const j = l.jornada!;
                    const passou = j.maior_direcao_continua_min > r.regra.direcao_continua_min;
                    return (
                      <tr key={l.driver_id} className="cursor-pointer hover:bg-secondary/40" onClick={() => onLinha(l)}>
                        <td className="px-4 py-2.5">
                          <span className="block font-medium">{capital(l.nome)}</span>
                          <span className="block text-[12px] text-muted-foreground">
                            {j.fonte === "diario" ? "diário de bordo" : "telemetria"} · {j.veiculos.slice(0, 2).join(", ")}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[13px]">
                          {hm(j.inicio)} – {hm(j.fim)}
                          {j.fim.slice(0, 10) !== j.inicio.slice(0, 10) && <span className="ml-1 text-[12px] text-muted-foreground">+1</span>}
                        </td>
                        <td className={cn("px-3 py-2.5 text-right font-mono", j.extra_h > 0 && "font-semibold")}>{horas(j.jornada_h)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{horas(j.direcao_h)}</td>
                        <td className={cn("px-3 py-2.5 text-right font-mono", passou && "text-coral")}>{minutos(j.maior_direcao_continua_min)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{j.maior_pausa_min} min</td>
                        <td className={cn("px-3 py-2.5 text-right font-mono", j.interjornada_h != null && j.interjornada_h < r.regra.interjornada_h && "text-coral")}>{horas(j.interjornada_h)}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex flex-wrap gap-1">
                            {j.a_conferir ? (
                              <Pill tone="neutral">a conferir</Pill>
                            ) : j.infracoes.length ? (
                              j.infracoes.map((i) => <Pill key={i.regra} tone="coral">{ROTULO_INF[i.regra]}</Pill>)
                            ) : (
                              <Pill tone="green">dentro da lei</Pill>
                            )}
                            {l.justificativa && <Pill tone="sky">justificado</Pill>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!linhas.length && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Nenhuma jornada com esse filtro.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-[12px] text-muted-foreground">
            Jornada pela telemetria: do primeiro ao último trecho de viagem com o motorista identificado; pausa = parada de {r.pausa_min} min ou mais;
            jornadas são separadas por 6 h ou mais sem rodar. É uma estimativa — o motorista trabalha antes de ligar e depois de desligar o veículo.
          </p>
        </>
      )}
    </div>
  );
}

function Chip({ ativo, onClick, children, tom }: { ativo: boolean; onClick: () => void; children: React.ReactNode; tom?: "coral" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "rounded-full border px-3 py-1 text-[12px] transition",
        ativo ? (tom === "coral" ? "border-coral bg-coral text-white" : "border-brand-navy bg-brand-navy text-white") : "border-border bg-white hover:border-brand-sky",
      )}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------ Detalhe

function DetalheJornada({ g, dia, l, onClose, onEspelho }: { g: string; dia: string; l: LinhaDia | null; onClose: () => void; onEspelho: (id: number) => void }) {
  const qc = useQueryClient();
  const q = useQuery(jornadaDiaQuery(g, dia));
  const motivos = q.data?.motivos ?? [];
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState("");
  const [folga, setFolga] = useState(false);
  const salvar = useMutation({
    mutationFn: () => JornadaApi.justificar({ group_id: Number(g), driver_id: l!.driver_id, dia, motivo, texto, folga }),
    onSuccess: () => {
      toast.success("Justificativa registrada.");
      qc.invalidateQueries({ queryKey: ["jornada"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });
  const j = l?.jornada;
  return (
    <Sheet open={l != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[620px]">
        {l && (
          <>
            <SheetHeader>
              <SheetTitle>{capital(l.nome)}</SheetTitle>
              <p className="text-[13px] text-muted-foreground">
                {dm(dia)} · {j ? `${hm(j.inicio)} às ${hm(j.fim)} · ${j.fonte === "diario" ? "diário de bordo" : "telemetria"}` : "sem jornada"}
              </p>
            </SheetHeader>
            <div className="mt-5 space-y-5">
              {j && (
                <>
                  <LinhaDoDia j={j} />
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      ["Jornada", horas(j.jornada_h)],
                      ["Direção", horas(j.direcao_h)],
                      ["Extras", horas(j.extra_h)],
                      ["Noturno", horas(j.noturno_h)],
                      ["Maior direção contínua", minutos(j.maior_direcao_continua_min)],
                      ["Interjornada", horas(j.interjornada_h)],
                    ].map(([a, b]) => (
                      <div key={a} className="rounded-xl border border-border px-3 py-2">
                        <p className="text-[12px] text-muted-foreground">{a}</p>
                        <p className="font-mono text-[16px] font-semibold">{b}</p>
                      </div>
                    ))}
                  </div>
                  {j.a_conferir && (
                    <p className="rounded-lg bg-secondary/60 px-3 py-2 text-[13px]">
                      Jornada acima de 16 h: provavelmente o motorista não fez logout e outro dirigiu com a identificação dele. Confira antes de tratar como infração.
                    </p>
                  )}
                  {j.infracoes.map((i) => (
                    <p key={i.regra} className="rounded-lg bg-coral-tint px-3 py-2 text-[13px]">
                      <b>{i.titulo}:</b> {i.detalhe}
                    </p>
                  ))}
                  {j.entrada_diario && (
                    <p className="text-[13px] text-muted-foreground">
                      Diário de bordo: entrou {hm(j.entrada_diario)}, saiu {hm(j.saida_diario)}.
                    </p>
                  )}
                  <div>
                    <p className="mb-1 text-[13px] font-semibold">Pausas de {q.data?.pausa_min ?? 10} min ou mais</p>
                    <p className="text-[13px] text-muted-foreground">
                      {j.pausas.length ? j.pausas.map((p) => `${p.de}–${p.ate} (${p.min} min)`).join(" · ") : "Nenhuma pausa registrada."}
                    </p>
                  </div>
                </>
              )}
              {l.escala && (
                <p className="text-[13px]">
                  Escala: <Pill tone={ESCALA[l.escala.situacao].tom}>{ESCALA[l.escala.situacao].rotulo}</Pill>
                  {l.escala.planejado && ` planejado ${l.escala.planejado}`}
                  {l.escala.atraso_min != null && ` · início ${l.escala.atraso_min > 0 ? `${l.escala.atraso_min} min depois` : `${-l.escala.atraso_min} min antes`}`}
                </p>
              )}
              <form
                className="space-y-3 rounded-xl border border-border p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (motivo) salvar.mutate();
                }}
              >
                <p className="text-[13px] font-semibold">Justificar o dia</p>
                {l.justificativa && (
                  <p className="text-[13px] text-muted-foreground">
                    Atual: {l.justificativa.motivo}
                    {l.justificativa.texto ? ` — ${l.justificativa.texto}` : ""}
                    {l.justificativa.folga ? " (folga)" : ""}
                  </p>
                )}
                <select value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo" className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]">
                  <option value="">Escolha o motivo</option>
                  {motivos.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} placeholder="Detalhes (opcional)" className="w-full rounded-lg border border-border px-3 py-2 text-[13px]" />
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" checked={folga} onChange={(e) => setFolga(e.target.checked)} /> Era folga (não conta como falta)
                </label>
                <button type="submit" disabled={!motivo || salvar.isPending} className="rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40">
                  Salvar justificativa
                </button>
              </form>
              <button type="button" onClick={() => onEspelho(l.driver_id)} className="text-[13px] font-medium text-brand-navy hover:underline">
                Ver espelho de ponto do mês →
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Barra de 24 h: trabalho (azul) e pausas (branco). */
function LinhaDoDia({ j }: { j: Jornada }) {
  const ini = new Date(j.inicio);
  const base = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()).getTime();
  const total = 36 * 60; // até o meio-dia seguinte, para jornadas que viram a noite
  const pos = (t: number) => `${Math.max(0, Math.min(100, ((t - base) / 60000 / total) * 100))}%`;
  const fim = new Date(j.fim).getTime();
  const pausaEm = (hhmm: string, ref: number) => {
    const [h, m] = hhmm.split(":").map(Number);
    let t = base + (h * 60 + m) * 60000;
    if (t < ref - 3600000) t += 24 * 3600000;
    return t;
  };
  return (
    <div>
      <div className="relative h-6 rounded-md bg-secondary">
        <div className="absolute inset-y-0 rounded-md bg-brand-navy/70" style={{ left: pos(ini.getTime()), width: `calc(${pos(fim)} - ${pos(ini.getTime())})` }} />
        {j.pausas.map((p, i) => {
          const a = pausaEm(p.de, ini.getTime());
          const b = a + p.min * 60000;
          return <div key={i} className="absolute inset-y-1 rounded bg-white/90" style={{ left: pos(a), width: `calc(${pos(b)} - ${pos(a)})` }} title={`Pausa ${p.de}–${p.ate}`} />;
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[12px] text-muted-foreground">
        {[0, 6, 12, 18, 24, 30, 36].map((h) => (
          <span key={h}>{String(h % 24).padStart(2, "0")}h</span>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Escala

function EscalaAba({ g, dia, setDia, onLinha }: { g: string; dia: string; setDia: (d: string) => void; onLinha: (l: LinhaDia) => void }) {
  const qc = useQueryClient();
  const q = useQuery(jornadaDiaQuery(g, dia));
  const mot = useQuery(motoristasJornadaQuery(g));
  const [driver, setDriver] = useState("");
  const [de, setDe] = useState(isoDia(new Date()));
  const [ate, setAte] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 6);
    return isoDia(d);
  });
  const [semana, setSemana] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [hIni, setHIni] = useState("06:00");
  const [hFim, setHFim] = useState("14:00");
  const [linha, setLinha] = useState("");
  const dias = useMemo(() => {
    const out: string[] = [];
    const a = new Date(`${de}T12:00`);
    const b = new Date(`${ate}T12:00`);
    for (let d = a; d <= b && out.length < 62; d = new Date(d.getTime() + 86400000)) if (semana.has(d.getDay())) out.push(isoDia(d));
    return out;
  }, [de, ate, semana]);
  const salvar = useMutation({
    mutationFn: () => JornadaApi.salvarEscala({ group_id: Number(g), driver_id: Number(driver), dias, inicio: hIni, fim: hFim, linha: linha || null }),
    onSuccess: (r) => {
      toast.success(`Escala salva em ${r.dias} dias.`);
      qc.invalidateQueries({ queryKey: ["jornada"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });
  const escalados = (q.data?.linhas ?? []).filter((l) => l.escala);
  const resumo = (k: NonNullable<ComparacaoEscala>["situacao"]) => escalados.filter((l) => l.escala?.situacao === k).length;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Card
        title="Planejado × realizado"
        icon={CalendarDays}
        action={<input type="date" value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="h-8 rounded-lg border border-border bg-white px-2 text-[13px]" />}
        bodyClassName="p-4"
      >
        {q.isLoading ? (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
        ) : !q.data?.totais.escalados ? (
          <p className="text-[13px] text-muted-foreground">
            Ninguém escalado para {dm(dia)}. Monte a escala ao lado: a comparação com quem realmente dirigiu aparece aqui.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(Object.keys(ESCALA) as NonNullable<ComparacaoEscala>["situacao"][]).map((k) => (
                <Pill key={k} tone={ESCALA[k].tom}>{ESCALA[k].rotulo}: {resumo(k)}</Pill>
              ))}
            </div>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {escalados.map((l) => (
                <li key={l.driver_id}>
                  <button type="button" onClick={() => onLinha(l)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/40">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium">{capital(l.nome)}</span>
                      <span className="block font-mono text-[12px] text-muted-foreground">
                        planejado {l.escala!.planejado ?? "—"} · realizado {l.jornada ? `${hm(l.jornada.inicio)}–${hm(l.jornada.fim)}` : "não dirigiu"}
                      </span>
                    </span>
                    <Pill tone={ESCALA[l.escala!.situacao].tom}>{ESCALA[l.escala!.situacao].rotulo}</Pill>
                    {l.justificativa && <Pill tone="sky">justificado</Pill>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Card title="Montar escala" icon={Users} bodyClassName="p-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (driver && dias.length) salvar.mutate();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium">Motorista</span>
            <select value={driver} onChange={(e) => setDriver(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]">
              <option value="">Escolha</option>
              {(mot.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>{capital(m.nome)}{m.matricula ? ` · ${m.matricula}` : ""}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium">De</span>
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="h-9 w-full rounded-lg border border-border px-3 text-[13px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium">Até</span>
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="h-9 w-full rounded-lg border border-border px-3 text-[13px]" />
            </label>
          </div>
          <div>
            <span className="mb-1 block text-[13px] font-medium">Dias da semana</span>
            <div className="flex gap-1">
              {DIA_SEMANA.map((n, i) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setSemana((s) => {
                      const x = new Set(s);
                      x.has(i) ? x.delete(i) : x.add(i);
                      return x;
                    })
                  }
                  aria-pressed={semana.has(i)}
                  className={cn("flex-1 rounded-lg border py-1.5 text-[12px]", semana.has(i) ? "border-brand-navy bg-navy-tint font-medium" : "border-border")}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium">Entrada</span>
              <input type="time" value={hIni} onChange={(e) => setHIni(e.target.value)} className="h-9 w-full rounded-lg border border-border px-2 text-[13px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium">Saída</span>
              <input type="time" value={hFim} onChange={(e) => setHFim(e.target.value)} className="h-9 w-full rounded-lg border border-border px-2 text-[13px]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium">Linha (opcional)</span>
              <input value={linha} onChange={(e) => setLinha(e.target.value)} className="h-9 w-full rounded-lg border border-border px-2 text-[13px]" />
            </label>
          </div>
          <button type="submit" disabled={!driver || !dias.length || salvar.isPending} className="w-full rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40">
            {salvar.isPending ? "Salvando…" : `Escalar em ${dias.length} dia${dias.length === 1 ? "" : "s"}`}
          </button>
          <p className="text-[12px] text-muted-foreground">Saída antes da entrada = turno que vira a noite. Escalar de novo no mesmo dia substitui o horário.</p>
        </form>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------ Espelho de ponto

function EspelhoAba({ g, motorista, setMotorista }: { g: string; motorista: number | null; setMotorista: (id: number | null) => void }) {
  const mot = useQuery(motoristasJornadaQuery(g));
  const [inicio, setInicio] = useState(() => {
    const d = new Date();
    return isoDia(new Date(d.getFullYear(), d.getMonth(), 1));
  });
  const [fim, setFim] = useState(ontem());
  const q = useQuery(espelhoQuery(g, motorista, inicio, fim));
  const e = q.data;

  const baixarCsv = () => {
    if (!e) return;
    const cab = ["Dia", "Entrada", "Saída", "Jornada", "Direção", "Extras", "Noturno", "Intervalo maior (min)", "Interjornada", "Escala", "Infrações", "Justificativa"];
    const linhas = e.dias.map((d) => {
      const j = d.jornada;
      return [
        dm(d.dia),
        j ? hm(j.inicio) : "",
        j ? hm(j.fim) : "",
        j ? horas(j.jornada_h) : "",
        j ? horas(j.direcao_h) : "",
        j ? horas(j.extra_h) : "",
        j ? horas(j.noturno_h) : "",
        j ? String(j.maior_pausa_min) : "",
        j ? horas(j.interjornada_h) : "",
        d.escala ? ESCALA[d.escala.situacao].rotulo : "",
        j ? j.infracoes.map((i) => ROTULO_INF[i.regra]).join(" / ") : "",
        d.justificativa ? `${d.justificativa.motivo}${d.justificativa.folga ? " (folga)" : ""}` : "",
      ];
    });
    const csv = [cab, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `espelho-ponto_${(e.nome ?? "motorista").replace(/\W+/g, "-")}_${inicio}_${fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
        <select value={motorista ?? ""} onChange={(ev) => setMotorista(ev.target.value ? Number(ev.target.value) : null)} aria-label="Motorista" className="h-9 min-w-[260px] rounded-lg border border-border bg-white px-3 text-[13px]">
          <option value="">Escolha o motorista</option>
          {(mot.data ?? []).map((m) => (
            <option key={m.id} value={m.id}>{capital(m.nome)}{m.matricula ? ` · ${m.matricula}` : ""}</option>
          ))}
        </select>
        <input type="date" value={inicio} onChange={(ev) => setInicio(ev.target.value)} aria-label="De" className="h-9 rounded-lg border border-border bg-white px-3 text-[13px]" />
        <input type="date" value={fim} onChange={(ev) => setFim(ev.target.value)} aria-label="Até" className="h-9 rounded-lg border border-border bg-white px-3 text-[13px]" />
        <button type="button" onClick={baixarCsv} disabled={!e} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-[13px] font-medium hover:bg-secondary disabled:opacity-40">
          <Download className="h-4 w-4" /> Baixar para a folha (CSV)
        </button>
      </div>
      {!motorista ? (
        <p className="rounded-2xl border border-border bg-card px-5 py-8 text-center text-[13px] text-muted-foreground">Escolha um motorista para ver o espelho de ponto (até 31 dias).</p>
      ) : q.isLoading ? (
        <p className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-8 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Apurando dia a dia… (o primeiro mês leva alguns segundos)
        </p>
      ) : !e ? (
        <p className="rounded-2xl border border-coral-line bg-coral-tint px-5 py-4 text-[13px]">{mensagemErro(q.error)}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <StatTile icon={CalendarDays} label="Dias trabalhados" value={String(e.totais.dias_trabalhados)} color="var(--brand-navy)" />
            <StatTile icon={Clock} label="Jornada total" value={horas(e.totais.jornada_h)} color="var(--brand-navy)" />
            <StatTile icon={Clock} label="Direção" value={horas(e.totais.direcao_h)} color="var(--leaf)" />
            <StatTile icon={Clock} label="Extras" value={horas(e.totais.extra_h)} color="var(--gold)" />
            <StatTile icon={Moon} label="Noturno" value={horas(e.totais.noturno_h)} color="var(--brand-navy)" />
            <StatTile icon={AlertTriangle} label="Infrações" value={String(e.totais.infracoes)} color="var(--coral)" foot={`${e.totais.faltas} faltas`} />
          </div>
          <Card title={`Espelho de ponto · ${e.nome ? capital(e.nome) : `motorista ${e.driver_id}`}`} icon={FileText} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-[13px]">
                <thead className="bg-secondary/60 text-[12px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {["Dia", "Entrada", "Saída", "Jornada", "Direção", "Extras", "Noturno", "Escala", "Situação"].map((h, i) => (
                      <th key={h} className={cn("px-3 py-2.5 font-semibold", i >= 3 && i <= 6 ? "text-right" : "text-left")}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {e.dias.map((d) => {
                    const j = d.jornada;
                    const dt = new Date(`${d.dia}T12:00`);
                    return (
                      <tr key={d.dia} className={cn(!j && "text-muted-foreground", (dt.getDay() === 0 || dt.getDay() === 6) && "bg-secondary/30")}>
                        <td className="px-3 py-2">{DIA_SEMANA[dt.getDay()]} {dm(d.dia)}</td>
                        <td className="px-3 py-2 font-mono">{j ? hm(j.inicio) : "—"}</td>
                        <td className="px-3 py-2 font-mono">{j ? hm(j.fim) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{j ? horas(j.jornada_h) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{j ? horas(j.direcao_h) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{j && j.extra_h > 0 ? horas(j.extra_h) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono">{j && j.noturno_h > 0 ? horas(j.noturno_h) : "—"}</td>
                        <td className="px-3 py-2">{d.escala ? <Pill tone={ESCALA[d.escala.situacao].tom}>{ESCALA[d.escala.situacao].rotulo}</Pill> : "—"}</td>
                        <td className="px-3 py-2">
                          <span className="flex flex-wrap gap-1">
                            {j?.a_conferir && <Pill tone="neutral">a conferir</Pill>}
                            {j && !j.a_conferir && j.infracoes.map((i) => <Pill key={i.regra} tone="coral">{ROTULO_INF[i.regra]}</Pill>)}
                            {d.justificativa && <Pill tone="sky">{d.justificativa.motivo}{d.justificativa.folga ? " · folga" : ""}</Pill>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}


/* ------------------------------------------------------------ identificação */

type Identificacao = {
  totais: { km: number; km_sem: number; pct_sem: number; veiculos: number; veiculos_sem_nenhuma: number; identificacoes_presas: number };
  veiculos: { unit_id: number; veiculo: string; km: number; km_sem: number; trechos: number; trechos_sem: number; motoristas: number; pct_sem: number }[];
  presas: { unit_id: number; veiculo: string; driver_id: number; motorista: string; desde: string; ate: string; horas: number; km: number }[];
  regra: string;
};

/**
 * Identificação do motorista: quanto a frota rodou sem motorista identificado e
 * as identificações "presas" (motorista que não fez logout). É o material para
 * levar ao cliente (pedido do PM, 02/10/2026).
 */
function IdentificacaoAba({ g }: { g: string }) {
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  const [periodo, setPeriodo] = useState({ inicio: isoDia(ini), fim: isoDia(fimMes) });
  const q = useQuery({
    queryKey: ["jornada", "identificacao", g, periodo],
    queryFn: () => api.get<Identificacao>(`/api/v1/jornada/identificacao?group_id=${g}&inicio=${periodo.inicio}&fim=${periodo.fim}`),
  });
  const nf = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const hora = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const csv = () => {
    if (!q.data) return;
    const esc = (x: unknown) => `"${String(x ?? "").replace(/"/g, '""')}"`;
    const linhas: unknown[][] = [
      ["Veículo", "Km rodados", "Km sem motorista", "% sem motorista", "Trechos", "Trechos sem motorista", "Motoristas identificados"],
      ...q.data.veiculos.map((v) => [v.veiculo, v.km, v.km_sem, v.pct_sem, v.trechos, v.trechos_sem, v.motoristas]),
      [], ["Identificações presas"], ["Veículo", "Motorista", "Desde", "Até", "Horas", "Km"],
      ...q.data.presas.map((p) => [p.veiculo, p.motorista, p.desde.replace("T", " "), p.ate.replace("T", " "), p.horas, p.km]),
    ];
    const txt = "\ufeff" + linhas.map((l) => l.map(esc).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
    a.download = `identificacao_motorista_${periodo.inicio}_${periodo.fim}.csv`;
    a.click();
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-[13px]">
        <input type="date" value={periodo.inicio} onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })} aria-label="Início" className="h-9 rounded-lg border border-border px-2" />
        <span className="text-muted-foreground">a</span>
        <input type="date" value={periodo.fim} onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })} aria-label="Fim" className="h-9 rounded-lg border border-border px-2" />
        <span className="text-muted-foreground">até 31 dias</span>
        {q.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <button onClick={csv} disabled={!q.data} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 disabled:opacity-40">
          <Download className="h-4 w-4" /> Baixar para o cliente (CSV)
        </button>
      </div>
      {q.error ? (
        <p className="text-[13px] text-coral">{mensagemErro(q.error)}</p>
      ) : !q.data ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculando…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={UserX} label="Km sem motorista identificado" value={`${nf(q.data.totais.pct_sem)}%`} foot={`${nf(q.data.totais.km_sem)} de ${nf(q.data.totais.km)} km`} color="var(--coral)" />
            <StatTile icon={Users} label="Veículos sem nenhuma identificação" value={nf(q.data.totais.veiculos_sem_nenhuma)} foot={`de ${nf(q.data.totais.veiculos)} que rodaram`} />
            <StatTile icon={AlertTriangle} label="Identificações presas" value={nf(q.data.totais.identificacoes_presas)} foot="motorista que não fez logout" color="var(--gold)" />
            <StatTile icon={Clock} label="Maior identificação presa" value={q.data.presas[0] ? `${nf(q.data.presas[0].horas)} h` : "—"} foot={q.data.presas[0]?.veiculo ?? ""} />
          </div>
          <p className="text-[12px] text-muted-foreground">
            Sem identificação, a jornada, o ranking e a premiação do motorista ficam sem base. {q.data.regra} SUPOSIÇÃO: quase sempre é o
            motorista que não fez logout e outros rodaram com o cartão dele; confirmar com o cliente.
          </p>
          <Card title="Identificações presas" icon={AlertTriangle}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Veículo</th><th className="px-3 py-2">Motorista</th><th className="px-3 py-2">Desde</th>
                    <th className="px-3 py-2">Até</th><th className="px-3 py-2 text-right">Horas</th><th className="px-3 py-2 text-right">Km</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {q.data.presas.slice(0, 100).map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{p.veiculo}</td><td className="px-3 py-2">{p.motorista}</td>
                      <td className="px-3 py-2 font-mono">{hora(p.desde)}</td><td className="px-3 py-2 font-mono">{hora(p.ate)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-coral">{nf(p.horas)}</td><td className="px-3 py-2 text-right">{nf(p.km)}</td>
                    </tr>
                  ))}
                  {!q.data.presas.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhuma identificação presa no período.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Por veículo (mais km sem motorista primeiro)" icon={UserX}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Veículo</th><th className="px-3 py-2 text-right">Km</th><th className="px-3 py-2 text-right">Km sem motorista</th>
                    <th className="px-3 py-2 text-right">%</th><th className="px-3 py-2 text-right">Motoristas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {q.data.veiculos.slice(0, 100).map((v) => (
                    <tr key={v.unit_id}>
                      <td className="px-3 py-2">{v.veiculo}</td><td className="px-3 py-2 text-right">{nf(v.km)}</td><td className="px-3 py-2 text-right">{nf(v.km_sem)}</td>
                      <td className={cn("px-3 py-2 text-right font-semibold", v.pct_sem >= 50 ? "text-coral" : v.pct_sem >= 10 ? "text-gold" : "text-leaf")}>{nf(v.pct_sem)}%</td>
                      <td className="px-3 py-2 text-right">{v.motoristas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {q.data.veiculos.length > 100 && <p className="px-3 pt-2 text-[12px] text-muted-foreground">Mostrando os 100 primeiros; o CSV traz todos os {q.data.veiculos.length}.</p>}
          </Card>
        </>
      )}
    </div>
  );
}
