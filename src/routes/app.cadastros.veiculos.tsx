import { createFileRoute } from "@tanstack/react-router";
import CadastroTela from "@/screens/cadastros/CadastroTela";
import { CFG_VEICULO } from "@/screens/cadastros/config";

export const Route = createFileRoute("/app/cadastros/veiculos")({ component: () => <CadastroTela cfg={CFG_VEICULO} /> });
