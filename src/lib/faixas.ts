/**
 * Faixas de condução e catálogo de metas/pesos.
 *
 * As 14 faixas seguem o diagrama oficial: o veículo está sempre em exatamente
 * uma faixa, e as faixas se agrupam em Parado / Baixa velocidade / Movimento /
 * Inércia / Tolerância. Manter isso num só lugar é o que garante que frota,
 * veículo e motorista mostrem a mesma coisa com as mesmas cores.
 */

export type GrupoFaixa = "parado" | "baixa" | "movimento" | "inercia" | "tolerancia";

export type Faixa = {
  id: string;
  label: string;
  curto: string;
  grupo: GrupoFaixa;
  cor: string;
  /** true quando permanecer nela é desejável. */
  desejavel: boolean;
  descricao: string;
};

export const GRUPO_LABEL: Record<GrupoFaixa, string> = {
  parado: "Veículo parado",
  baixa: "Baixa velocidade",
  movimento: "Veículo em movimento",
  inercia: "Inércia",
  tolerancia: "Tolerância",
};

/** As 14 faixas, na ordem do diagrama. */
export const FAIXAS: Faixa[] = [
  { id: "parado_ocioso", label: "Parado motor ocioso", curto: "M. ocioso", grupo: "parado", cor: "#F0A868", desejavel: false, descricao: "Motor ligado, veículo parado e sem função produtiva — queima combustível sem rodar." },
  { id: "parado_produtivo", label: "Parado ligado produtivo", curto: "Ligado produtivo", grupo: "parado", cor: "#8A9199", desejavel: true, descricao: "Motor ligado e parado com finalidade operacional (embarque, PTO, ar-condicionado)." },
  { id: "parado_acelerando", label: "Parado acelerando", curto: "Acelerando", grupo: "parado", cor: "#E0483C", desejavel: false, descricao: "Aceleração com o veículo parado — desgaste puro, sem deslocamento." },
  { id: "baixa_velocidade", label: "Baixa velocidade", curto: "Baixa vel.", grupo: "baixa", cor: "#B8A21A", desejavel: false, descricao: "Deslocamento abaixo da faixa de trabalho eficiente do motor." },
  { id: "sem_tracao", label: "Movimento sem tração", curto: "Sem tração", grupo: "movimento", cor: "#7B3FA0", desejavel: false, descricao: "Veículo em movimento sem transmitir força às rodas — ponto morto ou embreagem acionada." },
  { id: "eco_roll", label: "Eco-roll (roda livre)", curto: "Eco-roll", grupo: "movimento", cor: "#1B3A6B", desejavel: true, descricao: "Roda livre controlada pela transmissão, aproveitando a inércia com consumo mínimo." },
  // `time_blue`. Era rotulada "giro baixo"; o vault (13-faixas-fleet-insights,
  // cadastro mova.faixas) confirma que é BATENDO TRANSMISSÃO.
  { id: "giro_baixo", label: "Batendo transmissão (faixa azul)", curto: "Batendo", grupo: "movimento", cor: "#2E86C1", desejavel: false, descricao: "Rotação baixa demais para a marcha engatada — a transmissão trabalha batendo." },
  { id: "verde", label: "Faixa verde", curto: "Verde", grupo: "movimento", cor: "#2E9E4F", desejavel: true, descricao: "Faixa de rotação econômica recomendada pelo fabricante." },
  { id: "extra_economica", label: "Faixa extra econômica", curto: "Extra econ.", grupo: "movimento", cor: "#1E7A38", desejavel: true, descricao: "Melhor ponto de consumo do motor — o alvo da condução eficiente." },
  { id: "amarela", label: "Faixa amarela", curto: "Amarela", grupo: "movimento", cor: "#E8C63A", desejavel: false, descricao: "Rotação acima da faixa econômica; consumo começa a subir." },
  { id: "vermelha", label: "Faixa vermelha", curto: "Vermelha", grupo: "movimento", cor: "#D2352A", desejavel: false, descricao: "Rotação excessiva — consumo alto e desgaste acelerado do motor." },
  { id: "inercia_simples", label: "Inércia simples", curto: "Inércia", grupo: "inercia", cor: "#9BD5A0", desejavel: true, descricao: "Veículo em movimento sem aceleração, aproveitando o embalo." },
  { id: "freio_motor", label: "Freio motor / retarder", curto: "Freio motor", grupo: "inercia", cor: "#6FBF7A", desejavel: true, descricao: "Retenção pelo motor ou retarder, poupando o freio de serviço." },
  { id: "tolerancia", label: "Tolerância", curto: "Tolerância", grupo: "tolerancia", cor: "#C9CFD4", desejavel: true, descricao: "Janela de transição entre faixas, não penalizada na nota." },
];

export const FAIXA_POR_ID = new Map(FAIXAS.map((f) => [f.id, f]));

/** Distribuição percentual do tempo por faixa. Soma esperada: 100. */
export type DistribuicaoFaixas = Record<string, number>;

