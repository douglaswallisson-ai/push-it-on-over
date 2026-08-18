import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ClipboardCheck,
  ClipboardList,
  Database,
  Info,
  Mail,
  Search,
  ShieldAlert,
  Truck,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { checklistPerguntasQuery, checklistRespostasQuery, checklistsQuery, nf } from "@/lib/queries";
import { usandoMock } from "@/lib/modo";
import { cn } from "@/lib/utils";

/**
 * Checklist de inspeção.
 *
 * O módulo já existe numa API separada, no API Gateway — não é funcionalidade
 * nova. Esta tela consome esse contrato.
 *
 * A leitura é organizada por checklist e não por resposta: a pergunta que o
 * gestor faz é "o modelo de inspeção está sendo cumprido", e não "quais foram
 * as respostas de ontem". As respostas entram como aferição do cumprimento.
 */

type ChecklistApi = {
  id: number;
  name?: string;
  /** Vale para toda a base ou só para um grupo. */
  global?: boolean;
  /** Obrigatório antes de o veículo operar. */
  mandatory?: boolean;
  send_mail?: boolean;
  list_mail?: { email?: string }[];
  unit_category?: { id?: number; name?: string }[];
  questions?: PerguntaApi[];
};

type PerguntaApi = {
  id: number;
  checklist_id?: number;
  text?: string;
  mandatory?: boolean;
  send_mail?: boolean;
  order?: number;
  options?: string;
  type?: { id?: number; name?: string }[];
};

type RespostaApi = {
  id: number;
  checklist_id?: number;
  question_id?: number;
  driver_id?: number;
  unit_id?: number;
  local_time?: string;
  response?: string;
};

const hora = (iso?: string) => (iso ? new Date(iso).toLocaleString("pt-BR") : "—");

/**
 * Resposta considerada reprovada.
 *
 * Depende do tipo de pergunta, e a API devolve texto livre. A heurística cobre
 * os casos comuns; qualquer outra coisa é tratada como informativa, e não como
 * falha — marcar resposta desconhecida como reprovada geraria alarme falso.
 */
const REPROVADO = new Set(["nao", "não", "no", "ruim", "avariado", "reprovado", "falha", "false"]);
const ehReprovada = (r?: string) => Boolean(r && REPROVADO.has(r.trim().toLowerCase()));

