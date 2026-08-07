import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/IAFleetManager";

export const Route = createFileRoute("/app/estrategico")({
  component: Screen,
});
