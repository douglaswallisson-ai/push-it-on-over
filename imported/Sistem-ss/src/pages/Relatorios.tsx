import {
  BarChart3,
  Bus,
  Clock,
  Download,
  FileText,
  Fuel,
  Gauge,
  Leaf,
  MapPin,
  Route,
  ShieldAlert,
  Star,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ui/HeroBanner";
import { Card, DataTable, Pill, type Column, type PillTone } from "@/components/ui/data";

/**
 * Relatórios — catálogo de relatórios do sistema por categoria e um histórico
 * dos últimos gerados. Cada cartão dispararia a geração (protótipo).
 */

type Report = { icon: LucideIcon; title: string; desc: string; color: string };
type Categoria = { grupo: string; itens: Report[] };

const CATALOGO: Categoria[] = [
  {
    grupo: "Operação",
    itens: [
      { icon: Gauge, title: "Excesso de velocidade", desc: "Ocorrências por veículo e trecho, com duração.", color: "var(--coral)" },
      { icon: ShieldAlert, title: "Eventos e alarmes", desc: "Alarmes disparados no período, por severidade.", color: "var(--gold)" },
      { icon: MapPin, title: "Posicionamento", desc: "Histórico de posições e paradas por veículo.", color: "var(--brand-sky)" },
      { icon: Route, title: "Viagens realizadas", desc: "Rotas percorridas, km e tempo por trajeto.", color: "var(--brand-navy)" },
    ],
  },
  {
    grupo: "Frota",
    itens: [
      { icon: Fuel, title: "Consumo de combustível", desc: "Litros, KML e desvios por veículo.", color: "var(--gold)" },
      { icon: Truck, title: "Utilização da frota", desc: "Disponibilidade, ociosidade e horas de motor.", color: "var(--brand-navy)" },
      { icon: Leaf, title: "Emissão de CO₂", desc: "Pegada de carbono e compensação estimada.", color: "var(--leaf)" },
    ],
  },
  {
    grupo: "Motoristas",
    itens: [
      { icon: Star, title: "Desempenho de condução", desc: "Nota, telemetria e ranking dos motoristas.", color: "var(--brand-sky)" },
      { icon: Users, title: "Premiação", desc: "Apuração de bônus por meta e viagens.", color: "var(--leaf)" },
      { icon: Clock, title: "Espelho de ponto", desc: "Jornada, intervalos e horas extras.", color: "var(--brand-navy)" },
    ],
  },
  {
    grupo: "Fretamento",
    itens: [
      { icon: Bus, title: "Ocupação de viagens", desc: "Assentos vendidos vs. capacidade por viagem.", color: "var(--brand-navy)" },
      { icon: BarChart3, title: "Faturamento por rota", desc: "Receita, custo e margem por trajeto.", color: "var(--leaf)" },
    ],
  },
];

type Recente = { nome: string; categoria: string; periodo: string; gerado: string; formato: string; status: "Pronto" | "Processando" };
const statusTone: Record<Recente["status"], PillTone> = { Pronto: "green", Processando: "gold" };

const RECENTES: Recente[] = [
  { nome: "Consumo de combustível", categoria: "Frota", periodo: "Jul 2026", gerado: "há 12 min", formato: "PDF", status: "Pronto" },
  { nome: "Emissão de CO₂", categoria: "Frota", periodo: "1º sem 2026", gerado: "há 1 h", formato: "CSV", status: "Pronto" },
  { nome: "Espelho de ponto", categoria: "Motoristas", periodo: "24/07", gerado: "há 3 h", formato: "PDF", status: "Pronto" },
  { nome: "Faturamento por rota", categoria: "Fretamento", periodo: "Jul 2026", gerado: "agora", formato: "XLSX", status: "Processando" },
];

const COLS: Column<Recente>[] = [
  { key: "nome", header: "Relatório", render: (r) => <span className="font-semibold text-foreground">{r.nome}</span> },
  { key: "categoria", header: "Categoria", render: (r) => <Pill tone="sky">{r.categoria}</Pill> },
  { key: "periodo", header: "Período" },
  { key: "gerado", header: "Gerado", render: (r) => <span className="text-muted-foreground">{r.gerado}</span> },
  { key: "formato", header: "Formato", align: "center", render: (r) => <span className="font-mono text-[12px]">{r.formato}</span> },
  { key: "status", header: "Status", align: "center", render: (r) => <Pill tone={statusTone[r.status]}>{r.status}</Pill> },
  {
    key: "acao",
    header: "",
    align: "right",
    render: (r) =>
      r.status === "Pronto" ? (
        <button className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[12px] font-medium text-brand-navy hover:bg-secondary">
          <Download className="h-3.5 w-3.5" />
          Baixar
        </button>
      ) : (
        <span className="text-[12px] text-muted-foreground">aguarde…</span>
      ),
  },
];

export default function Relatorios() {
  return (
    <>
      <PageHeader title="Relatórios" subtitle="Central de relatórios do sistema" />

      <div className="mx-auto max-w-[1360px] space-y-8 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Central de relatórios"
          title="Relatórios do sistema"
          subtitle="Gere qualquer recorte da operação — operação, frota, motoristas e fretamento."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value="12" label="Modelos disponíveis" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value="4" label="Gerados hoje" />
          </div>
        </HeroBanner>

        {CATALOGO.map((cat) => (
          <section key={cat.grupo}>
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="inline-block h-px w-4 bg-current opacity-50" />
              {cat.grupo}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cat.itens.map((r) => (
                <button
                  key={r.title}
                  className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-[#cdd7e2]"
                >
                  <div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: `color-mix(in oklab, ${r.color} 14%, white)` }}
                  >
                    <r.icon className="h-5 w-5" style={{ color: r.color }} />
                  </div>
                  <h3 className="text-[14.5px] font-semibold text-foreground">{r.title}</h3>
                  <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-muted-foreground">{r.desc}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-navy">
                    <FileText className="h-3.5 w-3.5" />
                    Gerar relatório
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}

        <Card title="Gerados recentemente" icon={FileText} bodyClassName="p-4">
          <DataTable columns={COLS} rows={RECENTES} />
        </Card>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}
