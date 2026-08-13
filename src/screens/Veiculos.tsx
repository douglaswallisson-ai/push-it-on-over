import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import { Gauge, Navigation, Plus, Radio, RefreshCw, Search, Truck, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Dot, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { StarRating } from "@/components/ss/ui/gauges";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { SITUACAO_LABEL, SITUACAO_TONE, kanbanManutencaoQuery, nf, veiculosQuery } from "@/lib/queries";
import { MOCK_INDICADORES_VEICULO, faixasDoVeiculo } from "@/lib/mock-data";
import { escopoGaragens, filtrarPorGaragem } from "@/lib/escopo";
import { useSessao } from "@/hooks/use-sessao";
import { FaixasConducao } from "@/components/ss/frota/FaixasConducao";
import { cn } from "@/lib/utils";
import type { CardManutencao, IndicadoresConducao, Veiculo } from "@/types";

/**
 * Veículos — lista da frota com situação, consumo, os mesmos indicadores de
 * condução usados na tela de Motoristas e o alerta de manutenção da placa.
 *
 * Os indicadores usam o componente `StarRating`, o mesmo de Motoristas: se a
 * escala divergisse entre as duas telas, o número perderia credibilidade.
 *
 * Atalhos: o KPI "Sem sinal" leva à telemetria de equipamentos; a coluna de
 * manutenção leva ao kanban já filtrado naquela placa.
 */

type Linha = Veiculo &
  Partial<IndicadoresConducao> & {
    manutencao?: CardManutencao;
  } & Record<string, unknown>;

const HEADERS: Record<string, string> = {
  iv: "Início faixa verde",
  ae: "Aproveit. de embalo",
  mp: "Motor ligado parado",
  av: "Acel. acima do verde",
  pa: "Piloto automático",
  ev: "Excesso de velocidade",
  fm: "Freio motor",
  pac: "Pressão do acelerador",
};

const stars = (key: keyof IndicadoresConducao): Column<Linha> => ({
  key: key as string,
  header: HEADERS[key as string],
  align: "center",
  render: (v) => <StarRating value={(v[key] as number | null) ?? null} />,
});

const STATUS_TONE: Record<string, PillTone> = {
  em_dia: "green",
  preditiva: "sky",
  preventiva: "gold",
  corretiva: "coral",
  liberado: "neutral",
};

/**
 * O que a gestão de veículos precisa ler não é o tipo da manutenção, e sim o
 * que fazer com o veículo agora: ele está parado na oficina, liberado para
 * rodar, ou precisa de agendamento?
 */
const ACAO_LABEL: Record<string, string> = {
  em_dia: "Liberado",
  preditiva: "Agendar manutenção",
  preventiva: "Agendar manutenção",
  corretiva: "Em manutenção",
  liberado: "Liberado de manutenção",
};

const STATUS_LABEL: Record<string, string> = {
  em_dia: "Em dia",
  preditiva: "Preditiva",
  preventiva: "Preventiva",
  corretiva: "Corretiva",
  liberado: "Liberado",
};

export default function Veiculos() {
  const navigate = useNavigate();
  const { data, isPending, error, refetch, isFetching } = useQuery(veiculosQuery(1, 50));
  const kanbanQ = useQuery(kanbanManutencaoQuery());
  const [busca, setBusca] = useState("");
  const [faixasDe, setFaixasDe] = useState<string | null>(null);
  const { sessao } = useSessao();

  // O escopo de garagem é aplicado antes de qualquer contagem: os KPIs precisam
  // refletir o que a pessoa pode ver, não a frota inteira.
  const itens = useMemo(
    () => filtrarPorGaragem(data?.items ?? [], sessao, (v) => v.garagemId),
    [data, sessao],
  );
  const total = itens.length;

  const linhas: Linha[] = useMemo(() => {
    const porVeiculo = new Map((kanbanQ.data ?? []).map((c) => [c.veiculoId, c]));
    const termo = busca.trim().toLowerCase();
    return itens
      .map((v) => ({
        ...v,
        ...(MOCK_INDICADORES_VEICULO[v.id] ?? {}),
        manutencao: porVeiculo.get(v.id),
      }))
      .filter((v) =>
        termo
          ? v.placa.toLowerCase().includes(termo) ||
            `${v.marca} ${v.modelo}`.toLowerCase().includes(termo)
          : true,
      ) as Linha[];
  }, [itens, kanbanQ.data, busca]);

  const conta = (s: string) => itens.filter((v) => v.situacao === s).length;
  const kmlMedio = itens.length ? itens.reduce((a, v) => a + (v.kml ?? 0), 0) / itens.length : 0;

  const COLS: Column<Linha>[] = [
    {
      key: "placa",
      header: "Veículo",
      render: (v) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-tint">
            <Truck className="h-4 w-4 text-brand-navy" />
          </div>
          <div>
            <div className="whitespace-nowrap font-mono font-semibold text-foreground">{v.placa}</div>
            <div className="whitespace-nowrap text-[11.5px] text-muted-foreground">
              {v.marca} {v.modelo}
              {v.ano ? ` · ${v.ano}` : ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "situacao",
      header: "Situação",
      render: (v) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px]">
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
        <span className="whitespace-nowrap font-mono">
          {nf(v.kml, 2)} <span className="text-muted-foreground">km/l</span>
        </span>
      ),
    },
    {
      key: "odometro",
      header: "Odômetro",
      align: "right",
      render: (v) => <span className="whitespace-nowrap font-mono">{nf(v.odometro)} km</span>,
    },
    stars("iv"),
    stars("ae"),
    stars("mp"),
    stars("av"),
    stars("pa"),
    stars("ev"),
    stars("fm"),
    stars("pac"),
    {
      key: "faixas",
      header: "Faixas",
      align: "center",
      render: (v) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setFaixasDe(faixasDe === v.id ? null : v.id);
          }}
          title="Ver distribuição por faixas de condução"
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[11.5px] font-medium transition-colors",
            faixasDe === v.id
              ? "border-brand-navy bg-navy-tint text-brand-navy"
              : "border-border text-muted-foreground hover:bg-secondary",
          )}
        >
          <Gauge className="h-3.5 w-3.5" />
          ver
        </button>
      ),
    },
    {
      key: "manutencao",
      header: "Manutenção",
      align: "center",
      render: (v) => {
        const m = v.manutencao;
        if (!m) return <span className="text-muted-foreground">—</span>;
        const atrasado = (m.prazoDias ?? 0) < 0;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/app/frota/manutencao?placa=${v.placa}`);
            }}
            title={`${m.servico} — abrir manutenção desta placa`}
            className="inline-flex items-center gap-1.5 rounded-full transition-transform hover:-translate-y-0.5"
          >
            <Pill tone={STATUS_TONE[m.status] ?? "neutral"}>
              <Wrench className="h-3 w-3" />
              {ACAO_LABEL[m.status] ?? STATUS_LABEL[m.status] ?? m.status}
              {atrasado && <span className="ml-0.5 font-bold">!</span>}
            </Pill>
          </button>
        );
      },
    },
  ];

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
              <RefreshCw className={cn("h-[15px] w-[15px]", isFetching && "animate-spin")} />
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

      <div className="mx-auto max-w-[1600px] space-y-6 px-6 py-6 md:px-8">
        {/* Sem garagem atribuída a lista fica vazia; dizer o porquê evita que
            pareça erro do sistema. */}
        {escopoGaragens(sessao)?.length === 0 && (
          <div className="rounded-xl border border-gold-line bg-gold-tint/50 px-4 py-3 text-[13px] text-gold">
            <strong>Nenhuma garagem atribuída ao seu usuário.</strong> Por isso não há veículos nesta lista. Peça ao
            administrador da sua organização para vincular ao menos uma garagem ao seu acesso.
          </div>
        )}

        {error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile icon={Navigation} label="Em rota" value={nf(conta("em_rota"))} color="var(--leaf)" />
              <StatTile icon={Truck} label="Parados" value={nf(conta("parado"))} color="var(--gold)" />
              <StatTile
                icon={Wrench}
                label="Em manutenção"
                value={nf(conta("manutencao"))}
                color="var(--brand-sky)"
                to="/app/frota/manutencao"
              />
              <StatTile
                icon={Radio}
                label="Sem sinal"
                value={nf(conta("sem_sinal"))}
                color="var(--coral)"
                to="/app/frota/telemetria"
              />
              <StatTile icon={Navigation} label="KML médio" value={nf(kmlMedio, 2)} unit="km/l" color="var(--brand-navy)" />
            </div>

            <Card
              title="Frota cadastrada"
              icon={Truck}
              action={
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar placa ou modelo…"
                    className="h-9 w-52 rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
                  />
                </div>
              }
              bodyClassName="p-4"
            >
              {isPending ? (
                <SkeletonRows rows={6} />
              ) : linhas.length ? (
                <DataTable
                  columns={COLS}
                  rows={linhas}
                  onRowClick={(v) => navigate(`/app/frota/manutencao?placa=${v.placa}`)}
                />
              ) : (
                <EmptyNote>Nenhum veículo encontrado com esse filtro.</EmptyNote>
              )}
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                Indicadores na mesma escala da tela de Motoristas (0 a 5 estrelas). Clique na linha para abrir a
                manutenção da placa.
              </p>
            </Card>

            {faixasDe && (
              <FaixasConducao
                distribuicao={faixasDoVeiculo(faixasDe)}
                titulo={`Faixas de condução — ${linhas.find((l) => l.id === faixasDe)?.placa ?? ""}`}
                subtitulo="Distribuição do tempo deste veículo nas 14 faixas, na mesma leitura usada em frota e motorista."
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
