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
import { SeloDadosExemplo } from "@/components/ss/ui/SeloDadosExemplo";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { MapaCliente } from "@/components/ss/mapa/MapaCliente";
import { nf, trackingQuery, veiculosQuery } from "@/lib/queries";
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
  const veiculosQ = useQuery(veiculosQuery(1, 200));
  const [veiculoId, setVeiculoId] = useState("v1");
  const [focado, setFocado] = useState<string | null>(null);

  const trackingQ = useQuery(trackingQuery(veiculoId));

  const veiculo = veiculosQ.data?.items.find((v) => v.id === veiculoId);
  const eventos = useMemo(
    () => [...(trackingQ.data ?? [])].sort((a, b) => a.em.localeCompare(b.em)),
    [trackingQ.data],
  );

  const resumo = useMemo(() => resumoTracking(veiculoId), [veiculoId]);

  /** Traçado do percurso: só os pontos, na ordem cronológica. */
  const percurso = useMemo(() => eventos.map((e) => [e.lat, e.lng] as [number, number]), [eventos]);

  /**
   * Marcadores do mapa: o evento focado ou o último ponto. Plotar os 20 eventos
   * como veículo confundiria — o traçado já mostra o caminho.
   */
  const marcadores = useMemo(() => {
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
  }, [eventos, focado, veiculo, veiculoId]);

  return (
    <>
      <PageHeader
        title="Percurso do dia"
        subtitle="Frota › Tracking de eventos"
        actions={
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
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        <SeloDadosExemplo motivo="Os eventos de percurso ainda não têm endpoint; o histórico bruto existe em /reports/History." />

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
                  <EmptyNote>Nenhum evento de percurso para este veículo hoje.</EmptyNote>
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
                <MapaCliente
                  veiculos={marcadores}
                  selecionado={marcadores[0]?.placa ?? null}
                  onSelect={() => {}}
                  altura="h-[420px] lg:h-[560px]"
                  percurso={percurso}
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  A linha liga os eventos na ordem em que aconteceram. Não é o traçado exato da rua — para isso seria
                  preciso o histórico completo de posições, não só os eventos.
                </p>
              </Card>
            </div>
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
