import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  Camera,
  CheckCircle2,
  Cpu,
  Eye,
  Play,
  ShieldAlert,
  ThumbsDown,
  Radio,
  Video,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { videoOcorrenciasApiQuery } from "@/lib/queries";
import { ex, usandoMock } from "@/lib/modo";
import { AoVivo } from "@/components/ss/video/AoVivo";
import { AoVivoReal } from "@/components/ss/video/AoVivoReal";
import { Gravacoes } from "@/components/ss/video/Gravacoes";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { desde, nf, veiculosQuery, videoOcorrenciasQuery, videoVolumeQuery } from "@/lib/queries";
import { registrarAuditoria } from "@/lib/session";
import {
  ALARME_VIDEO_CLASSE,
  ALARME_VIDEO_LABEL,
  TRATATIVA_LABEL,
  type NivelRisco,
  type OcorrenciaVideo,
  type StatusTratativa,
  type TipoAlarmeVideo,
} from "@/types";
import { cn } from "@/lib/utils";

/**
 * Central de videotelemetria (DMS/ADAS).
 *
 * A detecção já existia no módulo de Eventos. O que faltava — e é onde o
 * concorrente está à frente — é a **gestão** do evento: fila de tratativa com
 * estado, classificação de risco e separação entre alarme de comportamento e
 * alarme de saúde do próprio equipamento.
 *
 * Essa última distinção importa: "calibração anormal" e "baixa voltagem" não
 * são problema do motorista, são problema da câmera. Misturar os dois na mesma
 * lista faz o gestor cobrar a pessoa errada.
 */

const RISCO_TONE: Record<NivelRisco, PillTone> = { alto: "coral", medio: "gold", baixo: "sky" };
const RISCO_LABEL: Record<NivelRisco, string> = { alto: "Alto", medio: "Médio", baixo: "Baixo" };

const STATUS_TONE: Record<StatusTratativa, PillTone> = {
  aguardando: "coral",
  em_analise: "gold",
  tratado: "green",
  descartado: "neutral",
};

const CLASSE_LABEL = {
  comportamento: "Comportamento do motorista",
  seguranca: "Segurança de condução",
  equipamento: "Saúde do equipamento",
} as const;

/** Nome e classe: o que a API manda vence a tabela fixa, que não cobre todo modelo de câmera. */
const rotuloDe = (o: OcorrenciaVideo) => o.rotulo ?? ALARME_VIDEO_LABEL[o.tipo] ?? o.tipo;
const classeDe = (o: OcorrenciaVideo) => o.classe ?? ALARME_VIDEO_CLASSE[o.tipo];

