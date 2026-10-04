import { createFileRoute } from "@tanstack/react-router";
import Exemplo from "@/screens/cadastros/Combustivel";
import ControleCombustivel from "@/screens/combustivel/ControleCombustivel";
import { usandoMock } from "@/lib/modo";

// O cadastro de combustível (postos, bombas e preço) é a aba Postos do Controle de Combustível.
function Screen() {
  return usandoMock() ? <Exemplo /> : <ControleCombustivel abaInicial="postos" />;
}

export const Route = createFileRoute("/app/cadastros/combustivel")({ component: Screen });
