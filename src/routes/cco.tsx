import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { estaAutenticado } from "@/lib/session";

/**
 * Painel CCO em tela própria (fora do menu do sistema), para abrir em outra aba
 * e deixar num segundo monitor ou telão. Fase 1: dados de exemplo.
 *
 * Carregado só no navegador: o Leaflet toca em `window` na importação e
 * derrubaria a renderização no servidor (mesmo motivo do MapaCliente).
 */
const PainelCCO = lazy(() => import("@/screens/cco/PainelCCO"));

function Tela() {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const carregando = (
    <div className="flex h-screen items-center justify-center text-[13px] text-muted-foreground">
      Abrindo o painel…
    </div>
  );
  if (!montado) return carregando;
  return (
    <Suspense fallback={carregando}>
      <PainelCCO />
    </Suspense>
  );
}

export const Route = createFileRoute("/cco")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!estaAutenticado()) throw redirect({ to: "/login" });
  },
  component: Tela,
});
