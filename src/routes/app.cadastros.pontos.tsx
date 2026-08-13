import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/cadastros/Pontos";

export const Route = createFileRoute("/app/cadastros/pontos")({
  component: Screen,
});
