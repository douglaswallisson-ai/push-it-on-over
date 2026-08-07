import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Premiacao";

export const Route = createFileRoute("/app/premiacao")({
  component: Screen,
});
