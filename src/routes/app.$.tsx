import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/EmBreve";

export const Route = createFileRoute("/app/$")({
  component: Screen,
});
