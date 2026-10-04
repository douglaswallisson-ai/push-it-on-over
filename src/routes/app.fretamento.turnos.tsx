import { createFileRoute } from "@tanstack/react-router";
import CadastroTela from "@/screens/cadastros/CadastroTela";
import { CFG_TURNO } from "@/screens/cadastros/config";

// Cadastro real (motor cadastros.py), regras do sistema atual.
export const Route = createFileRoute("/app/fretamento/turnos")({ component: () => <CadastroTela cfg={CFG_TURNO} /> });
