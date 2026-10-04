import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity, BarChart3, CalendarDays, Clock, Fuel, Gauge, Hourglass, Leaf, MapPin, Route, Timer, TrendingUp, Truck, Users, Wallet,
} from "lucide-react";
import { Card, DataTable, type Column } from "@/components/ss/ui/data";
import { ociosoBIQuery, paradoBIQuery, rankingBIQuery, serieBIQuery, type ParadoBI } from "@/lib/bi-api";
import {
  agrupar, brl, co2Kg, CORES_FAIXA, economiaPotencial, indicadoresDoTopo, lados, nf, pct, pctFaixas13, ROTULO_FAIXA, somar, type Faixas13,
} from "@/lib/gerencial-api";
import { cn } from "@/lib/utils";
import { ANIM, BarrasRank, Carregando, DicaGrafico, Grafico, Info, Kpi, dataHoraBR } from "./pecas";
import type { Ctx } from "./Conducao";
import { KpiRelevo } from "./Relevo";

/* -------------------------------- Visão geral ------------------------------- */

export function PaginaGeral({ f, ant, preco }: Ctx) {
  const serieQ = useQuery(serieBIQuery(f));
  const antQ = useQuery(serieBIQuery(ant));
  const tot = useMemo(() => (serieQ.data ? somar(serieQ.data.dias) : null), [serieQ.data]);
  const totAnt = useMemo(() => (antQ.data ? somar(antQ.data.dias) : null), [antQ.data]);
  const evol = useMemo(() => (serieQ.data ? agrupar(serieQ.data.dias) : []), [serieQ.data]);
  if (!tot) return <Carregando q={serieQ}>{null}</Carregando>;
  const i = indicadoresDoTopo(tot, f.fim, preco);
  const a = totAnt ? indicadoresDoTopo(totAnt, f.fim, preco) : null;
  const eco = economiaPotencial(tot, preco);
  const p = pctFaixas13(tot);
  const fatias = (Object.keys(p) as (keyof Faixas13)[])
    .map((k) => ({ nome: ROTULO_FAIXA[k], valor: p[k] * 100, cor: CORES_FAIXA[k] }))
    .filter((x) => x.valor > 0.05)
    .sort((x, y) => y.valor - x.valor);
  const l = lados(tot);
  const dados = evol.map((e) => {
    const x = indicadoresDoTopo(e, f.fim, preco);
    const lx = lados(e);
    return { rotulo: e.rotulo, litros: Math.round(e.litros), kml: x.kml ?? 0, eficiencia: (x.eficiencia ?? 0) * 100, bom: lx.bom * 100, ruim: lx.ruim * 100 };
  });

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        <Kpi icon={Fuel} label="Consumo" valor={i.consumo} unidade="L" atual={i.consumo} anterior={a?.consumo} menorMelhor dica="Litros consumidos no período (consolidação diária)." />
        <Kpi icon={Route} label="Km rodados" valor={i.km} unidade="km" atual={i.km} anterior={a?.km} dica="Distância percorrida no período." />
        <Kpi icon={Timer} label="Horas trabalhadas" valor={i.horas} unidade="h" atual={i.horas} anterior={a?.horas} dica="Horas com o motor em funcionamento." />
        <Kpi icon={Gauge} label="Média km/l" valor={i.kml} fmt={(n) => nf(n, 2)} atual={i.kml} anterior={a?.kml} dica="Km filtrado ÷ litros (Dashboard Start): só dias com consumo válido entram." />
        <Kpi icon={Activity} label="Velocidade média" valor={i.velocidade} fmt={(n) => nf(n, 1)} unidade="km/h" atual={i.velocidade} anterior={a?.velocidade} dica="Km ÷ horas trabalhadas." />
        <Kpi icon={TrendingUp} label="Eficiência operacional" valor={i.eficiencia == null ? null : i.eficiencia * 100} fmt={(n) => `${nf(n, 1)}%`} atual={i.eficiencia} anterior={a?.eficiencia} dica="100% − parado ligado (sobre as 11 faixas do Dashboard Start)." />
        <Kpi icon={Clock} label="Parado ligado" valor={i.parado == null ? null : i.parado * 100} fmt={(n) => `${nf(n, 1)}%`} atual={i.parado} anterior={a?.parado} menorMelhor alerta={(i.parado ?? 0) > 0.2} dica="Tempo parado com motor ligado ÷ 11 faixas. Alerta acima de 20%." />
        <Kpi icon={Hourglass} label="Estimativa do mês" valor={i.estMes} unidade="L" dica="Consumo ÷ dias do período × dias do mês." />
        <Kpi icon={Wallet} label="Custo estimado" valor={i.custoEstimado} fmt={(n) => brl(n)} dica={`Estimativa do mês × diesel a ${brl(preco)}/L (ajuste o preço no filtro).`} />
        <Kpi icon={Leaf} label="Economia potencial" valor={eco.total} fmt={(n) => brl(n)} dica="Ociosidade × 50% + faixa vermelha × 15% + amarela × 8% do custo (Dashboard Start)." />
        <KpiRelevo f={f} ant={ant} preco={preco} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Grafico titulo="Distribuição do tempo nas 13 faixas" icon={Gauge} altura={320} dica="% de cada faixa sobre a soma das 13 (Power BI). Passe o mouse em cada fatia.">
          <PieChart>
            <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius="52%" outerRadius="85%" paddingAngle={1.2} {...ANIM}>
              {fatias.map((x) => <Cell key={x.nome} fill={x.cor} />)}
            </Pie>
            <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v, 1)}%`} />} />
            <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </Grafico>
        <Card title="Lado bom × lado ruim" icon={Activity} action={<Info texto="Lado bom: inércia, extra econômica, verde, baixa velocidade, eco-roll. Lado ruim: amarela, vermelha, parado acelerando, batendo transmissão, sem tração, tolerância e parado ligado (com produtivo)." />} bodyClassName="p-4">
          {[{ t: "Lado bom", v: l.bom, cor: "bg-leaf" }, { t: "Lado ruim", v: l.ruim, cor: "bg-coral" }].map((x) => (
            <div key={x.t} className="mb-4">
              <div className="flex items-baseline justify-between"><span className="text-[13px] font-semibold">{x.t}</span><span className="font-display text-xl font-bold">{pct(x.v)}</span></div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-secondary"><div className={cn("h-3 rounded-full transition-all duration-1000", x.cor)} style={{ width: `${x.v * 100}%` }} /></div>
            </div>
          ))}
          <div className="h-40">
            <AreaChartBomRuim dados={dados} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Grafico titulo="Consumo e média" icon={TrendingUp} dica="Barras: litros. Linha: km/l.">
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
        <Card title="Onde agir para economizar" icon={Leaf} action={<Info texto="Coeficientes do Dashboard Start sobre o custo do período: 50% do tempo ocioso, 15% da faixa vermelha e 8% da amarela." />} bodyClassName="p-4">
          <div className="grid grid-cols-1 gap-3">
            {[
              { t: "Tempo ocioso", v: eco.ociosidade, base: eco.parado, lim: 0.2, acao: "Orientar desligamento em paradas acima de 2 minutos." },
              { t: "Faixa vermelha", v: eco.altaRotacao, base: eco.vermelha, lim: 0.05, acao: "Treinar troca de marchas e condução econômica." },
              { t: "Faixa amarela", v: eco.alerta, base: eco.amarela, lim: 0.1, acao: "Analisar rotas e hábitos de condução." },
            ].map((c) => (
              <div key={c.t} className={cn("flex items-center gap-4 rounded-xl border p-3", c.base > c.lim ? "border-coral-line bg-coral-tint/30" : "border-border")}>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold">{c.t} <span className="font-normal text-muted-foreground">· {pct(c.base)} do tempo</span></p>
                  <p className="text-[12px] text-muted-foreground">{c.acao}</p>
                </div>
                <p className="font-display text-lg font-bold">{brl(c.v)}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">Custo do período {brl(eco.custo)} · economia potencial {brl(eco.total)} ({pct(eco.pct)}).</p>
        </Card>
      </div>
    </>
  );
}

function AreaChartBomRuim({ dados }: { dados: { rotulo: string; bom: number; ruim: number }[] }) {
  return (
    <ResponsiveContainer>
      <AreaChart data={dados} stackOffset="expand">
        <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
        <YAxis hide />
        <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v, 1)}%`} />} />
        <Area dataKey="bom" name="Lado bom" stackId="1" stroke="var(--leaf)" fill="var(--leaf)" fillOpacity={0.55} {...ANIM} />
        <Area dataKey="ruim" name="Lado ruim" stackId="1" stroke="var(--coral)" fill="var(--coral)" fillOpacity={0.55} {...ANIM} />
      </AreaChart>
    </ResponsiveContainer>
  );
}


