import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Rota antiga, mantida como redirecionamento.
 *
 * Indicadores e painel operacional viraram uma tela só. Separar consolidado de
 * detalhe obrigava o gestor a abrir duas telas para responder a mesma pergunta.
 */
export const Route = createFileRoute("/app/gerencial/indicadores")({
  beforeLoad: () => {
    throw redirect({ to: "/app/gerencial", replace: true });
  },
});