/** Percentual somado das faixas desejáveis — leitura rápida de eficiência. */
export function pctDesejavel(d: DistribuicaoFaixas): number {
  return FAIXAS.filter((f) => f.desejavel).reduce((a, f) => a + (d[f.id] ?? 0), 0);
}

/** Faixas ordenadas por participação, maiores primeiro. */
export function faixasOrdenadas(d: DistribuicaoFaixas) {
  return FAIXAS.map((f) => ({ faixa: f, pct: d[f.id] ?? 0 }))
    .filter((x) => x.pct > 0)
    .sort((a, b) => b.pct - a.pct);
}

/* ------------------------------------------------------------------ */
/* Catálogo de metas e pesos da premiação                              */
/* ------------------------------------------------------------------ */

export type CategoriaMeta = "faixas" | "ociosidade" | "seguranca" | "operacao";

export type Unidade = "percentual" | "horas" | "km" | "kmh" | "contagem";

export type IndicadorMeta = {
  /** Mesmo ID da tabela legada, para migração. */
  id: number;
  chave: string;
  label: string;
  categoria: CategoriaMeta;
  unidade: Unidade;
  /** "maior" = quanto maior melhor; "menor" = quanto menor melhor. */
  direcao: "maior" | "menor";
  /** Faixa aceitável para a meta, usada nos controles. */
  min: number;
  max: number;
  descricao: string;
};

export const CATEGORIA_LABEL: Record<CategoriaMeta, string> = {
  faixas: "Faixas de condução",
  ociosidade: "Ociosidade e motor parado",
  seguranca: "Direção segura",
  operacao: "Operação e produtividade",
};

export const CATEGORIA_COR: Record<CategoriaMeta, string> = {
  faixas: "var(--leaf)",
  ociosidade: "var(--gold)",
  seguranca: "var(--coral)",
  operacao: "var(--brand-sky)",
};

export const UNIDADE_SUFIXO: Record<Unidade, string> = {
  percentual: "%",
  horas: "h",
  km: "km",
  kmh: "km/h",
  contagem: "ocorr.",
};

/** Os 24 indicadores da tabela legada, agora classificados e descritos. */
export const INDICADORES: IndicadorMeta[] = [
  { id: 4, chave: "verde", label: "Faixa verde", categoria: "faixas", unidade: "percentual", direcao: "maior", min: 0, max: 100, descricao: "Tempo na faixa de rotação econômica." },
  { id: 5, chave: "extra_economica", label: "Faixa extra econômica", categoria: "faixas", unidade: "percentual", direcao: "maior", min: 0, max: 100, descricao: "Tempo no melhor ponto de consumo do motor." },
  { id: 6, chave: "amarela", label: "Faixa amarela", categoria: "faixas", unidade: "percentual", direcao: "menor", min: 0, max: 100, descricao: "Tempo acima da faixa econômica." },
  { id: 7, chave: "vermelha", label: "Faixa vermelha", categoria: "faixas", unidade: "percentual", direcao: "menor", min: 0, max: 100, descricao: "Tempo em rotação excessiva." },
  { id: 2, chave: "sem_tracao", label: "Movimento sem tração", categoria: "faixas", unidade: "percentual", direcao: "menor", min: 0, max: 100, descricao: "Deslocamento sem força nas rodas." },
  { id: 10, chave: "inercia", label: "Inércia", categoria: "faixas", unidade: "percentual", direcao: "maior", min: 0, max: 100, descricao: "Aproveitamento do embalo do veículo." },
  { id: 22, chave: "eco_roll", label: "Eco-roll (roda livre)", categoria: "faixas", unidade: "percentual", direcao: "maior", min: 0, max: 100, descricao: "Roda livre controlada pela transmissão." },
  { id: 23, chave: "baixa_velocidade", label: "Baixa velocidade", categoria: "faixas", unidade: "percentual", direcao: "menor", min: 0, max: 100, descricao: "Deslocamento abaixo da faixa de trabalho." },
  { id: 1, chave: "tolerancia", label: "Tolerância", categoria: "faixas", unidade: "percentual", direcao: "maior", min: 0, max: 100, descricao: "Janela de transição não penalizada." },
  { id: 12, chave: "turbo_ideal", label: "Turbo ideal", categoria: "faixas", unidade: "percentual", direcao: "maior", min: 0, max: 100, descricao: "Operação do turbo na faixa recomendada." },
  { id: 11, chave: "turbo_excessivo", label: "Turbo excessivo", categoria: "faixas", unidade: "percentual", direcao: "menor", min: 0, max: 100, descricao: "Pressão de turbo acima do recomendado." },

  { id: 0, chave: "parado_motor_ligado", label: "Parado motor ligado", categoria: "ociosidade", unidade: "percentual", direcao: "menor", min: 0, max: 100, descricao: "Motor ligado com o veículo parado, sem função produtiva." },
  { id: 21, chave: "parado_produtivo", label: "Parado motor ligado produtivo", categoria: "ociosidade", unidade: "percentual", direcao: "maior", min: 0, max: 100, descricao: "Parado com finalidade operacional (embarque, PTO)." },
  { id: 9, chave: "parado_acelerando", label: "Parado acelerando", categoria: "ociosidade", unidade: "percentual", direcao: "menor", min: 0, max: 100, descricao: "Aceleração com o veículo parado." },
  { id: 8, chave: "rpm_0", label: "RPM 0", categoria: "ociosidade", unidade: "percentual", direcao: "maior", min: 0, max: 100, descricao: "Motor desligado durante paradas longas." },

  { id: 13, chave: "velocidade_excessiva", label: "Velocidade excessiva", categoria: "seguranca", unidade: "contagem", direcao: "menor", min: 0, max: 200, descricao: "Ocorrências acima do limite configurado." },
  { id: 20, chave: "velocidade_chuva", label: "Velocidade na chuva excessiva", categoria: "seguranca", unidade: "contagem", direcao: "menor", min: 0, max: 100, descricao: "Excesso de velocidade com pista molhada." },
  { id: 15, chave: "freada_brusca", label: "Freada brusca", categoria: "seguranca", unidade: "contagem", direcao: "menor", min: 0, max: 200, descricao: "Desaceleração acima do limiar de segurança." },
  { id: 16, chave: "aceleracao_brusca", label: "Aceleração brusca", categoria: "seguranca", unidade: "contagem", direcao: "menor", min: 0, max: 200, descricao: "Aceleração agressiva a partir da parada ou em rota." },
  { id: 17, chave: "curva_brusca", label: "Curva brusca", categoria: "seguranca", unidade: "contagem", direcao: "menor", min: 0, max: 200, descricao: "Força lateral acima do limiar em curva." },
  { id: 14, chave: "embreagem_excessiva", label: "Embreagem excessiva", categoria: "seguranca", unidade: "contagem", direcao: "menor", min: 0, max: 200, descricao: "Uso prolongado da embreagem — desgaste e perda de tração." },
  { id: 3, chave: "batendo_transmissao", label: "Batendo transmissão", categoria: "seguranca", unidade: "contagem", direcao: "menor", min: 0, max: 100, descricao: "Trocas de marcha fora do sincronismo." },

  { id: 18, chave: "hora_trabalhada", label: "Hora trabalhada", categoria: "operacao", unidade: "horas", direcao: "maior", min: 0, max: 300, descricao: "Horas de operação apuradas no período." },
  { id: 19, chave: "km_trabalhado", label: "Km trabalhado", categoria: "operacao", unidade: "km", direcao: "maior", min: 0, max: 30000, descricao: "Quilometragem rodada no período." },
];

