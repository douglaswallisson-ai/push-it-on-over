import { Link } from "@/lib/router-compat";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  Clock,
  Fuel,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { SSOrb } from "@/components/ss/brand/SSOrb";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { cn } from "@/lib/utils";

/**
 * IA Fleet Manager — a Selma. Painel de AÇÃO: lê a telemetria e diz o que fazer
 * agora, por que, e qual o retorno. Estrutura e lógica herdadas do protótipo de
 * IA Fleet Manager, reescritas no design system da SS. Dados de exemplo,
 * anonimizados. (Selma como avatar da IA; a foto dela substitui o orb quando
 * disponível.)
 */

type Sev = "crit" | "high" | "med";
type Cat = "motoristas" | "combustivel" | "manutencao" | "operacao";

const CAT: Record<Cat, { label: string; color: string; bg: string }> = {
  motoristas: { label: "Motoristas", color: "var(--brand-blue)", bg: "var(--navy-tint)" },
  combustivel: { label: "Combustível", color: "var(--leaf)", bg: "var(--leaf-tint)" },
  manutencao: { label: "Manutenção", color: "var(--gold)", bg: "var(--gold-tint)" },
  operacao: { label: "Operação", color: "#6A4FA0", bg: "#EDE7F6" },
};

const SEV: Record<Sev, { tone: PillTone; text: string; bg: string; border: string }> = {
  crit: { tone: "coral", text: "text-coral", bg: "bg-coral-tint", border: "border-coral-line" },
  high: { tone: "gold", text: "text-gold", bg: "bg-gold-tint", border: "border-gold-line" },
  med: { tone: "green", text: "text-leaf", bg: "bg-leaf-tint", border: "border-leaf-line" },
};

type Acao = {
  n: number;
  sev: Sev;
  titulo: string;
  desc: string;
  tags: Cat[];
  impacto: { valor: string; label: string; sub?: string; cor: string };
  roi: { chip: string; tone: "green" | "gold"; prazo: string };
};

const ACOES: Acao[] = [
  {
    n: 1,
    sev: "crit",
    titulo: "Retreinar 16 motoristas com condução ideal abaixo de 65,3%",
    desc: "Média da frota: 72,6%. Esses motoristas operam bem abaixo do benchmark, impactando diretamente o consumo e a segurança.",
    tags: ["motoristas", "combustivel"],
    impacto: { valor: "+8%", label: "Meta de condução ideal", sub: "72,6% → 78,4%", cor: "var(--leaf)" },
    roi: { chip: "↑ km/L direto", tone: "green", prazo: "Prazo: Abr/2026" },
  },
  {
    n: 2,
    sev: "crit",
    titulo: "Reduzir horas não identificadas: 22,2% → meta ≤15%",
    desc: "5.970h não identificadas só em Fev/26. A condução ideal dos não identificados é 66% (vs 72,6% da frota) e a aceleração parado é 420% pior. Sem identificação, não há ação corretiva possível.",
    tags: ["operacao", "motoristas"],
    impacto: { valor: "−6,5pp", label: "Impacto na condução ideal", sub: "os não identificados puxam a frota para baixo", cor: "var(--coral)" },
    roi: { chip: "66.030h/ano", tone: "gold", prazo: "Prazo: Abr/2026" },
  },
  {
    n: 3,
    sev: "crit",
    titulo: "Reverter o aumento da aceleração parado: 0,23% → meta ≤0,09%",
    desc: "Alta de 164% (Fev/25 → Fev/26). Motoristas não identificados registram 1,04% — 5x pior que a média. Desperdício direto de combustível e desgaste mecânico.",
    tags: ["combustivel", "manutencao"],
    impacto: { valor: "+164%", label: "Deterioração vs 2025", cor: "var(--coral)" },
    roi: { chip: "Reduz desgaste", tone: "gold", prazo: "Prazo: Mai–Jun/2026" },
  },
  {
    n: 4,
    sev: "high",
    titulo: "Investigar veículos com km/L não confiável",
    desc: "O km/L médio em 2026 está levemente abaixo de 2025. Veículos com leitura incorreta distorcem a média e escondem os ganhos reais.",
    tags: ["manutencao", "combustivel"],
    impacto: { valor: "−0,3%", label: "km/L Jan (ano a ano)", cor: "var(--gold)" },
    roi: { chip: "Dados limpos", tone: "gold", prazo: "Prazo: Mai–Jun/2026" },
  },
  {
    n: 5,
    sev: "high",
    titulo: "Reverter a queda em embalo e faixa verde",
    desc: "Embalo caiu 13% (37,7% → 32,8%) e a faixa verde caiu 13,5% (17,7% → 15,3%). Menos embalo significa mais combustível queimado. Precisa de treino focado e alertas em tempo real.",
    tags: ["motoristas", "combustivel"],
    impacto: { valor: "−13%", label: "Embalo (ano a ano)", cor: "var(--coral)" },
    roi: { chip: "↑ km/L", tone: "green", prazo: "Prazo: Mai–Jun/2026" },
  },
  {
    n: 6,
    sev: "high",
    titulo: "Reduzir motor ligado parado de 17,9% para ≤15%",
    desc: "Melhorou 16,2% no período (21,3% → 17,9%), mas os não identificados operam a 22,1% — 27% pior que a frota. Combustível queimado sem deslocamento.",
    tags: ["combustivel"],
    impacto: { valor: "−16,2%", label: "Melhora no período", sub: "bom progresso — conclua", cor: "var(--leaf)" },
    roi: { chip: "Impacto km/L", tone: "green", prazo: "Meta contínua" },
  },
  {
    n: 7,
    sev: "med",
    titulo: "Controlar excesso de velocidade e freadas bruscas",
    desc: "Excesso de velocidade: +2.173% (0,05 → 1,12). Freadas bruscas: 0 → 160 eventos em Fev/26. Risco de segurança e desgaste mecânico acelerado.",
    tags: ["motoristas", "manutencao"],
    impacto: { valor: "160", label: "Freadas bruscas Fev/26", cor: "var(--coral)" },
    roi: { chip: "Segurança", tone: "gold", prazo: "Prazo: Mai–Jun/2026" },
  },
];

