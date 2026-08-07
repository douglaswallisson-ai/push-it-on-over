import { useState } from "react";
import { Armchair, Bus, Save } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, Pill } from "@/components/ss/ui/data";
import { SeatMap, SeatLegend } from "@/components/ss/fretamento/SeatMap";
import { Field, Input, Select } from "@/components/ss/ui/form";

/**
 * Layout de assentos — desenha/edita a planta de um veículo de fretamento e
 * pré-visualiza a ocupação. Aqui os assentos "ocupados" são exemplo; na viagem
 * real vêm da lista de passageiros. Protótipo sem persistência.
 */

const OCUPADOS = new Set([3, 4, 7, 12, 15, 16, 23, 28, 31, 40]);

export default function LayoutAssentos() {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rows, setRows] = useState(11);

  const toggle = (n: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  const total = rows * 4;
  const livres = total - OCUPADOS.size;

  return (
    <>
      <PageHeader
        title="Layout de assentos"
        subtitle="Fretamento › Planta do veículo"
        actions={
          <button className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">
            <Save className="h-[15px] w-[15px]" />
            Salvar layout
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
        <div className="mb-6">
          <HeroBanner
            orb
            eyebrow="Fretamento · Layout de assentos"
            title="Planta do veículo"
            subtitle="Desenhe a configuração de assentos e pré-visualize a ocupação."
          >
            <div className="flex items-center gap-6">
              <HeroMetric value={String(total)} label="Lugares" />
              <div className="h-10 w-px bg-white/15" />
              <HeroMetric value={String(livres)} label="Livres" />
            </div>
          </HeroBanner>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Card title="Planta do veículo" icon={Bus} action={<Pill tone="sky">{total} lugares</Pill>}>
            <div className="flex flex-col items-center gap-6">
              <SeatMap rows={rows} occupied={OCUPADOS} selected={selected} onToggle={toggle} />
              <SeatLegend />
            </div>
          </Card>

          <div className="space-y-5">
            <Card title="Configuração">
              <div className="grid gap-4">
                <Field label="Veículo">
                  <Select>
                    <option>Ônibus Executivo — PLA-1A23</option>
                    <option>Ônibus Leito — PLA-2B45</option>
                    <option>Micro-ônibus — PLA-3C67</option>
                  </Select>
                </Field>
                <Field label="Fileiras">
                  <Input
                    type="number"
                    value={rows}
                    min={4}
                    max={16}
                    onChange={(e) => setRows(Number(e.target.value) || 11)}
                  />
                </Field>
                <Field label="Configuração">
                  <Select defaultValue="2+2">
                    <option value="2+2">2 + 2 (executivo)</option>
                    <option value="1+2">1 + 2 (leito)</option>
                  </Select>
                </Field>
              </div>
            </Card>

            <Card title="Ocupação">
              <div className="grid grid-cols-3 gap-3 text-center">
                <Metric icon={Armchair} value={total} label="Total" color="var(--brand-navy)" />
                <Metric icon={Armchair} value={livres} label="Livres" color="var(--leaf)" />
                <Metric icon={Armchair} value={OCUPADOS.size} label="Ocupados" color="var(--coral)" />
              </div>
              {selected.size > 0 && (
                <div className="mt-4 rounded-lg bg-navy-tint p-3 text-[13px] text-brand-navy">
                  <strong>{selected.size}</strong> assento(s) selecionado(s):{" "}
                  <span className="font-mono">{[...selected].sort((a, b) => a - b).join(", ")}</span>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Armchair;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3">
      <Icon className="mx-auto h-4 w-4" style={{ color }} />
      <p className="mt-1 font-display text-xl font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
