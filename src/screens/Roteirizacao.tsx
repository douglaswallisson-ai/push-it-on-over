import { useState } from "react";
import { Clock, Flag, GripVertical, MapPin, Plus, Route, Sparkles, Truck } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { useNavigate } from "@/lib/router-compat";
import { toast } from "sonner";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, StatTile } from "@/components/ss/ui/data";
import { cn } from "@/lib/utils";

/**
 * Roteirização — planejamento e otimização de rota de fretamento. Lista de
 * paradas ordenadas + prévia no mapa e sugestão de otimização. O mapa é uma
 * representação estilizada; a integração real entra no lugar do canvas.
 * Dados de exemplo.
 */

type Parada = {
  nome: string;
  tipo: "origem" | "parada" | "destino";
  horario: string;
  trecho?: string;
  x: number;
  y: number;
};

const PARADAS: Parada[] = [
  { nome: "Terminal Tietê — SP", tipo: "origem", horario: "07:00", x: 30, y: 78 },
  { nome: "Barra Funda", tipo: "parada", horario: "07:25", trecho: "8 km · 25 min", x: 38, y: 66 },
  { nome: "Osasco", tipo: "parada", horario: "07:55", trecho: "14 km · 30 min", x: 33, y: 54 },
  { nome: "Jundiaí", tipo: "parada", horario: "08:50", trecho: "58 km · 55 min", x: 48, y: 44 },
  { nome: "Campinas", tipo: "parada", horario: "09:40", trecho: "45 km · 50 min", x: 55, y: 32 },
  { nome: "Rio Claro — destino", tipo: "destino", horario: "10:45", trecho: "72 km · 65 min", x: 68, y: 20 },
];

export default function Roteirizacao() {
  const navigate = useNavigate();
  const [sugestaoAplicada, setSugestaoAplicada] = useState(false);
  return (
    <>
      <PageHeader
        title="Roteirização"
        subtitle="Fretamento · planejamento de rota"
        actions={
          <button
            onClick={() => navigate("/app/fretamento/viagens/nova")}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-[15px] w-[15px]" />
            Nova rota
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
        <div className="mb-6">
          <HeroBanner
            orb
            eyebrow="Fretamento · Roteirização"
            title="São Paulo → Rio Claro"
            subtitle="Planeje a rota, ordene as paradas e aplique a otimização sugerida."
          >
            <div className="flex items-center gap-6">
              <HeroMetric value="197" unit="km" label="Distância total" />
              <div className="h-10 w-px bg-white/15" />
              <HeroMetric value="3h45" label="Tempo estimado" />
            </div>
          </HeroBanner>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Route} label="Distância total" value="197" unit="km" color="var(--brand-navy)" />
          <StatTile icon={Clock} label="Tempo estimado" value="3h45" color="var(--brand-sky)" />
          <StatTile icon={MapPin} label="Paradas" value="6" color="var(--gold)" />
          <StatTile icon={Truck} label="Veículo" value="PLA-1A23" color="var(--leaf)" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
          {/* Sequência de paradas. */}
          <Card title="Paradas" icon={Route} action={
              <button
                onClick={() => navigate("/app/fretamento/viagens/nova")}
                className="text-[12.5px] font-semibold text-brand-navy hover:text-brand-blue"
              >
                + Adicionar
              </button>
            }>
            <ol className="space-y-1">
              {PARADAS.map((p, i) => (
                <li key={p.nome}>
                  {p.trecho && (
                    <div className="flex items-center gap-2 py-1 pl-[26px] text-[11px] text-muted-foreground">
                      <span className="font-mono">{p.trecho}</span>
                    </div>
                  )}
                  <div className="group flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 hover:border-border hover:bg-secondary/50">
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground" />
                    <StopDot tipo={p.tipo} n={i + 1} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-foreground">{p.nome}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{p.horario}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-navy-tint px-4 py-3 text-[12.5px] text-brand-navy">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
              <span>
                <strong>Sugestão:</strong> inverter Osasco e Barra Funda economiza ~12 min e 6 km no
                trecho urbano.{" "}
                <button
                  onClick={() => {
                    setSugestaoAplicada(true);
                    toast.success("Sugestão aplicada.", {
                      description: "Osasco e Barra Funda invertidas — 12 min e 6 km a menos.",
                    });
                  }}
                  disabled={sugestaoAplicada}
                  className="font-semibold underline disabled:no-underline disabled:opacity-60"
                >
                  {sugestaoAplicada ? "Aplicada" : "Aplicar"}
                </button>
              </span>
            </div>
          </Card>

          {/* Prévia no mapa. */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <RouteCanvas />
            <div className="absolute bottom-4 right-4 rounded-lg border border-border bg-white/90 px-3 py-2 text-[11px] text-muted-foreground shadow-card backdrop-blur">
              Representação ilustrativa · integração de mapa real no lugar deste canvas
            </div>
          </div>
        </div>

        <p className="py-6 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}

function StopDot({ tipo, n }: { tipo: Parada["tipo"]; n: number }) {
  if (tipo === "origem")
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf text-white">
        <MapPin className="h-3.5 w-3.5" />
      </span>
    );
  if (tipo === "destino")
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-white">
        <Flag className="h-3.5 w-3.5" />
      </span>
    );
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-brand-sky bg-white font-mono text-[11px] font-bold text-brand-blue">
      {n}
    </span>
  );
}

/** Canvas estilizado com a linha da rota e os marcadores de parada. */
function RouteCanvas() {
  const pts = PARADAS.map((p) => `${p.x}% ${p.y}%`);
  const poly = PARADAS.map((p) => `${p.x},${p.y}`).join(" ");
  void pts;
  return (
    <div
      className="relative h-[440px] w-full lg:h-[560px]"
      style={{ background: "radial-gradient(circle at 55% 45%, #EAF3EC 0%, #E3EDF3 50%, #DCE6EC 100%)" }}
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          points={poly}
          fill="none"
          stroke="var(--brand-navy)"
          strokeWidth="0.7"
          strokeDasharray="1.6 1.2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{ strokeWidth: 2.5 }}
        />
      </svg>

      {PARADAS.map((p, i) => (
        <div
          key={p.nome}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2"
        >
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-card",
              p.tipo === "origem" ? "bg-leaf" : p.tipo === "destino" ? "bg-brand-navy" : "bg-brand-sky",
            )}
          >
            {p.tipo === "origem" ? "A" : p.tipo === "destino" ? "B" : i}
          </div>
          <div className="mt-1 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium shadow-card backdrop-blur">
            {p.nome.split(" — ")[0]}
          </div>
        </div>
      ))}
    </div>
  );
}
