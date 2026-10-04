import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Página antiga. As rotas do cliente passaram a abrir na Roteirização, com o
 * traçado e os dados da rota (decisão do PM, 04/10/2026).
 */
export const Route = createFileRoute("/app/fretamento/rotas")({
  beforeLoad: () => {
    throw redirect({ to: "/app/fretamento/roteirizacao", replace: true });
  },
});
