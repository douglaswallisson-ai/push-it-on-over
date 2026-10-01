import DashboardOperacional from "./DashboardOperacional";
import RelatoriosGerenciais from "./RelatoriosGerenciais";
import { usandoMock } from "@/lib/modo";

/**
 * Gerencial: as páginas do Power BI e do Dashboard Start, com o painel da
 * operação como uma delas. Com dados de exemplo não há série do BI, então
 * fica o painel do protótipo.
 */
export default function Gerencial() {
  return usandoMock() ? <DashboardOperacional /> : <RelatoriosGerenciais />;
}
