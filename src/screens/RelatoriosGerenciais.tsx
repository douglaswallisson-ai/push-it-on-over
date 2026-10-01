import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Clock, Fuel, Gauge, Leaf, Route, ShieldAlert,
  Stethoscope, Timer, TrendingUp, Trophy, Truck, Users, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, type Column, type PillTone } from "@/components/ss/ui/data";
import { rankingMotoristasQuery, saudeFrotaQuery } from "@/lib/queries";
import type { MotoristaRankingApi } from "@/lib/api";
import {
  agrupar, brl, co2Kg, CORES_FAIXA, datasDoPeriodo, economiaPotencial, hhmm, indicadoresDoTopo, lados, nf,
  ociosoQuery, pct, pctFaixas13, periodoAnterior, PRECO_DIESEL_PADRAO, ROTULO_FAIXA, ROTULO_PERIODO, serieGerencialQuery,
  somar, type Faixas13, type Periodo,
} from "@/lib/gerencial-api";
import { cn } from "@/lib/utils";

/**
 * Relatórios gerenciais — os indicadores dos BIs em abas.
 *
 * Fontes e regras do vault: Dashboard Start (visão geral, ociosidade, economia
 * potencial), Power BI "Indicadores de Condução 5.0" (13 faixas, lado bom/ruim,
 * pontuação, ranking, eventos por hora, CO₂, não informado) e a cascata de
 * saúde da frota (revisão de telemetria). Nada aqui é estimado sem dizer.
 */

type Aba = "geral" | "faixas" | "ocioso" | "motoristas" | "veiculos" | "eventos" | "combustivel" | "telemetria";

const ABAS: { id: Aba; label: string; icon: LucideIcon }[] = [
  { id: "geral", label: "Visão geral", icon: BarChart3 },
  { id: "faixas", label: "Faixas de condução", icon: Gauge },
  { id: "ocioso", label: "Tempo ocioso", icon: Clock },
  { id: "motoristas", label: "Ranking de motoristas", icon: Trophy },
  { id: "veiculos", label: "Ranking por placa", icon: Truck },
  { id: "eventos", label: "Central de segurança", icon: ShieldAlert },
  { id: "combustivel", label: "Combustível", icon: Fuel },
  { id: "telemetria", label: "Revisão de telemetria", icon: Stethoscope },
];

const ANIM = { animationDuration: 900, animationEasing: "ease-out" as const };

/* ---------------------------- Peças visuais ---------------------------- */

function Variacao({ atual, anterior, menorMelhor }: { atual: number | null; anterior: number | null; menorMelhor?: boolean }) {
  if (atual == null || anterior == null || anterior === 0) return <span className="text-[11px] text-muted-foreground">sem comparação</span>;
  const v = (atual - anterior) / Math.abs(anterior);
  const bom = menorMelhor ? v < 0 : v > 0;
  const Icone = v >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-semibold", bom ? "text-leaf" : "text-coral")}>
      <Icone className="h-3.5 w-3.5" />
      {nf(Math.abs(v) * 100, 1)}% vs. mês anterior
    </span>
  );
}

function Kpi({
  icon: Icone, label, valor, unidade, atual, anterior, menorMelhor, alerta, dica,
}: {
  icon: LucideIcon; label: string; valor: string; unidade?: string; atual?: number | null; anterior?: number | null;
  menorMelhor?: boolean; alerta?: boolean; dica?: string;
}) {
  return (
    <div
      title={dica}
      className={cn(
        "group rounded-2xl border bg-card p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elegant",
        alerta ? "border-coral-line" : "border-border",
      )}
    >
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Icone className={cn("h-4 w-4", alerta ? "text-coral" : "text-brand-navy")} />
        {label}
        {alerta && <AlertTriangle className="ml-auto h-3.5 w-3.5 text-coral" />}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">
        {valor}
        {unidade && <span className="ml-1 text-[12px] font-medium text-muted-foreground">{unidade}</span>}
      </p>
      <div className="mt-1 min-h-[16px]">{atual !== undefined && <Variacao atual={atual ?? null} anterior={anterior ?? null} menorMelhor={menorMelhor} />}</div>
    </div>
  );
}

function Grafico({ titulo, icon, children, altura = 280, rodape }: { titulo: string; icon: LucideIcon; children: ReactNode; altura?: number; rodape?: ReactNode }) {
  return (
    <Card title={titulo} icon={icon} bodyClassName="p-4">
      <div style={{ height: altura }}>
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
      {rodape && <p className="mt-2 text-[11.5px] text-muted-foreground">{rodape}</p>}
    </Card>
  );
}

function DicaGrafico({ active, payload, label, fmt }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; fmt?: (v: number, nome: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-white/95 px-3 py-2 text-[12px] shadow-elegant backdrop-blur">
      {label && <p className="mb-1 font-semibold text-foreground">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-semibold">{fmt ? fmt(p.value, p.name) : nf(p.value, 1)}</span>
        </p>
      ))}
    </div>
  );
}

