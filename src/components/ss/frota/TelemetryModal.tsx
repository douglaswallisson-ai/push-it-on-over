import { CalendarDays, Truck, X } from "lucide-react";
import { TelemetryChart, gerarTelemetria } from "./TelemetryChart";

/**
 * Modal do gráfico de telemetria — abre a partir do acompanhamento de um
 * veículo ou motorista. Mostra o gráfico multi-série e uma amostra dos dados.
 */
export function TelemetryModal({
  titulo,
  periodo,
  onClose,
}: {
  titulo: string;
  periodo: string;
  onClose: () => void;
}) {
  const { labels, series } = gerarTelemetria();
  const rpm = series.find((s) => s.key === "rpm")!;
  const alt = series.find((s) => s.key === "altitude")!;
  const comb = series.find((s) => s.key === "combustivel")!;
  const vel = series.find((s) => s.key === "velocidade")!;
  const amostra = [4, 10, 16, 22, 28, 34, 40];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[rgba(10,16,28,0.55)]" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2 text-[14px] font-bold text-foreground">
              <Truck className="h-4 w-4 text-brand-navy" />
              {titulo}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[12px] text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {periodo}
            </span>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <TelemetryChart series={series} labels={labels} />

          <p className="mb-2 mt-6 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Amostra dos dados
          </p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-secondary">
                  {["Horário", "RPM", "Altitude", "Combustível", "Velocidade", "Pressão acel."].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {amostra.map((i, k) => (
                  <tr key={i} className={k % 2 ? "bg-[#FafbfC]" : ""}>
                    <td className="px-4 py-2 font-mono text-ink-soft">{labels[i]}</td>
                    <td className="px-4 py-2 font-mono">{Math.round(rpm.data[i])}</td>
                    <td className="px-4 py-2 font-mono">{Math.round(alt.data[i])} m</td>
                    <td className="px-4 py-2 font-mono">{Math.round(comb.data[i])} L</td>
                    <td className="px-4 py-2 font-mono">{Math.round(vel.data[i])} km/h</td>
                    <td className="px-4 py-2 font-mono">{Math.max(0, Math.round((vel.data[i] / 100) * 90))}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Clique nas legendas do gráfico para ligar/desligar cada série. Dados de exemplo.
          </p>
        </div>
      </div>
    </div>
  );
}