/* ------------------------------- Parado ligado ------------------------------ */

const DURACOES: { id: string; rotulo: string; min?: number; max?: number }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "2", rotulo: "Acima de 2 min", min: 2 },
  { id: "5", rotulo: "Acima de 5 min", min: 5 },
  { id: "15", rotulo: "Acima de 15 min", min: 15 },
  { id: "30", rotulo: "Acima de 30 min", min: 30 },
  { id: "60", rotulo: "Acima de 1 h", min: 60 },
];

const hm = (h: number) => `${Math.floor(h)}h${String(Math.round((h % 1) * 60)).padStart(2, "0")}`;

export function PaginaParado({ f, ant, preco }: Ctx) {
  const [dur, setDur] = useState("todas");
  const d = DURACOES.find((x) => x.id === dur)!;
  const q = useQuery(paradoBIQuery(f, { min: d.min, max: d.max }));
  const qAnt = useQuery(paradoBIQuery(ant, { min: d.min, max: d.max }));
  const serieQ = useQuery(serieBIQuery(f));
  const ocioQ = useQuery(ociosoBIQuery(f));
  const p = q.data;
  const tot = serieQ.data ? somar(serieQ.data.dias) : null;
  const pctParado = tot && tot.faixas_13 > 0 ? (tot.faixas.parado_ocioso + tot.faixas.parado_produtivo) / tot.faixas_13 : null;
  const meta = serieQ.data?.meta_parado ?? null;
  const litrosOciosos = (ocioQ.data?.veiculos ?? []).reduce((a, v) => a + v.litros * (v.pct_parado ?? 0) * 0.5, 0);
  const cols: Column<ParadoBI["detalhe"][number]>[] = [
    { key: "inicio", header: "Início", render: (r) => <span className="font-mono">{dataHoraBR(r.inicio)}</span> },
    { key: "veiculo", header: "Placa", render: (r) => <span className="font-semibold">{r.veiculo}</span> },
    { key: "condutor", header: "Condutor", render: (r) => r.condutor },
    { key: "local", header: "Local", render: (r) => <span className={cn("text-[12px]", r.local === "NÃO CADASTRADO" && "text-muted-foreground")}>{r.local}</span> },
    { key: "horas", header: "Tempo", align: "right", render: (r) => <span className="font-mono font-semibold">{hm(r.horas)}</span> },
  ];

  return (
    <Carregando q={q}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-muted-foreground">Duração da parada:</span>
        {DURACOES.map((x) => (
          <button key={x.id} onClick={() => setDur(x.id)} className={cn("rounded-full border px-3 py-1 text-[12px] transition-all", dur === x.id ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-white hover:bg-secondary")}>
            {x.rotulo}
          </button>
        ))}
        <Info texto="Filtra as paradas pelo tempo de cada uma. Ex.: acima de 5 min mostra só as paradas longas, que são as que mais desperdiçam combustível." />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi icon={Clock} label="Tempo parado ligado" valor={p?.horas} fmt={(n) => hm(n)} atual={p?.horas} anterior={qAnt.data?.horas} menorMelhor dica="Soma do tempo das paradas com motor ligado (Gestão do Parado Ligado)." />
        <Kpi icon={MapPin} label="Paradas" valor={p?.paradas} atual={p?.paradas} anterior={qAnt.data?.paradas} menorMelhor dica="Quantidade de paradas com motor ligado." />
        <Kpi icon={Timer} label="Média por parada" texto={p && p.paradas ? `${nf((p.horas * 60) / p.paradas, 1)} min` : "—"} dica="Tempo total ÷ número de paradas." />
        <Kpi icon={Gauge} label="% do tempo" valor={pctParado == null ? null : pctParado * 100} fmt={(n) => `${nf(n, 1)}%`} alerta={pctParado != null && meta != null && pctParado > meta} sub={meta != null ? `Meta ${pct(meta)}${serieQ.data?.meta_parado_cadastrada ? "" : " (padrão)"}` : undefined} dica="Parado ligado (com produtivo) ÷ 13 faixas, comparado à meta de Metas e Pesos." />
        <Kpi icon={Fuel} label="Custo evitável" valor={litrosOciosos * preco} fmt={(n) => brl(n)} dica="Regra do Dashboard Start: 50% do combustível do tempo ocioso, ao preço do diesel informado." />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card title="Por local" icon={MapPin} action={<Info texto="Nome da cerca; sem cerca, o ponto de interesse a até 700 m; senão NÃO CADASTRADO (regra do Power BI)." />} bodyClassName="p-4">
          <BarrasRank itens={(p?.por_local ?? []).slice(0, 12).map((x) => ({ nome: x.nome, valor: x.horas, detalhe: `${nf(x.paradas)} paradas` }))} fmt={hm} cor="var(--gold)" />
        </Card>
        <Card title="Por placa" icon={Truck} bodyClassName="p-4">
          <BarrasRank itens={(p?.por_veiculo ?? []).slice(0, 12).map((x) => ({ nome: x.nome, valor: x.horas, detalhe: `${nf(x.paradas)} paradas` }))} fmt={hm} cor="var(--brand-navy)" />
        </Card>
        <Card title="Por condutor" icon={Users} bodyClassName="p-4">
          <BarrasRank itens={(p?.por_condutor ?? []).slice(0, 12).map((x) => ({ nome: x.nome, valor: x.horas, detalhe: `${nf(x.paradas)} paradas` }))} fmt={hm} cor={(i) => (i < 3 ? "var(--coral)" : "var(--gold)")} />
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Grafico titulo="Por hora do dia" icon={Clock} dica="Em que horário as paradas com motor ligado começam.">
          <BarChart data={(p?.por_hora ?? []).map((x) => ({ rotulo: `${String(x.hora).padStart(2, "0")}h`, Horas: x.horas }))}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<DicaGrafico fmt={(v) => hm(v)} />} />
            <Bar dataKey="Horas" fill="var(--gold)" radius={[4, 4, 0, 0]} {...ANIM} />
          </BarChart>
        </Grafico>
        <Grafico titulo="Por dia do mês" icon={CalendarDays} dica="Tempo parado com motor ligado em cada dia do mês.">
          <BarChart data={(p?.por_dia_mes ?? []).map((x) => ({ rotulo: String(x.dia), Horas: x.horas }))}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<DicaGrafico fmt={(v) => hm(v)} />} />
            {p && p.paradas > 0 && <ReferenceLine y={p.horas / Math.max(1, p.por_dia_mes.filter((x) => x.horas > 0).length)} stroke="var(--coral)" strokeDasharray="4 4" />}
            <Bar dataKey="Horas" fill="var(--brand-navy)" radius={[4, 4, 0, 0]} {...ANIM} />
          </BarChart>
        </Grafico>
      </div>
      <Card title="Paradas mais longas" icon={BarChart3} action={<Info texto="As 100 paradas com motor ligado mais longas do período." />} bodyClassName="p-4">
        <DataTable columns={cols as unknown as Column<Record<string, unknown>>[]} rows={(p?.detalhe ?? []) as unknown as Record<string, unknown>[]} />
      </Card>
    </Carregando>
  );
}

