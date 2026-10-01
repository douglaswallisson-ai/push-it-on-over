import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, CalendarDays, FileText, Printer, Star, Target, TrendingUp, Trophy, Truck } from "lucide-react";
import { exemploOuVazio, usandoMock } from "@/lib/modo";
import { rankingMotoristasQuery } from "@/lib/queries";
import type { MotoristaRankingApi } from "@/lib/api";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { exportarCSV, imprimir } from "@/lib/export";
import { toast } from "sonner";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, FilterBar, FilterChip, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { RingProgress } from "@/components/ss/ui/gauges";

/**
 * Premiação — acompanhamento do programa de bônus dos motoristas: total apurado,
 * progresso da meta de km e o detalhamento por motorista. Dados de exemplo.
 */

type Premiado = {
  nome: string;
  km: string;
  nota: number;
  viagens: number;
  valor: string;
  pos: number;
};

const notaTone = (n: number): PillTone => (n >= 65 ? "green" : n >= 45 ? "gold" : "coral");

const DADOS: Premiado[] = [
  { pos: 1, nome: "Crísala Boni", km: "7.970", nota: 71, viagens: 18, valor: "R$ 2.985,00" },
  { pos: 2, nome: "Davi Nadalin", km: "10.955", nota: 68, viagens: 23, valor: "R$ 1.130,00" },
  { pos: 3, nome: "Celso Fiorani", km: "8.992", nota: 66, viagens: 23, valor: "R$ 846,76" },
  { pos: 4, nome: "Fernando Rocha", km: "7.277", nota: 61, viagens: 19, valor: "R$ 468,40" },
  { pos: 5, nome: "Éder Caetano", km: "3.320", nota: 57, viagens: 12, valor: "R$ 231,21" },
  { pos: 6, nome: "Gustavo Burkner", km: "6.437", nota: 46, viagens: 20, valor: "R$ 0,00" },
  { pos: 7, nome: "Guilherme Souza", km: "10.056", nota: 41, viagens: 24, valor: "R$ 0,00" },
];

const COLS: Column<Premiado>[] = [
  {
    key: "nome",
    header: "Motorista",
    render: (m) => (
      <div className="flex items-center gap-3">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${m.pos <= 3 ? "bg-gold-tint text-gold" : "bg-secondary text-muted-foreground"}`}>
          {m.pos}
        </div>
        <span className="font-semibold text-foreground">{m.nome}</span>
      </div>
    ),
  },
  { key: "km", header: "Km rodado", align: "right", render: (m) => <span className="font-mono">{m.km}</span> },
  { key: "nota", header: "Nota geral", align: "center", render: (m) => <Pill tone={notaTone(m.nota)}><Star className="h-3 w-3" />{m.nota}</Pill> },
  { key: "viagens", header: "Viagens", align: "right" },
  { key: "valor", header: "Premiação", align: "right", render: (m) => <span className="font-semibold text-foreground">{m.valor}</span> },
  {
    key: "acoes",
    header: "",
    align: "right",
    render: (p) => (
      <div className="flex justify-end gap-1.5">
        <button
          title={`Imprimir demonstrativo de ${p.nome}`}
          onClick={(e) => {
            e.stopPropagation();
            imprimir();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-brand-navy"
        >
          <Printer className="h-3.5 w-3.5" />
        </button>
        <button
          title={`Exportar viagens de ${p.nome}`}
          onClick={(e) => {
            e.stopPropagation();
            exportarCSV(
              [p],
              [
                { cabecalho: "Posição", valor: (x) => x.pos },
                { cabecalho: "Motorista", valor: (x) => x.nome },
                { cabecalho: "Km", valor: (x) => x.km },
                { cabecalho: "Nota", valor: (x) => x.nota },
                { cabecalho: "Viagens", valor: (x) => x.viagens },
                { cabecalho: "Prêmio", valor: (x) => x.valor },
              ],
              `premiacao-${p.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
            );
            toast.success(`Relatório de ${p.nome} exportado.`);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-brand-navy"
        >
          <FileText className="h-3.5 w-3.5" />
        </button>
      </div>
    ),
  },
];

