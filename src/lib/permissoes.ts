/**
 * Perfis e permissões.
 *
 * O super admin (SS Telemática) tem acesso irrestrito: enxerga todas as
 * organizações e executa qualquer ação em qualquer uma delas. Não existe
 * verificação que o barre — `pode()` devolve `true` para ele em qualquer caso.
 *
 * Isso é decisão de produto, e vem com duas consequências que o sistema trata
 * em vez de ignorar:
 *
 * 1. Toda ação dele fica registrada na auditoria, com a organização em que
 *    estava no momento. Poder irrestrito sem rastro é o que costuma virar
 *    problema em disputa com cliente.
 * 2. Quando ele está navegando na base de um cliente, a interface diz isso o
 *    tempo todo. O risco real não é ele fazer algo proibido, é fazer a coisa
 *    certa na organização errada.
 */

export type Perfil = "super_admin" | "admin_empresa" | "gestor" | "operador" | "consulta";

export const PERFIL_LABEL: Record<Perfil, string> = {
  super_admin: "Super admin (SS)",
  admin_empresa: "Administrador",
  gestor: "Gestor",
  operador: "Operador",
  consulta: "Consulta",
};

export const PERFIL_DESCRICAO: Record<Perfil, string> = {
  super_admin: "Acesso total a todas as organizações. Pode tudo, em qualquer base.",
  admin_empresa: "Administra a própria organização: usuários, cadastros e configurações.",
  gestor: "Opera e trata a frota das garagens a que tem acesso.",
  operador: "Registra e acompanha o dia a dia, sem alterar configuração.",
  consulta: "Somente leitura.",
};

/** Ações verificáveis no sistema. */
export type Acao =
  | "ver_todas_organizacoes"
  | "trocar_organizacao"
  | "criar_organizacao"
  | "gerenciar_usuarios"
  | "redefinir_senha_de_terceiro"
  | "editar_cadastros"
  | "excluir_registros"
  | "configurar_alarmes"
  | "configurar_metas"
  | "tratar_eventos"
  | "agendar_manutencao"
  | "exportar_dados"
  | "ver_auditoria"
  | "ver_dados_operacionais";

/**
 * Matriz de permissões. O super admin não aparece aqui de propósito: ele é
 * resolvido antes da consulta, em `pode()`.
 */
const MATRIZ: Record<Exclude<Perfil, "super_admin">, Acao[]> = {
  admin_empresa: [
    "gerenciar_usuarios",
    "redefinir_senha_de_terceiro",
    "editar_cadastros",
    "excluir_registros",
    "configurar_alarmes",
    "configurar_metas",
    "tratar_eventos",
    "agendar_manutencao",
    "exportar_dados",
    "ver_auditoria",
    "ver_dados_operacionais",
  ],
  gestor: [
    "editar_cadastros",
    "configurar_alarmes",
    "tratar_eventos",
    "agendar_manutencao",
    "exportar_dados",
    "ver_dados_operacionais",
  ],
  operador: ["tratar_eventos", "agendar_manutencao", "ver_dados_operacionais"],
  consulta: ["ver_dados_operacionais"],
};

/** O super admin pode tudo — a checagem sai antes de olhar a matriz. */
export function pode(perfil: Perfil | undefined, acao: Acao): boolean {
  if (perfil === "super_admin") return true;
  if (!perfil) return false;
  return MATRIZ[perfil]?.includes(acao) ?? false;
}

export const ehSuperAdmin = (perfil?: Perfil) => perfil === "super_admin";
