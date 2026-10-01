import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { linhasApiQuery, turnosApiQuery } from "@/lib/queries";
import { EscalaPorLinha } from "@/components/ss/operacao/EscalaPorLinha";
import { ex, usandoMock } from "@/lib/modo";
import { useNavigate } from "@/lib/router-compat";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, StatTile } from "@/components/ss/ui/data";
import { cn } from "@/lib/utils";

/**
 * Controle de escala — grade semanal de motoristas × dias. Cada célula é um
 * turno atribuído (manhã, tarde, noite), folga ou vazio. Dados de exemplo.
 */

const DIAS = ["Seg 21", "Ter 22", "Qua 23", "Qui 24", "Sex 25", "Sáb 26", "Dom 27"];

type Turno = "manha" | "tarde" | "noite" | "folga" | null;

const TURNOS: Record<Exclude<Turno, null>, { label: string; cls: string }> = {
  manha: { label: "06–14", cls: "bg-leaf-tint text-leaf border-leaf-line" },
  tarde: { label: "14–22", cls: "bg-gold-tint text-gold border-gold-line" },
  noite: { label: "22–06", cls: "bg-navy-tint text-brand-blue border-navy-line" },
  folga: { label: "Folga", cls: "bg-secondary text-muted-foreground border-border" },
};

const ESCALA: Array<{ nome: string; turnos: Turno[] }> = [
  { nome: "Marco Taborda", turnos: ["manha", "manha", "manha", "tarde", "tarde", "folga", "folga"] },
  { nome: "Rosemeri Tuono", turnos: ["tarde", "tarde", "folga", "manha", "manha", "manha", "folga"] },
  { nome: "Vitor Duarte", turnos: ["noite", "noite", "noite", "folga", "folga", "tarde", "tarde"] },
  { nome: "Najla Maltaca", turnos: ["folga", "manha", "manha", "manha", "tarde", "tarde", "noite"] },
  { nome: "Juliana Dubiela", turnos: ["manha", "folga", "tarde", "tarde", "noite", "noite", "manha"] },
  { nome: "Guilherme Souza", turnos: ["tarde", "tarde", "tarde", "folga", "folga", "manha", "manha"] },
];

export default function Escala() {
  const navigate = useNavigate();
  const [semana, setSemana] = useState(30);
  return (
    <>
      <PageHeader
        title="Controle de escala"
        subtitle="Fretamento · semana de 21–27 jul 2026"
        actions={
          <button
            onClick={() => navigate("/app/fretamento/viagens/nova")}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-[15px] w-[15px]" />
            Nova escala
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
        {/* Conectado à API, a escala é lida como a operação registra: por linha
            e turno. A grade por motorista continua no modo de exemplo, porque
            essa alocação não existe no banco. */}
        {!usandoMock() && <EscalaPorLinha />}


        <div className="mb-6">
          <HeroBanner
            orb
            eyebrow="Fretamento · Escala"
            title="Semana de 21–27 jul 2026"
            subtitle="Turnos, folgas e cobertura da equipe numa só grade."
          >
            <div className="flex items-center gap-6">
              <HeroMetric value={ex("100")} unit="%" label="Cobertura da semana" />
              <div className="h-10 w-px bg-white/15" />
              <HeroMetric value={ex("36")} label="Turnos escalados" />
            </div>
          </HeroBanner>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Users} label="Motoristas escalados" value={ex("6")} color="var(--brand-navy)" />
          <StatTile icon={CalendarDays} label="Turnos na semana" value={ex("36")} color="var(--brand-sky)" />
          <StatTile icon={CalendarDays} label="Folgas" value={ex("12")} color="var(--leaf)" />
          <StatTile icon={CalendarDays} label="Cobertura" value={ex("100")} unit="%" color="var(--gold)" />
        </div>

        {usandoMock() && <Card
          bodyClassName="p-0"
          title="Grade semanal"
          icon={CalendarDays}
          action={
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSemana((n) => Math.max(1, n - 1))}
                aria-label="Semana anterior"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-mono text-[12px] text-muted-foreground">Semana {semana}</span>
              <button
                onClick={() => setSemana((n) => Math.min(52, n + 1))}
                aria-label="Próxima semana"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Motorista
                  </th>
                  {DIAS.map((d) => (
                    <th
                      key={d}
                      className="border-l border-border px-3 py-3 text-center font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ESCALA.map((row, i) => (
                  <tr key={row.nome} className={cn("border-t border-border", i % 2 && "bg-[#FafbfC]")}>
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-inherit px-4 py-2.5 font-medium text-foreground">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-tint text-[10px] font-semibold text-brand-navy">
                          {row.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </div>
                        {row.nome}
                      </div>
                    </td>
                    {row.turnos.map((t, j) => (
                      <td key={j} className="border-l border-border px-2 py-2 text-center">
                        {t ? (
                          <span
                            className={cn(
                              "inline-block w-full rounded-md border px-1.5 py-1.5 text-[11px] font-semibold",
                              TURNOS[t].cls,
                            )}
                          >
                            {TURNOS[t].label}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-4 border-t border-border px-4 py-3">
            {(Object.keys(TURNOS) as Array<Exclude<Turno, null>>).map((t) => (
              <span key={t} className="flex items-center gap-2 text-[12px] text-ink-soft">
                <span className={cn("inline-block h-3.5 w-3.5 rounded border", TURNOS[t].cls)} />
                {t === "folga" ? "Folga" : `${TURNOS[t].label}h`}
              </span>
            ))}
          </div>
        </Card>}

        {usandoMock() && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Grade de exemplo. Conectado à API, a escala é exibida por linha e turno, como a operação registra.
          </p>
        )}
      </div>
    </>
  );
}
