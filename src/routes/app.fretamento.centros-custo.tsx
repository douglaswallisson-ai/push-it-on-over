import { createFileRoute } from "@tanstack/react-router";
import CadastroTela from "@/screens/cadastros/CadastroTela";
import { CFG_CENTRO_CUSTO } from "@/screens/cadastros/config";

// Cadastro real (motor cadastros.py), regras do sistema atual.
export const Route = createFileRoute("/app/fretamento/centros-custo")({ component: () => <CadastroTela cfg={CFG_CENTRO_CUSTO} /> });
