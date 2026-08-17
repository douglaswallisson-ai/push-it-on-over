import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertOctagon, Bug, CircuitBoard, Info, Lightbulb, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { SeloDadosExemplo } from "@/components/ss/ui/SeloDadosExemplo";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { desde, dtcQuery, nf, veiculosQuery } from "@/lib/queries";
import { recomendarPorDTC } from "@/lib/dtc";
import { registrarAuditoria } from "@/lib/session";
import { SEVERIDADE_DTC_LABEL, type CodigoDTC, type RecomendacaoDTC, type SeveridadeDTC } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Diagnóstico por códigos de falha.
 *
 * A leitura crua do CAN sozinha não muda comportamento: vira uma lista de
 * códigos que o gestor não sabe interpretar. Por isso a tela é organizada em
 * torno da recomendação — o que fazer — e o código fica como evidência.
 *
 * A análise trabalha com padrão, não com evento isolado. Código que aparece uma
 * vez pode ser oscilação de sensor; recorrente, ou convivendo com outro do
 * mesmo sistema, indica degradação real e justifica antecipar o plano.
 */

const SEV_TONE: Record<SeveridadeDTC, PillTone> = {
  informativo: "sky",
  atencao: "gold",
  critico: "coral",
  parada_imediata: "coral",
};

const URG_TONE: Record<RecomendacaoDTC["urgencia"], PillTone> = {
  imediata: "coral",
  corretiva: "coral",
  antecipar: "gold",
  monitorar: "sky",
};

const URG_LABEL: Record<RecomendacaoDTC["urgencia"], string> = {
  imediata: "Recolher agora",
  corretiva: "Abrir corretiva",
  antecipar: "Antecipar preventiva",
  monitorar: "Monitorar",
};

