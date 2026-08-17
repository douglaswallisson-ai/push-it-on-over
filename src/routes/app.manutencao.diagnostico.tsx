import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/DiagnosticoDTC";
export const Route = createFileRoute("/app/manutencao/diagnostico")({ component: Screen });
