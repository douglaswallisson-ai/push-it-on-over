import { api } from "@/lib/api";

/**
 * Controle de Combustível (ss-fleet-core, endpoints/combustivel.py): o mesmo
 * módulo do time de TI ("Controle de Combustível V2"), lendo os abastecimentos
 * reais (CTA Smart, RDP Online, planilha, manual). O que se lança ou corrige
 * aqui fica no armazenamento provisório da plataforma.
 */

export type Gravidade = "error" | "warn" | "info";
export type Alerta = { code: string; severity: Gravidade; label: string; reviewed: boolean };
export type ContaAlertas = { error: number; warn: number; info: number };
export type StatusConsumo = "ok" | "slightly_below" | "slightly_above" | "below" | "above" | "no_data";

export type Catalogo = {
  fuelTypes: { id: number; code: string; name: string; family: "diesel" | "otto" | "arla" }[];
  suppliers: { id: number; code: string; name: string; integrationType: string }[];
  alertTypes: { code: string; severity: Gravidade; label: string; description: string }[];
  pendingErrorCodes: { code: string; label: string }[];
  thresholds: Record<string, number>;
  stations: { id: number; name: string; fuelTypeId: number | null; pricePerLiter: number | null }[];
  groupName: string | null;
};

export type VeiculoRef = { id: number; plate: string; fleetNumber: string | null; groupName: string | null; subgroupId: number | null; subgroupName: string | null };

export type ResumoVeiculo = {
  unitId: number;
  vehicle: VeiculoRef;
  plate: string;
  fleetNumber: string | null;
  subgroupName: string | null;
  fuelTypeId: number | null;
  tankCapacityL: number | null;
  expectedKmL: { min: number; max: number } | null;
  consumptionStatus: StatusConsumo;
  supplies: number;
  liters: number;
  litersArla: number;
  spent: number;
  kmDriven: number | null;
  kmPerLiter: number | null;
  costPerKm: number | null;
  openAlerts: ContaAlertas;
  lastSupply: { at: string; km: number | null } | null;
};

export type Painel = {
  totals: {
    spent: number; liters: number; litersArla: number; supplies: number; kmDriven: number; vehicles: number;
    kmPerLiter: number | null; costPerKm: number | null; openAlerts: ContaAlertas; vehiclesOutOfRange: number;
  };
  facets: { all: number; withAlerts: number; outOfRange: number };
  total: number;
  data: ResumoVeiculo[];
};

export type Telemetria = {
  classification: "OK" | "DIVERGENTE" | "SEM_TELEMETRIA" | "SEM_KM_INFORMADO" | "PENDENTE" | null;
  odometer: number | null; readAt: string | null; kmTelemetry: number | null; divergenceKm: number | null; divergencePct: number | null;
};

export type Abastecimento = {
  id: number;
  unitId: number;
  vehicle: VeiculoRef;
  eventDatetime: string | null;
  fuelTypeId: number | null;
  fuelTypeName: string | null;
  fuelFamily: "diesel" | "otto" | "arla";
  supplier: { code: string; name: string };
  externalRef: string | null;
  station: { id: number; name: string | null; cnpj: string | null } | null;
  localInformado: string | null;
  driver: { id: number; name: string | null } | null;
  kmInformed: number | null;
  liters: number | null;
  pricePerLiter: number | null;
  totalValue: number | null;
  totalValueInformed: number | null;
  fullTank: boolean;
  invoiceNumber: string | null;
  notes: string | null;
  computed: { kmInitial: number | null; kmDriven: number | null; kmPerLiter: number | null; costPerKm: number | null; cycleKm: number | null; cycleLiters: number | null };
  telemetry: Telemetria;
  alerts: Alerta[];
  review: { reason: string; user: string | null; date: string } | null;
  editableFields: string[];
  provisorio: boolean;
};

export type DetalheVeiculo = {
  vehicle: VeiculoRef & {
    fuelTypeId: number | null;
    profile: { tankCapacityL: number; expectedMin: number; expectedMax: number; defaultFuelTypeId: number | null; meter: string; provisorio?: boolean } | null;
  };
  totals: {
    supplies: number; liters: number; litersArla: number; spent: number; kmDriven: number | null; kmPerLiter: number | null;
    costPerKm: number | null; openAlerts: ContaAlertas; consumptionStatus: StatusConsumo;
  };
  supplies: Abastecimento[];
  truncated: boolean;
};

