import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/cadastros/Cerca";

export const Route = createFileRoute("/app/cadastros/cerca")({
  component: Screen,
});
