import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Clock, Gauge, Info, Route } from "lucide-react";
import { Card, Pill, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, SkeletonRows } from "@/components/ss/ui/QueryState";
import { desempenhoMotoristaQuery, linhasQuery, nf, padroesLinhaQuery } from "@/lib/queries";
import { avaliarMotorista, avaliarSemContexto, type ResultadoIndicador } from "@/lib/scoring";
import { ORIGEM_PADRAO_LABEL } from "@/types";
import { UNIDADE_SUFIXO } from "@/lib/faixas";
import { motoristaIdPorNome } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/**
 * Desempenho do motorista contexto a contexto.
 *
 * É a tela que sustenta a aceitação do programa. Uma nota única sem explicação
 * gera contestação; aqui o motorista vê em qual linha e em qual horário ficou
 * aquém, e contra qual número foi comparado.
 *
 * A comparação com a nota sem contexto fica visível de propósito: mostrar que a
 * nota muda quando a dificuldade da linha é considerada é o argumento mais
 * direto de que a contextualização importa.
 */

const notaTone = (n: number): PillTone => (n >= 95 ? "green" : n >= 80 ? "gold" : "coral");

export function DesempenhoPorContexto({ motorista }: { motorista: string }) {
  const motoristaId = motoristaIdPorNome(motorista);
  const desempenhoQ = useQuery(desempenhoMotoristaQuery(motoristaId));
  const padroesQ = useQuery(padroesLinhaQuery());
  const linhasQ = useQuery(linhasQuery());

  const codigoLinha = useMemo(
    () => new Map((linhasQ.data ?? []).map((l) => [l.id, l.codigo])),
    [linhasQ.data],
  );

  const viagens = desempenhoQ.data ?? [];
  const padroes = padroesQ.data ?? [];

  const resultado = useMemo(() => avaliarMotorista(viagens, padroes), [viagens, padroes]);
  const notaGlobal = useMemo(() => avaliarSemContexto(viagens), [viagens]);

  if (desempenhoQ.isPending || padroesQ.isPending) {
    return (
      <Card title="Desempenho por linha e horário" icon={Route}>
        <SkeletonRows rows={4} />
      </Card>
    );
  }

  if (!viagens.length) {
    return (
      <Card title="Desempenho por linha e horário" icon={Route} bodyClassName="p-4">
        <EmptyNote>Sem viagens processadas para este motorista no período.</EmptyNote>
      </Card>
    );
  }

  const diferenca = resultado.nota - notaGlobal;

  return (
    <Card
      title="Desempenho por linha e horário"
      icon={Route}
      action={
        <span className="flex items-center gap-2">
          <Pill tone={notaTone(resultado.nota)}>Nota {resultado.nota}</Pill>
          <span className="text-[12px] text-muted-foreground">{nf(Math.round(resultado.km))} km</span>
        </span>
      }
      bodyClassName="p-4"
    >
      {/* O contraste que justifica a funcionalidade. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-secondary/40 px-4 py-3">
        <span className="flex items-baseline gap-2">
          <span className="text-[12px] text-muted-foreground">Contra o padrão de cada linha</span>
          <span className="font-display text-[20px] font-bold text-foreground">{resultado.nota}</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-[12px] text-muted-foreground">Contra a média geral da frota</span>
          <span className="font-display text-[20px] font-bold text-muted-foreground">{notaGlobal}</span>
        </span>
        {diferenca !== 0 && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold",
              diferenca > 0 ? "bg-leaf-tint text-leaf" : "bg-coral-tint text-coral",
            )}
          >
            {diferenca > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {diferenca > 0 ? "+" : ""}
            {diferenca} pontos ao considerar a linha
          </span>
        )}
      </div>

      <div className="space-y-4">
        {resultado.contextos.map((ctx) => (
          <div key={`${ctx.linhaId}-${ctx.faixaHorariaId}`} className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[14px] font-bold text-foreground">
                  {codigoLinha.get(ctx.linhaId) ?? ctx.linhaId}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[12px] text-ink-soft">
                  <Clock className="h-3 w-3" />
                  {ctx.faixaNome}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  {ctx.viagens} viagens · {nf(Math.round(ctx.km))} km
                </span>
              </span>
              <Pill tone={notaTone(ctx.nota)}>{ctx.nota}</Pill>
            </div>

            <ul className="mt-3 space-y-1.5">
              {ctx.indicadores.map((r) => (
                <LinhaResultado key={r.indicador.chave} r={r} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-[12px] text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        A nota de cada contexto compara o desempenho com o padrão cadastrado para aquela linha e faixa horária. A nota
        geral é a média dos contextos, ponderada pelo quilômetro rodado em cada um — viagem curta não pesa o mesmo que
        viagem longa.
      </p>
    </Card>
  );
}

function LinhaResultado({ r }: { r: ResultadoIndicador }) {
  const sufixo = UNIDADE_SUFIXO[r.indicador.unidade];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
      <span className="min-w-[150px] flex-1 truncate text-ink-soft">{r.indicador.label}</span>

      <span className="flex items-baseline gap-1.5 font-mono">
        <span className="text-muted-foreground">você</span>
        <span className="font-semibold text-foreground">
          {r.observado}
          {sufixo}
        </span>
      </span>

      <span className="flex items-baseline gap-1.5 font-mono">
        <span className="text-muted-foreground">padrão</span>
        <span className="text-ink-soft">
          {r.esperado}
          {sufixo}
        </span>
      </span>

      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-mono text-[12px] font-semibold",
          r.favoravel ? "text-leaf" : "text-coral",
        )}
      >
        {r.favoravel ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {r.desvio !== null && r.desvio > 0 ? "+" : ""}
        {r.desvio}
      </span>

      {/* De onde veio o padrão — o motorista precisa poder conferir. */}
      <span
        className="shrink-0 rounded px-1.5 py-0.5 text-[12px] text-muted-foreground"
        title={`Este valor de referência vem do ${ORIGEM_PADRAO_LABEL[r.origem].toLowerCase()}`}
      >
        {r.origem === "global" ? "global" : r.origem === "linha" ? "linha" : "faixa"}
      </span>
    </li>
  );
}

/** Versão compacta para a lista de motoristas: nota contextual e diferença. */
export function useNotaContextual(motoristaId: string | undefined) {
  const desempenhoQ = useQuery(desempenhoMotoristaQuery(motoristaId));
  const padroesQ = useQuery(padroesLinhaQuery());

  return useMemo(() => {
    const viagens = desempenhoQ.data ?? [];
    if (!viagens.length) return null;
    const comContexto = avaliarMotorista(viagens, padroesQ.data ?? []).nota;
    const semContexto = avaliarSemContexto(viagens);
    return { comContexto, semContexto, diferenca: comContexto - semContexto };
  }, [desempenhoQ.data, padroesQ.data]);
}
