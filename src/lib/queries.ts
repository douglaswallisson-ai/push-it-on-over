import { queryOptions } from "@tanstack/react-query";
import { AiFleet } from "@/lib/ai-fleet-api";
import { chaveComGrupo } from "@/lib/escopo-ativo";
import {
  Alarmes,
  AlarmesOperacionais,
  Catalogo,
  Checklist,
  Conducoes,
  ContratosOrg,
  DTC,
  Desempenho,
  Equipamentos,
  Frota,
  Garagens,
  GruposLinhas,
  CCO,
  Indicadores,
  Jornadas,
  Motoristas,
  Multas,
  IndicadoresApi,
  Operacional,
  PontosApi,
  Seguranca,
  Ordens,
  Empresas,
  SaudeFrota,
  Unidades,
  PadroesLinha,
  Planos,
  Real,
  Plataforma,
  Preventiva,
  Pneus,
  Tracking,
  Video,
  Vinculos,
  VideoAoVivo,
  Itinerarios,
  Linhas,
  ManutencaoKanban,
  Pontos,
  Programacao,
  Veiculos,
  ViagensOperacao,
} from "@/lib/api";
import type { StatusComunicacao, StatusManutencao } from "@/types";
import { refetchInterval, usandoMock } from "@/lib/modo";
import {
  linhaDaApi,
  motoristaDaApiParaTela,
  veiculoDaApiParaTela,
  type LinhaApi,
  type MotoristaApi,
  type VeiculoApi,
} from "@/lib/mapeamento-api";

/**
 * Opções de query compartilhadas — um único lugar definindo chaves de cache e
 * frescor dos dados vindos da API de frota.
 */

const MINUTE = 60_000;

/**
 * Percorre um endpoint paginado por cursor até acabar.
 *
 * Cada página vem com `next_cursor`; a última vem com `has_more` falso. Sem
 * seguir o cursor, o front mostra a primeira página como se fosse o conjunto
 * inteiro — erro silencioso, porque nada na tela indica que há mais.
 *
 * O teto de páginas protege contra uma resposta anômala que devolva cursor
 * indefinidamente. Mil por página cobre a frota inteira em três requisições.
 */
async function buscarTudoPorCursor<T>(
  consulta: (params: Record<string, string | number>) => Promise<{
    data: T[];
    next_cursor: string | null;
    has_more: boolean;
  }>,
  porPagina = 1000,
  maxPaginas = 20,
): Promise<T[]> {
  const acumulado: T[] = [];
  let cursor: string | null = null;

  for (let i = 0; i < maxPaginas; i++) {
    const params: Record<string, string | number> = { limit: porPagina };
    if (cursor) params.cursor = cursor;

    const r = await consulta(params);
    acumulado.push(...(r.data ?? []));

    if (!r.has_more || !r.next_cursor) break;
    cursor = r.next_cursor;
  }

  return acumulado;
}

/**
 * Política de repetição.
 *
 * O padrão do React Query repete três vezes. Para 401, 403 e 404 isso é
 * desperdício e polui o console: permissão negada não melhora na segunda
 * tentativa, e recurso inexistente continua inexistente. Foi o que encheu a
 * tela de sete chamadas idênticas com 403.
 */
export function naoRepetirSeProibido(tentativas: number, erro: unknown) {
  const status = (erro as { status?: number })?.status;
  if (status === 401 || status === 403 || status === 404) return false;
  return tentativas < 2;
}

export const resumoQuery = () =>
  queryOptions({
    queryKey: ["frota", "resumo"],
    queryFn: () => Frota.resumo(),
    staleTime: MINUTE,
  });

/**
 * Posições do mapa. O intervalo de recarga vem da configuração de origem dos
 * dados: com dados de exemplo não há o que recarregar, e ligado à API o
 * administrador escolhe a frequência.
 */
export const posicoesQuery = () =>
  queryOptions({
    // Com a empresa na chave: as posições agora vêm filtradas por ela, e sem
    // isso a troca no seletor reaproveitaria o mapa da empresa anterior.
    queryKey: chaveComGrupo("frota", "posicoes"),
    queryFn: () => Frota.posicoes(),
    staleTime: 30_000,
    refetchInterval: refetchInterval(),
  });

