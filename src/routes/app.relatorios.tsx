import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Relatorios";

export const Route = createFileRoute("/app/relatorios")({
  component: Screen,
});
