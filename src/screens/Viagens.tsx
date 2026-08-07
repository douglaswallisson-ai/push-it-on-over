import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Ban, Bus, CalendarDays, CheckCircle2, Clock, Plus } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { FleetFilters, type FleetFilterValue } from "@/components/ss/ui/FleetFilters";

/**
 * Viagens de fretamento — agenda de viagens com rota, recurso e ocupação.
 * Dados de exemplo.
 */

type Viagem = {
  codigo: string;
  rota: string;
  saida: string;
  veiculo: string;
  motorista: string;
  ocupacao: string;
  status: "Agendada" | "Em curso" | "Concluída" | "Cancelada";
};

const statusTone: Record<Viagem["status"], PillTone> = {
  Agendada: "sky",
  "Em curso": "green",
  Concluída: "neutral",
  Cancelada: "coral",
};

const DADOS: Viagem[] = [
  { codigo: "FRT-2041", rota: "São Paulo → Curitiba", saida: "25/07 · 07:00", veiculo: "PLA-1A23", motorista: "Marco Taborda", ocupacao: "42/44", status: "Em curso" },
  { codigo: "FRT-2042", rota: "Curitiba → Florianópolis", saida: "25/07 · 14:30", veiculo: "PLA-2B45", motorista: "Rosemeri Tuono", ocupacao: "30/36", status: "Agendada" },
  { codigo: "FRT-2043", rota: "São Paulo → Campinas", saida: "26/07 · 06:15", veiculo: "PLA-3C67", motorista: "Vitor Duarte", ocupacao: "18/24", status: "Agendada" },
  { codigo: "FRT-2039", rota: "Santos → São Paulo", saida: "24/07 · 18:00", veiculo: "PLA-1A23", motorista: "Najla Maltaca", ocupacao: "44/44", status: "Concluída" },
  { codigo: "FRT-2038", rota: "São Paulo → Rio de Janeiro", saida: "24/07 · 22:00", veiculo: "PLA-2B45", motorista: "Juliana Dubiela", ocupacao: "0/36", status: "Cancelada" },
];

const COLS: Column<Viagem>[] = [
  { key: "codigo", header: "Código", render: (v) => <span className="font-mono font-semibold text-foreground">{v.codigo}</span> },
  { key: "rota", header: "Rota", render: (v) => <span className="font-medium text-foreground">{v.rota}</span> },
  { key: "saida", header: "Saída" },
  { key: "veiculo", header: "Veículo", render: (v) => <span className="font-mono">{v.veiculo}</span> },
  { key: "motorista", header: "Motorista" },
  { key: "ocupacao", header: "Ocupação", align: "center", render: (v) => <span className="font-mono">{v.ocupacao}</span> },
  { key: "status", header: "Status", align: "center", render: (v) => <Pill tone={statusTone[v.status]}>{v.status}</Pill> },
];

const uniq = (a: string[]) => [...new Set(a)].filter((v) => v && v !== "—");

export default function Viagens() {
  const navigate = useNavigate();
  const [filtros, setFiltros] = useState<FleetFilterValue>({ veiculo: "Todos", motorista: "Todos", data: "2026-07-24" });
  const lista = useMemo(
    () =>
      DADOS.filter(
        (v) =>
          (filtros.veiculo === "Todos" || v.veiculo === filtros.veiculo) &&
          (filtros.motorista === "Todos" || v.motorista === filtros.motorista),
      ),
    [filtros],
  );
  return (
    <>
      <PageHeader
        title="Viagens"
        subtitle="Fretamento · agenda de viagens"
        actions={
          <button
            onClick={() => navigate("/app/fretamento/viagens/nova")}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-[15px] w-[15px]" />
            Nova viagem
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
        <div className="mb-6">
          <HeroBanner
            orb
            eyebrow="Fretamento · Viagens"
            title="Agenda de fretamento"
            subtitle="18 viagens nesta semana — rota, recurso e ocupação de cada uma."
          >
            <div className="flex items-center gap-6">
              <HeroMetric value="642" label="Passageiros na semana" />
              <div className="h-10 w-px bg-white/15" />
              <HeroMetric value="87" unit="%" label="Ocupação média" />
            </div>
          </HeroBanner>
        </div>

        <FleetFilters
          veiculos={uniq(DADOS.map((v) => v.veiculo))}
          motoristas={uniq(DADOS.map((v) => v.motorista))}
          value={filtros}
          onChange={setFiltros}
        />

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Clock} label="Em curso agora" value="3" color="var(--leaf)" />
          <StatTile icon={CalendarDays} label="Agendadas" value="12" color="var(--brand-sky)" />
          <StatTile icon={CheckCircle2} label="Concluídas" value="40" color="var(--brand-navy)" />
          <StatTile icon={Ban} label="Canceladas" value="2" color="var(--coral)" />
        </div>

        <Card title="Agenda de viagens" icon={Bus} action={<Pill tone="sky">{lista.length} viagens</Pill>} bodyClassName="p-4">
          <DataTable columns={COLS} rows={lista} onRowClick={() => navigate("/app/fretamento/viagens/nova")} />
        </Card>

        <p className="py-6 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}
