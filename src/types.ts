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
  /** Ano de fabricação. Nulo quando não informado no cadastro. */
  ano: number | null;
  operacao: string;
  situacao: "em_rota" | "parado" | "manutencao" | "sem_sinal";
  /**
   * Consumo médio. Nulo quando não há medição — o cadastro sozinho não traz
   * consumo, ele vem do relatório de telemetria. Zero seria mentira: veículo
   * nenhum roda a 0 km/l.
   */
  kml: number | null;
  /** Odômetro atual. Nulo quando o dado não veio, não zero. */
  odometro: number | null;
  /**
   * Como a leitura do odômetro foi tratada.
   *
   * Um terço dos veículos tem valor corrigido por alguma regra do servidor —
   * `regressive_replaced` quando o contador estoura e anda para trás,
   * `outlier_replaced` em salto implausível. A correção torna o número
   * utilizável; esconder que houve correção é que seria errado.
   */
  odometroQualidade?: string | null;
  /** Quando o odômetro foi lido. Sem isso não se sabe se é de hoje. */
  odometroLidoEm?: string | null;
  horimetro?: number | null;
  /** Consumo informado pelo próprio veículo, pelo barramento. */
  kmlDoVeiculo?: number | null;
  grupoId?: string;
  unidadeId?: string;
  /** Garagem onde o veículo está lotado — menor escopo de permissão. */
  garagemId?: string;
  /** Diesel, elétrico ou híbrido. Muda a unidade de consumo e os indicadores. */
  propulsao?: "diesel" | "eletrico" | "hibrido" | "gnv";
  /** Capacidade de passageiros — base para ocupação. */
  lotacao?: number;
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
  /** Categoria do cadastro (mova.unit_category): define o ícone no mapa. */
  categoriaId?: number | null;
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
  /** Custo por km. Nulo enquanto não houver custo operacional exposto. */
  custoPorKm: number | null;
  /**
   * Consumo médio da frota. Nulo sem medição — zero diria que a frota roda a
   * 0 km/l, o que é impossível e parece medição.
   */
  consumoMedio: number | null;
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
  /** Nulo esconde o selo (a manutenção real não tem esse índice). */
  indiceSaude: number | null;
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
  /**
   * Minutos desde o início do itinerário até esta parada.
   *
   * É o tempo relativo — serve para montar a grade quando não há horário
   * absoluto, e para calcular o esperado a partir da hora de saída da viagem.
   */
  minutosAcumulados: number;
  /**
   * Horário programado de passagem, em minutos desde a meia-noite.
   *
   * É o que `buss_line_shift_stops.schedule_time` guarda: hora do relógio, não
   * tempo decorrido. Convive com `minutosAcumulados` porque as duas formas
   * existem na operação — tabela horária fixa usa hora do relógio, e linha por
   * intervalo usa tempo relativo à partida.
   *
   * Quando presente, tem precedência: comparar contra hora absoluta dispensa
   * saber quando a viagem começou.
   */
  horarioProgramadoMin?: number;
  /** Km desde o início do itinerário. */
  kmAcumulado: number;
  /**
   * Ponto de controle. É onde a viagem abre ou fecha, e onde o cumprimento de
   * horário é fiscalizado — nas demais paradas, a passagem é informativa.
   */
  pontoControle?: boolean;
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

/* ================================================================== */
/* BLOCO 1 — Indicadores do setor                                     */
/* ================================================================== */

/**
 * Categorias de custo operacional. O CPK isolado diz pouco; a decisão de
 * renovar frota ou trocar fornecedor depende de saber qual categoria está
 * puxando o número para cima.
 */
export type CategoriaCusto = "combustivel" | "energia" | "pecas" | "mao_obra" | "pneus" | "terceiros" | "outros";

export const CATEGORIA_CUSTO_LABEL: Record<CategoriaCusto, string> = {
  combustivel: "Combustível",
  energia: "Energia elétrica",
  pecas: "Peças",
  mao_obra: "Mão de obra",
  pneus: "Pneus",
  terceiros: "Serviços de terceiros",
  outros: "Outros",
};

/** Lançamento de custo, sempre atrelado a um período de apuração. */
export type CustoOperacional = {
  id: string;
  periodo: string; // AAAA-MM
  categoria: CategoriaCusto;
  valor: number;
  veiculoId?: string;
  linhaId?: string;
  garagemId?: string;
};

/**
 * Falha que tirou o veículo de operação. É o denominador do MKBF e a origem do
 * MTTR — só conta o que interrompeu a operação, não toda ordem de serviço.
 */
