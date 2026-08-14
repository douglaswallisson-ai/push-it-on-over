import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/CatalogoManutencao";
export const Route = createFileRoute("/app/admin/catalogo")({ component: Screen });
