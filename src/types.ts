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
