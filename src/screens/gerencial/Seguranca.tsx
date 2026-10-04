import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, CloudRain, Flame, Gauge, Grid3x3, ListChecks, MapPin, ShieldAlert, Siren, Truck, Users, Zap } from "lucide-react";
import { Card, DataTable, Pill, type Column } from "@/components/ss/ui/data";
import {
  COR_EVENTO, EVENTOS_SEGURANCA, eventosBIQuery, listaEventosBIQuery, rankingBIQuery, ROTULO_EVENTO, serieBIQuery, TIPOS_EVENTO,
  type EventoItem, type TipoEvento,
} from "@/lib/bi-api";
import { iso, nf, somar } from "@/lib/gerencial-api";
import { cn } from "@/lib/utils";
import { ANIM, BarrasRank, Carregando, DicaGrafico, Grafico, Info, Kpi, MatrizCalor, dataBR } from "./pecas";
import { AvisoCarga, type Ctx } from "./Conducao";

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/* ----------------------------- Gestão de eventos ---------------------------- */

export function PaginaEventos({ f }: Ctx) {
  const evQ = useQuery(eventosBIQuery(f));
  const [tipos, setTipos] = useState<TipoEvento[]>([...TIPOS_EVENTO]);
  const e = evQ.data;
  const soTipos = (o: Record<TipoEvento, number>) => tipos.reduce((a, t) => a + (o[t] ?? 0), 0);
  const pizza = TIPOS_EVENTO.map((t) => ({ nome: ROTULO_EVENTO[t], valor: e?.totais[t] ?? 0, cor: COR_EVENTO[t] })).filter((x) => x.valor > 0);
  const porDia = (e?.por_dia ?? []).map((d) => ({ rotulo: ddmm(d.dia), ...Object.fromEntries(tipos.map((t) => [ROTULO_EVENTO[t], d[t]])) }));
  const alterna = (t: TipoEvento) => setTipos((x) => (x.includes(t) ? (x.length > 1 ? x.filter((y) => y !== t) : x) : [...x, t]));

  return (
    <Carregando q={evQ} vazio={!!e && e.total === 0}>
      {e && <AvisoCarga ultimo={e.ultimo_evento} fim={f.fim} />}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {TIPOS_EVENTO.map((t) => {
          const ativo = tipos.includes(t);
          return (
            <button
              key={t}
              onClick={() => alterna(t)}
              title={`Clique para ${ativo ? "tirar" : "incluir"} ${ROTULO_EVENTO[t]} nos gráficos`}
              className={cn("rounded-2xl border p-3 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5", ativo ? "border-border bg-card" : "border-dashed border-border bg-secondary/40 opacity-60")}
            >
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COR_EVENTO[t] }} />
                <span className="truncate">{ROTULO_EVENTO[t]}</span>
              </div>
              <p className="mt-1 font-display text-xl font-bold tabular-nums">{nf(e?.totais[t])}</p>
            </button>
          );
        })}
      </div>

      <Card title="Mapa de calor — dia da semana × hora" icon={Grid3x3} action={<Info texto="Quantidade de eventos (dos tipos selecionados acima) por dia da semana e hora do dia. Mostra os horários em que os eventos se concentram — base para escala, treinamento e fiscalização." />} bodyClassName="p-4">
        <MatrizCalor celulas={matrizDosTipos(e?.matriz ?? [], tipos)} />
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Grafico titulo="Eventos por dia" icon={CalendarDays} dica="Evolução diária, empilhada por tipo.">
          <AreaChart data={porDia}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip content={<DicaGrafico fmt={(v) => nf(v)} />} />
            {tipos.map((t) => <Area key={t} dataKey={ROTULO_EVENTO[t]} stackId="d" stroke={COR_EVENTO[t]} fill={COR_EVENTO[t]} fillOpacity={0.55} {...ANIM} />)}
          </AreaChart>
        </Grafico>
        <Grafico titulo="Participação por tipo" icon={ShieldAlert} dica="Peso de cada tipo no total de eventos do período.">
          <PieChart>
            <Pie data={pizza} dataKey="valor" nameKey="nome" innerRadius="50%" outerRadius="82%" paddingAngle={1.5} {...ANIM}>
              {pizza.map((p) => <Cell key={p.nome} fill={p.cor} />)}
            </Pie>
            <Tooltip content={<DicaGrafico fmt={(v) => nf(v)} />} />
          </PieChart>
        </Grafico>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Placas com mais eventos" icon={Truck} action={<Info texto="Ranking de eventos por placa (Power BI: RANK_EVENTOS_PLACA), só com os tipos selecionados." />} bodyClassName="p-4">
          <BarrasRank
            itens={[...(e?.por_placa ?? [])].map((p) => ({ nome: p.placa ?? String(p.unit_id), valor: soTipos(p), chave: p.unit_id })).sort((a, b) => b.valor - a.valor).slice(0, 15)}
            cor="var(--brand-navy)"
          />
        </Card>
        <Card title="Condutores com mais eventos" icon={Users} action={<Info texto="Ranking de eventos por condutor (Power BI: RANK_EVENTOS_MOTORISTA). NÃO INFORMADO = sem identificação no veículo." />} bodyClassName="p-4">
          <BarrasRank
            itens={[...(e?.por_condutor ?? [])].map((p) => ({ nome: p.condutor ?? "NÃO INFORMADO", valor: soTipos(p), chave: p.driver_id })).sort((a, b) => b.valor - a.valor).slice(0, 15)}
            cor={(i) => (i < 3 ? "var(--coral)" : "var(--gold)")}
          />
        </Card>
      </div>
    </Carregando>
  );
}

