import { createFileRoute, redirect } from "@tanstack/react-router";
import { estaAutenticado } from "@/lib/session";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { mensagemErro } from "@/lib/suporte-api";
import SinoticoUrbano, { useLinhasUrbanas } from "@/screens/operacao/SinoticoUrbano";

/**
 * Painel sinótico em tela própria (sem o menu), para o gestor deixar numa TV acompanhando a operação.
 * É o mesmo sinótico do menu (Urbano › Painel sinótico) — um só no sistema (PM, 12/10/2026).
 */
function Tela() {
  const q = useLinhasUrbanas();
  if (q.data?.length) return <SinoticoUrbano linhas={q.data} telao />;
  const msg = !grupoAtivo()
    ? "Escolha uma empresa na plataforma para ver as linhas."
    : q.isLoading
      ? "Carregando as linhas em operação…"
      : q.isError
        ? `Não foi possível carregar as linhas agora: ${mensagemErro(q.error)}`
        : "Nenhum ônibus desta empresa está rodando em linha urbana agora (últimos 40 minutos).";
  return (
    <div className="flex h-screen items-center justify-center p-8 text-center text-[14px] text-muted-foreground">
      {msg}
    </div>
  );
}

export const Route = createFileRoute("/sinotico")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!estaAutenticado()) throw redirect({ to: "/login" });
  },
  component: Tela,
});
