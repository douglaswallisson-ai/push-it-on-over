import { ModuloSemFonte } from "@/components/ss/ui/SeloDadosExemplo";
import { usandoMock } from "@/lib/modo";
import JornadaReal from "@/screens/jornada/JornadaReal";
import { Clock, Coffee, Download, LogIn, LogOut } from "lucide-react";
import { exemploOuVazio } from "@/lib/modo";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { exportarCSV } from "@/lib/export";
import { toast } from "sonner";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, FilterBar, FilterChip, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { CalendarDays, Users } from "lucide-react";

/**
 * Ponto — registro de jornada dos motoristas: entrada, intervalo, saída, horas
 * trabalhadas e situação (normal, hora extra, atraso, falta). Dados de exemplo.
 */

type Registro = {
  nome: string;
  entrada: string;
  intervalo: string;
  saida: string;
  horas: string;
  extra: string;
  situacao: "Normal" | "Hora extra" | "Atraso" | "Falta";
};

const sitTone: Record<Registro["situacao"], PillTone> = {
  Normal: "green",
  "Hora extra": "sky",
  Atraso: "gold",
  Falta: "coral",
};

const DADOS: Registro[] = [
  { nome: "Marco Taborda", entrada: "05:58", intervalo: "1h00", saida: "14:05", horas: "07:07", extra: "—", situacao: "Normal" },
  { nome: "Rosemeri Tuono", entrada: "14:12", intervalo: "0h48", saida: "22:40", horas: "07:40", extra: "00:40", situacao: "Hora extra" },
  { nome: "Vitor Duarte", entrada: "22:03", intervalo: "1h00", saida: "06:10", horas: "07:07", extra: "—", situacao: "Normal" },
  { nome: "Najla Maltaca", entrada: "06:34", intervalo: "1h00", saida: "14:00", horas: "06:26", extra: "—", situacao: "Atraso" },
  { nome: "Juliana Dubiela", entrada: "—", intervalo: "—", saida: "—", horas: "00:00", extra: "—", situacao: "Falta" },
  { nome: "Guilherme Souza", entrada: "13:59", intervalo: "1h00", saida: "22:15", horas: "07:16", extra: "00:16", situacao: "Hora extra" },
];

const COLS: Column<Registro>[] = [
  {
    key: "nome",
    header: "Motorista",
    render: (r) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-tint text-[11px] font-semibold text-brand-navy">
          {r.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <span className="font-semibold text-foreground">{r.nome}</span>
      </div>
    ),
  },
  { key: "entrada", header: "Entrada", align: "center", render: (r) => <span className="font-mono">{r.entrada}</span> },
  { key: "intervalo", header: "Intervalo", align: "center", render: (r) => <span className="font-mono">{r.intervalo}</span> },
  { key: "saida", header: "Saída", align: "center", render: (r) => <span className="font-mono">{r.saida}</span> },
  { key: "horas", header: "Horas", align: "center", render: (r) => <span className="font-mono font-semibold text-foreground">{r.horas}</span> },
  { key: "extra", header: "Extra", align: "center", render: (r) => <span className="font-mono">{r.extra}</span> },
  { key: "situacao", header: "Situação", align: "center", render: (r) => <Pill tone={sitTone[r.situacao]}>{r.situacao}</Pill> },
];

function PontoExemplo() {
  return (
    <>
      <PageHeader
        title="Ponto"
        subtitle="Fretamento · jornada de 24/07/2026"
        actions={
          <button
            onClick={() => {
              const n = exportarCSV(
                exemploOuVazio(DADOS),
                [
                  { cabecalho: "Motorista", valor: (r) => r.nome },
                  { cabecalho: "Entrada", valor: (r) => r.entrada },
                  { cabecalho: "Intervalo", valor: (r) => r.intervalo },
                  { cabecalho: "Saída", valor: (r) => r.saida },
                  { cabecalho: "Horas", valor: (r) => r.horas },
                  { cabecalho: "Extra", valor: (r) => r.extra },
                  { cabecalho: "Situação", valor: (r) => r.situacao },
                ],
                "espelho-ponto",
              );
              toast.success(`Espelho exportado (${n} registros).`);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary"
          >
            <Download className="h-[15px] w-[15px]" />
            Exportar espelho
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
        <div className="mb-6">
          <HeroBanner
            orb
            eyebrow="Fretamento · Ponto"
            title="Jornada de hoje · 24/07/2026"
            subtitle="Entrada, intervalo e saída dos motoristas, em tempo real."
          >
            <div className="flex items-center gap-6">
              <HeroMetric value="07:12" label="Jornada média" />
              <div className="h-10 w-px bg-white/15" />
              <HeroMetric value="6" label="Motoristas escalados" />
            </div>
          </HeroBanner>
        </div>

        <FilterBar>
          <FilterChip icon={CalendarDays} label="Dia" value="24/07/2026" />
          <FilterChip icon={Users} label="Equipe" value="Todos" />
        </FilterBar>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={LogIn} label="Presentes" value="5" color="var(--leaf)" />
          <StatTile icon={LogOut} label="Faltas" value="1" color="var(--coral)" />
          <StatTile icon={Clock} label="Horas extras" value="00:56" color="var(--brand-sky)" />
          <StatTile icon={Coffee} label="Em intervalo" value="2" color="var(--gold)" />
        </div>

        <Card title="Registros do dia" icon={Clock} bodyClassName="p-4">
          <DataTable columns={COLS} rows={DADOS} />
        </Card>

        <p className="py-6 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}

/** Protótipo: com API ligada, aviso no lugar dos números escritos no código. */
/** Com a API ligada, a tela real de jornada; o protótipo fica no modo demonstração. */
export default function Ponto() {
  return usandoMock() ? <PontoSemFonte /> : <JornadaReal abaInicial="ponto" />;
}

function PontoSemFonte() {
  return (
    <ModuloSemFonte titulo="Ponto" motivo="Não há registro de ponto de motorista no banco que o sistema novo leia.">
      <PontoExemplo />
    </ModuloSemFonte>
  );
}