export default function Videotelemetria() {
  const mockOcorrQ = useQuery(videoOcorrenciasQuery());
  const apiOcorrQ = useQuery(videoOcorrenciasApiQuery({ limit: 300 }));

  /**
   * Conectado à API, as ocorrências vêm de `vcms_history` (alarmes gravados
   * pela câmera) já classificadas em DMS, ADAS e equipamento. A conversão para
   * o formato da tela acontece aqui, mantendo filtros e contadores intactos.
   */
  const daApi = apiOcorrQ.data as
    | {
        items: {
          id: number;
          vehicle_id?: number;
          vehicle_label?: string;
          vehicle_prefix?: string;
          event_type?: string;
          category: string;
          severity?: string;
          timestamp?: string;
          description?: string;
          data?: { speed?: number | null };
          has_clip: boolean;
          acknowledged?: boolean;
        }[];
        summary: { total: number; pending: number; dms: number; adas: number; equipment: number };
      }
    | undefined;

  const ocorrenciasQ = usandoMock() ? mockOcorrQ : apiOcorrQ;
  const volumeQ = useQuery(videoVolumeQuery());
  const veiculosQ = useQuery(veiculosQuery(1, 200));

  const [aba, setAba] = useState<"ao_vivo" | "ocorrencias" | "gravacoes">("ao_vivo");
  const [statusFiltro, setStatusFiltro] = useState<StatusTratativa | "todas">("aguardando");
  const [riscoFiltro, setRiscoFiltro] = useState<NivelRisco | "todos">("todos");
  const [classeFiltro, setClasseFiltro] = useState<keyof typeof CLASSE_LABEL | "todas">("todas");
  const [alteracoes, setAlteracoes] = useState<Record<string, StatusTratativa>>({});

  const prefixo = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of veiculosQ.data?.items ?? []) m.set(v.id, v.prefixo ?? v.placa);
    return m;
  }, [veiculosQ.data]);

  const ocorrencias = useMemo(() => {
    if (!usandoMock() && daApi?.items) {
      const risco = (sev?: string): NivelRisco =>
        sev === "critical" ? "alto" : sev === "warning" ? "medio" : "baixo";
      const classe = { dms: "comportamento", adas: "seguranca", equipamento: "equipamento" } as const;
      return daApi.items.map((o) => ({
        id: String(o.id),
        tipo: (o.event_type ?? "distracao") as TipoAlarmeVideo,
        rotulo: o.description,
        classe: classe[o.category as keyof typeof classe],
        veiculoRotulo: o.vehicle_prefix || o.vehicle_label,
        risco: risco(o.severity),
        veiculoId: String(o.vehicle_id ?? ""),
        em: o.timestamp ?? new Date().toISOString(),
        velocidadeKmh: o.data?.speed ?? undefined,
        imei: "",
        // Sem clipe não há o que revisar; o backend informa se a mídia existe.
        clipeDisponivel: o.has_clip,
        status: (alteracoes[String(o.id)] ??
          (o.acknowledged ? "tratado" : "aguardando")) as StatusTratativa,
      })) as OcorrenciaVideo[];
    }
    return (mockOcorrQ.data ?? []).map((o) => ({ ...o, status: alteracoes[o.id] ?? o.status }));
  }, [daApi, mockOcorrQ.data, alteracoes]);

  const aguardando = ocorrencias.filter((o) => o.status === "aguardando");
  const total = ocorrencias.length;

  /** Distribuição de risco — leitura de abertura do painel. */
  const distRisco = (["alto", "medio", "baixo"] as NivelRisco[]).map((r) => {
    const n = ocorrencias.filter((o) => o.risco === r).length;
    return { risco: r, n, pct: total ? (n / total) * 100 : 0 };
  });

  const lista = useMemo(
    () =>
      ocorrencias.filter((o) => {
        if (statusFiltro !== "todas" && o.status !== statusFiltro) return false;
        if (riscoFiltro !== "todos" && o.risco !== riscoFiltro) return false;
        if (classeFiltro !== "todas" && classeDe(o) !== classeFiltro) return false;
        return true;
      }),
    [ocorrencias, statusFiltro, riscoFiltro, classeFiltro],
  );

  const volume = volumeQ.data ?? {};
  const volumeOrdenado = Object.entries(volume)
    .map(([t, n]) => ({ tipo: t as TipoAlarmeVideo, n }))
    .sort((a, b) => b.n - a.n);
  const maiorVolume = volumeOrdenado[0]?.n ?? 1;

  const mudar = (o: OcorrenciaVideo, novo: StatusTratativa) => {
    setAlteracoes((a) => ({ ...a, [o.id]: novo }));
    registrarAuditoria(
      "tratativa_video",
      `${TRATATIVA_LABEL[novo]}: ${rotuloDe(o)} · veículo ${prefixo.get(o.veiculoId) ?? o.veiculoRotulo ?? o.veiculoId}.`,
    );
    toast.success(TRATATIVA_LABEL[novo], { description: rotuloDe(o) });
  };

  const COLS: Column<OcorrenciaVideo & Record<string, unknown>>[] = [
    {
      key: "risco",
      header: "Risco",
      align: "center",
      render: (o) => <Pill tone={RISCO_TONE[o.risco]}>{RISCO_LABEL[o.risco]}</Pill>,
    },
    {
      key: "tipo",
      header: "Ocorrência",
      render: (o) => (
        <div>
          <div className="text-[13px] font-medium text-foreground">{rotuloDe(o)}</div>
          <div className="text-[12px] text-muted-foreground">{CLASSE_LABEL[classeDe(o)]}</div>
        </div>
      ),
    },
    {
      key: "veiculoId",
      header: "Veículo",
      render: (o) => (
        <span className="whitespace-nowrap font-mono text-[13px] font-semibold text-foreground">
          {prefixo.get(o.veiculoId) ?? o.veiculoRotulo ?? "—"}
        </span>
      ),
    },
    {
      key: "em",
      header: "Quando",
      render: (o) => (
        <span className="whitespace-nowrap font-mono text-[13px] text-ink-soft" title={new Date(o.em).toLocaleString("pt-BR")}>
          {desde(o.em)}
        </span>
      ),
    },
    {
      key: "velocidadeKmh",
      header: "Velocidade",
      align: "right",
      render: (o) => <span className="font-mono text-[13px]">{o.velocidadeKmh ?? "—"} km/h</span>,
    },
    {
      key: "clipeDisponivel",
      header: "Clipe",
      align: "center",
      render: (o) =>
        o.clipeDisponivel ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.info("Reprodução do clipe", {
                description: `${rotuloDe(o)} · ${o.duracaoS}s · aguardando o serviço de mídia.`,
              });
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-brand-navy transition-colors hover:bg-secondary"
            aria-label="Reproduzir clipe"
          >
            <Play className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="text-[12px] text-muted-foreground">sem vídeo</span>
        ),
    },
    {
      key: "status",
      header: "Tratativa",
      render: (o) => <Pill tone={STATUS_TONE[o.status]}>{TRATATIVA_LABEL[o.status]}</Pill>,
    },
    {
      key: "acoes",
      header: "",
      align: "right",
      render: (o) =>
        o.status === "tratado" || o.status === "descartado" ? (
          <span className="text-[12px] text-muted-foreground">{o.tratadoPor ?? "—"}</span>
        ) : (
          <span className="flex justify-end gap-1.5">
            {o.status === "aguardando" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  mudar(o, "em_analise");
                }}
                className="rounded-lg border border-border bg-white px-2 py-1 text-[12px] font-medium text-brand-navy hover:bg-secondary"
              >
                Analisar
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                mudar(o, "tratado");
              }}
              className="rounded-lg bg-brand-navy px-2 py-1 text-[12px] font-semibold text-white"
            >
              Tratar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                mudar(o, "descartado");
              }}
              title="Falso positivo"
              className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
            >
              <ThumbsDown className="h-3 w-3" />
            </button>
          </span>
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Videotelemetria" subtitle="Segurança › Câmeras, ocorrências e gravações" />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">

        {/* Três formas de olhar o mesmo veículo: agora, o que já aconteceu e
            o que ficou gravado. */}
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-card">
          {([
            { id: "ao_vivo", label: "Tempo real", icon: Radio },
            { id: "ocorrencias", label: "Ocorrências", icon: Eye },
            { id: "gravacoes", label: "Gravações", icon: Video },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setAba(t.id)}
              aria-current={aba === t.id}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-medium transition-colors",
                aba === t.id ? "bg-brand-navy text-white" : "text-muted-foreground hover:bg-secondary",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.id === "ocorrencias" && aguardando.length > 0 && (
                <span className={cn("rounded-full px-1.5 font-mono text-[12px] font-bold", aba === t.id ? "bg-white/20" : "bg-coral text-white")}>
                  {aguardando.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {aba === "ao_vivo" && (usandoMock() ? <AoVivo /> : <AoVivoReal />)}
        {aba === "gravacoes" && <Gravacoes />}

        {aba === "ocorrencias" && (ocorrenciasQ.error ? (
          <ErrorBox error={ocorrenciasQ.error} onRetry={() => ocorrenciasQ.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={Video} label="Ocorrências" value={nf(total)} color="var(--brand-navy)" />
              <StatTile
                icon={AlertOctagon}
                label="Aguardando tratativa"
                value={nf(aguardando.length)}
                color="var(--coral)"
                foot="fila de trabalho"
              />
              <StatTile icon={Wifi} label="Câmeras online" value={ex("434")} color="var(--leaf)" />
              <StatTile icon={WifiOff} label="Câmeras offline" value={ex("185")} color="var(--gold)" />
            </div>

            {/* Distribuição de risco. */}
            <Card title="Distribuição de risco" icon={ShieldAlert} bodyClassName="p-4">
              <div className="flex h-3 w-full overflow-hidden rounded-full border border-border">
                {distRisco.map((d) => (
                  <span
                    key={d.risco}
                    style={{
                      width: `${d.pct}%`,
                      background: d.risco === "alto" ? "var(--coral)" : d.risco === "medio" ? "var(--gold)" : "var(--brand-sky)",
                    }}
                    title={`${RISCO_LABEL[d.risco]}: ${d.pct.toFixed(1)}%`}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                {distRisco.map((d) => (
                  <span key={d.risco} className="flex items-center gap-2 text-[13px]">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: d.risco === "alto" ? "var(--coral)" : d.risco === "medio" ? "var(--gold)" : "var(--brand-sky)" }}
                    />
                    <span className="text-ink-soft">{RISCO_LABEL[d.risco]} risco</span>
                    <span className="font-mono font-semibold text-foreground">{d.pct.toFixed(1)}%</span>
                    <span className="font-mono text-muted-foreground">({d.n})</span>
                  </span>
                ))}
              </div>
            </Card>

            {/* Fila de tratativa. */}
            <Card
              title="Fila de tratativa"
              icon={Eye}
              action={<Pill tone="sky">{lista.length} de {total}</Pill>}
              bodyClassName="p-4"
            >
              <div className="mb-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {(["aguardando", "em_analise", "tratado", "descartado", "todas"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFiltro(s)}
                      className={cn(
                        "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                        statusFiltro === s
                          ? "bg-brand-navy text-white"
                          : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {s === "todas" ? "Todas" : TRATATIVA_LABEL[s]}
                      <span className="ml-1.5 font-mono opacity-70">
                        {s === "todas" ? total : ocorrencias.filter((o) => o.status === s).length}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(["todos", "alto", "medio", "baixo"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRiscoFiltro(r)}
                      className={cn(
                        "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                        riscoFiltro === r
                          ? "bg-coral text-white"
                          : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {r === "todos" ? "Todo risco" : `Risco ${RISCO_LABEL[r].toLowerCase()}`}
                    </button>
                  ))}
                  {(["todas", "comportamento", "seguranca", "equipamento"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setClasseFiltro(c)}
                      className={cn(
                        "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                        classeFiltro === c
                          ? "bg-brand-sky text-white"
                          : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {c === "todas" ? "Toda classe" : CLASSE_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>

              {ocorrenciasQ.isPending ? (
                <SkeletonRows rows={8} />
              ) : lista.length ? (
                <DataTable columns={COLS} rows={lista as (OcorrenciaVideo & Record<string, unknown>)[]} />
              ) : (
                <EmptyNote>Nenhuma ocorrência com esse filtro.</EmptyNote>
              )}

              <p className="mt-3 text-[12px] text-muted-foreground">
                Descartar registra o evento como falso positivo — é o dado que permite calibrar a detecção em vez de
                simplesmente ignorar o alarme.
              </p>
            </Card>

            {/* Volume por tipo. */}
            <Card
              title="Volume por tipo de alarme"
              icon={Camera}
              action={<Pill tone="neutral">últimos 30 dias</Pill>}
              bodyClassName="p-4"
            >
              <ul className="space-y-1.5">
                {volumeOrdenado.map(({ tipo, n }) => {
                  const classe = ALARME_VIDEO_CLASSE[tipo];
                  const cor =
                    classe === "equipamento" ? "var(--brand-sky)" : classe === "seguranca" ? "var(--gold)" : "var(--coral)";
                  return (
                    <li key={tipo} className="flex items-center gap-3">
                      <span className="w-56 shrink-0 truncate text-[13px] text-ink-soft">
                        {ALARME_VIDEO_LABEL[tipo]}
                        {classe === "equipamento" && (
                          <Cpu className="ml-1.5 inline h-3 w-3 text-brand-sky" aria-label="Saúde do equipamento" />
                        )}
                      </span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <span
                          className="block h-2.5 rounded-full"
                          style={{ width: `${(n / maiorVolume) * 100}%`, background: cor }}
                        />
                      </span>
                      <span className="w-14 shrink-0 text-right font-mono text-[13px] font-semibold text-foreground">
                        {nf(n)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Cpu className="h-3 w-3 text-brand-sky" />
                Marcados assim são alarmes do próprio equipamento, não do motorista.
              </p>
            </Card>

            {/* Eventos positivos — o contraponto. */}
            <Card title="Eventos positivos de condução" icon={CheckCircle2} bodyClassName="p-4">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile icon={CheckCircle2} label="Uso de inércia" value={ex("4.812")} color="var(--leaf)" />
                <StatTile icon={CheckCircle2} label="Freio motor" value={ex("3.104")} color="var(--leaf)" />
                <StatTile icon={CheckCircle2} label="Faixa verde mantida" value={ex("71%")} color="var(--leaf)" />
                <StatTile icon={CheckCircle2} label="Condução sem evento" value={ex("62%")} color="var(--leaf)" foot="motoristas no período" />
              </div>
              <p className="mt-3 text-[12px] text-muted-foreground">
                Programa de segurança só com punição desgasta. O reconhecimento do que foi bem feito é o que sustenta a
                adesão do motorista ao longo do tempo.
              </p>
            </Card>
          </>
        ))}
      </div>
    </>
  );
}
