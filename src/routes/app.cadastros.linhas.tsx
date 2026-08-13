import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/cadastros/Linhas";

export const Route = createFileRoute("/app/cadastros/linhas")({
  component: Screen,
});
