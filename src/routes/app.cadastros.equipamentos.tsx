import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/Equipamentos";
export const Route = createFileRoute("/app/cadastros/equipamentos")({ component: Screen });
