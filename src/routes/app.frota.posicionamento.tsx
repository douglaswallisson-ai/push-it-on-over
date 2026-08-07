import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Posicionamento";

export const Route = createFileRoute("/app/frota/posicionamento")({
  component: Screen,
});
