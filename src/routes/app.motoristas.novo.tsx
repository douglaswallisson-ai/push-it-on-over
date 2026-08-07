import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/MotoristaNovo";

export const Route = createFileRoute("/app/motoristas/novo")({
  component: Screen,
});
