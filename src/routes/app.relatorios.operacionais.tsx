import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Rota antiga. Os relatórios passaram a abrir dentro da central, para o usuário
 * comparar dois sem perder o caminho de volta.
 */
export const Route = createFileRoute("/app/relatorios/operacionais")({
  beforeLoad: () => {
    throw redirect({ to: "/app/relatorios", replace: true });
  },
});
