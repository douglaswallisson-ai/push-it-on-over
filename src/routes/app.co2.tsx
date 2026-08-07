import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/EmissaoCO2";

export const Route = createFileRoute("/app/co2")({
  component: Screen,
});
