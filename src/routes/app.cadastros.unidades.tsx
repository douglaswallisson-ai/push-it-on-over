import { createFileRoute } from "@tanstack/react-router";
import Exemplo from "@/screens/cadastros/Unidades";
import CadastroTela from "@/screens/cadastros/CadastroTela";
import { CFG_SUBGRUPO } from "@/screens/cadastros/config";
import { usandoMock } from "@/lib/modo";

// Com dado real, o cadastro usa o motor único (cadastros.py); em demonstração, a tela de exemplo.
function Screen() {
  return usandoMock() ? <Exemplo /> : <CadastroTela cfg={CFG_SUBGRUPO} />;
}

export const Route = createFileRoute("/app/cadastros/unidades")({ component: Screen });
