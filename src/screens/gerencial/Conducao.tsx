import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity, AlertTriangle, Award, BarChart3, Gauge, IdCard, MinusCircle, PlusCircle, Route, Scale, Search, Star, Timer, TrendingUp, Trophy, Users } from "lucide-react";
import { Card, DataTable, Pill, type Column, type PillTone } from "@/components/ss/ui/data";
import { StarRating } from "@/components/ss/ui/gauges";
import type { MotoristaRankingApi } from "@/lib/api";
import {
  COR_EVENTO, estrelasDe, eventosBIQuery, ID_META_FAIXA, pontuacaoDetalhada, rankingBIQuery, ROTULO_EVENTO, serieBIQuery,
  TIPOS_EVENTO, type FiltrosBI, type TipoEvento,
} from "@/lib/bi-api";
import { agrupar, lados, nf, pct, pctFaixas13, somar, type DiaGerencial } from "@/lib/gerencial-api";
import { cn } from "@/lib/utils";
import { ANIM, BarrasRank, Carregando, DicaGrafico, Grafico, Info, Kpi, Velocimetro, dataBR } from "./pecas";

export type Ctx = { f: FiltrosBI; ant: FiltrosBI; preco: number };

const tomNota = (n: number): PillTone => (n >= 90 ? "green" : n >= 80 ? "sky" : n >= 60 ? "gold" : "coral");

function Alternar<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
      {opcoes.map(([v, r]) => (
        <button key={v} onClick={() => onChange(v)} className={cn("rounded-md px-3 py-1 text-[12px] font-medium transition-all", valor === v ? "bg-white shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          {r}
        </button>
      ))}
    </div>
  );
}

function Busca({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <label className="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-white px-2.5">
      <Search className="h-3.5 w-3.5 text-muted-foreground" />
      <input value={valor} onChange={(e) => onChange(e.target.value)} placeholder="Buscar" className="w-36 bg-transparent text-[13px] outline-none" />
    </label>
  );
}

const cnhVencida = (d: string | null) => (d ? new Date(d + "T23:59") < new Date() : false);

/* ---------------------------- Ranking de condução --------------------------- */

const VELOCIMETROS: { k: keyof typeof ID_META_FAIXA; rotulo: string; bom: boolean; dica: string }[] = [
  { k: "verde", rotulo: "Faixa verde", bom: true, dica: "Tempo na faixa de RPM econômica ÷ tempo nas 13 faixas. Quanto maior, melhor." },
  { k: "extra_economica", rotulo: "Extra econômica", bom: true, dica: "Rotação mais baixa possível com o veículo em tração. Quanto maior, melhor." },
  { k: "inercia", rotulo: "Inércia", bom: true, dica: "Em movimento sem acelerar, aproveitando o embalo — consumo quase zero." },
  { k: "eco_roll", rotulo: "Eco-roll", bom: true, dica: "Banguela automática da transmissão em veículos que têm a função." },
  { k: "baixa_velocidade", rotulo: "Baixa velocidade", bom: true, dica: "Manobras e trânsito lento dentro da faixa correta." },
  { k: "amarela", rotulo: "Faixa amarela", bom: false, dica: "Rotação acima da econômica: alerta. Quanto menor, melhor." },
  { k: "vermelha", rotulo: "Faixa vermelha", bom: false, dica: "Rotação alta, perto do corte. Desgaste e consumo elevados." },
  { k: "parado_ligado", rotulo: "Parado ligado", bom: false, dica: "Motor ligado com o veículo parado, incluindo o parado produtivo (regra do Power BI)." },
  { k: "parado_acelerando", rotulo: "Parado acelerando", bom: false, dica: "Acelerando com o veículo parado." },
  { k: "batendo_transmissao", rotulo: "Batendo transmissão", bom: false, dica: "Rotação muito baixa para a marcha engatada — força a transmissão." },
  { k: "movimento_sem_tracao", rotulo: "Mov. sem tração", bom: false, dica: "Movimento em ponto morto (banguela manual)." },
  { k: "tolerancia", rotulo: "Tolerância", bom: false, dica: "Tempo fora das faixas cadastradas. Alto indica cadastro de faixas a revisar. Não entra na nota." },
];

