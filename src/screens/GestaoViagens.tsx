import OperacaoLinhas from "@/screens/OperacaoLinhas";
import { usandoMock } from "@/lib/modo";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Gauge,
  Play,
  RefreshCw,
  Route,
  TimerReset,
  Users,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { linhasQuery, nf, veiculosQuery, viagensOperacaoQuery } from "@/lib/queries";
import {
  DIA_FISCAL_PADRAO,
  dataOperacao,
  desvioMin,
  ipk,
  regularidadeHeadway,
  resumoViagens,
  rotuloDiaFiscal,
  tipoDiaDe,
} from "@/lib/operacao";
import { SITUACAO_VIAGEM_LABEL, TIPO_DIA_LABEL, type SituacaoViagem, type ViagemRealizada } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Gestão de viagens — o confronto entre o que foi programado e o que aconteceu.
 *
 * É a tela que faltava para o sistema atender transporte público: até aqui ele
 * registrava o que aconteceu, sem nenhuma noção do que deveria ter acontecido.
 * Cumprimento de programação é o que o poder concedente fiscaliza e o que gera
 * multa quando descumprido.
 *
 * A data segue o **dia fiscal** (03:00 às 02:59), não o calendário: uma viagem
 * que parte 23:40 e chega 00:20 pertence ao mesmo dia de operação.
 */

const TONE: Record<SituacaoViagem, PillTone> = {
  ok: "green",
  em_andamento: "sky",
  atrasada: "gold",
  adiantada: "gold",
  nao_realizada: "coral",
  aguardando: "neutral",
  reforco: "sky",
};

/** Desvio em minutos, com sinal e cor. Negativo = adiantado. */
function Desvio({ programado, realizado }: { programado?: string; realizado?: string }) {
  const d = desvioMin(programado, realizado);
  if (d === null) return <span className="text-muted-foreground">—</span>;
  const forte = Math.abs(d) > 5;
  return (
    <span
      className={cn(
        "font-mono text-[13px] font-semibold",
        d === 0 ? "text-leaf" : forte ? "text-coral" : "text-gold",
      )}
      title={d < 0 ? "Adiantada" : d > 0 ? "Atrasada" : "No horário"}
    >
      {d > 0 ? "+" : ""}
      {d} min
    </span>
  );
}

/** Par programado / realizado — o padrão de leitura de toda a tela. */
function ParHorario({ prog, real }: { prog?: string; real?: string }) {
  return (
    <span className="whitespace-nowrap font-mono text-[13px]">
      <span className="text-muted-foreground">{prog ?? "—"}</span>
      <span className="mx-1 text-muted-foreground/50">/</span>
      <span className={cn("font-semibold", real ? "text-foreground" : "text-muted-foreground")}>{real ?? "—"}</span>
    </span>
  );
}

/** Ligado ao banco, a operação real; o restante desta tela é o protótipo. */
export default function GestaoViagens() {
  if (!usandoMock()) return <OperacaoLinhas titulo="Gestão de viagens" subtitulo="Transporte urbano › Programado × realizado" />;
  return <GestaoViagensExemplo />;
}

