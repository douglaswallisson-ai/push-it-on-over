import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Bus,
  CircleSlash,
  Gauge,
  MapPin,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Route,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { SeloDadosExemplo } from "@/components/ss/ui/SeloDadosExemplo";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import {
  itinerariosQuery,
  linhasQuery,
  nf,
  pontosQuery,
  posicoesLinhaQuery,
  veiculosQuery,
} from "@/lib/queries";
import { registrarAuditoria } from "@/lib/session";
import { linhasApiQuery, turnosApiQuery, viagensOperacaoQuery } from "@/lib/queries";
import { usandoMock } from "@/lib/modo";
import { usePosicoesAoVivo } from "@/hooks/use-posicoes-ao-vivo";
import { projetarNaLinha, type PontoItinerario } from "@/lib/projecao-linha";
import { DESPACHO_LABEL, type PosicaoNaLinha, type Sentido, type TipoDespacho } from "@/types";
import { cn } from "@/lib/utils";
import SinoticoUrbano, { useLinhasUrbanas } from "@/screens/operacao/SinoticoUrbano";

/**
 * Painel sinótico.
 *
 * Representa a linha esticada como uma régua e coloca cada carro na posição em
 * que está. É a leitura que o CCO usa para enxergar o que a tabela de viagens
 * não mostra: **o espaçamento entre os carros**.
 *
 * Dois carros colados e um buraco de vinte minutos atrás deles é o problema
 * clássico de operação urbana — some no relatório de viagens (todas partiram
 * no horário) e salta aos olhos aqui.
 */

const desvioTone = (d: number): PillTone => (Math.abs(d) <= 3 ? "green" : Math.abs(d) <= 8 ? "gold" : "coral");

/** Cor do marcador conforme o desvio, para leitura à distância no telão. */
const corDesvio = (d: number) => (Math.abs(d) <= 3 ? "var(--leaf)" : Math.abs(d) <= 8 ? "var(--gold)" : "var(--coral)");

/**
 * Urbano com linhas em operação (dados reais de viagens) abre a régua real;
 * o resto (exemplo e fretamento por horário) segue na visão abaixo.
 */
export default function PainelSinotico() {
  const urbano = useLinhasUrbanas();
  if (!usandoMock() && urbano.data?.length) return <SinoticoUrbano linhas={urbano.data} />;
  if (!usandoMock() && urbano.isLoading) {
    return (
      <>
        <PageHeader title="Painel sinótico" subtitle="Operação › Visão da linha em tempo real" />
        <div className="px-8 py-6 text-[13px] text-muted-foreground">Carregando as linhas em operação…</div>
      </>
    );
  }
  return <PainelSinoticoHorario />;
}

