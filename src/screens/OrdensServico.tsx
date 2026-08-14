import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Clock, Download, TrendingDown, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { nf, ordensQuery, veiculosQuery } from "@/lib/queries";
import { exportarCSV } from "@/lib/export";
import { STATUS_OS_LABEL, type OrdemServico, type StatusOS } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Ordens de serviço.
 *
 * O kanban de manutenção mostra o estado do veículo; a OS registra a execução.
 * É ela que permite responder "quanto custou manter esta placa este ano" — a
 * pergunta central do dono da frota, que o sistema não conseguia responder.
 *
 * O custo realizado sai da soma dos itens, não de um campo digitado: assim a
 * diferença entre previsto e real é sempre rastreável até a peça.
 */

const TONE: Record<StatusOS, PillTone> = {
  aberta: "sky",
  aguardando_peca: "gold",
  em_execucao: "gold",
  concluida: "green",
  cancelada: "neutral",
};

const custoReal = (os: OrdemServico) =>
  os.itens.reduce((a, i) => a + i.quantidade * i.valorUnitario, 0);

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OrdensServico() {
  const { data, isPending, error, refetch } = useQuery(ordensQuery());
  const veiculosQ = useQuery(veiculosQuery(1, 200));
  const [filtro, setFiltro] = useState<StatusOS | "todas">("todas");
  const [aberta, setAberta] = useState<OrdemServico | null>(null);

  const prefixo = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of veiculosQ.data?.items ?? []) m.set(v.id, v.prefixo ?? v.placa);
    return m;
  }, [veiculosQ.data]);

  const ordens = useMemo(() => data ?? [], [data]);
  const lista = filtro === "todas" ? ordens : ordens.filter((o) => o.status === filtro);

  const abertas = ordens.filter((o) => o.status !== "concluida" && o.status !== "cancelada");
  const totalPrevisto = ordens.reduce((a, o) => a + o.custoPrevisto, 0);
  const totalReal = ordens.reduce((a, o) => a + custoReal(o), 0);
  const horasParadas = ordens.reduce((a, o) => a + (o.horasParado ?? 0), 0);

  const COLS: Column<OrdemServico & Record<string, unknown>>[] = [
    {
      key: "numero",
      header: "OS",
      render: (o) => (
        <div>
          <div className="font-mono text-[13px] font-bold text-foreground">{o.numero}</div>
          <div className="text-[11px] text-muted-foreground">{new Date(o.abertaEm).toLocaleDateString("pt-BR")}</div>
        </div>
      ),
    },
    {
      key: "veiculoId",
      header: "Veículo",
      render: (o) => <span className="font-mono text-[13px] font-semibold">{prefixo.get(o.veiculoId) ?? "—"}</span>,
    },
    { key: "descricao", header: "Serviço", render: (o) => <span className="text-[12.5px]">{o.descricao}</span> },
    {
      key: "tipo",
      header: "Tipo",
      render: (o) => (
        <Pill tone={o.tipo === "corretiva" ? "coral" : o.tipo === "preventiva" ? "gold" : "sky"}>{o.tipo}</Pill>
      ),
    },
    {
      key: "oficina",
      header: "Oficina",
      render: (o) => (
        <span className="whitespace-nowrap text-[12.5px] text-ink-soft">
          {o.oficina}
          <span className={cn("ml-1.5 rounded px-1 text-[10px] font-semibold", o.interna ? "bg-navy-tint text-brand-navy" : "bg-gold-tint text-gold")}>
            {o.interna ? "interna" : "terceira"}
          </span>
        </span>
      ),
    },
    {
      key: "horasParado",
      header: "Parado",
      align: "right",
      render: (o) => <span className="font-mono text-[12.5px]">{o.horasParado != null ? `${o.horasParado} h` : "—"}</span>,
    },
    {
      key: "custo",
      header: "Previsto / real",
      align: "right",
      render: (o) => {
        const real = custoReal(o);
        const estourou = real > o.custoPrevisto && real > 0;
        return (
          <span className="whitespace-nowrap font-mono text-[12.5px]">
            <span className="text-muted-foreground">{brl(o.custoPrevisto)}</span>
            <span className="mx-1 text-muted-foreground/50">/</span>
            <span className={cn("font-semibold", estourou ? "text-coral" : "text-foreground")}>
              {real ? brl(real) : "—"}
            </span>
          </span>
        );
      },
    },
    { key: "status", header: "Status", align: "center", render: (o) => <Pill tone={TONE[o.status]}>{STATUS_OS_LABEL[o.status]}</Pill> },
  ];

  return (
    <>
      <PageHeader
        title="Ordens de serviço"
        subtitle="Manutenção › Execução e custo"
        actions={
          <button
            onClick={() => {
              const n = exportarCSV(
                ordens,
                [
                  { cabecalho: "OS", valor: (o) => o.numero },
                  { cabecalho: "Veículo", valor: (o) => prefixo.get(o.veiculoId) ?? "" },
                  { cabecalho: "Serviço", valor: (o) => o.descricao },
                  { cabecalho: "Tipo", valor: (o) => o.tipo },
                  { cabecalho: "Oficina", valor: (o) => o.oficina },
                  { cabecalho: "Horas parado", valor: (o) => o.horasParado ?? "" },
                  { cabecalho: "Custo previsto", valor: (o) => o.custoPrevisto },
                  { cabecalho: "Custo real", valor: (o) => custoReal(o) },
                  { cabecalho: "Status", valor: (o) => STATUS_OS_LABEL[o.status] },
                ],
                "ordens-servico",
              );
              toast.success(`${n} ordens exportadas.`);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Download className="h-[15px] w-[15px]" />
            Exportar
          </button>
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        {error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={ClipboardList} label="OS abertas" value={nf(abertas.length)} color="var(--brand-navy)" />
              <StatTile icon={Clock} label="Horas paradas" value={nf(horasParadas)} unit="h" color="var(--gold)" />
              <StatTile icon={TrendingDown} label="Custo previsto" value={brl(totalPrevisto)} color="var(--brand-sky)" />
              <StatTile
                icon={Wrench}
                label="Custo realizado"
                value={brl(totalReal)}
                color={totalReal > totalPrevisto ? "var(--coral)" : "var(--leaf)"}
                foot={totalReal > totalPrevisto ? "acima do previsto" : "dentro do previsto"}
              />
            </div>

            <Card
              title="Ordens de serviço"
              icon={ClipboardList}
              action={<Pill tone="sky">{lista.length} de {ordens.length}</Pill>}
              bodyClassName="p-4"
            >
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(["todas", "aberta", "aguardando_peca", "em_execucao", "concluida"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFiltro(s)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                      filtro === s ? "bg-brand-navy text-white" : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {s === "todas" ? "Todas" : STATUS_OS_LABEL[s]}
                  </button>
                ))}
              </div>

              {isPending ? (
                <SkeletonRows rows={6} />
              ) : lista.length ? (
                <DataTable
                  columns={COLS}
                  rows={lista as (OrdemServico & Record<string, unknown>)[]}
                  onRowClick={(o) => setAberta(aberta?.id === o.id ? null : (o as OrdemServico))}
                />
              ) : (
                <EmptyNote>Nenhuma ordem com esse filtro.</EmptyNote>
              )}
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                O custo real é a soma dos itens aplicados, não um campo digitado — a diferença contra o previsto fica
                rastreável até a peça. Clique numa linha para ver a composição.
              </p>
            </Card>

            {aberta && (
              <Card
                title={`Composição — ${aberta.numero}`}
                icon={Wrench}
                action={
                  <button onClick={() => setAberta(null)} className="text-[12.5px] text-muted-foreground underline">
                    fechar
                  </button>
                }
                bodyClassName="p-4"
              >
                {aberta.itens.length ? (
                  <>
                    <ul className="space-y-2">
                      {aberta.itens.map((i, idx) => (
                        <li key={idx} className="flex items-center gap-3 text-[13px]">
                          <span
                            className={cn(
                              "shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold",
                              i.tipo === "peca" ? "bg-coral-tint text-coral" : "bg-navy-tint text-brand-navy",
                            )}
                          >
                            {i.tipo === "peca" ? "peça" : "serviço"}
                          </span>
                          <span className="flex-1 truncate text-ink-soft">{i.descricao}</span>
                          <span className="shrink-0 font-mono text-muted-foreground">
                            {i.quantidade} × {brl(i.valorUnitario)}
                          </span>
                          <span className="w-24 shrink-0 text-right font-mono font-semibold text-foreground">
                            {brl(i.quantidade * i.valorUnitario)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex justify-between border-t border-border pt-3 text-[13.5px]">
                      <span className="text-muted-foreground">
                        Previsto {brl(aberta.custoPrevisto)} · origem <strong>{aberta.origem}</strong>
                        {aberta.responsavel ? ` · ${aberta.responsavel}` : ""}
                      </span>
                      <span className="font-mono font-bold text-foreground">Total {brl(custoReal(aberta))}</span>
                    </div>
                  </>
                ) : (
                  <EmptyNote>Nenhum item lançado ainda nesta ordem.</EmptyNote>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
