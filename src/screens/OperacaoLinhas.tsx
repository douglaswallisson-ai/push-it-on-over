import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowLeftRight, Bus, CalendarDays, CheckCircle2, Clock, Gauge, Play, RefreshCw, Route, TimerReset, Users, XCircle,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { monitorQuery, produtivasQuery, type LinhaProdutiva, type SituacaoMonitor, type ViagemMonitor, type ViagemProdutiva } from "@/lib/operacao-api";
import { cn } from "@/lib/utils";

/**
 * Operação de linhas com dados reais (Fretamento e Transporte urbano).
 *
 * Duas abas porque os clientes registram a operação de jeitos diferentes:
 * - "Programado × realizado": horários do dia contra as viagens executadas
 *   (quem abre e fecha viagem no sistema — fretamento, ex.: VTR).
 * - "Viagens produtivas": viagens da telemetria com linha e sentido (urbano,
 *   ex.: Consórcio Fênix), por linha.
 * A aba inicial é a que tem dado para a empresa escolhida.
 */

const nf = (v: number | null | undefined, c = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const SIT: Record<SituacaoMonitor, { rotulo: string; tom: PillTone; icone: LucideIcon; cor: string }> = {
  ok: { rotulo: "No horário", tom: "green", icone: CheckCircle2, cor: "text-leaf" },
  atrasada: { rotulo: "Atrasada", tom: "gold", icone: AlertTriangle, cor: "text-gold" },
  adiantada: { rotulo: "Adiantada", tom: "gold", icone: AlertTriangle, cor: "text-gold" },
  nao_realizada: { rotulo: "Não realizada", tom: "coral", icone: XCircle, cor: "text-coral" },
  aguardando: { rotulo: "Aguardando", tom: "neutral", icone: Clock, cor: "text-muted-foreground" },
  em_andamento: { rotulo: "Em andamento", tom: "sky", icone: Play, cor: "text-brand-sky" },
  reforco: { rotulo: "Sem horário (reforço)", tom: "sky", icone: Route, cor: "text-brand-sky" },
};

const desvio = (prog: string | null, real: string | null) => {
  if (!prog || !real) return null;
  const m = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  return m(real) - m(prog);
};

type Aba = "monitor" | "produtivas";

export default function OperacaoLinhas({ titulo = "Viagens", subtitulo = "Operação › Programado × realizado", abaPadrao }: { titulo?: string; subtitulo?: string; abaPadrao?: Aba }) {
  const [dia, setDia] = useState(isoLocal(new Date()));
  const [linhaId, setLinhaId] = useState("");
  const [tol, setTol] = useState({ antes: 5, depois: 7 });
  const [aba, setAba] = useState<Aba | null>(abaPadrao ?? null);
  const [situacao, setSituacao] = useState<SituacaoMonitor | "todas">("todas");
  const [linhaProd, setLinhaProd] = useState<string>("");
  const [todas, setTodas] = useState(false);

  const monQ = useQuery(monitorQuery(dia, linhaId || undefined, tol));
  const prodQ = useQuery(produtivasQuery(dia, linhaProd || undefined, todas));

  // Aba inicial pela fonte que tem dado.
  useEffect(() => {
    if (aba || !monQ.data || !prodQ.data) return;
    // Programação que nunca é executada (ex.: 1 horário por linha cadastrado
    // só para existir) não é operação: com viagens produtivas, abre nelas.
    const executadas = monQ.data.viagens.some((v) => v.partidaRealizada);
    setAba(executadas || !prodQ.data.total ? "monitor" : "produtivas");
  }, [aba, monQ.data, prodQ.data]);
  const abaAtual: Aba = aba ?? "monitor";

  return (
    <>
      <PageHeader
        title={titulo}
        subtitle={subtitulo}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 text-[13px]">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="date" value={dia} max={isoLocal(new Date())} onChange={(e) => e.target.value && setDia(e.target.value)} className="bg-transparent outline-none" />
            </label>
            <button
              onClick={() => (abaAtual === "monitor" ? monQ.refetch() : prodQ.refetch())}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-secondary"
            >
              <RefreshCw className={cn("h-[15px] w-[15px]", (monQ.isFetching || prodQ.isFetching) && "animate-spin")} />
              Atualizar
            </button>
          </div>
        }
      />
      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1 shadow-card">
          {([
            ["monitor", "Programado × realizado", ArrowLeftRight, monQ.data?.viagens.filter((v) => v.programadaId).length],
            ["produtivas", "Viagens produtivas", Bus, prodQ.data?.produtivas ?? prodQ.data?.total],
          ] as const).map(([id, rotulo, Icone, n]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all",
                abaAtual === id ? "bg-brand-navy text-white shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icone className="h-4 w-4" />
              {rotulo}
              <span className="font-mono text-[12px] opacity-70">{n == null ? "…" : nf(n)}</span>
            </button>
          ))}
        </div>

        {abaAtual === "monitor" ? (
          <AbaMonitor q={monQ} linhaId={linhaId} setLinhaId={setLinhaId} tol={tol} setTol={setTol} situacao={situacao} setSituacao={setSituacao} />
        ) : (
          <AbaProdutivas q={prodQ} linha={linhaProd} setLinha={setLinhaProd} todas={todas} setTodas={setTodas} />
        )}
      </div>
    </>
  );
}