export function PaginaRanking({ f }: Ctx) {
  const [por, setPor] = useState<"motorista" | "veiculo">("motorista");
  const [busca, setBusca] = useState("");
  const serieQ = useQuery(serieBIQuery(f));
  const rankQ = useQuery(rankingBIQuery(f, por));
  const s = serieQ.data;
  const tot = useMemo(() => (s ? somar(s.dias) : null), [s]);
  const p = tot ? pctFaixas13(tot) : null;
  const nota = tot && s ? pontuacaoDetalhada(tot, s.pesos, s.inicio, s.fim, s.motoristas_periodo) : null;

  const lista = useMemo(() => {
    let l = rankQ.data?.motoristas ?? [];
    if (por === "motorista" && f.condutor) l = l.filter((m) => String(m.driver_id) === f.condutor);
    const b = busca.trim().toLowerCase();
    if (b) l = l.filter((m) => (m.nome ?? String(m.driver_id)).toLowerCase().includes(b));
    return l;
  }, [rankQ.data, busca, por, f.condutor]);
  const com = lista.filter((m) => m.pontuacao != null);
  const podio = com.slice(0, 3);
  const resumo = rankQ.data?.resumo;

  const valorFaixa = (k: keyof typeof ID_META_FAIXA) =>
    !p ? null : k === "parado_ligado" ? p.parado_ocioso + p.parado_produtivo : p[k as keyof typeof p];

  const cols: Column<MotoristaRankingApi>[] = [
    { key: "posicao", header: "#", align: "center", render: (m) => <span className="font-mono text-muted-foreground">{m.posicao ?? "—"}</span> },
    { key: "nome", header: por === "veiculo" ? "Placa" : "Motorista", render: (m) => <span className="font-semibold">{m.nome ?? m.driver_id}</span> },
    { key: "pontuacao", header: "Pontuação", align: "center", render: (m) => (m.pontuacao == null ? <span title="Sem tempo nas faixas no período">—</span> : <Pill tone={tomNota(m.pontuacao)}>{nf(m.pontuacao, 2)}</Pill>) },
    { key: "estrelas", header: "Estrelas", align: "center", render: (m) => <StarRating value={m.pontuacao == null ? null : m.estrelas} /> },
    { key: "km", header: "Km", align: "right", render: (m) => <span className="font-mono">{nf(m.km)}</span> },
    { key: "horas", header: "Horas", align: "right", render: (m) => <span className="font-mono">{nf(m.horas, 1)}</span> },
    { key: "kml", header: "Km/l", align: "right", render: (m) => <span className="font-mono">{nf(m.kml, 2)}</span> },
    { key: "verde", header: "Verde", align: "right", render: (m) => <span className="font-mono">{nf(m.faixas.verde, 1)}%</span> },
    { key: "inercia", header: "Inércia", align: "right", render: (m) => <span className="font-mono">{nf(m.faixas.inercia, 1)}%</span> },
    { key: "vermelha", header: "Vermelha", align: "right", render: (m) => <span className={cn("font-mono", (m.faixas.vermelha ?? 0) > 1 && "text-coral")}>{nf(m.faixas.vermelha, 1)}%</span> },
    { key: "parado", header: "Parado lig.", align: "right", render: (m) => <span className="font-mono">{nf(m.faixas.parado_ligado, 1)}%</span> },
    ...(por === "motorista"
      ? [{ key: "cnh", header: "CNH", align: "center" as const, render: (m: MotoristaRankingApi) => (m.cnh_validade ? <span className={cn("font-mono text-[12px]", cnhVencida(m.cnh_validade) && "font-semibold text-coral")} title={cnhVencida(m.cnh_validade) ? "CNH vencida" : "Validade da CNH"}>{m.cnh_categoria ?? ""} {dataBR(m.cnh_validade)}</span> : "—") }]
      : []),
  ];

  return (
    <Carregando q={serieQ}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card title="Pontuação da operação" icon={Trophy} action={<Info texto="Fórmula do Power BI aplicada ao conjunto filtrado: Σ (% de cada faixa × peso) + eventos por hora × peso + volume (horas e km × peso 18). Pesos de Metas e Pesos." />} bodyClassName="p-5">
          <div className="flex flex-col items-center">
            <Velocimetro rotulo="Nota" valor={nota?.total ?? null} meta={90} max={Math.max(100, nota?.total ?? 0)} fmt={(n) => nf(n, 1)} dica="Meta 90 = 5 estrelas." />
            <div className="mt-3"><StarRating value={nota?.total == null ? null : estrelasDe(nota.total)} /></div>
            <div className="mt-4 grid w-full grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-secondary/70 p-2"><p className="text-[12px] text-muted-foreground">{por === "veiculo" ? "Placas" : "Motoristas"}</p><p className="font-display text-lg font-bold">{nf(resumo?.motoristas)}</p></div>
              <div className="rounded-xl bg-secondary/70 p-2"><p className="text-[12px] text-muted-foreground">Nota média</p><p className="font-display text-lg font-bold">{nf(resumo?.nota_media, 1)}</p></div>
              <div className="rounded-xl bg-secondary/70 p-2"><p className="text-[12px] text-muted-foreground">Km</p><p className="font-display text-lg font-bold">{nf(tot?.km)}</p></div>
              <div className="rounded-xl bg-secondary/70 p-2" title="Horas sem motorista identificado ÷ horas trabalhadas"><p className="text-[12px] text-muted-foreground">Não identificado</p><p className={cn("font-display text-lg font-bold", tot && tot.horas > 0 && tot.horas_sem_condutor / tot.horas > 0.6 && "text-coral")}>{tot && tot.horas > 0 ? pct(tot.horas_sem_condutor / tot.horas) : "—"}</p></div>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {VELOCIMETROS.map((v) => {
            const val = valorFaixa(v.k) ?? null;
            const meta = s?.metas[String(ID_META_FAIXA[v.k])] ?? null;
            const ref = Math.max(val ?? 0, meta ?? 0);
            return <Velocimetro key={v.k} rotulo={v.rotulo} valor={val} meta={meta} menorMelhor={!v.bom} max={v.bom ? Math.min(1, Math.max(ref * 1.4, 0.05)) : Math.max(ref * 1.6, 0.01)} dica={v.dica} />;
          })}
        </div>
      </div>

      {podio.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {podio.map((m, i) => (
            <div key={m.driver_id} className={cn("relative overflow-hidden rounded-2xl border p-4 shadow-card animate-in fade-in slide-in-from-bottom-3", i === 0 ? "border-gold-line bg-gold-tint" : "border-border bg-card")} style={{ animationDelay: `${i * 90}ms`, animationFillMode: "both" }}>
              <Award className={cn("absolute right-3 top-3 h-8 w-8", i === 0 ? "text-gold" : "text-muted-foreground/40")} />
              <p className="font-mono text-[12px] text-muted-foreground">{i + 1}º lugar</p>
              <p className="mt-1 truncate pr-10 text-[14px] font-semibold">{m.nome ?? m.driver_id}</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="font-display text-2xl font-bold">{nf(m.pontuacao, 2)}</span>
                <StarRating value={m.estrelas} />
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">{nf(m.km)} km · {nf(m.horas, 1)} h · {nf(m.kml, 2)} km/l</p>
            </div>
          ))}
        </div>
      )}

      <Card
        title={por === "veiculo" ? "Ranking por placa" : "Ranking de motoristas"}
        icon={BarChart3}
        action={<div className="flex flex-wrap items-center gap-2"><Busca valor={busca} onChange={setBusca} /><Alternar valor={por} onChange={setPor} opcoes={[["motorista", "Motoristas"], ["veiculo", "Placas"]]} /></div>}
        bodyClassName="p-4"
      >
        <Carregando q={rankQ}>
          <DataTable columns={cols as unknown as Column<Record<string, unknown>>[]} rows={lista as unknown as Record<string, unknown>[]} empty="Ninguém com dados no período." />
          <p className="mt-2 text-[12px] text-muted-foreground">
            Posição densa pela pontuação (empate divide a posição). O motorista não identificado fica fora do ranking. O Power BI também ranqueia por instrutor — esse vínculo ainda não existe no sistema novo.
          </p>
        </Carregando>
      </Card>
    </Carregando>
  );
}

