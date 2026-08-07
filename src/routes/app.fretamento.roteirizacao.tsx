import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Roteirizacao";

export const Route = createFileRoute("/app/fretamento/roteirizacao")({
  component: Screen,
});
