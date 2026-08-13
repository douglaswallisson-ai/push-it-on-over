import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Search, Truck, X } from "lucide-react";
import { veiculosQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Seleção de veículos com busca — usada em "Aplicar a" no cadastro de alarme.
 *
 * O select nativo anterior tinha a opção "Veículo específico" e não abria nada,
 * então não havia como escolher a placa. Aqui a busca é por placa ou modelo,
 * aceita vários veículos e mostra o que já foi escolhido como chips removíveis.
 */

export function VeiculoPicker({
  selecionadas,
  onChange,
  placeholder = "Buscar placa ou modelo…",
}: {
  selecionadas: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const { data, isPending } = useQuery(veiculosQuery(1, 200));
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const veiculos = useMemo(() => data?.items ?? [], [data]);

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return veiculos;
    return veiculos.filter(
      (v) => v.placa.toLowerCase().includes(t) || `${v.marca} ${v.modelo}`.toLowerCase().includes(t),
    );
  }, [veiculos, busca]);

  const alternar = (placa: string) =>
    onChange(selecionadas.includes(placa) ? selecionadas.filter((p) => p !== placa) : [...selecionadas, placa]);

  return (
    <div ref={ref} className="space-y-2">
      {/* Chips do que já foi escolhido. */}
      {selecionadas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selecionadas.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1.5 rounded-full bg-navy-tint px-2.5 py-1 font-mono text-[12px] font-semibold text-brand-navy"
            >
              {p}
              <button
                onClick={() => alternar(p)}
                aria-label={`Remover ${p}`}
                className="text-brand-navy/60 transition-colors hover:text-coral"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button onClick={() => onChange([])} className="text-[11.5px] text-muted-foreground underline">
            limpar
          </button>
        </div>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => setAberto((o) => !o)}
          className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-white px-3 text-left text-[13.5px] transition-colors hover:border-[#c7d2df]"
        >
          <span className={cn(selecionadas.length ? "text-foreground" : "text-muted-foreground")}>
            {selecionadas.length
              ? `${selecionadas.length} veículo${selecionadas.length > 1 ? "s" : ""} selecionado${selecionadas.length > 1 ? "s" : ""}`
              : "Selecionar veículos…"}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} />
        </button>

        {aberto && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-elegant">
            <div className="relative border-b border-border">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={placeholder}
                className="h-10 w-full bg-transparent pl-9 pr-3 text-[13px] outline-none"
              />
            </div>

            <div className="max-h-60 overflow-y-auto py-1">
              {isPending ? (
                <p className="px-3 py-4 text-center text-[12.5px] text-muted-foreground">Carregando frota…</p>
              ) : filtrados.length === 0 ? (
                <p className="px-3 py-4 text-center text-[12.5px] text-muted-foreground">
                  Nenhum veículo encontrado.
                </p>
              ) : (
                filtrados.map((v) => {
                  const on = selecionadas.includes(v.placa);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => alternar(v.placa)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-secondary",
                        on && "bg-navy-tint/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          on ? "border-brand-navy bg-brand-navy" : "border-border bg-white",
                        )}
                      >
                        {on && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <Truck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="font-mono text-[13px] font-semibold text-foreground">{v.placa}</span>
                      <span className="truncate text-[12px] text-muted-foreground">
                        {v.marca} {v.modelo}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <button
                type="button"
                onClick={() => onChange(filtrados.map((v) => v.placa))}
                className="text-[12px] font-medium text-brand-navy underline"
              >
                Selecionar todos ({filtrados.length})
              </button>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-full bg-brand-navy px-3 py-1 text-[12px] font-semibold text-white"
              >
                Concluir
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
