import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Inicio";

export const Route = createFileRoute("/app/")({
  component: Screen,
});
