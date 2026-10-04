import { ModuloSemFonte } from "@/components/ss/ui/SeloDadosExemplo";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, Bus, Route, TrendingUp, UserCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { exemploOuVazio, usandoMock } from "@/lib/modo";
import { useLocation } from "@/lib/router-compat";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, FilterBar, FilterChip, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { nf } from "@/lib/queries";
import { cn } from "@/lib/utils";
import ContagemReal from "@/screens/passageiros/ContagemReal";

/**
 * Contagem de passageiros — embarques/desembarques por parada e ocupação por
 * viagem, a partir dos sensores de porta. Dados de exemplo.
 */

// Embarque/desembarque por parada e ocupação corrente da linha.
const PARADAS = [
  { nome: "Terminal Tietê", sobe: 38, desce: 0 },
  { nome: "Barra Funda", sobe: 6, desce: 3 },
  { nome: "Osasco", sobe: 4, desce: 8 },
  { nome: "Jundiaí", sobe: 2, desce: 5 },
  { nome: "Campinas", sobe: 1, desce: 12 },
  { nome: "Limeira", sobe: 0, desce: 9 },
  { nome: "Rio Claro", sobe: 0, desce: 14 },
];
const CAP = 44;

type Viagem = {
  codigo: string;
  /** Distingue embarque de linha urbana de embarque de fretamento. */
  modalidade: "urbano" | "fretamento";
  rota: string;
  veiculo: string;
  embarques: number;
  desembarques: number;
  pico: number;
  ocupacao: number;
};

const ocupTone = (n: number): PillTone => (n >= 90 ? "coral" : n >= 70 ? "gold" : "green");

const DADOS: Viagem[] = [
  { codigo: "8207-01 · tab 4", modalidade: "urbano", rota: "T. Central → T. Pinheiros", veiculo: "11596", embarques: 312, desembarques: 308, pico: 78, ocupacao: 98 },
  { codigo: "8207-01 · tab 21", modalidade: "urbano", rota: "T. Pinheiros → T. Central", veiculo: "11278", embarques: 268, desembarques: 271, pico: 71, ocupacao: 89 },
  { codigo: "3450-10 · tab 8", modalidade: "urbano", rota: "T. Itaquera → Aricanduva", veiculo: "11107", embarques: 194, desembarques: 190, pico: 62, ocupacao: 78 },
  { codigo: "FRT-2041", modalidade: "fretamento", rota: "SP → Curitiba", veiculo: "PLA-1A23", embarques: 51, desembarques: 51, pico: 42, ocupacao: 95 },
  { codigo: "FRT-2042", modalidade: "fretamento", rota: "Curitiba → Floripa", veiculo: "PLA-2B45", embarques: 34, desembarques: 32, pico: 30, ocupacao: 83 },
  { codigo: "FRT-2043", modalidade: "fretamento", rota: "SP → Campinas", veiculo: "PLA-3C67", embarques: 22, desembarques: 22, pico: 18, ocupacao: 75 },
  { codigo: "FRT-2039", modalidade: "fretamento", rota: "Santos → SP", veiculo: "PLA-1A23", embarques: 44, desembarques: 44, pico: 44, ocupacao: 100 },
];

const COLS: Column<Viagem>[] = [
  { key: "codigo", header: "Viagem", render: (v) => <span className="font-mono font-semibold text-foreground">{v.codigo}</span> },
  {
    key: "modalidade",
    header: "Modalidade",
    render: (v) => (
      <Pill tone={v.modalidade === "urbano" ? "sky" : "green"}>
        {v.modalidade === "urbano" ? "Urbano" : "Fretamento"}
      </Pill>
    ),
  },
  { key: "rota", header: "Rota", render: (v) => <span className="font-medium text-foreground">{v.rota}</span> },
  { key: "veiculo", header: "Veículo", render: (v) => <span className="font-mono">{v.veiculo}</span> },
  { key: "embarques", header: "Embarques", align: "right", render: (v) => <span className="font-mono text-leaf">↑ {v.embarques}</span> },
  { key: "desembarques", header: "Desembarques", align: "right", render: (v) => <span className="font-mono text-coral">↓ {v.desembarques}</span> },
  { key: "pico", header: "Pico a bordo", align: "right", render: (v) => <span className="font-mono font-semibold">{v.pico}</span> },
  {
    key: "ocupacao",
    header: "Ocupação",
    align: "center",
    render: (v) => <Pill tone={ocupTone(v.ocupacao)}>{v.ocupacao}%</Pill>,
  },
];