/* -------------------------------- Combustível ------------------------------- */

export function PaginaCombustivel({ f, ant, preco }: Ctx) {
  const [por, setPor] = useState<"veiculo" | "motorista">("veiculo");
  const serieQ = useQuery(serieBIQuery(f));
  const antQ = useQuery(serieBIQuery(ant));
  const rankQ = useQuery(rankingBIQuery(f, por));
  const tot = useMemo(() => (serieQ.data ? somar(serieQ.data.dias) : null), [serieQ.data]);
  const totAnt = useMemo(() => (antQ.data ? somar(antQ.data.dias) : null), [antQ.data]);
  const evol = useMemo(() => (serieQ.data ? agrupar(serieQ.data.dias) : []), [serieQ.data]);
  const kml = tot && tot.litros > 0 ? tot.km_com_combustivel / tot.litros : null;
  const kmlAnt = totAnt && totAnt.litros > 0 ? totAnt.km_com_combustivel / totAnt.litros : null;
  const metaKml = kml != null ? kml * 1.05 : null;
  const dados = evol.map((e) => ({ rotulo: e.rotulo, Litros: Math.round(e.litros), "Km/l": e.litros > 0 ? e.km_com_combustivel / e.litros : null, "CO₂ (t)": co2Kg(e.litros) / 1000 }));
  const lista = (rankQ.data?.motoristas ?? []).filter((v) => v.kml != null && v.km > 100 && (!f.condutor || por === "veiculo" || String(v.driver_id) === f.condutor)).sort((a, b) => (b.kml ?? 0) - (a.kml ?? 0));

  return (
    <Carregando q={serieQ}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi icon={Fuel} label="Litros" valor={tot?.litros} unidade="L" atual={tot?.litros} anterior={totAnt?.litros} menorMelhor dica="Combustível consumido (negativos viram 0, como no Power BI)." />
        <Kpi icon={Gauge} label="Média km/l" valor={kml} fmt={(n) => nf(n, 2)} atual={kml} anterior={kmlAnt} sub={metaKml ? `Meta ${nf(metaKml, 2)} (média + 5%)` : undefined} dica="Km com combustível ÷ litros (Power BI, P8). A meta do BI é a média do período + 5%." />
        <Kpi icon={Wallet} label="Custo" valor={tot ? tot.litros * preco : null} fmt={(n) => brl(n)} dica={`Litros × ${brl(preco)}/L.`} />
        <Kpi icon={Leaf} label="CO₂ emitido" valor={tot ? co2Kg(tot.litros) / 1000 : null} fmt={(n) => nf(n, 1)} unidade="t" atual={tot?.litros} anterior={totAnt?.litros} menorMelhor dica="Litros × 3,21 kg de CO₂ (Power BI)." />
        <Kpi icon={Route} label="Km com combustível" valor={tot?.km_com_combustivel} unidade="km" dica="Só a distância dos registros com combustível informado — a base da média." />
      </div>
      <Grafico titulo="Consumo, média e CO₂" icon={Leaf} dica="Barras: litros. Linha verde: km/l. Linha tracejada: meta (média + 5%).">
        <ComposedChart data={dados}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="k" orientation="right" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
          <Tooltip content={<DicaGrafico fmt={(v, n) => (n === "Litros" ? nf(v) : nf(v, 2))} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="l" dataKey="Litros" fill="var(--brand-sky)" radius={[4, 4, 0, 0]} {...ANIM} />
          <Line yAxisId="k" dataKey="Km/l" stroke="var(--leaf)" strokeWidth={2.5} dot={{ r: 2 }} connectNulls {...ANIM} />
          {metaKml && <ReferenceLine yAxisId="k" y={metaKml} stroke="var(--brand-navy)" strokeDasharray="5 4" />}
        </ComposedChart>
      </Grafico>
      <div className="flex justify-end">
        <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
          {(["veiculo", "motorista"] as const).map((x) => (
            <button key={x} onClick={() => setPor(x)} className={cn("rounded-md px-3 py-1 text-[12px] font-medium", por === x ? "bg-white shadow-sm" : "text-muted-foreground")}>{x === "veiculo" ? "Placas" : "Motoristas"}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Melhores médias" icon={TrendingUp} action={<Info texto="Km/l de cada um, com mais de 100 km no período. Linha de referência: meta (média + 5%)." />} bodyClassName="p-4">
          <Carregando q={rankQ}>
            <BarrasRank itens={lista.slice(0, 10).map((v) => ({ nome: v.nome ?? String(v.driver_id), valor: v.kml ?? 0, detalhe: `${nf(v.km)} km · ${nf(v.litros)} L` }))} fmt={(n) => nf(n, 2)} cor="var(--leaf)" />
          </Carregando>
        </Card>
        <Card title="Piores médias" icon={Truck} bodyClassName="p-4">
          <Carregando q={rankQ}>
            <BarrasRank itens={lista.slice(-10).reverse().map((v) => ({ nome: v.nome ?? String(v.driver_id), valor: v.kml ?? 0, detalhe: `${nf(v.km)} km · ${nf(v.litros)} L` }))} fmt={(n) => nf(n, 2)} cor="var(--coral)" />
          </Carregando>
        </Card>
      </div>
      <p className="text-[12px] text-muted-foreground">
        As páginas “Gestão de Combustível Cliente” do Power BI usam os abastecimentos manuais (tela Combustível). Aqui a fonte é a telemetria; os abastecimentos manuais entram quando o módulo de combustível estiver no sistema novo.
      </p>
    </Carregando>
  );
}
