import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import { ChevronLeft, ChevronRight, Gauge, Info, Navigation, Plus, Radio, RefreshCw, Search, Truck, Wrench, X } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Dot, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { StarRating } from "@/components/ss/ui/gauges";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { SITUACAO_LABEL, SITUACAO_TONE, kanbanManutencaoQuery, nf, veiculosApiQuery, veiculosQuery } from "@/lib/queries";
import { MOCK_INDICADORES_VEICULO } from "@/lib/mock-data";
import { escopoGaragens, filtrarPorGaragem } from "@/lib/escopo";
import { useSessao } from "@/hooks/use-sessao";
import { FaixasConducao } from "@/components/ss/frota/FaixasConducao";
import { FiltroGaragem } from "@/components/ss/ui/FiltroGaragem";
import { usandoMock } from "@/lib/modo";
import { notaDePercentual } from "@/hooks/use-indicadores-veiculo";
import { useIndicadoresBi } from "@/hooks/use-indicadores-bi";
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
  iv: "Faixa verde",
  ae: "Inércia",
  mp: "Parado ligado",
  av: "Faixa amarela",
  pa: "Eficiência operacional",
  ev: "Faixa vermelha",
  fm: "Freio motor",
  pac: "Pressão do acelerador",
};

/**
 * Coluna de faixa, em percentual.
 *
 * Era estrela de 0 a 5. A conversão descartava informação: "quatro estrelas"
 * não diz se o veículo passou 62% ou 78% do tempo em faixa verde, e é o
 * percentual que o gestor compara com a meta e com o BI.
 *
 * `sentido` define a cor, não o valor: em faixa verde, mais é melhor; em
 * motor ligado parado, menos. Sem isso, o pior veículo apareceria em verde.
 */
