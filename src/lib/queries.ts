import { queryOptions } from "@tanstack/react-query";
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
  Organizacoes,
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
    queryKey: ["frota", "posicoes"],
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
export const veiculosApiQuery = (page = 1, pageSize = 200) =>
  queryOptions({
    queryKey: ["veiculos", "api", page, pageSize],
    queryFn: async () => {
      const r = await Real.veiculos({ skip: (page - 1) * pageSize, limit: pageSize });
      return { items: (r.items as VeiculoApi[]).map(veiculoDaApiParaTela), total: r.total };
    },
    enabled: !usandoMock(),
    staleTime: 2 * MINUTE,
  });

export const motoristasApiQuery = (page = 1, pageSize = 200) =>
  queryOptions({
    queryKey: ["motoristas", "api", page, pageSize],
    queryFn: async () => {
      const r = await Real.motoristas({ skip: (page - 1) * pageSize, limit: pageSize });
      return { items: (r.items as MotoristaApi[]).map(motoristaDaApiParaTela), total: r.total };
    },
    enabled: !usandoMock(),
    staleTime: 2 * MINUTE,
  });

export const linhasApiQuery = () =>
  queryOptions({
    queryKey: ["linhas", "api"],
    queryFn: async () => {
      const r = await Real.linhas({ limit: 200 });
      return (r.items as LinhaApi[]).map(linhaDaApi);
    },
    enabled: !usandoMock(),
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
    staleTime: MINUTE,
    refetchInterval: refetchInterval(),
  });

export const videoOcorrenciasApiQuery = (params: Record<string, string | number | boolean>) =>
  queryOptions({
    queryKey: ["video", "ocorrencias", "api", JSON.stringify(params)],
    queryFn: () => Seguranca.ocorrencias(params),
    enabled: !usandoMock(),
    staleTime: 30_000,
  });

export const indicadoresApiQuery = (inicio: string, fim: string, grupoId?: string) =>
  queryOptions({
    queryKey: ["indicadores", "api", inicio, fim, grupoId ?? "todos"],
    queryFn: () => IndicadoresApi.consolidado(inicio, fim, grupoId),
    enabled: !usandoMock(),
    staleTime: 5 * MINUTE,
  });

export const pontosApiQuery = (dias = 30, busca?: string) =>
  queryOptions({
    queryKey: ["pontos", "api", dias, busca ?? ""],
    queryFn: () => PontosApi.lista(dias, busca),
    enabled: !usandoMock(),
    staleTime: 10 * MINUTE,
  });

export const vinculosRastreadorQuery = () =>
  queryOptions({
    queryKey: ["vinculos", "rastreadores"],
    queryFn: () => Vinculos.rastreadores({ limit: 500 }),
    enabled: !usandoMock(),
    staleTime: 5 * MINUTE,
  });

export const vinculosCameraQuery = () =>
  queryOptions({
    queryKey: ["vinculos", "cameras"],
    queryFn: () => Vinculos.cameras({ limit: 500 }),
    enabled: !usandoMock(),
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
 * Empresas clientes, vindas de `mova.group`.
 *
 * Só o super admin enxerga mais de uma; para os demais, o backend já devolve
 * apenas o grupo a que têm acesso — o filtro de escopo acontece no servidor,
 * não aqui.
 */
export const organizacoesQuery = () =>
  queryOptions({
    queryKey: ["organizacoes", "api"],
    queryFn: async () => {
      const r = await Organizacoes.lista();
      return (r.items ?? [])
        .filter((g) => g.status !== 0)
        .map((g) => ({
          id: String(g.id),
          name: g.name ?? g.description ?? `Grupo ${g.id}`,
          plan: undefined as string | undefined,
        }));
    },
    enabled: !usandoMock(),
    staleTime: 10 * MINUTE,
  });
