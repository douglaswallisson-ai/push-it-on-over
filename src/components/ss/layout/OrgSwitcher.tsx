import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { empresasQuery } from "@/lib/queries";
import { usandoMock } from "@/lib/modo";
import { Building2, Check, ChevronsUpDown, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { lerSessao, trocarOrganizacao } from "@/lib/session";
import { useSessao } from "@/hooks/use-sessao";
import { ehSuperAdmin } from "@/lib/permissoes";
import { cn } from "@/lib/utils";

/**
 * Seletor de organização, visível apenas para o super admin.
 *
 * Antes o clique só trocava o rótulo — havia inclusive um `TODO: disparar troca
 * de contexto real aqui` no código. Agora a escolha grava na sessão, limpa o
 * cache do React Query (senão a tela seguiria mostrando dados do cliente
 * anterior) e fica registrada na auditoria.
 */

export type Org = { id: string; name: string; plan?: string };

const ORGS: Org[] = [
  { id: "ss-matriz", name: "SS Telemática (interno)", plan: "Base própria" },
  { id: "viacao-cometa", name: "Viação Cometa", plan: "Enterprise" },
  { id: "expresso-sul", name: "Expresso Sul", plan: "Pro" },
  { id: "trans-litoral", name: "Trans Litoral", plan: "Pro" },
  { id: "rapido-serrano", name: "Rápido Serrano", plan: "Starter" },
];

export function OrgSwitcher({ expanded }: { expanded: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativa, setAtiva] = useState<Org>(ORGS[0]);
  const ref = useRef<HTMLDivElement>(null);

  const { sessao, carregando } = useSessao();
  const superAdmin = ehSuperAdmin(sessao?.perfil);

  /**
   * Ligado à API, a lista vem de `mova.group` — que é a empresa cliente. O
   * exemplo continua servindo quando não há conexão, para o seletor nunca
   * aparecer vazio.
   */
  const orgsQ = useQuery(empresasQuery());

  /**
   * Unidades operacionais disponíveis.
   *
   * O nome vai como está no cadastro. Ele já identifica a unidade por completo
   * — "FERTRAN - MUTUCA", "MV03 - APERAM" — e tentar separar empresa de
   * unidade não funciona, porque a convenção varia: num caso a empresa é o
   * prefixo, no outro é o sufixo.
   */
  /**
   * Empresas disponíveis.
   *
   * Em modo API a lista vem do servidor e **não há reserva**: se ela vier
   * vazia, o seletor mostra vazio. Cair na base de exemplo enquanto o sistema
   * está ligado ao banco real inventa clientes que não existem, e o usuário
   * não tem como saber que está olhando ficção.
   */
  const orgs = useMemo<Org[]>(() => {
    if (usandoMock()) return ORGS;
    return (orgsQ.data ?? []).map((g) => ({ id: g.id, name: g.name, plan: g.codigo ?? undefined }));
  }, [orgsQ.data]);


  // Quando a lista real chega, a organização ativa precisa passar a apontar
  // para ela — senão o rótulo mostra um cliente de exemplo enquanto os dados
  // já são de outro.
  useEffect(() => {
    if (usandoMock() || !orgsQ.data?.length) return;
    const daSessao = orgsQ.data.find((o) => o.id === sessao?.organizacaoAtivaId);
    setAtiva(daSessao ?? orgsQ.data[0]);
  }, [orgsQ.data, sessao?.organizacaoAtivaId]);

  useEffect(() => {
    const s = lerSessao();
    if (s) {
      const encontrada = ORGS.find((o) => o.id === s.organizacaoAtivaId);
      if (encontrada) setAtiva(encontrada);
    }
  }, []);

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

  /**
   * Quem escolhe unidade.
   *
   * A regra era "só super admin", e estava errada: o que define a escolha é
   * **ter mais de uma unidade acessível**, não o perfil. Um gestor com acesso
   * a doze garagens precisa trocar entre elas tanto quanto um administrador —
   * e o backend já garante que ninguém receba unidade a que não tem direito.
   *
   * Com uma unidade só, o controle vira rótulo: não há o que escolher.
   */
  const podeEscolher = superAdmin || orgs.length > 1;

  if (carregando) return null;

  /**
   * Com uma empresa só, o controle vira rótulo — mas continua clicável.
   *
   * Antes ele simplesmente travava, e um controle que não responde não informa
   * nada: "não abre" pode ser permissão negada, lista vazia, erro de rede ou
   * decisão de produto, e o usuário não tem como distinguir. Agora ele abre e
   * diz qual é o caso.
   */
  if (!podeEscolher) {
    if (!expanded) return null;

    const motivo = orgsQ.error
      ? (orgsQ.error as { status?: number })?.status === 403
        ? "Sem permissão para listar empresas (reports: groups.read)."
        : `Falha ao carregar empresas: ${(orgsQ.error as Error)?.message ?? "erro desconhecido"}`
      : orgs.length === 0
        ? "Nenhuma empresa retornada pelo servidor para o seu acesso."
        : "Você tem acesso a uma empresa apenas — não há outra para selecionar.";

    return (
      <div
        title={motivo}
        className="flex h-10 items-center gap-2.5 overflow-hidden rounded-lg px-2.5"
      >
        <Building2
          className={cn("h-[17px] w-[17px] shrink-0", orgsQ.error ? "text-coral" : "text-white/60")}
        />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[13px] font-semibold text-white">{sessao?.organizacao}</div>
          <div className="truncate text-[12px] text-white/45">{motivo}</div>
        </div>
      </div>
    );
  }

  const filtradas = orgs.filter((o) => o.name.toLowerCase().includes(busca.trim().toLowerCase()));

  const selecionar = (org: Org) => {
    if (!trocarOrganizacao(org.id, org.name)) return;
    setAtiva(org);
    setOpen(false);
    setBusca("");
    // Sem isso o React Query serve o cache da organização anterior.
    qc.clear();
    toast.success(`Contexto alterado para ${org.name}.`, {
      description: "Os dados exibidos passam a ser desta organização.",
    });
  };

  return (
    <div ref={ref} data-tour="org-switcher" className="relative">
      <button
        onClick={() => expanded && setOpen((o) => !o)}
        title={expanded ? undefined : `Organização: ${ativa.name}`}
        className={cn(
          "flex h-10 w-full items-center gap-2.5 overflow-hidden rounded-lg text-white/85 transition-colors hover:bg-white/[0.08] hover:text-white",
          expanded ? "px-2.5" : "justify-center px-0",
        )}
      >
        <Building2 className="h-[17px] w-[17px] shrink-0 text-white/60" />
        {expanded && (
          <>
            <div className="min-w-0 flex-1 text-left leading-tight">
              <div className="truncate text-[13px] font-semibold text-white">{ativa.name}</div>
              <div className="truncate text-[12px] text-white/45">Trocar unidade</div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-white/40" />
          </>
        )}
      </button>

      {open && expanded && (
        <div className="absolute bottom-full left-0 z-10 mb-2 w-[290px] overflow-hidden rounded-xl border border-white/10 bg-[#101a2e] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-2 font-mono text-[12px] font-semibold uppercase tracking-[0.14em] text-white/35">
            <ShieldCheck className="h-3 w-3" />
            Acesso de super admin
          </div>

          <div className="relative border-y border-white/10">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar unidade ou empresa…"
              className="h-9 w-full bg-transparent pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-white/30"
            />
          </div>

          <div className="rolagem-escura max-h-64 overflow-y-auto py-1">
            {filtradas.length === 0 ? (
              <p className="px-3 py-5 text-center text-[12px] leading-relaxed text-white/45">
                {orgsQ.isPending
                  ? "Carregando empresas…"
                  : busca
                    ? "Nenhuma empresa com esse nome."
                    : "Nenhuma empresa disponível para o seu acesso."}
              </p>
            ) : (
              filtradas.map((org) => (
                <button
                  key={org.id}
                  onClick={() => selecionar(org)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-white/[0.06]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-white">{org.name}</div>
                    {org.plan && <div className="truncate text-[12px] text-white/40">{org.plan}</div>}
                  </div>
                  {ativa.id === org.id && <Check className="h-4 w-4 shrink-0 text-brand-green" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
