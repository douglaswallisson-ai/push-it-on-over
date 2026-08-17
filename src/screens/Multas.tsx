import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Download, Gavel, Scale, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { SeloDadosExemplo } from "@/components/ss/ui/SeloDadosExemplo";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { multasQuery, nf, veiculosQuery } from "@/lib/queries";
import { MOCK_MOTORISTAS } from "@/lib/mock-data";
import { registrarAuditoria } from "@/lib/session";
import { exportarCSV } from "@/lib/export";
import type { Multa } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Gestão de multas.
 *
 * O prazo de indicação do condutor é o que torna esta tela urgente: passado o
 * prazo sem indicar, a pontuação recai sobre a empresa e a multa costuma dobrar.
 * Por isso a contagem regressiva fica em destaque, e não a data de vencimento
 * do boleto.
 */

const STATUS_LABEL: Record<Multa["status"], string> = {
  pendente_indicacao: "Pendente de indicação",
  indicada: "Condutor indicado",
  em_recurso: "Em recurso",
  paga: "Paga",
  vencida: "Vencida",
};

const STATUS_TONE: Record<Multa["status"], PillTone> = {
  pendente_indicacao: "coral",
  indicada: "sky",
  em_recurso: "gold",
  paga: "green",
  vencida: "coral",
};

const GRAV_TONE: Record<Multa["gravidade"], PillTone> = {
  leve: "sky",
  media: "gold",
  grave: "coral",
  gravissima: "coral",
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const diasPara = (iso: string) => Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);

