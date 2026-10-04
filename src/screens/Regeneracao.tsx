import { ModuloSemFonte } from "@/components/ss/ui/SeloDadosExemplo";
import { AlertTriangle, Ban, Flame, Info, RefreshCw, Thermometer } from "lucide-react";
import { exemploOuVazio } from "@/lib/modo";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { cn } from "@/lib/utils";

/**
 * Regeneração (DPF) — saúde do filtro de partículas diesel da frota.
 *
 * Regeneração é a queima da fuligem acumulada no DPF (motores Euro 5/6). O foco
 * de gestão é o nível de fuligem por veículo e, sobretudo, as regenerações
 * interrompidas — que entopem o filtro e levam a derate e troca cara.
 * Dados de exemplo.
 */

// Fases do ciclo de regeneração ativa.
const FASES = [
  { n: 1, label: "Detecção", desc: "Fuligem atinge o limite", icon: Info },
  { n: 2, label: "Aquecimento", desc: "Escape sobe a ~600 °C", icon: Thermometer },
  { n: 3, label: "Queima", desc: "Oxidação da fuligem", icon: Flame },
  { n: 4, label: "Conclusão", desc: "Filtro limpo, ciclo encerra", icon: RefreshCw },
];

const TIPOS: Array<{ label: string; tone: PillTone; desc: string }> = [
  { label: "Passiva", tone: "green", desc: "Automática em rodovia, escape quente. Sem intervenção." },
  { label: "Ativa", tone: "sky", desc: "A central injeta combustível para elevar a temperatura." },
  { label: "Forçada", tone: "gold", desc: "Estacionária, na oficina, quando as automáticas falham." },
];

type Veiculo = {
  placa: string;
  modelo: string;
  fuligem: number;
  temp: string;
  ultimo: string;
  tipo: string;
  tipoTone: PillTone;
  status: "Concluída" | "Em andamento" | "Necessária" | "Interrompida" | "Saturado";
  interrupcoes: number;
};

const statusTone: Record<Veiculo["status"], PillTone> = {
  Concluída: "green",
  "Em andamento": "sky",
  Necessária: "gold",
  Interrompida: "coral",
  Saturado: "coral",
};

const DADOS: Veiculo[] = [
  { placa: "BNS-1K88", modelo: "DAF XF", fuligem: 92, temp: "180 °C", ultimo: "há 6 dias", tipo: "Ativa", tipoTone: "sky", status: "Interrompida", interrupcoes: 3 },
  { placa: "JKF-7C30", modelo: "Volvo FH 540", fuligem: 88, temp: "210 °C", ultimo: "há 4 dias", tipo: "Forçada", tipoTone: "gold", status: "Necessária", interrupcoes: 1 },
  { placa: "RTA-4H21", modelo: "Volvo FH 460", fuligem: 74, temp: "605 °C", ultimo: "agora", tipo: "Ativa", tipoTone: "sky", status: "Em andamento", interrupcoes: 0 },
  { placa: "LMD-2B55", modelo: "Mercedes Actros", fuligem: 41, temp: "320 °C", ultimo: "há 1 dia", tipo: "Passiva", tipoTone: "green", status: "Concluída", interrupcoes: 0 },
  { placa: "QPX-9J07", modelo: "Scania R 450", fuligem: 28, temp: "340 °C", ultimo: "há 2 dias", tipo: "Passiva", tipoTone: "green", status: "Concluída", interrupcoes: 0 },
  { placa: "GAP-4C73", modelo: "Mercedes Actros", fuligem: 96, temp: "160 °C", ultimo: "há 9 dias", tipo: "Forçada", tipoTone: "gold", status: "Saturado", interrupcoes: 5 },
];

const fuligemTone = (n: number): PillTone => (n >= 85 ? "coral" : n >= 60 ? "gold" : "green");