type Diag = { label: string; value: string; change: string; good: boolean; sub: string };
const DIAG: Diag[] = [
  { label: "Condução ideal", value: "72,6%", change: "+2,6pp", good: true, sub: "era 70,0% em Fev/25" },
  { label: "Motor ligado parado", value: "17,9%", change: "−3,5pp ✓", good: true, sub: "era 21,3% · meta 15%" },
  { label: "Extra econômico", value: "13,5%", change: "+1,5pp ✓", good: true, sub: "era 12,0% em Fev/25" },
  { label: "Embalo", value: "32,8%", change: "−4,9pp ✗", good: false, sub: "era 37,7% · queda de 13%" },
  { label: "Aceleração parado", value: "0,23%", change: "+164% ✗", good: false, sub: "era 0,09% · meta ≤0,14%" },
  { label: "Excesso de velocidade", value: "1,12", change: "+2.173% ✗", good: false, sub: "era 0,05 em Fev/25" },
];

type Driver = { status: PillTone; nome: string; ideal: string; desvio: string; irregular: string; acao: string; acaoTone: PillTone };
const DRIVERS: Driver[] = [
  { status: "coral", nome: "Motorista identificado #1", ideal: "52,1%", desvio: "−20,5pp", irregular: "47,9%", acao: "Retreino urgente + acompanhamento semanal", acaoTone: "coral" },
  { status: "coral", nome: "Motorista identificado #2", ideal: "54,3%", desvio: "−18,3pp", irregular: "45,7%", acao: "Retreino urgente + acompanhamento semanal", acaoTone: "coral" },
  { status: "coral", nome: "Motorista identificado #3", ideal: "56,8%", desvio: "−15,8pp", irregular: "43,2%", acao: "Retreino urgente", acaoTone: "coral" },
  { status: "gold", nome: "Motorista identificado #4", ideal: "58,2%", desvio: "−14,4pp", irregular: "41,8%", acao: "Treino + feedback mensal", acaoTone: "gold" },
  { status: "gold", nome: "Motorista identificado #5", ideal: "59,5%", desvio: "−13,1pp", irregular: "40,5%", acao: "Treino + feedback mensal", acaoTone: "gold" },
  { status: "gold", nome: "Motoristas identificados #6–16", ideal: "60–65%", desvio: "−7 a −12pp", irregular: "35–40%", acao: "Material de apoio + monitoramento", acaoTone: "gold" },
];

const DRIVER_COLS: Column<Driver>[] = [
  { key: "status", header: "", render: (d) => <span className={cn("inline-block h-2.5 w-2.5 rounded-full", d.status === "coral" ? "bg-coral" : "bg-gold")} /> },
  { key: "nome", header: "Motorista", render: (d) => <span className="font-semibold text-foreground">{d.nome}</span> },
  { key: "ideal", header: "Condução ideal", align: "right", render: (d) => <span className="font-mono">{d.ideal}</span> },
  { key: "desvio", header: "Desvio da média", align: "right", render: (d) => <span className="font-mono text-coral">{d.desvio}</span> },
  { key: "irregular", header: "Condução irregular", align: "right", render: (d) => <span className="font-mono">{d.irregular}</span> },
  { key: "acao", header: "Ação recomendada", render: (d) => <span className={cn("text-[12px] font-medium", d.acaoTone === "coral" ? "text-coral" : "text-gold")}>{d.acao}</span> },
];

