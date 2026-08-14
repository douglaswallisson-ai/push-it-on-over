import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  Gauge,
  Info,
  Route,
  Wrench,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import {
  execucoesQuery,
  modelosQuery,
  nf,
  parametrosCatalogoQuery,
  regrasAjusteQuery,
  sinaisOperacaoQuery,
  veiculosQuery,
  vinculosModeloQuery,
} from "@/lib/queries";
import { calcularPreventivas, classificarOperacao } from "@/lib/preventiva";
import { registrarAuditoria } from "@/lib/session";
import { TIPO_OPERACAO_LABEL, URGENCIA_LABEL, type PreventivaPrevista, type UrgenciaPreventiva } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Plano preventivo calculado.
 *
 * Fecha o ciclo do catálogo: cruza o parâmetro do fabricante com o odômetro do
 * veículo e o histórico de execução, e diz o que vence quando.
 *
 * O que diferencia de uma tabela estática é o ajuste pela operação real. Um
 * veículo com marcha-lenta em 37% recebe intervalo encurtado, e a tela mostra a
 * justificativa — sem isso o número parece arbitrário e o gestor desconfia.
 */

const URGENCIA_TONE: Record<UrgenciaPreventiva, PillTone> = {
  vencida: "coral",
  critica: "coral",
  proxima: "gold",
  programada: "sky",
  em_dia: "green",
};

