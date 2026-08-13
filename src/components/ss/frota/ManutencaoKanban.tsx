import { useMemo } from "react";
import { AlertTriangle, Clock, Wrench } from "lucide-react";
import { MANUTENCAO_COLUNAS, nf } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { CardManutencao, StatusManutencao } from "@/types";

/**
 * Kanban de manutenção — um card por placa da frota, distribuído nas colunas
 * Em dia / Preditiva / Preventiva / Corretiva / Liberado.
 *
 * Regra de precedência: um veículo com mais de uma pendência aparece na coluna
 * da mais grave (corretiva > preventiva > preditiva > em dia) e informa o total
 * no rodapé do card. Kanban não permite o mesmo card em duas colunas.
 *
 * O degradê entra como acento no topo do card, não como fundo — fundo em
 * degradê derruba o contraste do texto. A cor é a mesma do resto do sistema
 * (coral = crítico, gold = atenção, sky = informativo, leaf = ok).
 */

const PRAZO_TEXTO = (dias: number | null) => {
  if (dias === null) return null;
  if (dias < 0) return `${Math.abs(dias)} d em atraso`;
  if (dias === 0) return "vence hoje";
  return `em ${dias} d`;
};

export function ManutencaoKanban({
  cards,
  onSelect,
  selecionado,
}: {
  cards: CardManutencao[];
  onSelect: (card: CardManutencao) => void;
  selecionado?: string | null;
}) {
  const porColuna = useMemo(() => {
    const mapa = new Map<StatusManutencao, CardManutencao[]>();
    for (const col of MANUTENCAO_COLUNAS) mapa.set(col.id, []);
    for (const c of cards) mapa.get(c.status)?.push(c);
    // Dentro da coluna: mais urgente primeiro (atrasado no topo).
    for (const lista of mapa.values()) {
      lista.sort((a, b) => (a.prazoDias ?? 9999) - (b.prazoDias ?? 9999));
    }
    return mapa;
  }, [cards]);

  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {MANUTENCAO_COLUNAS.map((col) => {
        const lista = porColuna.get(col.id) ?? [];
        return (
          <section
            key={col.id}
            className="w-[268px] shrink-0 snap-start rounded-2xl border border-border bg-secondary/40"
            aria-label={`${col.label} — ${lista.length} veículos`}
          >
            <header className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.cor }} />
                <h3 className="text-[13px] font-semibold text-foreground">{col.label}</h3>
              </span>
              <span className="rounded-full bg-card px-2 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
                {lista.length}
              </span>
            </header>

            <div className="space-y-2.5 p-2.5">
              {lista.length === 0 ? (
                <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">
                  Nenhum veículo nesta coluna.
                </p>
              ) : (
                lista.map((card) => (
                  <CardVeiculo
                    key={card.veiculoId}
                    card={card}
                    cor={col.cor}
                    ativo={selecionado === card.veiculoId}
                    onClick={() => onSelect(card)}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CardVeiculo({
  card,
  cor,
  ativo,
  onClick,
}: {
  card: CardManutencao;
  cor: string;
  ativo: boolean;
  onClick: () => void;
}) {
  const prazo = PRAZO_TEXTO(card.prazoDias);
  const atrasado = card.prazoDias !== null && card.prazoDias < 0;

  return (
    <button
      onClick={onClick}
      aria-label={`${card.placa} — ${card.servico}`}
      className={cn(
        "w-full overflow-hidden rounded-xl border bg-card text-left shadow-card transition-all",
        "hover:-translate-y-0.5 hover:shadow-elegant focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sky",
        ativo ? "border-brand-navy ring-1 ring-brand-navy" : "border-border",
      )}
    >
      {/* Acento em degradê no topo — cor semântica da coluna. */}
      <div
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${cor} 0%, color-mix(in oklab, ${cor} 25%, white) 100%)` }}
      />

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[14px] font-bold leading-tight text-foreground">{card.placa}</p>
            <p className="truncate text-[11.5px] text-muted-foreground">
              {card.marca} {card.modelo}
            </p>
          </div>
          <span
            className="shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold"
            style={{
              background: `color-mix(in oklab, ${cor} 14%, white)`,
              color: `color-mix(in oklab, ${cor} 82%, black)`,
            }}
            title="Índice de saúde do veículo"
          >
            {card.indiceSaude}
          </span>
        </div>

        <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-snug text-ink-soft">{card.servico}</p>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
          {prazo && (
            <span className={cn("inline-flex items-center gap-1", atrasado ? "font-semibold text-coral" : "text-muted-foreground")}>
              {atrasado ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              {prazo}
            </span>
          )}
          {card.custoEstimado !== null && (
            <span className="inline-flex items-center gap-1 font-mono text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" />
              R$ {nf(card.custoEstimado)}
            </span>
          )}
        </div>

        {card.pendencias > 1 && (
          <p className="mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">
            +{card.pendencias - 1} outra{card.pendencias - 1 > 1 ? "s" : ""} pendência
            {card.pendencias - 1 > 1 ? "s" : ""} aberta{card.pendencias - 1 > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </button>
  );
}