const TIMELINE = [
  { data: "Abr/2026", cor: "var(--coral)", titulo: "Retreino dos motoristas abaixo de 72,6% + campanha de conscientização sobre horas não identificadas", dono: "Gestão da frota / CS SS Telemática · Prioridade: Alta" },
  { data: "Mai–Jun/26", cor: "var(--gold)", titulo: "Avaliação + manutenção dos veículos com dados não confiáveis", dono: "Suporte SS Telemática + Manutenção · Prioridade: Alta" },
  { data: "Mai–Jun/26", cor: "var(--gold)", titulo: "Monitoramento: aceleração parado, embalo e faixa verde", dono: "Gestão da frota / CS SS Telemática · Prioridade: Média" },
  { data: "Mensal", cor: "var(--brand-sky)", titulo: "Análise mensal da tendência dos KPIs + média de km/L", dono: "Gestão da frota / CS SS Telemática · Prioridade: Média" },
  { data: "Jul/2026", cor: "var(--leaf)", titulo: "Apresentação de resultados + plano estratégico do 2º semestre", dono: "CS SS Telemática / Gestão da frota · Planejamento" },
];

const METAS = [
  { label: "Condução ideal", value: "≥78,4%", sub: "atual 72,6% · meta +8%", pct: 72.6 },
  { label: "Identificação de horas", value: "≥85%", sub: "atual 77,8%", pct: 77.8 },
  { label: "Aceleração parado", value: "≤0,14%", sub: "atual 0,23%", pct: 40 },
  { label: "km/L médio", value: "+1%", sub: "mensal sobre 2025", pct: 60 },
];

