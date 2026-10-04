import { useMemo, useState } from "react";
import { Gauge, Info } from "lucide-react";
import { Card } from "@/components/ss/ui/data";
import {
  FAIXAS,
  GRUPO_LABEL,
  type DistribuicaoFaixas,
  type GrupoFaixa,
  faixasOrdenadas,
  pctDesejavel,
} from "@/lib/faixas";
import { cn } from "@/lib/utils";

/**
 * Acompanhamento por faixas de condução — a mesma leitura em frota, veículo e
 * motorista.
 *
 * A barra empilhada segue a ordem do diagrama oficial (parado → baixa
 * velocidade → movimento → inércia → tolerância), então a forma da barra é
 * comparável entre dois motoristas sem precisar ler número nenhum.
 *
 * Faixas com participação muito pequena continuam clicáveis pela legenda: a
 * barra sozinha não é alvo de clique confiável abaixo de ~1%.
 */

const ORDEM_GRUPOS: GrupoFaixa[] = ["parado", "baixa", "movimento", "inercia", "tolerancia"];

const fmt = (n: number) => n.toFixed(1).replace(".", ",");

export function FaixasConducao({
  distribuicao,
  titulo = "Faixas de condução",
  subtitulo,
  compacto = false,
}: {
  distribuicao: DistribuicaoFaixas;
  titulo?: string;
  subtitulo?: string;
  compacto?: boolean;
}) {
  const [ativa, setAtiva] = useState<string | null>(null);

  const total = useMemo(
    () => FAIXAS.reduce((a, f) => a + (distribuicao[f.id] ?? 0), 0),
    [distribuicao],
  );

  const desejavel = pctDesejavel(distribuicao);
  const ordenadas = faixasOrdenadas(distribuicao);
  const faixaAtiva = FAIXAS.find((f) => f.id === ativa) ?? null;

  // Normaliza para 100% caso a soma venha com arredondamento da API.
  const larguraDe = (id: string) => ((distribuicao[id] ?? 0) / (total || 1)) * 100;

  return (
    <Card
      title={titulo}
      icon={Gauge}
      action={
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-[12px]">
          <span className="text-muted-foreground">Faixas desejáveis</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-mono text-[12px] font-bold",
              desejavel >= 60
                ? "bg-leaf-tint text-leaf"
                : desejavel >= 40
                  ? "bg-gold-tint text-gold"
                  : "bg-coral-tint text-coral",
            )}
          >
            {fmt(desejavel)}%
          </span>
        </span>
      }
    >
      {subtitulo && <p className="mb-3 text-[12px] text-muted-foreground">{subtitulo}</p>}

      {/* Barra empilhada na ordem do diagrama. */}
      <div data-tour="faixas" className="flex h-9 w-full overflow-hidden rounded-lg border border-border">
        {FAIXAS.map((f) => {
          const w = larguraDe(f.id);
          if (w <= 0) return null;
          const on = ativa === f.id;
          return (
            <button
              key={f.id}
              onMouseEnter={() => setAtiva(f.id)}
              onFocus={() => setAtiva(f.id)}
              onClick={() => setAtiva(on ? null : f.id)}
              title={`${f.label}: ${fmt(distribuicao[f.id] ?? 0)}%`}
              aria-label={`${f.label}: ${fmt(distribuicao[f.id] ?? 0)} por cento`}
              className={cn("h-full min-w-[2px] transition-opacity", ativa && !on && "opacity-45")}
              style={{ width: `${w}%`, background: f.cor }}
            />
          );
        })}
      </div>

      {/* Régua dos grupos, para a barra ser legível sem passar o mouse. */}
      <div className="mt-1.5 flex w-full text-[12px] uppercase tracking-[0.06em] text-muted-foreground">
        {ORDEM_GRUPOS.map((g) => {
          const w = FAIXAS.filter((f) => f.grupo === g).reduce((a, f) => a + larguraDe(f.id), 0);
          if (w <= 0) return null;
          return (
            <span
              key={g}
              style={{ width: `${w}%` }}
              className="truncate border-l border-border pl-1 first:border-l-0 first:pl-0"
            >
              {w > 8 ? GRUPO_LABEL[g] : ""}
            </span>
          );
        })}
      </div>

      {/* Detalhe da faixa em foco. */}
      <div
        className={cn(
          "mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px] transition-colors",
          faixaAtiva ? "border-border bg-secondary/50" : "border-dashed border-border bg-transparent",
        )}
      >
        {faixaAtiva ? (
          <>
            <span
              className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ background: faixaAtiva.cor }}
            />
            <span className="text-ink-soft">
              <strong className="font-semibold text-foreground">{faixaAtiva.label}</strong>{" "}
              <span className="font-mono">({fmt(distribuicao[faixaAtiva.id] ?? 0)}%)</span> — {faixaAtiva.descricao}
            </span>
          </>
        ) : (
          <>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">
              Passe o mouse na barra ou clique numa faixa da lista para ver o detalhe.
            </span>
          </>
        )}
      </div>

      {/* Legenda / ranking. */}
      {!compacto && (
        <ul className="mt-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
          {ordenadas.map(({ faixa, pct }) => (
            <li key={faixa.id}>
              <button
                onMouseEnter={() => setAtiva(faixa.id)}
                onClick={() => setAtiva(ativa === faixa.id ? null : faixa.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-secondary",
                  ativa === faixa.id && "bg-secondary",
                )}
              >
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: faixa.cor }} />
                <span className="flex-1 truncate text-[13px] text-ink-soft">{faixa.label}</span>
                {faixa.desejavel && (
                  <span className="shrink-0 rounded bg-leaf-tint px-1.5 text-[12px] font-semibold text-leaf">alvo</span>
                )}
                <span className="shrink-0 font-mono text-[13px] font-semibold text-foreground">{fmt(pct)}%</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
