import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  Fuel,
  Gauge,
  KeyRound,
  MapPin,
  PauseCircle,
  PlayCircle,
  PowerOff,
  Route,
  Timer,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { MapaCliente } from "@/components/ss/mapa/MapaCliente";
import { PerfilElevacao } from "@/components/ss/frota/PerfilElevacao";
import { relevoTrajetoQuery } from "@/lib/relevo-api";
import { COR_EVENTO, ROTULO_EVENTO } from "@/lib/bi-api";
import { nf, trackingApiQuery, trackingQuery, veiculosApiQuery, veiculosQuery } from "@/lib/queries";
import { usandoMock } from "@/lib/modo";
import { resumoTracking } from "@/lib/mock-data";
import { EVENTO_TRACKING_LABEL, type EventoTracking, type TipoEventoTracking } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Percurso do dia.
 *
 * Responde a pergunta que o mapa ao vivo não responde: o carro está ali agora,
 * mas o que ele fez das 5 às 14? Sem a sequência de ignição, parada e retomada
 * não há como conferir jornada, justificar consumo nem reconstituir um sinistro.
 *
 * A linha do tempo e o traçado são a mesma informação em duas leituras: clicar
 * num evento move o mapa até ele.
 */

const ICONE: Record<TipoEventoTracking, typeof Clock> = {
  ignicao_ligada: KeyRound,
  inicio_viagem: PlayCircle,
  parada: PauseCircle,
  ligado_parado: Fuel,
  retomada: PlayCircle,
  ignicao_desligada: PowerOff,
  excesso_velocidade: Gauge,
  cerca_entrada: MapPin,
  cerca_saida: MapPin,
};

const TOM: Record<TipoEventoTracking, PillTone> = {
  ignicao_ligada: "sky",
  inicio_viagem: "green",
  parada: "neutral",
  ligado_parado: "gold",
  retomada: "green",
  ignicao_desligada: "neutral",
  excesso_velocidade: "coral",
  cerca_entrada: "sky",
  cerca_saida: "sky",
};

