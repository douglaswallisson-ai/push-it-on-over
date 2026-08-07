import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Motoristas";

export const Route = createFileRoute("/app/motoristas/")({
  component: Screen,
});
