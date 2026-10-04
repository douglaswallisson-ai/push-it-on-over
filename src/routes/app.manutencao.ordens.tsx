import { createFileRoute } from "@tanstack/react-router";
import OrdensExemplo from "@/screens/OrdensServico";
import ManutencaoReal from "@/screens/manutencao/ManutencaoReal";
import { usandoMock } from "@/lib/modo";

// Com dado real, as ordens vivem na aba "Corretiva e ordens" do painel de manutenção.
function Screen() {
  return usandoMock() ? <OrdensExemplo /> : <ManutencaoReal abaInicial="corretiva" />;
}

export const Route = createFileRoute("/app/manutencao/ordens")({ component: Screen });
