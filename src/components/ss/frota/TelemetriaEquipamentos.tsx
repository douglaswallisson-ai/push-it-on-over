import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, Radio, RefreshCw, Search, Signal, Truck } from "lucide-react";
import { Card, DataTable, Dot, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import {
  COMUNICACAO_LABEL,
  COMUNICACAO_TONE,
  LIMIAR_COMUNICACAO,
  dataHora,
  desde,
  equipamentosQuery,
  nf,
  statusComunicacao,
} from "@/lib/queries";
import type { Equipamento, StatusComunicacao } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Inventário de equipamentos de telemetria: qual aparelho está em qual placa e
 * quando ele comunicou dados pela última vez.
 *
 * Os limiares vêm de `LIMIAR_COMUNICACAO` (queries.ts) — a mesma regra usada em
 * qualquer outro ponto do sistema que fale em "sem sinal".
 *
 * Reaproveitado em dois lugares: na aba Telemetria da tela de Manutenção e na
 * rota própria `/app/frota/telemetria` (destino do KPI "Sem sinal" em Veículos).
 */

const FILTROS: { id: StatusComunicacao | "todos"; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "online", label: "Comunicando" },
  { id: "atencao", label: "Atraso" },
  { id: "sem_sinal", label: "Sem sinal" },
  { id: "nunca", label: "Nunca comunicou" },
];

const COLS: Column<Equipamento & Record<string, unknown>>[] = [
  {
    key: "serial",
    header: "Equipamento",
    render: (e) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-tint">
          <Cpu className="h-4 w-4 text-brand-navy" />
        </div>
        <div>
          <div className="font-mono font-semibold text-foreground">{e.serial}</div>
          <div className="text-[11.5px] text-muted-foreground">
            {e.modelo} · fw {e.firmware}
          </div>
        </div>
      </div>
    ),
  },
  {
    key: "placa",
    header: "Veículo",
    render: (e) =>
      e.placa ? (
        <span className="inline-flex items-center gap-2">
          <Truck className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono font-semibold text-foreground">{e.placa}</span>
        </span>
      ) : (
        <Pill tone="neutral">Em estoque</Pill>
      ),
  },
  {
    key: "ultimaComunicacao",
    header: "Última comunicação",
    align: "right",
    render: (e) => (
      <span
        className="font-mono text-[13px] text-ink-soft"
        title={dataHora(e.ultimaComunicacao)}
      >
        {e.ultimaComunicacao ? desde(e.ultimaComunicacao) : "—"}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    align: "center",
    render: (e) => {
      const s = statusComunicacao(e.ultimaComunicacao);
      return (
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px]">
          <Dot tone={COMUNICACAO_TONE[s]} />
          {COMUNICACAO_LABEL[s]}
        </span>
      );
    },
  },
  {
    key: "simOperadora",
    header: "Operadora",
    align: "right",
    render: (e) => <span className="text-muted-foreground">{e.simOperadora ?? "—"}</span>,
  },
];

export function TelemetriaEquipamentos({
  filtroInicial = "todos",
}: {
  filtroInicial?: StatusComunicacao | "todos";
}) {
  const { data, isPending, error, refetch, isFetching } = useQuery(equipamentosQuery());
  const [filtro, setFiltro] = useState<StatusComunicacao | "todos">(filtroInicial);
  const [busca, setBusca] = useState("");

  const equipamentos = useMemo(() => data ?? [], [data]);

  const conta = (s: StatusComunicacao) =>
    equipamentos.filter((e) => statusComunicacao(e.ultimaComunicacao) === s).length;

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return equipamentos.filter((e) => {
      const s = statusComunicacao(e.ultimaComunicacao);
      if (filtro !== "todos" && s !== filtro) return false;
      if (!termo) return true;
      return (
        e.serial.toLowerCase().includes(termo) ||
        (e.placa ?? "").toLowerCase().includes(termo) ||
        e.modelo.toLowerCase().includes(termo)
      );
    });
  }, [equipamentos, filtro, busca]);

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Cpu} label="Equipamentos" value={nf(equipamentos.length)} color="var(--brand-navy)" />
        <StatTile icon={Signal} label="Comunicando" value={nf(conta("online"))} color="var(--leaf)" />
        <StatTile icon={Radio} label="Em atraso" value={nf(conta("atencao"))} color="var(--gold)" />
        <StatTile icon={Radio} label="Sem sinal" value={nf(conta("sem_sinal") + conta("nunca"))} color="var(--coral)" />
      </div>

      <Card
        title="Equipamentos instalados"
        icon={Cpu}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(ev) => setBusca(ev.target.value)}
                placeholder="Serial ou placa…"
                className="h-9 w-44 rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
              />
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              title="Atualizar"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </button>
          </div>
        }
        bodyClassName="p-4"
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={cn(
                "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                filtro === f.id
                  ? "bg-brand-navy text-white"
                  : "border border-border bg-white text-muted-foreground hover:bg-secondary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isPending ? (
          <SkeletonRows rows={6} />
        ) : lista.length ? (
          <DataTable columns={COLS} rows={lista as (Equipamento & Record<string, unknown>)[]} />
        ) : (
          <EmptyNote>Nenhum equipamento com esse filtro.</EmptyNote>
        )}

        <p className="mt-3 text-[11.5px] text-muted-foreground">
          Comunicando: até {LIMIAR_COMUNICACAO.online} h · Atraso: até {LIMIAR_COMUNICACAO.atencao} h · Sem sinal:
          acima disso. Passe o mouse sobre o tempo para ver a data exata.
        </p>
      </Card>
    </div>
  );
}
