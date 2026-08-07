import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/DesempenhoFrota";

export const Route = createFileRoute("/app/frota/desempenho")({
  component: Screen,
});
