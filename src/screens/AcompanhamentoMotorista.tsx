import { useMemo } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { AlertTriangle, ArrowLeft, Award, Clock, Fuel, Gauge, IdCard, Octagon, Route, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, Pill } from "@/components/ss/ui/data";
import { IndicatorCard, ScoreGauge, StarRating } from "@/components/ss/ui/gauges";
import { FaixasConducao } from "@/components/ss/frota/FaixasConducao";
import { rankingMotoristasQuery } from "@/lib/queries";
import { distribuicaoDoRanking, type MotoristaRankingApi } from "@/lib/api";
import { CNH_LABEL, CNH_TONE, dataBR, exigeAtencao, prazoCNH, statusCNH } from "@/lib/cnh";
import { cn } from "@/lib/utils";

/**
 * Acompanhamento do motorista — o mesmo cálculo do ranking, de um motorista só.
 *
 * Antes a tela inteira era exemplo: nota 71, "7.216 km", pressão do acelerador,
 * vídeos de fadiga e CNH vinham escritos no código, iguais para qualquer
 * motorista aberto. Agora tudo sai de `/driver-ranking` (últimos 30 dias até
 * ontem). Os blocos sem origem real — vídeo por motorista, pressão do
 * acelerador, tendência diária, nota por linha — saíram até existir fonte.
 */

const nf = (v: number | null | undefined, casas = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

/** Tom pela meta do lado bom/ruim: aqui só sinaliza, não avalia. */
const tomBom = (v: number | null) => (v == null ? "sky" : v >= 40 ? "leaf" : v >= 20 ? "gold" : "coral");
const tomRuim = (v: number | null, limite: number) => (v == null ? "sky" : v <= limite ? "leaf" : v <= limite * 2 ? "gold" : "coral");

export default function AcompanhamentoMotorista() {
  const navigate = useNavigate();
  const { nome } = useParams();
  const alvo = nome ? decodeURIComponent(nome) : "";
  const q = useQuery(rankingMotoristasQuery());

  const m: MotoristaRankingApi | undefined = useMemo(
    () => q.data?.motoristas.find((x) => x.nome === alvo),
    [q.data, alvo],
  );
  const total = q.data?.motoristas.filter((x) => x.posicao != null).length ?? 0;
  const periodo = q.data
    ? `${new Date(q.data.inicio + "T12:00").toLocaleDateString("pt-BR")} a ${new Date(q.data.fim + "T12:00").toLocaleDateString("pt-BR")}`
    : "últimos 30 dias";

  const voltar = (
    <button
      onClick={() => navigate("/app/motoristas")}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-secondary"
    >
      <ArrowLeft className="h-[15px] w-[15px]" />
      Voltar
    </button>
  );

  if (!m) {
    return (
      <>
        <PageHeader title="Acompanhamento do motorista" subtitle="Motoristas › Desempenho" actions={voltar} />
        <div className="mx-auto max-w-[1360px] px-6 py-10 text-center text-sm text-muted-foreground md:px-8">
          {q.isPending
            ? "Carregando o desempenho do motorista…"
            : q.error
              ? `Não foi possível carregar: ${(q.error as Error).message}`
              : `Nenhuma viagem de "${alvo}" no período (${periodo}).`}
        </div>
      </>
    );
  }

  const f = m.faixas;
  const velMedia = m.horas > 0 ? m.km / m.horas : null;
  const e = m.eventos_por_hora;
  const eventos = [
    { icon: Octagon, label: "Freada brusca / h", value: e.freada_brusca },
    { icon: TrendingUp, label: "Aceleração brusca / h", value: e.aceleracao_brusca },
    { icon: Gauge, label: "Velocidade excessiva / h", value: e.velocidade_excessiva },
    { icon: Clock, label: "Embreagem / h", value: e.embreagem },
  ];
  const stats = [
    { icon: Route, label: "Km rodado", value: nf(m.km), unit: "km" },
    { icon: Clock, label: "Horas trabalhadas", value: nf(m.horas, 1), unit: "h" },
    { icon: Gauge, label: "Velocidade média", value: nf(velMedia, 1), unit: "km/h" },
    { icon: Fuel, label: "Combustível", value: nf(m.litros), unit: "L" },
    { icon: TrendingUp, label: "Média", value: nf(m.kml, 2), unit: "km/l" },
  ];

  return (
    <>
      <PageHeader title="Acompanhamento do motorista" subtitle={`Motoristas › Desempenho · ${periodo}`} actions={voltar} />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Motoristas · Acompanhamento"
          title={m.nome ?? `Motorista ${m.driver_id}`}
          subtitle={`Período ${periodo} · id ${m.driver_id}`}
        >
          <div className="flex items-center gap-6">
            <HeroMetric value={nf(m.km)} unit="km" label="Rodados no período" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value={nf(m.kml, 2)} unit="km/l" label="Média" />
          </div>
        </HeroBanner>

        <CartaoCNH m={m} />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          <Card title="Pontuação" icon={Award}>
            <div className="flex flex-col items-center gap-3">
              {m.pontuacao == null ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Sem faixas de condução no período.</p>
              ) : (
                <>
                  {/* O medidor vai de 0 a 100; a pontuação do BI passa de 100. */}
                  <ScoreGauge score={Math.max(0, Math.min(100, m.pontuacao))} />
                  <p className="font-mono text-sm font-bold">{nf(m.pontuacao, 2)} pontos</p>
                  <StarRating value={m.estrelas} />
                  <Pill tone="sky">
                    {m.posicao}º de {nf(total)}
                  </Pill>
                </>
              )}
            </div>
          </Card>

          <div>
            <p className="mb-3 flex items-center gap-2 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="inline-block h-px w-4 bg-current opacity-50" />
              Indicadores de condução (% do tempo nas 13 faixas)
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <IndicatorCard label="Faixa verde" value={f.verde ?? 0} tone={tomBom(f.verde)} />
              <IndicatorCard label="Inércia" value={f.inercia ?? 0} tone={tomBom(f.inercia)} />
              <IndicatorCard label="Extra econômica" value={f.extra_economica ?? 0} tone={tomBom(f.extra_economica)} />
              <IndicatorCard label="Parado com motor ligado" value={f.parado_ligado ?? 0} tone={tomRuim(f.parado_ligado, 20)} />
              <IndicatorCard label="Faixa amarela" value={f.amarela ?? 0} tone={tomRuim(f.amarela, 2)} />
              <IndicatorCard label="Faixa vermelha" value={f.vermelha ?? 0} tone={tomRuim(f.vermelha, 1)} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Estatísticas do período" icon={TrendingUp}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {stats.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-secondary/40 p-3">
                  <s.icon className="h-4 w-4 text-brand-navy" />
                  <p className="mt-2 font-display text-lg font-bold tabular-nums">
                    {s.value}
                    <span className="ml-0.5 text-[12px] font-medium text-muted-foreground">{s.unit}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] leading-tight text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Eventos por hora trabalhada" icon={Octagon}>
            <div className="grid grid-cols-2 gap-4">
              {eventos.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-secondary/40 p-3">
                  <s.icon className="h-4 w-4 text-coral" />
                  <p className="mt-2 font-display text-lg font-bold tabular-nums">{nf(s.value, 2)}</p>
                  <p className="mt-0.5 text-[12px] leading-tight text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {m.pontuacao != null && (
          <FaixasConducao
            distribuicao={distribuicaoDoRanking(f)}
            titulo="Faixas de condução"
            subtitulo="Distribuição do tempo nas 13 faixas, como no Power BI. Freio motor não tem coluna de origem."
          />
        )}
      </div>
    </>
  );
}