/* -------------------------- Análise de condução QTD ------------------------- */

export function PaginaAnalise({ f }: Ctx) {
  const [por, setPor] = useState<"condutor" | "placa">("condutor");
  const [busca, setBusca] = useState("");
  const evQ = useQuery(eventosBIQuery(f));
  const e = evQ.data;
  type Linha = { nome: string; total: number } & Record<TipoEvento, number>;
  const linhas: Linha[] = useMemo(() => {
    if (!e) return [];
    const base = por === "condutor"
      ? e.por_condutor.map((c) => ({ ...c, nome: c.condutor ?? (c.driver_id ? String(c.driver_id) : "NÃO INFORMADO") }))
      : e.por_placa.map((c) => ({ ...c, nome: c.placa ?? String(c.unit_id) }));
    const b = busca.trim().toLowerCase();
    return b ? base.filter((x) => x.nome.toLowerCase().includes(b)) : base;
  }, [e, por, busca]);
  const top = linhas.slice(0, 15).map((l) => ({ nome: l.nome.slice(0, 28), ...Object.fromEntries(TIPOS_EVENTO.map((t) => [ROTULO_EVENTO[t], l[t]])) }));
  const cols: Column<Linha>[] = [
    { key: "nome", header: por === "condutor" ? "Condutor" : "Placa", render: (l) => <span className="font-semibold">{l.nome}</span> },
    ...TIPOS_EVENTO.map((t) => ({ key: t, header: ROTULO_EVENTO[t].replace("Excesso de velocidade", "Vel."), align: "right" as const, render: (l: Linha) => <span className={cn("font-mono", !l[t] && "text-muted-foreground/50")}>{nf(l[t])}</span> })),
    { key: "total", header: "Total", align: "right", render: (l) => <span className="font-mono font-semibold">{nf(l.total)}</span> },
  ];

  return (
    <Carregando q={evQ} vazio={!!e && e.total === 0}>
      {e && <AvisoCarga ultimo={e.ultimo_evento} fim={f.fim} />}
      <Grafico
        titulo={`Top 15 — eventos por ${por === "condutor" ? "condutor" : "placa"}`}
        icon={Users}
        altura={460}
        dica="Quantidade de cada evento no período (Power BI: Análise de Condução QTD). Fonte: tabela de eventos com localização."
        acao={<Alternar valor={por} onChange={setPor} opcoes={[["condutor", "Condutores"], ["placa", "Placas"]]} />}
      >
        <BarChart data={top} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="nome" width={200} tick={{ fontSize: 11 }} />
          <Tooltip content={<DicaGrafico fmt={(v) => nf(v)} />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {TIPOS_EVENTO.map((t) => <Bar key={t} dataKey={ROTULO_EVENTO[t]} stackId="e" fill={COR_EVENTO[t]} {...ANIM} />)}
        </BarChart>
      </Grafico>
      <Card title="Quantidade por tipo de evento" icon={BarChart3} action={<Busca valor={busca} onChange={setBusca} />} bodyClassName="p-4">
        <DataTable columns={cols as unknown as Column<Record<string, unknown>>[]} rows={linhas as unknown as Record<string, unknown>[]} />
        <p className="mt-2 text-[12px] text-muted-foreground">Os 50 com mais eventos. Velocidade no seco soma os níveis 1 a 3; chuva é o evento com sensor de chuva ativo.</p>
      </Card>
    </Carregando>
  );
}

export function AvisoCarga({ ultimo, fim }: { ultimo: string | null; fim: string }) {
  if (!ultimo) return null;
  const u = new Date(ultimo);
  const f = new Date(fim + "T23:59:59");
  if (u >= new Date(f.getTime() - 3 * 3600_000)) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-gold-line bg-gold-tint px-3.5 py-2.5 text-[13px]">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
      <span>
        Os eventos com localização estão carregados até <b>{u.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</b>. A carga dessa tabela chega com atraso; os totais diários da Central de segurança já incluem os dias seguintes.
      </span>
    </div>
  );
}

/* ---------------------------- Gestão da pontuação --------------------------- */

const mesRotulo = (d: string) => {
  const [a, m] = d.split("-");
  return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m) - 1]}/${a.slice(2)}`;
};

export function PaginaPontuacao({ f }: Ctx) {
  // Resultado por mês pede meses inteiros: busca do 1º dia do mês de início.
  const serieQ = useQuery(serieBIQuery(f));
  const rankQ = useQuery(rankingBIQuery(f, "motorista"));
  const s = serieQ.data;
  const det = useMemo(() => {
    if (!s) return null;
    const tot = somar(s.dias);
    return pontuacaoDetalhada(tot, s.pesos, s.inicio, s.fim, s.motoristas_periodo);
  }, [s]);
  const porMes = useMemo(() => {
    if (!s) return [];
    const g = new Map<string, DiaGerencial[]>();
    for (const d of s.dias) g.set(d.dia.slice(0, 7), [...(g.get(d.dia.slice(0, 7)) ?? []), d]);
    return [...g.entries()].map(([m, ds]) => {
      const x = pontuacaoDetalhada(somar(ds), s.pesos, ds[0].dia, ds[ds.length - 1].dia, s.motoristas_periodo);
      return { rotulo: mesRotulo(m + "-01"), Ganhos: x.ganhos, Perdas: x.perdas, Nota: x.total ?? 0 };
    });
  }, [s]);
  const porDia = useMemo(
    () =>
      (s?.dias ?? []).map((d) => {
        const x = pontuacaoDetalhada(somar([d]), s!.pesos, d.dia, d.dia, s!.motoristas_periodo);
        return { rotulo: d.dia.slice(8, 10) + "/" + d.dia.slice(5, 7), "Pontos perdidos": -x.perdas, Nota: x.total };
      }),
    [s],
  );
  const comps = (det?.componentes ?? []).filter((c) => c.peso !== 0).sort((a, b) => b.pontos - a.pontos);
  const dist = [5, 4, 3, 2, 1, 0].map((e) => ({ nome: e ? `${e} ★` : "0 ★", valor: (rankQ.data?.motoristas ?? []).filter((m) => m.pontuacao != null && m.estrelas === e).length }));

  return (
    <Carregando q={serieQ}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={PlusCircle} label="Pontos sem desconto" valor={det?.ganhos} fmt={(n) => nf(n, 2)} dica="Soma dos componentes que pontuam: faixas boas (verde, extra econômica, inércia, eco-roll, baixa velocidade) × peso." />
        <Kpi icon={MinusCircle} label="Infrações (descontos)" valor={det?.perdas} fmt={(n) => nf(n, 2)} alerta={(det?.perdas ?? 0) < -10} dica="Soma dos componentes com peso negativo: faixas ruins e eventos por hora × peso." />
        <Kpi icon={Scale} label="Saldo (pontuação)" valor={det?.total} fmt={(n) => nf(n, 2)} dica="Pontos sem desconto + infrações, truncado em 2 casas — a mesma conta da nota de cada motorista." />
        <Kpi icon={Star} label="Estrelas" texto={det?.total == null ? "—" : "★".repeat(estrelasDe(det.total)) || "0"} dica="≥ 90 → 5 · ≥ 80 → 4 · ≥ 70 → 3 · ≥ 60 → 2 · ≥ 50 → 1" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="De onde vêm os pontos" icon={Scale} action={<Info texto="Cada barra é % da faixa (ou eventos por hora) × peso cadastrado em Metas e Pesos. Verde soma, vermelho desconta. Passe o mouse para ver o valor e o peso." />} bodyClassName="p-4">
          <ul className="space-y-1.5">
            {comps.map((c, i) => {
              const max = Math.max(...comps.map((x) => Math.abs(x.pontos)), 1);
              const w = (Math.abs(c.pontos) / max) * 50;
              return (
                <li key={c.id} className="grid grid-cols-[150px_minmax(0,1fr)_64px] items-center gap-2 text-[13px]" title={`${c.nome}: ${c.tipo === "faixa" ? pct(c.valor) : nf(c.valor, 2) + "/h"} × peso ${nf(c.peso)} = ${nf(c.pontos, 2)}`}>
                  <span className="truncate">{c.nome}</span>
                  <div className="relative h-3 rounded-full bg-secondary">
                    <div className="absolute top-0 h-3 w-px bg-border" style={{ left: "50%" }} />
                    <div
                      className={cn("absolute top-0 h-3 rounded-full animate-in fade-in", c.pontos >= 0 ? "bg-leaf" : "bg-coral")}
                      style={{ left: c.pontos >= 0 ? "50%" : `${50 - w}%`, width: `${w}%`, animationDelay: `${i * 40}ms`, animationDuration: "600ms" }}
                    />
                  </div>
                  <span className={cn("text-right font-mono font-semibold", c.pontos >= 0 ? "text-leaf" : "text-coral")}>{c.pontos > 0 ? "+" : ""}{nf(c.pontos, 2)}</span>
                </li>
              );
            })}
          </ul>
          {!comps.length && <p className="py-6 text-center text-sm text-muted-foreground">Sem pesos cadastrados em Metas e Pesos para este recorte.</p>}
        </Card>
        <Grafico titulo="Resultado por mês" icon={BarChart3} dica="Ganhos, descontos e a nota de cada mês do período, com os pesos atuais." rodape="Escolha um período de vários meses no filtro para comparar.">
          <ComposedChart data={porMes}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<DicaGrafico fmt={(v) => nf(v, 2)} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Bar dataKey="Ganhos" fill="var(--leaf)" radius={[4, 4, 0, 0]} {...ANIM} />
            <Bar dataKey="Perdas" fill="var(--coral)" radius={[0, 0, 4, 4]} {...ANIM} />
            <Line dataKey="Nota" stroke="var(--brand-navy)" strokeWidth={2.5} dot={{ r: 3 }} {...ANIM} />
          </ComposedChart>
        </Grafico>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Grafico titulo="Pontuação perdida por dia" icon={TrendingUp} dica="Quanto as infrações descontaram em cada dia. Picos mostram dias para investigar.">
          <ComposedChart data={porDia}>
            <defs>
              <linearGradient id="gPerda" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--coral)" stopOpacity={0.55} />
                <stop offset="100%" stopColor="var(--coral)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="p" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="n" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip content={<DicaGrafico fmt={(v) => nf(v, 2)} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area yAxisId="p" dataKey="Pontos perdidos" stroke="var(--coral)" fill="url(#gPerda)" strokeWidth={2} {...ANIM} />
            <Line yAxisId="n" dataKey="Nota" stroke="var(--brand-navy)" strokeWidth={2} dot={false} connectNulls {...ANIM} />
          </ComposedChart>
        </Grafico>
        <Grafico titulo="Motoristas por estrelas" icon={Star} dica="Quantos motoristas caíram em cada faixa de estrelas no período.">
          <BarChart data={dist}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v)} motoristas`} />} />
            <Bar dataKey="valor" name="Motoristas" radius={[6, 6, 0, 0]} {...ANIM}>
              {dist.map((d, i) => <Cell key={d.nome} fill={["#2E9E4F", "#6FBF7A", "#E8C63A", "#F0A868", "#E0483C", "#D2352A"][i]} />)}
            </Bar>
          </BarChart>
        </Grafico>
      </div>
    </Carregando>
  );
}

