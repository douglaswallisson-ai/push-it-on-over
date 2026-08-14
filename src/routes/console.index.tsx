import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/console/PainelConsole";
export const Route = createFileRoute("/console/")({ component: Screen });
