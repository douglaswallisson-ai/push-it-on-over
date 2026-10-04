import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bus,
  Download,
  Fuel,
  Gauge,
  Info,
  Minus,
  Route,
  TrendingDown,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { SeloDadosExemplo } from "@/components/ss/ui/SeloDadosExemplo";
import { Card, DataTable, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { Sparkline } from "@/components/ss/ui/Sparkline";
import { indicadoresApiQuery, indicadoresSerieQuery, nf } from "@/lib/queries";
import { usandoMock } from "@/lib/modo";
import { calcularIndicadores, variacao } from "@/lib/operacao";
import { exportarCSV } from "@/lib/export";
import { CATEGORIA_CUSTO_LABEL, type CategoriaCusto, type IndicadoresPeriodo } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Indicadores gerenciais.
 *
 * Reúne os números que o setor de transporte de passageiros usa para decidir —
 * CPK, IPK, MKBF, custo por passageiro — e que o sistema não calculava. Todos
 * vêm de `calcularIndicadores`, ponto único: o mesmo indicador em duas telas
 * com dois cálculos diferentes é o caminho mais rápido para perder a confiança
 * do gestor.
 *
 * O comparativo entre dois períodos é o formato em que a informação é
 * consumida: número isolado não diz se a operação melhorou.
 */

const mesLabel = (p: string) => {
  const [a, m] = p.split("-");
  return new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
};

const brl = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Seta de variação com a semântica correta por indicador. */
function Variacao({
  atual,
  anterior,
  melhorQuando,
  sufixo = "%",
}: {
  atual: number;
  anterior: number;
  melhorQuando: "maior" | "menor";
  sufixo?: string;
}) {
  const { pct, bom } = variacao(atual, anterior, melhorQuando);
  const Icone = Math.abs(pct) < 0.05 ? Minus : pct > 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-[12px] font-semibold",
        bom === null ? "text-muted-foreground" : bom ? "text-leaf" : "text-coral",
      )}
      title={bom === null ? "Estável" : bom ? "Evolução favorável" : "Evolução desfavorável"}
    >
      <Icone className="h-3 w-3" />
      {pct > 0 ? "+" : ""}
      {pct.toFixed(2)}
      {sufixo}
    </span>
  );
}

/** Cartão de indicador com histórico e variação. */
function KpiCard({
  icon: Icone,
  label,
  valor,
  unidade,
  descricao,
  serie,
  atual,
  anterior,
  melhorQuando,
  cor,
}: {
  icon: typeof Gauge;
  label: string;
  valor: string;
  unidade?: string;
  descricao: string;
  serie: number[];
  atual: number;
  anterior: number;
  melhorQuando: "maior" | "menor";
  cor: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `color-mix(in oklab, ${cor} 14%, white)` }}>
            <Icone className="h-4 w-4" style={{ color: cor }} />
          </span>
          <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </span>
        </span>
        <Variacao atual={atual} anterior={anterior} melhorQuando={melhorQuando} />
      </div>

      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span className="font-display text-[24px] font-bold leading-none text-foreground">{valor}</span>
        {unidade && <span className="text-[12px] text-muted-foreground">{unidade}</span>}
      </div>

      <p className="mt-1 text-[12px] leading-tight text-muted-foreground">{descricao}</p>

      <div className="mt-2.5">
        <Sparkline data={serie} color={cor} width={220} height={28} />
      </div>
    </div>
  );
}

