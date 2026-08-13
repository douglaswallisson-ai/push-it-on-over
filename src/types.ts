/**
 * Tipos de domínio compartilhados entre a UI e a API.
 *
 * São o contrato com o back-end Python: cada resposta JSON deve bater com estes
 * formatos. Mantê-los aqui (e não espalhados nas telas) é o que permite trocar
 * o mock por `fetch` sem tocar nos componentes.
 */

/** Envelope de listagem paginada — padrão de todas as coleções. */
export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type Severidade = "critico" | "atencao" | "operacional" | "ok";

export type Motorista = {
  id: string;
  nome: string;
  filial: string;
  cnhCategoria?: string;
  cnhValidade?: string;
  kmRodado: number;
  notaGeral: number;
  viagens: number;
  premiacao: number;
  situacao: "ativo" | "atencao" | "afastado";
};

export type Veiculo = {
  id: string;
  placa: string;
  marca: string;
  modelo: string;
  ano: number;
  operacao: string;
  situacao: "em_rota" | "parado" | "manutencao" | "sem_sinal";
  kml: number;
  odometro: number;
  grupoId?: string;
  unidadeId?: string;
};

export type PosicaoVeiculo = {
  veiculoId: string;
  placa: string;
  lat: number;
  lng: number;
  endereco: string;
  velocidade: number;
  ignicao: boolean;
  atualizadoEm: string; // ISO
};

export type Viagem = {
  id: string;
  codigo: string;
  origem: string;
  destino: string;
  saida: string; // ISO
  retorno?: string;
  veiculoId: string;
  motoristaId: string;
  assentos: number[];
  status: "agendada" | "em_curso" | "concluida" | "cancelada";
};

export type Alarme = {
  id: string;
  nome: string;
  tipo: "velocidade" | "cerca" | "ociosidade" | "panico" | "combustivel";
  condicao: string;
  severidade: Severidade;
  canais: string[];
  ativo: boolean;
};

export type ComponenteSaude = {
  id: string;
  label: string;
  valor: string;
  severidade: Severidade;
};

export type Manutencao = {
  veiculoId: string;
  indiceSaude: number;
  componentes: ComponenteSaude[];
  predicoes: { titulo: string; prazoDias: number; custo: number; severidade: Severidade }[];
  /** Mensagem opcional da API quando a predição não está disponível. */
  _aviso?: string;
};

export type EmissaoResumo = {
  periodo: string;
  toneladasCO2: number;
  kgPorKm: number;
  arvoresCompensacao: number;
  consumoLitros: number;
};

/** KPIs da tela de início. */
export type ResumoOperacao = {
  veiculosAtivos: number;
  alertasAbertos: number;
  custoPorKm: number;
  consumoMedio: number;
  disponibilidade: number;
};

/* ------------------------------------------------------------------ */
/* Garagens, equipamentos, manutenção (kanban) e vínculo motorista↔veículo */
/* ------------------------------------------------------------------ */

/**
 * Garagem — uma empresa pode ter várias na mesma cidade. É o nível abaixo de
 * Unidade/filial e o escopo natural de permissão de um gestor de pátio.
 */
export type Garagem = {
  id: string;
  nome: string;
  unidadeId: string;
  unidade: string;
  endereco: string;
  cidade: string;
  uf: string;
  responsavel: string;
  vagas: number;
  veiculos: number;
  ativa: boolean;
};

/** Equipamento de telemetria instalado (ou em estoque, sem placa). */
export type Equipamento = {
  id: string;
  serial: string;
  modelo: string;
  firmware: string;
  /** Null quando o equipamento está em estoque / sem vínculo. */
  veiculoId: string | null;
  placa: string | null;
  garagemId?: string;
  /** ISO da última comunicação de dados recebida. */
  ultimaComunicacao: string | null;
  simOperadora?: string;
};

/**
 * Faixas de saúde de comunicação. Limiares em horas — definidos aqui para que
 * tela, filtro e alerta usem a mesma regra.
 */
export type StatusComunicacao = "online" | "atencao" | "sem_sinal" | "nunca";

/** Colunas do kanban de manutenção. */
export type StatusManutencao =
  | "em_dia"
  | "preditiva"
  | "preventiva"
  | "corretiva"
  | "liberado";

/** Card do kanban — um por placa da frota. */
export type CardManutencao = {
  veiculoId: string;
  placa: string;
  marca: string;
  modelo: string;
  status: StatusManutencao;
  /** Serviço a ser feito, em uma linha. */
  servico: string;
  /** Prazo em dias (negativo = vencido). */
  prazoDias: number | null;
  indiceSaude: number;
  custoEstimado: number | null;
  /** Quantas pendências abertas além da principal. */
  pendencias: number;
  garagem?: string;
};

/**
 * Condução — um período em que um motorista dirigiu um veículo. É a tabela que
 * permite responder "quem dirigiu esta placa" e "que placas este motorista
 * dirigiu". Sem ela o cruzamento não existe.
 */
export type Conducao = {
  id: string;
  veiculoId: string;
  placa: string;
  motoristaId: string;
  motorista: string;
  inicio: string; // ISO
  fim: string | null; // null = em curso
  km: number;
  notaGeral: number;
};

/** Indicadores de condução — os mesmos usados na tela de Motoristas. */
export type IndicadoresConducao = {
  /** Início da faixa verde. */ iv: number | null;
  /** Aproveitamento de embalo. */ ae: number | null;
  /** Motor ligado parado. */ mp: number | null;
  /** Acelerando acima do verde. */ av: number | null;
  /** Piloto automático. */ pa: number | null;
  /** Excesso de velocidade. */ ev: number | null;
  /** Freio motor. */ fm: number | null;
  /** Pressão do acelerador. */ pac: number | null;
};