export type Pendencia = {
  id: number;
  supplier: { code: string; name: string };
  externalRef: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  summary: { plate: string | null; eventDatetime: string | null; product: string | null; liters: number | null; pricePerLiter: number | null; km: number | null; station: string | null; driver: string | null; value: number | null };
  dateAdd: string | null;
  resolution: { note: string | null; at: string | null; supplyId?: number | null } | null;
  provisorio: boolean;
};

export type DetalhePendencia = Pendencia & {
  rawPayload: Record<string, unknown>;
  suggestions: { unitId: number; plate: string; subgroupName: string | null; distance: number; reason: string }[];
  suggestedFuelTypeId: number | null;
  needs: { fuelType: boolean; liters: boolean };
};

export type Posto = {
  id: number; name: string; company: string | null; branch: string | null; cnpj: string | null; pumpCode: string | null;
  fuelTypeId: number | null; pricePerLiter: number | null; latitude: number | null; longitude: number | null; radiusM: number | null;
  provisorio: boolean; supplies: number; liters: number; spent: number; avgPrice: number | null; vehicles: number; lastSupply: string | null;
};
export type LocalSolto = { local: string; supplies: number; liters: number; spent: number; avgPrice: number | null; vehicles: number; lastSupply: string | null };

export type Issue = { field?: string | null; code: string; severity: Gravidade; message: string };

export type NovoAbastecimento = {
  group_id: number; unit_id: number; event_datetime: string; fuel_type_id: number; liters: number; price_per_liter: number;
  km_informado_atual: number | null; full_tank: boolean; fuel_station_id: number | null; local_informado: string | null;
  driver_id?: number | null; total_value_informed: number | null; invoice_number: string | null; notes: string | null;
};

export type LinhaPlanilha = {
  placa: string; data: string; combustivel: string; litros: number; preco_litro: number; km?: number | null; posto?: string | null;
  tanque_cheio?: boolean; nota_fiscal?: string | null; valor_nota?: number | null; motorista?: string | null;
};

