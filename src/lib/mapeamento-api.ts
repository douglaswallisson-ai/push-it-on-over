import type { Linha, Motorista, Veiculo } from "@/types";

/**
 * Tradução entre os nomes do front e os do banco.
 *
 * O schema `mova` nomeia as coisas de outro jeito, herdado do sistema legado:
 * veículo é `tracked_unit`, placa é `label`, prefixo é `label2`. Traduzir aqui,
 * num lugar só, evita espalhar `label`/`label2` por trinta telas — e evita o
 * contrário, que seria renomear no backend e quebrar o sistema em produção.
 *
 * A regra que sigo: o front fala a língua da operação (placa, prefixo,
 * matrícula), o banco mantém a dele, e a conversão é explícita.
 */

/* ------------------------------------------------------------------ */
/* Veículo                                                             */
/* ------------------------------------------------------------------ */

/** Como o veículo chega da API. */
export type VeiculoApi = {
  id: number;
  label: string;
  label2?: string | null;
  model?: string | null;
  group_id?: number | null;
  subgroup_id?: number | null;
  status?: number | null;
  max_speed?: number | null;
  initial_odometer?: number | null;
  initial_horimeter?: number | null;
  timezone?: number | null;
  dst?: boolean | null;
  obs?: string | null;
  driver_id?: number | null;
  unit_category_id?: number | null;
  unit_type_id?: number | null;
  vehicle_model_id?: number | null;
  cost_km?: number | null;
};

/** Forma usada nas telas. */
export type VeiculoFront = {
  id: string;
  placa: string;
  prefixo?: string;
  modelo?: string;
  grupoId?: string;
  unidadeId?: string;
  ativo: boolean;
  velocidadeMaxima?: number;
  odometroInicial?: number;
  horimetroInicial?: number;
  observacao?: string;
  motoristaId?: string;
  custoKm?: number;
};

/**
 * Converte para o tipo `Veiculo` que as telas já usam.
 *
 * Devolver o mesmo formato do mock é o que permite trocar a fonte de dados sem
 * mexer em coluna, filtro ou cálculo — a tela não precisa saber de onde veio.
 * Campos que o backend não tem ficam com um padrão razoável, nunca inventado:
 * `kml` e `odometro` vêm zerados até o relatório de telemetria preencher.
 */
export function veiculoDaApiParaTela(v: VeiculoApi): Veiculo {
  const [marca, ...resto] = (v.model ?? "").split(" ");
  return {
    id: String(v.id),
    placa: v.label,
    prefixo: v.label2 ?? undefined,
    marca: marca || "—",
    modelo: resto.join(" ") || v.model || "—",
    ano: 0,
    operacao: "—",
    situacao: v.status === 1 ? "parado" : "sem_sinal",
    // Zero seria mentira: o veículo não roda a 0 km/l, o dado é que não veio.
    // O cadastro entrega só a ficha; consumo e odômetro atual vêm de
    // con_telemetry, que é outra consulta. Nulo faz a tela mostrar traço.
    kml: null,
    /**
     * `initial_odometer` está em **metros**, como o resto da telemetria.
     *
     * Sem converter, a tela mostrava 710.176.000 km para um ônibus — o valor
     * é 710.176 km. Um número absurdo desses passa despercebido porque a
     * coluna já é grande; ninguém confere ordem de grandeza de odômetro.
     *
     * É o odômetro de quando o equipamento foi instalado, não o atual. Quando
     * a telemetria traz leitura mais recente, ela tem precedência.
     */
    odometro: v.initial_odometer ? Math.round(v.initial_odometer / 1000) : null,
    grupoId: v.group_id != null ? String(v.group_id) : undefined,
    unidadeId: v.subgroup_id != null ? String(v.subgroup_id) : undefined,
  };
}

