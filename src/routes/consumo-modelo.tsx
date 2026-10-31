import { createFileRoute, redirect } from "@tanstack/react-router";
import { estaAutenticado } from "@/lib/session";
import ConsumoPorModelo from "@/screens/cco/ConsumoPorModelo";

/** Consumo por Modelo em tela própria (sem o menu), aberta em nova aba pelo CCO. */
export const Route = createFileRoute("/consumo-modelo")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!estaAutenticado()) throw redirect({ to: "/login" });
  },
  component: ConsumoPorModelo,
});
