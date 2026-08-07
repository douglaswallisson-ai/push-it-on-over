import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Login";

export const Route = createFileRoute("/login")({
  component: Screen,
});