const faixa = (
  key: string,
  sentido: "maior_melhor" | "menor_melhor" = "maior_melhor",
): Column<Linha> => ({
  key,
  header: HEADERS[key] ?? key,
  align: "right",
  render: (v) => {
    const pct = (v as Record<string, unknown>)[key] as number | null | undefined;
    if (pct == null) {
      return <span className="text-[11px] text-muted-foreground">—</span>;
    }
    const bom = sentido === "maior_melhor" ? pct >= 50 : pct <= 20;
    return (
      <span
        className={cn(
          "font-mono text-[12.5px] font-semibold",
          bom ? "text-leaf" : pct > 0 ? "text-gold" : "text-muted-foreground",
        )}
      >
        {nf(pct, 1)}
        <span className="ml-0.5 text-[10px] font-normal text-muted-foreground">%</span>
      </span>
    );
  },
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

  /**
   * Indicadores nas fontes do BI.
   *
   * O cliente confere o número contra o BI, então é o BI que define a
   * verdade. As duas fontes divergem em 14,8% de quilometragem — somar
   * `con_telemetry` aqui faria a tela mostrar menos do que o painel.
   */
  const indicadores = useIndicadoresBi(30, idsDaFrota);

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
      // Faixa e km/l vêm de relatórios diferentes. Exigir os dois descartava as
      // faixas de quem não tinha linha de km no período.
      if (!ind && !indicadores.faixasPorVeiculo.has(v.id)) return v;
      return {
        ...v,
        kml: ind?.kml ?? v.kml,
        // O endpoint consolidado não traz odômetro; ele continua vindo do
        // cadastro.
        odometro: v.odometro,
        // Os oito indicadores de condução, compostos da telemetria. Antes eu
        // preenchia dois e as outras seis colunas ficavam "não avaliado"
        // mesmo com a viagem tendo os dados.
        // Estrelas a partir das faixas do BI — onze colunas, com o parado
        // ligado incluindo o produtivo.
        // Percentuais diretos das faixas do BI, sem converter em nota.
        ...(() => {
          const f = indicadores.faixasPorVeiculo.get(v.id);
          if (!f) return {};
          return {
            iv: f.verdePct,
            ae: f.inerciaPct,
            mp: f.paradoLigadoPct,
            av: f.amarelaPct,
            ev: f.vermelhaPct,
            pa: f.eficienciaOperacionalPct,
          };
        })(),
        _ind: ind,
      };
    });

    const noEscopo = filtrarPorGaragem(comIndicadores, sessao, (v) => v.garagemId);
    return garagem ? noEscopo.filter((v) => v.garagemId === garagem) : noEscopo;
    // Os indicadores chegam depois do cadastro. Sem eles aqui, a lista era
    // montada uma vez com os mapas ainda vazios e nunca refeita: as faixas
    // carregavam e a tabela seguia zerada.
  }, [data, sessao, garagem, indicadores.porVeiculo, indicadores.faixasPorVeiculo]);
  const total = itens.length;

  const linhas: Linha[] = useMemo(() => {
    const porVeiculo = new Map((kanbanQ.data ?? []).map((c) => [c.veiculoId, c]));
    const termo = busca.trim().toLowerCase();
    return itens
      .map((v) => ({
        // Os indicadores já vêm calculados da telemetria em `itens`. O espalhamento
        // do exemplo ficava DEPOIS deles e sobrescrevia tudo: onde o veículo
        // existia na base fixa, com nota inventada; onde não existia, o objeto
        // vazio não apagava, mas os reais nunca chegavam a ser vistos porque as
        // chaves do exemplo tinham precedência.
        //
        // Em modo real o exemplo não entra. Sem API, ele continua sendo a única
        // fonte possível.
        ...(usandoMock() ? (MOCK_INDICADORES_VEICULO[v.id] ?? {}) : {}),
        ...v,
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
  // Km filtrado da frota ÷ litros da frota, como o BI (vault: Dashboard Start,
  // R4). A média simples dos km/l dava o mesmo peso a quem rodou 10 km e a
  // quem rodou 8.000, e saía diferente do painel.
  const kmlMedio = (() => {
    const ids = new Set(linhas.map((v) => v.id));
    let km = 0;
    let litros = 0;
    for (const [id, ind] of indicadores.porVeiculo) {
      if (!ids.has(id)) continue;
      km += ind.kmFiltrado;
      litros += ind.litros;
    }
    return litros > 0 ? km / litros : null;
  })();

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
    faixa("iv"),
    faixa("ae"),
    faixa("mp", "menor_melhor"),
    faixa("av", "menor_melhor"),
    faixa("pa"),
    faixa("ev", "menor_melhor"),
    // Freio motor e pressão do acelerador saíram: não há campo equivalente
    // nas faixas que o BI usa, e coluna sempre vazia ocupa espaço sem
    // informar.
    {
      key: "faixas",
      header: "Faixas",
      align: "center",
      render: (v) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const novo = faixasDe === v.id ? null : v.id;
            setFaixasDe(novo);
            // O gráfico abre abaixo da tabela, fora da vista: sem rolar, o
            // clique parecia não fazer nada.
            if (novo) setTimeout(() => document.getElementById("faixas-do-veiculo")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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
        {/* Só aparece carregando, com erro ou sem viagem — com dado, o texto
            explicativo saiu a pedido do produto. */}
        {!usandoMock() && (indicadores.erro || indicadores.carregando || indicadores.linhasKm === 0) && (
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
              ) : indicadores.linhasKm > 0 ? null : false ? (
                <span>
                  <strong className="text-foreground">{nf(indicadores.linhasKm)} registros</strong> consolidados por
                  dia, dos últimos 30 dias — mesma fonte do BI, para o número bater com o painel.
                  {indicadores.temEstimado && (
                    <>
                      {" "}
                      <strong className="text-gold">Parte é estimada:</strong> quando o combustível do dia vem
                      zerado, o servidor substitui distância e consumo pelos valores calculados.
                    </>
                  )}{" "}
                  {comKml.length < linhas.length && (
                    <>
                      Só <strong className="text-foreground">{comKml.length} de {linhas.length}</strong> veículos têm
                      km/l: cerca de metade das viagens chega sem leitura de combustível, e sem ela não há como
                      calcular consumo — a distância dessas viagens continua valendo.{" "}
                    </>
                  )}
                  {0 > 0 && (
                    <>
                      {" "}
                      <strong className="text-gold">
                        {nf(0)} descartadas
                      </strong>{" "}
                      por leitura impossível — distância negativa por estouro de odômetro, ou velocidade acima de
                      300 km/h. Mantê-las somaria milhões de quilômetros que não existiram.
                    </>
                  )}
                </span>
              ) : (
                <span>
                  <strong className="text-foreground">Nenhuma viagem retornada.</strong>{" "}
                  {!Boolean(idsDaFrota.length)
                    ? "A consulta de telemetria não chegou a ser feita — nenhum veículo carregado."
                    : `Consultadas ${nf(idsDaFrota.length)} placas no período de ${"últimos 30 dias"}, sem viagens na resposta.`}
                </span>
              )}
            </p>
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
                    // A linha abre o acompanhamento do veículo. Abria a
                    // manutenção — que tem botão próprio na coluna Manutenção.
                    onRowClick={(v) => navigate(`/app/frota/analise?veiculo=${v.id}`)}
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
                Faixas em percentual do tempo nos últimos 30 dias. Clique na linha para abrir o acompanhamento do
                veículo; a coluna Manutenção leva à manutenção da placa.
              </p>
            </Card>

            <div id="faixas-do-veiculo" className="scroll-mt-4" />
            {faixasDe && (() => {
              // Era `faixasDoVeiculo` da base de exemplo — a mesma distribuição
              // para qualquer placa. Agora são as faixas reais do período.
              const f = indicadores.faixasPorVeiculo.get(faixasDe);
              const titulo = `Faixas de condução — ${linhas.find((l) => l.id === faixasDe)?.placa ?? ""}`;
              if (!f) {
                return (
                  <Card title={titulo} icon={Truck}>
                    <EmptyNote>Sem faixas de condução deste veículo nos últimos 30 dias.</EmptyNote>
                  </Card>
                );
              }
              return (
                <FaixasConducao
                  distribuicao={{
                    parado_ocioso: f.paradoLigadoPct ?? 0,
                    giro_baixo: f.batendoPct ?? 0,
                    verde: f.verdePct ?? 0,
                    amarela: f.amarelaPct ?? 0,
                    vermelha: f.vermelhaPct ?? 0,
                    inercia_simples: f.inerciaPct ?? 0,
                  }}
                  titulo={titulo}
                  subtitulo="Últimos 30 dias. O relatório de faixas do backend entrega seis faixas; parado ligado inclui o produtivo."
                />
              );
            })()}
          </>
        )}
      </div>
    </>
  );
}