export default function Multas() {
  const { data, isPending, error, refetch } = useQuery(multasQuery());
  const veiculosQ = useQuery(veiculosQuery(1, 200));
  const [filtro, setFiltro] = useState<Multa["status"] | "todas">("todas");
  const [indicadas, setIndicadas] = useState<Record<string, string>>({});

  const prefixo = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of veiculosQ.data?.items ?? []) m.set(v.id, v.prefixo ?? v.placa);
    return m;
  }, [veiculosQ.data]);

  const nomeMotorista = useMemo(() => new Map(MOCK_MOTORISTAS.map((m) => [m.id, m.nome])), []);

  const multas = useMemo(
    () =>
      (data ?? []).map((m) =>
        indicadas[m.id] ? { ...m, status: "indicada" as const, motoristaId: indicadas[m.id] } : m,
      ),
    [data, indicadas],
  );

  const lista = filtro === "todas" ? multas : multas.filter((m) => m.status === filtro);

  const pendentes = multas.filter((m) => m.status === "pendente_indicacao");
  /** Prazo de indicação vencendo em até 7 dias — é o que não pode passar. */
  const urgentes = pendentes.filter((m) => m.prazoIndicacao && diasPara(m.prazoIndicacao) <= 7);
  const valorAberto = multas.filter((m) => m.status !== "paga").reduce((a, m) => a + m.valor, 0);
  const pontosTotal = multas.filter((m) => m.status !== "em_recurso").reduce((a, m) => a + m.pontos, 0);

  const indicar = (m: Multa) => {
    // Sem condutor conhecido, indica o motorista da jornada correspondente.
    const alvo = m.motoristaId ?? MOCK_MOTORISTAS[0]?.id;
    if (!alvo) return;
    setIndicadas((i) => ({ ...i, [m.id]: alvo }));
    registrarAuditoria("indicacao_condutor", `Condutor indicado no AIT ${m.ait}: ${nomeMotorista.get(alvo)}.`);
    toast.success("Condutor indicado.", { description: `${m.ait} · ${nomeMotorista.get(alvo)}` });
  };

  const COLS: Column<Multa & Record<string, unknown>>[] = [
    {
      key: "ait",
      header: "AIT",
      render: (m) => (
        <div>
          <div className="font-mono text-[12.5px] font-bold text-foreground">{m.ait}</div>
          <div className="text-[11px] text-muted-foreground">{dataBR(m.em)}</div>
        </div>
      ),
    },
    {
      key: "veiculoId",
      header: "Veículo",
      render: (m) => <span className="font-mono text-[13px] font-semibold">{prefixo.get(m.veiculoId) ?? "—"}</span>,
    },
    {
      key: "infracao",
      header: "Infração",
      render: (m) => (
        <div>
          <div className="max-w-[240px] truncate text-[12.5px] text-foreground">{m.infracao}</div>
          <div className="text-[11px] text-muted-foreground">{m.local}</div>
        </div>
      ),
    },
    {
      key: "gravidade",
      header: "Gravidade",
      align: "center",
      render: (m) => (
        <span className="inline-flex items-center gap-1.5">
          <Pill tone={GRAV_TONE[m.gravidade]}>{m.gravidade}</Pill>
          <span className="font-mono text-[11.5px] text-muted-foreground">{m.pontos} pts</span>
        </span>
      ),
    },
    {
      key: "motoristaId",
      header: "Condutor",
      render: (m) =>
        m.motoristaId ? (
          <span className="whitespace-nowrap text-[12.5px] text-ink-soft">{nomeMotorista.get(m.motoristaId) ?? "—"}</span>
        ) : (
          <span className="text-[12px] text-coral">não identificado</span>
        ),
    },
    {
      key: "prazoIndicacao",
      header: "Prazo de indicação",
      align: "right",
      render: (m) => {
        if (!m.prazoIndicacao) return <span className="text-[12px] text-muted-foreground">—</span>;
        const d = diasPara(m.prazoIndicacao);
        return (
          <span
            className={cn(
              "whitespace-nowrap font-mono text-[12.5px] font-semibold",
              d < 0 ? "text-coral" : d <= 7 ? "text-coral" : d <= 15 ? "text-gold" : "text-ink-soft",
            )}
            title={dataBR(m.prazoIndicacao)}
          >
            {d < 0 ? `vencido há ${Math.abs(d)} d` : `${d} d`}
          </span>
        );
      },
    },
    { key: "valor", header: "Valor", align: "right", render: (m) => <span className="font-mono text-[12.5px] font-semibold">{brl(m.valor)}</span> },
    { key: "status", header: "Status", align: "center", render: (m) => <Pill tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Pill> },
    {
      key: "acao",
      header: "",
      align: "right",
      render: (m) =>
        m.status === "pendente_indicacao" ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              indicar(m);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-2.5 py-1 text-[12px] font-semibold text-white"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Indicar
          </button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader
        title="Multas"
        subtitle="Pessoas › Infrações de trânsito"
        actions={
          <button
            onClick={() => {
              const n = exportarCSV(
                multas,
                [
                  { cabecalho: "AIT", valor: (m) => m.ait },
                  { cabecalho: "Data", valor: (m) => dataBR(m.em) },
                  { cabecalho: "Veículo", valor: (m) => prefixo.get(m.veiculoId) ?? "" },
                  { cabecalho: "Infração", valor: (m) => m.infracao },
                  { cabecalho: "Local", valor: (m) => m.local },
                  { cabecalho: "Gravidade", valor: (m) => m.gravidade },
                  { cabecalho: "Pontos", valor: (m) => m.pontos },
                  { cabecalho: "Condutor", valor: (m) => (m.motoristaId ? nomeMotorista.get(m.motoristaId) ?? "" : "") },
                  { cabecalho: "Valor", valor: (m) => m.valor },
                  { cabecalho: "Status", valor: (m) => STATUS_LABEL[m.status] },
                ],
                "multas",
              );
              toast.success(`${n} multas exportadas.`);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Download className="h-[15px] w-[15px]" />
            Exportar
          </button>
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        <SeloDadosExemplo motivo="Multas ainda não têm tabela no backend." />

        {error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={Gavel} label="Multas registradas" value={nf(multas.length)} color="var(--brand-navy)" />
              <StatTile
                icon={CalendarClock}
                label="Prazo vencendo"
                value={nf(urgentes.length)}
                color={urgentes.length ? "var(--coral)" : "var(--leaf)"}
                foot="indicação em até 7 dias"
              />
              <StatTile icon={Scale} label="Valor em aberto" value={brl(valorAberto)} color="var(--gold)" />
              <StatTile icon={AlertTriangle} label="Pontos acumulados" value={nf(pontosTotal)} color="var(--coral)" />
            </div>

            {urgentes.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-coral-line bg-coral-tint/50 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                <p className="text-[13px] text-coral">
                  <strong>
                    {urgentes.length} multa{urgentes.length > 1 ? "s" : ""} com prazo de indicação vencendo.
                  </strong>{" "}
                  Sem indicar o condutor no prazo, a pontuação recai sobre a empresa e o valor costuma dobrar — é o
                  erro mais caro e mais comum na gestão de infrações.
                </p>
              </div>
            )}

            <Card
              title="Infrações"
              icon={Gavel}
              action={<Pill tone="sky">{lista.length} de {multas.length}</Pill>}
              bodyClassName="p-4"
            >
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(["todas", "pendente_indicacao", "indicada", "em_recurso", "paga"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFiltro(s)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                      filtro === s ? "bg-brand-navy text-white" : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {s === "todas" ? "Todas" : STATUS_LABEL[s]}
                    <span className="ml-1.5 font-mono opacity-70">
                      {s === "todas" ? multas.length : multas.filter((m) => m.status === s).length}
                    </span>
                  </button>
                ))}
              </div>

              {isPending ? (
                <SkeletonRows rows={5} />
              ) : lista.length ? (
                <DataTable columns={COLS} rows={lista as (Multa & Record<string, unknown>)[]} />
              ) : (
                <EmptyNote>Nenhuma multa com esse filtro.</EmptyNote>
              )}

              <p className="mt-3 text-[11.5px] text-muted-foreground">
                O prazo em destaque é o de <strong>indicação do condutor</strong>, não o do boleto: é o que não pode
                passar. A indicação fica registrada em auditoria.
              </p>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
