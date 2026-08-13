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
  /** Matrícula/prontuário — como a operação identifica o funcionário. */
  matricula?: string;
  funcao?: "motorista" | "cobrador" | "motorista_cobrador";
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
  /**
   * Identificador operacional do carro. Em transporte de passageiros a operação
   * chama o veículo pelo prefixo, não pela placa — placa é dado de documento.
   */
  prefixo?: string;
  marca: string;
  modelo: string;
  ano: number;
  operacao: string;
  situacao: "em_rota" | "parado" | "manutencao" | "sem_sinal";
  kml: number;
  odometro: number;
  grupoId?: string;
  unidadeId?: string;
  /** Garagem onde o veículo está lotado — menor escopo de permissão. */
  garagemId?: string;
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
  /**
   * Placas às quais o alarme se aplica. Lista vazia (ou ausente) significa
   * toda a frota — é o que o campo "Aplicar a" grava.
   */
  veiculos?: string[];
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

/* ================================================================== */
/* BLOCO 0 — Linha, itinerário, programação e realizado               */
/* ================================================================== */

/**
 * Modalidade da operação. O sistema atende transporte de pessoas (público e
 * fretamento) e, por exceção, carga — os três compartilham veículo, motorista e
 * manutenção, mas divergem em programação e conformidade.
 */
export type Modalidade = "publico" | "fretamento" | "carga";

export const MODALIDADE_LABEL: Record<Modalidade, string> = {
  publico: "Transporte público",
  fretamento: "Fretamento",
  carga: "Carga",
};

/** Sentido do itinerário. */
export type Sentido = "ida" | "volta" | "circular";

/**
 * Tipo de dia da programação. Operação de ônibus tem tabelas distintas por tipo
 * de dia — a mesma linha roda com frequências diferentes no sábado e no domingo.
 */
export type TipoDia = "util" | "sabado" | "domingo" | "feriado" | "especial";

export const TIPO_DIA_LABEL: Record<TipoDia, string> = {
  util: "Dia útil",
  sabado: "Sábado",
  domingo: "Domingo",
  feriado: "Feriado",
  especial: "Especial",
};

/** Agrupamento de linhas — corredor, região ou lote de concessão. */
export type GrupoLinhas = {
  id: string;
  nome: string;
  descricao?: string;
  cor: string;
};

/**
 * Ponto de parada. Quando `controle` é verdadeiro, é um PC (ponto de controle):
 * local onde a passagem do veículo é conferida contra o horário programado, e
 * onde a viagem é aberta e encerrada.
 */
export type PontoParada = {
  id: string;
  codigo: string;
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
  /** Ponto de controle — gera alarme de abertura de viagem fora do PC. */
  controle: boolean;
  /** Tolerância de passagem, em minutos, antes de contar como atraso. */
  toleranciaMin: number;
  abrigo?: boolean;
  acessivel?: boolean;
};

/** Parada dentro de um itinerário, com a ordem e o tempo acumulado. */
export type ParadaItinerario = {
  pontoId: string;
  ordem: number;
  /** Minutos desde o início do itinerário até esta parada. */
  minutosAcumulados: number;
  /** Km desde o início do itinerário. */
  kmAcumulado: number;
};

/** Traçado de um sentido da linha. */
export type Itinerario = {
  id: string;
  linhaId: string;
  sentido: Sentido;
  nome: string;
  extensaoKm: number;
  /** Duração programada da viagem, em minutos. */
  duracaoMin: number;
  paradas: ParadaItinerario[];
  ativo: boolean;
};

/** Linha — o eixo em torno do qual a operação de passageiros se organiza. */
export type Linha = {
  id: string;
  codigo: string;
  nome: string;
  modalidade: Modalidade;
  grupoId?: string;
  garagemId?: string;
  /** Concessionária ou contratante responsável. */
  operadora?: string;
  cor: string;
  ativa: boolean;
  /** Tarifa vigente, quando aplicável. */
  tarifa?: number;
};

/**
 * Viagem programada — uma linha da tabela horária.
 *
 * "Tabela" é o número da escala do carro no dia; é assim que a operação
 * identifica qual carro faz qual sequência de viagens.
 */
export type ViagemProgramada = {
  id: string;
  linhaId: string;
  itinerarioId: string;
  tipoDia: TipoDia;
  /** Número da tabela (escala do carro). */
  tabela: number;
  /** Horário programado de partida, HH:MM. */
  partida: string;
  /** Horário programado de chegada, HH:MM. */
  chegada: string;
  /** Intervalo programado até a próxima viagem no mesmo sentido, em minutos. */
  headwayMin?: number;
  /** Veículo previsto, quando a escala já foi montada. */
  veiculoId?: string;
  motoristaId?: string;
  cobradorId?: string;
};

