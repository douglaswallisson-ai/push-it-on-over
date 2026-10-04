import { createFileRoute } from "@tanstack/react-router";
import ControleCombustivel from "@/screens/combustivel/ControleCombustivel";

export const Route = createFileRoute("/app/frota/combustivel")({ component: () => <ControleCombustivel /> });