/* --------------------------- Evolução de indicadores ------------------------ */

const INDICADORES = [
  { id: "nota", nome: "Pontuação", fmt: (v: number) => nf(v, 1), dica: "Nota da operação (fórmula do Power BI) em cada período." },
  { id: "bom", nome: "% Lado bom", fmt: (v: number) => `${nf(v, 1)}%`, dica: "Inércia + extra econômica + verde + baixa velocidade + eco-roll." },
  { id: "ruim", nome: "% Lado ruim", fmt: (v: number) => `${nf(v, 1)}%`, dica: "Amarela + vermelha + parado acelerando + batendo + sem tração + tolerância + parado ligado." },
  { id: "kml", nome: "Km/l", fmt: (v: number) => nf(v, 2), dica: "Km com combustível ÷ litros." },
  { id: "parado", nome: "% Parado ligado", fmt: (v: number) => `${nf(v, 1)}%`, dica: "Parado ligado (com produtivo) ÷ 13 faixas." },
  { id: "eventos", nome: "Eventos/h", fmt: (v: number) => nf(v, 2), dica: "Aceleração + freada + velocidade + embreagem por hora trabalhada." },
  { id: "km", nome: "Km rodado", fmt: (v: number) => nf(v), dica: "Distância percorrida." },
  { id: "ni", nome: "% Não identificado", fmt: (v: number) => `${nf(v, 1)}%`, dica: "Horas sem motorista ÷ horas trabalhadas." },
] as const;