export default function Checklist() {
  const listaQ = useQuery(checklistsQuery());
  const perguntasQ = useQuery(checklistPerguntasQuery());
  const respostasQ = useQuery(checklistRespostasQuery());

  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);

  const checklists = useMemo(() => {
    const bruto = (listaQ.data as ChecklistApi[] | undefined) ?? [];
    const t = busca.trim().toLowerCase();
    return t ? bruto.filter((c) => (c.name ?? "").toLowerCase().includes(t)) : bruto;
  }, [listaQ.data, busca]);

  const perguntas = (perguntasQ.data as PerguntaApi[] | undefined) ?? [];
  const respostas = (respostasQ.data as RespostaApi[] | undefined) ?? [];

  const perguntasDe = (id: number) =>
    perguntas.filter((p) => p.checklist_id === id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const reprovadas = respostas.filter((r) => ehReprovada(r.response));
  const obrigatorios = checklists.filter((c) => c.mandatory).length;

  const configurado = Boolean(import.meta.env.VITE_CHECKLIST_BASE);

  const COLS: Column<RespostaApi & Record<string, unknown>>[] = [
    {
      key: "local_time",
      header: "Quando",
      render: (r) => <span className="whitespace-nowrap font-mono text-[12px]">{hora(r.local_time)}</span>,
    },
    {
      key: "unit_id",
      header: "Veículo",
      render: (r) => <span className="font-mono text-[12.5px] font-semibold">{r.unit_id ?? "—"}</span>,
    },
    {
      key: "driver_id",
      header: "Motorista",
      render: (r) => <span className="font-mono text-[12px] text-muted-foreground">{r.driver_id ?? "—"}</span>,
    },
    {
      key: "question_id",
      header: "Item",
      render: (r) => {
        const p = perguntas.find((x) => x.id === r.question_id);
        return <span className="max-w-[300px] truncate text-[12.5px]">{p?.text ?? `#${r.question_id}`}</span>;
      },
    },
    {
      key: "response",
      header: "Resposta",
      align: "right",
      render: (r) => {
        const ruim = ehReprovada(r.response);
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
              ruim ? "bg-coral-tint text-coral" : "bg-leaf-tint text-leaf",
            )}
          >
            {ruim ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            {r.response ?? "—"}
          </span>
        );
      },
    },
  ];

  if (usandoMock() || !configurado) {
    return (
      <>
        <PageHeader title="Checklist" subtitle="Frota › Inspeção de veículo" />
        <div className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">
              O checklist vem de uma <strong>API separada</strong>, no API Gateway — não é o mesmo backend das demais
              telas. Para consumi-la, defina <span className="font-mono">VITE_CHECKLIST_BASE</span> no ambiente e
              alterne para API real.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Checklist"
        subtitle="Frota › Inspeção de veículo"
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome do checklist…"
              className="h-9 w-56 rounded-lg border border-border bg-white pl-8 pr-3 text-[13px] outline-none focus:border-accent"
            />
          </div>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-5 px-6 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={ClipboardList} label="Modelos" value={nf(checklists.length)} color="var(--brand-navy)" />
          <StatTile
            icon={ShieldAlert}
            label="Obrigatórios"
            value={nf(obrigatorios)}
            color="var(--gold)"
            foot="bloqueiam a operação"
          />
          <StatTile icon={ClipboardCheck} label="Respostas" value={nf(respostas.length)} color="var(--brand-sky)" />
          <StatTile
            icon={X}
            label="Itens reprovados"
            value={nf(reprovadas.length)}
            color={reprovadas.length ? "var(--coral)" : "var(--leaf)"}
          />
        </div>

        <Card
          title="Modelos de checklist"
          icon={ClipboardList}
          action={<Pill tone="sky">{checklists.length}</Pill>}
          bodyClassName="p-4"
        >
          {listaQ.isPending ? (
            <SkeletonRows rows={5} />
          ) : listaQ.error ? (
            <ErrorBox error={listaQ.error} onRetry={() => listaQ.refetch()} />
          ) : checklists.length === 0 ? (
            <EmptyNote>Nenhum checklist cadastrado.</EmptyNote>
          ) : (
            <div className="space-y-2.5">
              {checklists.map((c) => {
                const itens = perguntasDe(c.id);
                const abertoAqui = aberto === c.id;
                return (
                  <div key={c.id} className="overflow-hidden rounded-xl border border-border bg-card">
                    <button
                      onClick={() => setAberto(abertoAqui ? null : c.id)}
                      className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-foreground">
                          {c.name ?? `Checklist #${c.id}`}
                        </span>
                        <span className="block text-[11.5px] text-muted-foreground">
                          {itens.length} {itens.length === 1 ? "item" : "itens"}
                          {c.unit_category?.length
                            ? ` · ${c.unit_category.map((u) => u.name).filter(Boolean).join(", ")}`
                            : " · todas as categorias"}
                        </span>
                      </span>

                      <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {c.mandatory && <Pill tone="gold">obrigatório</Pill>}
                        {c.global && <Pill tone="sky">global</Pill>}
                        {c.send_mail && (
                          <span
                            title={`Notifica ${c.list_mail?.length ?? 0} destinatário(s)`}
                            className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground"
                          >
                            <Mail className="h-3 w-3" />
                            {c.list_mail?.length ?? 0}
                          </span>
                        )}
                      </span>
                    </button>

                    {abertoAqui && (
                      <div className="border-t border-border bg-secondary/20 px-4 py-3">
                        {itens.length === 0 ? (
                          <p className="text-[12.5px] text-gold">
                            Este checklist não tem itens — quem responder não terá o que preencher.
                          </p>
                        ) : (
                          <ol className="space-y-1.5">
                            {itens.map((p, i) => (
                              <li
                                key={p.id}
                                className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-border bg-card px-3 py-2"
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[10.5px] font-bold text-ink-soft">
                                  {p.order ?? i + 1}
                                </span>
                                <span className="min-w-0 flex-1 text-[12.5px] text-foreground">{p.text}</span>
                                {p.options && (
                                  <span className="font-mono text-[11px] text-muted-foreground">{p.options}</span>
                                )}
                                {p.type?.[0]?.name && <Pill tone="neutral">{p.type[0].name}</Pill>}
                                {p.mandatory && <Pill tone="gold">obrigatório</Pill>}
                              </li>
                            ))}
                          </ol>
                        )}

                        {c.list_mail && c.list_mail.length > 0 && (
                          <p className="mt-2.5 flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                            <Mail className="mt-0.5 h-3 w-3 shrink-0" />
                            Notifica: {c.list_mail.map((m) => m.email).filter(Boolean).join(", ")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title="Respostas recentes"
          icon={ClipboardCheck}
          action={
            reprovadas.length > 0 ? (
              <Pill tone="coral">{reprovadas.length} reprovados</Pill>
            ) : (
              <Pill tone="green">sem reprovação</Pill>
            )
          }
          bodyClassName="p-4"
        >
          {respostasQ.isPending ? (
            <SkeletonRows rows={6} />
          ) : respostas.length === 0 ? (
            <EmptyNote>Nenhuma resposta registrada.</EmptyNote>
          ) : (
            <DataTable
              columns={COLS}
              rows={[...respostas]
                .sort((a, b) => (b.local_time ?? "").localeCompare(a.local_time ?? ""))
                .slice(0, 100) as (RespostaApi & Record<string, unknown>)[]}
            />
          )}

          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            A reprovação é deduzida do texto da resposta, porque a API devolve valor livre. Resposta que não bate com
            nenhum padrão conhecido conta como informativa, não como falha — marcar o desconhecido como reprovado
            geraria alarme falso.
          </p>
        </Card>
      </div>
    </>
  );
}