const Vazio = ({ q, children }: { q: { isPending: boolean; error: unknown }; children: ReactNode }) =>
  q.error ? (
    <p className="py-10 text-center text-sm text-coral">Não foi possível carregar: {(q.error as Error).message}</p>
  ) : q.isPending ? (
    <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
  ) : (
    <>{children}</>
  );

/* --------------------------------- Tela --------------------------------- */

export default function RelatoriosGerenciais() {
  const [aba, setAba] = useState<Aba>("geral");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [preco, setPreco] = useState(PRECO_DIESEL_PADRAO);
  const d = datasDoPeriodo(periodo);
  const ant = periodoAnterior(d.inicio, d.fim);

  const serieQ = useQuery(serieGerencialQuery(d.inicio, d.fim));
  const serieAntQ = useQuery(serieGerencialQuery(ant.inicio, ant.fim));
  const motQ = useQuery(rankingMotoristasQuery(d.inicio, d.fim));
  const veiQ = useQuery(rankingMotoristasQuery(d.inicio, d.fim, "veiculo"));
  const ocioQ = useQuery(ociosoQuery(d.inicio, d.fim));
  const saudeQ = useQuery(saudeFrotaQuery());

  const tot = useMemo(() => (serieQ.data ? somar(serieQ.data.dias) : null), [serieQ.data]);
  const totAnt = useMemo(() => (serieAntQ.data ? somar(serieAntQ.data.dias) : null), [serieAntQ.data]);
  const evol = useMemo(() => (serieQ.data ? agrupar(serieQ.data.dias) : []), [serieQ.data]);

  const fmtData = (s: string) => new Date(s + "T12:00").toLocaleDateString("pt-BR");

  return (
    <>
      <PageHeader title="Relatórios gerenciais" subtitle={`Indicadores do BI · ${fmtData(d.inicio)} a ${fmtData(d.fim)}`} />
      <div className="mx-auto max-w-[1440px] space-y-5 px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className="h-9 rounded-full border border-border bg-white px-3 text-[13px]">
            {(Object.keys(ROTULO_PERIODO) as Periodo[]).map((p) => (
              <option key={p} value={p}>{ROTULO_PERIODO[p]}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground" title="O Dashboard Start busca o preço do diesel numa API externa e usa R$ 6,00 quando ela falha. Aqui o valor é informado.">
            Diesel (R$/L)
            <input type="number" step="0.01" min="0" value={preco} onChange={(e) => setPreco(Number(e.target.value) || 0)} className="h-9 w-24 rounded-full border border-border bg-white px-3 text-[13px]" />
          </label>
          <span className="ml-auto text-[11.5px] text-muted-foreground">Comparação: mesmos dias do mês anterior ({fmtData(ant.inicio)} a {fmtData(ant.fim)})</span>
        </div>

        <div className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1 shadow-card">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-200",
                aba === a.id ? "bg-brand-navy text-white shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <a.icon className="h-4 w-4" />
              {a.label}
            </button>
          ))}
        </div>

        <div key={aba} className="animate-in fade-in slide-in-from-bottom-2 space-y-5 duration-300">
          {aba === "geral" && (
            <Vazio q={serieQ}>{tot && <AbaGeral tot={tot} totAnt={totAnt} evol={evol} fim={d.fim} preco={preco} />}</Vazio>
          )}
          {aba === "faixas" && (
            <Vazio q={serieQ}>{tot && <AbaFaixas tot={tot} evol={evol} motoristas={motQ.data?.motoristas ?? []} veiculos={veiQ.data?.motoristas ?? []} />}</Vazio>
          )}
          {aba === "ocioso" && <AbaOcioso ocioQ={ocioQ} meta={serieQ.data?.meta_parado ?? 0.15} metaCadastrada={serieQ.data?.meta_parado_cadastrada ?? false} motoristas={motQ.data?.motoristas ?? []} preco={preco} />}
          {aba === "motoristas" && <Vazio q={motQ}><AbaRanking lista={motQ.data?.motoristas ?? []} tipo="motorista" /></Vazio>}
          {aba === "veiculos" && <Vazio q={veiQ}><AbaRanking lista={veiQ.data?.motoristas ?? []} tipo="veiculo" /></Vazio>}
          {aba === "eventos" && <Vazio q={serieQ}>{tot && <AbaEventos tot={tot} totAnt={totAnt} evol={evol} motoristas={motQ.data?.motoristas ?? []} />}</Vazio>}
          {aba === "combustivel" && <Vazio q={serieQ}>{tot && <AbaCombustivel tot={tot} totAnt={totAnt} evol={evol} preco={preco} veiculos={veiQ.data?.motoristas ?? []} />}</Vazio>}
          {aba === "telemetria" && <AbaTelemetria saudeQ={saudeQ} tot={tot} evol={evol} />}
        </div>
      </div>
    </>
  );
}

type Tot = ReturnType<typeof somar>;
type Evol = ReturnType<typeof agrupar>;

/* ------------------------------ Visão geral ----------------------------- */