export type ConfigMeta = { meta: number; peso: number; ativo: boolean };
export type ConfigMetas = Record<string, ConfigMeta>;

/** Configuração inicial sugerida — pesos somando 100. */
export const CONFIG_PADRAO: ConfigMetas = {
  extra_economica: { meta: 35, peso: 15, ativo: true },
  verde: { meta: 60, peso: 14, ativo: true },
  vermelha: { meta: 3, peso: 10, ativo: true },
  amarela: { meta: 12, peso: 6, ativo: true },
  parado_motor_ligado: { meta: 8, peso: 12, ativo: true },
  parado_acelerando: { meta: 1, peso: 5, ativo: true },
  inercia: { meta: 18, peso: 6, ativo: true },
  eco_roll: { meta: 10, peso: 4, ativo: true },
  sem_tracao: { meta: 4, peso: 4, ativo: true },
  baixa_velocidade: { meta: 8, peso: 3, ativo: true },
  velocidade_excessiva: { meta: 0, peso: 8, ativo: true },
  freada_brusca: { meta: 5, peso: 5, ativo: true },
  aceleracao_brusca: { meta: 5, peso: 4, ativo: true },
  curva_brusca: { meta: 4, peso: 4, ativo: true },
  km_trabalhado: { meta: 8000, peso: 0, ativo: false },
  hora_trabalhada: { meta: 160, peso: 0, ativo: false },
  turbo_ideal: { meta: 70, peso: 0, ativo: false },
  turbo_excessivo: { meta: 5, peso: 0, ativo: false },
  rpm_0: { meta: 90, peso: 0, ativo: false },
  parado_produtivo: { meta: 12, peso: 0, ativo: false },
  tolerancia: { meta: 5, peso: 0, ativo: false },
  embreagem_excessiva: { meta: 6, peso: 0, ativo: false },
  batendo_transmissao: { meta: 2, peso: 0, ativo: false },
  velocidade_chuva: { meta: 0, peso: 0, ativo: false },
};

export const somaPesos = (c: ConfigMetas) =>
  INDICADORES.reduce((a, i) => a + (c[i.chave]?.ativo ? (c[i.chave]?.peso ?? 0) : 0), 0);
