import { createFileRoute } from "@tanstack/react-router";
import CadastroTela from "@/screens/cadastros/CadastroTela";
import { CFG_ROTA } from "@/screens/cadastros/config";

// Cadastro real (motor cadastros.py), regras do sistema atual.
export const Route = createFileRoute("/app/fretamento/rotas")({ component: () => <CadastroTela cfg={CFG_ROTA} /> });