const COLS: Column<Veiculo>[] = [
  {
    key: "placa",
    header: "Veículo",
    render: (v) => (
      <div>
        <div className="font-mono font-semibold text-foreground">{v.placa}</div>
        <div className="text-[12px] text-muted-foreground">{v.modelo}</div>
      </div>
    ),
  },
  {
    key: "fuligem",
    header: "Nível de fuligem",
    render: (v) => (
      <div className="flex items-center gap-2.5">
        <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn(
              "h-2 rounded-full",
              v.fuligem >= 85 ? "bg-coral" : v.fuligem >= 60 ? "bg-gold" : "bg-leaf",
            )}
            style={{ width: `${v.fuligem}%` }}
          />
        </div>
        <span className="font-mono text-[13px] font-semibold">{v.fuligem}%</span>
      </div>
    ),
  },
  { key: "temp", header: "Temp. escape", align: "right", render: (v) => <span className="font-mono">{v.temp}</span> },
  { key: "ultimo", header: "Último ciclo", render: (v) => <span className="text-muted-foreground">{v.ultimo}</span> },
  { key: "tipo", header: "Tipo", align: "center", render: (v) => <Pill tone={v.tipoTone}>{v.tipo}</Pill> },
  { key: "status", header: "Status", align: "center", render: (v) => <Pill tone={statusTone[v.status]}>{v.status}</Pill> },
  {
    key: "interrupcoes",
    header: "Interrupções",
    align: "center",
    render: (v) =>
      v.interrupcoes > 0 ? (
        <span className="inline-flex items-center gap-1 font-mono font-semibold text-coral">
          <Ban className="h-3.5 w-3.5" />
          {v.interrupcoes}×
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];

function RegeneracaoExemplo() {
  return (
    <>
      <PageHeader title="Regeneração (DPF)" subtitle="Saúde do filtro de partículas · toda a frota" />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Frota · Regeneração (DPF)"
          title="Saúde do filtro de partículas"
          subtitle="A queima da fuligem do DPF em dia evita derate e troca cara do filtro."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value="9" label="Interrompidas (7 dias)" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value="2" label="Regenerações necessárias" />
          </div>
        </HeroBanner>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Flame} label="Em regeneração agora" value="1" color="var(--brand-sky)" />
          <StatTile icon={AlertTriangle} label="Regeneração necessária" value="2" color="var(--gold)" />
          <StatTile icon={Ban} label="Interrompidas (7 dias)" value="9" color="var(--coral)" foot="3 veículos" />
          <StatTile icon={AlertTriangle} label="DPF saturado / derate" value="1" color="var(--coral)" />
        </div>

        {/* O ciclo em estágios + os tipos. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card title="Ciclo de regeneração" icon={RefreshCw} tourId="ciclo">
            <div className="flex items-center">
              {FASES.map((f, i) => (
                <div key={f.n} className="flex flex-1 items-center">
                  <div className="flex flex-1 flex-col items-center text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-brand-sky bg-navy-tint text-brand-blue">
                      <f.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-2 text-[13px] font-semibold">{f.label}</p>
                    <p className="mt-0.5 max-w-[120px] text-[12px] leading-tight text-muted-foreground">{f.desc}</p>
                  </div>
                  {i < FASES.length - 1 && <div className="mb-8 h-0.5 flex-1 bg-navy-line" />}
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-coral-tint px-4 py-3 text-[13px] text-ink-soft">
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
              <span>
                <strong className="text-coral">Regeneração interrompida:</strong> quando o ciclo é
                cortado (motorista desliga ou para antes da conclusão), a fuligem não é queimada. A
                repetição entope o DPF e leva a derate e troca do filtro.
              </span>
            </div>
          </Card>

          <Card title="Tipos de regeneração" icon={Flame}>
            <div className="space-y-3">
              {TIPOS.map((t) => (
                <div key={t.label} className="flex items-start gap-3 rounded-lg border border-border p-3">
                  <Pill tone={t.tone}>{t.label}</Pill>
                  <p className="flex-1 text-[13px] leading-relaxed text-ink-soft">{t.desc}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card title="Estado do DPF por veículo" icon={Thermometer} action={<Pill tone="coral">2 críticos</Pill>} bodyClassName="p-4">
          <DataTable columns={COLS} rows={exemploOuVazio(DADOS)} />
        </Card>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}

/** Protótipo: com API ligada, aviso no lugar dos números escritos no código. */
export default function Regeneracao() {
  return (
    <ModuloSemFonte titulo="Regeneração (DPF)" motivo="Não há leitura de DPF no banco que o sistema novo use.">
      <RegeneracaoExemplo />
    </ModuloSemFonte>
  );
}
