import { gravar, ler } from "@/lib/session";
import { USE_MOCK } from "@/lib/api";

/**
 * Alternância entre dados de exemplo e API real, em tempo de execução.
 *
 * Antes isso exigia editar `USE_MOCK` no código e rebuildar, o que impedia
 * validar a integração sem republicar. Aqui a escolha vive na sessão e o
 * cliente HTTP consulta a cada chamada.
 *
 * O valor compilado (`USE_MOCK`) continua sendo o padrão: em produção, com a
 * API desligada, o sistema abre em dados de exemplo e ninguém precisa saber que
 * o interruptor existe.
 */

export type ModoDados = "mock" | "api";

const CHAVE = "modo-dados";

/**
 * Modo em uso.
 *
 * O padrão é a API real: o sistema existe para operar dados de verdade, e
 * abrir em exemplo faz o usuário achar que está vendo a frota dele quando não
 * está. Sem endereço configurado, cai para exemplo — aí não há para onde
 * consultar, e uma tela de erro seria pior que uma demonstração.
 */
/**
 * Modo em uso.
 *
 * Com endereço de API configurado, o sistema opera **sempre** em modo real —
 * não há alternância. A base de exemplo existia para desenvolver sem servidor,
 * e conviver com o dado real provou ser pior que não ter nenhum: número
 * inventado se mistura ao verdadeiro, e nada na tela distingue os dois.
 *
 * Sem `VITE_API_BASE` não há para onde consultar, e o exemplo volta a ser a
 * única fonte possível.
 */
export function modoAtual(): ModoDados {
  return import.meta.env.VITE_API_BASE ? "api" : "mock";
}

export const usandoMock = () => modoAtual() === "mock";

export function definirModo(m: ModoDados) {
  gravar(CHAVE, m);
}

/** Base da API configurada no build. Exibida junto do interruptor. */
export const baseApi = () => (import.meta.env.VITE_API_BASE as string) || "mesma origem";

/**
 * Intervalo de atualização automática, em segundos, quando ligado à API real.
 * Com dados de exemplo não há o que recarregar, e o polling só gastaria ciclo.
 */
export function intervaloAtualizacao(): number {
  return ler<number>("intervalo-atualizacao", 30);
}

export function definirIntervalo(s: number) {
  gravar("intervalo-atualizacao", s);
}

/** Devolve o intervalo em milissegundos, ou false quando não deve recarregar. */
export function refetchInterval(): number | false {
  if (usandoMock()) return false;
  const s = intervaloAtualizacao();
  return s > 0 ? s * 1000 : false;
}

/**
 * Base de exemplo a usar, conforme o modo.
 *
 * Devolve os dados de exemplo em modo de demonstração e uma lista vazia em
 * modo API — nunca os dois misturados.
 *
 * Existe porque o padrão contrário já apareceu em cinco telas: cair no exemplo
 * quando a API não devolve nada. Ligado ao banco real, isso mostra veículos,
 * motoristas e clientes que não existem, sem nada na tela avisando. O usuário
 * confere um número, vê que não bate com a operação, e perde a confiança no
 * sistema inteiro.
 *
 * Lista vazia é honesta. Lista inventada não é.
 */
export function exemploOuVazio<T>(dados: T[]): T[] {
  return usandoMock() ? dados : [];
}

/**
 * Número de exemplo escrito na tela, só com dados de exemplo ligados.
 *
 * Ligado à API vira "—": o valor era literal no código ("66.030 h", "R$ 3.180")
 * e aparecia ao lado do dado real como se fosse medido.
 */
export function ex(valor: string): string {
  return usandoMock() ? valor : "—";
}

/**
 * Módulo sem endpoint no backend.
 *
 * Alguns módulos — manutenção, contratos, multas — não têm origem nenhuma. Para
 * eles o exemplo é a única fonte possível, em qualquer modo, e o selo na tela
 * declara isso. Marcar explicitamente evita que a regra acima os esvazie.
 */
export function exemploSempre<T>(dados: T[]): T[] {
  return dados;
}