export default function IAFleetManager() {
  return (
    <>
      <PageHeader
        title="IA Fleet Manager"
        subtitle="Selma · da telemetria à ação"
        actions={
          <span className="inline-flex items-center gap-2 rounded-full bg-navy-tint px-3.5 py-2 font-mono text-[11px] font-semibold text-brand-blue">
            <Zap className="h-3.5 w-3.5" />
            Jan/2025 – Fev/2026 · 14 meses
          </span>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-8 px-6 py-6 md:px-8">
        {/* Selma. */}
        <HeroBanner
          orb
          eyebrow="IA Fleet Manager · Selma"
          title="O que fazer agora."
          subtitle="Eu leio a telemetria da sua frota e devolvo as ações que geram resultado — com o porquê e o retorno de cada uma. Ações geram resultado; painéis geram relatório."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value="~21.000" unit="L" label="Economia potencial/ano" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value="16" label="Motoristas p/ retreinar" />
          </div>
        </HeroBanner>

        {/* Banner de oportunidade. */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Fuel} label="Economia potencial / ano" value="~21.000" unit="L" color="var(--leaf)" foot="combustível com meta +1% km/L" />
          <StatTile icon={Clock} label="Horas não identificadas" value="66.030" unit="h" color="var(--gold)" foot="em 2025 · oportunidade de retreino" />
          <StatTile icon={TrendingDown} label="Condução irregular" value="27,4" unit="%" color="var(--brand-navy)" foot="Fev/26 · −19,7% desde Jan/25" />
          <StatTile icon={Users} label="Motoristas p/ retreinar" value="16" color="var(--coral)" foot="abaixo de 90% da média (72,6%)" to="/app/motoristas" />
        </div>

        {/* Ações prioritárias. */}
        <section data-tour="acoes">
          <SectionTitle icon={Zap} tone="coral" title="Ações prioritárias — o que fazer agora" count={`${ACOES.length} ações`} />
          <div className="space-y-3">
            {ACOES.map((a) => (
              <ActionCard key={a.n} acao={a} />
            ))}
          </div>

          {/* Explicação da Selma. */}
          <div className="mt-5 flex gap-4 rounded-2xl border border-navy-line bg-navy-tint/50 p-5">
            <SSOrb size={40} className="text-brand-green" />
            <div>
              <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-blue">
                Por que essas ações, nessa ordem?
              </p>
              <p className="text-[13.5px] leading-relaxed text-ink-soft">
                Priorizei por <strong className="text-foreground">impacto econômico direto</strong> e{" "}
                <strong className="text-foreground">velocidade até o resultado</strong>. As ações 1 e 2 atacam as maiores
                fontes de perda hoje: motoristas com baixa condução ideal e horas não identificadas que escondem
                problemas sérios. A ação 3 resolve o indicador que mais piorou (+164%). As 4 e 5 sustentam o ganho de
                km/L — sem dado limpo e bom embalo, a economia se compromete. A ação 6 conclui um trabalho já em curso
                (−16,2%) e a 7 mitiga um risco de segurança emergente.
              </p>
            </div>
          </div>
        </section>

        {/* Projeção de ROI. */}
        <section>
          <SectionTitle icon={BarChart3} tone="green" title="Projeção de ROI — impacto econômico" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <RoiCard label="Meta de km/L mensal" value="+1%" sub="2,653 → 2,680 km/L" pct={65} color="var(--brand-sky)" />
            <RoiCard label="Economia mensal" value="2.616 L" sub="com a meta +1% aplicada" pct={45} color="var(--leaf)" />
            <RoiCard label="Economia anual projetada" value="~21.000 L" sub="Abr–Dez/2026 (9 meses)" pct={80} color="var(--leaf)" />
            <RoiCard label="Perda atual Jan–Fev/26" value="−1.216 L" sub="Jan −684 L · Fev −532 L" pct={25} color="var(--coral)" />
          </div>
          <div className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-card">
            <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-leaf">Lógica do ROI</p>
            <p className="text-[13.5px] leading-relaxed text-ink-soft">
              A frota rodou <strong className="text-foreground">600.481 km em Jan/26</strong> e{" "}
              <strong className="text-foreground">566.553 km em Fev/26</strong>. O km/L médio de 2026 está levemente
              abaixo de 2025, resultando em <strong className="text-foreground">1.216 litros a mais consumidos</strong>{" "}
              nos dois primeiros meses. Com a meta de +1% sobre cada mês de 2025, a economia projetada é de{" "}
              <strong className="text-foreground">~2.616 L/mês</strong>, totalizando{" "}
              <strong className="text-foreground">~21.000 L entre abril e dezembro/2026</strong>. A chave está nas ações
              acima: retreino, redução de motor parado e aceleração parado, e limpeza dos dados não confiáveis.
            </p>
          </div>
        </section>

        {/* Diagnóstico. */}
        <section>
          <SectionTitle icon={TrendingUp} tone="sky" title="Diagnóstico — KPIs Fev/2025 vs Fev/2026" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DIAG.map((d) => (
              <div key={d.label} className={cn("rounded-2xl border-l-4 border border-border bg-card p-4 shadow-card", d.good ? "border-l-leaf" : "border-l-coral")}>
                <p className="text-[11.5px] text-muted-foreground">{d.label}</p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-[22px] font-bold tabular-nums">{d.value}</span>
                  <span className={cn("font-mono text-[12px] font-semibold", d.good ? "text-leaf" : "text-coral")}>{d.change}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">{d.sub}</p>
              </div>
            ))}
          </div>
          <Link
            to="/app/frota/desempenho"
            className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-navy hover:text-brand-blue"
          >
            Ver desempenho por categoria da frota
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        {/* Motoristas para retreinar. */}
        <section>
          <SectionTitle icon={Users} tone="coral" title="Motoristas que precisam de retreino" count="16 abaixo de 65,3% de condução ideal" />
          <div className="mb-3 flex gap-3 rounded-2xl border border-coral-line bg-coral-tint/40 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
            <p className="text-[13px] leading-relaxed text-ink-soft">
              <strong className="text-foreground">Ação necessária.</strong> Esses 16 motoristas operam abaixo de 90% da
              média da frota (72,6%). Material de apoio da SS Telemática + programa de treino individualizado.{" "}
              <strong className="text-foreground">Responsável: Gestão da frota / CS SS Telemática · Prazo: Abr/2026.</strong>
            </p>
          </div>
          <Card icon={Users} title="Lista de retreino" bodyClassName="p-4" action={
            <Link to="/app/motoristas" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-navy hover:text-brand-blue">
              Ver motoristas <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }>
            <DataTable columns={DRIVER_COLS} rows={DRIVERS} />
          </Card>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            * Nomes anonimizados neste protótipo. No sistema, cada motorista é identificado com seu histórico e plano de ação personalizado.
          </p>
        </section>

        {/* Horas não identificadas. */}
        <section>
          <SectionTitle icon={Search} tone="gold" title="Impacto das horas não identificadas" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <UnidCard label="Condução ideal — não identificados" value="66,0%" change="−6,5pp vs frota" tone="gold" />
            <UnidCard label="Aceleração parado — não id." value="1,04%" change="+420% vs frota" tone="coral" />
            <UnidCard label="Motor parado — não identificados" value="22,1%" change="+27% vs frota" tone="coral" />
          </div>
          <div className="mt-4 flex gap-4 rounded-2xl border border-gold-line bg-gold-tint/40 p-5">
            <Search className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
            <div>
              <p className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-gold">Por que isso importa</p>
              <p className="text-[13.5px] leading-relaxed text-ink-soft">
                As <strong className="text-foreground">5.970 horas não identificadas em Fev/26</strong> representam 22,2%
                das horas totais da frota — e apresentam desempenho pior em todos os indicadores, especialmente
                aceleração parado (+420%) e motor parado (+27%). Em 2025 foram{" "}
                <strong className="text-foreground">66.030 horas não identificadas</strong>. Sem saber <em>quem</em>{" "}
                dirige, não há retreino possível. É a maior alavanca oculta de melhoria da frota.
              </p>
            </div>
          </div>
        </section>

        {/* Cronograma. */}
        <section>
          <SectionTitle icon={CalendarClock} tone="sky" title="Cronograma de execução" />
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            {TIMELINE.map((t, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-24 shrink-0 pt-0.5 text-right font-mono text-[11px] text-muted-foreground">{t.data}</div>
                <div className="flex flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white" style={{ background: t.cor }} />
                  {i < TIMELINE.length - 1 && <span className="w-px flex-1 bg-border" />}
                </div>
                <div className={cn("flex-1", i < TIMELINE.length - 1 && "pb-5")}>
                  <p className="text-[13.5px] font-semibold text-foreground">{t.titulo}</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{t.dono}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Metas consolidadas. */}
        <section>
          <SectionTitle icon={Target} tone="green" title="Metas consolidadas" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {METAS.map((m) => (
              <div key={m.label} className="rounded-2xl border border-border border-t-[3px] border-t-brand-sky bg-card p-4 shadow-card">
                <p className="text-[11.5px] text-muted-foreground">{m.label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-brand-navy">{m.value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{m.sub}</p>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-1.5 rounded-full bg-gradient-to-r from-brand-sky to-brand-green" style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais. Ações geram resultado; painéis geram relatório.
        </p>
      </div>
    </>
  );
}

function SectionTitle({
  icon: Icon,
  tone,
  title,
  count,
}: {
  icon: typeof Zap;
  tone: "coral" | "green" | "sky" | "gold";
  title: string;
  count?: string;
}) {
  const map = {
    coral: "bg-coral-tint text-coral",
    green: "bg-leaf-tint text-leaf",
    sky: "bg-navy-tint text-brand-blue",
    gold: "bg-gold-tint text-gold",
  }[tone];
  return (
    <div className="mb-4 flex items-center gap-3 border-b border-border pb-3">
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", map)}>
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-[16px] font-bold text-foreground">{title}</h2>
      {count && <span className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">{count}</span>}
    </div>
  );
}

function ActionCard({ acao }: { acao: Acao }) {
  const s = SEV[acao.sev];
  return (
    <div className="grid grid-cols-[48px_1fr] items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-[#cdd7e2] hover:shadow-elegant lg:grid-cols-[48px_1fr_150px_150px] lg:items-center">
      <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl border font-display text-lg font-bold", s.bg, s.border, s.text)}>
        {acao.n}
      </div>

      <div>
        <h3 className="text-[14.5px] font-bold text-foreground">{acao.titulo}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{acao.desc}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {acao.tags.map((t) => (
            <span
              key={t}
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{ background: CAT[t].bg, color: CAT[t].color }}
            >
              {CAT[t].label}
            </span>
          ))}
        </div>
      </div>

      <div className="text-center">
        <div className="font-display text-lg font-bold tabular-nums" style={{ color: acao.impacto.cor }}>
          {acao.impacto.valor}
        </div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{acao.impacto.label}</div>
        {acao.impacto.sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{acao.impacto.sub}</div>}
      </div>

      <div className="text-right">
        <Pill tone={acao.roi.tone}>{acao.roi.chip}</Pill>
        <div className="mt-1 text-[10px] text-muted-foreground">{acao.roi.prazo}</div>
      </div>
    </div>
  );
}

function RoiCard({ label, value, sub, pct, color }: { label: string; value: string; sub: string; pct: number; color: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function UnidCard({ label, value, change, tone }: { label: string; value: string; change: string; tone: "gold" | "coral" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={cn("font-display text-[22px] font-bold tabular-nums", tone === "gold" ? "text-gold" : "text-coral")}>{value}</span>
        <span className={cn("font-mono text-[12px] font-semibold", tone === "gold" ? "text-gold" : "text-coral")}>{change}</span>
      </div>
    </div>
  );
}
