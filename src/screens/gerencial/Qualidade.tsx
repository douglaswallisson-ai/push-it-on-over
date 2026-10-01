import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, IdCard, RadioTower, Stethoscope, Timer, Truck, Wrench } from "lucide-react";
import { Card, DataTable, Pill, type Column } from "@/components/ss/ui/data";
import { saudeFrotaQuery, veiculosApiQuery } from "@/lib/queries";
import type { MotoristaRankingApi } from "@/lib/api";
import { naoIdentificadoBIQuery, rankingBIQuery, serieBIQuery, type NaoIdentificadoBI } from "@/lib/bi-api";
import { nf, pct, somar } from "@/lib/gerencial-api";
import { cn } from "@/lib/utils";
import { ANIM, BarrasRank, Carregando, DicaGrafico, Grafico, Info, Kpi, dataBR, dataHoraBR } from "./pecas";
import type { Ctx } from "./Conducao";

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/* ------------------------------ Não identificado ---------------------------- */

export function PaginaNaoIdentificado({ f }: Ctx) {
  const q = useQuery(naoIdentificadoBIQuery(f));
  const serieQ = useQuery(serieBIQuery(f));
  const tot = serieQ.data ? somar(serieQ.data.dias) : null;
  const pctNi = tot && tot.horas > 0 ? tot.horas_sem_condutor / tot.horas : null;
  const porPlaca = useMemo(() => {
    const m = new Map<number, { nome: string; horas: number; total: number; dias: number }>();
    for (const i of q.data?.itens ?? []) {
      const x = m.get(i.unit_id) ?? { nome: i.placa ?? String(i.unit_id), horas: 0, total: 0, dias: 0 };
      x.horas += i.horas_ni;
      x.total += i.horas;
      x.dias += 1;
      m.set(i.unit_id, x);
    }
    return [...m.values()].sort((a, b) => b.horas - a.horas);
  }, [q.data]);
  const dias = (serieQ.data?.dias ?? []).map((d) => ({ rotulo: ddmm(d.dia), "% não identificado": d.horas > 0 ? (100 * d.horas_sem_condutor) / d.horas : 0 }));
  type L = NaoIdentificadoBI["itens"][number];
  const cols: Column<L>[] = [
    { key: "dia", header: "Dia", render: (i) => <span className="font-mono">{dataBR(i.dia)}</span> },
    { key: "placa", header: "Placa", render: (i) => <span className="font-semibold">{i.placa ?? i.unit_id}</span> },
    { key: "horas_ni", header: "Horas sem condutor", align: "right", render: (i) => <span className="font-mono">{nf(i.horas_ni, 1)}</span> },
    { key: "horas", header: "Horas no dia", align: "right", render: (i) => <span className="font-mono text-muted-foreground">{nf(i.horas, 1)}</span> },
    { key: "pct", header: "%", align: "right", render: (i) => <Pill tone={(i.pct ?? 0) > 0.6 ? "coral" : (i.pct ?? 0) > 0.2 ? "gold" : "neutral"}>{pct(i.pct)}</Pill> },
  ];

  return (
    <Carregando q={q}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={IdCard} label="Horas sem condutor" valor={q.data?.horas_ni} fmt={(n) => nf(n, 1)} unidade="h" dica="Horas em que o veículo trabalhou sem motorista identificado (crachá/ID). No Power BI, código 7777." />
        <Kpi icon={Timer} label="% das horas" valor={pctNi == null ? null : pctNi * 100} fmt={(n) => `${nf(n, 1)}%`} alerta={(pctNi ?? 0) > 0.6} dica="Horas sem condutor ÷ horas trabalhadas. Acima de 60%, a revisão de telemetria marca “% Não Informado Alto”." />
        <Kpi icon={Truck} label="Placas com ocorrência" valor={porPlaca.length} dica="Veículos com pelo menos um dia rodando sem condutor identificado." />
        <Kpi icon={AlertTriangle} label="Dias × placa" valor={q.data?.itens.length} dica="Combinações de dia e placa com horas sem condutor." />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Grafico titulo="% sem condutor por dia" icon={IdCard} dica="Evolução diária. Quedas mostram dias em que a identificação foi cobrada.">
          <AreaChart data={dias}>
            <defs>
              <linearGradient id="gNi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand-navy)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--brand-navy)" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 10.5 }} />
            <YAxis tick={{ fontSize: 11 }} unit="%" />
            <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v, 1)}%`} />} />
            <Area dataKey="% não identificado" stroke="var(--brand-navy)" fill="url(#gNi)" strokeWidth={2} {...ANIM} />
          </AreaChart>
        </Grafico>
        <Card title="Placas com mais horas sem condutor" icon={Truck} bodyClassName="p-4">
          <BarrasRank itens={porPlaca.slice(0, 12).map((p) => ({ nome: p.nome, valor: p.horas, detalhe: `${p.dias} dias · ${pct(p.total > 0 ? p.horas / p.total : null)} das horas` }))} fmt={(n) => `${nf(n, 1)} h`} cor="var(--brand-navy)" />
        </Card>
      </div>
      <Card title="Dia a dia por placa" icon={IdCard} bodyClassName="p-4">
        <DataTable columns={cols as unknown as Column<Record<string, unknown>>[]} rows={(q.data?.itens ?? []).slice(0, 400) as unknown as Record<string, unknown>[]} />
      </Card>
    </Carregando>
  );
}

/* -------------------------------- Área técnica ------------------------------ */

/** Coluna "Verificar" do Power BI (P2), sobre as faixas do veículo no período. */
function verificar(m: MotoristaRankingApi): string[] {
  const x = m.faixas;
  const r: string[] = [];
  if ((x.inercia ?? 0) > 70) r.push("Calibração inércia");
  if ((x.parado_acelerando ?? 0) > 70) r.push("Calibração velocidade");
  if ((x.tolerancia ?? 0) > 20) r.push("Cadastro de faixas");
  if ((x.vermelha ?? 0) > 15) r.push("Calibração RPM");
  if (m.sem_faixas && m.horas > 1) r.push("Sem faixas no período");
  return r;
}

export function PaginaTecnica({ f }: Ctx) {
  const saudeQ = useQuery(saudeFrotaQuery());
  const veiQ = useQuery(veiculosApiQuery());
  const rankQ = useQuery(rankingBIQuery(f, "veiculo"));
  const s = saudeQ.data;
  const agora = Date.now();
  const semTx = useMemo(
    () =>
      (veiQ.data?.items ?? [])
        .filter((v) => (!f.garagem || v.unidadeId === f.garagem) && (!f.placa || v.id === f.placa))
        .map((v) => ({ v, h: v.odometroLidoEm ? (agora - new Date(v.odometroLidoEm).getTime()) / 3600_000 : null }))
        .filter((x) => x.h == null || x.h > 48)
        .sort((a, b) => (b.h ?? 1e9) - (a.h ?? 1e9)),
    [veiQ.data, f.garagem, f.placa, agora],
  );
  const totalVei = (veiQ.data?.items ?? []).filter((v) => (!f.garagem || v.unidadeId === f.garagem) && (!f.placa || v.id === f.placa)).length;
  const paraVerificar = (rankQ.data?.motoristas ?? []).map((m) => ({ m, r: verificar(m) })).filter((x) => x.r.length);
  const motivos = Object.entries(s?.por_motivo ?? {}).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
  type U = NonNullable<typeof s>["nao_saudaveis"][number];
  const colsSaude: Column<U>[] = [
    { key: "label", header: "Veículo", render: (u) => <span className="font-semibold">{u.label ?? u.unit_id}</span> },
    { key: "categoria", header: "Cat.", align: "center", render: (u) => <span className="font-mono">{u.categoria}</span> },
    { key: "motivo", header: "Motivo", render: (u) => <Pill tone="gold">{u.motivo}</Pill> },
    { key: "valor", header: "Valor", align: "right", render: (u) => <span className="font-mono">{u.valor == null ? "—" : u.valor <= 1 ? pct(u.valor) : nf(u.valor, 1)}</span> },
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Stethoscope} label="Frota saudável" valor={s?.percentual_saudavel} fmt={(n) => `${nf(n, 1)}%`} dica="Cascata de saúde da frota (agregador T11/DS-1511) sobre o último dia com dado." />
        <Kpi icon={Wrench} label="Para verificação" valor={s?.unidades_nao_saudaveis} alerta={(s?.unidades_nao_saudaveis ?? 0) > 0} dica="Unidades com algum ponto de atenção na cascata: telemetria, odômetro, faixas, eventos, identificação." />
        <Kpi icon={RadioTower} label="Sem transmissão > 48 h" valor={semTx.length} alerta={semTx.length > 0} sub={totalVei ? `${pct(semTx.length / totalVei)} da frota` : undefined} dica="Veículos ativos cuja última leitura tem mais de 48 horas (Power BI, P9)." />
        <Kpi icon={AlertTriangle} label="Faixas a revisar" valor={paraVerificar.length} dica="Placas com inércia > 70%, parado acelerando > 70%, tolerância > 20% ou vermelha > 15% no período (coluna Verificar do Power BI)." />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Grafico titulo={`Pontos de atenção por motivo${s?.referencia ? ` · ${dataBR(s.referencia)}` : ""}`} icon={Stethoscope} dica="Quantas unidades caíram em cada motivo da cascata de saúde da frota." altura={300}>
          <BarChart data={motivos} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="nome" width={230} tick={{ fontSize: 11 }} />
            <Tooltip content={<DicaGrafico fmt={(v) => `${nf(v)} unidades`} />} />
            <Bar dataKey="valor" name="Unidades" fill="var(--gold)" radius={[0, 4, 4, 0]} {...ANIM} />
          </BarChart>
        </Grafico>
        <Card title="Sem transmissão há mais de 48 h" icon={RadioTower} action={<Info texto="Ordenado pelo tempo sem comunicar. Sem leitura nenhuma aparece primeiro." />} bodyClassName="p-4">
          <Carregando q={veiQ}>
            <div className="max-h-[300px] space-y-1 overflow-y-auto pr-1">
              {semTx.slice(0, 80).map(({ v, h }) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-[12.5px]">
                  <span className="font-semibold">{v.placa}{v.prefixo ? <span className="ml-1 font-normal text-muted-foreground">{v.prefixo}</span> : null}</span>
                  <span className={cn("font-mono", h == null || h > 24 * 7 ? "text-coral" : "text-gold")}>
                    {h == null ? "nunca comunicou" : h > 48 ? `${nf(h / 24, 0)} dias · ${dataHoraBR(v.odometroLidoEm)}` : ""}
                  </span>
                </div>
              ))}
              {!semTx.length && <p className="py-6 text-center text-sm text-muted-foreground">Todos transmitiram nas últimas 48 horas.</p>}
            </div>
          </Carregando>
        </Card>
      </div>
      <Card title="Unidades para verificação" icon={Wrench} bodyClassName="p-4">
        <Carregando q={saudeQ}>
          <DataTable columns={colsSaude as unknown as Column<Record<string, unknown>>[]} rows={(s?.nao_saudaveis ?? []) as unknown as Record<string, unknown>[]} empty="Nenhuma unidade com ponto de atenção." />
        </Carregando>
      </Card>
      <Card title="Faixas a revisar no período" icon={AlertTriangle} action={<Info texto="Regras da coluna Verificar do Power BI aplicadas às faixas de cada placa no período filtrado." />} bodyClassName="p-4">
        <Carregando q={rankQ}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {paraVerificar.slice(0, 60).map(({ m, r }) => (
              <div key={m.driver_id} className="rounded-lg border border-border px-3 py-2">
                <p className="text-[13px] font-semibold">{m.nome ?? m.driver_id}</p>
                <div className="mt-1 flex flex-wrap gap-1">{r.map((x) => <Pill key={x} tone="coral">{x}</Pill>)}</div>
                <p className="mt-1 text-[11px] text-muted-foreground">Inércia {nf(m.faixas.inercia, 1)}% · Vermelha {nf(m.faixas.vermelha, 1)}% · Tolerância {nf(m.faixas.tolerancia, 1)}%</p>
              </div>
            ))}
          </div>
          {!paraVerificar.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma placa fora dos limites.</p>}
        </Carregando>
      </Card>
    </>
  );
}
