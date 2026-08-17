import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Regeneracao";

export const Route = createFileRoute("/app/manutencao/regeneracao")({
  component: Screen,
});
