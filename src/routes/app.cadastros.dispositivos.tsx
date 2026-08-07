import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/cadastros/Dispositivos";

export const Route = createFileRoute("/app/cadastros/dispositivos")({
  component: Screen,
});