function GestaoViagensExemplo() {
  const hoje = dataOperacao(new Date());
  const [linhaId, setLinhaId] = useState<string>("");
  const [situacao, setSituacao] = useState<SituacaoViagem | "todas">("todas");

  const linhasQ = useQuery(linhasQuery());
  const veiculosQ = useQuery(veiculosQuery(1, 200));
  const viagensQ = useQuery(viagensOperacaoQuery(hoje, linhaId || undefined));

  const linhas = linhasQ.data ?? [];
  const viagens = useMemo(() => viagensQ.data ?? [], [viagensQ.data]);

  // Prefixo é como a operação chama o carro; a placa fica como apoio.
  const carroPorId = useMemo(() => {
    const m = new Map<string, { prefixo: string; placa: string }>();
    for (const v of veiculosQ.data?.items ?? []) {
      m.set(v.id, { prefixo: v.prefixo ?? "—", placa: v.placa });
    }
    return m;
  }, [veiculosQ.data]);

  const r = resumoViagens(viagens);

  // Indicadores do dia, calculados a partir do realizado.
  const totalPassageiros = viagens.reduce((a, v) => a + (v.passageiros ?? 0), 0);
  const totalKm = viagens.reduce((a, v) => a + (v.kmRodado ?? 0), 0);
  const ipkDia = ipk(totalPassageiros, totalKm);
  const regularidade = useMemo(() => {
    const comHeadway = viagens.filter((v) => v.headwayProgramadoMin && v.headwayRealizadoMin);
    if (!comHeadway.length) return 100;
    return Math.round(
      comHeadway.reduce(
        (a, v) => a + regularidadeHeadway(v.headwayProgramadoMin!, [v.headwayRealizadoMin!]),
        0,
      ) / comHeadway.length,
    );
  }, [viagens]);

  const lista = useMemo(
    () => (situacao === "todas" ? viagens : viagens.filter((v) => v.situacao === situacao)),
    [viagens, situacao],
  );

  const COLS: Column<ViagemRealizada & Record<string, unknown>>[] = [
    {
      key: "situacao",
      header: "",
      align: "center",
      render: (v) => {
        const Icone =
          v.situacao === "ok"
            ? CheckCircle2
            : v.situacao === "em_andamento"
              ? Play
              : v.situacao === "nao_realizada"
                ? XCircle
                : v.situacao === "atrasada" || v.situacao === "adiantada"
                  ? AlertTriangle
                  : Clock;
        const cor =
          v.situacao === "ok"
            ? "text-leaf"
            : v.situacao === "nao_realizada"
              ? "text-coral"
              : v.situacao === "em_andamento"
                ? "text-brand-sky"
                : v.situacao === "atrasada" || v.situacao === "adiantada"
                  ? "text-gold"
                  : "text-muted-foreground";
        return <Icone className={cn("h-4 w-4", cor)} aria-label={SITUACAO_VIAGEM_LABEL[v.situacao]} />;
      },
    },
    {
      key: "tabela",
      header: "Tabela",
      align: "center",
      render: (v) => (
        <span className="font-mono text-[13px] font-bold text-foreground" title="Número da escala do carro">
          {v.tabela === 99 ? "—" : v.tabela}
        </span>
      ),
    },
    {
      key: "sentido",
      header: "Sentido",
      align: "center",
      render: (v) => (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-semibold",
            v.sentido === "ida" ? "bg-navy-tint text-brand-navy" : "bg-secondary text-ink-soft",
          )}
        >
          <ArrowLeftRight className="h-3 w-3" />
          {v.sentido === "ida" ? "Ida" : v.sentido === "volta" ? "Volta" : "Circular"}
        </span>
      ),
    },
    {
      key: "partida",
      header: "Início — progr / realiz",
      render: (v) => <ParHorario prog={v.partidaProgramada} real={v.partidaRealizada} />,
    },
    {
      key: "desvio",
      header: "Desvio",
      align: "right",
      render: (v) => <Desvio programado={v.partidaProgramada} realizado={v.partidaRealizada} />,
    },
    {
      key: "chegada",
      header: "Término — progr / realiz",
      render: (v) => <ParHorario prog={v.chegadaProgramada} real={v.chegadaRealizada} />,
    },
    {
      key: "percursoPct",
      header: "Percurso",
      align: "right",
      render: (v) => (
        <div className="ml-auto w-20">
          <div className="text-right font-mono text-[13px] font-semibold text-foreground">{v.percursoPct}%</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-1.5 rounded-full",
                v.percursoPct >= 95 ? "bg-leaf" : v.percursoPct >= 50 ? "bg-gold" : "bg-coral",
              )}
              style={{ width: `${v.percursoPct}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: "veiculo",
      header: "Veículo — progr / realiz",
      render: (v) => {
        const prog = v.veiculoProgramadoId ? carroPorId.get(v.veiculoProgramadoId) : undefined;
        const real = v.veiculoRealizadoId ? carroPorId.get(v.veiculoRealizadoId) : undefined;
        const trocou = Boolean(prog && real && v.veiculoProgramadoId !== v.veiculoRealizadoId);
        return (
          <span className="whitespace-nowrap font-mono text-[13px]" title={real ? `Placa ${real.placa}` : undefined}>
            <span className="text-muted-foreground">{prog?.prefixo ?? "—"}</span>
            <span className="mx-1 text-muted-foreground/50">/</span>
            <span className={cn("font-semibold", trocou ? "text-gold" : "text-foreground")}>
              {real?.prefixo ?? "—"}
            </span>
          </span>
        );
      },
    },
    {
      key: "headway",
      header: "Headway — progr / realiz",
      align: "right",
      render: (v) => {
        const irregular =
          v.headwayProgramadoMin && v.headwayRealizadoMin
            ? Math.abs(v.headwayRealizadoMin - v.headwayProgramadoMin) > 3
            : false;
        return (
          <span className="whitespace-nowrap font-mono text-[13px]">
            <span className="text-muted-foreground">{v.headwayProgramadoMin ?? "—"}</span>
            <span className="mx-1 text-muted-foreground/50">/</span>
            <span className={cn("font-semibold", irregular ? "text-coral" : "text-foreground")}>
              {v.headwayRealizadoMin ?? "—"}
            </span>
          </span>
        );
      },
    },
    {
      key: "passageiros",
      header: "Passageiros",
      align: "right",
      render: (v) => <span className="font-mono">{v.passageiros != null ? nf(v.passageiros) : "—"}</span>,
    },
  ];

  const FILTROS: { id: SituacaoViagem | "todas"; label: string; total: number }[] = [
    { id: "todas", label: "Todas", total: viagens.length },
    { id: "ok", label: "Viagem OK", total: r.ok },
    { id: "em_andamento", label: "Em andamento", total: r.emAndamento },
    { id: "atrasada", label: "Atrasadas", total: r.atrasadas },
    { id: "adiantada", label: "Adiantadas", total: r.adiantadas },
    { id: "nao_realizada", label: "Não realizadas", total: r.naoRealizadas },
    { id: "aguardando", label: "Aguardando", total: r.aguardando },
    { id: "reforco", label: "Reforço", total: r.reforco },
  ];

  return (
    <>
      <PageHeader
        title="Gestão de viagens"
        subtitle="Operação › Programado × realizado"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={linhaId}
              onChange={(e) => setLinhaId(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
            >
              <option value="">Todas as linhas</option>
              {linhas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.codigo} — {l.nome}
                </option>
              ))}
            </select>
            <button
              onClick={() => viagensQ.refetch()}
              disabled={viagensQ.isFetching}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <RefreshCw className={cn("h-[15px] w-[15px]", viagensQ.isFetching && "animate-spin")} />
              Atualizar
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        {/* A janela do dia fiscal precisa ficar explícita: não é o dia do calendário. */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span>
              Operação de <strong className="text-foreground">{new Date(`${hoje}T12:00`).toLocaleDateString("pt-BR")}</strong>
            </span>
            <span className="hidden text-border sm:inline">|</span>
            <span>{TIPO_DIA_LABEL[tipoDiaDe(hoje)]}</span>
            <span className="hidden text-border sm:inline">|</span>
            <span title="Uma viagem que parte 23:40 e chega 00:20 pertence ao mesmo dia de operação.">
              {rotuloDiaFiscal(DIA_FISCAL_PADRAO)}
            </span>
          </span>
          <span className="font-mono text-[12px] text-muted-foreground">
            atualizado {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {viagensQ.error ? (
          <ErrorBox error={viagensQ.error} onRetry={() => viagensQ.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile
                icon={Gauge}
                label="Eficiência"
                value={`${r.eficiencia}%`}
                color={r.eficiencia >= 95 ? "var(--leaf)" : r.eficiencia >= 85 ? "var(--gold)" : "var(--coral)"}
                foot={`${r.realizadas} de ${r.programadas} programadas`}
              />
              <StatTile icon={CheckCircle2} label="Viagem OK" value={nf(r.ok)} color="var(--leaf)" />
              <StatTile icon={Play} label="Em andamento" value={nf(r.emAndamento)} color="var(--brand-sky)" />
              <StatTile icon={TimerReset} label="Atrasadas" value={nf(r.atrasadas + r.adiantadas)} color="var(--gold)" foot="inclui adiantadas" />
              <StatTile icon={XCircle} label="Não realizadas" value={nf(r.naoRealizadas)} color="var(--coral)" />
            </div>

            {/* IPK e cobertura do dia — os mesmos indicadores do painel
                gerencial, calculados sobre a operação corrente. */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile
                icon={Users}
                label="Passageiros"
                value={nf(totalPassageiros)}
                color="var(--brand-navy)"
              />
              <StatTile icon={Route} label="Km rodado" value={nf(Math.round(totalKm))} unit="km" color="var(--brand-sky)" />
              <StatTile
                icon={Users}
                label="IPK do dia"
                value={ipkDia.toFixed(2)}
                color="var(--leaf)"
                foot="passageiros por km"
              />
              <StatTile
                icon={TimerReset}
                label="Regularidade"
                value={`${regularidade}%`}
                color={regularidade >= 85 ? "var(--leaf)" : regularidade >= 70 ? "var(--gold)" : "var(--coral)"}
                foot="aderência do headway"
              />
            </div>

            <Card
              title="Viagens do dia"
              icon={Route}
              action={<Pill tone="sky">{lista.length} de {viagens.length}</Pill>}
              bodyClassName="p-4"
            >
              <div className="mb-3 flex flex-wrap gap-1.5">
                {FILTROS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSituacao(f.id)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                      situacao === f.id
                        ? "bg-brand-navy text-white"
                        : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {f.label}
                    <span className="ml-1.5 font-mono opacity-70">{f.total}</span>
                  </button>
                ))}
              </div>

              {viagensQ.isPending ? (
                <SkeletonRows rows={8} />
              ) : lista.length ? (
                <DataTable columns={COLS} rows={lista as (ViagemRealizada & Record<string, unknown>)[]} />
              ) : (
                <EmptyNote>Nenhuma viagem com esse filtro.</EmptyNote>
              )}

              <p className="mt-3 text-[12px] text-muted-foreground">
                Cada par mostra <strong>programado / realizado</strong>. Tolerância: 3 min de adiantamento e 5 min de
                atraso. Viagem sem partida cujo horário já passou conta como não realizada. Veículo em destaque indica
                troca em relação ao escalado.
              </p>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