export default function IndicadoresGerenciais() {
  const mockQ = useQuery(indicadoresSerieQuery());

  // Janela dos últimos 30 dias, que é o recorte usual de fechamento.
  const hoje = new Date();
  const trintaDias = new Date(hoje.getTime() - 30 * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const apiQ = useQuery(indicadoresApiQuery(iso(trintaDias), iso(hoje)));

  /**
   * O backend devolve o consolidado calculado e declara o que não conseguiu
   * calcular. Exibir essa lista é parte do contrato: sem ela, o gestor
   * procuraria CPK numa tela que não tem como calculá-lo.
   */
  const daApi = apiQ.data as
    | {
        current: Record<string, number>;
        previous?: Record<string, number> | null;
        unavailable: string[];
        unavailable_reason: string;
      }
    | undefined;

  const { data, isPending, error, refetch } = usandoMock() ? mockQ : { ...apiQ, data: mockQ.data };
  const serie = useMemo(() => data ?? [], [data]);

  const [idxAtual, setIdxAtual] = useState<number | null>(null);

  const iAtual = idxAtual ?? Math.max(0, serie.length - 1);
  const iAnterior = Math.max(0, iAtual - 1);

  const pAtual = serie[iAtual];
  const pAnterior = serie[iAnterior];

  if (error) {
    return (
      <>
        <PageHeader title="Indicadores" subtitle="Gerencial" />
        <div className="mx-auto max-w-[1360px] px-6 py-6">
          <ErrorBox error={error} onRetry={() => refetch()} />
        </div>
      </>
    );
  }

  if (isPending || !pAtual) {
    return (
      <>
        <PageHeader title="Indicadores" subtitle="Gerencial" />
        <div className="mx-auto max-w-[1360px] px-6 py-6">
          <Card title="Carregando" icon={Gauge}>
            <SkeletonRows rows={6} />
          </Card>
        </div>
      </>
    );
  }

  const A = calcularIndicadores(pAtual);
  const B = calcularIndicadores(pAnterior);
  const serieDe = (fn: (p: IndicadoresPeriodo) => number) => serie.map(fn);

  /* Comparativo — o formato em que o gestor consome. */
  type LinhaComp = {
    indicador: string;
    anterior: string;
    atual: string;
    vAtual: number;
    vAnterior: number;
    melhorQuando: "maior" | "menor";
    nota?: string;
  };

  const COMPARATIVO: LinhaComp[] = [
    { indicador: "Frota ativa", anterior: nf(pAnterior.frotaAtiva), atual: nf(pAtual.frotaAtiva), vAtual: pAtual.frotaAtiva, vAnterior: pAnterior.frotaAtiva, melhorQuando: "maior", nota: "veículos que rodaram" },
    { indicador: "Quilometragem rodada", anterior: `${nf(pAnterior.kmRodado)} km`, atual: `${nf(pAtual.kmRodado)} km`, vAtual: pAtual.kmRodado, vAnterior: pAnterior.kmRodado, melhorQuando: "maior" },
    { indicador: "Passageiros transportados", anterior: nf(pAnterior.passageiros), atual: nf(pAtual.passageiros), vAtual: pAtual.passageiros, vAnterior: pAnterior.passageiros, melhorQuando: "maior" },
    { indicador: "Consumo de diesel", anterior: `${nf(pAnterior.litrosDiesel)} L`, atual: `${nf(pAtual.litrosDiesel)} L`, vAtual: pAtual.litrosDiesel, vAnterior: pAnterior.litrosDiesel, melhorQuando: "menor" },
    { indicador: "Consumo de energia elétrica", anterior: `${nf(pAnterior.kwh)} kWh`, atual: `${nf(pAtual.kwh)} kWh`, vAtual: pAtual.kwh, vAnterior: pAnterior.kwh, melhorQuando: "maior", nota: "frota elétrica em expansão" },
    { indicador: "Custo total operacional", anterior: brl(B.custoTotal, 0), atual: brl(A.custoTotal, 0), vAtual: A.custoTotal, vAnterior: B.custoTotal, melhorQuando: "menor" },
    { indicador: "Custo por passageiro", anterior: brl(B.custoPorPassageiro), atual: brl(A.custoPorPassageiro), vAtual: A.custoPorPassageiro, vAnterior: B.custoPorPassageiro, melhorQuando: "menor" },
    { indicador: "CPK — custo por km", anterior: brl(B.cpk), atual: brl(A.cpk), vAtual: A.cpk, vAnterior: B.cpk, melhorQuando: "menor" },
    { indicador: "CPK peças", anterior: brl(B.cpkPecas), atual: brl(A.cpkPecas), vAtual: A.cpkPecas, vAnterior: B.cpkPecas, melhorQuando: "menor" },
    { indicador: "IPK — passageiros por km", anterior: B.ipk.toFixed(2), atual: A.ipk.toFixed(2), vAtual: A.ipk, vAnterior: B.ipk, melhorQuando: "maior" },
    { indicador: "MKBF — km entre falhas", anterior: nf(Math.round(B.mkbf)), atual: nf(Math.round(A.mkbf)), vAtual: A.mkbf, vAnterior: B.mkbf, melhorQuando: "maior" },
    { indicador: "MTTR — tempo médio de reparo", anterior: `${B.mttrHoras.toFixed(1)} h`, atual: `${A.mttrHoras.toFixed(1)} h`, vAtual: A.mttrHoras, vAnterior: B.mttrHoras, melhorQuando: "menor" },
    { indicador: "Disponibilidade da frota", anterior: `${B.disponibilidade.toFixed(1)}%`, atual: `${A.disponibilidade.toFixed(1)}%`, vAtual: A.disponibilidade, vAnterior: B.disponibilidade, melhorQuando: "maior" },
    { indicador: "Eficiência de programação", anterior: `${B.eficienciaProgramacao.toFixed(1)}%`, atual: `${A.eficienciaProgramacao.toFixed(1)}%`, vAtual: A.eficienciaProgramacao, vAnterior: B.eficienciaProgramacao, melhorQuando: "maior" },
    { indicador: "Cobertura de km", anterior: `${B.coberturaKmPct.toFixed(1)}%`, atual: `${A.coberturaKmPct.toFixed(1)}%`, vAtual: A.coberturaKmPct, vAnterior: B.coberturaKmPct, melhorQuando: "maior", nota: "rodado dentro de itinerário" },
    { indicador: "Score de condução", anterior: `${B.eventosPor100km.toFixed(1)}`, atual: `${A.eventosPor100km.toFixed(1)}`, vAtual: A.eventosPor100km, vAnterior: B.eventosPor100km, melhorQuando: "menor", nota: "eventos por 100 km" },
  ];

  const COLS_COMP: Column<LinhaComp & Record<string, unknown>>[] = [
    {
      key: "indicador",
      header: "Indicador",
      render: (l) => (
        <div>
          <div className="text-[13px] font-medium text-foreground">{l.indicador}</div>
          {l.nota && <div className="text-[12px] text-muted-foreground">{l.nota}</div>}
        </div>
      ),
    },
    { key: "anterior", header: mesLabel(pAnterior.periodo), align: "right", render: (l) => <span className="font-mono text-[13px] text-muted-foreground">{l.anterior}</span> },
    { key: "atual", header: mesLabel(pAtual.periodo), align: "right", render: (l) => <span className="font-mono text-[13px] font-semibold text-foreground">{l.atual}</span> },
    { key: "var", header: "Variação", align: "right", render: (l) => <Variacao atual={l.vAtual} anterior={l.vAnterior} melhorQuando={l.melhorQuando} /> },
  ];

  /* Composição do CPK — o número isolado não indica onde agir. */
  const categorias = Object.entries(pAtual.custoPorCategoria) as [CategoriaCusto, number][];
  const composicao = categorias
    .map(([cat, valor]) => ({
      cat,
      valor,
      cpk: pAtual.kmRodado ? valor / pAtual.kmRodado : 0,
      pct: A.custoTotal ? (valor / A.custoTotal) * 100 : 0,
      anteriorCpk: pAnterior.kmRodado ? (pAnterior.custoPorCategoria[cat] ?? 0) / pAnterior.kmRodado : 0,
    }))
    .sort((a, b) => b.valor - a.valor);

  const CORES: Record<CategoriaCusto, string> = {
    combustivel: "var(--brand-navy)",
    energia: "var(--brand-sky)",
    pecas: "var(--coral)",
    mao_obra: "var(--gold)",
    pneus: "#7B3FA0",
    terceiros: "var(--leaf)",
    outros: "#8A9199",
  };

  return (
    <>
      <PageHeader
        title="Indicadores"
        subtitle="Gerencial › Painel de indicadores"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={iAtual}
              onChange={(e) => setIdxAtual(Number(e.target.value))}
              className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
            >
              {serie.map((p, i) => (
                <option key={p.periodo} value={i} disabled={i === 0}>
                  {mesLabel(p.periodo)}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                const n = exportarCSV(
                  COMPARATIVO,
                  [
                    { cabecalho: "Indicador", valor: (l) => l.indicador },
                    { cabecalho: mesLabel(pAnterior.periodo), valor: (l) => l.anterior },
                    { cabecalho: mesLabel(pAtual.periodo), valor: (l) => l.atual },
                    { cabecalho: "Variação %", valor: (l) => variacao(l.vAtual, l.vAnterior, l.melhorQuando).pct.toFixed(2) },
                  ],
                  `indicadores-${pAtual.periodo}`,
                );
                toast.success(`${n} indicadores exportados.`);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              <Download className="h-[15px] w-[15px]" />
              Exportar
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-5 px-6 py-6 md:px-8">
        {!usandoMock() && daApi && (
          <>
            {/* O que o backend conseguiu calcular. */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={Fuel} label="KM/L" value={String(daApi.current.kml ?? 0)} color="var(--brand-navy)" />
              <StatTile icon={Wrench} label="MKBF" value={nf(daApi.current.mkbf ?? 0)} unit="km" color="var(--gold)" />
              <StatTile
                icon={Activity}
                label="Ociosidade"
                value={`${daApi.current.idle_pct ?? 0}%`}
                color={(daApi.current.idle_pct ?? 0) > 20 ? "var(--coral)" : "var(--leaf)"}
                foot="motor ligado sem rodar"
              />
              <StatTile
                icon={TrendingDown}
                label="Eventos por 100 km"
                value={String(daApi.current.events_per_100km ?? 0)}
                color="var(--brand-sky)"
                foot="normalizado pela distância"
              />
            </div>

            {daApi.unavailable.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-gold-line bg-gold-tint/40 px-4 py-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p className="text-[13px] text-gold">
                  <strong>{daApi.unavailable.join(", ").toUpperCase()} não podem ser calculados.</strong>{" "}
                  {daApi.unavailable_reason} Os cartões abaixo continuam com dados de exemplo.
                </p>
              </div>
            )}
          </>
        )}
        <SeloDadosExemplo motivo="CPK, IPK e MKBF são cálculo sobre a base histórica e ainda não foram desenvolvidos. Os insumos existem em con_telemetry." />

        {/* Os quatro indicadores de abertura do setor. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Fuel} label="KM/L" valor={A.kml.toFixed(2)} descricao="Consumo de combustível"
            serie={serieDe((p) => calcularIndicadores(p).kml)} atual={A.kml} anterior={B.kml}
            melhorQuando="maior" cor="var(--brand-navy)"
          />
          <KpiCard
            icon={Users} label="IPK" valor={A.ipk.toFixed(2)} descricao="Passageiros por quilômetro"
            serie={serieDe((p) => calcularIndicadores(p).ipk)} atual={A.ipk} anterior={B.ipk}
            melhorQuando="maior" cor="var(--leaf)"
          />
          <KpiCard
            icon={TrendingDown} label="CPK peças" valor={brl(A.cpkPecas)} descricao="Custo de peças por quilômetro"
            serie={serieDe((p) => calcularIndicadores(p).cpkPecas)} atual={A.cpkPecas} anterior={B.cpkPecas}
            melhorQuando="menor" cor="var(--coral)"
          />
          <KpiCard
            icon={Wrench} label="MKBF" valor={nf(Math.round(A.mkbf))} descricao="Quilômetros entre falhas"
            serie={serieDe((p) => calcularIndicadores(p).mkbf)} atual={A.mkbf} anterior={B.mkbf}
            melhorQuando="maior" cor="var(--gold)"
          />
        </div>

        {/* Segunda linha: manutenção e programação. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Bus} label="Disponibilidade" valor={`${A.disponibilidade.toFixed(1)}%`} descricao="Frota disponível para escala"
            serie={serieDe((p) => calcularIndicadores(p).disponibilidade)} atual={A.disponibilidade} anterior={B.disponibilidade}
            melhorQuando="maior" cor="var(--brand-sky)"
          />
          <KpiCard
            icon={Activity} label="MTTR" valor={`${A.mttrHoras.toFixed(1)}`} unidade="h" descricao="Tempo médio de reparo"
            serie={serieDe((p) => calcularIndicadores(p).mttrHoras)} atual={A.mttrHoras} anterior={B.mttrHoras}
            melhorQuando="menor" cor="#7B3FA0"
          />
          <KpiCard
            icon={Route} label="Cobertura de km" valor={`${A.coberturaKmPct.toFixed(1)}%`} descricao="Rodado dentro de itinerário"
            serie={serieDe((p) => calcularIndicadores(p).coberturaKmPct)} atual={A.coberturaKmPct} anterior={B.coberturaKmPct}
            melhorQuando="maior" cor="var(--leaf)"
          />
          <KpiCard
            icon={Zap} label="kWh/km" valor={A.kwhPorKm.toFixed(3)} descricao="Consumo da frota elétrica"
            serie={serieDe((p) => calcularIndicadores(p).kwhPorKm)} atual={A.kwhPorKm} anterior={B.kwhPorKm}
            melhorQuando="menor" cor="var(--gold)"
          />
        </div>

        {/* Comparativo. */}
        <Card
          title={`Comparativo — ${mesLabel(pAnterior.periodo)} × ${mesLabel(pAtual.periodo)}`}
          icon={Gauge}
          action={<Pill tone="sky">{COMPARATIVO.length} indicadores</Pill>}
          bodyClassName="p-4"
        >
          <DataTable columns={COLS_COMP} rows={COMPARATIVO as (LinhaComp & Record<string, unknown>)[]} />
          <p className="mt-3 text-[12px] text-muted-foreground">
            A cor da variação considera a direção desejada de cada indicador: queda no CPK é favorável, queda no IPK
            não é.
          </p>
        </Card>

        {/* Composição do CPK. */}
        <Card
          title="Composição do custo por quilômetro"
          icon={TrendingDown}
          action={<Pill tone="neutral">CPK total {brl(A.cpk)}</Pill>}
          bodyClassName="p-4"
        >
          <div className="mb-4 flex h-3 w-full overflow-hidden rounded-full border border-border">
            {composicao.map((c) => (
              <span
                key={c.cat}
                style={{ width: `${c.pct}%`, background: CORES[c.cat] }}
                title={`${CATEGORIA_CUSTO_LABEL[c.cat]}: ${c.pct.toFixed(1)}%`}
                className="h-full border-r border-white/40 last:border-r-0"
              />
            ))}
          </div>

          {composicao.length ? (
            <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {composicao.map((c) => {
                const v = variacao(c.cpk, c.anteriorCpk, "menor");
                return (
                  <li key={c.cat} className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CORES[c.cat] }} />
                    <span className="flex-1 truncate text-[13px] text-ink-soft">{CATEGORIA_CUSTO_LABEL[c.cat]}</span>
                    <span className="shrink-0 font-mono text-[13px] text-muted-foreground">{c.pct.toFixed(1)}%</span>
                    <span className="w-20 shrink-0 text-right font-mono text-[13px] font-semibold text-foreground">
                      {brl(c.cpk)}
                    </span>
                    <span
                      className={cn(
                        "w-14 shrink-0 text-right font-mono text-[12px]",
                        v.bom === null ? "text-muted-foreground" : v.bom ? "text-leaf" : "text-coral",
                      )}
                    >
                      {v.pct > 0 ? "+" : ""}
                      {v.pct.toFixed(1)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyNote>Sem lançamentos de custo no período.</EmptyNote>
          )}

          <p className="mt-3 text-[12px] text-muted-foreground">
            O CPK isolado não indica onde agir. A decisão de renovar frota ou trocar fornecedor depende de saber qual
            categoria está puxando o número.
          </p>
        </Card>
      </div>
    </>
  );
}
