import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/cadastros/Unidades";

export const Route = createFileRoute("/app/cadastros/unidades")({
  component: Screen,
});