export default function DiagnosticoDTC() {
  const dtcQ = useQuery(dtcQuery());
  const veiculosQ = useQuery(veiculosQuery(1, 200));
  const [aplicadas, setAplicadas] = useState<Record<string, boolean>>({});
  const [soAtivos, setSoAtivos] = useState(true);

  const prefixo = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of veiculosQ.data?.items ?? []) m.set(v.id, v.prefixo ?? v.placa);
    return m;
  }, [veiculosQ.data]);

  const codigos = useMemo(() => (dtcQ.data ?? []).filter((d) => !soAtivos || d.ativo), [dtcQ.data, soAtivos]);

  /** Agrupa por veículo: a decisão é sempre sobre um carro, não sobre um código. */
  const porVeiculo = useMemo(() => {
    const m = new Map<string, CodigoDTC[]>();
    for (const d of codigos) {
      if (!m.has(d.veiculoId)) m.set(d.veiculoId, []);
      m.get(d.veiculoId)!.push(d);
    }
    return [...m.entries()]
      .map(([veiculoId, lista]) => ({
        veiculoId,
        codigos: lista.sort((a, b) => b.ocorrencias - a.ocorrencias),
        recomendacoes: recomendarPorDTC(lista),
      }))
      .sort((a, b) => (b.recomendacoes[0] ? 1 : 0) - (a.recomendacoes[0] ? 1 : 0));
  }, [codigos]);

  const ativos = (dtcQ.data ?? []).filter((d) => d.ativo);
  const criticos = ativos.filter((d) => d.severidade === "critico" || d.severidade === "parada_imediata").length;
  const comLampada = ativos.filter((d) => d.lampadaAcesa).length;
  const todasRecs = porVeiculo.flatMap((p) => p.recomendacoes);
  const paraAntecipar = todasRecs.filter((r) => r.urgencia === "antecipar").length;

  const aplicar = (r: RecomendacaoDTC) => {
    setAplicadas((a) => ({ ...a, [r.id]: true }));
    registrarAuditoria(
      "dtc",
      `Recomendação aplicada — veículo ${prefixo.get(r.veiculoId) ?? r.veiculoId}: ${r.acao} (${r.codigos.join(", ")}).`,
    );
    toast.success(r.acao, {
      description: r.antecipacaoPct
        ? `Intervalo de ${r.sistema.toLowerCase()} antecipado em ${r.antecipacaoPct}%.`
        : `${prefixo.get(r.veiculoId)} · ${r.codigos.join(", ")}`,
    });
  };

  if (dtcQ.error) {
    return (
      <>
        <PageHeader title="Diagnóstico" subtitle="Frota" />
        <div className="mx-auto max-w-[1360px] px-6 py-6">
          <ErrorBox error={dtcQ.error} onRetry={() => dtcQ.refetch()} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Diagnóstico" subtitle="Frota › Códigos de falha e recomendações" />

      <div className="mx-auto max-w-[1360px] space-y-5 px-6 py-6 md:px-8">
        <SeloDadosExemplo motivo="Os códigos de falha ainda não são persistidos — o cálculo virá da telemetria." />

        <div data-tour="stat" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Bug} label="Códigos ativos" value={nf(ativos.length)} color="var(--brand-navy)" />
          <StatTile icon={AlertOctagon} label="Críticos" value={nf(criticos)} color="var(--coral)" />
          <StatTile icon={Lightbulb} label="Com luz acesa" value={nf(comLampada)} color="var(--gold)" foot="anomalia no painel" />
          <StatTile
            icon={Sparkles}
            label="Preventivas a antecipar"
            value={nf(paraAntecipar)}
            color="var(--brand-sky)"
            foot="sugeridas pela análise"
          />
        </div>

        <div data-tour="conceito" className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            A análise trabalha com <strong className="text-foreground">padrão</strong>, não com evento isolado. Um
            código que aparece uma vez pode ser oscilação de sensor; o mesmo código recorrente, ou dois códigos do
            mesmo sistema convivendo, indicam degradação real — e é isso que justifica antecipar um item do plano.
            Cada recomendação declara a confiança, e só as de confiança alta alteram o intervalo automaticamente.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => setSoAtivos((v) => !v)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
              soAtivos ? "bg-brand-navy text-white" : "border border-border bg-white text-muted-foreground hover:bg-secondary",
            )}
          >
            {soAtivos ? "Mostrando só ativos" : "Mostrando todos"}
          </button>
        </div>

        {dtcQ.isPending ? (
          <Card title="Carregando" icon={Bug}>
            <SkeletonRows rows={5} />
          </Card>
        ) : porVeiculo.length === 0 ? (
          <Card title="Diagnóstico" icon={Bug} bodyClassName="p-4">
            <EmptyNote>Nenhum código de falha ativo na frota.</EmptyNote>
          </Card>
        ) : (
          porVeiculo.map(({ veiculoId, codigos: lista, recomendacoes }) => (
            <Card
              key={veiculoId}
              title={`Veículo ${prefixo.get(veiculoId) ?? veiculoId}`}
              icon={CircuitBoard}
              action={
                <span className="flex items-center gap-2">
                  <Pill tone="neutral">{lista.length} códigos</Pill>
                  {recomendacoes[0] && <Pill tone={URG_TONE[recomendacoes[0].urgencia]}>{URG_LABEL[recomendacoes[0].urgencia]}</Pill>}
                </span>
              }
              bodyClassName="p-4"
            >
              {/* Recomendação primeiro: é o que muda comportamento. */}
              {recomendacoes.length > 0 && (
                <div data-tour="recomendacoes" className="mb-4 space-y-2">
                  {recomendacoes.map((r) => (
                    <div
                      key={r.id}
                      className={cn(
                        "rounded-xl border p-3",
                        r.urgencia === "imediata" || r.urgencia === "corretiva"
                          ? "border-coral-line bg-coral-tint/40"
                          : r.urgencia === "antecipar"
                            ? "border-gold-line bg-gold-tint/40"
                            : "border-border bg-secondary/40",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-sky" />
                            <span className="text-[13.5px] font-semibold text-foreground">{r.acao}</span>
                            <Pill tone={URG_TONE[r.urgencia]}>{URG_LABEL[r.urgencia]}</Pill>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                r.confianca === "alta" ? "bg-leaf-tint text-leaf" : "bg-secondary text-muted-foreground",
                              )}
                              title="Só recomendações de confiança alta alteram o intervalo automaticamente"
                            >
                              confiança {r.confianca}
                            </span>
                          </span>
                          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{r.justificativa}</p>
                          {r.antecipacaoPct && (
                            <p className="mt-1 text-[12px] font-medium text-gold">
                              Sugere antecipar o intervalo de {r.sistema.toLowerCase()} em {r.antecipacaoPct}%.
                            </p>
                          )}
                        </div>

                        {aplicadas[r.id] ? (
                          <Pill tone="green">Aplicada</Pill>
                        ) : (
                          <button
                            onClick={() => aplicar(r)}
                            className="shrink-0 rounded-lg bg-brand-navy px-3 py-1.5 text-[12.5px] font-semibold text-white"
                          >
                            <Wrench className="mr-1 inline h-3.5 w-3.5" />
                            Aplicar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Códigos como evidência. */}
              <ul className="space-y-1.5">
                {lista.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card px-3 py-2">
                    <span className="font-mono text-[13px] font-bold text-foreground">{d.codigo}</span>
                    {d.spn !== undefined && (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        SPN {d.spn}/FMI {d.fmi}
                      </span>
                    )}
                    <span className="rounded bg-secondary px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-soft">{d.sistema}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft">{d.descricao}</span>
                    {d.lampadaAcesa && <Lightbulb className="h-3.5 w-3.5 shrink-0 text-gold" aria-label="Luz de anomalia acesa" />}
                    <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground" title={`Primeira em ${new Date(d.primeiraOcorrencia).toLocaleDateString("pt-BR")}`}>
                      {d.ocorrencias}× · {desde(d.ultimaOcorrencia)}
                    </span>
                    <Pill tone={SEV_TONE[d.severidade]}>{SEVERIDADE_DTC_LABEL[d.severidade]}</Pill>
                    {!d.ativo && <span className="text-[11px] text-muted-foreground">resolvido</span>}
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </div>
    </>
  );
}
