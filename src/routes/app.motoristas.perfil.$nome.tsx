import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/AcompanhamentoMotorista";

export const Route = createFileRoute("/app/motoristas/perfil/$nome")({
  component: Screen,
});
