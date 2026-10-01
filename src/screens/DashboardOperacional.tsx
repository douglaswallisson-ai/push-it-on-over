import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bus,
  CalendarClock,
  CloudRain,
  Clock,
  Droplets,
  Fuel,
  Gauge,
  Radio,
  Route,
  Siren,
  Timer,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, Pill, type PillTone } from "@/components/ss/ui/data";
import { SkeletonRows } from "@/components/ss/ui/QueryState";
import {
  eventosApiQuery,
  alarmesNaoVisualizadosQuery,
  nf,
  posicoesQuery,
  veiculosApiQuery,
  veiculosQuery,
} from "@/lib/queries";
import { usePreventivaFrota } from "@/hooks/use-preventiva-frota";
import { serieGerencialQuery, somar as somarSerie } from "@/lib/gerencial-api";
import { ComparativoIndicadores, type GrupoComparativo } from "./gerencial/Comparativo";
import { usandoMock } from "@/lib/modo";
import { cn } from "@/lib/utils";

/**
 * Dashboard de gestão operacional.
 *
 * Substitui uma tela que mostrava meia dúzia de indicadores soltos. A
 * organização aqui segue a ordem em que o gestor pergunta as coisas:
 *
 * 1. A frota está operando agora? — comunicação, ignição, carros em rota
 * 2. O que exige ação hoje? — eventos, manutenção vencida, contrato vencendo
 * 3. Como foi o período? — consumo, condução, distância
 * 4. Onde está o dinheiro? — combustível, ociosidade, eventos por 100 km
 *
 * Um painel que começa por totais do mês responde a pergunta errada: quem abre
 * o sistema de manhã quer saber o que está pegando fogo, não quanto rodou.
 */

/**
 * Indicadores exibidos na tabela consolidada.
 *
 * `maiorEhMelhor` define o sentido da cor: consumo subindo é bom, evento
 * subindo é ruim. Sem declarar isso por indicador, a variação seria pintada
 * pelo sinal do número e diria o contrário do que significa.
 */
/**
 * Indicadores do comparativo, agrupados por tema. Viagens, MKBF e falhas
 * ficam fora: sem fonte no backend, o aviso abaixo do painel explica.
 * "Horas de operação" (soma das faixas) também: ao lado de "horas
 * trabalhadas", que vem de outra tabela, parecia contradição.
 */
function gruposComparativo(ind: { current: Record<string, number>; previous: Record<string, number> | null; porDia: Record<string, number>[] }): GrupoComparativo[] {
  const it = (campo: string, rotulo: string, dica: string, o: { unidade?: string; maiorEhMelhor?: boolean; casas?: number } = {}) => ({
    rotulo,
    dica,
    ...o,
    atual: ind.current[campo] ?? null,
    anterior: ind.previous?.[campo] ?? null,
    serie: ind.porDia.map((d) => d[campo] ?? 0),
  });
  return [
    {
      titulo: "Produção",
      itens: [
        it("distance_km", "Quilometragem rodada", "Distância percorrida pela frota no período.", { unidade: "km", maiorEhMelhor: true }),
        it("moving_hours", "Horas trabalhadas", "Horas com o veículo em operação (consolidação diária).", { unidade: "h", maiorEhMelhor: true }),
        it("active_vehicles", "Veículos ativos", "Maior número de veículos que rodaram num mesmo dia do período.", { maiorEhMelhor: true }),
        it("active_drivers", "Motoristas ativos", "Maior número de motoristas identificados num mesmo dia do período.", { maiorEhMelhor: true }),
      ],
    },
    {
      titulo: "Combustível e tempo",
      itens: [
        it("fuel_liters", "Combustível consumido", "Litros no período. Cair é bom quando a quilometragem se mantém.", { unidade: "L" }),
        it("kml", "Consumo médio", "Km filtrado ÷ litros (regra do Dashboard Start). Subir é bom.", { unidade: "km/l", maiorEhMelhor: true, casas: 2 }),
        it("idle_hours", "Horas parado ligado", "Motor ligado com o veículo parado: combustível gasto sem rodar.", { unidade: "h" }),
        it("idle_pct", "Ociosidade", "Parado ligado ÷ tempo nas faixas de telemetria.", { unidade: "%", casas: 1 }),
      ],
    },
    {
      titulo: "Condução",
      itens: [
        it("green_band_pct", "Faixa econômica", "Verde + extra econômica ÷ tempo nas 13 faixas. Subir é bom.", { unidade: "%", maiorEhMelhor: true, casas: 1 }),
        it("hard_brakes", "Freadas bruscas", "Quantidade no período."),
        it("hard_accelerations", "Acelerações bruscas", "Quantidade no período."),
        it("speed_violations", "Excessos de velocidade", "Quantidade no período (seco, níveis 1 a 3)."),
        it("events_per_100km", "Eventos por 100 km", "Freadas + acelerações + velocidade + embreagem a cada 100 km: compara períodos com distâncias diferentes.", { casas: 2 }),
      ],
    },
  ];
}

