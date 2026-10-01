import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useResumoFrota } from "@/hooks/use-resumo-frota";
import type { SaudeFrotaApi } from "@/lib/api";
import { alarmesNaoVisualizadosQuery, eventosApiQuery, rankingMotoristasQuery, saudeFrotaQuery } from "@/lib/queries";
import { useSessao } from "@/hooks/use-sessao";
import { usandoMock } from "@/lib/modo";
import type { ResumoOperacao } from "@/types";
import { Link, useNavigate } from "@/lib/router-compat";
import { ordensQuery } from "@/lib/queries";
import { usePreventivaFrota } from "@/hooks/use-preventiva-frota";
import { ContratoDoCliente } from "@/components/ss/contrato/ContratoDoCliente";
import {
  AlertTriangle,
  ArrowDownRight,
  CalendarClock,
  FileWarning,
  Package,
  Wrench,
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Fuel,
  Gauge,
  MapPin,
  RefreshCw,
  ShieldAlert,
  Truck,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { SSOrb } from "@/components/ss/brand/SSOrb";
import { Sparkline } from "@/components/ss/ui/Sparkline";

/**
 * Tela de Início — dashboard operacional da frota.
 *
 * Mesmo conteúdo do wireframe do cliente, mas estilizado na linguagem da marca:
 * abertura em gradiente navy com o orb e a história de valor (economia/ROI),
 * KPIs com tendência, e um bloco de eventos críticos com peso visual real.
 *
 * Todos os valores são de exemplo — o back-end em Python entra no lugar deles.
 */

type Trend = "up" | "down";

type Kpi = {
  icon: LucideIcon;
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  trend?: Trend;
  good?: boolean;
  spark?: number[];
  color: string;
  to?: string;
};

const nf = (v: number, digits = 0) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);

/** Monta os KPIs da tela a partir do resumo real da API. */
function buildKpis(r: ResumoOperacao): Kpi[] {
  return [
    { icon: Truck, label: "Veículos ativos", value: nf(r.veiculosAtivos), color: "var(--leaf)", to: "/app/veiculos" },
    { icon: Zap, label: "Alertas abertos", value: nf(r.alertasAbertos), color: "var(--brand-sky)", to: "/app/alertas" },
    { icon: Gauge, label: "Disponibilidade", value: nf(r.disponibilidade, 1), unit: "%", color: "#6A4FA0" },
    {
      icon: Fuel,
      label: "Consumo médio",
      // Traço quando não há medição. Zero seria lido como consumo aferido, e
      // frota nenhuma roda a 0 km/l.
      value: r.consumoMedio != null ? nf(r.consumoMedio, 2) : "—",
      unit: r.consumoMedio != null ? "km/l" : undefined,
      color: "var(--brand-green)",
      to: "/app/estrategico",
    },
    {
      icon: Gauge,
      label: "Custo por km",
      value: r.custoPorKm != null ? `R$ ${nf(r.custoPorKm, 2)}` : "—",
      color: "var(--gold)",
    },
  ].filter(
    // Custo por km só aparece quando há valor: depende de custo operacional,
    // que ainda não é exposto pela API. Mostrar zero pareceria frota de graça.
    (k) => k.label !== "Custo por km" || (r.custoPorKm ?? 0) > 0,
  );
}

/**
 * Ícone por tipo de evento.
 *
 * A lista de eventos vem da API; o mapa aqui só decide o desenho. Tipo sem
 * entrada usa o genérico — melhor que esconder um evento por não ter ícone.
 */
const ICONE_EVENTO: Record<string, typeof Gauge> = {
  speeding: Gauge,
  excesso_velocidade: Gauge,
  fence: MapPin,
  cerca: MapPin,
  geofence: MapPin,
  panic: ShieldAlert,
  panico: ShieldAlert,
};

