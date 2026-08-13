import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Auditoria";

export const Route = createFileRoute("/app/auditoria")({
  component: Screen,
});
