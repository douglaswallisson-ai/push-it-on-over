import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/DashboardOperacional";
export const Route = createFileRoute("/app/gerencial")({ component: Screen });