export type FalhaFrota = {
  id: string;
  veiculoId: string;
  linhaId?: string;
  em: string;
  /** Minutos entre a falha e o retorno à operação. */
  tempoReparoMin: number;
  /** Falha em rota tira o carro da linha e exige socorro. */
  emRota: boolean;
  sistema: string;
  descricao: string;
};

/** Consolidado de um período — o que alimenta o comparativo mês a mês. */
export type IndicadoresPeriodo = {
  periodo: string; // AAAA-MM
  frotaAtiva: number;
  frotaTotal: number;
  kmRodado: number;
  /** Km rodado dentro de itinerário cadastrado. */
  kmComItinerario: number;
  passageiros: number;
  litrosDiesel: number;
  kwh: number;
  custoPorCategoria: Record<CategoriaCusto, number>;
  falhas: number;
  falhasEmRota: number;
  tempoReparoTotalMin: number;
  /** Horas em que a frota esteve disponível para escala. */
  horasDisponiveis: number;
  horasTotais: number;
  viagensProgramadas: number;
  viagensRealizadas: number;
  eventosConducao: number;
};

/** Indicadores calculados a partir do consolidado. */
export type IndicadoresCalculados = {
  kml: number;
  kwhPorKm: number;
  ipk: number;
  cpk: number;
  cpkPecas: number;
  cpkCombustivel: number;
  custoTotal: number;
  custoPorPassageiro: number;
  mkbf: number;
  mtbfHoras: number;
  mttrHoras: number;
  disponibilidade: number;
  coberturaKmPct: number;
  eficienciaProgramacao: number;
  eventosPor100km: number;
};

/* ================================================================== */
/* BLOCO 2 — Ordem de serviço, plano de manutenção e pneus            */
/* ================================================================== */

export type StatusOS = "aberta" | "aguardando_peca" | "em_execucao" | "concluida" | "cancelada";

