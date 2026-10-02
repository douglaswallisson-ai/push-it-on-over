import { createFileRoute } from "@tanstack/react-router";
import Embutido from "@/screens/Embutido";

export const Route = createFileRoute("/embed")({
  head: () => ({ meta: [{ title: "Abrindo…" }] }),
  component: Embutido,
});