/** Motorista no formato das telas. */
export function motoristaDaApiParaTela(m: MotoristaApi): Motorista {
  return {
    id: String(m.id),
    nome: m.name ?? "—",
    filial: m.subgroup_id != null ? String(m.subgroup_id) : "—",
    matricula: m.matricula ?? undefined,
    cnhCategoria: m.cnh_category ?? undefined,
    cnhValidade: m.cnh_validate ?? undefined,
    kmRodado: 0,
    notaGeral: 0,
    viagens: 0,
    premiacao: 0,
    situacao: m.status === 1 ? "ativo" : "afastado",
  };
}

export function veiculoDaApi(v: VeiculoApi): VeiculoFront {
  return {
    id: String(v.id),
    // `label` é a placa e `label2` o prefixo — no legado os dois são só
    // "rótulo 1" e "rótulo 2", sem semântica declarada.
    placa: v.label,
    prefixo: v.label2 ?? undefined,
    modelo: v.model ?? undefined,
    grupoId: v.group_id != null ? String(v.group_id) : undefined,
    unidadeId: v.subgroup_id != null ? String(v.subgroup_id) : undefined,
    ativo: v.status === 1,
    velocidadeMaxima: v.max_speed ?? undefined,
    odometroInicial: v.initial_odometer ?? undefined,
    horimetroInicial: v.initial_horimeter ?? undefined,
    observacao: v.obs ?? undefined,
    motoristaId: v.driver_id != null ? String(v.driver_id) : undefined,
    custoKm: v.cost_km ?? undefined,
  };
}

/**
 * Converte para o formato de gravação.
 *
 * Campos ausentes são omitidos em vez de enviados como null: o backend usa
 * `Optional` com `None` como "não mexer", então mandar null apagaria o valor
 * existente numa edição parcial.
 */
export function veiculoParaApi(v: Partial<VeiculoFront>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (v.placa !== undefined) out.label = v.placa;
  if (v.prefixo !== undefined) out.label2 = v.prefixo;
  if (v.modelo !== undefined) out.model = v.modelo;
  if (v.grupoId !== undefined) out.group_id = Number(v.grupoId);
  if (v.unidadeId !== undefined) out.subgroup_id = Number(v.unidadeId);
  if (v.ativo !== undefined) out.status = v.ativo ? 1 : 0;
  if (v.velocidadeMaxima !== undefined) out.max_speed = v.velocidadeMaxima;
  if (v.odometroInicial !== undefined) out.initial_odometer = v.odometroInicial;
  if (v.horimetroInicial !== undefined) out.initial_horimeter = v.horimetroInicial;
  if (v.observacao !== undefined) out.obs = v.observacao;
  return out;
}

/* ------------------------------------------------------------------ */
/* Motorista                                                           */
/* ------------------------------------------------------------------ */

export type MotoristaApi = {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  cpf?: string | null;
  matricula?: string | null;
  cnh?: string | null;
  cnh_category?: string | null;
  cnh_validate?: string | null;
  group_id?: number | null;
  subgroup_id?: number | null;
  driver_function_id?: number | null;
  status?: number | null;
  auth?: number | null;
  login?: string | null;
  obs_driver?: string | null;
  admission?: string | null;
  aso_validate?: string | null;
  rac_validate?: string | null;
};

export type MotoristaFront = {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cpf?: string;
  matricula?: string;
  cnh?: string;
  cnhCategoria?: string;
  cnhValidade?: string;
  grupoId?: string;
  unidadeId?: string;
  funcaoId?: string;
  ativo: boolean;
  observacao?: string;
  admissao?: string;
  asoValidade?: string;
};