/** Soma a matriz dia × hora só dos tipos escolhidos. */
function matrizDosTipos(m: { dow: number; hora: number; tipo: TipoEvento; n: number }[], tipos: TipoEvento[]) {
  const s = new Map<string, { dow: number; hora: number; n: number }>();
  for (const c of m) {
    if (!tipos.includes(c.tipo)) continue;
    const k = `${c.dow}-${c.hora}`;
    const x = s.get(k) ?? { dow: c.dow, hora: c.hora, n: 0 };
    x.n += c.n;
    s.set(k, x);
  }
  return [...s.values()];
}

/* ---------------------------- Central de segurança -------------------------- */

const SEG_SERIE = [
  { k: "velocidade" as const, t: "Excesso de velocidade", icon: Gauge, cor: COR_EVENTO.velocidade_seco, idMeta: 13, dica: "Excessos de velocidade no seco (inclui os níveis 1 a 3), da consolidação diária." },
  { k: "velocidade_chuva" as const, t: "Velocidade na chuva", icon: CloudRain, cor: COR_EVENTO.velocidade_chuva, idMeta: null, dica: "Excessos com o sensor de chuva ativo." },
  { k: "freada" as const, t: "Freada brusca", icon: Siren, cor: COR_EVENTO.freada, idMeta: 15, dica: "Desaceleração acima do limite configurado." },
  { k: "aceleracao" as const, t: "Aceleração brusca", icon: Zap, cor: COR_EVENTO.aceleracao, idMeta: 16, dica: "Aceleração acima do limite configurado." },
  { k: "embreagem" as const, t: "Embreagem excessiva", icon: Flame, cor: COR_EVENTO.embreagem, idMeta: 14, dica: "Uso excessivo do pedal de embreagem." },
];