function AbaGeral({ tot, totAnt, evol, fim, preco }: { tot: Tot; totAnt: Tot | null; evol: Evol; fim: string; preco: number }) {
  const i = indicadoresDoTopo(tot, fim, preco);
  const a = totAnt ? indicadoresDoTopo(totAnt, fim, preco) : null;
  const eco = economiaPotencial(tot, preco);
  const dados = evol.map((e) => {
    const x = indicadoresDoTopo(e, fim, preco);
    return { rotulo: e.rotulo, litros: Math.round(e.litros), kml: x.kml ?? 0, eficiencia: (x.eficiencia ?? 0) * 100, parado: (x.parado ?? 0) * 100 };
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Kpi icon={Fuel} label="Consumo" valor={nf(i.consumo)} unidade="L" atual={i.consumo} anterior={a?.consumo} menorMelhor />
        <Kpi icon={TrendingUp} label="Est. mês" valor={nf(i.estMes)} unidade="L" dica="Consumo ÷ dias do período × dias do mês (Dashboard Start)" />
        <Kpi icon={BarChart3} label="Custo estimado" valor={brl(i.custoEstimado)} dica={`Est. mês × diesel a ${brl(preco)}/L`} />
        <Kpi icon={Route} label="KM rodados" valor={nf(i.km)} unidade="km" atual={i.km} anterior={a?.km} />
        <Kpi icon={Timer} label="Horas trabalhadas" valor={nf(i.horas)} unidade="h" atual={i.horas} anterior={a?.horas} />
        <Kpi icon={Gauge} label="Média KM/L" valor={nf(i.kml, 2)} unidade="km/l" atual={i.kml} anterior={a?.kml} dica="Km filtrado ÷ litros" />
        <Kpi icon={Activity} label="Velocidade média" valor={nf(i.velocidade, 1)} unidade="km/h" atual={i.velocidade} anterior={a?.velocidade} />
        <Kpi icon={TrendingUp} label="Eficiência operacional" valor={pct(i.eficiencia)} atual={i.eficiencia} anterior={a?.eficiencia} dica="100% − parado ligado" />
        <Kpi icon={Clock} label="Parado ligado" valor={pct(i.parado)} atual={i.parado} anterior={a?.parado} menorMelhor alerta={(i.parado ?? 0) > 0.2} dica="Alerta acima de 20% (Dashboard Start)" />
        <Kpi icon={Leaf} label="Economia potencial" valor={brl(eco.total)} dica="Ociosidade × 50% + vermelha × 15% + amarela × 8% (Dashboard Start)" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Grafico titulo="Evolução da média e do consumo" icon={TrendingUp} rodape="Barras: litros. Linha: km/l (km filtrado ÷ litros).">
          <ComposedChart data={dados}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="k" orientation="right" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <Tooltip content={<DicaGrafico fmt={(v, n) => (n === "Km/l" ? nf(v, 2) : nf(v))} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="l" dataKey="litros" name="Litros" fill="var(--brand-sky)" radius={[4, 4, 0, 0]} {...ANIM} />
            <Line yAxisId="k" dataKey="kml" name="Km/l" stroke="var(--leaf)" strokeWidth={2.5} dot={{ r: 2 }} {...ANIM} />
          </ComposedChart>
        </Grafico>
        <Grafico titulo="Evolução da eficiência" icon={Activity} rodape="Eficiência = 100% − parado ligado (inclui o parado produtivo).">
          <AreaChart data={dados}>
            <defs>
              <linearGradient id="gEf" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--leaf)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--leaf)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
            <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v, 1)}%`} />} />
            <Area dataKey="eficiencia" name="Eficiência" stroke="var(--leaf)" fill="url(#gEf)" strokeWidth={2} {...ANIM} />
            <Line dataKey="parado" name="Parado ligado" stroke="var(--coral)" strokeWidth={2} dot={false} {...ANIM} />
          </AreaChart>
        </Grafico>
      </div>

      <Card title="Onde agir para economizar" icon={Leaf} bodyClassName="p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { t: "Tempo ocioso", v: eco.ociosidade, base: eco.parado, lim: 0.2, acao: "Treinar motoristas sobre desligamento em paradas > 2 min" },
            { t: "Faixa de RPM vermelha", v: eco.altaRotacao, base: eco.vermelha, lim: 0.05, acao: "Treinar motoristas sobre condução econômica e troca de marchas" },
            { t: "Faixa amarela", v: eco.alerta, base: eco.amarela, lim: 0.1, acao: "Analisar rotas e hábitos de condução" },
          ].map((c) => (
            <div key={c.t} className={cn("rounded-xl border p-4", c.base > c.lim ? "border-coral-line bg-coral-tint/30" : "border-border")}>
              <p className="text-[12.5px] font-semibold">{c.t}</p>
              <p className="mt-1 font-display text-xl font-bold">{brl(c.v)}</p>
              <p className="text-[11.5px] text-muted-foreground">{pct(c.base)} do tempo</p>
              <p className="mt-2 text-[12px]">{c.acao}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Custo atual {brl(eco.custo)}; economia potencial {brl(eco.total)} ({pct(eco.pct)}). Coeficientes do Dashboard Start (50% / 15% / 8%), sobre as 11 faixas.
        </p>
      </Card>
    </>
  );
}

/* -------------------------------- Faixas -------------------------------- */

function AbaFaixas({ tot, evol, motoristas, veiculos }: { tot: Tot; evol: Evol; motoristas: MotoristaRankingApi[]; veiculos: MotoristaRankingApi[] }) {
  const [por, setPor] = useState<"motorista" | "veiculo">("veiculo");
  const p = pctFaixas13(tot);
  const fatias = (Object.keys(p) as (keyof Faixas13)[])
    .map((k) => ({ nome: ROTULO_FAIXA[k], valor: p[k] * 100, cor: CORES_FAIXA[k] }))
    .filter((f) => f.valor > 0)
    .sort((a, b) => b.valor - a.valor);
  const l = lados(tot);
  const evolLados = evol.map((e) => {
    const x = lados(e);
    return { rotulo: e.rotulo, bom: x.bom * 100, ruim: x.ruim * 100 };
  });
  const top = (por === "veiculo" ? veiculos : motoristas)
    .filter((m) => m.faixas.vermelha != null)
    .sort((a, b) => (b.faixas.vermelha ?? 0) - (a.faixas.vermelha ?? 0))
    .slice(0, 10)
    .map((m) => ({
      nome: (m.nome ?? String(m.driver_id)).slice(0, 26),
      Vermelha: m.faixas.vermelha ?? 0, Amarela: m.faixas.amarela ?? 0, Verde: m.faixas.verde ?? 0, Inércia: m.faixas.inercia ?? 0,
      "Parado ligado": m.faixas.parado_ligado ?? 0,
    }));

  return (
    <>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Grafico titulo="Distribuição do tempo nas 13 faixas" icon={Gauge} altura={320} rodape="% sobre a soma das 13 faixas (Power BI). Passe o mouse para ver cada faixa.">
          <PieChart>
            <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius="52%" outerRadius="85%" paddingAngle={1.5} {...ANIM}>
              {fatias.map((f) => <Cell key={f.nome} fill={f.cor} />)}
            </Pie>
            <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v, 1)}%`} />} />
            <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11.5 }} />
          </PieChart>
        </Grafico>
        <Card title="Lado bom × lado ruim" icon={Activity} bodyClassName="p-4">
          <div className="space-y-4">
            {[
              { t: "Lado bom", v: l.bom, cor: "bg-leaf", desc: "Inércia, extra econômica, verde, baixa velocidade, eco-roll" },
              { t: "Lado ruim", v: l.ruim, cor: "bg-coral", desc: "Amarela, vermelha, parado acelerando, batendo transmissão, sem tração, tolerância, parado ligado" },
            ].map((x) => (
              <div key={x.t}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold">{x.t}</span>
                  <span className="font-display text-xl font-bold">{pct(x.v)}</span>
                </div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-secondary">
                  <div className={cn("h-3 rounded-full transition-all duration-1000", x.cor)} style={{ width: `${x.v * 100}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{x.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 h-40">
            <ResponsiveContainer>
              <AreaChart data={evolLados} stackOffset="expand">
                <XAxis dataKey="rotulo" tick={{ fontSize: 10 }} />
                <YAxis hide />
                <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v, 1)}%`} />} />
                <Area dataKey="bom" name="Lado bom" stackId="1" stroke="var(--leaf)" fill="var(--leaf)" fillOpacity={0.55} {...ANIM} />
                <Area dataKey="ruim" name="Lado ruim" stackId="1" stroke="var(--coral)" fill="var(--coral)" fillOpacity={0.55} {...ANIM} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card
        title="Top 10 por faixa vermelha"
        icon={AlertTriangle}
        action={
          <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
            {(["veiculo", "motorista"] as const).map((x) => (
              <button key={x} onClick={() => setPor(x)} className={cn("rounded-md px-3 py-1 text-[12px] font-medium", por === x ? "bg-white shadow-sm" : "text-muted-foreground")}>
                {x === "veiculo" ? "Veículos" : "Motoristas"}
              </button>
            ))}
          </div>
        }
        bodyClassName="p-4"
      >
        <div style={{ height: 360 }}>
          <ResponsiveContainer>
            <BarChart data={top} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" unit="%" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="nome" width={190} tick={{ fontSize: 11 }} />
              <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v, 1)}%`} />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Vermelha" stackId="f" fill={CORES_FAIXA.vermelha} {...ANIM} />
              <Bar dataKey="Amarela" stackId="f" fill={CORES_FAIXA.amarela} {...ANIM} />
              <Bar dataKey="Parado ligado" stackId="f" fill={CORES_FAIXA.parado_ocioso} {...ANIM} />
              <Bar dataKey="Verde" stackId="f" fill={CORES_FAIXA.verde} {...ANIM} />
              <Bar dataKey="Inércia" stackId="f" fill={CORES_FAIXA.inercia} radius={[0, 4, 4, 0]} {...ANIM} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );
}

/* ------------------------------ Tempo ocioso ----------------------------- */

function AbaOcioso({ ocioQ, meta, metaCadastrada, motoristas, preco }: {
  ocioQ: { data?: { veiculos: import("@/lib/gerencial-api").VeiculoOcioso[] }; isPending: boolean; error: unknown };
  meta: number; metaCadastrada: boolean; motoristas: MotoristaRankingApi[]; preco: number;
}) {
  const vs = ocioQ.data?.veiculos ?? [];
  const top = vs.slice(0, 10).map((v) => ({
    nome: v.rotulo.slice(0, 26),
    parado: Math.round(v.segundos_parado / 360) / 10,
    pct: (v.pct_parado ?? 0) * 100,
  }));
  const ranking = vs
    .filter((v) => v.pct_parado != null)
    .sort((a, b) => (b.pct_parado ?? 0) - (a.pct_parado ?? 0))
    .map((v, i) => ({ ...v, rank: i + 1, diferenca: (v.pct_parado ?? 0) - meta, acima: (v.pct_parado ?? 0) > meta }));
  const acima = ranking.filter((r) => r.acima).length;
  type L = (typeof ranking)[number];
  const cols: Column<L>[] = [
    { key: "rank", header: "#", align: "center", render: (r) => <span className="font-mono text-muted-foreground">{r.rank}</span> },
    { key: "rotulo", header: "Veículo", render: (r) => <div><div className="font-semibold">{r.rotulo}</div><div className="text-[11px] text-muted-foreground">{r.motorista ?? "—"}</div></div> },
    { key: "tempo", header: "Tempo parado", align: "right", render: (r) => <span className="font-mono">{hhmm(r.segundos_parado)}</span> },
    { key: "pct", header: "% parado", align: "right", render: (r) => <span className="font-mono font-semibold">{pct(r.pct_parado)}</span> },
    { key: "meta", header: "Meta", align: "right", render: () => <span className="font-mono text-muted-foreground">{pct(meta)}</span> },
    { key: "dif", header: "Diferença", align: "right", render: (r) => <span className={cn("font-mono", r.acima ? "text-coral" : "text-leaf")}>{r.diferenca > 0 ? "+" : ""}{nf(r.diferenca * 100, 1)} p.p.</span> },
    { key: "status", header: "Status", align: "center", render: (r) => <Pill tone={r.acima ? "coral" : "green"}>{r.acima ? "Acima" : "Abaixo"}</Pill> },
    { key: "custo", header: "Custo evitável", align: "right", render: (r) => <span className="font-mono">{brl(r.litros * (r.pct_parado ?? 0) * 0.5 * preco)}</span> },
  ];
  const motTop = [...motoristas].filter((m) => m.faixas.parado_ligado != null).sort((a, b) => (b.faixas.parado_ligado ?? 0) - (a.faixas.parado_ligado ?? 0)).slice(0, 10);

  return (
    <Vazio q={ocioQ}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Clock} label="Tempo parado ligado" valor={hhmm(vs.reduce((a, v) => a + v.segundos_parado, 0))} />
        <Kpi icon={AlertTriangle} label="Acima da meta" valor={`${nf(acima)} de ${nf(ranking.length)}`} alerta={acima > 0} />
        <Kpi icon={Gauge} label={metaCadastrada ? "Meta cadastrada" : "Meta padrão (sem cadastro)"} valor={pct(meta)} dica="Metas e Pesos, faixa 0 (PARADO MOTOR LIGADO); 15% sem meta" />
        <Kpi icon={Fuel} label="Custo evitável" valor={brl(vs.reduce((a, v) => a + v.litros * (v.pct_parado ?? 0) * 0.5, 0) * preco)} dica="Regra do Dashboard Start: 50% do tempo ocioso" />
      </div>
      <Grafico titulo="Top 10 — horas paradas com motor ligado" icon={Clock} altura={320}>
        <BarChart data={top} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
          <YAxis type="category" dataKey="nome" width={190} tick={{ fontSize: 11 }} />
          <Tooltip content={<DicaGrafico fmt={(v, n) => (n === "Horas" ? `${nf(v, 1)} h` : `${nf(v, 1)}%`)} />} />
          <Bar dataKey="parado" name="Horas" fill="var(--gold)" radius={[0, 4, 4, 0]} {...ANIM} />
        </BarChart>
      </Grafico>
      <Card title="Ranking de parado ligado × meta" icon={BarChart3} bodyClassName="p-4">
        <DataTable columns={cols as unknown as Column<Record<string, unknown>>[]} rows={ranking as unknown as Record<string, unknown>[]} />
      </Card>
      <Card title="Motoristas com mais parado ligado" icon={Users} bodyClassName="p-4">
        <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {motTop.map((m, i) => (
            <li key={m.driver_id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
              <span className="font-mono text-[12px] text-muted-foreground">{i + 1}</span>
              <span className="flex-1 truncate text-[13px]">{m.nome}</span>
              <Pill tone={(m.faixas.parado_ligado ?? 0) / 100 > meta ? "coral" : "green"}>{nf(m.faixas.parado_ligado, 1)}%</Pill>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-[11px] text-muted-foreground">% sobre as 13 faixas (ranking); a tabela de veículos usa as 11 do Dashboard Start.</p>
      </Card>
    </Vazio>
  );
}

/* -------------------------------- Ranking ------------------------------- */

const ESTRELA_COR = ["#D2352A", "#E0483C", "#F0A868", "#E8C63A", "#6FBF7A", "#2E9E4F"];

function AbaRanking({ lista, tipo }: { lista: MotoristaRankingApi[]; tipo: "motorista" | "veiculo" }) {
  const com = lista.filter((m) => m.pontuacao != null);
  const media = com.length ? com.reduce((a, m) => a + (m.pontuacao ?? 0), 0) / com.length : null;
  const top20 = com.slice(0, 20).map((m) => ({ nome: (m.nome ?? String(m.driver_id)).slice(0, 28), Pontuação: m.pontuacao ?? 0 }));
  const estrelas = [5, 4, 3, 2, 1, 0].map((e) => ({ nome: `${e} ★`, valor: com.filter((m) => m.estrelas === e).length, cor: ESTRELA_COR[e] })).filter((x) => x.valor > 0);
  const tone = (n: number): PillTone => (n >= 90 ? "green" : n >= 80 ? "sky" : n >= 60 ? "gold" : "coral");
  const cols: Column<MotoristaRankingApi>[] = [
    { key: "posicao", header: "#", align: "center", render: (m) => <span className="font-mono text-muted-foreground">{m.posicao ?? "—"}</span> },
    { key: "nome", header: tipo === "veiculo" ? "Veículo" : "Motorista", render: (m) => <span className="font-semibold">{m.nome ?? m.driver_id}</span> },
    { key: "pontuacao", header: "Pontuação", align: "center", render: (m) => (m.pontuacao == null ? "—" : <Pill tone={tone(m.pontuacao)}>{nf(m.pontuacao, 2)}</Pill>) },
    { key: "estrelas", header: "Estrelas", align: "center", render: (m) => <span className="text-gold">{"★".repeat(m.estrelas)}<span className="text-border">{"★".repeat(5 - m.estrelas)}</span></span> },
    { key: "km", header: "Km", align: "right", render: (m) => <span className="font-mono">{nf(m.km)}</span> },
    { key: "horas", header: "Horas", align: "right", render: (m) => <span className="font-mono">{nf(m.horas, 1)}</span> },
    { key: "kml", header: "Km/l", align: "right", render: (m) => <span className="font-mono">{nf(m.kml, 2)}</span> },
    { key: "verde", header: "Lado bom", align: "right", render: (m) => <span className="font-mono">{nf((m.faixas.verde ?? 0) + (m.faixas.inercia ?? 0) + (m.faixas.extra_economica ?? 0) + (m.faixas.eco_roll ?? 0) + (m.faixas.baixa_velocidade ?? 0), 1)}%</span> },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Users} label={tipo === "veiculo" ? "Veículos com nota" : "Motoristas com nota"} valor={nf(com.length)} />
        <Kpi icon={Trophy} label="Pontuação média" valor={nf(media, 2)} />
        <Kpi icon={Gauge} label="5 estrelas (≥ 90)" valor={nf(com.filter((m) => m.estrelas === 5).length)} />
        <Kpi icon={AlertTriangle} label="Abaixo de 50" valor={nf(com.filter((m) => (m.pontuacao ?? 0) < 50).length)} alerta />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Grafico titulo={`Top 20 — ${tipo === "veiculo" ? "placas" : "motoristas"}`} icon={Trophy} altura={460}>
          <BarChart data={top20} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="nome" width={200} tick={{ fontSize: 10.5 }} />
            <Tooltip content={<DicaGrafico fmt={(v) => nf(v, 2)} />} />
            <Bar dataKey="Pontuação" radius={[0, 4, 4, 0]} {...ANIM}>
              {top20.map((t) => <Cell key={t.nome} fill={t.Pontuação >= 90 ? "var(--leaf)" : t.Pontuação >= 80 ? "var(--brand-sky)" : "var(--gold)"} />)}
            </Bar>
          </BarChart>
        </Grafico>
        <Grafico titulo="Distribuição por estrelas" icon={Gauge} altura={460} rodape="Estrelas: ≥ 90 → 5 · ≥ 80 → 4 · ≥ 70 → 3 · ≥ 60 → 2 · ≥ 50 → 1 (Power BI).">
          <PieChart>
            <Pie data={estrelas} dataKey="valor" nameKey="nome" outerRadius="80%" label={(e: { nome: string; valor: number }) => `${e.nome}: ${e.valor}`} {...ANIM}>
              {estrelas.map((e) => <Cell key={e.nome} fill={e.cor} />)}
            </Pie>
            <Tooltip content={<DicaGrafico fmt={(v) => nf(v)} />} />
          </PieChart>
        </Grafico>
      </div>
      <Card title={tipo === "veiculo" ? "Ranking por placa" : "Ranking de motoristas"} icon={BarChart3} bodyClassName="p-4">
        <DataTable columns={cols as unknown as Column<Record<string, unknown>>[]} rows={lista as unknown as Record<string, unknown>[]} />
        <p className="mt-2 text-[11px] text-muted-foreground">Pontuação do Power BI com os pesos de Metas e Pesos. O pódio do BI é por instrutor; aqui, posição geral.</p>
      </Card>
    </>
  );
}

/* -------------------------------- Eventos ------------------------------- */

function AbaEventos({ tot, totAnt, evol, motoristas }: { tot: Tot; totAnt: Tot | null; evol: Evol; motoristas: MotoristaRankingApi[] }) {
  const ph = (n: number, h: number) => (h > 0 ? n / h : null);
  const tipos = [
    { k: "aceleracao" as const, t: "Aceleração brusca", cor: "var(--gold)" },
    { k: "freada" as const, t: "Freada brusca", cor: "var(--coral)" },
    { k: "velocidade" as const, t: "Velocidade excessiva", cor: "var(--brand-navy)" },
    { k: "embreagem" as const, t: "Embreagem excessiva", cor: "var(--brand-sky)" },
  ];
  const dados = evol.map((e) => ({ rotulo: e.rotulo, ...Object.fromEntries(tipos.map((x) => [x.t, e[x.k]])) }));
  const pior = [...motoristas]
    .map((m) => ({ m, total: (m.eventos_por_hora.aceleracao_brusca ?? 0) + (m.eventos_por_hora.freada_brusca ?? 0) + (m.eventos_por_hora.velocidade_excessiva ?? 0) + (m.eventos_por_hora.embreagem ?? 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
    .map(({ m }) => ({
      nome: (m.nome ?? String(m.driver_id)).slice(0, 26),
      "Aceleração brusca": m.eventos_por_hora.aceleracao_brusca ?? 0,
      "Freada brusca": m.eventos_por_hora.freada_brusca ?? 0,
      "Velocidade excessiva": m.eventos_por_hora.velocidade_excessiva ?? 0,
      "Embreagem excessiva": m.eventos_por_hora.embreagem ?? 0,
    }));

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tipos.map((x) => (
          <Kpi key={x.k} icon={ShieldAlert} label={`${x.t} / h`} valor={nf(ph(tot[x.k], tot.horas), 2)} atual={ph(tot[x.k], tot.horas)} anterior={totAnt ? ph(totAnt[x.k], totAnt.horas) : null} menorMelhor dica={`${nf(tot[x.k])} ocorrências ÷ horas trabalhadas`} />
        ))}
      </div>
      <Grafico titulo="Evolução de eventos" icon={BarChart3} rodape="Contadores de con_driver_h_km; velocidade = excesso + faixas dry (como no Power BI).">
        <BarChart data={dados}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip content={<DicaGrafico fmt={(v) => nf(v)} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {tipos.map((x, i) => <Bar key={x.k} dataKey={x.t} stackId="e" fill={x.cor} radius={i === tipos.length - 1 ? [4, 4, 0, 0] : undefined} {...ANIM} />)}
        </BarChart>
      </Grafico>
      <Grafico titulo="Top 10 motoristas — eventos por hora" icon={Users} altura={360}>
        <BarChart data={pior} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="nome" width={190} tick={{ fontSize: 11 }} />
          <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v, 2)}/h`} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {tipos.map((x) => <Bar key={x.k} dataKey={x.t} stackId="m" fill={x.cor} {...ANIM} />)}
        </BarChart>
      </Grafico>
    </>
  );
}

