import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/MotorLigadoParado";

export const Route = createFileRoute("/app/frota/motor-parado")({
  component: Screen,
});