function ContagemPassageirosExemplo() {
  /**
   * A tela é a mesma para os dois módulos, mas o filtro inicial acompanha de
   * onde o usuário veio: entrando por Transporte urbano ele espera ver linha,
   * não fretamento. Sem isso teria de trocar o filtro toda vez.
   */
  const { pathname } = useLocation();
  const modalidadeInicial = pathname.includes("/urbano/") ? "urbano" : "todas";

  /**
   * A tela serve às duas modalidades. Sem separar, embarque de linha urbana
   * (centenas por viagem) soma com embarque de fretamento (dezenas) no mesmo
   * número, e a média perde sentido.
   */
  const [modalidade, setModalidade] = useState<"todas" | "urbano" | "fretamento">(modalidadeInicial);
  // Módulo sem endpoint: o exemplo é a única fonte, e o selo já declara isso.
  // Em modo API a lista fica vazia, para não misturar dado inventado com real.
  const fonte = usandoMock() ? exemploOuVazio(DADOS) : [];
  const linhas = modalidade === "todas" ? fonte : fonte.filter((d) => d.modalidade === modalidade);
  const totalEmbarques = linhas.reduce((a, d) => a + d.embarques, 0);

  return (
    <>
      <PageHeader title="Contagem de passageiros" subtitle="Embarque e desembarque por parada · urbano e fretamento" />

      <div className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
        <div className="mb-6">
          <HeroBanner
            orb
            eyebrow="Operação · Contagem de passageiros"
            title={`${nf(totalEmbarques)} passageiros transportados hoje`}
            subtitle="Embarque e desembarque por parada, direto dos sensores de porta."
          >
            <div className="flex items-center gap-6">
              <HeroMetric value="27" label="A bordo agora" />
              <div className="h-10 w-px bg-white/15" />
              <HeroMetric value="88" unit="%" label="Ocupação média" />
            </div>
          </HeroBanner>
        </div>

        <FilterBar>
          <FilterChip
            icon={Route}
            label="Modalidade"
            value={modalidade === "todas" ? "Todas" : modalidade === "urbano" ? "Urbano" : "Fretamento"}
            options={["Todas", "Urbano", "Fretamento"]}
            onSelect={(v) => setModalidade(v === "Todas" ? "todas" : v === "Urbano" ? "urbano" : "fretamento")}
          />
          <FilterChip icon={CalendarDays} label="Dia" value="24/07/2026" />
          <FilterChip icon={Bus} label="Viagem" value="FRT-2041" />
        </FilterBar>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatTile icon={Users} label="Passageiros hoje" value="642" color="var(--brand-navy)" />
          <StatTile icon={ArrowUpRight} label="Embarques" value="151" color="var(--leaf)" />
          <StatTile icon={ArrowDownLeft} label="Desembarques" value="149" color="var(--coral)" />
          <StatTile icon={UserCheck} label="A bordo agora" value="27" color="var(--brand-sky)" />
          <StatTile icon={TrendingUp} label="Ocupação média" value="88" unit="%" color="var(--gold)" />
        </div>

        <Card title="Fluxo por parada — FRT-2041 · SP → Curitiba" icon={Bus} className="mb-6">
          <StopFlow />
        </Card>

        <Card title="Ocupação por viagem" icon={Users} bodyClassName="p-4">
          <DataTable columns={COLS} rows={linhas} />
        </Card>

        <p className="py-6 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}

/** Fluxo por parada: barras de embarque (sobe) e desembarque (desce) + a bordo corrente. */
function StopFlow() {
  let onboard = 0;
  const rows = PARADAS.map((p) => {
    onboard += p.sobe - p.desce;
    return { ...p, onboard };
  });
  const maxFlux = Math.max(...PARADAS.map((p) => Math.max(p.sobe, p.desce)));

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[640px] items-end gap-3">
        {rows.map((p) => (
          <div key={p.nome} className="flex flex-1 flex-col items-center gap-2">
            {/* Barras: embarque para cima, desembarque para baixo. */}
            <div className="flex h-40 w-full flex-col items-center justify-end gap-1">
              <span className="font-mono text-[12px] text-leaf">{p.sobe > 0 ? `↑${p.sobe}` : ""}</span>
              <div
                className="w-6 rounded-t bg-leaf"
                style={{ height: `${(p.sobe / maxFlux) * 60}px` }}
              />
              <div className="h-px w-full bg-border" />
              <div
                className="w-6 rounded-b bg-coral"
                style={{ height: `${(p.desce / maxFlux) * 60}px` }}
              />
              <span className="font-mono text-[12px] text-coral">{p.desce > 0 ? `↓${p.desce}` : ""}</span>
            </div>
            <div
              className={cn(
                "w-full rounded-md py-1 text-center font-mono text-[12px] font-semibold",
                p.onboard >= CAP * 0.9 ? "bg-coral-tint text-coral" : "bg-navy-tint text-brand-blue",
              )}
            >
              {p.onboard}
            </div>
            <span className="text-center text-[12px] leading-tight text-muted-foreground">{p.nome}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-ink-soft">
        <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded bg-leaf" /> Embarque</span>
        <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded bg-coral" /> Desembarque</span>
        <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded bg-navy-tint" /> A bordo (capacidade {CAP})</span>
      </div>
    </div>
  );
}

/** Com dado real: embarques por cartão (passenger_board). Em demonstração, o protótipo. */
export default function ContagemPassageiros() {
  if (!usandoMock()) return <ContagemReal />;
  return (
    <ModuloSemFonte titulo="Contagem de passageiros" motivo="Dados de exemplo.">
      <ContagemPassageirosExemplo />
    </ModuloSemFonte>
  );
}
