import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/cadastros/Garagens";

export const Route = createFileRoute("/app/cadastros/garagens")({
  component: Screen,
});
