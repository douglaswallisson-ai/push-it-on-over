import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Veiculos";

export const Route = createFileRoute("/app/veiculos/")({
  component: Screen,
});
