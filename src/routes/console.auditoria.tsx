import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Auditoria";
export const Route = createFileRoute("/console/auditoria")({ component: Screen });
