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
export function modoAtual(): ModoDados {
  const padrao: ModoDados = import.meta.env.VITE_API_BASE ? "api" : "mock";
  return ler<ModoDados>(CHAVE, padrao);
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