const hhmm = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function Tracking() {
  // Ligado à API, a frota real. A lista de exemplo e o "v1" fixo deixavam a
  // tela aberta num veículo que não existe no banco, com o seletor vazio.
  const exemploQ = useQuery({ ...veiculosQuery(1, 200), enabled: usandoMock() });
  const realQ = useQuery(veiculosApiQuery(1, 200));
  const veiculosQ = usandoMock() ? exemploQ : realQ;
  const [escolhido, setVeiculoId] = useState<string | null>(null);
  // O balão do mapa abre esta tela com `?veiculo=<id ou placa>`. Antes o
  // parâmetro era ignorado e a tela abria em outro veículo.
  const pedido = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("veiculo") : null;
  const lista = veiculosQ.data?.items ?? [];
  const veiculoId =
    escolhido ??
    lista.find((v) => v.id === pedido || v.placa === pedido)?.id ??
    lista[0]?.id ??
    (usandoMock() ? "v1" : "");
  const [focado, setFocado] = useState<string | null>(null);

  const mockQ = useQuery(trackingQuery(veiculoId));
  // Data local: toISOString() é UTC e, depois das 21h, já marcava o dia seguinte.
  const hojeLocal = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  // Vindo de outra tela (ex.: evento no gráfico de Veículos): dia e ponto em foco pelo endereço.
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [hoje, setDia] = useState(() => (params?.get("dia") && /^d{4}-d{2}-d{2}$/.test(params.get("dia")!) ? params.get("dia")! : hojeLocal));
  const [foco, setFoco] = useState<{ lat: number; lng: number; titulo: string; detalhe?: string } | null>(() => {
    const f = params?.get("foco")?.split(",").map(Number);
    return f && f.length === 2 && f.every(Number.isFinite) ? { lat: f[0], lng: f[1], titulo: params?.get("focoTitulo") ?? "Evento" } : null;
  });
  const apiQ = useQuery(trackingApiQuery(veiculoId, hoje));
  // Posições do dia com a elevação de cada uma: perfil e traçado real.
  const relevoQ = useQuery(relevoTrajetoQuery(veiculoId || undefined, hoje));
  const [pontoHover, setPontoHover] = useState<number | null>(null);

  /**
   * Ligado à API, os eventos vêm derivados no servidor a partir das posições —
   * o front não reconstrói nada. Os nomes de campo diferem (`type` em vez de
   * `tipo`), então a conversão acontece aqui.
   */
  const daApi = apiQ.data as
    | { events: { id: number; type: string; timestamp: string; latitude: number; longitude: number; speed?: number; address?: string; duration_min?: number }[]; summary: Record<string, number | string | null> }
    | undefined;

  const trackingQ = usandoMock() ? mockQ : apiQ;

  const veiculo = veiculosQ.data?.items.find((v) => v.id === veiculoId);
  const eventos = useMemo(() => {
    if (!usandoMock() && daApi?.events) {
      return daApi.events.map((e) => ({
        id: String(e.id),
        veiculoId: veiculoId,
        tipo: e.type as EventoTracking["tipo"],
        em: e.timestamp,
        lat: e.latitude,
        lng: e.longitude,
        endereco: e.address ?? undefined,
        velocidade: e.speed ?? 0,
        duracaoMin: e.duration_min ?? undefined,
      })) as EventoTracking[];
    }
    return [...(mockQ.data ?? [])].sort((a, b) => a.em.localeCompare(b.em));
  }, [daApi, mockQ.data, veiculoId]);

  const resumo = useMemo(() => {
    if (!usandoMock() && daApi?.summary) {
      const s = daApi.summary as Record<string, number>;
      return {
        veiculoId,
        data: hoje,
        primeiraIgnicao: (daApi.summary.first_ignition as string) ?? undefined,
        ultimaIgnicao: (daApi.summary.last_ignition as string) ?? undefined,
        minutosLigado: s.minutes_on ?? 0,
        minutosEmMovimento: s.minutes_moving ?? 0,
        minutosLigadoParado: s.minutes_idle ?? 0,
        paradas: s.stops ?? 0,
        kmPercorrido: s.distance_km ?? 0,
        velocidadeMaxima: s.max_speed ?? 0,
      };
    }
    // Sem resumo do servidor, nada — o exemplo aqui aparecia como o dia real.
    return usandoMock() ? resumoTracking(veiculoId) : null;
  }, [daApi, veiculoId, hoje]);

  /** Traçado do percurso: só os pontos, na ordem cronológica. */
  const percurso = useMemo(() => {
    const pts = relevoQ.data?.pontos ?? [];
    if (pts.length > 1) return pts.map((p) => [p.lat, p.lon] as [number, number]);
    return eventos.map((e) => [e.lat, e.lng] as [number, number]);
  }, [eventos, relevoQ.data]);

  /**
   * Marcadores do mapa: o evento focado ou o último ponto. Plotar os 20 eventos
   * como veículo confundiria — o traçado já mostra o caminho.
   */
  // Eventos de condução no lugar exato em que aconteceram.
  const eventosMapa = useMemo(
    () =>
      (relevoQ.data?.eventos ?? []).map((e) => ({
        lat: e.lat,
        lng: e.lon,
        cor: COR_EVENTO[e.tipo] ?? "#1B3A6B",
        titulo: ROTULO_EVENTO[e.tipo] ?? e.evento ?? "Evento",
        hora: e.hora.slice(0, 5),
        detalhe: `${e.velocidade ?? 0} km/h${e.km != null ? ` · km ${e.km.toFixed(1)} do dia` : ""}`,
      })),
    [relevoQ.data],
  );
  const contagemEventos = useMemo(() => {
    const m = new Map<string, { n: number; cor: string }>();
    for (const e of eventosMapa) m.set(e.titulo, { n: (m.get(e.titulo)?.n ?? 0) + 1, cor: e.cor });
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [eventosMapa]);

  const marcadores = useMemo(() => {
    const ph = pontoHover != null ? relevoQ.data?.pontos[pontoHover] : undefined;
    if (ph) {
      return [
        {
          placa: veiculo?.placa ?? veiculoId,
          rotulo: veiculo?.prefixo ?? veiculo?.placa ?? veiculoId,
          veiculoId,
          lat: ph.lat,
          lng: ph.lon,
          situacao: (ph.velocidade ?? 0) > 3 ? "em_viagem" : "ligado_parado",
          velocidade: ph.velocidade ?? 0,
          endereco: `${ph.elevacao != null ? Math.round(ph.elevacao) + " m de altitude" : ""}`,
          atualizado: ph.hora,
        },
      ];
    }
    const alvo = focado ? eventos.find((e) => e.id === focado) : eventos[eventos.length - 1];
    if (!alvo) return [];
    return [
      {
        placa: veiculo?.placa ?? veiculoId,
        rotulo: veiculo?.prefixo ?? veiculo?.placa ?? veiculoId,
        veiculoId,
        lat: alvo.lat,
        lng: alvo.lng,
        situacao: alvo.tipo === "ignicao_desligada" ? "desligado" : alvo.velocidade ? "em_viagem" : "ligado_parado",
        velocidade: alvo.velocidade ?? 0,
        endereco: alvo.endereco,
        atualizado: hora(alvo.em),
      },
    ];
  }, [eventos, focado, veiculo, veiculoId, pontoHover, relevoQ.data]);

  return (
    <>
      <PageHeader
        title="Percurso do dia"
        subtitle="Frota › Tracking de eventos"
        actions={
          <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={hoje}
            max={hojeLocal}
            onChange={(e) => e.target.value && setDia(e.target.value)}
            aria-label="Dia"
            className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
          />
          <select
            value={veiculoId}
            onChange={(e) => {
              setVeiculoId(e.target.value);
              setFocado(null);
            }}
            className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
          >
            {(veiculosQ.data?.items ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.prefixo ?? v.placa} — {v.placa}
              </option>
            ))}
          </select>
          </div>
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">

        {trackingQ.error ? (
          <ErrorBox error={trackingQ.error} onRetry={() => trackingQ.refetch()} />
        ) : (
          <>
            {resumo && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <StatTile icon={Timer} label="Tempo ligado" value={hhmm(resumo.minutosLigado)} color="var(--brand-navy)" />
                <StatTile icon={PlayCircle} label="Em movimento" value={hhmm(resumo.minutosEmMovimento)} color="var(--leaf)" />
                <StatTile
                  icon={Fuel}
                  label="Ligado parado"
                  value={hhmm(resumo.minutosLigadoParado)}
                  color={resumo.minutosLigadoParado > 60 ? "var(--coral)" : "var(--gold)"}
                  foot="motor consumindo sem rodar"
                />
                <StatTile icon={Route} label="Percorrido" value={`${nf(resumo.kmPercorrido)}`} unit="km" color="var(--brand-sky)" />
                <StatTile
                  icon={TrendingUp}
                  label="Velocidade máxima"
                  value={`${resumo.velocidadeMaxima}`}
                  unit="km/h"
                  color={resumo.velocidadeMaxima > 70 ? "var(--coral)" : "var(--leaf)"}
                />
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
              {/* Linha do tempo. */}
              <Card
                title="Eventos do dia"
                icon={Clock}
                action={<Pill tone="sky">{eventos.length}</Pill>}
                bodyClassName="p-3"
              >
                {trackingQ.isPending ? (
                  <SkeletonRows rows={6} />
                ) : eventos.length === 0 ? (
                  <EmptyNote>Nenhum evento de percurso para este veículo neste dia.</EmptyNote>
                ) : (
                  <ol className="max-h-[560px] space-y-0.5 overflow-y-auto pr-1">
                    {eventos.map((e, i) => (
                      <ItemEvento
                        key={e.id}
                        e={e}
                        primeiro={i === 0}
                        ultimo={i === eventos.length - 1}
                        focado={focado === e.id}
                        onClick={() => setFocado(focado === e.id ? null : e.id)}
                      />
                    ))}
                  </ol>
                )}
                <p className="mt-2 px-1 text-[11px] text-muted-foreground">
                  Clique num evento para centralizar o mapa nele.
                </p>
              </Card>

              {/* Mapa com o traçado. */}
              <Card title="Traçado" icon={Route} bodyClassName="p-3">
                <div id="mapa-tracking">
                <MapaCliente
                  veiculos={marcadores}
                  selecionado={marcadores[0]?.placa ?? null}
                  onSelect={() => {}}
                  altura="h-[420px] lg:h-[560px]"
                  percurso={percurso}
                  eventos={eventosMapa}
                  foco={foco}
                />
                </div>
                {contagemEventos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {contagemEventos.map(([nome, c]) => (
                      <span key={nome} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-2.5 py-0.5 text-[11.5px]">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} />
                        {nome} <b>{c.n}</b>
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {(relevoQ.data?.pontos.length ?? 0) > 1
                    ? "Traçado pelas posições registradas com o veículo andando."
                    : "A linha liga os eventos na ordem em que aconteceram — não é o traçado exato da rua."}
                </p>
              </Card>
            </div>

            {!usandoMock() && (
              <PerfilElevacao
                dados={relevoQ.data}
                carregando={relevoQ.isLoading}
                erro={relevoQ.error}
                onHover={setPontoHover}
                rotuloVeiculo={veiculo?.prefixo ?? veiculo?.placa ?? veiculoId}
                onVerNoMapa={(e) => {
                  setFoco({ lat: e.lat, lng: e.lon, titulo: e.evento ?? "Evento", detalhe: e.hora.slice(0, 5) });
                  document.getElementById("mapa-tracking")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

function ItemEvento({
  e,
  primeiro,
  ultimo,
  focado,
  onClick,
}: {
  e: EventoTracking;
  primeiro: boolean;
  ultimo: boolean;
  focado: boolean;
  onClick: () => void;
}) {
  const Icone = ICONE[e.tipo];
  const critico = e.tipo === "excesso_velocidade";

  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "flex w-full gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors",
          focado ? "bg-navy-tint" : "hover:bg-secondary",
        )}
      >
        <span className="w-10 shrink-0 pt-0.5 text-right font-mono text-[11.5px] font-semibold text-muted-foreground">
          {hora(e.em)}
        </span>

        {/* Fio da linha do tempo. */}
        <span className="relative flex w-5 shrink-0 justify-center">
          {!primeiro && <span className="absolute -top-1.5 bottom-1/2 w-px bg-border" />}
          {!ultimo && <span className="absolute top-1/2 -bottom-1.5 w-px bg-border" />}
          <span
            className={cn(
              "relative z-10 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-card",
              critico ? "border-coral text-coral" : "border-border text-muted-foreground",
            )}
          >
            <Icone className="h-3 w-3" />
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={cn("text-[13px] font-medium", critico ? "text-coral" : "text-foreground")}>
              {EVENTO_TRACKING_LABEL[e.tipo]}
            </span>
            {e.duracaoMin ? <Pill tone={TOM[e.tipo]}>{e.duracaoMin} min</Pill> : null}
            {e.velocidade ? (
              <span className={cn("font-mono text-[11.5px]", critico ? "font-semibold text-coral" : "text-muted-foreground")}>
                {e.velocidade} km/h
              </span>
            ) : null}
          </span>
          {e.endereco && <span className="block truncate text-[11.5px] text-muted-foreground">{e.endereco}</span>}
        </span>
      </button>
    </li>
  );
}
