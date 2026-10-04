import { createFileRoute } from "@tanstack/react-router";
import RoteirizacaoExemplo from "@/screens/RoteirizacaoOtimizada";
import RoteirizacaoReal from "@/screens/roteirizacao/RoteirizacaoReal";
import { usandoMock } from "@/lib/modo";

function Screen() {
  return usandoMock() ? <RoteirizacaoExemplo /> : <RoteirizacaoReal />;
}

export const Route = createFileRoute("/app/fretamento/roteirizacao")({ component: Screen });
