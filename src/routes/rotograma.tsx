import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { estaAutenticado } from "@/lib/session";

/**
 * Rotograma em tela própria (fora do menu), aberto pela Roteirização em outra
 * aba, já no formato de documento para imprimir ou salvar em PDF.
 *
 * Carregado só no navegador: o Leaflet toca em `window` na importação (mesmo
 * motivo do Painel CCO).
 */
const Rotograma = lazy(() => import("@/screens/rotograma/Rotograma"));

function Tela() {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const carregando = (
    <div className="flex h-screen items-center justify-center text-[13px] text-muted-foreground">
      Abrindo o rotograma…
    </div>
  );
  if (!montado) return carregando;
  return (
    <Suspense fallback={carregando}>
      <Rotograma />
    </Suspense>
  );
}

export const Route = createFileRoute("/rotograma")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!estaAutenticado()) throw redirect({ to: "/login" });
  },
  component: Tela,
});
