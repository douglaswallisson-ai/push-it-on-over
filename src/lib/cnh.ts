/**
 * Situação da CNH do motorista.
 *
 * A validade não é obrigatória no cadastro — motorista pode entrar no sistema
 * antes de o documento ser digitalizado. Quando existe, o sistema compara com a
 * data de hoje e classifica em quatro estados, para alimentar tanto a lista
 * quanto os alertas na tela de gestão do motorista.
 */

export type StatusCNH = "vencida" | "vence_30" | "vence_60" | "ok" | "sem_informacao";

/** Janelas de aviso, em dias. Mudar aqui muda em todo o sistema. */
export const JANELA_CNH = { critico: 30, atencao: 60 };

export function diasParaVencer(validade?: string | null): number | null {
  if (!validade) return null;
  const t = new Date(validade).getTime();
  if (Number.isNaN(t)) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((t - hoje.getTime()) / 86_400_000);
}

export function statusCNH(validade?: string | null): StatusCNH {
  const d = diasParaVencer(validade);
  if (d === null) return "sem_informacao";
  if (d < 0) return "vencida";
  if (d <= JANELA_CNH.critico) return "vence_30";
  if (d <= JANELA_CNH.atencao) return "vence_60";
  return "ok";
}

export const CNH_LABEL: Record<StatusCNH, string> = {
  vencida: "CNH vencida",
  vence_30: "Vence em 30 dias",
  vence_60: "Vence em 60 dias",
  ok: "Em dia",
  sem_informacao: "Sem informação",
};

export const CNH_TONE: Record<StatusCNH, "green" | "gold" | "coral" | "neutral"> = {
  vencida: "coral",
  vence_30: "coral",
  vence_60: "gold",
  ok: "green",
  sem_informacao: "neutral",
};

/** true quando o caso merece aparecer na lista de pendências. */
export const exigeAtencao = (s: StatusCNH) => s === "vencida" || s === "vence_30" || s === "vence_60";

export const dataBR = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/** Texto curto de prazo: "vencida há 4 d" / "em 27 d". */
export function prazoCNH(validade?: string | null): string {
  const d = diasParaVencer(validade);
  if (d === null) return "—";
  if (d < 0) return `vencida há ${Math.abs(d)} d`;
  if (d === 0) return "vence hoje";
  return `em ${d} d`;
}