export function PaginaEvolucao({ f }: Ctx) {
  const serieQ = useQuery(serieBIQuery(f));
  const [sel, setSel] = useState<string[]>(["nota", "bom", "kml", "parado"]);
  const s = serieQ.data;
  const dados = useMemo(() => {
    if (!s) return [];
    return agrupar(s.dias).map((g) => {
      const l = lados(g);
      const pf = pctFaixas13(g);
      const n = pontuacaoDetalhada(g, s.pesos, s.inicio, s.fim, s.motoristas_periodo);
      return {
        rotulo: g.rotulo,
        nota: n.total,
        bom: l.bom * 100,
        ruim: l.ruim * 100,
        kml: g.litros > 0 ? g.km_com_combustivel / g.litros : null,
        parado: (pf.parado_ocioso + pf.parado_produtivo) * 100,
        eventos: g.horas > 0 ? (g.aceleracao + g.freada + g.velocidade + g.embreagem) / g.horas : null,
        km: g.km,
        ni: g.horas > 0 ? (100 * g.horas_sem_condutor) / g.horas : null,
      };
    });
  }, [s]);
  const alterna = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const cores = ["var(--brand-navy)", "var(--leaf)", "var(--coral)", "var(--gold)", "#7B3FA0", "var(--brand-sky)", "#2E86C1", "#8A9199"];
  const primeiro = dados[0] as unknown as Record<string, number | null> | undefined;
  const ultimo = dados[dados.length - 1] as unknown as Record<string, number | null> | undefined;

  return (
    <Carregando q={serieQ}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {INDICADORES.map((ind, i) => {
          const a = primeiro?.[ind.id] ?? null;
          const b = ultimo?.[ind.id] ?? null;
          const ativo = sel.includes(ind.id);
          return (
            <button
              key={ind.id}
              onClick={() => alterna(ind.id)}
              className={cn("rounded-2xl border p-3 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5", ativo ? "border-brand-navy bg-navy-tint" : "border-border bg-card opacity-80")}
              title={ind.dica}
            >
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: cores[i] }} />
                {ind.nome}
              </div>
              <p className="mt-1 font-display text-xl font-bold">{b == null ? "—" : ind.fmt(b)}</p>
              <p className="text-[12px] text-muted-foreground">início {a == null ? "—" : ind.fmt(a)}</p>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {INDICADORES.filter((i) => sel.includes(i.id)).map((ind) => {
          const i = INDICADORES.findIndex((x) => x.id === ind.id);
          return (
            <Grafico key={ind.id} titulo={`Evolução — ${ind.nome}`} icon={ind.id === "km" ? Route : ind.id === "nota" ? Trophy : ind.id === "eventos" ? AlertTriangle : ind.id === "ni" ? IdCard : ind.id === "kml" ? Gauge : Activity} altura={220} dica={ind.dica}>
              <LineChart data={dados}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                <Tooltip content={<DicaGrafico fmt={(v) => ind.fmt(v)} />} />
                <Line dataKey={ind.id} name={ind.nome} stroke={cores[i]} strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 5 }} connectNulls {...ANIM} />
              </LineChart>
            </Grafico>
          );
        })}
      </div>
      <p className="text-[12px] text-muted-foreground">
        <Timer className="mr-1 inline h-3.5 w-3.5" />Até 45 dias o gráfico mostra cada dia; até 180, cada mês; acima, cada trimestre. Clique nos cartões para mostrar ou esconder indicadores.
      </p>
    </Carregando>
  );
}