/** Situação de uma viagem no confronto entre programado e realizado. */
export type SituacaoViagem =
  | "aguardando"
  | "em_andamento"
  | "ok"
  | "atrasada"
  | "adiantada"
  | "nao_realizada"
  | "reforco";

export const SITUACAO_VIAGEM_LABEL: Record<SituacaoViagem, string> = {
  aguardando: "Aguardando",
  em_andamento: "Em andamento",
  ok: "Viagem OK",
  atrasada: "Atrasada",
  adiantada: "Adiantada",
  nao_realizada: "Não realizada",
  reforco: "Reforço",
};

/**
 * Viagem realizada, confrontada com a programação.
 *
 * Este é o registro central do controle operacional: sem o par programado ×
 * realizado não há como medir cumprimento de programação, que é o que o poder
 * concedente fiscaliza.
 */
export type ViagemRealizada = {
  id: string;
  programadaId?: string;
  linhaId: string;
  itinerarioId: string;
  /** Data de operação segundo o dia fiscal, não o calendário. */
  dataOperacao: string;
  tabela: number;
  sentido: Sentido;

  partidaProgramada?: string;
  partidaRealizada?: string;
  chegadaProgramada?: string;
  chegadaRealizada?: string;

  veiculoProgramadoId?: string;
  veiculoRealizadoId?: string;
  motoristaProgramadoId?: string;
  motoristaRealizadoId?: string;
  cobradorId?: string;

  /** Percentual do percurso efetivamente cumprido. */
  percursoPct: number;
  headwayProgramadoMin?: number;
  headwayRealizadoMin?: number;
  passageiros?: number;
  kmRodado?: number;
  situacao: SituacaoViagem;
};

/** Alarme operacional — decorre do confronto com a programação. */
export type TipoAlarmeOperacional =
  | "abertura_fora_pc"
  | "parado_com_viagem_aberta"
  | "velocidade_maxima"
  | "viagem_nao_iniciada"
  | "fora_itinerario"
  | "headway_irregular";

export const ALARME_OPERACIONAL_LABEL: Record<TipoAlarmeOperacional, string> = {
  abertura_fora_pc: "Abertura de viagem fora do PC",
  parado_com_viagem_aberta: "Veículo parado no PC com viagem aberta",
  velocidade_maxima: "Velocidade máxima excedida",
  viagem_nao_iniciada: "Viagem não iniciada",
  fora_itinerario: "Fora do itinerário",
  headway_irregular: "Headway irregular",
};

export type AlarmeOperacional = {
  id: string;
  tipo: TipoAlarmeOperacional;
  linhaId: string;
  sentido?: Sentido;
  veiculoId: string;
  pontoId?: string;
  motoristaId?: string;
  matricula?: string;
  em: string;
  /** Pontuação de gravidade, somada no painel. */
  pontuacao: number;
  observacao?: string;
  tratado: boolean;
};

/* ------------------------------------------------------------------ */
/* Carga (exceção)                                                     */
/* ------------------------------------------------------------------ */

/**
 * Operação de carga. Compartilha veículo, motorista e manutenção com o
 * transporte de pessoas, mas tem documento fiscal e conformidade próprios.
 */
export type OperacaoCarga = {
  id: string;
  /** Chave do CT-e (conhecimento de transporte). */
  cte?: string;
  /** Chave do MDF-e (manifesto de documentos fiscais). */
  mdfe?: string;
  embarcador: string;
  destinatario: string;
  coletaEm: string;
  entregaPrevista: string;
  entregaRealizada?: string;
  pesoKg: number;
  /** Peso por eixo, para conferência de limite legal. */
  pesoPorEixo?: number[];
  veiculoId: string;
  motoristaId: string;
  situacao: "planejada" | "em_transito" | "entregue" | "ocorrencia";
};

/* ------------------------------------------------------------------ */
/* Dia fiscal                                                          */
/* ------------------------------------------------------------------ */

/**
 * Janela do dia operacional. Operação de ônibus não fecha à meia-noite: uma
 * viagem que parte 23:40 e chega 00:20 pertence ao mesmo dia de operação.
 */
export type DiaFiscal = {
  /** Hora de início, HH:MM. Ex.: "03:00". */
  inicio: string;
  fuso: string;
};
