import { useMemo, useState } from "react";
import { Clock, Download, MapPin, Navigation, Power, Truck } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ui/HeroBanner";
import { Card, DataTable, Dot, Pill, type Column, type PillTone } from "@/components/ui/data";
import { FleetFilters, type FleetFilterValue } from "@/components/ui/FleetFilters";
import { cn } from "@/lib/utils";

/**
 * Posicionamento da frota — retrato da posição atual de cada veículo (último
 * ping), com mapa e tabela. Diferente do Mapa ao vivo, é orientado a relatório:
 * endereço, ignição e horário do último sinal. Dados de exemplo.
 */

type Pos = {
  placa: string;
  motorista: string;
  endereco: string;
  velocidade: number;
  ignicao: "Ligada" | "Desligada";
  atualizado: string;
  status: PillTone;
  x: number;
  y: number;
};

const DADOS: Pos[] = [
  { placa: "BCA7A56", motorista: "Marco Taborda", endereco: "BR-116, km 214 — SP", velocidade: 82, ignicao: "Ligada", atualizado: "há 30s", status: "green", x: 58, y: 62 },
  { placa: "SXD1J61", motorista: "Najla Maltaca", endereco: "Av. Goiás, 1200 — Goiânia/GO", velocidade: 74, ignicao: "Ligada", atualizado: "há 45s", status: "green", x: 45, y: 48 },
  { placa: "EBZ3590", motorista: "Remildo N. Lima", endereco: "Rod. BR-232 — Recife/PE", velocidade: 0, ignicao: "Ligada", atualizado: "há 1 min", status: "gold", x: 78, y: 34 },
  { placa: "LUO5I08", motorista: "Richard Acácio", endereco: "Terminal de Cargas — Curitiba/PR", velocidade: 0, ignicao: "Desligada", atualizado: "há 4 min", status: "neutral", x: 50, y: 74 },
  { placa: "SB157940", motorista: "—", endereco: "Anel Rodoviário — Salvador/BA", velocidade: 0, ignicao: "Desligada", atualizado: "há 22 min", status: "coral", x: 72, y: 46 },
];

const COLS: Column<Pos>[] = [
  {
    key: "placa",
    header: "Veículo",
    render: (p) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-tint">
          <Truck className="h-4 w-4 text-brand-navy" />
        </div>
        <div>
          <div className="font-mono font-semibold text-foreground">{p.placa}</div>
          <div className="text-[11.5px] text-muted-foreground">{p.motorista}</div>
        </div>
      </div>
    ),
  },
  { key: "endereco", header: "Localização", render: (p) => <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{p.endereco}</span> },
  { key: "velocidade", header: "Veloc.", align: "right", render: (p) => <span className="font-mono">{p.velocidade} km/h</span> },
  {
    key: "ignicao",
    header: "Ignição",
    align: "center",
    render: (p) => (
      <span className={cn("inline-flex items-center gap-1.5 text-[13px]", p.ignicao === "Ligada" ? "text-leaf" : "text-muted-foreground")}>
        <Power className="h-3.5 w-3.5" />
        {p.ignicao}
      </span>
    ),
  },
  { key: "atualizado", header: "Último sinal", align: "right", render: (p) => <span className="flex items-center justify-end gap-1.5 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{p.atualizado}</span> },
];

const uniq = (a: string[]) => [...new Set(a)].filter((v) => v && v !== "—");

export default function Posicionamento() {
  const [filtros, setFiltros] = useState<FleetFilterValue>({ veiculo: "Todos", motorista: "Todos", data: "2026-07-24" });
  const visiveis = useMemo(
    () =>
      DADOS.filter(
        (p) =>
          (filtros.veiculo === "Todos" || p.placa === filtros.veiculo) &&
          (filtros.motorista === "Todos" || p.motorista === filtros.motorista),
      ),
    [filtros],
  );
  return (
    <>
      <PageHeader
        title="Posicionamento"
        subtitle="Frota › Posição atual"
        actions={
          <button className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary">
            <Download className="h-[15px] w-[15px]" />
            Exportar
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Frota · Posicionamento"
          title="Posição atual da frota"
          subtitle="Último sinal de cada veículo — atualizado continuamente."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value="15" label="Em movimento" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value="33" label="Parados" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value="há 30s" label="Última atualização" />
          </div>
        </HeroBanner>

        <FleetFilters
          veiculos={DADOS.map((p) => p.placa)}
          motoristas={uniq(DADOS.map((p) => p.motorista))}
          value={filtros}
          onChange={setFiltros}
        />

        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          {/* Mapa. */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div
              className="relative h-[360px] w-full lg:h-full lg:min-h-[420px]"
              style={{ background: "radial-gradient(circle at 55% 45%, #EAF3EC 0%, #E3EDF3 50%, #DCE6EC 100%)" }}
            >
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                <path d="M-50 180 Q 320 120 640 240 T 1200 280" fill="none" stroke="white" strokeWidth="6" opacity="0.7" />
                <path d="M-50 400 Q 400 480 700 360 T 1300 440" fill="none" stroke="white" strokeWidth="6" opacity="0.7" />
              </svg>
              {visiveis.map((p) => (
                <div key={p.placa} style={{ left: `${p.x}%`, top: `${p.y}%` }} className="absolute -translate-x-1/2 -translate-y-full">
                  <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-semibold shadow-card">
                    <Dot tone={p.status} />
                    {p.placa}
                  </div>
                  <div className="mx-auto h-2.5 w-2.5 -translate-y-1 rotate-45 border-b border-r border-border bg-white" />
                </div>
              ))}
              <div className="absolute bottom-4 right-4 rounded-lg border border-border bg-white/90 px-3 py-2 text-[11px] text-muted-foreground shadow-card backdrop-blur">
                Representação ilustrativa · mapa real no lugar deste canvas
              </div>
            </div>
          </div>

          {/* Resumo lateral. */}
          <Card title="Resumo" icon={Navigation}>
            <div className="space-y-3">
              {[
                { label: "Em movimento", value: 15, tone: "green" as PillTone },
                { label: "Parados com ignição", value: 6, tone: "gold" as PillTone },
                { label: "Desligados", value: 15, tone: "neutral" as PillTone },
                { label: "Sem sinal recente", value: 3, tone: "coral" as PillTone },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                    <Dot tone={r.tone} />
                    {r.label}
                  </span>
                  <span className="font-display text-lg font-bold tabular-nums">{r.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Posições" icon={MapPin} action={<Pill tone="sky">{visiveis.length} de 48</Pill>} bodyClassName="p-4">
          <DataTable columns={COLS} rows={visiveis} />
        </Card>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}
