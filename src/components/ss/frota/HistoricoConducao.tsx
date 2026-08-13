import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import { History, Truck, User } from "lucide-react";
import { Card, DataTable, Pill, type Column, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { conducoesMotoristaQuery, conducoesVeiculoQuery, nf } from "@/lib/queries";
import type { Conducao } from "@/types";

/**
 * Histórico de condução, nos dois sentidos:
 *
 * - `modo="veiculo"` → quem dirigiu esta placa
 * - `modo="motorista"` → que placas este motorista dirigiu
 *
 * As duas direções leem a mesma origem (`Conducao`), então nota, km e período
 * batem em qualquer tela — não há dois cálculos concorrentes.
 */

const notaTone = (n: number): PillTone => (n >= 65 ? "green" : n >= 45 ? "gold" : "coral");

const periodo = (c: Conducao) => {
  const f = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return c.fim ? `${f(c.inicio)} – ${f(c.fim)}` : `desde ${f(c.inicio)}`;
};

export function HistoricoConducao({
  modo,
  veiculoId,
  motoristaNome,
}: {
  modo: "veiculo" | "motorista";
  veiculoId?: string;
  motoristaNome?: string;
}) {
  const navigate = useNavigate();
  const porVeiculo = modo === "veiculo";

  const q = useQuery(porVeiculo ? conducoesVeiculoQuery(veiculoId) : conducoesMotoristaQuery(motoristaNome));

  const COLS: Column<Conducao & Record<string, unknown>>[] = [
    porVeiculo
      ? {
          key: "motorista",
          header: "Motorista",
          render: (c) => (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-tint text-[11px] font-semibold text-brand-navy">
                {c.motorista.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </div>
              <span className="whitespace-nowrap font-semibold text-foreground">{c.motorista}</span>
            </div>
          ),
        }
      : {
          key: "placa",
          header: "Veículo",
          render: (c) => (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-tint">
                <Truck className="h-4 w-4 text-brand-navy" />
              </div>
              <span className="font-mono font-semibold text-foreground">{c.placa}</span>
            </div>
          ),
        },
    {
      key: "periodo",
      header: "Período",
      render: (c) => (
        <span className="whitespace-nowrap text-ink-soft">
          {periodo(c)}
          {!c.fim && (
            <span className="ml-2 rounded-full bg-leaf-tint px-2 py-0.5 text-[11px] font-semibold text-leaf">
              em curso
            </span>
          )}
        </span>
      ),
    },
    { key: "km", header: "Km rodado", align: "right", render: (c) => <span className="font-mono">{nf(c.km)}</span> },
    {
      key: "notaGeral",
      header: "Nota",
      align: "center",
      render: (c) => <Pill tone={notaTone(c.notaGeral)}>{c.notaGeral}</Pill>,
    },
  ];

  return (
    <Card
      title={porVeiculo ? "Motoristas que dirigiram este veículo" : "Veículos dirigidos por este motorista"}
      icon={porVeiculo ? User : Truck}
      action={
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          clique para abrir
        </span>
      }
      bodyClassName="p-4"
    >
      {q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : q.isPending ? (
        <SkeletonRows rows={3} />
      ) : (q.data ?? []).length ? (
        <DataTable
          columns={COLS}
          rows={(q.data ?? []) as (Conducao & Record<string, unknown>)[]}
          onRowClick={(c) =>
            navigate(
              porVeiculo
                ? `/app/motoristas/perfil/${encodeURIComponent(c.motorista)}`
                : `/app/frota/manutencao?placa=${c.placa}`,
            )
          }
        />
      ) : (
        <EmptyNote>
          {porVeiculo
            ? "Nenhuma condução registrada para este veículo."
            : "Nenhuma condução registrada para este motorista."}
        </EmptyNote>
      )}
    </Card>
  );
}
