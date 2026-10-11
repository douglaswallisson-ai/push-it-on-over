import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/ComparativoIguais";

export const Route = createFileRoute("/app/frota/comparativo")({
  component: Screen,
});
