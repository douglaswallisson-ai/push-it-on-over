import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Manutencao";

export const Route = createFileRoute("/app/frota/manutencao")({
  component: Screen,
});
