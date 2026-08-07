import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/LayoutAssentos";

export const Route = createFileRoute("/app/fretamento/assentos")({
  component: Screen,
});
