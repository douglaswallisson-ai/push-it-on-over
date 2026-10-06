import { createFileRoute } from "@tanstack/react-router";
import Exemplo from "@/screens/ContratosOrganizacao";
import ContratosReal from "@/screens/contratos/ContratosReal";
import { usandoMock } from "@/lib/modo";

// Dado real: contratos.py (todo cliente tem contrato; grupo novo só por contrato). Demonstração: tela de exemplo.
function Screen() {
  return usandoMock() ? <Exemplo /> : <ContratosReal />;
}

export const Route = createFileRoute("/console/contratos")({ component: Screen });
