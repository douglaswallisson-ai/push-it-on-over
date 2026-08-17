import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/TelemetriaViagens";
export const Route = createFileRoute("/app/relatorios/telemetria")({ component: Screen });
