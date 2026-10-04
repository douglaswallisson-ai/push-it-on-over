import { createFileRoute } from "@tanstack/react-router";
import Exemplo from "@/screens/cadastros/Linhas";
import CadastroTela from "@/screens/cadastros/CadastroTela";
import { CFG_LINHA } from "@/screens/cadastros/config";
import { usandoMock } from "@/lib/modo";

// Com dado real, o cadastro usa o motor único (cadastros.py); em demonstração, a tela de exemplo.
function Screen() {
  return usandoMock() ? <Exemplo /> : <CadastroTela cfg={CFG_LINHA} />;
}

export const Route = createFileRoute("/app/cadastros/linhas")({ component: Screen });
