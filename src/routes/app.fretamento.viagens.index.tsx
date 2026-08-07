import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Viagens";

export const Route = createFileRoute("/app/fretamento/viagens/")({
  component: Screen,
});
