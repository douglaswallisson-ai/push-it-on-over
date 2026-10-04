import { createFileRoute } from "@tanstack/react-router";
import Exemplo from "@/screens/LayoutAssentos";
import CadastroTela from "@/screens/cadastros/CadastroTela";
import { CFG_LAYOUT_ASSENTOS } from "@/screens/cadastros/config";
import { usandoMock } from "@/lib/modo";

function Screen() {
  return usandoMock() ? <Exemplo /> : <CadastroTela cfg={CFG_LAYOUT_ASSENTOS} />;
}

export const Route = createFileRoute("/app/fretamento/assentos")({ component: Screen });
