import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/CadastroViagem";

export const Route = createFileRoute("/app/fretamento/viagens/nova")({
  component: Screen,
});
