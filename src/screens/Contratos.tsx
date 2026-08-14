import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarClock, FileText, Receipt, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { contratantesQuery, contratosQuery, medicoesQuery, nf, passageirosContratoQuery } from "@/lib/queries";
import type { Contrato, Medicao, PassageiroContrato } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Contratos de fretamento.
 *
 * Antes o contratante era um campo de texto livre dentro da viagem. Fretamento
 * contínuo — transporte de colaboradores — não é viagem avulsa: é contrato
 * mensal com linha fixa, franquia de km e medição.
 *
 * A medição é o que liga operação a faturamento: viagens realizadas, km
 * excedente e glosas viram o valor da nota.
 */

const STATUS_TONE: Record<Contrato["status"], PillTone> = {
  vigente: "green",
  encerrado: "neutral",
  suspenso: "gold",
  em_negociacao: "sky",
};

const STATUS_LABEL: Record<Contrato["status"], string> = {
  vigente: "Vigente",
  encerrado: "Encerrado",
  suspenso: "Suspenso",
  em_negociacao: "Em negociação",
};

const MEDICAO_TONE: Record<Medicao["status"], PillTone> = {
  aberta: "sky",
  fechada: "gold",
  faturada: "green",
  contestada: "coral",
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataBR = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString("pt-BR");

/** Dias até o vencimento. Negativo = já venceu. */
const diasPara = (iso: string) => Math.round((new Date(`${iso}T12:00`).getTime() - Date.now()) / 86_400_000);

export default function Contratos() {
  const contratosQ = useQuery(contratosQuery());
  const contratantesQ = useQuery(contratantesQuery());
  const medicoesQ = useQuery(medicoesQuery());
  const passageirosQ = useQuery(passageirosContratoQuery());
  const [aberto, setAberto] = useState<Contrato | null>(null);

  const nomeContratante = useMemo(
    () => new Map((contratantesQ.data ?? []).map((c) => [c.id, c.nome])),
    [contratantesQ.data],
  );

  const contratos = useMemo(() => contratosQ.data ?? [], [contratosQ.data]);
  const medicoes = medicoesQ.data ?? [];
  const passageiros = passageirosQ.data ?? [];

  const vigentes = contratos.filter((c) => c.status === "vigente");
  const receitaMensal = vigentes.reduce((a, c) => a + (c.valorMensal ?? 0), 0);
  /** Contrato que vence em até 90 dias precisa entrar em renovação. */
  const vencendo = vigentes.filter((c) => diasPara(c.fim) <= 90);
  const aFaturar = medicoes.filter((m) => m.status !== "faturada").reduce((a, m) => a + m.valorLiquido, 0);

  const COLS: Column<Contrato & Record<string, unknown>>[] = [
    {
      key: "numero",
      header: "Contrato",
      render: (c) => (
        <div>
          <div className="font-mono text-[13px] font-bold text-foreground">{c.numero}</div>
          <div className="max-w-[220px] truncate text-[11.5px] text-muted-foreground">
            {nomeContratante.get(c.contratanteId) ?? "—"}
          </div>
        </div>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      render: (c) => <Pill tone={c.tipo === "continuo" ? "sky" : "neutral"}>{c.tipo === "continuo" ? "Contínuo" : "Eventual"}</Pill>,
    },
    {
      key: "vigencia",
      header: "Vigência",
      render: (c) => {
        const dias = diasPara(c.fim);
        const alerta = c.status === "vigente" && dias <= 90;
        return (
          <span className="whitespace-nowrap text-[12.5px]">
            <span className="text-muted-foreground">{dataBR(c.inicio)}</span>
            <span className="mx-1 text-muted-foreground/50">→</span>
            <span className={cn(alerta ? "font-semibold text-coral" : "text-ink-soft")}>{dataBR(c.fim)}</span>
            {alerta && <span className="ml-1.5 text-[11px] text-coral">({dias} d)</span>}
          </span>
        );
      },
    },
    {
      key: "valorMensal",
      header: "Valor mensal",
      align: "right",
      render: (c) => (
        <span className="font-mono text-[12.5px] font-semibold">
          {c.valorMensal ? brl(c.valorMensal) : c.valorKm ? `R$ ${c.valorKm.toFixed(2)}/km` : "—"}
        </span>
      ),
    },
    {
      key: "kmFranquia",
      header: "Franquia",
      align: "right",
      render: (c) => (
        <span className="whitespace-nowrap font-mono text-[12px] text-muted-foreground">
          {c.kmFranquia ? `${nf(c.kmFranquia)} km` : "—"}
          {c.valorKmExcedente ? ` · exc. R$ ${c.valorKmExcedente.toFixed(2)}` : ""}
        </span>
      ),
    },
    { key: "indiceReajuste", header: "Reajuste", align: "center", render: (c) => <span className="text-[12px] text-muted-foreground">{c.indiceReajuste ?? "—"}</span> },
    { key: "status", header: "Status", align: "center", render: (c) => <Pill tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Pill> },
  ];

  const COLS_MED: Column<Medicao & Record<string, unknown>>[] = [
    { key: "periodo", header: "Período", render: (m) => <span className="font-mono text-[12.5px] font-semibold">{m.periodo}</span> },
    {
      key: "viagens",
      header: "Viagens",
      align: "right",
      render: (m) => {
        const pct = m.viagensPrevistas ? (m.viagensRealizadas / m.viagensPrevistas) * 100 : 0;
        return (
          <span className="whitespace-nowrap font-mono text-[12.5px]">
            {nf(m.viagensRealizadas)}/{nf(m.viagensPrevistas)}
            <span className={cn("ml-1.5 font-semibold", pct >= 98 ? "text-leaf" : pct >= 95 ? "text-gold" : "text-coral")}>
              {pct.toFixed(1)}%
            </span>
          </span>
        );
      },
    },
    { key: "kmRodado", header: "Km rodado", align: "right", render: (m) => <span className="font-mono text-[12.5px]">{nf(m.kmRodado)}</span> },
    { key: "kmExcedente", header: "Excedente", align: "right", render: (m) => <span className={cn("font-mono text-[12.5px]", m.kmExcedente > 0 ? "text-gold font-semibold" : "text-muted-foreground")}>{m.kmExcedente ? nf(m.kmExcedente) : "—"}</span> },
    { key: "glosas", header: "Glosas", align: "right", render: (m) => <span className={cn("font-mono text-[12.5px]", m.glosas > 0 ? "text-coral" : "text-muted-foreground")}>{m.glosas ? `- ${brl(m.glosas)}` : "—"}</span> },
    { key: "valorLiquido", header: "Líquido", align: "right", render: (m) => <span className="font-mono text-[13px] font-bold text-foreground">{brl(m.valorLiquido)}</span> },
    { key: "status", header: "Status", align: "center", render: (m) => <Pill tone={MEDICAO_TONE[m.status]}>{m.status}</Pill> },
  ];

  const COLS_PAX: Column<PassageiroContrato & Record<string, unknown>>[] = [
    { key: "nome", header: "Passageiro", render: (p) => <span className="text-[13px] font-medium text-foreground">{p.nome}</span> },
    { key: "matriculaEmpresa", header: "Matrícula", render: (p) => <span className="font-mono text-[12px] text-muted-foreground">{p.matriculaEmpresa ?? "—"}</span> },
    { key: "credencial", header: "Credencial", render: (p) => <span className="font-mono text-[12px]">{p.credencial}</span> },
    { key: "ativo", header: "Situação", align: "center", render: (p) => <Pill tone={p.ativo ? "green" : "neutral"}>{p.ativo ? "Ativo" : "Inativo"}</Pill> },
  ];

  return (
    <>
      <PageHeader title="Contratos" subtitle="Fretamento › Contratos e medição" />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        {contratosQ.error ? (
          <ErrorBox error={contratosQ.error} onRetry={() => contratosQ.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={FileText} label="Contratos vigentes" value={nf(vigentes.length)} color="var(--brand-navy)" />
              <StatTile icon={TrendingUp} label="Receita mensal" value={brl(receitaMensal)} color="var(--leaf)" />
              <StatTile
                icon={CalendarClock}
                label="Vencem em 90 dias"
                value={nf(vencendo.length)}
                color={vencendo.length ? "var(--coral)" : "var(--leaf)"}
                foot="entrar em renovação"
              />
              <StatTile icon={Receipt} label="A faturar" value={brl(aFaturar)} color="var(--gold)" />
            </div>

            <Card title="Contratos" icon={FileText} action={<Pill tone="sky">{contratos.length} registros</Pill>} bodyClassName="p-4">
              {contratosQ.isPending ? (
                <SkeletonRows rows={4} />
              ) : contratos.length ? (
                <DataTable
                  columns={COLS}
                  rows={contratos as (Contrato & Record<string, unknown>)[]}
                  onRowClick={(c) => setAberto(aberto?.id === c.id ? null : (c as Contrato))}
                />
              ) : (
                <EmptyNote>Nenhum contrato cadastrado.</EmptyNote>
              )}
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                Clique num contrato para ver as medições e a lista nominal de passageiros.
              </p>
            </Card>

            {aberto && (
              <>
                <Card
                  title={`Medições — ${aberto.numero}`}
                  icon={Receipt}
                  action={
                    <button onClick={() => setAberto(null)} className="text-[12.5px] text-muted-foreground underline">
                      fechar
                    </button>
                  }
                  bodyClassName="p-4"
                >
                  {medicoes.filter((m) => m.contratoId === aberto.id).length ? (
                    <DataTable
                      columns={COLS_MED}
                      rows={medicoes.filter((m) => m.contratoId === aberto.id) as (Medicao & Record<string, unknown>)[]}
                    />
                  ) : (
                    <EmptyNote>Nenhuma medição neste contrato.</EmptyNote>
                  )}
                  <p className="mt-3 text-[11.5px] text-muted-foreground">
                    A medição liga operação a faturamento: viagens realizadas, km excedente sobre a franquia e glosas
                    por descumprimento formam o valor líquido da nota.
                  </p>
                </Card>

                <Card
                  title="Lista nominal de passageiros"
                  icon={Users}
                  action={<Pill tone="neutral">{passageiros.filter((p) => p.contratoId === aberto.id).length} vinculados</Pill>}
                  bodyClassName="p-4"
                >
                  {passageiros.filter((p) => p.contratoId === aberto.id).length ? (
                    <DataTable
                      columns={COLS_PAX}
                      rows={passageiros.filter((p) => p.contratoId === aberto.id) as (PassageiroContrato & Record<string, unknown>)[]}
                    />
                  ) : (
                    <EmptyNote>Nenhum passageiro vinculado a este contrato.</EmptyNote>
                  )}
                  <p className="mt-3 text-[11.5px] text-muted-foreground">
                    Contagem por sensor não responde ao RH do contratante — a lista nominal é o que permite dizer se um
                    colaborador específico usou o transporte no mês.
                  </p>
                </Card>
              </>
            )}

            <Card title="Contratantes" icon={Building2} bodyClassName="p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(contratantesQ.data ?? []).map((c) => (
                  <div key={c.id} className="rounded-xl border border-border p-3">
                    <div className="text-[13.5px] font-semibold text-foreground">{c.nome}</div>
                    <div className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">{c.cnpj}</div>
                    <div className="mt-2 text-[12px] text-ink-soft">{c.contato}</div>
                    <div className="text-[11.5px] text-muted-foreground">{c.email}</div>
                    <div className="text-[11.5px] text-muted-foreground">{c.telefone}</div>
                    {c.segmento && <Pill tone="neutral">{c.segmento}</Pill>}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
