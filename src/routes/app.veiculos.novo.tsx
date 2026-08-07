import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/VeiculoNovo";

export const Route = createFileRoute("/app/veiculos/novo")({
  component: Screen,
});