function AbaMonitor({
  q, linhaId, setLinhaId, tol, setTol, situacao, setSituacao,
}: {
  q: { data?: import("@/lib/operacao-api").MonitorDia; error: unknown; isPending: boolean };
  linhaId: string;
  setLinhaId: (v: string) => void;
  tol: { antes: number; depois: number };
  setTol: (v: { antes: number; depois: number }) => void;
  situacao: SituacaoMonitor | "todas";
  setSituacao: (v: SituacaoMonitor | "todas") => void;
}) {
  const viagens = q.data?.viagens ?? [];
  const conta = (s: SituacaoMonitor) => viagens.filter((v) => v.situacao === s).length;
  const programadas = viagens.filter((v) => v.programadaId).length;
  const realizadas = viagens.filter((v) => v.programadaId && v.partidaRealizada).length;
  const ef = programadas ? Math.round((100 * realizadas) / programadas) : null;
  const lista = situacao === "todas" ? viagens : viagens.filter((v) => v.situacao === situacao);
  const pass = viagens.reduce((a, v) => a + (v.passageiros ?? 0), 0);
  const km = viagens.reduce((a, v) => a + (v.kmRodado ?? 0), 0);

  const cols: Column<ViagemMonitor & Record<string, unknown>>[] = [
    { key: "sit", header: "", align: "center", render: (v) => { const s = SIT[v.situacao]; return <s.icone className={cn("h-4 w-4", s.cor)} aria-label={s.rotulo} />; } },
    { key: "linha", header: "Linha", render: (v) => <div><div className="font-semibold">{v.linha ?? v.linhaId}</div>{v.tabela && <div className="font-mono text-[12px] text-muted-foreground">{v.tabela}</div>}</div> },
    { key: "sentido", header: "Sentido", align: "center", render: (v) => <span className={cn("rounded px-1.5 py-0.5 text-[12px] font-semibold", v.sentido === "ida" ? "bg-navy-tint text-brand-navy" : "bg-secondary text-ink-soft")}>{v.sentido === "ida" ? "Ida" : "Volta"}</span> },
    { key: "ini", header: "Início progr / realiz", render: (v) => <span className="whitespace-nowrap font-mono text-[13px]"><span className="text-muted-foreground">{v.partidaProgramada ?? "—"}</span> / <b>{v.partidaRealizada ?? "—"}</b></span> },
    {
      key: "desvio", header: "Desvio", align: "right", render: (v) => {
        const d = desvio(v.partidaProgramada, v.partidaRealizada);
        return d == null ? <span className="text-muted-foreground">—</span> : <span className={cn("font-mono text-[13px] font-semibold", d > tol.depois || d < -tol.antes ? "text-gold" : "text-leaf")}>{d > 0 ? "+" : ""}{d} min</span>;
      },
    },
    { key: "fim", header: "Término progr / realiz", render: (v) => <span className="whitespace-nowrap font-mono text-[13px]"><span className="text-muted-foreground">{v.chegadaProgramada ?? "—"}</span> / <b>{v.chegadaRealizada ?? "—"}</b></span> },
    {
      key: "veic", header: "Veículo progr / realiz", render: (v) => {
        const trocou = v.veiculoProgramadoId && v.veiculoRealizadoId && v.veiculoProgramadoId !== v.veiculoRealizadoId;
        return <span className="whitespace-nowrap text-[13px]" title={v.placaRealizada ? `Placa ${v.placaRealizada}` : undefined}><span className="text-muted-foreground">{v.veiculoProgramado ?? "—"}</span> / <span className={cn("font-semibold", trocou && "text-gold")}>{v.veiculoRealizado ?? "—"}</span></span>;
      },
    },
    { key: "mot", header: "Motorista", render: (v) => <span className="text-[13px]">{v.motoristaRealizado ?? "—"}</span> },
    { key: "pas", header: "Passageiros", align: "right", render: (v) => <span className="font-mono text-[13px]">{v.passageiros == null ? "—" : v.lotacao ? `${v.passageiros}/${v.lotacao}` : v.passageiros}</span> },
    { key: "perc", header: "Paradas", align: "right", render: (v) => <span className="font-mono text-[13px]">{v.percursoPct == null ? "—" : `${v.percursoPct}%`}</span> },
    { key: "km", header: "Km", align: "right", render: (v) => <span className="font-mono text-[13px]">{nf(v.kmRodado, 1)}</span> },
  ];

  if (q.error) return <p className="py-10 text-center text-sm text-coral">Não foi possível carregar: {(q.error as Error).message}</p>;
  if (q.isPending) return <div className="h-40 animate-pulse rounded-2xl bg-secondary" />;
  if (!viagens.length)
    return (
      <Card bodyClassName="p-8 text-center">
        <p className="text-[14px] font-semibold">Sem horários programados para esta empresa neste dia.</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          O confronto usa os horários cadastrados nas linhas e as viagens abertas e fechadas no sistema. Clientes urbanos que operam pela telemetria aparecem em "Viagens produtivas".
        </p>
      </Card>
    );

  const filtros: (SituacaoMonitor | "todas")[] = ["todas", "ok", "atrasada", "adiantada", "nao_realizada", "em_andamento", "aguardando", "reforco"];
  return (
    <>
      {programadas > 0 && realizadas === 0 && !viagens.some((v) => v.situacao === "reforco") && (
        <div className="flex items-start gap-2.5 rounded-xl border border-gold-line bg-gold-tint px-4 py-3 text-[13px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span>
            <b>Nenhuma das {nf(programadas)} viagens programadas foi registrada como executada neste dia.</b> A empresa provavelmente não abre e
            fecha viagens no sistema — então "atrasada" e "não realizada" abaixo refletem a falta de registro, não necessariamente a operação.
            Se ela opera pela telemetria com linha e sentido, veja "Viagens produtivas".
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile icon={Gauge} label="Cumprimento" value={ef == null ? "—" : `${ef}%`} color={ef == null ? "var(--muted-foreground)" : ef >= 95 ? "var(--leaf)" : ef >= 85 ? "var(--gold)" : "var(--coral)"} foot={`${nf(realizadas)} de ${nf(programadas)} programadas`} />
        <StatTile icon={CheckCircle2} label="No horário" value={nf(conta("ok"))} color="var(--leaf)" />
        <StatTile icon={TimerReset} label="Atrasadas / adiantadas" value={`${nf(conta("atrasada"))} / ${nf(conta("adiantada"))}`} color="var(--gold)" foot={`tolerância −${tol.antes} / +${tol.depois} min`} />
        <StatTile icon={XCircle} label="Não realizadas" value={nf(conta("nao_realizada"))} color="var(--coral)" />
        <StatTile icon={Users} label="Passageiros" value={nf(pass)} color="var(--brand-navy)" foot={`${nf(km)} km rodados`} />
      </div>
      <Card
        title="Viagens do dia"
        icon={Route}
        action={
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <select value={linhaId} onChange={(e) => setLinhaId(e.target.value)} className="h-8 max-w-[260px] rounded-lg border border-border bg-white px-2 text-[13px]">
              <option value="">Todas as linhas</option>
              {(q.data?.linhas ?? []).map((l) => <option key={l.id} value={l.id}>{l.codigo}</option>)}
            </select>
            <label className="inline-flex items-center gap-1" title="Partida antes do horário menos esta tolerância conta como adiantada">
              antes
              <input type="number" min={0} max={30} value={tol.antes} onChange={(e) => setTol({ ...tol, antes: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })} className="h-8 w-14 rounded-lg border border-border px-2" />
            </label>
            <label className="inline-flex items-center gap-1" title="Partida depois do horário mais esta tolerância conta como atrasada">
              depois
              <input type="number" min={0} max={30} value={tol.depois} onChange={(e) => setTol({ ...tol, depois: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })} className="h-8 w-14 rounded-lg border border-border px-2" />
            </label>
          </div>
        }
        bodyClassName="p-4"
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {filtros.map((f) => {
            const n = f === "todas" ? viagens.length : conta(f);
            if (f !== "todas" && !n) return null;
            return (
              <button key={f} onClick={() => setSituacao(f)} className={cn("rounded-full px-3 py-1 text-[12px] font-medium", situacao === f ? "bg-brand-navy text-white" : "border border-border bg-white text-muted-foreground hover:bg-secondary")}>
                {f === "todas" ? "Todas" : SIT[f].rotulo} <span className="ml-1 font-mono opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <DataTable columns={cols} rows={lista as (ViagemMonitor & Record<string, unknown>)[]} empty="Nenhuma viagem com esse filtro." />
        <p className="mt-3 text-[12px] text-muted-foreground">
          Regras do Monitor de Viagens: partida mais de {tol.depois} min depois do horário = atrasada; mais de {tol.antes} min antes = adiantada; sem partida {q.data?.tolerancias.sem_inicio} min depois do horário = atrasada; dia passado sem viagem = não realizada. Feriados ainda não são considerados. Veículo em amarelo: trocado em relação ao escalado.
        </p>
      </Card>
    </>
  );
}

function AbaProdutivas({
  q, linha, setLinha, todas, setTodas,
}: {
  q: { data?: import("@/lib/operacao-api").Produtivas; error: unknown; isPending: boolean };
  linha: string;
  setLinha: (v: string) => void;
  todas: boolean;
  setTodas: (v: boolean) => void;
}) {
  const d = q.data;
  const pl = d?.por_linha ?? [];
  const tot = pl.reduce(
    (a, l) => ({ v: a.v + l.viagens, km: a.km + l.km, h: a.h + l.horas }),
    { v: 0, km: 0, h: 0 },
  );
  const colsL: Column<LinhaProdutiva & Record<string, unknown>>[] = [
    { key: "linha", header: "Linha", render: (l) => <div><span className="font-mono font-bold">{l.linha}</span>{l.descricao && <span className="ml-1.5 text-[12px] text-muted-foreground">{l.descricao}</span>}</div> },
    { key: "viagens", header: "Viagens", align: "right", render: (l) => <span className="font-mono font-semibold">{nf(l.viagens)}</span> },
    { key: "iv", header: "Ida / volta", align: "right", render: (l) => <span className="font-mono">{nf(l.ida)} / {nf(l.volta)}</span> },
    { key: "min", header: "Duração média", align: "right", render: (l) => <span className="font-mono">{nf(l.minutos_medio, 1)} min</span> },
    { key: "km", header: "Km", align: "right", render: (l) => <span className="font-mono">{nf(l.km)}</span> },
    { key: "kml", header: "Km/l", align: "right", render: (l) => <span className="font-mono">{nf(l.kml, 2)}</span> },
    { key: "vei", header: "Veículos", align: "right", render: (l) => <span className="font-mono">{nf(l.veiculos)}</span> },
    { key: "mot", header: "Motoristas", align: "right", render: (l) => <span className="font-mono">{nf(l.motoristas)}</span> },
    { key: "ev", header: "Eventos", align: "right", render: (l) => <span className="font-mono">{nf(l.eventos)}</span> },
  ];
  const colsV: Column<ViagemProdutiva & Record<string, unknown>>[] = [
    { key: "ini", header: "Início / fim", render: (v) => <span className="whitespace-nowrap font-mono text-[13px]">{v.inicio.slice(11, 16)} → {v.fim ? v.fim.slice(11, 16) : "—"}</span> },
    { key: "linha", header: "Linha", render: (v) => <span className="font-mono font-semibold">{v.linha ?? "—"}</span> },
    { key: "sent", header: "Sentido / nº", align: "center", render: (v) => <span className="text-[12px]">{v.sentido ? (v.sentido === "ida" ? "Ida" : "Volta") : "—"}{v.numero ? ` · ${v.numero}ª` : ""}</span> },
    { key: "veic", header: "Veículo", render: (v) => <span className="text-[13px]" title={v.placa ?? ""}>{v.veiculo}</span> },
    { key: "mot", header: "Motorista", render: (v) => <span className="text-[13px]">{v.motorista ?? "—"}</span> },
    { key: "min", header: "Min", align: "right", render: (v) => <span className="font-mono text-[13px]">{nf(v.minutos, 0)}</span> },
    { key: "km", header: "Km", align: "right", render: (v) => <span className="font-mono text-[13px]">{nf(v.km, 1)}</span> },
    { key: "kml", header: "Km/l", align: "right", render: (v) => <span className="font-mono text-[13px]">{nf(v.kml, 2)}</span> },
    { key: "od", header: "Origem → destino", render: (v) => <span className="line-clamp-1 max-w-[260px] text-[12px] text-muted-foreground">{v.origem ?? "—"} → {v.destino ?? "—"}</span> },
    { key: "ev", header: "Eventos", align: "right", render: (v) => <span className={cn("font-mono text-[13px]", v.eventos > 0 && "font-semibold text-gold")}>{v.eventos}</span> },
    ...(todas ? [{ key: "prod", header: "Produtiva", align: "center" as const, render: (v: ViagemProdutiva) => <Pill tone={v.produtiva ? "green" : "neutral"}>{v.produtiva ? "sim" : "não"}</Pill> }] : []),
  ];

  if (q.error) return <p className="py-10 text-center text-sm text-coral">Não foi possível carregar: {(q.error as Error).message}</p>;
  if (q.isPending) return <div className="h-40 animate-pulse rounded-2xl bg-secondary" />;
  return (
    <>
      {d && d.total === 0 && !todas ? (
        <Card bodyClassName="p-8 text-center">
          <p className="text-[14px] font-semibold">Nenhuma viagem produtiva registrada para esta empresa neste dia.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Viagem produtiva é a que o equipamento marca com linha e sentido. Sem essa marcação, é possível ver as viagens da telemetria mesmo assim.
          </p>
          <button onClick={() => setTodas(true)} className="mt-3 rounded-full bg-brand-navy px-4 py-2 text-[13px] font-semibold text-white">Ver todas as viagens do dia</button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile icon={Bus} label={todas ? "Viagens" : "Viagens produtivas"} value={nf(todas ? d?.total : tot.v)} color="var(--brand-navy)" foot={`${nf(pl.length)} linhas`} />
            <StatTile icon={Route} label="Km" value={nf(tot.km)} unit="km" color="var(--brand-sky)" />
            <StatTile icon={Clock} label="Horas em viagem" value={nf(tot.h)} unit="h" color="var(--leaf)" />
            <StatTile icon={Users} label="Veículos" value={nf(d?.veiculos)} color="var(--gold)" foot={`${nf(d?.motoristas)} motoristas`} />
          </div>
          {pl.length > 0 && (
            <Card title="Por linha" icon={Bus} action={<label className="inline-flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> incluir não produtivas</label>} bodyClassName="p-4">
              <DataTable columns={colsL} rows={pl as (LinhaProdutiva & Record<string, unknown>)[]} onRowClick={(l) => setLinha(linha === String(l.linha) ? "" : String(l.linha))} />
              <p className="mt-2 text-[12px] text-muted-foreground">Clique numa linha para ver as viagens dela abaixo.</p>
            </Card>
          )}
          <Card
            title={linha ? `Viagens da linha ${linha}` : "Viagens"}
            icon={Route}
            action={
              <div className="flex items-center gap-2">
                {linha && <button onClick={() => setLinha("")} className="text-[12px] text-brand-navy underline-offset-2 hover:underline">todas as linhas</button>}
                <Pill tone="sky">{nf(d?.viagens.length)}{d?.truncado ? "+" : ""}</Pill>
              </div>
            }
            bodyClassName="p-4"
          >
            <DataTable columns={colsV} rows={(d?.viagens ?? []).slice(0, 500) as (ViagemProdutiva & Record<string, unknown>)[]} empty="Nenhuma viagem." />
            {(d?.viagens.length ?? 0) > 500 && <p className="mt-2 text-[12px] text-muted-foreground">Mostrando as 500 mais recentes. Escolha uma linha para ver todas as dela.</p>}
          </Card>
        </>
      )}
    </>
  );
}
