import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/ContagemPassageiros";

export const Route = createFileRoute("/app/fretamento/passageiros")({
  component: Screen,
});
