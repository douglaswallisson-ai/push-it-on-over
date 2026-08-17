import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, CalendarDays, Clock, MapPin, Route, User } from "lucide-react";
import { Card, Pill, StatTile } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { linhasApiQuery, nf, turnosApiQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Escala por linha, montada a partir dos turnos reais.
 *
 * A grade antiga era motorista × dia da semana. O banco guarda outra coisa:
 * turno de linha, com um array de dias em que ele opera e motorista opcional.
 * Forçar o dado nesse formato exigiria inventar a alocação por motorista, que
 * ninguém registrou.
 *
 * Então a visão muda junto com a fonte: conectado à API, a escala é lida como a
 * operação a registra — por linha e sentido, com os dias em que cada turno roda.
 */

const DIAS = [
  { n: 0, curto: "Dom", longo: "Domingo" },
  { n: 1, curto: "Seg", longo: "Segunda" },
  { n: 2, curto: "Ter", longo: "Terça" },
  { n: 3, curto: "Qua", longo: "Quarta" },
  { n: 4, curto: "Qui", longo: "Quinta" },
  { n: 5, curto: "Sex", longo: "Sexta" },
  { n: 6, curto: "Sáb", longo: "Sábado" },
];

type TurnoApi = {
  id: number;
  tag?: string | null;
  direction?: number | null;
  hour?: string | null;
  hour_end?: string | null;
  weekday?: number[] | null;
  driver_id?: number | null;
  unit_id?: number | null;
  cerca_id?: number | null;
  cerca_id_end?: number | null;
  circular?: boolean | null;
  hour_work_initial?: string | null;
  hour_work_final?: string | null;
};

const hhmm = (h?: string | null) => (h ? h.slice(0, 5) : "—");

/** Cor por faixa do dia, para a grade ser legível de relance. */
function faixaDoTurno(hora?: string | null) {
  if (!hora) return { cls: "bg-secondary text-muted-foreground border-border", nome: "—" };
  const h = Number(hora.slice(0, 2));
  if (h >= 4 && h < 12) return { cls: "bg-leaf-tint text-leaf border-leaf-line", nome: "Manhã" };
  if (h >= 12 && h < 18) return { cls: "bg-gold-tint text-gold border-gold-line", nome: "Tarde" };
  return { cls: "bg-navy-tint text-brand-blue border-navy-line", nome: "Noite" };
}

export function EscalaPorLinha() {
  const linhasQ = useQuery(linhasApiQuery());
  const [linhaId, setLinhaId] = useState<string>("");
  const [sentido, setSentido] = useState<number | null>(null);

  const linhas = linhasQ.data ?? [];
  const linhaAtual = linhaId || linhas[0]?.id;

  const turnosQ = useQuery(turnosApiQuery(linhaAtual));
  const turnos = ((turnosQ.data as TurnoApi[] | undefined) ?? []).filter(
    (t) => sentido === null || t.direction === sentido,
  );

  /** Turnos agrupados por dia, para montar as colunas da grade. */
  const porDia = useMemo(() => {
    const m = new Map<number, TurnoApi[]>();
    for (const d of DIAS) m.set(d.n, []);
    for (const t of turnos) {
      for (const d of t.weekday ?? []) m.get(d)?.push(t);
    }
    for (const [, lista] of m) lista.sort((a, b) => (a.hour ?? "").localeCompare(b.hour ?? ""));
    return m;
  }, [turnos]);

  const comMotorista = turnos.filter((t) => t.driver_id).length;
  const comCerca = turnos.filter((t) => t.cerca_id).length;

  if (linhasQ.error) return <ErrorBox error={linhasQ.error} onRetry={() => linhasQ.refetch()} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Route} label="Turnos na linha" value={nf(turnos.length)} color="var(--brand-navy)" />
        <StatTile
          icon={User}
          label="Com motorista fixo"
          value={nf(comMotorista)}
          color={comMotorista ? "var(--leaf)" : "var(--muted-foreground)"}
          foot="os demais são alocados no dia"
        />
        <StatTile
          icon={MapPin}
          label="Com ponto de controle"
          value={nf(comCerca)}
          color="var(--brand-sky)"
          foot="cerca de abertura definida"
        />
        <StatTile icon={CalendarDays} label="Linhas" value={nf(linhas.length)} color="var(--gold)" />
      </div>

      <Card
        title="Escala por linha"
        icon={CalendarDays}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={linhaAtual ?? ""}
              onChange={(e) => setLinhaId(e.target.value)}
              className="h-9 max-w-[280px] rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
            >
              {linhas.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.codigo} — {l.nome}
                </option>
              ))}
            </select>
            {[
              { v: null, r: "Ambos" },
              { v: 0, r: "Ida" },
              { v: 1, r: "Volta" },
            ].map((s) => (
              <button
                key={String(s.v)}
                onClick={() => setSentido(s.v)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                  sentido === s.v
                    ? "bg-brand-navy text-white"
                    : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                {s.r}
              </button>
            ))}
          </div>
        }
        bodyClassName="p-0"
      >
        {turnosQ.isPending ? (
          <div className="p-4">
            <SkeletonRows rows={5} />
          </div>
        ) : turnos.length === 0 ? (
          <div className="p-4">
            <EmptyNote>Nenhum turno cadastrado nesta linha.</EmptyNote>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-[13px]">
              <thead>
                <tr>
                  {DIAS.map((d) => (
                    <th
                      key={d.n}
                      className="border-b border-border px-2 py-3 text-center font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                    >
                      {d.curto}
                      <span className="ml-1.5 rounded-full bg-secondary px-1.5 font-sans text-[10px] normal-case tracking-normal">
                        {porDia.get(d.n)?.length ?? 0}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {DIAS.map((d) => (
                    <td key={d.n} className="border-b border-border p-1.5 align-top">
                      <div className="space-y-1">
                        {(porDia.get(d.n) ?? []).map((t) => {
                          const faixa = faixaDoTurno(t.hour);
                          return (
                            <div
                              key={`${d.n}-${t.id}`}
                              title={`${t.tag ?? "Turno"} · ${hhmm(t.hour)}–${hhmm(t.hour_end)}`}
                              className={cn("rounded-lg border px-2 py-1.5", faixa.cls)}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate font-mono text-[11px] font-bold">
                                  {hhmm(t.hour)}
                                </span>
                                <ArrowLeftRight className="h-3 w-3 shrink-0 opacity-60" />
                              </div>
                              <div className="truncate text-[10.5px] opacity-80">
                                {t.tag || (t.direction === 1 ? "Volta" : "Ida")}
                              </div>
                              {t.driver_id && (
                                <div className="mt-0.5 flex items-center gap-1 text-[10px] opacity-70">
                                  <User className="h-2.5 w-2.5" />
                                  fixo
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {(porDia.get(d.n) ?? []).length === 0 && (
                          <div className="rounded-lg border border-dashed border-border px-2 py-3 text-center text-[10.5px] text-muted-foreground">
                            sem operação
                          </div>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="border-t border-border px-4 py-3 text-[11.5px] text-muted-foreground">
          A escala vem de <span className="font-mono">buss_line_shift</span>, onde o turno guarda os dias em que opera.
          Turno com motorista fixo aparece marcado; os demais são alocados no dia. O horário de trabalho do turno
          (<span className="font-mono">hour_work_initial</span>) é diferente do horário da viagem — o primeiro inclui
          o tempo de garagem.
        </p>
      </Card>

      {/* Detalhe dos turnos, com o que a grade não comporta. */}
      <Card title="Turnos" icon={Clock} action={<Pill tone="sky">{turnos.length}</Pill>} bodyClassName="p-4">
        <ul className="space-y-1.5">
          {turnos.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2">
              <span className="font-mono text-[13px] font-bold text-foreground">{t.tag || `#${t.id}`}</span>
              <Pill tone={t.direction === 1 ? "neutral" : "sky"}>{t.direction === 1 ? "Volta" : "Ida"}</Pill>
              <span className="font-mono text-[12.5px] text-ink-soft">
                {hhmm(t.hour)} – {hhmm(t.hour_end)}
              </span>
              {t.hour_work_initial && (
                <span className="text-[11.5px] text-muted-foreground">
                  jornada {hhmm(t.hour_work_initial)} – {hhmm(t.hour_work_final)}
                </span>
              )}
              <span className="ml-auto flex items-center gap-1.5">
                {t.circular && <Pill tone="gold">circular</Pill>}
                {t.cerca_id && (
                  <span title="Cerca de abertura definida" className="text-[11px] text-brand-sky">
                    <MapPin className="inline h-3 w-3" /> PC
                  </span>
                )}
                <span className="font-mono text-[11px] text-muted-foreground">
                  {(t.weekday ?? []).map((d) => DIAS[d]?.curto).join(" ")}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
