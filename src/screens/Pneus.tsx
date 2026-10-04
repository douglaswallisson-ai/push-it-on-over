import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CircleDot, Package, RotateCcw, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { SeloDadosExemplo } from "@/components/ss/ui/SeloDadosExemplo";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { nf, pneusQuery, veiculosQuery } from "@/lib/queries";
import type { Pneu } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Gestão de pneus.
 *
 * Em frota de ônibus o pneu é o segundo maior custo depois do combustível, e a
 * decisão que importa não é "quanto custou" e sim **custo por quilômetro
 * rodado**: um pneu caro que roda 120 mil km sai mais barato que um barato que
 * roda 60 mil.
 *
 * A recapagem multiplica isso — por isso o controle de vidas fica ao lado do
 * CPK do pneu, e não numa coluna solta.
 */

const STATUS_LABEL: Record<Pneu["status"], string> = {
  em_uso: "Em uso",
  estoque: "Estoque",
  recapagem: "Em recapagem",
  sucata: "Sucateado",
};

const STATUS_TONE: Record<Pneu["status"], PillTone> = {
  em_uso: "green",
  estoque: "sky",
  recapagem: "gold",
  sucata: "neutral",
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Custo por km do pneu, considerando o total de vidas já consumidas. */
const cpkPneu = (p: Pneu) => (p.kmAcumulado ? p.custoAquisicao / p.kmAcumulado : 0);

export default function Pneus() {
  const { data, isPending, error, refetch } = useQuery(pneusQuery());
  const veiculosQ = useQuery(veiculosQuery(1, 200));
  const [filtro, setFiltro] = useState<Pneu["status"] | "todos">("todos");

  const prefixo = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of veiculosQ.data?.items ?? []) m.set(v.id, v.prefixo ?? v.placa);
    return m;
  }, [veiculosQ.data]);

  const pneus = useMemo(() => data ?? [], [data]);
  const lista = filtro === "todos" ? pneus : pneus.filter((p) => p.status === filtro);

  const emUso = pneus.filter((p) => p.status === "em_uso");
  /** Abaixo do mínimo legal — troca imediata, é autuação em fiscalização. */
  const criticos = emUso.filter((p) => p.sulcoMm <= p.sulcoMinimoMm);
  const proximos = emUso.filter((p) => p.sulcoMm > p.sulcoMinimoMm && p.sulcoMm <= 3);
  const capitalImobilizado = pneus.filter((p) => p.status === "estoque").reduce((a, p) => a + p.custoAquisicao, 0);

  const COLS: Column<Pneu & Record<string, unknown>>[] = [
    {
      key: "fogo",
      header: "Pneu",
      render: (p) => (
        <div>
          <div className="font-mono text-[13px] font-bold text-foreground">{p.fogo}</div>
          <div className="text-[12px] text-muted-foreground">
            {p.marca} · {p.medida}
          </div>
        </div>
      ),
    },
    {
      key: "veiculoId",
      header: "Veículo / posição",
      render: (p) =>
        p.veiculoId ? (
          <span className="whitespace-nowrap">
            <span className="font-mono text-[13px] font-semibold text-foreground">{prefixo.get(p.veiculoId) ?? "—"}</span>
            <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 font-mono text-[12px] text-ink-soft">{p.posicao}</span>
          </span>
        ) : (
          <span className="text-[13px] text-muted-foreground">—</span>
        ),
    },
    {
      key: "sulcoMm",
      header: "Sulco",
      align: "right",
      render: (p) => {
        const critico = p.sulcoMm <= p.sulcoMinimoMm;
        const atencao = !critico && p.sulcoMm <= 3;
        const pct = Math.min(100, (p.sulcoMm / 14) * 100);
        return (
          <div className="ml-auto w-24">
            <div className="flex items-baseline justify-end gap-1">
              <span className={cn("font-mono text-[13px] font-semibold", critico ? "text-coral" : atencao ? "text-gold" : "text-leaf")}>
                {p.sulcoMm.toFixed(1)} mm
              </span>
              {critico && <AlertTriangle className="h-3 w-3 text-coral" />}
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-1.5 rounded-full", critico ? "bg-coral" : atencao ? "bg-gold" : "bg-leaf")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: "vidas",
      header: "Vidas",
      align: "center",
      render: (p) => (
        <span className="inline-flex items-center gap-1" title={`${p.vidas} de ${p.maxVidas} vidas consumidas`}>
          {Array.from({ length: p.maxVidas }, (_, i) => (
            <span
              key={i}
              className={cn("h-2 w-2 rounded-full", i < p.vidas ? "bg-gold" : "border border-border bg-white")}
            />
          ))}
        </span>
      ),
    },
    {
      key: "kmAcumulado",
      header: "Km rodado",
      align: "right",
      render: (p) => <span className="font-mono text-[13px]">{nf(p.kmAcumulado)}</span>,
    },
    {
      key: "cpk",
      header: "Custo por km",
      align: "right",
      render: (p) => {
        const v = cpkPneu(p);
        return (
          <span className={cn("font-mono text-[13px] font-semibold", v > 0.05 ? "text-coral" : v > 0.03 ? "text-gold" : "text-leaf")}>
            {v ? `R$ ${v.toFixed(4)}` : "—"}
          </span>
        );
      },
    },
    {
      key: "pressaoPsi",
      header: "Pressão",
      align: "right",
      render: (p) => <span className="font-mono text-[13px] text-muted-foreground">{p.pressaoPsi ? `${p.pressaoPsi} psi` : "—"}</span>,
    },
    { key: "status", header: "Status", align: "center", render: (p) => <Pill tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Pill> },
  ];

  return (
    <>
      <PageHeader title="Pneus" subtitle="Manutenção › Controle de pneus" />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        <SeloDadosExemplo motivo="Controle de pneus ainda não existe no backend." />

        {error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={CircleDot} label="Pneus em uso" value={nf(emUso.length)} color="var(--brand-navy)" />
              <StatTile
                icon={AlertTriangle}
                label="Abaixo do mínimo"
                value={nf(criticos.length)}
                color="var(--coral)"
                foot="troca imediata"
              />
              <StatTile icon={RotateCcw} label="Próximos do limite" value={nf(proximos.length)} color="var(--gold)" foot="sulco até 3 mm" />
              <StatTile icon={Package} label="Capital em estoque" value={brl(capitalImobilizado)} color="var(--brand-sky)" />
            </div>

            {criticos.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-coral-line bg-coral-tint/50 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                <p className="text-[13px] text-coral">
                  <strong>
                    {criticos.length} pneu{criticos.length > 1 ? "s" : ""} abaixo do sulco mínimo de 1,6 mm.
                  </strong>{" "}
                  Rodar assim é infração de trânsito e retém o veículo em fiscalização —{" "}
                  {criticos.map((p) => `${p.fogo} (${prefixo.get(p.veiculoId ?? "") ?? "?"} ${p.posicao})`).join(", ")}.
                </p>
              </div>
            )}

            <Card
              title="Inventário de pneus"
              icon={CircleDot}
              action={<Pill tone="sky">{lista.length} de {pneus.length}</Pill>}
              bodyClassName="p-4"
            >
              <div className="mb-3 flex flex-wrap gap-1.5">
                {(["todos", "em_uso", "estoque", "recapagem", "sucata"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFiltro(s)}
                    className={cn(
                      "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                      filtro === s ? "bg-brand-navy text-white" : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                    )}
                  >
                    {s === "todos" ? "Todos" : STATUS_LABEL[s]}
                    <span className="ml-1.5 font-mono opacity-70">
                      {s === "todos" ? pneus.length : pneus.filter((p) => p.status === s).length}
                    </span>
                  </button>
                ))}
              </div>

              {isPending ? (
                <SkeletonRows rows={6} />
              ) : lista.length ? (
                <DataTable columns={COLS} rows={lista as (Pneu & Record<string, unknown>)[]} />
              ) : (
                <EmptyNote>Nenhum pneu com esse filtro.</EmptyNote>
              )}

              <p className="mt-3 text-[12px] text-muted-foreground">
                O número que decide a compra é o custo por quilômetro, não o preço: um pneu caro que roda 120 mil km sai
                mais barato que um barato que roda 60 mil. A recapagem multiplica isso, por isso as vidas ficam ao lado.
              </p>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
