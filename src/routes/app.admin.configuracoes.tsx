import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/ConfiguracoesAdmin";
export const Route = createFileRoute("/app/admin/configuracoes")({ component: Screen });