export function motoristaDaApi(m: MotoristaApi): MotoristaFront {
  return {
    id: String(m.id),
    nome: m.name ?? "",
    email: m.email ?? undefined,
    telefone: m.phone ?? undefined,
    cpf: m.cpf ?? undefined,
    matricula: m.matricula ?? undefined,
    cnh: m.cnh ?? undefined,
    cnhCategoria: m.cnh_category ?? undefined,
    cnhValidade: m.cnh_validate ?? undefined,
    grupoId: m.group_id != null ? String(m.group_id) : undefined,
    unidadeId: m.subgroup_id != null ? String(m.subgroup_id) : undefined,
    funcaoId: m.driver_function_id != null ? String(m.driver_function_id) : undefined,
    ativo: m.status === 1,
    observacao: m.obs_driver ?? undefined,
    admissao: m.admission ?? undefined,
    asoValidade: m.aso_validate ?? undefined,
  };
}

export function motoristaParaApi(m: Partial<MotoristaFront>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (m.nome !== undefined) out.name = m.nome;
  // O backend valida e-mail estritamente: string vazia é rejeitada, então
  // manda-se ausente em vez de "".
  if (m.email) out.email = m.email;
  if (m.telefone !== undefined) out.phone = m.telefone;
  // CPF vai só com dígitos — o backend espera 11 caracteres numéricos.
  if (m.cpf !== undefined) out.cpf = m.cpf.replace(/\D/g, "");
  if (m.matricula !== undefined) out.matricula = m.matricula;
  if (m.cnh !== undefined) out.cnh = m.cnh;
  if (m.cnhCategoria !== undefined) out.cnh_category = m.cnhCategoria;
  if (m.cnhValidade) out.cnh_validate = m.cnhValidade;
  if (m.grupoId !== undefined) out.group_id = Number(m.grupoId);
  if (m.unidadeId !== undefined) out.subgroup_id = Number(m.unidadeId);
  if (m.funcaoId !== undefined) out.driver_function_id = Number(m.funcaoId);
  if (m.ativo !== undefined) out.status = m.ativo ? 1 : 0;
  if (m.observacao !== undefined) out.obs_driver = m.observacao;
  if (m.admissao) out.admission = m.admissao;
  if (m.asoValidade) out.aso_validate = m.asoValidade;

  // Obrigatório na criação e sem equivalente na interface: nível de
  // autenticação do motorista no equipamento. Zero é "sem login próprio", que
  // é o caso da maioria.
  if (out.auth === undefined) out.auth = 0;
  return out;
}

/* ------------------------------------------------------------------ */
/* Linha                                                               */
/* ------------------------------------------------------------------ */

export type LinhaApi = {
  id: number;
  name?: string | null;
  description?: string | null;
  group_id?: number | null;
  subgroup_id?: number | null;
  status?: number | null;
  circular?: boolean | null;
  km?: number | null;
  duration?: string | null;
  shift_count?: number;
  buss_line_client_id?: number | null;
};

/**
 * Linha no formato das telas.
 *
 * `modalidade` e `cor` não existem em `buss_line`: a modalidade está em
 * `bls_category_id`, cujo domínio ainda não foi mapeado, e cor é decisão de
 * interface. Ambos recebem padrão em vez de ficarem indefinidos, para as telas
 * não precisarem tratar ausência em toda parte.
 */
export function linhaDaApi(l: LinhaApi): Linha & { circular?: boolean; turnos?: number } {
  return {
    id: String(l.id),
    codigo: l.name ?? String(l.id),
    nome: l.description ?? l.name ?? "",
    modalidade: "publico",
    grupoId: l.group_id != null ? String(l.group_id) : undefined,
    operadora: l.buss_line_client_id != null ? `Contratante ${l.buss_line_client_id}` : undefined,
    cor: "#1B3A6B",
    ativa: l.status === 1,
    circular: Boolean(l.circular),
    turnos: l.shift_count ?? 0,
  };
}

/** Sentido do turno: o banco usa 0 e 1, a interface usa palavra. */
export const sentidoDaApi = (direction: number | null | undefined) =>
  direction === 1 ? "volta" : "ida";

export const sentidoParaApi = (sentido: string) => (sentido === "volta" ? 1 : 0);
