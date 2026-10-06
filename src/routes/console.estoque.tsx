import { createFileRoute } from "@tanstack/react-router";
import EstoqueEquipamentos from "@/screens/estoque/EstoqueEquipamentos";

// Estoque de equipamentos (só SS): estoque.py. Sem versão de demonstração.
export const Route = createFileRoute("/console/estoque")({ component: EstoqueEquipamentos });
