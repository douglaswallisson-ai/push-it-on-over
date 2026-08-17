import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Rota antiga, mantida como redirecionamento.
 *
 * Manutenção saiu de Frota e virou módulo próprio. Sem isto, quem tinha o
 * endereço salvo cairia no "em breve" do catch-all e concluiria que a tela foi
 * removida.
 */
export const Route = createFileRoute("/app/frota/regeneracao")({
  beforeLoad: () => {
    throw redirect({ to: "/app/manutencao/regeneracao", replace: true });
  },
});
