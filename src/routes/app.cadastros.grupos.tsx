import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/cadastros/Grupos";

export const Route = createFileRoute("/app/cadastros/grupos")({
  component: Screen,
});
