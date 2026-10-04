import { createFileRoute } from "@tanstack/react-router";
import Exemplo from "@/screens/cadastros/Cerca";
import CadastroTela from "@/screens/cadastros/CadastroTela";
import { CFG_CERCA } from "@/screens/cadastros/config";
import { usandoMock } from "@/lib/modo";

// Com dado real, o cadastro usa o motor único (cadastros.py); em demonstração, a tela de exemplo.
function Screen() {
  return usandoMock() ? <Exemplo /> : <CadastroTela cfg={CFG_CERCA} />;
}

export const Route = createFileRoute("/app/cadastros/cerca")({ component: Screen });
