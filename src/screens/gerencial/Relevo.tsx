import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { Activity, Fuel, Mountain, MountainSnow, Route, TrendingDown, TrendingUp, Truck, Users } from "lucide-react";
import { Card, DataTable, Pill, type Column } from "@/components/ss/ui/data";
import { classeRelevo, relevoResumoQuery, type ResumoRelevo } from "@/lib/relevo-api";
import { nf } from "@/lib/gerencial-api";
import { cn } from "@/lib/utils";
import { ANIM, Aviso, BarrasRank, Carregando, DicaGrafico, Grafico, Info, Kpi } from "./pecas";
import type { Ctx } from "./Conducao";

/** Abaixo disso o relevo do motorista/veículo não diz muito: poucos trechos. */
const KM_MINIMO = 100;

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function Calculando({ progresso }: { progresso: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
      <MountainSnow className="mx-auto h-8 w-8 animate-pulse text-brand-navy" />
      <p className="mt-2 text-[14px] font-semibold">Calculando o relevo do período…</p>
      <p className="text-[12.5px] text-muted-foreground">
        Na primeira vez cada dia é medido posição a posição no mapa de elevação. Depois fica guardado e abre na hora.
      </p>
      <div className="mx-auto mt-4 h-2 max-w-md overflow-hidden rounded-full bg-secondary">
        <div className="h-2 rounded-full bg-brand-navy transition-all duration-700" style={{ width: `${Math.max(4, progresso * 100)}%` }} />
      </div>
      <p className="mt-1 font-mono text-[12px] text-muted-foreground">{nf(progresso * 100, 0)}%</p>
    </div>
  );
}

type Veic = ResumoRelevo["por_veiculo"][number];
type Mot = ResumoRelevo["por_motorista"][number];