/* ---------------------------------- CNH ---------------------------------- */

/**
 * Situação do documento, do cadastro do motorista (`mova.driver`). A validade é
 * opcional, então "sem informação" é estado legítimo — e visível, para o gestor
 * saber que falta preencher.
 */
function CartaoCNH({ m }: { m: MotoristaRankingApi }) {
  const status = statusCNH(m.cnh_validade);
  const alerta = exigeAtencao(status);
  const tone = CNH_TONE[status];
  const cls =
    tone === "coral"
      ? "border-coral-line bg-coral-tint/40 text-coral"
      : tone === "gold"
        ? "border-gold-line bg-gold-tint/40 text-gold"
        : tone === "green"
          ? "border-leaf-line bg-leaf-tint/40 text-leaf"
          : "border-border bg-secondary/40 text-muted-foreground";

  return (
    <div data-tour="cnh" className={cn("flex flex-wrap items-center justify-between gap-4 rounded-xl border px-4 py-3", cls)}>
      <div className="flex items-center gap-3">
        {alerta ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <IdCard className="h-5 w-5 shrink-0" />}
        <div>
          <p className="text-[14px] font-semibold">
            {CNH_LABEL[status]}
            {m.cnh_validade ? ` — ${prazoCNH(m.cnh_validade)}` : ""}
          </p>
          <p className="text-[12px] opacity-80">
            {m.cnh_numero ? `CNH ${m.cnh_numero}` : "Número não informado"}
            {m.cnh_categoria ? ` · categoria ${m.cnh_categoria}` : ""}
            {m.cnh_validade ? ` · válida até ${dataBR(m.cnh_validade)}` : " · validade não informada"}
          </p>
        </div>
      </div>
      {alerta && (
        <span className="rounded-full bg-white/70 px-3 py-1 text-[12px] font-semibold">Renovação necessária antes de escalar</span>
      )}
    </div>
  );
}
