import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/cadastros/Usuarios";

export const Route = createFileRoute("/app/cadastros/usuarios")({
  component: Screen,
});
