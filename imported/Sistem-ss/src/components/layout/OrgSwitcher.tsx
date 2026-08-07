import { useEffect, useRef, useState } from "react";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Seletor de organização/cliente, visível só para admins da SS, no rodapé
 * da sidebar (acima do bloco de usuário). Permite navegar entre as bases
 * dos clientes sem sair do produto — útil pra suporte, onboarding e
 * validação de configuração por conta.
 *
 * Dados mock por enquanto (protótipo). Trocar por fetch real de
 * organizações quando a API de contas existir.
 */

type Org = { id: string; name: string; plan?: string };

const MOCK_ORGS: Org[] = [
  { id: "ss-matriz", name: "SS Telemática (interno)", plan: "Admin" },
  { id: "viacao-cometa", name: "Viação Cometa", plan: "Enterprise" },
  { id: "expresso-sul", name: "Expresso Sul", plan: "Pro" },
  { id: "trans-litoral", name: "Trans Litoral", plan: "Pro" },
  { id: "rapido-serrano", name: "Rápido Serrano", plan: "Starter" },
];

export function OrgSwitcher({ expanded }: { expanded: boolean }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Org>(MOCK_ORGS[0]);
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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => expanded && setOpen((o) => !o)}
        title={expanded ? undefined : `Cliente: ${active.name}`}
        className={cn(
          "flex h-10 w-full items-center gap-2.5 overflow-hidden rounded-lg text-white/85 transition-colors hover:bg-white/[0.08] hover:text-white",
          expanded ? "px-2.5" : "justify-center px-0",
        )}
      >
        <Building2 className="h-[17px] w-[17px] shrink-0 text-white/60" />
        {expanded && (
          <>
            <div className="min-w-0 flex-1 text-left leading-tight">
              <div className="truncate text-[12.5px] font-semibold text-white">{active.name}</div>
              <div className="truncate text-[10.5px] text-white/45">Trocar cliente</div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-white/40" />
          </>
        )}
      </button>

      {open && expanded && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-[280px] overflow-hidden rounded-xl border border-white/10 bg-[#101a2e] py-1.5 shadow-[0_16px_40px_-8px_rgba(0,0,0,0.5)]">
          <div className="px-3 pb-1.5 pt-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Navegar como admin
          </div>
          {MOCK_ORGS.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                setActive(org);
                setOpen(false);
                // TODO: disparar troca de contexto/tenant real aqui
                // (recarregar dados do cliente selecionado).
              }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.06]",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-white">{org.name}</div>
                {org.plan && (
                  <div className="truncate text-[10.5px] text-white/40">{org.plan}</div>
                )}
              </div>
              {active.id === org.id && <Check className="h-4 w-4 shrink-0 text-brand-green" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
