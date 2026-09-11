import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import { ChevronLeft, ChevronRight, Gauge, Info, Navigation, Plus, Radio, RefreshCw, Search, Truck, Wrench, X } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Dot, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { StarRating } from "@/components/ss/ui/gauges";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { SITUACAO_LABEL, SITUACAO_TONE, kanbanManutencaoQuery, nf, veiculosApiQuery, veiculosQuery } from "@/lib/queries";
import { MOCK_INDICADORES_VEICULO, faixasDoVeiculo } from "@/lib/mock-data";
import { escopoGaragens, filtrarPorGaragem } from "@/lib/escopo";
import { useSessao } from "@/hooks/use-sessao";
import { FaixasConducao } from "@/components/ss/frota/FaixasConducao";
import { FiltroGaragem } from "@/components/ss/ui/FiltroGaragem";
import { usandoMock } from "@/lib/modo";
import { notaDePercentual, useIndicadoresPorVeiculo } from "@/hooks/use-indicadores-veiculo";
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
  const mockQ = useQuery(veiculosQuery(1, 50));
  const apiQ = useQuery(veiculosApiQuery(1, 200));

  /**
   * Fonte trocada num ponto só: colunas, filtros e cálculos abaixo não sabem de
   * onde veio o dado, porque o mapeamento devolve o mesmo formato do exemplo.
   */
  /**
   * Indicadores da telemetria do período, cruzados com o cadastro.
   *
   * O `/vehicles` entrega só a ficha; consumo, odômetro atual e condução vêm
   * de con_telemetry. O cruzamento acontece aqui para as colunas deixarem de
   * mostrar traço.
   */
  // Ids da frota carregada, para a telemetria consultar só esses veículos.
  const idsDaFrota = useMemo(
    () => (usandoMock() ? [] : (apiQ.data?.items ?? []).map((v) => v.id)),
    [apiQ.data],
  );

  const indicadores = useIndicadoresPorVeiculo(30, idsDaFrota);

  const fonte = usandoMock() ? mockQ : apiQ;
  const { data, isPending, error, refetch, isFetching } = fonte;
  const kanbanQ = useQuery(kanbanManutencaoQuery());
  const [busca, setBusca] = useState("");
  const [faixasDe, setFaixasDe] = useState<string | null>(null);
  const { sessao } = useSessao();
  const [garagem, setGaragem] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [operacao, setOperacao] = useState("");
  const [situacao, setSituacao] = useState("");
  const [pagina, setPagina] = useState(1);
  const porPagina = 15;

  // O escopo de garagem é aplicado antes de qualquer contagem: os KPIs precisam
  // refletir o que a pessoa pode ver, não a frota inteira.
  const itens = useMemo(() => {
    // Cadastro enriquecido com o que a telemetria mediu no período.
    const comIndicadores = (data?.items ?? []).map((v) => {
      const ind = indicadores.porVeiculo.get(v.id);
      if (!ind) return v;
      return {
        ...v,
        kml: ind.kml ?? v.kml,
        odometro: ind.odometro ?? v.odometro,
        // Estrelas na mesma escala da tela de motoristas. Faixa verde e
        // aproveitamento de embalo são "quanto maior melhor"; motor ligado
        // parado é o contrário, e por isso inverte.
        ae: notaDePercentual(ind.faixaVerdePct),
        mp: notaDePercentual(ind.motorLigadoParadoPct, false),
        _ind: ind,
      };
    });

    const noEscopo = filtrarPorGaragem(comIndicadores, sessao, (v) => v.garagemId);
    return garagem ? noEscopo.filter((v) => v.garagemId === garagem) : noEscopo;
  }, [data, sessao, garagem]);
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
      .filter((v) => {
        if (marca && v.marca !== marca) return false;
        if (modelo && v.modelo !== modelo) return false;
        if (operacao && v.operacao !== operacao) return false;
        if (situacao && v.situacao !== situacao) return false;
        if (!termo) return true;
        return (
          v.placa.toLowerCase().includes(termo) ||
          (v.prefixo ?? "").toLowerCase().includes(termo) ||
          `${v.marca} ${v.modelo}`.toLowerCase().includes(termo)
        );
      }) as Linha[];
  }, [itens, kanbanQ.data, busca, marca, modelo, operacao, situacao, indicadores.porVeiculo]);

  // Opções derivadas do que existe na frota — lista fixa envelheceria.
  const marcas = useMemo(() => [...new Set(itens.map((v) => v.marca))].sort(), [itens]);
  const modelos = useMemo(
    () => [...new Set(itens.filter((v) => !marca || v.marca === marca).map((v) => v.modelo))].sort(),
    [itens, marca],
  );
  const operacoes = useMemo(() => [...new Set(itens.map((v) => v.operacao))].sort(), [itens]);

  const totalPaginas = Math.max(1, Math.ceil(linhas.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = useMemo(
    () => linhas.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina),
    [linhas, paginaAtual],
  );
  const limparFiltros = () => {
    setMarca(""); setModelo(""); setOperacao(""); setSituacao(""); setBusca(""); setPagina(1);
  };
  const filtrosAtivos = [marca, modelo, operacao, situacao, busca].filter(Boolean).length;

  const conta = (s: string) => itens.filter((v) => v.situacao === s).length;
  /**
   * Média apenas dos veículos com medição.
   *
   * Incluir quem não tem dado como zero puxaria a média para baixo e faria a
   * frota parecer pior do que é — com 200 veículos sem telemetria cruzada, a
   * média daria quase zero.
   */
  const comKml = linhas.filter((v) => v.kml != null);
  const kmlMedio = comKml.length ? comKml.reduce((a, v) => a + (v.kml ?? 0), 0) / comKml.length : null;

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
            {/* Prefixo na frente: é como a operação chama o carro. A placa é
                documento e fica como apoio. */}
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="font-mono text-[14px] font-bold text-foreground">{v.prefixo ?? "—"}</span>
              <span className="font-mono text-[11.5px] text-muted-foreground">{v.placa}</span>
            </div>
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
          {v.kml != null ? (<>{nf(v.kml, 2)} <span className="text-muted-foreground">km/l</span></>) : (<span className="text-muted-foreground">—</span>)}
        </span>
      ),
    },
    {
      key: "odometro",
      header: "Odômetro",
      align: "right",
      render: (v) => <span className="whitespace-nowrap font-mono">{v.odometro != null ? nf(v.odometro) : "—"} km</span>,
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
              navigate(`/app/manutencao?placa=${v.placa}`);
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
        {/* O aviso só faz sentido em modo de exemplo: ligado à API, o escopo
            é aplicado pelo servidor e a lista vazia significa outra coisa —
            filtro sem resultado, ou acesso sem veículos. Culpar a garagem ali
            mandaria o usuário pedir um acesso que ele já tem. */}
        {/* Declara a base do cálculo: sem saber quantas viagens entraram, o
            gestor não tem como julgar se o número é representativo. */}
        {!usandoMock() && (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
              {indicadores.erro ? (
                /* O erro precisa aparecer: sem ele, "não funciona" vira adivinhação.
                   403 é permissão, 404 é endpoint ausente, 422 é parâmetro
                   rejeitado — três causas com soluções diferentes. */
                <span className="text-coral">
                  <strong>Não foi possível ler a telemetria.</strong>{" "}
                  {(indicadores.erro as { status?: number; message?: string })?.status === 403
                    ? "Permissão negada em /reports — falta reports.read."
                    : (indicadores.erro as { status?: number })?.status === 404
                      ? "Endpoint não publicado no servidor."
                      : (indicadores.erro as { message?: string })?.message ?? "Erro desconhecido."}
                </span>
              ) : indicadores.carregando ? (
                <span>Cruzando a frota com a telemetria dos últimos 30 dias…</span>
              ) : comKml.length > 0 ? (
                <span>
                  Consumo e condução calculados sobre{" "}
                  <strong className="text-foreground">{nf(indicadores.viagensAnalisadas)} viagens</strong> dos últimos
                  30 dias, ponderado pela distância.
                  {indicadores.viagensDescartadas > 0 && (
                    <>
                      {" "}
                      <strong className="text-gold">
                        {nf(indicadores.viagensDescartadas)} descartadas
                      </strong>{" "}
                      por leitura impossível — distância negativa por estouro de odômetro, ou velocidade acima de
                      300 km/h. Mantê-las somaria milhões de quilômetros que não existiram.
                    </>
                  )}
                </span>
              ) : (
                <span>
                  <strong className="text-foreground">Nenhuma viagem no período.</strong> Placa, prefixo e modelo vêm
                  do cadastro; consumo e condução dependem de telemetria, e a frota não registrou viagens nos últimos
                  30 dias.
                </span>
              )}
            </p>

            {indicadores.parcial && (
              <button
                onClick={() => indicadores.carregarMais()}
                disabled={indicadores.carregandoMais}
                className="shrink-0 rounded-full border border-border bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-brand-navy hover:bg-secondary disabled:opacity-60"
              >
                {indicadores.carregandoMais ? "Carregando…" : "Carregar mais viagens"}
              </button>
            )}
          </div>
        )}

        {usandoMock() && escopoGaragens(sessao)?.length === 0 && (
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
                to="/app/manutencao"
              />
              <StatTile
                icon={Radio}
                label="Sem sinal"
                value={nf(conta("sem_sinal"))}
                color="var(--coral)"
                to="/app/frota/telemetria"
              />
              <StatTile
                icon={Navigation}
                label="KML médio"
                value={kmlMedio != null ? nf(kmlMedio, 2) : "—"}
                unit={kmlMedio != null ? "km/l" : undefined}
                color="var(--brand-navy)"
                foot={comKml.length < linhas.length ? `${comKml.length} de ${linhas.length} com medição` : undefined}
              />
            </div>

            <Card
              title="Frota cadastrada"
              icon={Truck}
              action={
                <div className="flex items-center gap-2">
                  <Pill tone="sky">{nf(linhas.length)} de {nf(itens.length)}</Pill>
                  <FiltroGaragem valor={garagem} onChange={setGaragem} />
                  <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Prefixo, placa ou modelo…"
                    className="h-9 w-52 rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
                    />
                  </div>
                </div>
              }
              bodyClassName="p-4"
            >
              {/* Filtros. Cada seletor lista só o que existe na frota. */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <select
                  value={marca}
                  onChange={(e) => { setMarca(e.target.value); setModelo(""); setPagina(1); }}
                  className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
                >
                  <option value="">Todas as marcas</option>
                  {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>

                <select
                  value={modelo}
                  onChange={(e) => { setModelo(e.target.value); setPagina(1); }}
                  className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
                >
                  <option value="">Todos os modelos</option>
                  {modelos.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>

                <select
                  value={operacao}
                  onChange={(e) => { setOperacao(e.target.value); setPagina(1); }}
                  className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
                >
                  <option value="">Todas as operações</option>
                  {operacoes.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>

                <select
                  value={situacao}
                  onChange={(e) => { setSituacao(e.target.value); setPagina(1); }}
                  className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
                >
                  <option value="">Todas as situações</option>
                  {Object.entries(SITUACAO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>

                {filtrosAtivos > 0 && (
                  <button
                    onClick={limparFiltros}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[12.5px] font-medium text-brand-navy hover:bg-secondary"
                  >
                    <X className="h-3.5 w-3.5" />
                    Limpar {filtrosAtivos} filtro{filtrosAtivos > 1 ? "s" : ""}
                  </button>
                )}
              </div>

              {isPending ? (
                <SkeletonRows rows={6} />
              ) : visiveis.length ? (
                <>
                  <DataTable
                    columns={COLS}
                    rows={visiveis}
                    onRowClick={(v) => navigate(`/app/manutencao?placa=${v.placa}`)}
                  />

                  {totalPaginas > 1 && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <span className="text-[12px] text-muted-foreground">
                        {(paginaAtual - 1) * porPagina + 1}–{Math.min(paginaAtual * porPagina, linhas.length)} de{" "}
                        {nf(linhas.length)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPagina(Math.max(1, paginaAtual - 1))}
                          disabled={paginaAtual === 1}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                          .filter((n) => n === 1 || n === totalPaginas || Math.abs(n - paginaAtual) <= 1)
                          .map((n, idx, arr) => (
                            <span key={n} className="flex items-center">
                              {idx > 0 && arr[idx - 1] !== n - 1 && (
                                <span className="px-1 text-[12px] text-muted-foreground">…</span>
                              )}
                              <button
                                onClick={() => setPagina(n)}
                                className={cn(
                                  "h-8 min-w-8 rounded-lg px-2 font-mono text-[12.5px] font-medium transition-colors",
                                  n === paginaAtual
                                    ? "bg-brand-navy text-white"
                                    : "border border-border text-muted-foreground hover:bg-secondary",
                                )}
                              >
                                {n}
                              </button>
                            </span>
                          ))}
                        <button
                          onClick={() => setPagina(Math.min(totalPaginas, paginaAtual + 1))}
                          disabled={paginaAtual === totalPaginas}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
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
