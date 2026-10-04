import { createFileRoute } from "@tanstack/react-router";
import CadastroTela from "@/screens/cadastros/CadastroTela";
import { CFG_GRUPO_LINHAS } from "@/screens/cadastros/config";

// Cadastro real (motor cadastros.py), regras do sistema atual.
export const Route = createFileRoute("/app/cadastros/grupos-linhas")({ component: () => <CadastroTela cfg={CFG_GRUPO_LINHAS} /> });
