import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { AlertTriangle, Award, Clock, Search, Star, TrendingUp, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { CelulaRelevo, RelevoDetalhe, useRelevoDaTabela } from "@/components/ss/frota/RelevoDetalhe";
import { StarRating } from "@/components/ss/ui/gauges";
import { rankingMotoristasQuery } from "@/lib/queries";
import type { MotoristaRankingApi } from "@/lib/api";
import { CNH_TONE, exigeAtencao, prazoCNH, statusCNH } from "@/lib/cnh";

/**
 * Ranking dos motoristas — Pontuação do Power BI "Indicadores de Condução 5.0".
 *
 * Tudo vem de `/driver-ranking`, que aplica a fórmula documentada no vault
 * (indicadores-power-bi, P6) sobre as mesmas tabelas do BI. Antes esta tela
 * tinha "98 motoristas", "392.944 km" e "nota 68" escritos no código, e a lista
 * real aparecia com km, consumo e nota vazios.
 *
 * Saíram as colunas sem fonte (piloto automático, freio motor, pressão do
 * acelerador): não há dado para elas, e estrela vazia em toda linha parecia
 * nota ruim.
 */

type Periodo = "30d" | "mes" | "mes_anterior";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Fim sempre em ontem: a tabela consolidada nunca tem o dia corrente. */
function datasDo(p: Periodo): { inicio?: string; fim?: string; rotulo: string } {
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  if (p === "mes") {
    const ini = new Date(ontem.getFullYear(), ontem.getMonth(), 1);
    return { inicio: iso(ini), fim: iso(ontem), rotulo: ini.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  }
  if (p === "mes_anterior") {
    const ini = new Date(ontem.getFullYear(), ontem.getMonth() - 1, 1);
    const fim = new Date(ontem.getFullYear(), ontem.getMonth(), 0);
    return { inicio: iso(ini), fim: iso(fim), rotulo: ini.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) };
  }
  return { rotulo: "últimos 30 dias" };
}

const nf = (v: number | null | undefined, casas = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const pct = (v: number | null | undefined) => (v == null ? "—" : `${nf(v, 1)}%`);

/** Mesmos cortes das estrelas do BI. */
const notaTone = (n: number | null): PillTone => (n == null ? "neutral" : n >= 80 ? "green" : n >= 60 ? "gold" : "coral");

const eventosHora = (m: MotoristaRankingApi) => {
  const e = m.eventos_por_hora;
  return (e.aceleracao_brusca ?? 0) + (e.freada_brusca ?? 0) + (e.velocidade_excessiva ?? 0) + (e.embreagem ?? 0);
};

const COLUNAS: Column<MotoristaRankingApi>[] = [
  {
    key: "posicao",
    header: "#",
    align: "center",
    render: (m) => <span className="font-mono text-[13px] font-bold text-muted-foreground">{m.posicao ?? "—"}</span>,
  },
  {
    key: "nome",
    header: "Motorista",
    render: (m) => (
      <div className="max-w-[320px]">
        <div className="truncate font-semibold text-foreground" title={m.nome ?? undefined}>
          {m.nome ?? `Motorista ${m.driver_id}`}
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">id {m.driver_id}</div>
      </div>
    ),
  },
  {
    key: "pontuacao",
    header: "Nota",
    align: "center",
    render: (m) =>
      m.pontuacao == null ? (
        <span className="text-[12px] text-muted-foreground" title="Sem faixas de condução no período">
          sem faixas
        </span>
      ) : (
        <Pill tone={notaTone(m.pontuacao)}>{nf(m.pontuacao, 2)}</Pill>
      ),
  },
  {
    key: "estrelas",
    header: "Estrelas",
    align: "center",
    render: (m) => <StarRating value={m.pontuacao == null ? null : m.estrelas} />,
  },
  { key: "km", header: "Km", align: "right", render: (m) => <span className="font-mono">{nf(m.km)}</span> },
  { key: "horas", header: "Horas", align: "right", render: (m) => <span className="font-mono">{nf(m.horas, 1)}</span> },
  { key: "kml", header: "Km/l", align: "right", render: (m) => <span className="font-mono">{nf(m.kml, 2)}</span> },
  { key: "verde", header: "Verde", align: "right", render: (m) => <span className="font-mono">{pct(m.faixas.verde)}</span> },
  { key: "inercia", header: "Inércia", align: "right", render: (m) => <span className="font-mono">{pct(m.faixas.inercia)}</span> },
  { key: "amarela", header: "Amarela", align: "right", render: (m) => <span className="font-mono">{pct(m.faixas.amarela)}</span> },
  { key: "vermelha", header: "Vermelha", align: "right", render: (m) => <span className="font-mono">{pct(m.faixas.vermelha)}</span> },
  {
    key: "parado",
    header: "Parado ligado",
    align: "right",
    render: (m) => <span className="font-mono">{pct(m.faixas.parado_ligado)}</span>,
  },
  {
    key: "eventos",
    header: "Eventos/h",
    align: "right",
    render: (m) => (
      <span
        className="font-mono"
        title={`Aceleração ${nf(m.eventos_por_hora.aceleracao_brusca, 2)} · Freada ${nf(m.eventos_por_hora.freada_brusca, 2)} · Velocidade ${nf(m.eventos_por_hora.velocidade_excessiva, 2)} · Embreagem ${nf(m.eventos_por_hora.embreagem, 2)}`}
      >
        {nf(eventosHora(m), 2)}
      </span>
    ),
  },
  {
    key: "cnh",
    header: "CNH",
    align: "center",
    render: (m) => {
      const st = statusCNH(m.cnh_validade);
      if (st === "sem_informacao")
        return <span className="whitespace-nowrap text-[12px] text-muted-foreground">não informada</span>;
      return (
        <Pill tone={CNH_TONE[st]}>
          {exigeAtencao(st) && <AlertTriangle className="h-3 w-3" />}
          {prazoCNH(m.cnh_validade)}
        </Pill>
      );
    },
  },
];

export default function Motoristas() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [busca, setBusca] = useState("");
  const datas = datasDo(periodo);
  const q = useQuery(rankingMotoristasQuery(datas.inicio, datas.fim));

  const todos = q.data?.motoristas ?? [];
  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo
      ? todos.filter((m) => (m.nome ?? "").toLowerCase().includes(termo) || String(m.driver_id).includes(termo))
      : todos;
  }, [todos, busca]);

  // Relevo dos últimos 30 dias por motorista, com o gráfico ao clicar.
  const relevo = useRelevoDaTabela();
  const [relevoDe, setRelevoDe] = useState<{ id: string; nome: string } | null>(null);
  const colunas = useMemo(() => {
    const col: Column<MotoristaRankingApi> = {
      key: "relevo",
      header: "Relevo",
      align: "center",
      render: (m) => {
        const x = relevo.porMotorista.get(m.driver_id);
        return (
          <CelulaRelevo
            valor={x?.subida_por_100km}
            km={x?.km}
            calculando={relevo.calculando}
            progresso={relevo.progresso}
            onClick={() => setRelevoDe({ id: String(m.driver_id), nome: m.nome ?? String(m.driver_id) })}
          />
        );
      },
    };
    const i = COLUNAS.findIndex((c) => c.key === "kml");
    return [...COLUNAS.slice(0, i + 1), col, ...COLUNAS.slice(i + 1)];
  }, [relevo.porMotorista, relevo.calculando, relevo.progresso]);

  const r = q.data?.resumo;
  const comNota = todos.filter((m) => m.pontuacao != null).length;
  const cnhAtencao = todos.filter((m) => exigeAtencao(statusCNH(m.cnh_validade))).length;
  const periodoTexto = q.data
    ? `${new Date(q.data.inicio + "T12:00").toLocaleDateString("pt-BR")} a ${new Date(q.data.fim + "T12:00").toLocaleDateString("pt-BR")}`
    : datas.rotulo;

  return (
    <>
      <PageHeader
        title="Motoristas"
        subtitle={`Ranking pela pontuação do BI · ${periodoTexto}`}
        actions={
          <button
            onClick={() => navigate("/app/motoristas/novo")}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Users className="h-[15px] w-[15px]" />
            Novo motorista
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Equipe · Ranking de condução"
          title={r ? `${nf(r.motoristas)} motoristas com viagem no período` : q.isPending ? "Carregando motoristas…" : "Motoristas"}
          subtitle="Pontuação do Power BI: cada faixa e cada evento por hora, multiplicados pelo peso cadastrado em Metas e Pesos."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value={nf(r?.km_total)} unit="km" label="Rodados no período" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value={nf(r?.nota_media, 2)} label="Nota média" />
          </div>
        </HeroBanner>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Users} label="Com nota" value={nf(comNota)} color="var(--brand-navy)" />
          <StatTile icon={Star} label="Nota média" value={nf(r?.nota_media, 2)} color="var(--gold)" />
          <StatTile icon={AlertTriangle} label="CNH vencida ou a vencer" value={nf(q.data ? cnhAtencao : null)} color="var(--coral)" />
          <StatTile
            icon={Clock}
            label="Horas sem motorista identificado"
            value={r?.pct_horas_nao_identificado == null ? "—" : pct(r.pct_horas_nao_identificado)}
            color="var(--brand-sky)"
          />
        </div>

        {r && !r.pesos_cadastrados && (
          <div className="rounded-xl border border-gold-line bg-gold-tint/50 px-4 py-3 text-[13px] text-gold">
            <strong>Sem pesos cadastrados em Metas e Pesos</strong> para esta empresa. Sem peso, a pontuação sai zero
            para todos — cadastre os pesos para o ranking ter sentido.
          </div>
        )}

        <Card
          title="Ranking dos motoristas"
          icon={Award}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome ou id"
                  className="h-8 w-48 rounded-full border border-border bg-white pl-8 pr-3 text-[12.5px]"
                />
              </div>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as Periodo)}
                className="h-8 rounded-full border border-border bg-white px-3 text-[12.5px]"
              >
                <option value="30d">Últimos 30 dias</option>
                <option value="mes">Mês atual</option>
                <option value="mes_anterior">Mês anterior</option>
              </select>
              <Pill tone="sky">{nf(lista.length)} motoristas</Pill>
            </div>
          }
          bodyClassName="p-4"
        >
          {q.error ? (
            <p className="py-8 text-center text-sm text-coral">
              Não foi possível carregar o ranking: {(q.error as Error).message}
            </p>
          ) : q.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Calculando a pontuação de cada motorista…</p>
          ) : !lista.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum motorista com viagem no período.</p>
          ) : (
            <DataTable
              columns={colunas}
              rows={lista}
              onRowClick={(m) => m.nome && navigate(`/app/motoristas/perfil/${encodeURIComponent(m.nome)}`)}
            />
          )}
        </Card>

        <p className="flex items-center justify-center gap-1.5 py-4 text-center text-xs text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          Faixas sobre a soma das 13 faixas; eventos por hora trabalhada; motorista não identificado fora do ranking.
        </p>
      </div>
      {relevoDe && <RelevoDetalhe tipo="motorista" id={relevoDe.id} nome={relevoDe.nome} onClose={() => setRelevoDe(null)} />}
    </>
  );
}
