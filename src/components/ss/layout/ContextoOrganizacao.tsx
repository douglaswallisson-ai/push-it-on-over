import { useEffect, useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { trocarOrganizacao } from "@/lib/session";
import { useSessao } from "@/hooks/use-sessao";
import { ehSuperAdmin } from "@/lib/permissoes";

/**
 * Faixa fixa exibida quando o super admin está com a sessão apontada para a
 * base de um cliente.
 *
 * O super admin pode tudo em qualquer organização — essa é a regra. O risco que
 * sobra não é ele fazer algo proibido, é fazer a coisa certa na base errada:
 * excluir um usuário achando que está na base interna, editar o alarme do
 * cliente A pensando no B. A faixa existe para que o contexto nunca fique
 * implícito.
 *
 * Não bloqueia nada e não pode ser dispensada em definitivo: some ao voltar
 * para a organização de origem.
 */
export function ContextoOrganizacao() {
  const { sessao } = useSessao();
  const [recolhida, setRecolhida] = useState(false);

  // Toda troca de organização traz o aviso de volta.
  useEffect(() => setRecolhida(false), [sessao?.organizacaoAtivaId]);

  if (!sessao || !ehSuperAdmin(sessao.perfil)) return null;
  if (sessao.organizacaoAtivaId === sessao.organizacaoId) return null;

  const voltar = () => {
    trocarOrganizacao(sessao.organizacaoId, sessao.organizacao);
    // Recarrega para limpar qualquer dado do cliente que esteja em memória.
    if (typeof window !== "undefined") window.location.reload();
  };

  if (recolhida) {
    return (
      <button
        onClick={() => setRecolhida(false)}
        title={`Você está na base de ${sessao.organizacaoAtiva}`}
        className="fixed right-4 top-4 z-[220] flex h-9 items-center gap-2 rounded-full bg-gold px-3 text-[12px] font-semibold text-white shadow-lg"
      >
        <ShieldAlert className="h-4 w-4" />
        {sessao.organizacaoAtiva}
      </button>
    );
  }

  return (
    <div
      role="status"
      className="sticky top-0 z-[190] flex flex-wrap items-center justify-between gap-3 bg-gold px-5 py-2.5 text-white"
    >
      <span className="flex items-center gap-2.5 text-[13px]">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          Você está como <strong>super admin</strong> na base de{" "}
          <strong>{sessao.organizacaoAtiva}</strong>. Tudo que fizer aqui altera os dados deste cliente e fica
          registrado na auditoria.
        </span>
      </span>

      <span className="flex items-center gap-2">
        <button
          onClick={voltar}
          className="rounded-full bg-white/20 px-3 py-1 text-[13px] font-semibold transition-colors hover:bg-white/30"
        >
          Voltar para {sessao.organizacao}
        </button>
        <button
          onClick={() => setRecolhida(true)}
          aria-label="Recolher aviso"
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>
      </span>
    </div>
  );
}
