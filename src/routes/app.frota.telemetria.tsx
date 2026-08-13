import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Telemetria";

export const Route = createFileRoute("/app/frota/telemetria")({
  component: Screen,
});