function PremiacaoExemplo() {
  return (
    <>
      <PageHeader title="Premiação" subtitle="Acompanhamento do programa de bônus" />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Motoristas · Premiação"
          title={<span>R$ 6.912,92 em premiação neste ciclo</span>}
          subtitle="Bônus apurado por metas de quilometragem e desempenho de condução."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value="41" label="Performance média" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value="7" label="Motoristas premiados" />
          </div>
        </HeroBanner>

        <FilterBar>
          <FilterChip icon={Truck} label="Frota" value="Toda a frota" />
          <FilterChip icon={CalendarDays} label="Data de corte" value="01–31 jul 2026" />
          <FilterChip icon={CalendarDays} label="Ano" value="2026" />
        </FilterBar>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
          {/* Progresso da meta. */}
          <Card title="Meta de quilometragem" icon={Target}>
            <div className="flex flex-col items-center gap-4">
              <RingProgress value={64} size={150} sublabel="da meta" color="var(--gold)" />
              <div className="grid w-full grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-secondary/50 p-3">
                  <p className="font-display text-lg font-bold tabular-nums">128.367</p>
                  <p className="text-[11px] text-muted-foreground">Km rodados</p>
                </div>
                <div className="rounded-xl bg-secondary/50 p-3">
                  <p className="font-display text-lg font-bold tabular-nums">201.628</p>
                  <p className="text-[11px] text-muted-foreground">Meta</p>
                </div>
              </div>
            </div>
          </Card>

          {/* KPIs + pódio. */}
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={Trophy} label="Premiação total" value="R$ 6.912" color="var(--leaf)" />
              <StatTile icon={TrendingUp} label="Ticket médio" value="R$ 987" color="var(--brand-navy)" />
              <StatTile icon={Star} label="Nota média" value="58" color="var(--gold)" />
              <StatTile icon={Award} label="Elegíveis" value="5 de 7" color="var(--brand-sky)" />
            </div>

            <Card title="Pódio do ciclo" icon={Trophy}>
              <div className="grid grid-cols-3 gap-3">
                {exemploOuVazio(DADOS).slice(0, 3).map((m, i) => (
                  <div
                    key={m.nome}
                    className={`rounded-xl border p-4 text-center ${i === 0 ? "border-gold-line bg-gold-tint/50" : "border-border bg-secondary/40"}`}
                  >
                    <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? "bg-gold text-white" : "bg-white text-muted-foreground"}`}>
                      {m.pos}
                    </div>
                    <p className="mt-2 truncate text-[13px] font-semibold">{m.nome}</p>
                    <p className="font-display text-lg font-bold text-leaf">{m.valor}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <Card title="Detalhamento por motorista" icon={Award} action={<Pill tone="sky">{DADOS.length} motoristas</Pill>} bodyClassName="p-4">
          <DataTable columns={COLS} rows={DADOS} />
        </Card>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}

/** Com dados de exemplo, a demonstração; ligado à API, a apuração real. */
export default function Premiacao() {
  return usandoMock() ? <PremiacaoExemplo /> : <PremiacaoReal />;
}

/* --------------------------------- Real --------------------------------- */

type Periodo = "mes_anterior" | "mes";

/**
 * Saldo à pagar, regra do Power BI (vault: indicadores-power-bi, P7).
 *
 * Só apura com período ≤ 31 dias e ≥ 6.000 km do motorista:
 *   ≥ 90 pts, ≥ 7.000 km, 1º/2º/3º   900 / 800 / 700
 *   ≥ 90 pts, ≥ 7.000 km               600
 *   ≥ 90 pts, 6.500–6.999 km           500
 *   ≥ 90 pts, 6.000–6.499 km           400
 *   ≥ 80 pts, ≥ 7.000 km               300
 *
 * A posição do pódio no BI é por instrutor; aqui é a posição geral do
 * ranking, porque a ligação motorista ↔ instrutor não está no backend. A
 * fórmula não diz a moeda, e o .pbix lido era de um cliente (Figueiredo).
 */
function saldo(m: MotoristaRankingApi, dias: number): number | null {
  const p = m.pontuacao;
  if (p == null || dias > 31 || m.km < 6000) return null;
  if (p >= 90 && m.km >= 7000) {
    const bonus = m.posicao === 1 ? 300 : m.posicao === 2 ? 200 : m.posicao === 3 ? 100 : 0;
    return 600 + bonus;
  }
  if (p >= 90 && m.km >= 6500) return 500;
  if (p >= 90) return 400;
  if (p >= 80 && m.km >= 7000) return 300;
  return 0;
}

/** Status do saldo, com os limites próprios do BI (diferentes do saldo). */
const statusSaldo = (m: MotoristaRankingApi) =>
  m.km < 7000 ? "KM abaixo" : (m.pontuacao ?? 0) >= 80 ? "Aprovado" : "Nota abaixo";

function datas(p: Periodo) {
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const ini = p === "mes" ? new Date(ontem.getFullYear(), ontem.getMonth(), 1) : new Date(ontem.getFullYear(), ontem.getMonth() - 1, 1);
  const fim = p === "mes" ? ontem : new Date(ontem.getFullYear(), ontem.getMonth(), 0);
  return { inicio: iso(ini), fim: iso(fim), dias: Math.round((fim.getTime() - ini.getTime()) / 86_400_000) + 1 };
}

const fmt = (v: number | null | undefined, casas = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

function PremiacaoReal() {
  const [periodo, setPeriodo] = useState<Periodo>("mes_anterior");
  const d = datas(periodo);
  const q = useQuery(rankingMotoristasQuery(d.inicio, d.fim));

  const linhas = useMemo(
    () =>
      (q.data?.motoristas ?? [])
        .map((m) => ({ ...m, saldo: saldo(m, d.dias), status: statusSaldo(m) }))
        .sort((a, b) => (b.saldo ?? -1) - (a.saldo ?? -1) || (b.pontuacao ?? 0) - (a.pontuacao ?? 0)),
    [q.data, d.dias],
  );
  const premiados = linhas.filter((l) => (l.saldo ?? 0) > 0);
  const total = premiados.reduce((a, l) => a + (l.saldo ?? 0), 0);
  const aprovados = linhas.filter((l) => l.status === "Aprovado").length;

  const COLS: Column<(typeof linhas)[number]>[] = [
    { key: "posicao", header: "#", align: "center", render: (l) => <span className="font-mono text-muted-foreground">{l.posicao ?? "—"}</span> },
    { key: "nome", header: "Motorista", render: (l) => <span className="font-semibold">{l.nome ?? `Motorista ${l.driver_id}`}</span> },
    { key: "pontuacao", header: "Nota", align: "center", render: (l) => <Pill tone={(l.pontuacao ?? 0) >= 90 ? "green" : (l.pontuacao ?? 0) >= 80 ? "gold" : "coral"}>{fmt(l.pontuacao, 2)}</Pill> },
    { key: "km", header: "Km", align: "right", render: (l) => <span className="font-mono">{fmt(l.km)}</span> },
    { key: "status", header: "Status", align: "center", render: (l) => <Pill tone={l.status === "Aprovado" ? "green" : "neutral"}>{l.status}</Pill> },
    { key: "saldo", header: "Saldo", align: "right", render: (l) => <span className="font-mono font-bold">{l.saldo == null ? "—" : fmt(l.saldo)}</span> },
  ];

  return (
    <>
      <PageHeader title="Premiação" subtitle={`Saldo à pagar pela regra do Power BI · ${new Date(d.inicio + "T12:00").toLocaleDateString("pt-BR")} a ${new Date(d.fim + "T12:00").toLocaleDateString("pt-BR")}`} />
      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner orb eyebrow="Equipe · Premiação" title={q.data ? `${fmt(premiados.length)} motoristas premiados` : q.isPending ? "Apurando…" : "Premiação"} subtitle="Pontuação do ranking de motoristas e a tabela de saldo do Power BI.">
          <div className="flex items-center gap-6">
            <HeroMetric value={fmt(total)} label="Saldo total" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value={fmt(q.data?.resumo.nota_media, 2)} label="Nota média" />
          </div>
        </HeroBanner>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Trophy} label="Saldo total" value={fmt(total)} color="var(--leaf)" />
          <StatTile icon={Award} label="Premiados" value={fmt(premiados.length)} color="var(--brand-navy)" />
          <StatTile icon={Star} label="Status aprovado" value={fmt(aprovados)} color="var(--gold)" />
          <StatTile icon={Truck} label="Motoristas no período" value={fmt(linhas.length)} color="var(--brand-sky)" />
        </div>

        <div className="rounded-xl border border-gold-line bg-gold-tint/40 px-4 py-3 text-[12.5px] text-gold">
          Regra do Power BI da Figueiredo (vault, P7). A fórmula não indica a moeda e o pódio é pela posição geral, não
          por instrutor. Só apura período de até 31 dias e motorista com 6.000 km ou mais.
        </div>

        <Card
          title="Apuração por motorista"
          icon={Target}
          action={
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className="h-8 rounded-full border border-border bg-white px-3 text-[12.5px]">
              <option value="mes_anterior">Mês anterior</option>
              <option value="mes">Mês atual (parcial)</option>
            </select>
          }
          bodyClassName="p-4"
        >
          {q.error ? (
            <p className="py-8 text-center text-sm text-coral">Não foi possível apurar: {(q.error as Error).message}</p>
          ) : q.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Apurando a premiação…</p>
          ) : (
            <DataTable columns={COLS} rows={linhas} />
          )}
        </Card>
      </div>
    </>
  );
}
