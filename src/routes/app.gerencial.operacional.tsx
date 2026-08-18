import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Rota antiga. O gerencial é uma tela só — grupo de menu com um item apenas
 * obrigava um clique a mais para chegar ao mesmo lugar.
 */
export const Route = createFileRoute("/app/gerencial/operacional")({
  beforeLoad: () => {
    throw redirect({ to: "/app/gerencial", replace: true });
  },
});