/* ------------------------------ Combustível ----------------------------- */

function AbaCombustivel({ tot, totAnt, evol, preco, veiculos }: { tot: Tot; totAnt: Tot | null; evol: Evol; preco: number; veiculos: MotoristaRankingApi[] }) {
  const kml = tot.litros > 0 ? tot.km_filtrado / tot.litros : null;
  const kmlAnt = totAnt && totAnt.litros > 0 ? totAnt.km_filtrado / totAnt.litros : null;
  const dados = evol.map((e) => ({ rotulo: e.rotulo, "CO₂ (t)": co2Kg(e.litros) / 1000, Litros: Math.round(e.litros), "Km/l": e.litros > 0 ? e.km_filtrado / e.litros : 0 }));
  const kmlVei = veiculos.filter((v) => v.kml != null && v.km > 100).sort((a, b) => (b.kml ?? 0) - (a.kml ?? 0));
  const melhores = kmlVei.slice(0, 8);
  const piores = kmlVei.slice(-8).reverse();
  const barras = (lista: MotoristaRankingApi[]) => lista.map((v) => ({ nome: (v.nome ?? String(v.driver_id)).slice(0, 24), "Km/l": v.kml ?? 0 }));

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi icon={Fuel} label="Litros" valor={nf(tot.litros)} unidade="L" atual={tot.litros} anterior={totAnt?.litros} menorMelhor />
        <Kpi icon={Gauge} label="Média km/l" valor={nf(kml, 2)} atual={kml} anterior={kmlAnt} />
        <Kpi icon={BarChart3} label="Custo" valor={brl(tot.litros * preco)} dica={`Litros × ${brl(preco)}/L`} />
        <Kpi icon={Leaf} label="CO₂ emitido" valor={nf(co2Kg(tot.litros) / 1000, 1)} unidade="t" atual={tot.litros} anterior={totAnt?.litros} menorMelhor dica="Litros × 3,21 kg (Power BI)" />
        <Kpi icon={Route} label="Km com combustível" valor={nf(tot.km_filtrado)} unidade="km" dica="Só dias com combustível entre 0 e 500.000 mL" />
      </div>
      <Grafico titulo="Evolução do consumo e do CO₂" icon={Leaf}>
        <ComposedChart data={dados}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="k" orientation="right" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
          <Tooltip content={<DicaGrafico fmt={(v, n) => (n === "Litros" ? nf(v) : nf(v, 2))} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="l" dataKey="Litros" fill="var(--brand-sky)" radius={[4, 4, 0, 0]} {...ANIM} />
          <Line yAxisId="k" dataKey="Km/l" stroke="var(--leaf)" strokeWidth={2.5} dot={{ r: 2 }} {...ANIM} />
        </ComposedChart>
      </Grafico>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {[{ t: "Melhores médias (km/l)", l: melhores, cor: "var(--leaf)" }, { t: "Piores médias (km/l)", l: piores, cor: "var(--coral)" }].map((b) => (
          <Grafico key={b.t} titulo={b.t} icon={Truck} altura={300} rodape="Veículos com mais de 100 km no período.">
            <BarChart data={barras(b.l)} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="nome" width={180} tick={{ fontSize: 11 }} />
              <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v, 2)} km/l`} />} />
              <Bar dataKey="Km/l" fill={b.cor} radius={[0, 4, 4, 0]} {...ANIM} />
            </BarChart>
          </Grafico>
        ))}
      </div>
    </>
  );
}

/* ------------------------- Revisão de telemetria ------------------------ */

function AbaTelemetria({ saudeQ, tot, evol }: { saudeQ: { data?: import("@/lib/api").SaudeFrotaApi; isPending: boolean; error: unknown }; tot: Tot | null; evol: Evol }) {
  const s = saudeQ.data;
  const motivos = Object.entries(s?.por_motivo ?? {}).map(([nome, valor]) => ({ nome, valor }));
  const naoInf = evol.map((e) => ({ rotulo: e.rotulo, "% não identificado": e.horas > 0 ? (100 * e.horas_sem_condutor) / e.horas : 0 }));
  type U = NonNullable<typeof s>["nao_saudaveis"][number];
  const cols: Column<U>[] = [
    { key: "label", header: "Veículo", render: (u) => <span className="font-semibold">{u.label ?? u.unit_id}</span> },
    { key: "categoria", header: "Cat.", align: "center", render: (u) => <span className="font-mono">{u.categoria}</span> },
    { key: "motivo", header: "Motivo", render: (u) => <Pill tone="gold">{u.motivo}</Pill> },
    { key: "valor", header: "Valor", align: "right", render: (u) => <span className="font-mono">{u.valor == null ? "—" : u.valor <= 1 ? pct(u.valor) : nf(u.valor, 1)}</span> },
  ];

  return (
    <Vazio q={saudeQ}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Stethoscope} label="Saudáveis" valor={s?.percentual_saudavel == null ? "—" : `${nf(s.percentual_saudavel, 1)}%`} />
        <Kpi icon={Truck} label="Unidades avaliadas" valor={nf(s?.total_unidades)} />
        <Kpi icon={AlertTriangle} label="Com ponto de atenção" valor={nf(s?.unidades_nao_saudaveis)} alerta={(s?.unidades_nao_saudaveis ?? 0) > 0} />
        <Kpi icon={Users} label="Horas sem motorista" valor={tot && tot.horas > 0 ? pct(tot.horas_sem_condutor / tot.horas) : "—"} alerta={!!tot && tot.horas > 0 && tot.horas_sem_condutor / tot.horas > 0.6} dica="Acima de 60% dispara a categoria 14 da cascata" />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Grafico titulo={`Pontos de atenção por motivo · ${s?.referencia ? new Date(s.referencia + "T12:00").toLocaleDateString("pt-BR") : ""}`} icon={Stethoscope} rodape="Cascata T11/DS-1511 sobre o último dia com dado.">
          <BarChart data={motivos} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="nome" width={220} tick={{ fontSize: 11 }} />
            <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v)} unidades`} />} />
            <Bar dataKey="valor" name="Unidades" fill="var(--gold)" radius={[0, 4, 4, 0]} {...ANIM} />
          </BarChart>
        </Grafico>
        <Grafico titulo="Horas sem motorista identificado" icon={Users} rodape="Horas com driver_id 0 ÷ horas trabalhadas.">
          <AreaChart data={naoInf}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v, 1)}%`} />} />
            <Area dataKey="% não identificado" stroke="var(--brand-navy)" fill="var(--brand-sky)" fillOpacity={0.35} strokeWidth={2} {...ANIM} />
          </AreaChart>
        </Grafico>
      </div>
      <Card title="Unidades para revisar" icon={AlertTriangle} bodyClassName="p-4">
        <DataTable columns={cols as unknown as Column<Record<string, unknown>>[]} rows={(s?.nao_saudaveis ?? []) as unknown as Record<string, unknown>[]} />
      </Card>
    </Vazio>
  );
}