export function PaginaRelevo({ f }: Ctx) {
  const q = useQuery(relevoResumoQuery(f));
  const [por, setPor] = useState<"veiculo" | "motorista">("veiculo");
  const r = q.data;
  const t = r?.totais;

  const veiculos = useMemo(() => (r?.por_veiculo ?? []).filter((v) => v.km >= KM_MINIMO), [r]);
  const motoristas = useMemo(() => (r?.por_motorista ?? []).filter((m) => m.km >= KM_MINIMO), [r]);
  const dispersao = veiculos.filter((v) => v.kml != null && v.kml > 0.3 && v.kml < 8).map((v) => ({ x: v.subida_por_100km ?? 0, y: v.kml ?? 0, z: v.km, nome: v.placa }));
  const porDia = (r?.por_dia ?? []).map((d) => ({ rotulo: ddmm(d.dia), "Subida por 100 km": d.subida_por_100km ?? 0, "% em aclive": d.pct_aclive ?? 0 }));
  const corr = r?.correlacao_kml;
  const leituraCorr =
    corr == null ? "poucos veículos para medir" : Math.abs(corr) < 0.2 ? "fraca — o relevo explica pouco da diferença de consumo entre veículos" : corr < 0 ? "relevo mais forte, km/l menor" : "sem o efeito esperado; outros fatores pesam mais";
  const classe = classeRelevo(t?.subida_por_100km);

  const colsV: Column<Veic>[] = [
    { key: "placa", header: "Placa", render: (v) => <span className="font-semibold">{v.placa}</span> },
    { key: "classe", header: "Relevo", render: (v) => { const c = classeRelevo(v.subida_por_100km); return <span className="inline-flex items-center gap-1.5 text-[12.5px]"><span className="h-2 w-2 rounded-full" style={{ background: c.cor }} />{c.rotulo}</span>; } },
    { key: "km", header: "Km medido", align: "right", render: (v) => <span className="font-mono">{nf(v.km)}</span> },
    { key: "sub", header: "Subida total", align: "right", render: (v) => <span className="font-mono">{nf(v.subida_m)} m</span> },
    { key: "s100", header: "Subida /100 km", align: "right", render: (v) => <span className="font-mono font-semibold">{nf(v.subida_por_100km)} m</span> },
    { key: "acl", header: "% aclive", align: "right", render: (v) => <span className="font-mono">{nf(v.pct_aclive, 1)}%</span> },
    { key: "kml", header: "Km/l", align: "right", render: (v) => <span className="font-mono">{nf(v.kml, 2)}</span> },
  ];
  const colsM: Column<Mot>[] = [
    { key: "nome", header: "Motorista", render: (m) => <span className="font-semibold">{m.nome ?? m.driver_id}</span> },
    { key: "classe", header: "Relevo", render: (m) => { const c = classeRelevo(m.subida_por_100km); return <span className="inline-flex items-center gap-1.5 text-[12.5px]"><span className="h-2 w-2 rounded-full" style={{ background: c.cor }} />{c.rotulo}</span>; } },
    { key: "km", header: "Km medido", align: "right", render: (m) => <span className="font-mono">{nf(m.km)}</span> },
    { key: "s100", header: "Subida /100 km", align: "right", render: (m) => <span className="font-mono font-semibold">{nf(m.subida_por_100km)} m</span> },
    { key: "acl", header: "% aclive", align: "right", render: (m) => <span className="font-mono">{nf(m.pct_aclive, 1)}%</span> },
    { key: "kml", header: "Km/l", align: "right", render: (m) => <span className="font-mono">{nf(m.kml, 2)}</span> },
  ];

  if (q.data?.calculando) return <Calculando progresso={q.data.progresso} />;

  return (
    <Carregando q={q} vazio={!!r && !t}>
      <Aviso tom="sky">
        Relevo medido pelo <b>mapa de elevação da NASA (SRTM, ~90 m)</b> nas posições com o veículo andando — vale para qualquer equipamento,
        inclusive os que não gravam altitude. Conferido contra os equipamentos que gravam: diferença típica de 3 m.
      </Aviso>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi icon={Mountain} label="Subida por 100 km" valor={t?.subida_por_100km} unidade="m" sub={<span style={{ color: classe.cor }}>Relevo {classe.rotulo.toLowerCase()}</span>} dica="Metros subidos a cada 100 km rodados. Compara rotas de tamanhos diferentes: plano < 400 · ondulado < 900 · montanhoso < 1.500 · serra acima." />
        <Kpi icon={TrendingUp} label="% do caminho em aclive" valor={t?.pct_aclive} fmt={(n) => `${nf(n, 1)}%`} dica="Parte do percurso com subida de 2% ou mais." />
        <Kpi icon={TrendingDown} label="% em declive" valor={t?.pct_declive} fmt={(n) => `${nf(n, 1)}%`} dica="Parte do percurso com descida de 2% ou mais — onde inércia e freio-motor rendem." />
        <Kpi icon={Route} label="Subida total" valor={t?.subida_m ? t.subida_m / 1000 : null} fmt={(n) => nf(n, 1)} unidade="km" sub={t ? `${nf(t.km)} km medidos` : undefined} dica="Soma de todos os metros subidos no período, em quilômetros de altura." />
        <Kpi icon={Fuel} label="Relevo × consumo" texto={corr == null ? "—" : nf(corr, 2)} sub={leituraCorr} dica="Correlação entre subida por 100 km e km/l dos veículos com mais de 200 km. Perto de −1: quanto mais serra, pior o km/l. Perto de 0: o relevo não explica a diferença entre eles." />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Grafico titulo="Relevo × consumo por veículo" icon={Fuel} altura={320} dica="Cada ponto é um veículo: quanto subiu a cada 100 km (horizontal) e o km/l (vertical). Bolhas maiores rodaram mais. Pontos baixos à direita: consumo explicado pela serra; baixos à esquerda: consumo ruim em rota plana — vale investigar.">
          <ScatterChart margin={{ left: 0, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" dataKey="x" name="Subida /100 km" unit=" m" tick={{ fontSize: 11 }} />
            <YAxis type="number" dataKey="y" name="Km/l" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
            <ZAxis type="number" dataKey="z" range={[30, 260]} name="Km" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const p = active && payload?.[0]?.payload as { nome: string; x: number; y: number; z: number } | undefined;
                return p ? (
                  <div className="rounded-xl border border-border bg-white/95 px-3 py-2 text-[12px] shadow-elegant">
                    <p className="font-semibold">{p.nome}</p>
                    <p>Subida: <b>{nf(p.x)} m</b> /100 km</p>
                    <p>Consumo: <b>{nf(p.y, 2)} km/l</b></p>
                    <p className="text-muted-foreground">{nf(p.z)} km</p>
                  </div>
                ) : null;
              }}
            />
            <Scatter data={dispersao} {...ANIM}>
              {dispersao.map((d) => <Cell key={d.nome} fill={classeRelevo(d.x).cor} fillOpacity={0.75} />)}
            </Scatter>
          </ScatterChart>
        </Grafico>
        <Grafico titulo="Relevo por dia" icon={Activity} altura={320} dica="Subida a cada 100 km em cada dia. Dias de rota mais pesada aparecem como picos.">
          <ComposedChart data={porDia}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" tick={{ fontSize: 10.5 }} />
            <YAxis yAxisId="s" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="p" orientation="right" tick={{ fontSize: 11 }} unit="%" />
            <Tooltip content={<DicaGrafico fmt={(v, n) => (n.startsWith("%") ? `${nf(v, 1)}%` : `${nf(v)} m`)} />} />
            <Bar yAxisId="s" dataKey="Subida por 100 km" fill="var(--brand-navy)" radius={[4, 4, 0, 0]} {...ANIM} />
            <Line yAxisId="p" dataKey="% em aclive" stroke="var(--gold)" strokeWidth={2} dot={false} {...ANIM} />
          </ComposedChart>
        </Grafico>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title="Veículos em rota mais pesada" icon={Truck} action={<Info texto={`Subida por 100 km. Só quem teve ${KM_MINIMO} km ou mais medidos.`} />} bodyClassName="p-4">
          <BarrasRank itens={veiculos.slice(0, 12).map((v) => ({ nome: v.placa, valor: v.subida_por_100km ?? 0, detalhe: `${nf(v.km)} km · ${nf(v.kml, 2)} km/l`, chave: v.unit_id }))} fmt={(n) => `${nf(n)} m`} cor={(i) => classeRelevo(veiculos[i]?.subida_por_100km).cor} />
        </Card>
        <Card title="Motoristas em rota mais pesada" icon={Users} action={<Info texto="Mesmo critério, por motorista. Ajuda a comparar km/l de quem roda na serra com quem roda no plano de forma justa." />} bodyClassName="p-4">
          <BarrasRank itens={motoristas.slice(0, 12).map((m) => ({ nome: m.nome ?? String(m.driver_id), valor: m.subida_por_100km ?? 0, detalhe: `${nf(m.km)} km · ${nf(m.kml, 2)} km/l`, chave: m.driver_id }))} fmt={(n) => `${nf(n)} m`} cor={(i) => classeRelevo(motoristas[i]?.subida_por_100km).cor} />
        </Card>
      </div>

      <Card
        title={por === "veiculo" ? "Relevo por veículo" : "Relevo por motorista"}
        icon={Mountain}
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
        {por === "veiculo" ? (
          <DataTable columns={colsV as unknown as Column<Record<string, unknown>>[]} rows={veiculos as unknown as Record<string, unknown>[]} />
        ) : (
          <DataTable columns={colsM as unknown as Column<Record<string, unknown>>[]} rows={motoristas as unknown as Record<string, unknown>[]} />
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Km medido: distância entre posições próximas, onde o relevo foi calculado. <Pill tone="green">Plano &lt; 400 m</Pill>{" "}
          <Pill tone="gold">Ondulado &lt; 900</Pill> <Pill tone="coral">Serra ≥ 1.500</Pill> de subida por 100 km.
        </p>
      </Card>
    </Carregando>
  );
}

/** Indicador compacto para a Visão geral. */
export function KpiRelevo({ f }: Ctx) {
  const q = useQuery(relevoResumoQuery(f));
  const t = q.data?.totais;
  const c = classeRelevo(t?.subida_por_100km);
  return (
    <Kpi
      icon={Mountain}
      label="Relevo das rotas"
      valor={q.data?.calculando ? null : t?.subida_por_100km}
      unidade="m /100 km"
      texto={q.data?.calculando ? `calculando ${nf((q.data.progresso ?? 0) * 100, 0)}%` : undefined}
      sub={t ? <span style={{ color: c.cor }}>{c.rotulo} · {nf(t.pct_aclive, 1)}% em aclive</span> : undefined}
      dica="Metros subidos a cada 100 km rodados, pelo mapa de elevação. Detalhe por veículo e motorista na página Relevo."
    />
  );
}