export const veiculosQuery = (page = 1, pageSize = 50) =>
  queryOptions({
    queryKey: ["veiculos", page, pageSize],
    queryFn: () => Veiculos.list({ page, pageSize }),
    staleTime: 5 * MINUTE,
  });

export const manutencaoQuery = (veiculoId: string | undefined) =>
  queryOptions({
    queryKey: ["veiculos", veiculoId, "manutencao"],
    queryFn: () => Veiculos.manutencao(veiculoId!),
    enabled: Boolean(veiculoId),
    staleTime: 5 * MINUTE,
  });

export const alarmesQuery = () =>
  queryOptions({
    queryKey: ["alarmes"],
    queryFn: () => Alarmes.list(),
    staleTime: 5 * MINUTE,
  });

/** Rótulos de situação do veículo usados pela UI. */
export const SITUACAO_LABEL: Record<string, string> = {
  em_rota: "Em rota",
  parado: "Parado",
  manutencao: "Manutenção",
  sem_sinal: "Sem sinal",
};

export const SITUACAO_TONE: Record<string, "green" | "gold" | "sky" | "coral" | "neutral"> = {
  em_rota: "green",
  parado: "gold",
  manutencao: "sky",
  sem_sinal: "coral",
};

export const nf = (v: number, digits = 0) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v ?? 0);

/** "há 30s" / "há 4 min" a partir de um ISO. */
export function desde(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `há ${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.round(h / 24)} d`;
}

/**
 * Converte lat/lng para coordenadas percentuais dentro do canvas ilustrativo
 * (recorte aproximado do Brasil).
 */
export function toCanvasXY(lat: number, lng: number) {
  const [minLng, maxLng, minLat, maxLat] = [-74, -34, -34, 6];
  const x = ((lng - minLng) / (maxLng - minLng)) * 100;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
  return { x: Math.min(96, Math.max(4, x)), y: Math.min(94, Math.max(6, y)) };
}

/* ------------------------------------------------------------------ */
/* Garagens, equipamentos, kanban e conduções                          */
/* ------------------------------------------------------------------ */

export const garagensQuery = () =>
  queryOptions({ queryKey: ["garagens"], queryFn: () => Garagens.list(), staleTime: 10 * MINUTE });

