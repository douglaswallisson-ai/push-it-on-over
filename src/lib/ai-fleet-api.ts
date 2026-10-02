import { api } from "@/lib/api";

/**
 * Painel AI Fleet Manager — leitura de `fleet_mvp` e `fleet_ai`.
 *
 * Quem calcula é o worker `ss-worker-fleet-insights`, em lote. A API só lê, e
 * a tela nunca dispara a IA: o insight vem do que o motor já gravou e aprovou.
 * Sem geração aprovada para o dia, o texto vem nulo e os indicadores continuam
 * — número não depende de a IA ter rodado.
 *
 * As 13 faixas aqui são a mesma classificação do worker, com os nomes do
 * domínio em vez dos nomes de coluna: `batendo_transmissao` é o que a tabela
 * chama de `time_blue`.
 */

export type FaixasAi = {
  // Ideal
  verde?: number | null;
  inercia?: number | null;
  extra_eco?: number | null;
  ecoroll?: number | null;
  baixa_velocidade?: number | null;
  // Irregular
  marcha_lenta?: number | null;
  parado_ligado_produtivo?: number | null;
  batendo_transmissao?: number | null;
  amarela?: number | null;
  vermelha?: number | null;
  parado_acelerando?: number | null;
  banguela?: number | null;
  tolerancia?: number | null;
};

export type KpiAi = {
  chave: string;
  rotulo?: string | null;
  valor: number | null;
  unidade?: string | null;
  escopo?: string | null;
  veredito?: "atingiu" | "nao_atingiu" | "sem_meta" | string | null;
  desvio?: number | null;
  desvio_relativo?: number | null;
  ordem?: number | null;
  meta?: {
    valor: number;
    tipo?: string | null;
    origem?: string | null;
    fonte?: string | null;
    base?: string | null;
  } | null;
  comparacao?: {
    inicio: string;
    fim: string;
    valor_referencia?: number | null;
    variacao?: number | null;
    direcao?: string | null;
    comparavel?: boolean | null;
  } | null;
};

export type AcaoAi = {
  chave: string;
  rotulo?: string | null;
  severidade?: "critica" | "alta" | "media" | string | null;
  desvio_relativo?: number | null;
  texto?: string | null;
  tendencia?: string | null;
};

export type PainelAi = {
  group_id: number;
  grupo_nome?: string | null;
  grupo_razao_social?: string | null;
  periodo: { inicio: string; fim: string; dias: number; mes_completo: boolean };
  kpis: KpiAi[];
  acoes_ordenadas: AcaoAi[];
  frota: {
    veiculos?: number | null;
    viagens?: number | null;
    distancia_km?: number | null;
    tempo_horas?: number | null;
    condutores_identificados?: number | null;
    benchmark_pct_ideal?: number | null;
    faixas_pct?: FaixasAi | null;
    eventos_total?: {
      count_embreagem?: number | null;
      count_freada_brusca?: number | null;
      count_aceleracao_brusca?: number | null;
      count_excesso_velocidade?: number | null;
    } | null;
  };
  condutor_tipico?: {
    qtd_condutores?: number | null;
    distancia_km?: number | null;
    tempo_horas?: number | null;
    faixas_pct?: FaixasAi | null;
  } | null;
  economia_combustivel?: {
    inicio: string;
    fim: string;
    litros?: number | null;
    reais?: number | null;
  } | null;
  condutores_abaixo_benchmark: {
    driver_id: number;
    driver_nome?: string | null;
    pct_ideal?: number | null;
    pct_irregular?: number | null;
    km_por_litro?: number | null;
    desvio_pp?: number | null;
  }[];
  condutores_acima_benchmark: Record<string, unknown>[];
  ranking_eventos: Record<string, unknown>[];
  ranking_faixas: Record<string, unknown>[];
  unidades_sem_sinal_faixa: Record<string, unknown>[];
  condutores_sem_sinal_faixa: { driver_id: number; driver_nome?: string | null }[];
  cadastro?: Record<string, unknown> | null;
  atualizacao?: Record<string, unknown> | null;
  insight?: {
    id?: number;
    texto: string;
    blocos?: Record<string, unknown> | null;
    gerado_em?: string | null;
  } | null;
  /** "sem_permissao": o banco ainda não liberou leitura do texto da IA (esquema fleet_ai). */
  insight_indisponivel?: "sem_permissao" | null;
  /**
   * Qualidade do dado — vem junto de propósito.
   *
   * Um painel que mostra 3,4 km/l sem dizer que 42% das horas estão sem
   * condutor identificado induz a conclusão errada sobre quem dirige bem.
   */
  data_quality?: {
    cobertura_combustivel_pct?: number | null;
    confianca_combustivel?: string | null;
    pct_horas_nao_identificadas?: number | null;
    condutores_identificados?: number | null;
    dias_sem_dado?: number | null;
    metas_nao_validadas?: string[] | null;
  } | null;
};

export type ContaAi = { group_id: number; nome?: string | null };

/** Janela máxima do painel. Acima disso o servidor recusa com 400. */
export const AI_MAX_DIAS = 92;

export const AiFleet = {
  contas: () => api.get<ContaAi[]>(`/api/v1/ai-fleet/contas`),

  painel: (p: { groupId: number | string; inicio: string; fim: string; comparar?: boolean }) =>
    api.get<PainelAi>(
      `/api/v1/ai-fleet/painel?group_id=${p.groupId}&inicio=${p.inicio}&fim=${p.fim}` +
        (p.comparar ? "&comparar=true" : ""),
    ),
};
