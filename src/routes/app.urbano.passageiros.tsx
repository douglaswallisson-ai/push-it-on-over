import { createFileRoute } from "@tanstack/react-router";
import Screen from "@/screens/ContagemPassageiros";

/**
 * Mesma tela do fretamento, acessada pelo transporte urbano.
 *
 * Duas rotas para o mesmo componente porque o caminho é o que define o filtro
 * inicial de modalidade — quem entra pelo urbano espera ver linha, não
 * fretamento.
 */
export const Route = createFileRoute("/app/urbano/passageiros")({ component: Screen });
