import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Ponto";

export const Route = createFileRoute("/app/fretamento/ponto")({
  component: Screen,
});