export const STATUS_OS_LABEL: Record<StatusOS, string> = {
  aberta: "Aberta",
  aguardando_peca: "Aguardando peça",
  em_execucao: "Em execução",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export type ItemOS = {
  descricao: string;
  tipo: "peca" | "servico";
  quantidade: number;
  valorUnitario: number;
};

/**
 * Ordem de serviço. O kanban mostra o estado do veículo; a OS registra a
 * execução — é ela que permite responder quanto custou manter uma placa.
 */
export type OrdemServico = {
  id: string;
  numero: string;
  veiculoId: string;
  abertaEm: string;
  concluidaEm?: string;
  status: StatusOS;
  tipo: "preventiva" | "preditiva" | "corretiva";
  origem: "plano" | "predicao" | "falha" | "checklist" | "manual";
  descricao: string;
  oficina: string;
  /** Interna consome mão de obra própria; terceira gera nota. */
  interna: boolean;
  responsavel?: string;
  itens: ItemOS[];
  custoPrevisto: number;
  /** Horas em que o veículo ficou fora de operação. */
  horasParado?: number;
  odometro: number;
  falhaId?: string;
};

/** Item de um plano de manutenção — intervalo por km, horas ou dias. */
export type ItemPlano = {
  id: string;
  descricao: string;
  sistema: string;
  intervaloKm?: number;
  intervaloDias?: number;
  intervaloHoras?: number;
  custoEstimado: number;
};

/**
 * Plano por modelo. Uma frota mista tem planos diferentes por marca e motor;
 * tratar todos igual é o que a lista fixa de consumíveis fazia.
 */
export type PlanoManutencao = {
  id: string;
  nome: string;
  marca: string;
  modelo: string;
  motor?: string;
  itens: ItemPlano[];
  veiculosAplicados: number;
};

/** Posição do pneu no veículo, no padrão eixo/lado. */
export type PosicaoPneu =
  | "1DE" | "1DD"
  | "2TEI" | "2TEE" | "2TDI" | "2TDE"
  | "3TEI" | "3TEE" | "3TDI" | "3TDE"
  | "estepe";

export type Pneu = {
  id: string;
  fogo: string;
  marca: string;
  medida: string;
  veiculoId?: string;
  posicao?: PosicaoPneu;
  /** Quantas recapagens já sofreu. Zero = pneu novo. */
  vidas: number;
  maxVidas: number;
  sulcoMm: number;
  sulcoMinimoMm: number;
  pressaoPsi?: number;
  kmAcumulado: number;
  custoAquisicao: number;
  instaladoEm?: string;
  status: "em_uso" | "estoque" | "recapagem" | "sucata";
};

/* ================================================================== */
/* BLOCO 4 — Videotelemetria (DMS/ADAS)                               */
/* ================================================================== */

export type TipoAlarmeVideo =
  | "distracao" | "olhos_fechados" | "bocejo" | "fadiga" | "celular" | "fumando" | "sem_rosto"
  | "colisao" | "risco_colisao" | "proximidade_dianteira" | "curva_brusca" | "freada_brusca"
  | "aceleracao_brusca" | "excesso_velocidade" | "sos" | "vibracao"
  | "calibracao_anormal" | "desconexao_eletrica" | "baixa_voltagem" | "falha_gravacao";

export const ALARME_VIDEO_LABEL: Record<TipoAlarmeVideo, string> = {
  distracao: "Distração",
  olhos_fechados: "Olhos fechados",
  bocejo: "Bocejo",
  fadiga: "Fadiga",
  celular: "Uso de celular",
  fumando: "Fumando",
  sem_rosto: "Nenhum rosto detectado",
  colisao: "Colisão",
  risco_colisao: "Risco de colisão",
  proximidade_dianteira: "Proximidade do veículo dianteiro",
  curva_brusca: "Curva brusca",
  freada_brusca: "Freada brusca",
  aceleracao_brusca: "Aceleração brusca",
  excesso_velocidade: "Excesso de velocidade",
  sos: "SOS",
  vibracao: "Vibração",
  calibracao_anormal: "Calibração anormal",
  desconexao_eletrica: "Desconexão elétrica externa",
  baixa_voltagem: "Baixa voltagem",
  falha_gravacao: "Falha de gravação",
};

/** Alarme de comportamento x alarme de saúde do próprio equipamento. */
export const ALARME_VIDEO_CLASSE: Record<TipoAlarmeVideo, "comportamento" | "seguranca" | "equipamento"> = {
  distracao: "comportamento", olhos_fechados: "comportamento", bocejo: "comportamento",
  fadiga: "comportamento", celular: "comportamento", fumando: "comportamento", sem_rosto: "comportamento",
  colisao: "seguranca", risco_colisao: "seguranca", proximidade_dianteira: "seguranca",
  curva_brusca: "seguranca", freada_brusca: "seguranca", aceleracao_brusca: "seguranca",
  excesso_velocidade: "seguranca", sos: "seguranca", vibracao: "seguranca",
  calibracao_anormal: "equipamento", desconexao_eletrica: "equipamento",
  baixa_voltagem: "equipamento", falha_gravacao: "equipamento",
};

export type NivelRisco = "baixo" | "medio" | "alto";
export type StatusTratativa = "aguardando" | "em_analise" | "tratado" | "descartado";

export const TRATATIVA_LABEL: Record<StatusTratativa, string> = {
  aguardando: "Aguardando tratativa",
  em_analise: "Em análise",
  tratado: "Tratado",
  descartado: "Descartado — falso positivo",
};

/**
 * Ocorrência de vídeo. O diferencial do concorrente não está na detecção e sim
 * na gestão: fila de tratativa com estado e classificação de risco.
 */
export type OcorrenciaVideo = {
  id: string;
  tipo: TipoAlarmeVideo;
  risco: NivelRisco;
  veiculoId: string;
  motoristaId?: string;
  linhaId?: string;
  em: string;
  imei: string;
  duracaoS?: number;
  velocidadeKmh?: number;
  clipeDisponivel: boolean;
  /** Nome do catálogo da câmera, quando o tipo não está na lista acima. */
  rotulo?: string;
  /** Classe já calculada pela API (DMS → comportamento, ADAS → segurança). */
  classe?: "comportamento" | "seguranca" | "equipamento";
  /** Prefixo ou placa vindos junto da ocorrência. */
  veiculoRotulo?: string;
  status: StatusTratativa;
  tratativa?: string;
  tratadoPor?: string;
  tratadoEm?: string;
};

/* ================================================================== */
/* BLOCO 5 — Jornada, Lei 13.103 e multas                             */
/* ================================================================== */

export type TipoMarcacao =
  | "inicio_jornada" | "inicio_direcao" | "fim_direcao" | "inicio_refeicao"
  | "fim_refeicao" | "inicio_espera" | "fim_espera" | "inicio_descanso"
  | "fim_descanso" | "fim_jornada";

export const MARCACAO_LABEL: Record<TipoMarcacao, string> = {
  inicio_jornada: "Início de jornada",
  inicio_direcao: "Início de direção",
  fim_direcao: "Fim de direção",
  inicio_refeicao: "Início de refeição",
  fim_refeicao: "Fim de refeição",
  inicio_espera: "Início de espera",
  fim_espera: "Fim de espera",
  inicio_descanso: "Início de descanso",
  fim_descanso: "Fim de descanso",
  fim_jornada: "Fim de jornada",
};

export type Marcacao = {
  tipo: TipoMarcacao;
  em: string;
  /** Automática vem da telemetria; manual foi lançada pelo motorista. */
  origem: "automatica" | "manual" | "ajuste";
  pontoId?: string;
  local?: string;
};

/** Infração à Lei 13.103 detectada na jornada. */
export type InfracaoJornada = {
  tipo: "direcao_continua" | "intervalo_insuficiente" | "interjornada" | "jornada_excedida" | "sem_descanso_semanal";
  descricao: string;
  gravidade: "leve" | "media" | "grave";
  minutos: number;
};

/**
 * Jornada de trabalho do dia. Substitui a ficha de papel: as marcações vêm da
 * operação em vez de serem redigitadas a partir do que o motorista escreveu.
 */
export type Jornada = {
  id: string;
  motoristaId: string;
  matricula: string;
  data: string;
  linhaId?: string;
  tabela?: number;
  marcacoes: Marcacao[];
  minutosTrabalhados: number;
  minutosDirecao: number;
  minutosEspera: number;
  minutosRefeicao: number;
  minutosExtras: number;
  limiteExtrasMin: number;
  infracoes: InfracaoJornada[];
  fechada: boolean;
};

export type Multa = {
  id: string;
  ait: string;
  veiculoId: string;
  motoristaId?: string;
  em: string;
  local: string;
  infracao: string;
  gravidade: "leve" | "media" | "grave" | "gravissima";
  pontos: number;
  valor: number;
  vencimento: string;
  /** Prazo legal para indicar o condutor. */
  prazoIndicacao?: string;
  status: "pendente_indicacao" | "indicada" | "em_recurso" | "paga" | "vencida";
};

/* ================================================================== */

/* ================================================================== */
/* BLOCO 3 — Controle operacional (CCO)                               */
/* ================================================================== */

/** Situação do carro no traçado da linha, para o painel sinótico. */
export type PosicaoNaLinha = {
  veiculoId: string;
  linhaId: string;
  itinerarioId: string;
  sentido: Sentido;
  tabela: number;
  motoristaId?: string;
  /** Ponto de onde saiu por último. */
  ultimoPontoId: string;
  /** Progresso entre o último ponto e o próximo, de 0 a 1. */
  progresso: number;
  /** Desvio contra o horário programado, em minutos. Negativo = adiantado. */
  desvioMin: number;
  headwayAnteriorMin?: number;
  velocidadeKmh: number;
  passageirosABordo?: number;
  lotacao?: number;
  em: string;
};

/** Ação de despacho tomada pelo CCO sobre um carro em operação. */
export type TipoDespacho = "retido" | "liberado" | "recolhido" | "reforco" | "troca_veiculo" | "troca_motorista" | "retorno";

export const DESPACHO_LABEL: Record<TipoDespacho, string> = {
  retido: "Reter no ponto",
  liberado: "Liberar",
  recolhido: "Recolher à garagem",
  reforco: "Enviar reforço",
  troca_veiculo: "Trocar veículo",
  troca_motorista: "Trocar motorista",
  retorno: "Retornar sem completar",
};

export type Despacho = {
  id: string;
  tipo: TipoDespacho;
  veiculoId: string;
  linhaId: string;
  em: string;
  operador: string;
  motivo: string;
  minutos?: number;
};

/* ------------------------------------------------------------------ */
/* Videotelemetria — tempo real e gravações                            */
/* ------------------------------------------------------------------ */

/** Canal de câmera instalado no veículo. */
export type CanalCamera = {
  numero: number;
  nome: string;
  posicao: "frontal" | "motorista" | "salao" | "traseira" | "porta" | "lateral";
  online: boolean;
};

export type StatusDVR = "online" | "offline" | "sem_sinal_gps" | "gravando";

/** Equipamento de vídeo embarcado (DVR/MDVR). */
export type DispositivoVideo = {
  imei: string;
  veiculoId: string;
  modelo: string;
  status: StatusDVR;
  canais: CanalCamera[];
  ultimaComunicacao: string;
  /** Armazenamento local usado, em percentual. */
  armazenamentoPct: number;
  /** Dias de gravação retidos no cartão do veículo. */
  retencaoDias: number;
  gpsLat?: number;
  gpsLng?: number;
  velocidadeKmh?: number;
};

/**
 * Trecho de gravação contínua disponível no equipamento.
 *
 * Diferente do clipe de evento: o clipe tem segundos e já veio para o servidor;
 * a gravação contínua fica no cartão do veículo e precisa ser solicitada.
 */
export type TrechoGravacao = {
  id: string;
  veiculoId: string;
  canal: number;
  inicio: string;
  fim: string;
  /** Onde o arquivo está: no equipamento ou já no servidor. */
  local: "dispositivo" | "servidor";
  tamanhoMb: number;
};

export type StatusDownload = "solicitado" | "baixando" | "disponivel" | "falhou";

/** Pedido de download de gravação contínua. */
export type SolicitacaoGravacao = {
  id: string;
  veiculoId: string;
  canal: number;
  inicio: string;
  fim: string;
  solicitadoPor: string;
  solicitadoEm: string;
  status: StatusDownload;
  progressoPct: number;
  motivo?: string;
};

/* ================================================================== */
/* Padrão de condução por linha                                       */
/* ================================================================== */

/**
 * Faixa horária da operação. Pico e entrepico na mesma linha são operações
 * diferentes: trânsito, lotação e número de paradas efetivas mudam, e com eles
 * o que é um bom desempenho.
 */
export type FaixaHoraria = {
  id: string;
  nome: string;
  /** HH:MM inclusivo. */
  inicio: string;
  /** HH:MM exclusivo. Pode cruzar a meia-noite (noturno). */
  fim: string;
  ordem: number;
};

/**
 * Valor esperado de um indicador. `null` significa "não definido aqui" — o
 * sistema busca no nível acima.
 */
export type EsperadoIndicador = {
  /** Valor de referência para a linha/faixa. */
  esperado: number | null;
  /** Tolerância aceita antes de contar como desvio. */
  toleranciaPct?: number | null;
};

/**
 * Padrão de condução de uma linha, opcionalmente restrito a uma faixa horária.
 *
 * Guarda apenas o que difere do padrão global: linha que só precisa ajustar
 * faixa verde grava um indicador, não os vinte e quatro. Isso é o que impede a
 * explosão combinatória de perfis — o cadastro é um delta, não uma cópia.
 */
export type PadraoLinha = {
  id: string;
  linhaId: string;
  /** null = vale para a linha inteira, independente do horário. */
  faixaHorariaId: string | null;
  /** Chave do indicador → valor esperado. Ausente = herda. */
  indicadores: Record<string, EsperadoIndicador>;
  observacao?: string;
  atualizadoEm: string;
  atualizadoPor: string;
};

/** De onde veio o valor aplicado — exibido ao lado de cada campo. */
export type OrigemPadrao = "linha_faixa" | "linha" | "global";

export const ORIGEM_PADRAO_LABEL: Record<OrigemPadrao, string> = {
  linha_faixa: "Definido nesta faixa",
  linha: "Definido nesta linha",
  global: "Padrão global",
};

/* ================================================================== */
/* Catálogo de manutenção do fabricante                               */
/* ================================================================== */

/**
 * Procedência do parâmetro. Sobe da planilha para o produto de propósito: se o
 * sistema disser "troque em 45.000 km", o cliente seguir e o motor quebrar com
 * garantia negada, a pergunta vai ser de onde saiu o número.
 */
/**
 * Confiança do dado de manutenção.
 *
 * Os quatro níveis existem porque um intervalo errado gera alerta errado, e o
 * gestor precisa saber o quanto confiar antes de mandar um carro para a
 * oficina. A diferença entre "manual do fabricante" e "blog de concessionária"
 * é a diferença entre programar e conferir.
 */
export type StatusDado = "oficial" | "divulgado" | "concessionaria" | "norma" | "nao_localizado";

export const STATUS_DADO_LABEL: Record<StatusDado, string> = {
  oficial: "Manual do fabricante",
  divulgado: "Release ou imprensa especializada",
  concessionaria: "Concessionária ou portal técnico",
  norma: "Norma técnica ou legislação",
  nao_localizado: "Não localizado — confirmar antes de usar",
};

/** Cor semântica por confiança, para a tela graduar o alerta. */
export const STATUS_DADO_TOM: Record<StatusDado, "green" | "sky" | "gold" | "coral" | "neutral"> = {
  oficial: "green",
  divulgado: "sky",
  concessionaria: "gold",
  norma: "sky",
  nao_localizado: "coral",
};

/**
 * Camada do plano de manutenção.
 *
 * Ônibus encarroçado tem **dois planos e dois fornecedores**: o chassi segue o
 * manual da montadora, a carroceria segue o da encarroçadora. O manual
 * Marcopolo é explícito — a garantia da carroceria "não abrange o chassi, cuja
 * garantia é dada pelo fabricante do mesmo".
 *
 * Os ritmos são incompatíveis num plano só: limpeza de filtro de
 * ar-condicionado é semanal; troca de óleo do motor é a cada 30 mil km.
 */
export type CamadaManutencao = "chassi" | "carroceria" | "implemento";

export const CAMADA_LABEL: Record<CamadaManutencao, string> = {
  chassi: "Chassi",
  carroceria: "Carroceria",
  implemento: "Implemento",
};

/**
 * Tipo de operação. É a variável que mais muda o intervalo: o mesmo motor
 * Scania DC13 vai de 20.000 km em construção a 120.000 km em longa distância
 * leve. Sem classificar a operação, um plano por modelo é quase inútil.
 */
export type TipoOperacao =
  | "longa_muito_leve"
  | "longa_leve"
  | "longa"
  | "longa_pesado"
  | "construcao"
  | "urbano"
  | "todos";

export const TIPO_OPERACAO_LABEL: Record<TipoOperacao, string> = {
  longa_muito_leve: "0:0 — Longa distância muito leve",
  longa_leve: "0 — Longa distância leve",
  longa: "1 — Longa distância",
  longa_pesado: "2 — Longa distância pesado",
  construcao: "3 — Construção / fora de estrada",
  urbano: "4 — Distribuição / curta distância (urbano)",
  todos: "Todas as operações",
};

export type TipoMontadora = "chassi" | "carroceria" | "encarroçado";

export type Montadora = {
  id: string;
  nome: string;
  tipo: TipoMontadora;
  /** Marca criada automaticamente ao cadastrar um veículo. */
  criadaAutomaticamente?: boolean;
};

export type ModeloVeiculo = {
  id: string;
  montadoraId: string;
  nome: string;
  motor?: string;
  anos?: string;
  faseProconve?: string;
  propulsao?: "diesel" | "eletrico" | "hibrido" | "gnv";
  /**
   * Criado automaticamente no cadastro de veículo, sem parâmetros. Vira
   * pendência para o administrador configurar.
   */
  pendenteConfiguracao?: boolean;
  criadoEm?: string;
};

/**
 * Parâmetro de manutenção preventiva.
 *
 * O disparo segue a regra de ouro dos fabricantes: **o que ocorrer primeiro**
 * entre quilometragem, horas de motor e tempo. Preencher só um dos três é
 * comum e válido.
 */
export type ParametroManutencao = {
  id: string;
  modeloId: string;
  /** null = vale para qualquer operação. */
  tipoOperacao: TipoOperacao | null;
  sistema: string;
  item: string;
  acao: string;
  intervaloKm: number | null;
  intervaloMeses: number | null;
  intervaloHoras: number | null;
  especificacao?: string;
  capacidade?: string;
  obsUsoSevero?: string;
  statusDado: StatusDado;
  /**
   * Camada a que o item pertence. Um veículo encarroçado acumula os planos das
   * duas — o cadastro é de um modelo só, então a separação vive aqui.
   */
  camada?: CamadaManutencao;
  /** Encarroçadora, quando a camada é carroceria. */
  encarrocadora?: string;
  fonte?: string;
  ativo: boolean;
};

/**
 * Regra de ajuste automático do intervalo a partir da telemetria.
 *
 * É o que separa catálogo de plano adaptativo. A Volvo publica a regra
 * "marcha-lenta acima de 30% → usar o intervalo imediatamente menor", e o
 * percentual de motor ligado parado já é coletado pelo sistema.
 */
export type RegraAjuste = {
  id: string;
  nome: string;
  /** Indicador de telemetria observado. */
  indicador: string;
  operador: "maior_que" | "menor_que";
  limiar: number;
  /** Fator aplicado ao intervalo. 0.7 = reduz para 70%. */
  fator: number;
  montadoraId?: string;
  fonte?: string;
  ativa: boolean;
};

/* ------------------------------------------------------------------ */
/* Execução e previsão da manutenção preventiva                        */
/* ------------------------------------------------------------------ */

/**
 * Última execução de um item de manutenção num veículo.
 *
 * É a peça que faltava para o catálogo virar alerta: sem saber quando o item
 * foi feito pela última vez, não há como calcular quando vence.
 */
export type ExecucaoManutencao = {
  id: string;
  veiculoId: string;
  /** Item do catálogo que foi executado. */
  parametroId: string;
  em: string;
  odometro: number;
  horimetro?: number;
  ordemServicoId?: string;
  observacao?: string;
};

/** Urgência da preventiva, derivada do quanto falta para vencer. */
export type UrgenciaPreventiva = "vencida" | "critica" | "proxima" | "programada" | "em_dia";

export const URGENCIA_LABEL: Record<UrgenciaPreventiva, string> = {
  vencida: "Vencida",
  critica: "Vence em breve",
  proxima: "Próxima",
  programada: "Programada",
  em_dia: "Em dia",
};

/**
 * Preventiva calculada para um veículo.
 *
 * O gatilho é o que ocorrer primeiro entre quilometragem, horas e tempo — por
 * isso `disparoPor` registra qual dos três chegou antes, e não só a data.
 */
export type PreventivaPrevista = {
  veiculoId: string;
  parametroId: string;
  modeloId: string;
  sistema: string;
  item: string;
  acao: string;
  especificacao?: string;

  /** Intervalo do catálogo, antes de qualquer ajuste. */
  intervaloOriginalKm: number | null;
  /** Intervalo efetivamente aplicado, após as regras de operação. */
  intervaloAplicadoKm: number | null;
  /** Regras que encurtaram o intervalo, para justificar o número na tela. */
  ajustes: { nome: string; fator: number; motivo: string }[];

  ultimaExecucaoEm: string | null;
  odometroUltimaExecucao: number | null;

  /** Km restantes até vencer. Negativo = já passou. */
  kmRestante: number | null;
  /** Dias restantes até vencer. Negativo = já passou. */
  diasRestante: number | null;
  disparoPor: "km" | "tempo" | "horas" | null;

  urgencia: UrgenciaPreventiva;
  /** Percentual do intervalo já consumido. */
  consumidoPct: number;
};

/* ================================================================== */
/* Contrato comercial da organização                                  */
/* ================================================================== */

/**
 * Modalidade contratada. Uma empresa pode ter mais de uma — é comum operar
 * urbano e fretamento na mesma frota — e a quantidade de veículos é dividida
 * entre elas, porque é o que define o faturamento e o escopo de módulos.
 */
export type ModalidadeContrato = "urbano" | "fretamento" | "carga";

export const MODALIDADE_CONTRATO_LABEL: Record<ModalidadeContrato, string> = {
  urbano: "Transporte urbano",
  fretamento: "Fretamento",
  carga: "Carga",
};

export type StatusContrato = "rascunho" | "ativo" | "suspenso" | "encerrado" | "cancelado";

export const STATUS_CONTRATO_LABEL: Record<StatusContrato, string> = {
  rascunho: "Rascunho",
  ativo: "Ativo",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

/** Aditivo contratual: prorroga prazo, altera volume ou escopo. */
export type AditivoContrato = {
  id: string;
  numero: string;
  tipo: "prorrogacao" | "volume" | "escopo" | "valor";
  assinadoEm: string;
  /** Nova data de término, quando o aditivo prorroga. */
  novoTermino?: string;
  /** Nova distribuição de veículos, quando o aditivo altera volume. */
  novosVeiculos?: Record<ModalidadeContrato, number>;
  descricao: string;
  registradoPor: string;
};

/** Usuário liberado pelo contrato. */
export type UsuarioContrato = {
  id: string;
  nome: string;
  email: string;
  perfil: "admin_empresa" | "gestor" | "operador" | "consulta";
  ativo: boolean;
};

/**
 * Contrato comercial que libera uma organização no sistema.
 *
 * É pré-requisito: sem contrato ativo a organização não existe operacionalmente.
 * Isso evita o cenário em que alguém cria uma empresa "para testar", ela é
 * esquecida ligada, e ninguém sabe se está sendo faturada.
 */
export type ContratoOrganizacao = {
  id: string;
  numero: string;

  /** Organização criada a partir deste contrato. */
  organizacaoId?: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  telefone: string;
  email: string;

  responsavelNome: string;
  responsavelCargo?: string;
  responsavelTelefone?: string;
  responsavelEmail?: string;

  financeiroNome: string;
  financeiroEmail: string;
  financeiroTelefone?: string;

  /** Veículos contratados por modalidade. A soma é o total do contrato. */
  veiculosPorModalidade: Partial<Record<ModalidadeContrato, number>>;

  ativacao: string;
  termino: string;
  /** Término efetivo após aditivos de prorrogação. */
  terminoVigente?: string;

  status: StatusContrato;
  aditivos: AditivoContrato[];
  usuarios: UsuarioContrato[];

  canceladoEm?: string;
  motivoCancelamento?: string;
  observacoes?: string;
  criadoEm: string;
};

/* ------------------------------------------------------------------ */
/* Códigos de falha (DTC) e influência na preventiva                   */
/* ------------------------------------------------------------------ */

export type SeveridadeDTC = "informativo" | "atencao" | "critico" | "parada_imediata";

export const SEVERIDADE_DTC_LABEL: Record<SeveridadeDTC, string> = {
  informativo: "Informativo",
  atencao: "Atenção",
  critico: "Crítico",
  parada_imediata: "Parada imediata",
};

/**
 * Código de falha lido do barramento CAN.
 *
 * O SPN identifica o componente e o FMI o tipo de falha — é o padrão J1939 que
 * os fabricantes usam em veículo pesado. Guardar os dois separados permite
 * agrupar por componente mesmo quando a falha muda de natureza.
 */
export type CodigoDTC = {
  id: string;
  veiculoId: string;
  codigo: string;
  spn?: number;
  fmi?: number;
  sistema: string;
  descricao: string;
  severidade: SeveridadeDTC;
  primeiraOcorrencia: string;
  ultimaOcorrencia: string;
  ocorrencias: number;
  ativo: boolean;
  /** Luz de anomalia acesa no painel. */
  lampadaAcesa?: boolean;
};

/**
 * Recomendação gerada a partir dos códigos de falha.
 *
 * A leitura sozinha não muda comportamento: o gestor recebe uma lista de
 * códigos que não sabe interpretar. O valor está em traduzir o padrão de falhas
 * em ação de manutenção — antecipar um item do plano, abrir corretiva ou apenas
 * observar.
 */
export type RecomendacaoDTC = {
  id: string;
  veiculoId: string;
  codigos: string[];
  sistema: string;
  /** O que fazer, em uma frase. */
  acao: string;
  justificativa: string;
  /** Item do catálogo que deve ser antecipado, quando aplicável. */
  parametroId?: string;
  /** Percentual de antecipação sugerido no intervalo. */
  antecipacaoPct?: number;
  urgencia: "monitorar" | "antecipar" | "corretiva" | "imediata";
  confianca: "alta" | "media" | "baixa";
};

/* ------------------------------------------------------------------ */
/* Administradores da plataforma                                       */
/* ------------------------------------------------------------------ */

/**
 * Administrador do software — quem opera o console de gestão.
 *
 * Distinto do administrador da organização cliente: este configura a
 * plataforma, aquele configura a própria empresa.
 */
export type AdministradorPlataforma = {
  id: string;
  nome: string;
  email: string;
  /** Fundador não pode ser removido, para não sobrar console sem dono. */
  fundador?: boolean;
  ativo: boolean;
  criadoEm: string;
  criadoPor: string;
  ultimoAcesso?: string;
};

/** Perfil de acesso configurável, aplicado às organizações clientes. */
export type PerfilAcesso = {
  id: string;
  nome: string;
  descricao: string;
  /** Ações liberadas — as chaves são as mesmas de `permissoes.ts`. */
  acoes: string[];
  /** Perfil de sistema não pode ser excluído nem renomeado. */
  sistema?: boolean;
  usuariosVinculados: number;
};

/* ------------------------------------------------------------------ */
/* Tracking: eventos de ignição e percurso                             */
/* ------------------------------------------------------------------ */

/**
 * Estado do veículo no mapa. Diferente da situação cadastral: aqui interessa o
 * que exige olhar agora.
 */
export type EstadoMapa =
  | "evento_critico"
  | "manutencao"
  | "em_viagem"
  | "ligado_parado"
  | "desligado"
  | "sem_transmissao";

export const ESTADO_MAPA_LABEL: Record<EstadoMapa, string> = {
  evento_critico: "Evento crítico",
  manutencao: "Em manutenção",
  em_viagem: "Em viagem",
  ligado_parado: "Ligado parado",
  desligado: "Desligado",
  sem_transmissao: "Sem transmitir há mais de 24 h",
};

export type TipoEventoTracking =
  | "ignicao_ligada"
  | "inicio_viagem"
  | "parada"
  | "ligado_parado"
  | "retomada"
  | "ignicao_desligada"
  | "excesso_velocidade"
  | "cerca_entrada"
  | "cerca_saida";

export const EVENTO_TRACKING_LABEL: Record<TipoEventoTracking, string> = {
  ignicao_ligada: "Ignição ligada",
  inicio_viagem: "Início de viagem",
  parada: "Parada",
  ligado_parado: "Ligado parado",
  retomada: "Retomada de movimento",
  ignicao_desligada: "Ignição desligada",
  excesso_velocidade: "Excesso de velocidade",
  cerca_entrada: "Entrada em cerca",
  cerca_saida: "Saída de cerca",
};

/**
 * Evento de percurso.
 *
 * É o registro que faltava para reconstituir o dia do veículo: sem a sequência
 * de ignição, parada e retomada, o mapa mostra onde o carro está mas não como
 * chegou ali, e não há como responder "o que ele fez das 6 às 10".
 */
export type EventoTracking = {
  id: string;
  veiculoId: string;
  tipo: TipoEventoTracking;
  em: string;
  lat: number;
  lng: number;
  endereco?: string;
  velocidade?: number;
  odometro?: number;
  /** Duração do estado que começou neste evento, em minutos. */
  duracaoMin?: number;
  motoristaId?: string;
};

/** Resumo do dia do veículo, derivado dos eventos. */
export type ResumoTracking = {
  veiculoId: string;
  data: string;
  primeiraIgnicao?: string;
  ultimaIgnicao?: string;
  minutosLigado: number;
  minutosEmMovimento: number;
  minutosLigadoParado: number;
  paradas: number;
  kmPercorrido: number;
  velocidadeMaxima: number;
};