const hhmm = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;

function janela(dias: number) {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { i: iso(inicio), f: iso(fim) };
}

/**
 * `embutido`: dentro do Gerencial, como a página "Painel da operação" — sem
 * cabeçalho próprio; o seletor de 7/30/90 dias vai para o corpo.
 */
export default function DashboardOperacional({ embutido = false }: { embutido?: boolean } = {}) {
  const navigate = useNavigate();
  const [dias, setDias] = useState(30);
  const p = useMemo(() => janela(dias), [dias]);

  // `/indicators` nunca foi publicado; o período sai da série do BI
  // (`/gerencial/serie-diaria`), contra o período anterior de mesmo tamanho.
  const fimSerie = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }, []);
  const isoL = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const menos = (base: Date, n: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() - n);
    return d;
  };
  const serieQ = useQuery(serieGerencialQuery(isoL(menos(fimSerie, dias - 1)), isoL(fimSerie)));
  const serieAntQ = useQuery(serieGerencialQuery(isoL(menos(fimSerie, 2 * dias - 1)), isoL(menos(fimSerie, dias))));
  const indicadoresQ = serieQ;
  const posicoesQ = useQuery(posicoesQuery());
  const eventosQ = useQuery(eventosApiQuery({ only_pending: true, limit: 200 }));
  const mockVeic = useQuery(veiculosQuery(1, 300));
  const apiVeic = useQuery(veiculosApiQuery(1, 300));
  const { porVeiculo } = usePreventivaFrota();

  const veiculos = (usandoMock() ? mockVeic.data : apiVeic.data)?.items ?? [];
  const posicoes = posicoesQ.data ?? [];

  const ind = useMemo(() => {
    if (!serieQ.data) return undefined;
    const campos = (dias: typeof serieQ.data.dias) => {
      const t = somarSerie(dias);
      const eventos = t.aceleracao + t.freada + t.velocidade + t.embreagem;
      return {
        distance_km: t.km,
        kml: t.litros > 0 ? Math.round((t.km_filtrado / t.litros) * 100) / 100 : 0,
        events_per_100km: t.km > 0 ? Math.round((eventos / t.km) * 10000) / 100 : 0,
        moving_hours: t.horas,
        idle_hours: t.stop_engine_on / 3600,
        total_hours: t.total_11 / 3600,
        idle_pct: t.total_11 > 0 ? Math.round((t.stop_engine_on / t.total_11) * 1000) / 10 : 0,
        green_band_pct: t.faixas_13 > 0 ? Math.round(((t.faixas.verde + t.faixas.extra_economica) / t.faixas_13) * 1000) / 10 : 0,
        hard_brakes: t.freada,
        hard_accelerations: t.aceleracao,
        speed_violations: t.velocidade,
        active_vehicles: t.veiculos,
        active_drivers: t.motoristas,
        fuel_liters: t.litros,
      } as Record<string, number>;
    };
    return {
      porDia: serieQ.data.dias.map((d) => campos([d])),
      current: campos(serieQ.data.dias),
      previous: serieAntQ.data ? campos(serieAntQ.data.dias) : null,
      unavailable: ["MKBF", "viagens"],
      unavailable_reason:
        "MKBF depende de cadastro de falhas e viagens de uma contagem que o backend ainda não expõe. Veículos e motoristas são o maior número de um dia do período.",
    };
  }, [serieQ.data, serieAntQ.data]);

  // `fleet_events` está vazia em produção; o que está aberto de verdade são os
  // disparos do Monitor de Alarmes não visualizados (24 h).
  const alarmesQ = useQuery(alarmesNaoVisualizadosQuery(24));
  const eventos = usandoMock()
    ? (eventosQ.data as { summary?: { pending: number; critical: number } } | undefined)?.summary
    : alarmesQ.data
      ? { pending: alarmesQ.data.nao_visualizados, critical: 0 }
      : undefined;

  /* ---------------- Estado agora ---------------- */

  const agora = useMemo(() => {
    const limite = Date.now() - 20 * 60_000;
    const comunicando = posicoes.filter((x) => new Date(x.atualizadoEm).getTime() > limite);
    const emRota = comunicando.filter((x) => x.velocidade > 3);
    const paradoLigado = comunicando.filter((x) => x.ignicao && x.velocidade <= 3);

    return {
      total: veiculos.length,
      comunicando: comunicando.length,
      semComunicacao: Math.max(0, veiculos.length - comunicando.length),
      emRota: emRota.length,
      paradoLigado: paradoLigado.length,
      desligado: comunicando.length - emRota.length - paradoLigado.length,
    };
  }, [posicoes, veiculos]);

  /* ---------------- Pendências ---------------- */

  const manutencao = useMemo(() => {
    const todas = porVeiculo.flatMap((v) => v.preventivas);
    return {
      vencidas: todas.filter((x) => x.urgencia === "vencida").length,
      proximas: todas.filter((x) => x.urgencia === "critica" || x.urgencia === "proxima").length,
      semCatalogo: porVeiculo.filter((v) => v.semCatalogo).length,
    };
  }, [porVeiculo]);

  /* ---------------- Variação contra o período anterior ---------------- */

  const variacao = (campo: string) => {
    if (!ind?.previous || !ind.current) return null;
    const atual = ind.current[campo] ?? 0;
    const anterior = ind.previous[campo] ?? 0;
    if (!anterior) return null;
    return Math.round(((atual - anterior) / anterior) * 1000) / 10;
  };

  const carregando = indicadoresQ.isPending && !usandoMock();

  const seletorDias = (
          <div className="flex flex-wrap gap-1.5">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDias(d)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                  dias === d
                    ? "bg-brand-navy text-white"
                    : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                {d} dias
              </button>
            ))}
          </div>
  );

  return (
    <>
      {!embutido && <PageHeader title="Gestão operacional" subtitle="Gerencial › Painel da operação" actions={seletorDias} />}

      <div className={embutido ? "space-y-6" : "mx-auto max-w-[1600px] space-y-6 px-6 py-6 md:px-8"}>
        {embutido && <div className="flex justify-end">{seletorDias}</div>}
        {/* ============ 1. A frota está operando agora? ============ */}
        <section>
          <Rotulo>Agora · estado da frota</Rotulo>
          <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-6">
            <Tile icone={Truck} rotulo="Frota total" valor={nf(agora.total)} cor="var(--brand-navy)" />
            <Tile
              icone={Route}
              rotulo="Em rota"
              valor={nf(agora.emRota)}
              cor="var(--leaf)"
              nota={agora.total ? `${Math.round((agora.emRota / agora.total) * 100)}% da frota` : undefined}
              aoClicar={() => navigate("/app/mapa")}
            />
            <Tile
              icone={Fuel}
              rotulo="Parado ligado"
              valor={nf(agora.paradoLigado)}
              cor={agora.paradoLigado > agora.emRota * 0.3 ? "var(--coral)" : "var(--gold)"}
              nota="consumindo sem rodar"
            />
            <Tile icone={Clock} rotulo="Desligado" valor={nf(agora.desligado)} cor="var(--muted-foreground)" />
            <Tile
              icone={Radio}
              rotulo="Sem comunicação"
              valor={nf(agora.semComunicacao)}
              cor={agora.semComunicacao ? "var(--coral)" : "var(--leaf)"}
              nota="há mais de 20 min"
              aoClicar={() => navigate("/app/cadastros/equipamentos")}
            />
            <Tile
              icone={Siren}
              rotulo={usandoMock() ? "Eventos abertos" : "Alarmes não vistos"}
              valor={eventos ? nf(eventos.pending) : "—"}
              cor={eventos?.pending ? "var(--coral)" : "var(--leaf)"}
              nota={usandoMock() ? (eventos?.critical ? `${eventos.critical} críticos` : "nenhum crítico") : "últimas 24 h"}
              aoClicar={() => navigate("/app/eventos")}
            />
          </div>
        </section>

        {/* ============ 2. O que exige ação ============ */}
        <section>
          <Rotulo>Exige ação</Rotulo>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <CardAcao
              titulo="Manutenção vencida"
              valor={manutencao.vencidas}
              descricao="passaram do intervalo do fabricante"
              icone={Wrench}
              tom={manutencao.vencidas ? "coral" : "green"}
              aoClicar={() => navigate("/app/manutencao")}
            />
            <CardAcao
              titulo="Manutenção próxima"
              valor={manutencao.proximas}
              descricao="acima de 75% do intervalo"
              icone={CalendarClock}
              tom={manutencao.proximas ? "gold" : "green"}
              aoClicar={() => navigate("/app/manutencao")}
            />
            <CardAcao
              titulo="Sem parâmetro"
              valor={manutencao.semCatalogo}
              descricao="modelo sem catálogo — nunca entra na fila"
              icone={AlertTriangle}
              tom={manutencao.semCatalogo ? "gold" : "green"}
              aoClicar={() => navigate("/app/admin/catalogo")}
            />
          </div>
        </section>

        {/* ============ 3. Como foi o período ============ */}
        <section>
          <Rotulo>Período · últimos {dias} dias</Rotulo>

          {carregando ? (
            <Card title="Carregando" icon={Activity} className="mt-3">
              <SkeletonRows rows={4} />
            </Card>
          ) : !ind ? (
            <Card title="Indicadores do período" icon={Activity} bodyClassName="p-4" className="mt-3">
              {/* A mensagem depende do motivo. Dizer "alterne para modo real"
                  para quem já está em modo real manda procurar solução onde
                  não há problema. */}
              {usandoMock() ? (
                <p className="text-[12.5px] text-muted-foreground">
                  Os indicadores consolidados vêm da API. Alterne para modo real em Console de gestão ›
                  Configurações para vê-los.
                </p>
              ) : (
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <p className="text-[12.5px] leading-relaxed text-gold">
                    <strong>Endpoint ainda não publicado.</strong> O cálculo de indicadores consolidados
                    (<span className="font-mono">/api/v1/indicators</span>) existe no código mas não foi implantado no
                    servidor. Os cartões acima já usam dados reais; esta seção aparece assim que o endpoint subir.
                  </p>
                </div>
              )}
            </Card>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <TileVariacao
                  icone={Route}
                  rotulo="Distância"
                  valor={nf(Math.round(ind.current.distance_km ?? 0))}
                  unidade="km"
                  variacao={variacao("distance_km")}
                  maiorEhMelhor
                />
                <TileVariacao
                  icone={Fuel}
                  rotulo="Consumo"
                  valor={String(ind.current.kml ?? 0)}
                  unidade="km/l"
                  variacao={variacao("kml")}
                  maiorEhMelhor
                />
                <TileVariacao
                  icone={Wrench}
                  rotulo="MKBF"
                  valor={ind.current.mkbf != null ? nf(Math.round(ind.current.mkbf)) : "—"}
                  unidade="km"
                  variacao={variacao("mkbf")}
                  maiorEhMelhor
                  nota="entre falhas críticas"
                />
                <TileVariacao
                  icone={Gauge}
                  rotulo="Eventos"
                  valor={String(ind.current.events_per_100km ?? 0)}
                  unidade="/100 km"
                  variacao={variacao("events_per_100km")}
                  nota="normalizado pela distância"
                />
              </div>

              {/* Condução e tempo, que explicam os números acima. */}
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Card title="Uso do tempo" icon={Timer} bodyClassName="p-4">
                  <Barra
                    itens={[
                      { rotulo: "Em movimento", valor: ind.current.moving_hours ?? 0, cor: "var(--leaf)" },
                      { rotulo: "Parado ligado", valor: ind.current.idle_hours ?? 0, cor: "var(--coral)" },
                      {
                        rotulo: "Outros",
                        valor: Math.max(0, (ind.current.total_hours ?? 0) - (ind.current.moving_hours ?? 0) - (ind.current.idle_hours ?? 0)),
                        cor: "var(--muted-foreground)",
                      },
                    ]}
                    sufixo="h"
                  />
                  <p className="mt-3 text-[11.5px] text-muted-foreground">
                    Ociosidade em <strong className="text-foreground">{ind.current.idle_pct ?? 0}%</strong> do tempo
                    ligado. É combustível consumido sem rodar — em frota de ônibus, cada ponto percentual costuma
                    valer mais que qualquer economia de condução.
                  </p>
                </Card>

                <Card title="Qualidade da condução" icon={TrendingUp} bodyClassName="p-4">
                  <div className="space-y-3">
                    <Medidor
                      rotulo="Faixa econômica"
                      valor={ind.current.green_band_pct ?? 0}
                      meta={60}
                      sufixo="%"
                      nota="do tempo em movimento"
                    />
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <Mini rotulo="Freadas bruscas" valor={nf(ind.current.hard_brakes ?? 0)} />
                      <Mini rotulo="Acelerações" valor={nf(ind.current.hard_accelerations ?? 0)} />
                      <Mini rotulo="Excessos" valor={nf(ind.current.speed_violations ?? 0)} />
                    </div>
                  </div>

                  {(ind.current.rain_pct ?? 0) > 0 && (
                    <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-navy-tint/50 px-3 py-2 text-[11.5px] text-brand-blue">
                      <CloudRain className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        <strong>{ind.current.rain_pct}%</strong> do período sob chuva. Comparar consumo com um
                        período mais seco distorce a leitura — pista molhada aumenta o gasto e reduz a velocidade.
                      </span>
                    </p>
                  )}
                </Card>
              </div>

              {/* Operação: quantos carros e motoristas de fato rodaram. */}
              <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Tile icone={Bus} rotulo="Horas trabalhadas" valor={nf(Math.round(ind.current.moving_hours ?? 0))} unidade="h" cor="var(--brand-navy)" />
                <Tile
                  icone={Truck}
                  rotulo="Veículos que rodaram"
                  valor={nf(ind.current.active_vehicles ?? 0)}
                  cor="var(--brand-sky)"
                  nota={
                    agora.total
                      ? `${Math.round(((ind.current.active_vehicles ?? 0) / agora.total) * 100)}% da frota`
                      : undefined
                  }
                />
                <Tile icone={Users} rotulo="Motoristas" valor={nf(ind.current.active_drivers ?? 0)} cor="var(--leaf)" />
                <Tile
                  icone={Droplets}
                  rotulo="Combustível"
                  valor={nf(Math.round(ind.current.fuel_liters ?? 0))}
                  unidade="L"
                  cor="var(--gold)"
                />
              </div>

              {/* Tabela completa de indicadores, com comparação período a
                  período. Vinha de uma tela separada; separar consolidado de
                  detalhe obrigava o gestor a abrir duas telas para a mesma
                  pergunta. */}
              <Card title="Período × período anterior" icon={BarChart3} bodyClassName="p-4" className="mt-4">
                <ComparativoIndicadores grupos={gruposComparativo(ind)} />
              </Card>

              {/* O que o backend não consegue calcular, e por quê. */}
              {ind.unavailable && ind.unavailable.length > 0 && (
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-gold-line bg-gold-tint/40 px-4 py-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                  <p className="text-[12.5px] text-gold">
                    <strong>{ind.unavailable.join(", ").toUpperCase()}</strong> não podem ser calculados.{" "}
                    {ind.unavailable_reason}
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      <span className="h-px w-5 bg-border" />
      {children}
    </h2>
  );
}

function Tile({
  icone: Icone,
  rotulo,
  valor,
  unidade,
  cor,
  nota,
  aoClicar,
}: {
  icone: typeof Truck;
  rotulo: string;
  valor: string;
  unidade?: string;
  cor: string;
  nota?: string;
  aoClicar?: () => void;
}) {
  const Tag = aoClicar ? "button" : "div";
  return (
    <Tag
      onClick={aoClicar}
      className={cn(
        "rounded-2xl border border-border bg-card p-4 text-left shadow-card",
        aoClicar && "transition-all hover:-translate-y-0.5 hover:shadow-elegant",
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in oklab, ${cor} 14%, white)` }}
        >
          <Icone className="h-4 w-4" style={{ color: cor }} />
        </span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {rotulo}
        </span>
      </span>
      <span className="mt-2 flex items-baseline gap-1">
        <span className="font-display text-[26px] font-bold leading-none" style={{ color: cor }}>
          {valor}
        </span>
        {unidade && <span className="text-[12px] text-muted-foreground">{unidade}</span>}
      </span>
      {nota && <span className="mt-1 block text-[11px] leading-tight text-muted-foreground">{nota}</span>}
    </Tag>
  );
}

/**
 * Indicador com comparação contra o período anterior.
 *
 * A seta segue o sentido do que é bom, não o do número: consumo subindo é
 * verde, evento subindo é vermelho. Sem essa distinção, o gestor lê a cor
 * errada e conclui o oposto.
 */
function TileVariacao({
  icone: Icone,
  rotulo,
  valor,
  unidade,
  variacao,
  maiorEhMelhor,
  nota,
}: {
  icone: typeof Truck;
  rotulo: string;
  valor: string;
  unidade?: string;
  variacao: number | null;
  maiorEhMelhor?: boolean;
  nota?: string;
}) {
  const bom = variacao == null ? null : maiorEhMelhor ? variacao > 0 : variacao < 0;
  const cor = bom == null ? "var(--muted-foreground)" : bom ? "var(--leaf)" : "var(--coral)";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <span className="flex items-center gap-2">
        <Icone className="h-4 w-4 text-muted-foreground" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {rotulo}
        </span>
      </span>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="flex items-baseline gap-1">
          <span className="font-display text-[26px] font-bold leading-none text-foreground">{valor}</span>
          {unidade && <span className="text-[12px] text-muted-foreground">{unidade}</span>}
        </span>
        {variacao != null && (
          <span className="inline-flex items-center gap-0.5 text-[12px] font-semibold" style={{ color: cor }}>
            {variacao > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {Math.abs(variacao)}%
          </span>
        )}
      </div>
      <span className="mt-1 block text-[11px] text-muted-foreground">
        {nota ?? (variacao != null ? "contra o período anterior" : "sem período anterior")}
      </span>
    </div>
  );
}

function CardAcao({
  titulo,
  valor,
  descricao,
  icone: Icone,
  tom,
  aoClicar,
}: {
  titulo: string;
  valor: number;
  descricao: string;
  icone: typeof Wrench;
  tom: PillTone;
  aoClicar: () => void;
}) {
  const cor = tom === "coral" ? "var(--coral)" : tom === "gold" ? "var(--gold)" : "var(--leaf)";
  return (
    <button
      onClick={aoClicar}
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant"
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `color-mix(in oklab, ${cor} 14%, white)` }}
      >
        <Icone className="h-6 w-6" style={{ color: cor }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="font-display text-[24px] font-bold leading-none" style={{ color: valor ? cor : "var(--foreground)" }}>
            {valor}
          </span>
          <span className="text-[13px] font-semibold text-foreground">{titulo}</span>
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-tight text-muted-foreground">{descricao}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/** Barra proporcional, para composições que somam um todo. */
function Barra({ itens, sufixo }: { itens: { rotulo: string; valor: number; cor: string }[]; sufixo?: string }) {
  const total = itens.reduce((a, i) => a + i.valor, 0) || 1;
  return (
    <>
      <div className="flex h-4 overflow-hidden rounded-full">
        {itens.map((i) => (
          <div
            key={i.rotulo}
            title={`${i.rotulo}: ${Math.round(i.valor)}${sufixo ?? ""}`}
            style={{ width: `${(i.valor / total) * 100}%`, background: i.cor }}
          />
        ))}
      </div>
      <ul className="mt-2.5 space-y-1">
        {itens.map((i) => (
          <li key={i.rotulo} className="flex items-center justify-between gap-2 text-[12.5px]">
            <span className="flex items-center gap-2 text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.cor }} />
              {i.rotulo}
            </span>
            <span className="font-mono font-semibold text-foreground">
              {Math.round(i.valor)}
              {sufixo} <span className="text-muted-foreground">({Math.round((i.valor / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function Medidor({
  rotulo,
  valor,
  meta,
  sufixo,
  nota,
}: {
  rotulo: string;
  valor: number;
  meta: number;
  sufixo?: string;
  nota?: string;
}) {
  const atingiu = valor >= meta;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] text-ink-soft">{rotulo}</span>
        <span className={cn("font-mono text-[15px] font-bold", atingiu ? "text-leaf" : "text-gold")}>
          {valor}
          {sufixo}
        </span>
      </div>
      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-2 rounded-full", atingiu ? "bg-leaf" : "bg-gold")}
          style={{ width: `${Math.min(100, valor)}%` }}
        />
        {/* Marca da meta, para o número ter referência. */}
        <span className="absolute top-0 h-2 w-px bg-foreground/40" style={{ left: `${meta}%` }} title={`Meta ${meta}${sufixo}`} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {nota} · meta {meta}
        {sufixo}
      </p>
    </div>
  );
}

function Mini({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border px-2.5 py-2">
      <div className="font-mono text-[16px] font-bold leading-none text-foreground">{valor}</div>
      <div className="mt-1 text-[10.5px] leading-tight text-muted-foreground">{rotulo}</div>
    </div>
  );
}
