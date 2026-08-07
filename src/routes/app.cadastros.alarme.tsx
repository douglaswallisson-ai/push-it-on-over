import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/CadastroAlarme";

export const Route = createFileRoute("/app/cadastros/alarme")({
  component: Screen,
});