export const equipamentosQuery = () =>
  queryOptions({
    queryKey: ["equipamentos"],
    queryFn: () => Equipamentos.list(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

export const kanbanManutencaoQuery = () =>
  queryOptions({ queryKey: ["manutencao", "kanban"], queryFn: () => ManutencaoKanban.list(), staleTime: MINUTE });

export const conducoesVeiculoQuery = (veiculoId: string | undefined) =>
  queryOptions({
    queryKey: ["conducoes", "veiculo", veiculoId],
    queryFn: () => Conducoes.porVeiculo(veiculoId!),
    enabled: Boolean(veiculoId),
    staleTime: 5 * MINUTE,
  });

export const conducoesMotoristaQuery = (nome: string | undefined) =>
  queryOptions({
    queryKey: ["conducoes", "motorista", nome],
    queryFn: () => Conducoes.porNome(nome!),
    enabled: Boolean(nome),
    staleTime: 5 * MINUTE,
  });

/* ---- Comunicação de equipamentos ---- */

/**
 * Limiares de comunicação, em horas. Regra única para tela, filtro e alerta —
 * mudar aqui muda em todo o sistema.
 */
export const LIMIAR_COMUNICACAO = { online: 1, atencao: 24 };

export function statusComunicacao(iso: string | null): StatusComunicacao {
  if (!iso) return "nunca";
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h <= LIMIAR_COMUNICACAO.online) return "online";
  if (h <= LIMIAR_COMUNICACAO.atencao) return "atencao";
  return "sem_sinal";
}

export const COMUNICACAO_LABEL: Record<StatusComunicacao, string> = {
  online: "Comunicando",
  atencao: "Atraso",
  sem_sinal: "Sem sinal",
  nunca: "Nunca comunicou",
};

export const COMUNICACAO_TONE: Record<StatusComunicacao, "green" | "gold" | "coral" | "neutral"> = {
  online: "green",
  atencao: "gold",
  sem_sinal: "coral",
  nunca: "neutral",
};

/** Data absoluta em pt-BR, para tooltip ao lado do tempo relativo. */
export const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

/* ---- Manutenção (kanban) ---- */

export const MANUTENCAO_COLUNAS: { id: StatusManutencao; label: string; cor: string }[] = [
  { id: "em_dia", label: "Em dia", cor: "var(--leaf)" },
  { id: "preditiva", label: "Preditiva", cor: "var(--brand-sky)" },
  { id: "preventiva", label: "Preventiva", cor: "var(--gold)" },
  { id: "corretiva", label: "Corretiva", cor: "var(--coral)" },
  { id: "liberado", label: "Liberado", cor: "var(--brand-navy)" },
];

/* ------------------------------------------------------------------ */
/* BLOCO 0 — Operação por linha                                        */
/* ------------------------------------------------------------------ */

export const linhasQuery = () =>
  queryOptions({ queryKey: ["linhas"], queryFn: () => Linhas.list(), staleTime: 10 * MINUTE });

export const gruposLinhasQuery = () =>
  queryOptions({ queryKey: ["linhas", "grupos"], queryFn: () => GruposLinhas.list(), staleTime: 30 * MINUTE });

export const pontosQuery = () =>
  queryOptions({ queryKey: ["pontos"], queryFn: () => Pontos.list(), staleTime: 30 * MINUTE });

export const itinerariosQuery = (linhaId?: string) =>
  queryOptions({
    queryKey: ["itinerarios", linhaId ?? "todos"],
    queryFn: () => Itinerarios.list(linhaId),
    staleTime: 10 * MINUTE,
  });

export const programacaoQuery = (linhaId?: string, tipoDia?: string) =>
  queryOptions({
    queryKey: ["programacao", linhaId ?? "todas", tipoDia ?? "todos"],
    queryFn: () => Programacao.list(linhaId, tipoDia),
    staleTime: 5 * MINUTE,
  });

/** Painel operacional: atualiza sozinho, é tela de CCO. */
export const viagensOperacaoQuery = (data: string, linhaId?: string) =>
  queryOptions({
    queryKey: ["operacao", "viagens", data, linhaId ?? "todas"],
    queryFn: () => ViagensOperacao.doDia(data, linhaId),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

export const alarmesOperacionaisQuery = (linhaId?: string) =>
  queryOptions({
    queryKey: ["operacao", "alarmes", linhaId ?? "todas"],
    queryFn: () => AlarmesOperacionais.list(linhaId),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

export const indicadoresSerieQuery = () =>
  queryOptions({ queryKey: ["indicadores", "serie"], queryFn: () => Indicadores.serie(), staleTime: 10 * MINUTE });

export const falhasQuery = () =>
  queryOptions({ queryKey: ["indicadores", "falhas"], queryFn: () => Indicadores.falhas(), staleTime: 5 * MINUTE });

export const ordensQuery = () => queryOptions({ queryKey: ["ordens"], queryFn: () => Ordens.list(), staleTime: MINUTE });
export const planosQuery = () => queryOptions({ queryKey: ["planos"], queryFn: () => Planos.list(), staleTime: 30 * MINUTE });
export const pneusQuery = () => queryOptions({ queryKey: ["pneus"], queryFn: () => Pneus.list(), staleTime: 5 * MINUTE });
export const videoOcorrenciasQuery = () =>
  queryOptions({ queryKey: ["video", "ocorrencias"], queryFn: () => Video.ocorrencias(), staleTime: 30_000, refetchInterval: 60_000 });
export const videoVolumeQuery = () =>
  queryOptions({ queryKey: ["video", "volume"], queryFn: () => Video.volume(), staleTime: 5 * MINUTE });
export const jornadasQuery = (data?: string) =>
  queryOptions({ queryKey: ["jornadas", data ?? "hoje"], queryFn: () => Jornadas.list(data), staleTime: MINUTE });
export const multasQuery = () => queryOptions({ queryKey: ["multas"], queryFn: () => Multas.list(), staleTime: 5 * MINUTE });

export const motoristasListQuery = () =>
  queryOptions({ queryKey: ["motoristas", "lista"], queryFn: () => Motoristas.list({ page: 1, pageSize: 200 }), staleTime: 5 * MINUTE });

export const posicoesLinhaQuery = (linhaId?: string) =>
  queryOptions({
    queryKey: ["cco", "posicoes", linhaId ?? "todas"],
    queryFn: () => CCO.posicoes(linhaId),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

export const despachosQuery = () =>
  queryOptions({ queryKey: ["cco", "despachos"], queryFn: () => CCO.despachos(), staleTime: 30_000 });

export const dispositivosVideoQuery = () =>
  queryOptions({
    queryKey: ["video", "dispositivos"],
    queryFn: () => VideoAoVivo.dispositivos(),
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

export const trechosGravacaoQuery = (veiculoId?: string) =>
  queryOptions({
    queryKey: ["video", "trechos", veiculoId ?? "todos"],
    queryFn: () => VideoAoVivo.trechos(veiculoId),
    staleTime: MINUTE,
  });

export const solicitacoesGravacaoQuery = () =>
  queryOptions({
    queryKey: ["video", "solicitacoes"],
    queryFn: () => VideoAoVivo.solicitacoes(),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

export const padroesLinhaQuery = () =>
  queryOptions({ queryKey: ["padroes-linha"], queryFn: () => PadroesLinha.list(), staleTime: 10 * MINUTE });

export const amostraContextoQuery = () =>
  queryOptions({ queryKey: ["padroes-linha", "amostra"], queryFn: () => PadroesLinha.amostra(), staleTime: 30 * MINUTE });

export const desempenhoMotoristaQuery = (motoristaId: string | undefined) =>
  queryOptions({
    queryKey: ["desempenho", motoristaId],
    queryFn: () => Desempenho.porMotorista(motoristaId!),
    enabled: Boolean(motoristaId),
    staleTime: 5 * MINUTE,
  });

export const desempenhoTodosQuery = () =>
  queryOptions({ queryKey: ["desempenho", "todos"], queryFn: () => Desempenho.todos(), staleTime: 5 * MINUTE });

export const montadorasQuery = () =>
  queryOptions({ queryKey: ["catalogo", "montadoras"], queryFn: () => Catalogo.montadoras(), staleTime: 30 * MINUTE });

export const modelosQuery = () =>
  queryOptions({ queryKey: ["catalogo", "modelos"], queryFn: () => Catalogo.modelos(), staleTime: 30 * MINUTE });

export const parametrosCatalogoQuery = () =>
  queryOptions({ queryKey: ["catalogo", "parametros"], queryFn: () => Catalogo.parametros(), staleTime: 30 * MINUTE });

export const regrasAjusteQuery = () =>
  queryOptions({ queryKey: ["catalogo", "regras"], queryFn: () => Catalogo.regras(), staleTime: 30 * MINUTE });

export const execucoesQuery = () =>
  queryOptions({ queryKey: ["preventiva", "execucoes"], queryFn: () => Preventiva.execucoes(), staleTime: 5 * MINUTE });

export const sinaisOperacaoQuery = () =>
  queryOptions({ queryKey: ["preventiva", "sinais"], queryFn: () => Preventiva.sinais(), staleTime: 10 * MINUTE });

export const vinculosModeloQuery = () =>
  queryOptions({ queryKey: ["preventiva", "vinculos"], queryFn: () => Preventiva.vinculos(), staleTime: 30 * MINUTE });

export const contratosOrgQuery = () =>
  queryOptions({ queryKey: ["contratos-org"], queryFn: () => ContratosOrg.list(), staleTime: 10 * MINUTE });

export const dtcQuery = () =>
  queryOptions({ queryKey: ["dtc"], queryFn: () => DTC.list(), staleTime: MINUTE, refetchInterval: refetchInterval() });

export const adminsQuery = () =>
  queryOptions({ queryKey: ["plataforma", "admins"], queryFn: () => Plataforma.admins(), staleTime: 10 * MINUTE });

export const perfisAcessoQuery = () =>
  queryOptions({ queryKey: ["plataforma", "perfis"], queryFn: () => Plataforma.perfis(), staleTime: 10 * MINUTE });

export const trackingQuery = (veiculoId: string | undefined) =>
  queryOptions({
    queryKey: ["tracking", veiculoId],
    queryFn: () => Tracking.porVeiculo(veiculoId!),
    enabled: Boolean(veiculoId),
    staleTime: MINUTE,
  });


/* ------------------------------------------------------------------ */
/* Consultas ligadas à API real                                        */
/* ------------------------------------------------------------------ */

/**
 * Veículos do backend, traduzidos para o formato das telas.
 *
 * Fica desabilitada em modo de exemplo: sem isso a tela dispararia uma
 * requisição que não tem para onde ir.
 */
/**
 * Frota completa, seguindo o cursor até o fim.
 *
 * O endpoint pagina por cursor e devolve no máximo 5.000 por página. Parar na
 * primeira mostrava um recorte arbitrário do meu código como se fosse o
 * tamanho da frota — com 2.708 veículos e um limite de 500, o painel dizia
 * "500 veículos ativos" e ninguém tinha como saber que faltavam 2.208.
 *
 * O teto de páginas existe para uma resposta anômala não virar laço infinito.
 */
export const veiculosApiQuery = (page = 1, pageSize = 200) =>
  queryOptions({
    queryKey: chaveComGrupo("veiculos", "api", page, pageSize),
    queryFn: async () => {
      const todos = await buscarTudoPorCursor(Real.veiculos);
      return { items: (todos as VeiculoApi[]).map(veiculoDaApiParaTela), total: todos.length };
    },
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 2 * MINUTE,
  });

export const motoristasApiQuery = (page = 1, pageSize = 200) =>
  queryOptions({
    queryKey: chaveComGrupo("motoristas", "api", page, pageSize),
    queryFn: async () => {
      const todos = await buscarTudoPorCursor(Real.motoristas);
      return { items: (todos as MotoristaApi[]).map(motoristaDaApiParaTela), total: todos.length };
    },
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 2 * MINUTE,
  });

export const linhasApiQuery = () =>
  queryOptions({
    queryKey: chaveComGrupo("linhas", "api"),
    queryFn: async () => {
      const r = await Real.linhas({ limit: 200 });
      return (r.items as LinhaApi[]).map(linhaDaApi);
    },
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 10 * MINUTE,
  });

/** Programado × realizado de uma linha num dia. */
export const cumprimentoQuery = (linhaId: string | undefined, data: string) =>
  queryOptions({
    queryKey: ["cumprimento", linhaId, data],
    queryFn: () => Real.cumprimento(linhaId!, data),
    enabled: Boolean(linhaId) && !usandoMock(),
    staleTime: 30_000,
    refetchInterval: refetchInterval(),
  });

/* ------------------------------------------------------------------ */
/* Tracking, eventos e turnos                                          */
/* ------------------------------------------------------------------ */

export const trackingApiQuery = (unitId: string | undefined, data: string) =>
  queryOptions({
    queryKey: ["tracking", "api", unitId, data],
    queryFn: () => Operacional.tracking(unitId!, data),
    enabled: Boolean(unitId) && !usandoMock(),
    staleTime: MINUTE,
    // 404 aqui significa "veículo sem posição nesta data", que é resposta
    // legítima — repetir não traria nada.
    retry: false,
  });

export const eventosApiQuery = (filtros: Record<string, string | number | boolean>) =>
  queryOptions({
    queryKey: ["eventos", "api", JSON.stringify(filtros)],
    queryFn: () => Operacional.eventos(filtros),
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 30_000,
    refetchInterval: refetchInterval(),
  });

export const rankingMotoristasQuery = (inicio?: string, fim?: string, por: "motorista" | "veiculo" = "motorista") =>
  queryOptions({
    queryKey: chaveComGrupo("motoristas", "ranking", por, inicio ?? "", fim ?? ""),
    queryFn: () => Operacional.rankingMotoristas({ inicio, fim, por }),
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 5 * MINUTE,
  });

export const alarmesNaoVisualizadosQuery = (horas = 24) =>
  queryOptions({
    queryKey: ["alarmes", "nao-visualizados", horas],
    queryFn: () => Operacional.alarmesNaoVisualizados(horas),
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 30_000,
    refetchInterval: refetchInterval(),
  });

export const turnosApiQuery = (linhaId: string | undefined, diaSemana?: number) =>
  queryOptions({
    queryKey: ["turnos", "api", linhaId, diaSemana ?? "todos"],
    queryFn: () => Operacional.turnos(linhaId!, diaSemana != null ? { weekday: diaSemana } : undefined),
    enabled: Boolean(linhaId) && !usandoMock(),
    staleTime: 5 * MINUTE,
  });

export const videoEquipamentosQuery = () =>
  queryOptions({
    queryKey: ["video", "equipamentos", "api"],
    queryFn: () => Seguranca.equipamentos(),
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: MINUTE,
    refetchInterval: refetchInterval(),
  });

export const videoOcorrenciasApiQuery = (params: Record<string, string | number | boolean>) =>
  queryOptions({
    queryKey: ["video", "ocorrencias", "api", JSON.stringify(params)],
    queryFn: () => Seguranca.ocorrencias(params),
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 30_000,
  });

export const indicadoresApiQuery = (inicio: string, fim: string, grupoId?: string) =>
  queryOptions({
    queryKey: ["indicadores", "api", inicio, fim, grupoId ?? "todos"],
    queryFn: () => IndicadoresApi.consolidado(inicio, fim, grupoId),
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 5 * MINUTE,
  });

export const pontosApiQuery = (dias = 30, busca?: string) =>
  queryOptions({
    queryKey: ["pontos", "api", dias, busca ?? ""],
    queryFn: () => PontosApi.lista(dias, busca),
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 10 * MINUTE,
  });

export const vinculosRastreadorQuery = () =>
  queryOptions({
    queryKey: chaveComGrupo("vinculos", "rastreadores"),
    queryFn: () => Vinculos.rastreadores({ limit: 500 }),
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 5 * MINUTE,
  });

export const vinculosCameraQuery = () =>
  queryOptions({
    queryKey: chaveComGrupo("vinculos", "cameras"),
    queryFn: () => Vinculos.cameras({ limit: 500 }),
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 5 * MINUTE,
  });

/* ------------------------------------------------------------------ */
/* Checklist — API Gateway, backend separado                           */
/* ------------------------------------------------------------------ */

/**
 * Só consulta quando há endereço configurado. Sem `VITE_CHECKLIST_BASE` a
 * chamada iria para a própria origem e devolveria o HTML do front, o que
 * geraria um erro de parse difícil de diagnosticar.
 */
const checklistDisponivel = () => Boolean(import.meta.env.VITE_CHECKLIST_BASE) && !usandoMock();

export const checklistsQuery = () =>
  queryOptions({
    queryKey: ["checklist", "lista"],
    queryFn: () => Checklist.lista(),
    enabled: checklistDisponivel(),
    staleTime: 10 * MINUTE,
  });

export const checklistPerguntasQuery = () =>
  queryOptions({
    queryKey: ["checklist", "perguntas"],
    queryFn: () => Checklist.perguntas(),
    enabled: checklistDisponivel(),
    staleTime: 10 * MINUTE,
  });

export const checklistRespostasQuery = () =>
  queryOptions({
    queryKey: ["checklist", "respostas"],
    queryFn: () => Checklist.respostas(),
    enabled: checklistDisponivel(),
    staleTime: MINUTE,
  });

/**
 * Empresas clientes que o usuário pode selecionar.
 *
 * O backend já aplica o escopo — a lista chega filtrada pelo que o usuário tem
 * direito de ver.
 */
export const empresasQuery = () =>
  queryOptions({
    queryKey: ["empresas", "api"],
    queryFn: async () => {
      const r = await Empresas.lista();
      return (Array.isArray(r) ? r : [])
        .map((g) => ({
          id: String(g.id),
          // O nome comercial costuma ser mais reconhecível que a razão social.
          name: (g.name ?? "").trim() || g.corporate_name?.trim() || `Grupo ${g.id}`,
          codigo: g.client_cod?.trim() || null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 10 * MINUTE,
  });

/**
 * Unidades operacionais que o usuário pode selecionar.
 *
 * Vêm de `mova.subgroup`, que é o nível onde a operação acontece — filial,
 * garagem ou contrato. O backend já aplica o escopo, então a lista chega
 * filtrada pelo que o usuário tem direito.
 *
 * Subgrupo suspenso fica de fora: ele existe no cadastro mas não opera, e
 * oferecer para seleção levaria a uma tela sempre vazia.
 */
export const unidadesQuery = (grupoId?: string) =>
  queryOptions({
    queryKey: chaveComGrupo("unidades", "api", grupoId ?? "todas"),
    queryFn: async () => {
      const r = await Unidades.lista(grupoId);
      return (Array.isArray(r) ? r : [])
        .filter((u) => !u.suspended)
        .filter((u) => !grupoId || String(u.group_id) === grupoId)
        .map((u) => ({
          id: String(u.id),
          name: (u.name ?? "").trim() || `Unidade ${u.id}`,
          // O nome já identifica a unidade por inteiro e é exibido como está.
          //
          // Cheguei a extrair a empresa do prefixo, mas a convenção do cadastro
          // não é uniforme: em "FERTRAN - MUTUCA" o prefixo é a empresa; em
          // "MV03 - APERAM" a empresa é o sufixo, e MV03 é código de projeto.
          // Agrupar pelo prefixo juntaria Aperam, DGranel, Orica e MRS sob
          // "MV03", que não significa nada para quem opera.
          //
          // `company` seria a fonte correta, mas está preenchido em menos de 1%
          // dos registros.
          empresa: u.company?.trim() || null,
          codigo: u.client_cod?.trim() || null,
          grupoId: String(u.group_id),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    },
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 10 * MINUTE,
  });

/* ------------------------------------------------------------------ */
/* AI Fleet Manager — fleet_mvp e fleet_ai                             */
/* ------------------------------------------------------------------ */

/**
 * Contas com painel disponível.
 *
 * A tela só mostra o seletor quando volta mais de uma — com uma conta só, um
 * combo de um item é ruído.
 */
export const aiContasQuery = () =>
  queryOptions({
    queryKey: ["ai-fleet", "contas"],
    queryFn: () => AiFleet.contas(),
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 10 * MINUTE,
  });

/**
 * Painel do período.
 *
 * O 404 aqui significa "sem dado carregado para esta conta no período", não
 * erro — o worker ainda não processou. Por isso não é repetido.
 */
export const aiPainelQuery = (groupId?: string, inicio?: string, fim?: string, comparar = true) =>
  queryOptions({
    queryKey: ["ai-fleet", "painel", groupId ?? "", inicio ?? "", fim ?? "", comparar],
    queryFn: () => AiFleet.painel({ groupId: groupId!, inicio: inicio!, fim: fim!, comparar }),
    enabled: !usandoMock() && Boolean(groupId && inicio && fim),
    retry: naoRepetirSeProibido,
    staleTime: 5 * MINUTE,
  });

/**
 * Saúde da frota — cascata de decisão do servidor.
 *
 * Mede qualidade de sinal e comportamento de condução, não manutenção. O
 * cálculo vive no backend porque cruza duas tabelas consolidadas e tem
 * catorze condições com denominadores diferentes: replicar no cliente criaria
 * duas verdades para o mesmo cartão.
 */
export const saudeFrotaQuery = () =>
  queryOptions({
    queryKey: chaveComGrupo("saude-frota"),
    queryFn: () => SaudeFrota.atual(),
    enabled: !usandoMock(),
    retry: naoRepetirSeProibido,
    staleTime: 10 * MINUTE,
  });