export default function Inicio() {
  // Composto a partir de veículos, posições, eventos e indicadores — não há
  // endpoint que devolva o resumo pronto.
  const { resumo, carregando: isPending, erro: error, recarregar } = useResumoFrota();
  const refetch = recarregar;
  const isFetching = false;

  const kpis = resumo ? buildKpis(resumo) : [];

  return (
    <>
      <PageHeader
        title="Início"
        subtitle="Visão geral da frota"
        actions={
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary disabled:opacity-60"
          >
            <RefreshCw className={`h-[15px] w-[15px] ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroValue />

        {/* KPIs operacionais — dados reais da API. */}
        <section>
          <SectionLabel>Operação · dados em tempo real</SectionLabel>

          {error ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-4 rounded-2xl border border-coral-line bg-coral-tint px-5 py-4 text-sm text-coral"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Não foi possível carregar os KPIs: {(error as Error).message}
              </span>
              <button
                onClick={() => refetch()}
                className="shrink-0 rounded-full bg-coral px-4 py-1.5 text-xs font-semibold text-white"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
              {isPending
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[118px] animate-pulse rounded-2xl border border-border bg-secondary/60 shadow-card"
                    />
                  ))
                : kpis.map((k) => <KpiCard key={k.label} {...k} />)}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <PlanoCard />
          <PendenciasCard />
        </div>

        <CriticalCard />

        {/* Manutenção e contrato ficam abaixo dos eventos críticos: o que exige
            ação imediata vem primeiro, e estes são consulta. */}
        <section>
          <SectionLabel>Manutenção · situação da frota</SectionLabel>
          <CardsManutencao />
        </section>

        <ContratoDoCliente />
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      <span className="inline-block h-px w-4 bg-current opacity-50" />
      {children}
    </p>
  );
}

/**
 * Abertura: gradiente navy, orb e os números do período.
 *
 * Antes: "Sua frota economizou R$ 48.200", "ROI 3,4x", "Payback 4,2" e "Bom dia,
 * Douglas" — tudo escrito no código, igual para qualquer cliente e qualquer
 * usuário. Não há cálculo de economia nem de ROI no backend ou no vault, então
 * saíram; no lugar, o que o ranking de motoristas já mede de verdade.
 */
function HeroValue() {
  const { sessao } = useSessao();
  const q = useQuery(rankingMotoristasQuery());
  const r = q.data?.resumo;
  const h = new Date().getHours();
  const saudacao = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = (sessao?.nome ?? "").split(" ")[0];
  const fmt = (v: number | null | undefined, casas = 0) =>
    v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

  if (usandoMock()) return <HeroValueExemplo />;

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-hero p-6 text-white shadow-elegant md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, var(--brand-sky), transparent 68%)" }}
      />
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <SSOrb size={72} halo className="text-brand-green" />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">
              {saudacao}
              {primeiroNome ? `, ${primeiroNome}` : ""}
            </p>
            <h2 className="mt-1 max-w-md text-2xl font-bold leading-tight md:text-[28px]">
              {r ? (
                <>
                  <span className="text-brand-green">{fmt(r.km_total)} km</span> rodados nos últimos 30 dias.
                </>
              ) : q.isPending ? (
                "Carregando o período…"
              ) : q.error ? (
                // Erro não é "sem viagens": dizer isso faria a frota parecer parada.
                "Não foi possível carregar o período."
              ) : (
                "Sem viagens no período."
              )}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <HeroMetric value={fmt(r?.motoristas)} label="Motoristas com viagem" foot="últimos 30 dias" />
          <HeroMetric value={fmt(r?.nota_media, 1)} label="Nota média" foot="pontuação do BI" />
          <HeroMetric
            value={r?.pct_horas_nao_identificado == null ? "—" : `${fmt(r.pct_horas_nao_identificado, 1)}%`}
            label="Horas sem motorista"
            foot="não identificado"
          />
        </div>
      </div>
    </section>
  );
}

/** A abertura de demonstração, só com dados de exemplo ligados (sem API). */
function HeroValueExemplo() {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-hero p-6 text-white shadow-elegant md:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full opacity-40"
        style={{ background: "radial-gradient(circle, var(--brand-sky), transparent 68%)" }}
      />
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <SSOrb size={72} halo className="text-brand-green" />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">
              Bom dia, Douglas
            </p>
            <h2 className="mt-1 max-w-md text-2xl font-bold leading-tight md:text-[28px]">
              Sua frota economizou <span className="text-brand-green">R$ 48.200</span> este mês.
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 border-t border-white/10 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <HeroMetric value="R$ 48,2k" label="Economia no mês" foot="+12% vs. anterior" />
          <HeroMetric value="3,4x" label="ROI real" foot="sobre a telemetria" />
          <HeroMetric value="4,2" label="Payback (meses)" foot="retorno estimado" />
        </div>
      </div>
    </section>
  );
}

function HeroMetric({ value, label, foot }: { value: string; label: string; foot: string }) {
  return (
    <div>
      <div className="font-display text-2xl font-bold tabular-nums md:text-[28px]">{value}</div>
      <div className="mt-1 text-[12px] font-medium text-white/80">{label}</div>
      <div className="mt-0.5 text-[11px] text-white/50">{foot}</div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  delta,
  trend,
  good,
  spark,
  color,
  to,
}: Kpi) {
  const TrendIcon = trend === "down" ? ArrowDownRight : ArrowUpRight;
  const cls =
    "group block rounded-2xl border border-border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-[#cdd7e2]";
  const content = (
    <>
      <div className="mb-3 flex items-center justify-between">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: `color-mix(in oklab, ${color} 14%, white)` }}
        >
          <Icon className="h-[17px] w-[17px]" style={{ color }} />
        </div>
        {delta && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10.5px] font-semibold"
            style={{
              color: good ? "var(--leaf)" : "var(--gold)",
              background: good ? "var(--leaf-tint)" : "var(--gold-tint)",
            }}
          >
            <TrendIcon className="h-3 w-3" />
            {delta}
          </span>
        )}
      </div>
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-end justify-between gap-2">
        <p className="font-display text-[26px] font-bold leading-none tabular-nums">
          {value}
          {unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
        </p>
        {spark && <Sparkline data={spark} color={color} />}
      </div>
    </>
  );
  return to ? (
    <Link to={to} className={cls}>
      {content}
    </Link>
  ) : (
    <div className={cls}>{content}</div>
  );
}

/** Plano contratado com anel de performance. */
function PlanoCard() {
  const saude = useSaudeFrota();

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card lg:col-span-2">
      <div className="mb-5 flex items-center justify-between">
        <div>
          {/* "Plano contratado · Plano Performance · Ativo" era texto fixo —
              não há cadastro de plano no backend. O cartão mostra a saúde
              da frota (cascata T11/DS-1511), e o título agora diz isso. */}
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            Saúde da frota
          </p>
          <p className="mt-1 text-xl font-bold">Unidades sem ponto de atenção</p>
        </div>
        {usandoMock() && (
          <span className="rounded-full bg-leaf-tint px-3 py-1 text-[11px] font-semibold text-leaf">Ativo</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-6 sm:flex-row sm:items-center">
        {/* Sem índice, o anel some: um anel vazio seria lido como zero, e
            zero significa frota crítica — o oposto de "não avaliado". */}
        {saude.indice != null ? (
          <Donut value={saude.indice} />
        ) : (
          <div className="flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-full border-4 border-dashed border-border text-[12px] text-muted-foreground">
            sem índice
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold">{saude.titulo}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{saude.descricao}</p>
          <Link
            to="/app/gerencial/indicadores"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-navy hover:text-brand-blue"
          >
            Ver dashboard completo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Disparos do Monitor de Alarmes não visualizados nas últimas 24 h.
 *
 * O número era um 27 fixo no código. Agora vem de `alarm_violation`, com a
 * regra do monitor do sistema atual. A janela de 24 h é decisão de produto: o
 * total em aberto passa de dez mil e não permite "revisar agora" — por isso o
 * rótulo diz a janela, para não ser confundido com o total do monitor antigo.
 */
function PendenciasCard() {
  const navigate = useNavigate();
  const q = useQuery(alarmesNaoVisualizadosQuery(24));
  const valor = usandoMock()
    ? "27"
    : q.isPending
      ? "…"
      : q.error || q.data == null
        ? "—"
        : nf(q.data.nao_visualizados);
  const rotulo = usandoMock()
    ? "eventos pendentes de revisão"
    : q.error
      ? "não foi possível carregar os alarmes"
      : `alarmes não visualizados nas últimas ${q.data?.janela_horas ?? 24} h`;

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          Não visualizados
        </p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-tint">
          <Bell className="h-4 w-4 text-gold" />
        </div>
      </div>

      <p className="font-display text-5xl font-bold tabular-nums">{valor}</p>
      <p className="mt-1 text-sm text-muted-foreground">{rotulo}</p>

      <button
        onClick={() => navigate("/app/eventos")}
        className="mt-auto flex items-center justify-center gap-2 rounded-full bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
      >
        Revisar agora
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Eventos críticos — o bloco de maior urgência da tela. */
/**
 * Saúde da frota, calculada.
 *
 * O número era fixo em 91 e nunca mudava — o que é pior que não mostrar, porque
 * dá a impressão de que o sistema está medindo algo. Agora sai da preventiva:
 * cada veículo começa em 100 e perde pontos por pendência, ponderado pelo peso
 * de cada situação.
 */
function useSaudeFrota() {
  /**
   * Saúde da frota, calculada pelo servidor.
   *
   * Eu havia inventado um índice ponderado sobre manutenção preventiva. A
   * regra de produção mede outra coisa: qualidade de sinal e comportamento de
   * condução, numa cascata de catorze condições — e o resultado não tem
   * relação com o que eu calculava.
   */
  const q = useQuery(saudeFrotaQuery());

  const daApi = q.data as SaudeFrotaApi | undefined;
  if (daApi) {
    const motivos = Object.entries(daApi.por_motivo).slice(0, 2);
    return {
      indice: daApi.percentual_saudavel,
      titulo:
        daApi.percentual_saudavel == null
          ? "Sem unidades avaliáveis"
          : daApi.percentual_saudavel >= 90
            ? "Frota em boas condições"
            : daApi.percentual_saudavel >= 75
              ? "Frota com pontos de atenção"
              : "Frota exige verificação",
      descricao: daApi.percentual_saudavel == null
        ? `Nenhuma unidade operou o suficiente em ${daApi.referencia ?? "—"} para ser avaliada. A regra exige mais de uma hora e mais de um quilômetro.`
        : `${daApi.unidades_saudaveis} de ${daApi.total_unidades} unidades sem apontamento em ${daApi.referencia}.` +
          (motivos.length
            ? ` Principais causas: ${motivos.map(([m, n]) => `${m.toLowerCase()} (${n})`).join(", ")}.`
            : ""),
    };
  }

  const { porVeiculo } = usePreventivaFrota();

  return useMemo(() => {
    if (!porVeiculo.length) {
      return { indice: null, titulo: "Sem dados de frota", descricao: "Nenhum veículo cadastrado ainda." };
    }

    /**
     * Só veículos com plano entram no índice.
     *
     * Antes, veículo sem catálogo contava 100 — "não é culpa dele". Mas o
     * efeito era pior que a intenção: com a frota inteira sem parâmetro
     * cadastrado, o índice dava 100% e dizia que estava tudo bem quando na
     * verdade nada estava sendo medido.
     *
     * Não avaliado é diferente de aprovado.
     *
     * Peso por situação: vencida pesa mais que próxima porque já passou do
     * limite do fabricante — é risco presente, não futuro.
     */
    const avaliaveis = porVeiculo.filter((v) => !v.semCatalogo);
    const notas = avaliaveis.map((v) => {
      const vencidas = v.preventivas.filter((p) => p.urgencia === "vencida").length;
      const criticas = v.preventivas.filter((p) => p.urgencia === "critica").length;
      const proximas = v.preventivas.filter((p) => p.urgencia === "proxima").length;
      return Math.max(0, 100 - vencidas * 25 - criticas * 12 - proximas * 5);
    });

    // Sem nenhum veículo avaliável não há índice — e zero seria lido como
    // frota em situação crítica, que é o oposto do que se sabe.
    const indice = notas.length
      ? Math.round(notas.reduce((a, n) => a + n, 0) / notas.length)
      : null;
    const vencidasTotal = porVeiculo.reduce(
      (a, v) => a + v.preventivas.filter((p) => p.urgencia === "vencida").length,
      0,
    );
    const semCatalogo = porVeiculo.filter((v) => v.semCatalogo).length;

    if (indice == null) {
      return {
        indice: null,
        titulo: "Frota sem plano de manutenção",
        descricao: `Nenhum dos ${porVeiculo.length} veículos tem parâmetro de fabricante cadastrado, então não há o que avaliar. Cadastre o catálogo em Administração › Catálogo de manutenção.`,
      };
    }

    const titulo =
      indice >= 90 ? "Frota em boas condições"
      : indice >= 75 ? "Frota com pendências pontuais"
      : indice >= 50 ? "Frota exige atenção"
      : "Frota em situação crítica";

    const partes: string[] = [];
    if (vencidasTotal) partes.push(`${vencidasTotal} manutenção${vencidasTotal > 1 ? "ões" : ""} vencida${vencidasTotal > 1 ? "s" : ""}`);
    if (semCatalogo) partes.push(`${semCatalogo} veículo${semCatalogo > 1 ? "s" : ""} sem parâmetro cadastrado`);

    const descricao = partes.length
      ? `Índice sobre ${notas.length} de ${porVeiculo.length} veículos com plano. ${partes.join(" e ")} — os cartões de manutenção abaixo detalham.`
      : `Índice sobre ${notas.length} de ${porVeiculo.length} veículos com plano, sem manutenção vencida no momento.`;

    return { indice, titulo, descricao };
  }, [porVeiculo]);
}

function CriticalCard() {
  /**
   * Eventos críticos de hoje, agrupados por tipo.
   *
   * O cartão mostrava "6" escrito no código, com três tipos fixos — e o
   * resumo acima já lia os eventos reais da API. As duas contagens
   * discordavam na mesma tela, o que corrói a confiança em tudo que está
   * ao redor.
   */
  const criticosQ = useQuery(eventosApiQuery({ severity: "critical", limit: 200 }));

  const { totalCriticos, porTipo } = useMemo(() => {
    const itens = ((criticosQ.data as { items?: { event_type?: string }[] } | undefined)?.items ?? []);
    const total = itens.length;

    const contagem = new Map<string, number>();
    for (const e of itens) {
      const t = (e.event_type ?? "outro").toLowerCase();
      contagem.set(t, (contagem.get(t) ?? 0) + 1);
    }

    const lista = [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      // Três é o que cabe na faixa sem apertar; o total acima já dá o número
      // completo.
      .slice(0, 3)
      .map(([tipo, count]) => ({
        label: tipo.replace(/_/g, " "),
        count,
        pct: total ? Math.round((count / total) * 100) : 0,
        icon: ICONE_EVENTO[tipo] ?? AlertTriangle,
      }));

    return { totalCriticos: total, porTipo: lista };
  }, [criticosQ.data]);

  const navigate = useNavigate();
  return (
    <section className="overflow-hidden rounded-2xl border border-coral-line bg-card shadow-card">
      <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
        <div className="flex shrink-0 items-center gap-4 lg:w-64">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-coral-tint">
            <AlertTriangle className="h-6 w-6 text-coral" />
            <span className="pulse-dot absolute -right-1 -top-1" />
          </div>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-coral">
              Eventos críticos hoje
            </p>
            <p className="font-display text-5xl font-bold leading-none tabular-nums">
              {criticosQ.isPending ? "—" : nf(totalCriticos)}
            </p>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
          {porTipo.length === 0 && !criticosQ.isPending && (
            <p className="col-span-full self-center text-[12.5px] text-muted-foreground">
              Nenhum evento crítico hoje.
            </p>
          )}
          {porTipo.map((c) => (
            <div key={c.label} className="rounded-xl bg-secondary/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <c.icon className="h-4 w-4 text-coral" />
                <span className="flex-1 text-xs font-medium text-ink-soft">{c.label}</span>
                <span className="font-display text-lg font-bold tabular-nums">{c.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-coral-tint">
                <div className="h-1.5 rounded-full bg-coral" style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate("/app/eventos")}
          className="shrink-0 rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
        >
          Ver eventos críticos
        </button>
      </div>
    </section>
  );
}

/** Medidor circular de performance. */
function Donut({ value }: { value: number }) {
  const r = 15.5;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / 100);
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--secondary)" strokeWidth="3.5" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke="url(#donut-grad)"
          strokeWidth="3.5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="donut-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-sky)" />
            <stop offset="100%" stopColor="var(--brand-navy)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-xl font-bold leading-none">{value}%</span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">índice</span>
      </div>
    </div>
  );
}

/* ------------------------------- Manutenção ------------------------------- */

/**
 * Situação da manutenção na abertura do sistema.
 *
 * Os números vêm do mesmo motor que alimenta o quadro e a aba de plano
 * preventivo — não são um resumo à parte que poderia divergir. Cada card leva
 * para a tela com o filtro já aplicado, para o gestor não ter que reencontrar
 * o que acabou de ver.
 */
function CardsManutencao() {
  const navigate = useNavigate();
  const { porVeiculo, carregando } = usePreventivaFrota();
  const ordensQ = useQuery(ordensQuery());

  const todas = porVeiculo.flatMap((p) => p.preventivas);
  const vencidas = todas.filter((p) => p.urgencia === "vencida").length;
  const criticas = todas.filter((p) => p.urgencia === "critica" || p.urgencia === "proxima").length;
  const semCatalogo = porVeiculo.filter((p) => p.semCatalogo).length;

  const ordens = ordensQ.data ?? [];
  const corretivas = ordens.filter((o) => o.tipo === "corretiva" && o.status !== "concluida" && o.status !== "cancelada").length;
  const aguardandoPeca = ordens.filter((o) => o.status === "aguardando_peca").length;

  const cards = [
    {
      label: "Preventivas vencidas",
      valor: vencidas,
      icone: AlertTriangle,
      cor: "var(--coral)",
      nota: "passaram do intervalo do fabricante",
      destino: "/app/manutencao",
    },
    {
      label: "Preventivas próximas",
      valor: criticas,
      icone: CalendarClock,
      cor: "var(--gold)",
      nota: "acima de 75% do intervalo",
      destino: "/app/manutencao",
    },
    {
      label: "Corretivas abertas",
      valor: corretivas,
      icone: Wrench,
      cor: "var(--coral)",
      nota: "ordens de serviço em aberto",
      destino: "/app/manutencao/ordens",
    },
    {
      label: "Aguardando peça",
      valor: aguardandoPeca,
      icone: Package,
      cor: "var(--brand-sky)",
      nota: "veículo parado esperando material",
      destino: "/app/manutencao/ordens",
    },
    {
      label: "Sem parâmetro",
      valor: semCatalogo,
      icone: FileWarning,
      cor: semCatalogo ? "var(--gold)" : "var(--leaf)",
      nota: "modelo sem catálogo configurado",
      destino: "/app/admin/catalogo",
    },
  ];

  if (carregando) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="h-[104px] animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-5">
      {cards.map((c) => (
        <button
          key={c.label}
          onClick={() => navigate(c.destino)}
          className="rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant"
        >
          <span className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ background: `color-mix(in oklab, ${c.cor} 14%, white)` }}
            >
              <c.icone className="h-4 w-4" style={{ color: c.cor }} />
            </span>
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {c.label}
            </span>
          </span>
          <span className="mt-2 block font-display text-[26px] font-bold leading-none" style={{ color: c.valor > 0 ? c.cor : "var(--foreground)" }}>
            {c.valor}
          </span>
          <span className="mt-1 block text-[11px] leading-tight text-muted-foreground">{c.nota}</span>
        </button>
      ))}
    </div>
  );
}