export function PlanoPreventivo({ garagem }: { garagem?: string }) {
  const veiculosQ = useQuery(veiculosQuery(1, 200));
  const modelosQ = useQuery(modelosQuery());
  const parametrosQ = useQuery(parametrosCatalogoQuery());
  const execucoesQ = useQuery(execucoesQuery());
  const regrasQ = useQuery(regrasAjusteQuery());
  const sinaisQ = useQuery(sinaisOperacaoQuery());
  const vinculosQ = useQuery(vinculosModeloQuery());

  const [filtro, setFiltro] = useState<UrgenciaPreventiva | "todas">("todas");
  const [aberto, setAberto] = useState<string | null>(null);
  const [agendadas, setAgendadas] = useState<Record<string, boolean>>({});

  const carregando =
    veiculosQ.isPending || modelosQ.isPending || parametrosQ.isPending || execucoesQ.isPending;

  /** Calcula tudo de uma vez: veículo → preventivas ordenadas por urgência. */
  const porVeiculo = useMemo(() => {
    const veiculos = veiculosQ.data?.items ?? [];
    const modelos = modelosQ.data ?? [];
    const parametros = parametrosQ.data ?? [];
    const execucoes = execucoesQ.data ?? [];
    const regras = regrasQ.data ?? [];
    const sinais = sinaisQ.data ?? {};
    const vinculos = vinculosQ.data ?? {};

    return veiculos
      .filter((v) => !garagem || v.garagemId === garagem)
      .map((v) => {
        const vinculo = vinculos[v.id];
        const modelo = modelos.find((m) => m.id === vinculo?.modeloId);
        const sinaisV = sinais[v.id] ?? {};

        const preventivas = calcularPreventivas(
          { ...v, modeloId: vinculo?.modeloId, montadoraId: vinculo?.montadoraId },
          modelo,
          parametros,
          execucoes,
          regras,
          sinaisV,
        );

        return {
          veiculo: v,
          modelo,
          operacao: classificarOperacao({
            marchaLentaPct: sinaisV.parado_motor_ligado,
            velocidadeMediaKmh: sinaisV.velocidade_media,
            paradasPorDia: sinaisV.paradas_por_dia,
          }),
          sinais: sinaisV,
          preventivas,
          semCatalogo: !modelo || preventivas.length === 0,
        };
      })
      .sort((a, b) => (b.preventivas[0]?.consumidoPct ?? 0) - (a.preventivas[0]?.consumidoPct ?? 0));
  }, [veiculosQ.data, modelosQ.data, parametrosQ.data, execucoesQ.data, regrasQ.data, sinaisQ.data, vinculosQ.data, garagem]);

  const todas = porVeiculo.flatMap((p) => p.preventivas);
  const conta = (u: UrgenciaPreventiva) => todas.filter((p) => p.urgencia === u).length;
  const semCatalogo = porVeiculo.filter((p) => p.semCatalogo).length;

  const lista = useMemo(
    () =>
      filtro === "todas"
        ? porVeiculo.filter((p) => p.preventivas.length > 0)
        : porVeiculo.filter((p) => p.preventivas.some((x) => x.urgencia === filtro)),
    [porVeiculo, filtro],
  );

  const agendar = (veiculoId: string, p: PreventivaPrevista, prefixo: string) => {
    setAgendadas((a) => ({ ...a, [`${veiculoId}-${p.parametroId}`]: true }));
    registrarAuditoria(
      "manutencao_preventiva",
      `Preventiva agendada — ${prefixo}: ${p.item}${p.intervaloAplicadoKm ? ` (intervalo ${nf(p.intervaloAplicadoKm)} km)` : ""}.`,
    );
    toast.success("Preventiva agendada.", { description: `${prefixo} · ${p.item}` });
  };

  if (veiculosQ.error) return <ErrorBox error={veiculosQ.error} onRetry={() => veiculosQ.refetch()} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={AlertTriangle} label="Vencidas" value={nf(conta("vencida"))} color="var(--coral)" />
        <StatTile icon={CalendarClock} label="Vencem em breve" value={nf(conta("critica"))} color="var(--coral)" foot="acima de 90% do intervalo" />
        <StatTile icon={Clock} label="Próximas" value={nf(conta("proxima"))} color="var(--gold)" foot="acima de 75%" />
        <StatTile
          icon={Info}
          label="Sem catálogo"
          value={nf(semCatalogo)}
          color={semCatalogo ? "var(--gold)" : "var(--leaf)"}
          foot="veículos sem parâmetro"
        />
      </div>

      {semCatalogo > 0 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-gold-line bg-gold-tint/40 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <p className="text-[12.5px] text-gold">
            <strong>
              {semCatalogo} veículo{semCatalogo > 1 ? "s" : ""} sem parâmetro de manutenção aplicável.
            </strong>{" "}
            Rodam e acumulam quilometragem, mas nunca entram na fila de preventiva. Configure o modelo em Administração
            › Catálogo de manutenção.
          </p>
        </div>
      )}

      <Card
        title="Plano preventivo por veículo"
        icon={Wrench}
        action={<Pill tone="sky">{lista.length} veículos</Pill>}
        bodyClassName="p-4"
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["todas", "vencida", "critica", "proxima", "programada", "em_dia"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setFiltro(u)}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                filtro === u ? "bg-brand-navy text-white" : "border border-border bg-white text-muted-foreground hover:bg-secondary",
              )}
            >
              {u === "todas" ? "Todos" : URGENCIA_LABEL[u]}
              {u !== "todas" && <span className="ml-1.5 font-mono opacity-70">{conta(u)}</span>}
            </button>
          ))}
        </div>

        {carregando ? (
          <SkeletonRows rows={6} />
        ) : lista.length === 0 ? (
          <EmptyNote>Nenhum veículo com preventiva nessa faixa.</EmptyNote>
        ) : (
          <div className="space-y-2.5">
            {lista.map(({ veiculo, modelo, operacao, sinais, preventivas }) => {
              const top = preventivas[0];
              const abertoAqui = aberto === veiculo.id;
              const prefixo = veiculo.prefixo ?? veiculo.placa;

              return (
                <div key={veiculo.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  <button
                    onClick={() => setAberto(abertoAqui ? null : veiculo.id)}
                    className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
                  >
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="font-mono text-[14px] font-bold text-foreground">{prefixo}</span>
                        <span className="font-mono text-[11.5px] text-muted-foreground">{veiculo.placa}</span>
                        {modelo?.propulsao === "eletrico" && <Zap className="h-3.5 w-3.5 text-gold" />}
                      </span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">
                        {modelo?.nome ?? "sem modelo"} · {nf(veiculo.odometro)} km
                      </span>
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-[11.5px] text-ink-soft">
                      <Route className="h-3 w-3" />
                      {TIPO_OPERACAO_LABEL[operacao].replace(/^\d+(:\d+)? — /, "")}
                    </span>

                    <span className="ml-auto flex items-center gap-2">
                      <span className="max-w-[220px] truncate text-[12.5px] text-ink-soft">{top?.item}</span>
                      {top && <Pill tone={URGENCIA_TONE[top.urgencia]}>{URGENCIA_LABEL[top.urgencia]}</Pill>}
                      <span className="font-mono text-[12px] text-muted-foreground">{preventivas.length} itens</span>
                    </span>
                  </button>

                  {abertoAqui && (
                    <div className="border-t border-border bg-secondary/20 px-4 py-3">
                      {/* Sinais que classificaram a operação. */}
                      <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted-foreground">
                        <Gauge className="h-3.5 w-3.5" />
                        <span>
                          Marcha-lenta <strong className="text-foreground">{sinais.parado_motor_ligado ?? "—"}%</strong>
                        </span>
                        <span>
                          Velocidade média <strong className="text-foreground">{sinais.velocidade_media ?? "—"} km/h</strong>
                        </span>
                        <span>
                          Paradas por dia <strong className="text-foreground">{sinais.paradas_por_dia ?? "—"}</strong>
                        </span>
                        <span>→ classificado como {TIPO_OPERACAO_LABEL[operacao]}</span>
                      </p>

                      <ul className="space-y-2">
                        {preventivas.map((p) => (
                          <ItemPreventiva
                            key={p.parametroId}
                            p={p}
                            agendada={Boolean(agendadas[`${veiculo.id}-${p.parametroId}`])}
                            onAgendar={() => agendar(veiculo.id, p, prefixo)}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-[11.5px] text-muted-foreground">
          O disparo é o que ocorrer primeiro entre quilometragem, horas e tempo. Itens cujo parâmetro não tem número
          oficial no catálogo ficam de fora do cálculo — melhor não avisar do que avisar com número estimado.
        </p>
      </Card>
    </div>
  );
}

function ItemPreventiva({
  p,
  agendada,
  onAgendar,
}: {
  p: PreventivaPrevista;
  agendada: boolean;
  onAgendar: () => void;
}) {
  const barra =
    p.urgencia === "vencida" || p.urgencia === "critica"
      ? "bg-coral"
      : p.urgencia === "proxima"
        ? "bg-gold"
        : "bg-leaf";

  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-soft">
              {p.sistema}
            </span>
            <span className="text-[13px] font-medium text-foreground">{p.item}</span>
          </div>
          {p.especificacao && <p className="mt-0.5 text-[11px] text-muted-foreground">{p.especificacao}</p>}
        </div>

        <span className="flex shrink-0 items-center gap-2">
          <Pill tone={URGENCIA_TONE[p.urgencia]}>{URGENCIA_LABEL[p.urgencia]}</Pill>
          {agendada ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-leaf-tint px-2 py-1 text-[11.5px] font-semibold text-leaf">
              <Check className="h-3 w-3" />
              Agendada
            </span>
          ) : (
            <button
              onClick={onAgendar}
              className="rounded-lg bg-brand-navy px-2.5 py-1 text-[11.5px] font-semibold text-white"
            >
              Agendar
            </button>
          )}
        </span>
      </div>

      {/* Consumo do intervalo. */}
      <div className="mt-2.5">
        <div className="flex items-baseline justify-between text-[11.5px]">
          <span className="text-muted-foreground">
            {p.kmRestante !== null && (
              <>
                {p.kmRestante < 0 ? (
                  <span className="font-semibold text-coral">{nf(Math.abs(p.kmRestante))} km em atraso</span>
                ) : (
                  <span>faltam {nf(p.kmRestante)} km</span>
                )}
              </>
            )}
            {p.diasRestante !== null && (
              <>
                {p.kmRestante !== null && <span className="mx-1.5">·</span>}
                {p.diasRestante < 0 ? (
                  <span className="font-semibold text-coral">{Math.abs(p.diasRestante)} dias em atraso</span>
                ) : (
                  <span>{p.diasRestante} dias</span>
                )}
              </>
            )}
            {p.disparoPor && <span className="ml-1.5 text-[10.5px]">(vence por {p.disparoPor})</span>}
          </span>
          <span className="font-mono font-semibold text-foreground">{p.consumidoPct}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className={cn("h-1.5 rounded-full", barra)} style={{ width: `${Math.min(100, p.consumidoPct)}%` }} />
        </div>
      </div>

      {/* Intervalo aplicado e por que foi encurtado. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
        {p.intervaloOriginalKm !== null && (
          <span className="text-muted-foreground">
            Intervalo{" "}
            {p.ajustes.length > 0 ? (
              <>
                <span className="line-through">{nf(p.intervaloOriginalKm)}</span>{" "}
                <strong className="text-gold">{nf(p.intervaloAplicadoKm ?? 0)} km</strong>
              </>
            ) : (
              <strong className="text-foreground">{nf(p.intervaloOriginalKm)} km</strong>
            )}
          </span>
        )}
        {p.ultimaExecucaoEm ? (
          <span className="text-muted-foreground">
            Última em {new Date(p.ultimaExecucaoEm).toLocaleDateString("pt-BR")}
            {p.odometroUltimaExecucao !== null ? ` · ${nf(p.odometroUltimaExecucao)} km` : ""}
          </span>
        ) : (
          <span className="text-gold">sem histórico — contando a partir do odômetro atual</span>
        )}
      </div>

      {p.ajustes.map((a, i) => (
        <p key={i} className="mt-1.5 flex items-start gap-1.5 rounded bg-gold-tint/50 px-2 py-1 text-[11px] text-gold">
          <Gauge className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Intervalo reduzido para {Math.round(a.fator * 100)}% — {a.nome.toLowerCase()}: {a.motivo}.
          </span>
        </p>
      ))}
    </li>
  );
}
