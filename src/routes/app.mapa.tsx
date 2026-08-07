import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/MapaAoVivo";

export const Route = createFileRoute("/app/mapa")({
  component: Screen,
});
