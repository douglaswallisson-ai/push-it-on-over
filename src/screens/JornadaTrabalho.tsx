import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Download, FileCheck2, Timer, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { jornadasQuery, linhasQuery, nf } from "@/lib/queries";
import { exportarCSV } from "@/lib/export";
import { MARCACAO_LABEL, type Jornada } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Jornada de trabalho eletrônica.
 *
 * Substitui a ficha de horário de trabalho externo em papel: em vez de o
 * motorista escrever, alguém interpretar e um terceiro redigitar, as marcações
 * vêm da operação. Menos etapas, menos interpretação.
 *
 * As infrações da Lei 13.103 (direção contínua, intervalo, interjornada) são
 * apuradas junto — é passivo trabalhista e autuação em fiscalização, não
 * conveniência de RH.
 */

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}h${String(min % 60).padStart(2, "0")}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const GRAV_TONE: Record<string, PillTone> = { leve: "sky", media: "gold", grave: "coral" };

export default function JornadaTrabalho() {
  const { data, isPending, error, refetch } = useQuery(jornadasQuery());
  const linhasQ = useQuery(linhasQuery());
  const [aberta, setAberta] = useState<Jornada | null>(null);
  const [soInfracao, setSoInfracao] = useState(false);

  const codigoLinha = useMemo(() => new Map((linhasQ.data ?? []).map((l) => [l.id, l.codigo])), [linhasQ.data]);

  const jornadas = useMemo(() => data ?? [], [data]);
  const lista = soInfracao ? jornadas.filter((j) => j.infracoes.length > 0) : jornadas;

  const comInfracao = jornadas.filter((j) => j.infracoes.length > 0);
  const totalExtras = jornadas.reduce((a, j) => a + j.minutosExtras, 0);
  const noLimite = jornadas.filter((j) => j.minutosExtras >= j.limiteExtrasMin * 0.8).length;

  const COLS: Column<Jornada & Record<string, unknown>>[] = [
    {
      key: "matricula",
      header: "Funcionário",
      render: (j) => (
        <div>
          <div className="font-mono text-[12.5px] font-semibold text-foreground">{j.matricula}</div>
          <div className="text-[11px] text-muted-foreground">
            {j.linhaId ? `Linha ${codigoLinha.get(j.linhaId) ?? "—"}` : "sem linha"}
            {j.tabela ? ` · tabela ${j.tabela}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "entrada",
      header: "Entrada / saída",
      render: (j) => {
        const ini = j.marcacoes.find((m) => m.tipo === "inicio_jornada");
        const fim = j.marcacoes.find((m) => m.tipo === "fim_jornada");
        return (
          <span className="whitespace-nowrap font-mono text-[12.5px]">
            {ini ? hora(ini.em) : "—"}
            <span className="mx-1 text-muted-foreground/50">/</span>
            <span className={fim ? "text-foreground" : "text-muted-foreground"}>{fim ? hora(fim.em) : "em curso"}</span>
          </span>
        );
      },
    },
    { key: "minutosTrabalhados", header: "Trabalhado", align: "right", render: (j) => <span className="font-mono text-[12.5px] font-semibold">{hhmm(j.minutosTrabalhados)}</span> },
    { key: "minutosDirecao", header: "Direção", align: "right", render: (j) => <span className="font-mono text-[12.5px]">{hhmm(j.minutosDirecao)}</span> },
    { key: "minutosRefeicao", header: "Refeição", align: "right", render: (j) => <span className={cn("font-mono text-[12.5px]", j.minutosRefeicao === 0 ? "text-coral font-semibold" : "")}>{hhmm(j.minutosRefeicao)}</span> },
    {
      key: "minutosExtras",
      header: "Extras",
      align: "right",
      render: (j) => {
        const pct = j.limiteExtrasMin ? (j.minutosExtras / j.limiteExtrasMin) * 100 : 0;
        return (
          <div className="ml-auto w-24">
            <div className="text-right font-mono text-[12.5px] font-semibold text-foreground">{hhmm(j.minutosExtras)}</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" title={`Limite ${hhmm(j.limiteExtrasMin)}`}>
              <div
                className={cn("h-1.5 rounded-full", pct >= 100 ? "bg-coral" : pct >= 80 ? "bg-gold" : "bg-leaf")}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "infracoes",
      header: "Lei 13.103",
      align: "center",
      render: (j) =>
        j.infracoes.length ? (
          <Pill tone={j.infracoes.some((i) => i.gravidade === "grave") ? "coral" : "gold"}>
            <AlertTriangle className="h-3 w-3" />
            {j.infracoes.length}
          </Pill>
        ) : (
          <Pill tone="green">Conforme</Pill>
        ),
    },
    {
      key: "fechada",
      header: "Situação",
      align: "center",
      render: (j) => <Pill tone={j.fechada ? "green" : "sky"}>{j.fechada ? "Fechada" : "Em curso"}</Pill>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Jornada de trabalho"
        subtitle="Pessoas › Jornada eletrônica"
        actions={
          <button
            onClick={() => {
              const n = exportarCSV(
                jornadas,
                [
                  { cabecalho: "Matrícula", valor: (j) => j.matricula },
                  { cabecalho: "Data", valor: (j) => new Date(`${j.data}T12:00`).toLocaleDateString("pt-BR") },
                  { cabecalho: "Linha", valor: (j) => (j.linhaId ? codigoLinha.get(j.linhaId) ?? "" : "") },
                  { cabecalho: "Trabalhado", valor: (j) => hhmm(j.minutosTrabalhados) },
                  { cabecalho: "Direção", valor: (j) => hhmm(j.minutosDirecao) },
                  { cabecalho: "Refeição", valor: (j) => hhmm(j.minutosRefeicao) },
                  { cabecalho: "Extras", valor: (j) => hhmm(j.minutosExtras) },
                  { cabecalho: "Infrações", valor: (j) => j.infracoes.map((i) => i.descricao).join(" | ") },
                ],
                "espelho-jornada",
              );
              toast.success(`Espelho exportado (${n} jornadas).`);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Download className="h-[15px] w-[15px]" />
            Exportar espelho
          </button>
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        {error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={Users} label="Jornadas do dia" value={nf(jornadas.length)} color="var(--brand-navy)" />
              <StatTile
                icon={AlertTriangle}
                label="Com infração"
                value={nf(comInfracao.length)}
                color={comInfracao.length ? "var(--coral)" : "var(--leaf)"}
                foot="Lei 13.103"
              />
              <StatTile icon={Timer} label="Horas extras" value={hhmm(totalExtras)} color="var(--gold)" />
              <StatTile icon={Clock} label="Próximos do limite" value={nf(noLimite)} color="var(--gold)" foot="80% das extras" />
            </div>

            {/* O ponto do produto: o que muda ao sair do papel. */}
            <div className="rounded-xl border border-border bg-card px-4 py-3">
              <p className="text-[12.5px] text-muted-foreground">
                <strong className="text-foreground">Do manual ao eletrônico.</strong> Na ficha de papel o motorista
                escreve, alguém interpreta e um terceiro redigita — três chances de erro antes do dado entrar no
                sistema. Aqui as marcações vêm da operação; o ajuste manual continua possível, mas fica identificado
                como tal.
              </p>
            </div>

            <Card
              title="Jornadas"
              icon={FileCheck2}
              action={
                <button
                  onClick={() => setSoInfracao((v) => !v)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                    soInfracao ? "bg-coral text-white" : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                  )}
                >
                  Só com infração
                </button>
              }
              bodyClassName="p-4"
            >
              {isPending ? (
                <SkeletonRows rows={5} />
              ) : lista.length ? (
                <DataTable
                  columns={COLS}
                  rows={lista as (Jornada & Record<string, unknown>)[]}
                  onRowClick={(j) => setAberta(aberta?.id === j.id ? null : (j as Jornada))}
                />
              ) : (
                <EmptyNote>Nenhuma jornada com esse filtro.</EmptyNote>
              )}
              <p className="mt-3 text-[11.5px] text-muted-foreground">Clique numa linha para ver as marcações e as infrações apuradas.</p>
            </Card>

            {aberta && (
              <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
                <Card
                  title={`Marcações — matrícula ${aberta.matricula}`}
                  icon={Clock}
                  action={
                    <button onClick={() => setAberta(null)} className="text-[12.5px] text-muted-foreground underline">
                      fechar
                    </button>
                  }
                  bodyClassName="p-4"
                >
                  <ol className="space-y-2">
                    {aberta.marcacoes.map((m, i) => (
                      <li key={i} className="flex items-center gap-3 text-[13px]">
                        <span className="w-14 shrink-0 font-mono font-semibold text-foreground">{hora(m.em)}</span>
                        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-navy" />
                        <span className="flex-1 text-ink-soft">{MARCACAO_LABEL[m.tipo]}</span>
                        {m.local && <span className="shrink-0 text-[11.5px] text-muted-foreground">{m.local}</span>}
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold",
                            m.origem === "automatica" ? "bg-leaf-tint text-leaf" : "bg-gold-tint text-gold",
                          )}
                        >
                          {m.origem === "automatica" ? "automática" : m.origem === "manual" ? "manual" : "ajuste"}
                        </span>
                      </li>
                    ))}
                  </ol>
                </Card>

                <Card title="Conformidade" icon={AlertTriangle} bodyClassName="p-4">
                  {aberta.infracoes.length ? (
                    <div className="space-y-3">
                      {aberta.infracoes.map((inf, i) => (
                        <div key={i} className="rounded-lg border border-coral-line bg-coral-tint/40 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[13px] font-semibold text-coral">{inf.descricao}</span>
                            <Pill tone={GRAV_TONE[inf.gravidade]}>{inf.gravidade}</Pill>
                          </div>
                        </div>
                      ))}
                      <p className="text-[11.5px] text-muted-foreground">
                        Infrações apuradas contra a Lei 13.103. Corrigir a escala evita autuação e passivo.
                      </p>
                    </div>
                  ) : (
                    <EmptyNote>Jornada conforme a Lei 13.103.</EmptyNote>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
