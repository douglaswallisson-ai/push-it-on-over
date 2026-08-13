import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Warehouse } from "lucide-react";
import { garagensQuery } from "@/lib/queries";
import { focarGaragem } from "@/lib/session";
import { escopoGaragens, vePorTodasGaragens } from "@/lib/escopo";
import { useSessao } from "@/hooks/use-sessao";
import { cn } from "@/lib/utils";

/**
 * Foco de garagem.
 *
 * Distinto do escopo: o escopo define o que a pessoa *pode* ver e vem do
 * cadastro; aqui ela apenas escolhe, dentro disso, o que quer ver agora. Por
 * isso a lista já chega filtrada — nenhuma garagem fora do escopo aparece,
 * nem mesmo desabilitada.
 *
 * Some para quem tem acesso a uma única garagem: escolher entre uma opção só
 * é ruído.
 */
export function GaragemSwitcher({ expanded }: { expanded: boolean }) {
  const { sessao, carregando } = useSessao();
  const { data } = useQuery(garagensQuery());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) setOpen(false);
  }, [expanded]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (carregando || !sessao) return null;

  const todas = data ?? [];
  const escopo = escopoGaragens(sessao);
  const disponiveis = escopo === null ? todas : todas.filter((g) => escopo.includes(g.id));

  // Nada a escolher.
  if (disponiveis.length <= 1) return null;

  const foco = disponiveis.find((g) => g.id === sessao.garagemFocoId) ?? null;
  const rotulo = foco?.nome ?? (vePorTodasGaragens(sessao.perfil) ? "Todas as garagens" : "Minhas garagens");

  const escolher = (id: string | null, nome?: string) => {
    focarGaragem(id, nome);
    setOpen(false);
    // Recarrega para as listas refletirem o novo recorte de imediato.
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => expanded && setOpen((o) => !o)}
        title={expanded ? undefined : `Garagem: ${rotulo}`}
        className={cn(
          "flex h-10 w-full items-center gap-2.5 overflow-hidden rounded-lg text-white/85 transition-colors hover:bg-white/[0.08] hover:text-white",
          expanded ? "px-2.5" : "justify-center px-0",
        )}
      >
        <Warehouse className="h-[17px] w-[17px] shrink-0 text-white/60" />
        {expanded && (
          <>
            <div className="min-w-0 flex-1 text-left leading-tight">
              <div className="truncate text-[12.5px] font-semibold text-white">{rotulo}</div>
              <div className="truncate text-[10.5px] text-white/45">
                {foco ? "Filtrando por garagem" : `${disponiveis.length} disponíveis`}
              </div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-white/40" />
          </>
        )}
      </button>

      {open && expanded && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-[280px] overflow-hidden rounded-xl border border-white/10 bg-[#101a2e] py-1.5 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.5)]">
          <div className="px-3 pb-1.5 pt-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Foco de garagem
          </div>

          <button
            onClick={() => escolher(null)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
          >
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">
              {vePorTodasGaragens(sessao.perfil) ? "Todas as garagens" : "Todas as minhas garagens"}
            </span>
            {!sessao.garagemFocoId && <Check className="h-4 w-4 shrink-0 text-brand-green" />}
          </button>

          <div className="my-1 border-t border-white/10" />

          <div className="max-h-56 overflow-y-auto">
            {disponiveis.map((g) => (
              <button
                key={g.id}
                onClick={() => escolher(g.id, g.nome)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-white">{g.nome}</div>
                  <div className="truncate text-[10.5px] text-white/40">
                    {g.cidade}/{g.uf} · {g.veiculos} veículos
                  </div>
                </div>
                {sessao.garagemFocoId === g.id && <Check className="h-4 w-4 shrink-0 text-brand-green" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