const q = (o: Record<string, string | number | boolean | null | undefined>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

const B = "/api/v1/combustivel";

export const CombustivelApi = {
  catalogo: (g: string) => api.get<Catalogo>(`${B}/catalogo?group_id=${g}`),
  painel: (g: string, p: { inicio: string; fim: string; busca?: string; filtro?: string; ordem?: string; direcao?: string; pagina?: number; limite?: number }) =>
    api.get<Painel>(`${B}/painel?${q({ group_id: g, ...p })}`),
  semAbastecimento: (g: string, busca?: string) =>
    api.get<{ data: (VeiculoRef & { unitId: number; dateAdd: string })[]; total: number }>(`${B}/sem-abastecimento?${q({ group_id: g, busca })}`),
  veiculo: (g: string, unitId: number, inicio: string, fim: string) =>
    api.get<DetalheVeiculo>(`${B}/veiculo/${unitId}?${q({ group_id: g, inicio, fim })}`),
  alertas: (g: string, p: { inicio: string; fim: string; busca?: string; tipos?: string; gravidade?: string; revisado?: string; pagina?: number; limite?: number }) =>
    api.get<{ facets: { byType: Record<string, number> }; total: number; data: Abastecimento[] }>(`${B}/alertas?${q({ group_id: g, ...p })}`),
  pendencias: (g: string, p: { situacao?: string; codigo?: string; busca?: string }) =>
    api.get<{ facets: { byStatus: Record<string, number>; byErrorCode: Record<string, number> }; data: Pendencia[]; total: number }>(
      `${B}/pendencias?${q({ group_id: g, ...p })}`,
    ),
  pendencia: (g: string, id: number) => api.get<DetalhePendencia>(`${B}/pendencias/${id}?group_id=${g}`),
  resolver: (g: string, id: number, body: { unit_id: number; fuel_type_id: number; liters?: number | null; note?: string }) =>
    api.post<{ supplyId: number }>(`${B}/pendencias/${id}/resolver`, { group_id: Number(g), ...body }),
  descartar: (g: string, id: number, motivo: string) => api.post(`${B}/pendencias/${id}/descartar`, { group_id: Number(g), motivo }),
  postos: (g: string, inicio: string, fim: string) =>
    api.get<{ stations: Posto[]; unregistered: LocalSolto[] }>(`${B}/postos?${q({ group_id: g, inicio, fim })}`),
  salvarPosto: (g: string, body: Record<string, unknown>, id?: number) =>
    api.post<{ id: number }>(`${B}/postos${id ? `?posto_id=${id}` : ""}`, { group_id: Number(g), ...body }),
  removerPosto: (g: string, id: number) => api.del(`${B}/postos/${id}?group_id=${g}`),
  validar: (body: NovoAbastecimento, excluirId?: number) =>
    api.post<{ computed: Record<string, number | null>; issues: Issue[] }>(`${B}/abastecimentos/validar${excluirId ? `?excluir_id=${excluirId}` : ""}`, body),
  criar: (body: NovoAbastecimento) => api.post<{ id: number; issues: Issue[] }>(`${B}/abastecimentos`, body),
  corrigir: (g: string, id: number, campos: Record<string, unknown>, motivo?: string) =>
    api.put<{ ok: boolean; issues: Issue[] }>(`${B}/abastecimentos/${id}`, { group_id: Number(g), campos, motivo }),
  excluir: (g: string, id: number, motivo: string) => api.post(`${B}/abastecimentos/${id}/excluir`, { group_id: Number(g), motivo }),
  verificar: (g: string, id: number, motivo: string, autorNome?: string) =>
    api.post(`${B}/abastecimentos/${id}/verificar`, { group_id: Number(g), motivo, autor_nome: autorNome }),
  desfazerVerificacao: (g: string, id: number) => api.del(`${B}/abastecimentos/${id}/verificar?group_id=${g}`),
  kmSugerido: (g: string, unitId: number, quando: string) =>
    api.get<{ lastSupply: { at: string; km: number } | null; trackerKm: number | null; trackerReadAt: string | null }>(
      `${B}/veiculo/${unitId}/km-sugerido?${q({ group_id: g, quando })}`,
    ),
  salvarPerfil: (g: string, unitId: number, body: { default_fuel_type_id: number | null; tank_capacity_l: number; expected_kml_min: number; expected_kml_max: number }) =>
    api.put(`${B}/veiculo/${unitId}/perfil`, { group_id: Number(g), meter: "km", ...body }),
  planilha: (g: string, linhas: LinhaPlanilha[], confirmar: boolean) =>
    api.post<{ linhas: { linha: number; placa: string; ok: boolean; issues: Issue[] }[]; validas: number; comErro: number; gravadas: number }>(
      `${B}/planilha`,
      { group_id: Number(g), linhas, confirmar },
    ),
};

/* ------------------------------------------------------------- formatação */

const NF0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const NF1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const NF2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const fBRL = (v: number | null | undefined) => (v == null ? "—" : BRL.format(v));
export const fL = (v: number | null | undefined) => (v == null ? "—" : `${NF0.format(v)} L`);
export const fKm = (v: number | null | undefined) => (v == null ? "—" : `${NF0.format(v)} km`);
export const fKmL = (v: number | null | undefined) => (v == null ? "—" : NF2.format(v));
export const fN0 = (v: number | null | undefined) => (v == null ? "—" : NF0.format(v));
export const fN1 = (v: number | null | undefined) => (v == null ? "—" : NF1.format(v));
export const fN2 = (v: number | null | undefined) => (v == null ? "—" : NF2.format(v));
export const plural = (n: number, s: string, p: string) => `${NF0.format(n)} ${n === 1 ? s : p}`;
export function fDT(s: string | null | undefined, comAno = false) {
  if (!s) return "—";
  const d = new Date(s.length <= 10 ? `${s}T12:00` : s.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", ...(comAno ? { year: "numeric" } : {}), hour: "2-digit", minute: "2-digit" });
}
/** Número digitado em português ("1.234,5" ou "1234.5"). */
export function lerNumero(t: string): number | null {
  const s = t.trim();
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
}
