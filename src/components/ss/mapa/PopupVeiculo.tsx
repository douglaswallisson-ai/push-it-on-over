import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import {
  AlertTriangle,
  Clock,
  Gauge,
  MapPin,
  Play,
  Route,
  Siren,
  Timer,
  TrendingUp,
  User,
  Video,
  Wrench,
} from "lucide-react";
import { desde, nf, trackingQuery } from "@/lib/queries";
import { resumoTracking } from "@/lib/mock-data";
import { EVENTO_TRACKING_LABEL, ESTADO_MAPA_LABEL, type EstadoMapa } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Detalhe do veículo no mapa.
 *
 * O balão anterior mostrava placa, velocidade e endereço — o mesmo que já
 * estava no marcador e na lista lateral, então clicar não trazia informação
 * nova. Aqui o clique responde o que o operador realmente pergunta: quem está
 * dirigindo, o que o carro fez hoje, e o que precisa de tratativa.
 *
 * Os botões levam para as telas onde a ação acontece. Sem eles o operador
 * precisaria memorizar o prefixo, sair do mapa e procurar o veículo de novo.
 */

const hhmm = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const COR_ESTADO: Record<string, string> = {
  evento_critico: "text-coral",
  manutencao: "text-gold",
  em_viagem: "text-leaf",
  ligado_parado: "text-gold",
  desligado: "text-muted-foreground",
  sem_transmissao: "text-foreground",
};

export function PopupVeiculo({
  placa,
  rotulo,
  veiculoId,
  estado,
  velocidade,
  endereco,
  atualizado,
  motorista,
  linha,
  eventosAbertos = 0,
}: {
  placa: string;
  rotulo: string;
  veiculoId?: string;
  estado: EstadoMapa | string;
  velocidade: number;
  endereco?: string;
  atualizado?: string;
  motorista?: string;
  linha?: string;
  eventosAbertos?: number;
}) {
  const navigate = useNavigate();
  const trackingQ = useQuery(trackingQuery(veiculoId));

  const resumo = useMemo(() => (veiculoId ? resumoTracking(veiculoId) : null), [veiculoId]);

  /** Últimos eventos do dia, do mais recente para trás. */
  const ultimos = useMemo(
    () => [...(trackingQ.data ?? [])].sort((a, b) => b.em.localeCompare(a.em)).slice(0, 4),
    [trackingQ.data],
  );

  return (
    <div className="w-[300px] text-[12.5px]">
      {/* Identificação. */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
        <div>
          <div className="font-mono text-[17px] font-bold leading-none text-slate-800">{rotulo}</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">{placa}</div>
        </div>
        <span className={cn("text-right text-[11.5px] font-semibold", COR_ESTADO[estado] ?? "text-slate-500")}>
          {ESTADO_MAPA_LABEL[estado as EstadoMapa] ?? estado}
          <span className="block font-mono text-[15px] font-bold text-slate-800">{velocidade} km/h</span>
        </span>
      </div>

      {/* Contexto imediato. */}
      <dl className="mt-2 space-y-1">
        {motorista && (
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate text-slate-700">{motorista}</span>
          </div>
        )}
        {linha && (
          <div className="flex items-center gap-1.5">
            <Route className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate text-slate-700">{linha}</span>
          </div>
        )}
        {endereco && (
          <div className="flex items-start gap-1.5">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="text-slate-600">{endereco}</span>
          </div>
        )}
        {atualizado && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="text-slate-500">atualizado {atualizado}</span>
          </div>
        )}
      </dl>

      {/* O dia do veículo. */}
      {resumo && (
        <div className="mt-2.5 rounded-lg bg-slate-50 p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <Timer className="h-3 w-3" />
            Hoje
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <Metrica rotulo="Ligado" valor={hhmm(resumo.minutosLigado)} />
            <Metrica rotulo="Em movimento" valor={hhmm(resumo.minutosEmMovimento)} />
            <Metrica
              rotulo="Ligado parado"
              valor={hhmm(resumo.minutosLigadoParado)}
              alerta={resumo.minutosLigadoParado > 60}
            />
            <Metrica rotulo="Paradas" valor={String(resumo.paradas)} />
            <Metrica rotulo="Percorrido" valor={`${nf(resumo.kmPercorrido)} km`} />
            <Metrica rotulo="Vel. máxima" valor={`${resumo.velocidadeMaxima} km/h`} alerta={resumo.velocidadeMaxima > 70} />
          </div>
          {resumo.primeiraIgnicao && (
            <p className="mt-1.5 border-t border-slate-200 pt-1.5 text-[11px] text-slate-500">
              Primeira ignição {hora(resumo.primeiraIgnicao)}
              {resumo.ultimaIgnicao ? ` · desligou ${hora(resumo.ultimaIgnicao)}` : " · ainda em operação"}
            </p>
          )}
        </div>
      )}

      {/* Últimos eventos de percurso. */}
      {ultimos.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Últimos eventos
          </div>
          <ul className="space-y-0.5">
            {ultimos.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2">
                <span className="w-9 shrink-0 font-mono text-[11px] text-slate-500">{hora(e.em)}</span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[11.5px]",
                    e.tipo === "excesso_velocidade" ? "font-semibold text-coral" : "text-slate-700",
                  )}
                >
                  {EVENTO_TRACKING_LABEL[e.tipo]}
                  {e.duracaoMin ? ` · ${e.duracaoMin} min` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {eventosAbertos > 0 && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-coral-tint px-2.5 py-1.5 text-[11.5px] font-medium text-coral">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {eventosAbertos} evento{eventosAbertos > 1 ? "s" : ""} aguardando tratativa
        </div>
      )}

      {/* Ações. */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-slate-200 pt-2.5">
        <Acao icone={Siren} rotulo="Eventos" onClick={() => navigate("/app/eventos")} destaque={eventosAbertos > 0} />
        <Acao icone={Video} rotulo="Câmeras" onClick={() => navigate("/app/seguranca/video")} />
        <Acao icone={TrendingUp} rotulo="Desempenho" onClick={() => navigate("/app/frota/analise")} />
        <Acao icone={Wrench} rotulo="Manutenção" onClick={() => navigate(`/app/manutencao?placa=${placa}`)} />
        <Acao icone={Play} rotulo="Percurso do dia" onClick={() => navigate(`/app/frota/tracking?veiculo=${veiculoId ?? placa}`)} full />
      </div>
    </div>
  );
}

function Metrica({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-1.5">
      <span className="text-[11px] text-slate-500">{rotulo}</span>
      <span className={cn("font-mono text-[12px] font-semibold", alerta ? "text-coral" : "text-slate-800")}>{valor}</span>
    </div>
  );
}

function Acao({
  icone: Icone,
  rotulo,
  onClick,
  destaque,
  full,
}: {
  icone: typeof Gauge;
  rotulo: string;
  onClick: () => void;
  destaque?: boolean;
  full?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11.5px] font-medium transition-colors",
        destaque
          ? "border-coral bg-coral text-white hover:opacity-90"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        full && "col-span-2",
      )}
    >
      <Icone className="h-3.5 w-3.5" />
      {rotulo}
    </button>
  );
}
