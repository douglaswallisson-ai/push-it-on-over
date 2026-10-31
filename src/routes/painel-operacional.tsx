import { createFileRoute, redirect } from "@tanstack/react-router";
import { estaAutenticado } from "@/lib/session";
import PainelOperacional from "@/screens/cco/PainelOperacional";

/** Painel Operacional em tela própria (sem o menu), aberta em nova aba pelo CCO. */
export const Route = createFileRoute("/painel-operacional")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!estaAutenticado()) throw redirect({ to: "/login" });
  },
  component: PainelOperacional,
});
