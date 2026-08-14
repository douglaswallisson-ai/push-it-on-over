import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/IndicadoresGerenciais";
export const Route = createFileRoute("/console/indicadores")({ component: Screen });
