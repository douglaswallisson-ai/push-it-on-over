/**
 * Escopo por garagem.
 *
 * Uma organização pode ter várias garagens, e o gestor de pátio não precisa —
 * nem deve — enxergar as outras. A garagem é o menor nível de permissão do
 * sistema, abaixo da organização.
 *
 * Duas coisas diferentes convivem aqui e é importante não confundi-las:
 *
 * - **Escopo** (`garagens` na sessão): o que a pessoa *pode* ver. Vem do
 *   cadastro do usuário e ela não altera.
 * - **Foco** (`garagemFocoId`): dentro do que pode ver, o que ela *escolheu*
 *   ver agora. É conveniência de navegação e ela troca à vontade.
 *
 * Filtrar sempre pelo escopo; o foco é aplicado por cima.
 */

import type { Perfil } from "@/lib/permissoes";
import type { Sessao } from "@/lib/session";
import { usandoMock } from "@/lib/modo";

/** Perfis que enxergam todas as garagens da organização, sem lista explícita. */
const IRRESTRITOS: Perfil[] = ["super_admin", "admin_empresa"];

export const vePorTodasGaragens = (perfil?: Perfil) => Boolean(perfil && IRRESTRITOS.includes(perfil));

/**
 * IDs de garagem que a sessão pode acessar. `null` significa "todas" — usado
 * por super admin e administrador da organização.
 */
export function escopoGaragens(sessao: Sessao | null): string[] | null {
  if (!sessao) return [];
  if (vePorTodasGaragens(sessao.perfil)) return null;

  /**
   * Ligado à API, o escopo já vem aplicado pelo servidor.
   *
   * O backend filtra por `user_group_access` antes de responder — o que chega
   * ao front é, por definição, o que o usuário pode ver. Filtrar de novo aqui
   * é redundante, e destrutivo quando a sessão não tem garagens: escondia toda
   * a frota que a API tinha acabado de entregar.
   *
   * A lista local continua valendo em modo de exemplo, onde não há servidor
   * para aplicar escopo nenhum.
   */
  if (!usandoMock()) return null;

  return sessao.garagens ?? [];
}

/** A sessão pode ver esta garagem? */
export function podeVerGaragem(sessao: Sessao | null, garagemId?: string): boolean {
  const escopo = escopoGaragens(sessao);
  if (escopo === null) return true;
  if (!garagemId) return false;
  return escopo.includes(garagemId);
}

/**
 * Filtra uma coleção pelo escopo e pelo foco da sessão.
 *
 * Registro sem garagem definida some para quem tem escopo restrito: é mais
 * seguro esconder do que vazar por omissão de cadastro.
 */
export function filtrarPorGaragem<T>(
  itens: T[],
  sessao: Sessao | null,
  garagemDe: (item: T) => string | undefined,
): T[] {
  const escopo = escopoGaragens(sessao);
  const foco = sessao?.garagemFocoId ?? null;

  return itens.filter((item) => {
    const g = garagemDe(item);
    if (escopo !== null && (!g || !escopo.includes(g))) return false;
    if (foco && g !== foco) return false;
    return true;
  });
}

/** Texto curto do escopo, para exibir no cabeçalho das telas. */
export function rotuloEscopo(sessao: Sessao | null, nomePorId: Map<string, string>): string {
  if (!sessao) return "—";
  if (sessao.garagemFocoId) return nomePorId.get(sessao.garagemFocoId) ?? "Garagem";
  const escopo = escopoGaragens(sessao);
  if (escopo === null) return "Todas as garagens";
  if (escopo.length === 0) return "Nenhuma garagem atribuída";
  if (escopo.length === 1) return nomePorId.get(escopo[0]) ?? "1 garagem";
  return `${escopo.length} garagens`;
}
