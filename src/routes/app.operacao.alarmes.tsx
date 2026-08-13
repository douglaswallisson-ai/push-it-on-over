import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/AlarmesOperacao";

export const Route = createFileRoute("/app/operacao/alarmes")({
  component: Screen,
});
