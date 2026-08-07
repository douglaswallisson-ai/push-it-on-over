import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Escala";

export const Route = createFileRoute("/app/fretamento/escala")({
  component: Screen,
});
