import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Pneus";
export const Route = createFileRoute("/app/manutencao/pneus")({ component: Screen });
