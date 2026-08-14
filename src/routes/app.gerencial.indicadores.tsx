import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/IndicadoresGerenciais";

export const Route = createFileRoute("/app/gerencial/indicadores")({
  component: Screen,
});
