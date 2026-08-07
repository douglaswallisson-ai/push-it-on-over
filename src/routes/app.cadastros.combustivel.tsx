import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/cadastros/Combustivel";

export const Route = createFileRoute("/app/cadastros/combustivel")({
  component: Screen,
});