export function PaginaSeguranca({ f, ant }: Ctx) {
  const serieQ = useQuery(serieBIQuery(f));
  const antQ = useQuery(serieBIQuery(ant));
  const rankQ = useQuery(rankingBIQuery(f, "motorista"));
  const tot = useMemo(() => (serieQ.data ? somar(serieQ.data.dias) : null), [serieQ.data]);
  const totAnt = useMemo(() => (antQ.data ? somar(antQ.data.dias) : null), [antQ.data]);
  const ph = (n: number, h: number) => (h > 0 ? n / h : null);
  const dados = (serieQ.data?.dias ?? []).map((d) => ({ rotulo: ddmm(d.dia), ...Object.fromEntries(SEG_SERIE.map((x) => [x.t, d[x.k]])) }));
  const piores = [...(rankQ.data?.motoristas ?? [])]
    .filter((m) => m.horas >= 5 && (!f.condutor || String(m.driver_id) === f.condutor))
    .map((m) => ({ m, v: (m.eventos_por_hora.velocidade_excessiva ?? 0) + (m.eventos_por_hora.freada_brusca ?? 0) + (m.eventos_por_hora.aceleracao_brusca ?? 0) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 12);

  return (
    <Carregando q={serieQ}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {SEG_SERIE.map((x) => {
          const meta = x.idMeta != null ? serieQ.data?.metas[String(x.idMeta)] : undefined;
          const v = tot ? ph(tot[x.k], tot.horas) : null;
          return (
            <Kpi
              key={x.k}
              icon={x.icon}
              label={x.t}
              valor={tot?.[x.k]}
              alerta={meta != null && v != null && v > meta}
              dica={<>{x.dica}<br />Por hora: <b>{nf(v, 2)}</b>{meta != null && <> · meta {nf(meta, 2)}/h</>}</>}
              atual={tot ? tot[x.k] : null}
              anterior={totAnt ? totAnt[x.k] : null}
              menorMelhor
            />
          );
        })}
      </div>
      <Grafico titulo="Eventos de segurança por dia" icon={ShieldAlert} dica="Totais diários consolidados (inclui o dia de ontem). Comparação: mesmos dias do mês anterior." altura={300}>
        <BarChart data={dados}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip content={<DicaGrafico fmt={(v) => nf(v)} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SEG_SERIE.map((x, i) => <Bar key={x.k} dataKey={x.t} stackId="s" fill={x.cor} radius={i === SEG_SERIE.length - 1 ? [4, 4, 0, 0] : undefined} {...ANIM} />)}
        </BarChart>
      </Grafico>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card title="Motoristas de maior risco" icon={Users} action={<Info texto="Velocidade + freada + aceleração por hora trabalhada. Só motoristas com 5 h ou mais no período, para não destacar quem dirigiu pouco." />} bodyClassName="p-4">
          <BarrasRank
            itens={piores.map(({ m, v }) => ({ nome: m.nome ?? String(m.driver_id), valor: v, chave: m.driver_id, detalhe: `${nf(m.horas, 1)} h · ${nf(m.eventos?.velocidade_excessiva)} vel. · ${nf(m.eventos?.freada_brusca)} freadas` }))}
            fmt={(n) => `${nf(n, 2)}/h`}
            cor={(i) => (i < 3 ? "var(--coral)" : "var(--gold)")}
            vazio="Sem motoristas com horas suficientes."
          />
        </Card>
        <ListaDoDia f={f} />
      </div>
    </Carregando>
  );
}

/** Lista de eventos de um dia, com o aviso de até quando a tabela foi carregada. */
export function ListaDoDia({ f, inicial, tiposIniciais = EVENTOS_SEGURANCA }: { f: Ctx["f"]; inicial?: string; tiposIniciais?: TipoEvento[] }) {
  const [dia, setDia] = useState(inicial ?? f.fim);
  const [tipos, setTipos] = useState<TipoEvento[]>(tiposIniciais);
  const q = useQuery(listaEventosBIQuery(dia, f));
  const itens = (q.data?.itens ?? []).filter((i) => tipos.includes(i.tipo));
  const carregado = q.data?.ultimo_carregado;
  const semCarga = !!carregado && carregado.slice(0, 10) < dia;
  const cols: Column<EventoItem>[] = [
    { key: "hora", header: "Hora", render: (i) => <span className="font-mono">{i.hora ? i.hora.slice(11, 16) : "—"}</span> },
    { key: "tipo", header: "Evento", render: (i) => <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COR_EVENTO[i.tipo] }} />{ROTULO_EVENTO[i.tipo]}</span> },
    { key: "placa", header: "Placa", render: (i) => <span className="font-semibold">{i.placa}</span> },
    { key: "condutor", header: "Condutor", render: (i) => i.condutor ?? <span className="text-muted-foreground">Não informado</span> },
    {
      key: "local", header: "Local", render: (i) => (
        <span className="line-clamp-1 max-w-[260px] text-[12px]" title={i.endereco ?? ""}>
          {i.cerca ? <Pill tone="sky">{i.cerca}</Pill> : null} {i.endereco ?? (i.latitude != null ? `${nf(i.latitude, 5)}, ${nf(i.longitude, 5)}` : "—")}
        </span>
      ),
    },
  ];
  return (
    <Card
      title="Eventos do dia"
      icon={ListChecks}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={dia} max={iso(new Date())} onChange={(e) => e.target.value && setDia(e.target.value)} className="h-8 rounded-lg border border-border bg-white px-2 text-[13px]" />
          <Info texto="Cada evento com hora, placa, condutor e endereço. Vem da tabela de eventos com localização, que é carregada com atraso de até um dia." />
        </div>
      }
      bodyClassName="p-4"
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TIPOS_EVENTO.map((t) => (
          <button
            key={t}
            onClick={() => setTipos((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
            className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] transition-all", tipos.includes(t) ? "border-brand-navy bg-navy-tint text-foreground" : "border-border text-muted-foreground")}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: COR_EVENTO[t] }} />
            {ROTULO_EVENTO[t]}
          </button>
        ))}
      </div>
      {semCarga && (
        <p className="mb-3 rounded-lg border border-gold-line bg-gold-tint px-3 py-2 text-[12px]">
          Os eventos de {dataBR(dia)} ainda não foram carregados (última carga: {new Date(carregado!).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}). Os totais do dia já aparecem nos cartões acima.{" "}
          <button onClick={() => setDia(carregado!.slice(0, 10))} className="font-semibold text-brand-navy underline-offset-2 hover:underline">
            Ver {dataBR(carregado!.slice(0, 10))}
          </button>
        </p>
      )}
      <Carregando q={q}>
        <DataTable columns={cols as unknown as Column<Record<string, unknown>>[]} rows={itens.slice(0, 300) as unknown as Record<string, unknown>[]} empty={semCarga ? "Aguardando a carga deste dia." : "Nenhum evento dos tipos escolhidos neste dia."} />
        {itens.length > 300 && <p className="mt-2 text-[12px] text-muted-foreground">Mostrando 300 de {nf(itens.length)}. Use os filtros de placa ou condutor para recortar.</p>}
        <p className="mt-2 text-[12px] text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />Passe o mouse sobre o local para ver o endereço completo.</p>
      </Carregando>
    </Card>
  );
}
