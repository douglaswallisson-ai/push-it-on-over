import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/MetasPesos";

export const Route = createFileRoute("/app/premiacao/metas")({
  component: Screen,
});
