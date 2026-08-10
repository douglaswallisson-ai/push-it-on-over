import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import { Navigation, Plus, Radio, RefreshCw, Search, Truck, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, Dot, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { SITUACAO_LABEL, SITUACAO_TONE, nf, veiculosQuery } from "@/lib/queries";
import type { Veiculo } from "@/types";

/**
 * Veículos — cadastro/lista da frota com situação operacional e telemetria.
 * Dados reais da API (`GET /api/veiculos`).
 */

const COLS: Column<Veiculo>[] = [
  {
    key: "placa",
    header: "Veículo",
    render: (v) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-tint">
          <Truck className="h-4 w-4 text-brand-navy" />
        </div>
        <div>
          <div className="font-mono font-semibold text-foreground">{v.placa}</div>
          <div className="text-[11.5px] text-muted-foreground">
            {v.marca} {v.modelo}
            {v.ano ? ` · ${v.ano}` : ""}
          </div>
        </div>
      </div>
    ),
  },
  { key: "operacao", header: "Operação", render: (v) => <Pill tone="sky">{v.operacao}</Pill> },
  {
    key: "situacao",
    header: "Situação",
    render: (v) => (
      <span className="inline-flex items-center gap-2 text-[13px]">
        <Dot tone={SITUACAO_TONE[v.situacao] ?? "neutral"} />
        {SITUACAO_LABEL[v.situacao] ?? v.situacao}
      </span>
    ),
  },
  {
    key: "kml",
    header: "KML",
    align: "right",
    render: (v) => (
      <span className="font-mono">
        {nf(v.kml, 2)} <span className="text-muted-foreground">km/l</span>
      </span>
    ),
  },
  { key: "odometro", header: "Odômetro", align: "right", render: (v) => <span className="font-mono">{nf(v.odometro)} km</span> },
];

export default function Veiculos() {
  const navigate = useNavigate();
  const { data, isPending, error, refetch, isFetching } = useQuery(veiculosQuery(1, 50));

  const itens = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;
  const conta = (s: string) => itens.filter((v) => v.situacao === s).length;
  const kmlMedio = itens.length ? itens.reduce((a, v) => a + (v.kml ?? 0), 0) / itens.length : 0;

  return (
    <>
      <PageHeader
        title="Veículos"
        subtitle={isPending ? "Carregando frota…" : `${nf(total)} veículos na frota`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <RefreshCw className={`h-[15px] w-[15px] ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <button
              onClick={() => navigate("/app/veiculos/novo")}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-[15px] w-[15px]" />
              Novo veículo
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Frota · Veículos"
          title={`${nf(total)} veículos na operação`}
          subtitle="Situação, telemetria e consumo de cada veículo da frota."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value={nf(conta("em_rota"))} label="Em rota (amostra)" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value={nf(kmlMedio, 2)} unit="km/l" label="KML médio da amostra" />
          </div>
        </HeroBanner>

        {error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={Navigation} label="Em rota" value={nf(conta("em_rota"))} color="var(--leaf)" />
              <StatTile icon={Truck} label="Parados" value={nf(conta("parado"))} color="var(--gold)" />
              <StatTile icon={Wrench} label="Em manutenção" value={nf(conta("manutencao"))} color="var(--brand-sky)" />
              <StatTile icon={Radio} label="Sem sinal" value={nf(conta("sem_sinal"))} color="var(--coral)" />
            </div>

            <Card
              title="Frota cadastrada"
              icon={Truck}
              action={
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    placeholder="Buscar placa…"
                    className="h-9 w-44 rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
                  />
                </div>
              }
              bodyClassName="p-4"
            >
              {isPending ? (
                <SkeletonRows rows={6} />
              ) : itens.length ? (
                <DataTable columns={COLS} rows={itens} />
              ) : (
                <EmptyNote>Nenhum veículo retornado pela API.</EmptyNote>
              )}
            </Card>
          </>
        )}

        <p className="py-6 text-center text-xs text-muted-foreground">
          Exibindo os primeiros {nf(itens.length)} de {nf(total)} veículos da API.
        </p>
      </div>
    </>
  );
}
