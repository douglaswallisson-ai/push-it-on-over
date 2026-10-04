import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Check, Warehouse } from "lucide-react";
import { garagensQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Atribuição de garagens a um usuário.
 *
 * Agrupado por unidade porque é assim que o gestor pensa a estrutura ("dá acesso
 * à Matriz inteira" ou "só ao pátio de Guarulhos"), e porque uma unidade pode
 * ter várias garagens na mesma cidade — sem o agrupamento a lista vira uma
 * enumeração de nomes parecidos.
 *
 * Lista vazia significa sem acesso a dado operacional, e isso é dito na tela em
 * vez de ficar implícito.
 */
export function GaragemPicker({
  selecionadas,
  onChange,
}: {
  selecionadas: string[];
  onChange: (v: string[]) => void;
}) {
  const { data, isPending } = useQuery(garagensQuery());
  const [busca, setBusca] = useState("");

  const garagens = useMemo(() => data ?? [], [data]);

  const porUnidade = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const filtradas = t
      ? garagens.filter(
          (g) => g.nome.toLowerCase().includes(t) || g.cidade.toLowerCase().includes(t) || g.unidade.toLowerCase().includes(t),
        )
      : garagens;
    const mapa = new Map<string, typeof filtradas>();
    for (const g of filtradas) {
      if (!mapa.has(g.unidade)) mapa.set(g.unidade, []);
      mapa.get(g.unidade)!.push(g);
    }
    return mapa;
  }, [garagens, busca]);

  const alternar = (id: string) =>
    onChange(selecionadas.includes(id) ? selecionadas.filter((x) => x !== id) : [...selecionadas, id]);

  const alternarUnidade = (ids: string[]) => {
    const todasMarcadas = ids.every((id) => selecionadas.includes(id));
    onChange(
      todasMarcadas
        ? selecionadas.filter((id) => !ids.includes(id))
        : [...new Set([...selecionadas, ...ids])],
    );
  };

  if (isPending) {
    return <div className="h-24 animate-pulse rounded-lg border border-border bg-secondary/40" />;
  }

  return (
    <div className="space-y-2">
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar garagem, cidade ou unidade…"
        className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
      />

      <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border bg-secondary/30 p-3">
        {porUnidade.size === 0 ? (
          <p className="py-4 text-center text-[13px] text-muted-foreground">Nenhuma garagem encontrada.</p>
        ) : (
          [...porUnidade.entries()].map(([unidade, lista]) => {
            const ids = lista.map((g) => g.id);
            const todas = ids.every((id) => selecionadas.includes(id));
            return (
              <div key={unidade}>
                <button
                  type="button"
                  onClick={() => alternarUnidade(ids)}
                  className="mb-1.5 flex w-full items-center gap-2 text-left"
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                    {unidade}
                  </span>
                  <span className="text-[12px] font-medium text-brand-navy underline">
                    {todas ? "desmarcar" : "marcar todas"}
                  </span>
                </button>

                <div className="space-y-1">
                  {lista.map((g) => {
                    const on = selecionadas.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => alternar(g.id)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                          on ? "bg-navy-tint" : "hover:bg-white",
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
                        <Warehouse className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-foreground">{g.nome}</span>
                          <span className="block truncate text-[12px] text-muted-foreground">
                            {g.cidade}/{g.uf} · {g.veiculos} veículos
                          </span>
                        </span>
                        {!g.ativa && (
                          <span className="shrink-0 rounded bg-secondary px-1.5 text-[12px] text-muted-foreground">
                            inativa
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="text-[12px] text-muted-foreground">
        {selecionadas.length === 0 ? (
          <span className="text-gold">
            Nenhuma garagem atribuída — o usuário não verá veículos nem motoristas.
          </span>
        ) : (
          `${selecionadas.length} garagem${selecionadas.length > 1 ? "ns" : ""} atribuída${selecionadas.length > 1 ? "s" : ""}. Administradores veem todas, independente desta lista.`
        )}
      </p>
    </div>
  );
}
