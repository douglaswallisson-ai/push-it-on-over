import { lerSessao } from "@/lib/session";

/**
 * Empresa selecionada no seletor, para as consultas filtrarem por ela.
 *
 * O seletor gravava a escolha na sessão e invalidava o cache, mas nenhuma
 * consulta enviava o grupo — então a tela recarregava os mesmos dados e nada
 * mudava. Trocar de cliente alterava só o rótulo.
 *
 * O backend aceita `group_id` em veículos, motoristas e subgrupos, e
 * `group_ids` nos relatórios. Este módulo é o único lugar que decide qual
 * valor vai, para as telas não divergirem entre si.
 */

/**
 * Grupo ativo, ou `undefined` quando o usuário está vendo tudo a que tem
 * acesso.
 *
 * `undefined` é diferente de zero: sem filtro, o servidor devolve todo o
 * escopo do usuário, que é o comportamento correto para quem não escolheu
 * nenhuma empresa em particular.
 */
export function grupoAtivo(): string | undefined {
  const s = lerSessao();
  const id = s?.organizacaoAtivaId?.trim();
  return id ? id : undefined;
}

/** Parâmetro pronto para os endpoints de cadastro. */
export function filtroGrupo(): Record<string, string> {
  const id = grupoAtivo();
  return id ? { group_id: id } : {};
}

/**
 * Parâmetro dos relatórios, que aceitam vários grupos separados por vírgula.
 *
 * Hoje enviamos um só, mas o plural existe no contrato — e mandar `group_id`
 * ali seria ignorado silenciosamente, que é o tipo de erro que não aparece.
 */
export function filtroGrupoRelatorio(): Record<string, string> {
  const id = grupoAtivo();
  return id ? { group_ids: id } : {};
}

/**
 * Chave de cache que inclui o grupo.
 *
 * Sem ela, o React Query reaproveita a resposta de outra empresa: a consulta
 * muda, mas a chave não, e a tela mostra dados do cliente anterior.
 */
export const chaveComGrupo = (...partes: (string | number | undefined)[]) => [
  ...partes,
  grupoAtivo() ?? "todos",
];
