import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Eventos";

export const Route = createFileRoute("/app/eventos")({
  component: Screen,
});