function PainelSinoticoHorario() {
  const mockLinhasQ = useQuery(linhasQuery());
  const apiLinhasQ = useQuery(linhasApiQuery());
  const linhasQ = usandoMock() ? mockLinhasQ : apiLinhasQ;
  // "l1" é a linha do exemplo; ligado à API, começa na primeira linha real.
  const [escolhida, setLinhaId] = useState<string | null>(usandoMock() ? "l1" : null);
  const linhaId = escolhida ?? (linhasQ.data ?? [])[0]?.id ?? "";

  const posicoesQ = useQuery(posicoesLinhaQuery(linhaId));
  const itinerariosQ = useQuery(itinerariosQuery(linhaId));
  const turnosQ = useQuery(turnosApiQuery(usandoMock() || !linhaId ? undefined : linhaId));

  /**
   * Viagens do dia. Servem para saber a hora de saída de cada carro, que é o
   * que permite calcular atraso em linha operada por intervalo — onde o
   * itinerário guarda tempo relativo à partida, não hora do relógio.
   */
  const viagensRealizadasQ = useQuery(viagensOperacaoQuery(new Date().toISOString().slice(0, 10), linhaId));

  /**
   * Posições ao vivo. Ligado à API, os carros na régua vêm do WebSocket em vez
   * do mock — a régua passa a refletir onde a frota realmente está.
   */
  const aoVivo = usePosicoesAoVivo({ ativo: !usandoMock() });
  const pontosQ = useQuery(pontosQuery());
  const veiculosQ = useQuery(veiculosQuery(1, 200));

  const [selecionado, setSelecionado] = useState<PosicaoNaLinha | null>(null);
  const [despachados, setDespachados] = useState<Record<string, TipoDespacho>>({});

  const prefixo = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of veiculosQ.data?.items ?? []) m.set(v.id, v.prefixo ?? v.placa);
    return m;
  }, [veiculosQ.data]);

  const pontoPorId = useMemo(() => new Map((pontosQ.data ?? []).map((p) => [p.id, p])), [pontosQ.data]);
  /**
   * Posições na linha.
   *
   * Ligado à API, cada carro é projetado geometricamente sobre o itinerário a
   * partir do GPS — antes o progresso na régua vinha pronto do exemplo, o que
   * fazia a tela parecer funcionar sem calcular nada.
   */
  const posicoes = useMemo(() => {
    if (usandoMock() || !aoVivo.posicoes.size) return posicoesQ.data ?? [];

    const it = (itinerariosQ.data ?? []).find((x) => x.linhaId === linhaId);
    const pontos = pontosQ.data ?? [];
    if (!it) return posicoesQ.data ?? [];

    const itinerario: PontoItinerario[] = it.paradas
      .map((pa, i) => {
        const ponto = pontos.find((x) => x.id === pa.pontoId);
        if (!ponto) return null;
        return {
          id: ponto.id,
          nome: ponto.nome,
          lat: ponto.lat,
          lng: ponto.lng,
          ordem: pa.ordem ?? i,
          // As duas formas convivem: horário do relógio quando a linha tem
          // tabela fixa, tempo desde a partida quando opera por intervalo.
          horarioMin: pa.horarioProgramadoMin,
          minutosAcumulados: pa.minutosAcumulados,
          pontoControle: pa.pontoControle,
        };
      })
      .filter(Boolean) as PontoItinerario[];

    if (itinerario.length < 2) return posicoesQ.data ?? [];

    const out: PosicaoNaLinha[] = [];
    for (const [, gps] of aoVivo.posicoes) {
      /**
       * Hora de saída da viagem em curso.
       *
       * Necessária só quando o itinerário guarda tempo relativo. Vem da
       * programação do dia; sem ela, linhas por intervalo posicionam na régua
       * mas não classificam atraso.
       */
      const viagem = (viagensRealizadasQ.data ?? []).find(
        (v) => String(v.veiculoRealizadoId ?? v.veiculoProgramadoId) === String(gps.unit_id),
      );
      const partida = viagem?.partidaRealizada ?? viagem?.partidaProgramada;
      const saidaMin = partida
        ? new Date(partida).getHours() * 60 + new Date(partida).getMinutes()
        : undefined;

      const proj = projetarNaLinha(
        {
          veiculoId: String(gps.unit_id),
          lat: gps.latitude,
          lng: gps.longitude,
          em: gps.local_time ?? new Date().toISOString(),
          velocidade: gps.speed,
        },
        itinerario,
        saidaMin,
      );
      // Confiança baixa significa que o carro não está no itinerário — na
      // garagem, desviado, ou o traçado está desatualizado. Colocá-lo na régua
      // mostraria como se estivesse operando.
      if (!proj || proj.confianca === "baixa") continue;

      out.push({
        veiculoId: proj.veiculoId,
        linhaId,
        itinerarioId: it.id,
        sentido: it.sentido,
        tabela: 0,
        ultimoPontoId: proj.pontoAnterior.id,
        progresso: proj.progressoTrecho,
        desvioMin: proj.desvioMin ?? 0,
      } as PosicaoNaLinha);
    }

    return out.length ? out : (posicoesQ.data ?? []);
  }, [posicoesQ.data, aoVivo.posicoes, itinerariosQ.data, pontosQ.data, viagensRealizadasQ.data, linhaId]);
  const linha = (linhasQ.data ?? []).find((l) => l.id === linhaId);

  const itinerarios = itinerariosQ.data ?? [];

  /** Posição relativa do carro na régua, de 0 a 1, pela ordem das paradas. */
  const posicaoRelativa = (p: PosicaoNaLinha) => {
    const it = itinerarios.find((i) => i.id === p.itinerarioId);
    if (!it || !it.paradas.length) return 0;
    const idx = it.paradas.findIndex((pa) => pa.pontoId === p.ultimoPontoId);
    if (idx < 0) return 0;
    const passo = 1 / Math.max(1, it.paradas.length - 1);
    return Math.min(1, idx * passo + p.progresso * passo);
  };

  const despachar = (p: PosicaoNaLinha, tipo: TipoDespacho, motivo: string) => {
    setDespachados((d) => ({ ...d, [p.veiculoId]: tipo }));
    registrarAuditoria(
      "despacho",
      `${DESPACHO_LABEL[tipo]} — carro ${prefixo.get(p.veiculoId) ?? p.veiculoId}, linha ${linha?.codigo ?? linhaId}. ${motivo}`,
    );
    toast.success(DESPACHO_LABEL[tipo], { description: `Carro ${prefixo.get(p.veiculoId)} · ${motivo}` });
    setSelecionado(null);
  };

  /**
   * Comboio: dois carros grudados na linha.
   *
   * É o problema que o painel existe para revelar, e contar só atraso
   * individual não mostra — os dois podem estar no horário e ainda assim mal
   * distribuídos, com um deles rodando vazio atrás do outro.
   */
  const comboios = useMemo(() => {
    const ordenadas = [...posicoes].sort((a, b) => posicaoRelativa(a) - posicaoRelativa(b));
    const pares: string[] = [];
    for (let i = 1; i < ordenadas.length; i++) {
      const distancia = posicaoRelativa(ordenadas[i]) - posicaoRelativa(ordenadas[i - 1]);
      // Menos de 3% da linha entre um carro e outro. Em linha de 40 minutos,
      // são pouco mais de um minuto de intervalo.
      if (distancia < 0.03) pares.push(ordenadas[i].veiculoId);
    }
    return pares;
  }, [posicoes]); // eslint-disable-line react-hooks/exhaustive-deps

  const adiantados = posicoes.filter((p) => p.desvioMin < -3).length;
  const atrasados = posicoes.filter((p) => p.desvioMin > 3).length;
  const parados = posicoes.filter((p) => p.velocidadeKmh === 0).length;
  const ocupacaoMedia = posicoes.length
    ? Math.round(
        (posicoes.reduce((a, p) => a + (p.passageirosABordo ?? 0) / (p.lotacao || 80), 0) / posicoes.length) * 100,
      )
    : 0;

  /** Maior buraco entre carros — onde o passageiro está esperando. */
  const maiorHeadway = Math.max(0, ...posicoes.map((p) => p.headwayAnteriorMin ?? 0));

  return (
    <>
      <PageHeader
        title="Painel sinótico"
        subtitle="Operação › Visão da linha em tempo real"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={linhaId}
              onChange={(e) => setLinhaId(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
            >
              {(linhasQ.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.codigo} — {l.nome}
                </option>
              ))}
            </select>
            <button
              onClick={() => posicoesQ.refetch()}
              disabled={posicoesQ.isFetching}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <RefreshCw className={cn("h-[15px] w-[15px]", posicoesQ.isFetching && "animate-spin")} />
              Atualizar
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        <SeloDadosExemplo motivo="Posição na régua, desvio de horário e detecção de comboio já são calculados. Faltam apenas os dados: linhas, turnos e paradas dependem dos endpoints correspondentes estarem publicados." />

        {posicoesQ.error ? (
          <ErrorBox error={posicoesQ.error} onRetry={() => posicoesQ.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile icon={Bus} label="Carros na linha" value={nf(posicoes.length)} color="var(--brand-navy)" />
              <StatTile icon={ArrowLeftRight} label="Adiantados" value={nf(adiantados)} color="var(--gold)" />
              <StatTile icon={ArrowLeftRight} label="Atrasados" value={nf(atrasados)} color="var(--coral)" />
              <StatTile
                icon={Users}
                label="Em comboio"
                value={nf(comboios.length)}
                color={comboios.length ? "var(--coral)" : "var(--leaf)"}
                foot="carros grudados na linha"
              />
              <StatTile
                icon={PauseCircle}
                label="Parados"
                value={nf(parados)}
                color={parados ? "var(--coral)" : "var(--leaf)"}
              />
              <StatTile
                icon={Users}
                label="Ocupação média"
                value={`${ocupacaoMedia}%`}
                color={ocupacaoMedia > 90 ? "var(--coral)" : "var(--brand-sky)"}
              />
            </div>

            {maiorHeadway > 18 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-coral-line bg-coral-tint/50 px-4 py-3">
                <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                <p className="text-[13px] text-coral">
                  <strong>Intervalo de {maiorHeadway} min entre carros.</strong> Um buraco desse tamanho não aparece no
                  relatório de viagens — todas podem ter partido no horário — mas é onde o passageiro está esperando.
                </p>
              </div>
            )}

            {posicoesQ.isPending ? (
              <Card title="Carregando" icon={Route}>
                <SkeletonRows rows={4} />
              </Card>
            ) : (
              (["ida", "volta"] as Sentido[]).map((sentido) => {
                const it = itinerarios.find((i) => i.sentido === sentido);
                if (!it) return null;
                const carros = posicoes
                  .filter((p) => p.sentido === sentido)
                  .sort((a, b) => posicaoRelativa(b) - posicaoRelativa(a));

                return (
                  <Card
                    key={sentido}
                    title={`${sentido === "ida" ? "Ida" : "Volta"} — ${it.nome}`}
                    icon={Route}
                    action={
                      <span className="flex items-center gap-2">
                        <Pill tone="neutral">{it.extensaoKm} km</Pill>
                        <Pill tone="sky">{carros.length} carros</Pill>
                      </span>
                    }
                    bodyClassName="p-5"
                  >
                    {/* Régua da linha. */}
                    <div className="relative pb-16 pt-10">
                      <div className="absolute left-0 right-0 top-[46px] h-1.5 rounded-full bg-secondary" />

                      {/* Paradas. */}
                      {it.paradas.map((pa, i) => {
                        const p = pontoPorId.get(pa.pontoId);
                        const x = (i / Math.max(1, it.paradas.length - 1)) * 100;
                        return (
                          <div key={pa.pontoId} className="absolute top-[38px]" style={{ left: `${x}%` }}>
                            <div className="-translate-x-1/2">
                              <span
                                className={cn(
                                  "block h-4 w-4 rounded-full border-2 bg-white",
                                  p?.controle ? "border-coral" : "border-[#c7d2df]",
                                )}
                                title={p?.controle ? `${p?.nome} (ponto de controle)` : p?.nome}
                              />
                              <span className="mt-2 block w-24 -translate-x-[38px] text-center text-[10.5px] leading-tight text-muted-foreground">
                                {p?.codigo}
                                {p?.controle && <span className="block font-semibold text-coral">PC</span>}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Carros posicionados. */}
                      {carros.map((c) => {
                        const x = posicaoRelativa(c) * 100;
                        const desp = despachados[c.veiculoId];
                        return (
                          <button
                            key={c.veiculoId}
                            onClick={() => setSelecionado(selecionado?.veiculoId === c.veiculoId ? null : c)}
                            className="absolute top-0 -translate-x-1/2 transition-transform hover:-translate-y-0.5"
                            style={{ left: `${x}%` }}
                            title={`Carro ${prefixo.get(c.veiculoId)} · tabela ${c.tabela}`}
                          >
                            <span
                              className={cn(
                                "flex items-center gap-1 rounded-lg border px-1.5 py-1 shadow-card",
                                selecionado?.veiculoId === c.veiculoId ? "border-brand-navy ring-1 ring-brand-navy" : "border-border",
                                c.velocidadeKmh === 0 ? "bg-coral-tint" : "bg-white",
                              )}
                            >
                              <Bus className="h-3.5 w-3.5" style={{ color: corDesvio(c.desvioMin) }} />
                              <span className="font-mono text-[11px] font-bold text-foreground">
                                {prefixo.get(c.veiculoId)}
                              </span>
                            </span>
                            <span
                              className="mx-auto mt-0.5 block h-3 w-0.5"
                              style={{ background: corDesvio(c.desvioMin) }}
                            />
                            <span
                              className="mx-auto block font-mono text-[10px] font-bold"
                              style={{ color: corDesvio(c.desvioMin) }}
                            >
                              {c.desvioMin > 0 ? "+" : ""}
                              {c.desvioMin}
                            </span>
                            {desp && (
                              <span className="mt-0.5 block rounded bg-brand-navy px-1 text-[9px] font-semibold text-white">
                                {DESPACHO_LABEL[desp]}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-[11.5px] text-muted-foreground">
                      O número sob cada carro é o desvio em minutos contra o programado. Verde até 3, âmbar até 8,
                      vermelho acima. Clique num carro para despachar.
                    </p>
                  </Card>
                );
              })
            )}

            {/* Despacho. */}
            {selecionado && (
              <Card
                title={`Despacho — carro ${prefixo.get(selecionado.veiculoId)}`}
                icon={Gauge}
                action={
                  <button onClick={() => setSelecionado(null)} className="text-[12.5px] text-muted-foreground underline">
                    fechar
                  </button>
                }
                bodyClassName="p-4"
              >
                <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px]">
                  <span className="text-muted-foreground">
                    Tabela <strong className="text-foreground">{selecionado.tabela}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Último ponto{" "}
                    <strong className="text-foreground">{pontoPorId.get(selecionado.ultimoPontoId)?.nome ?? "—"}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Velocidade <strong className="text-foreground">{selecionado.velocidadeKmh} km/h</strong>
                  </span>
                  <span className="text-muted-foreground">
                    A bordo{" "}
                    <strong className="text-foreground">
                      {selecionado.passageirosABordo}/{selecionado.lotacao}
                    </strong>
                  </span>
                  <Pill tone={desvioTone(selecionado.desvioMin)}>
                    {selecionado.desvioMin > 0 ? `${selecionado.desvioMin} min atrasado` : selecionado.desvioMin < 0 ? `${Math.abs(selecionado.desvioMin)} min adiantado` : "no horário"}
                  </Pill>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selecionado.desvioMin < -3 && (
                    <button
                      onClick={() => despachar(selecionado, "retido", `Adiantado ${Math.abs(selecionado.desvioMin)} min — regularizar headway`)}
                      className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-[13px] font-semibold text-white"
                    >
                      <PauseCircle className="h-4 w-4" />
                      Reter no ponto
                    </button>
                  )}
                  <button
                    onClick={() => despachar(selecionado, "liberado", "Liberado pelo CCO")}
                    className="inline-flex items-center gap-2 rounded-full bg-leaf px-4 py-2 text-[13px] font-semibold text-white"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Liberar
                  </button>
                  <button
                    onClick={() => despachar(selecionado, "retorno", "Retorno antecipado para fechar intervalo")}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-medium text-brand-navy hover:bg-secondary"
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Retornar sem completar
                  </button>
                  <button
                    onClick={() => despachar(selecionado, "recolhido", "Recolhimento à garagem")}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-medium text-brand-navy hover:bg-secondary"
                  >
                    <MapPin className="h-4 w-4" />
                    Recolher
                  </button>
                  <button
                    onClick={() => despachar(selecionado, "troca_motorista", "Troca de motorista solicitada")}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-medium text-brand-navy hover:bg-secondary"
                  >
                    <Users className="h-4 w-4" />
                    Trocar motorista
                  </button>
                </div>

                <p className="mt-3 text-[11.5px] text-muted-foreground">
                  Toda ação de despacho fica registrada na auditoria com operador, motivo e horário — é o que sustenta
                  a decisão depois, quando alguém perguntar por que o carro foi retido.
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
