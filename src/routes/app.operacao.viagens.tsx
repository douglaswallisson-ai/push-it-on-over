import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/GestaoViagens";

export const Route = createFileRoute("/app/operacao/viagens")({
  component: Screen,
});
