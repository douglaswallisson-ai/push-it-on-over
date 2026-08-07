import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/AnaliseIndividual";

export const Route = createFileRoute("/app/frota/analise")({
  component: Screen,
});
