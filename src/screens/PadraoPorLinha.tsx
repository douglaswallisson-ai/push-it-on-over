import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock,
  Info,
  Link2,
  Pencil,
  RotateCcw,
  Route,
  Sparkles,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { SeloDadosExemplo } from "@/components/ss/ui/SeloDadosExemplo";
import { Card, Pill } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { amostraContextoQuery, linhasQuery, padroesLinhaQuery } from "@/lib/queries";
import {
  FAIXAS_HORARIAS,
  contarDefinidos,
  linhasComPadrao,
  resolverTodos,
  type ValorResolvido,
} from "@/lib/padrao-linha";
import { CATEGORIA_COR, CATEGORIA_LABEL, INDICADORES, UNIDADE_SUFIXO, type CategoriaMeta } from "@/lib/faixas";
import { registrarAuditoria } from "@/lib/session";
import { ORIGEM_PADRAO_LABEL, type PadraoLinha } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Padrão de condução por linha.
 *
 * Resolve a queixa de origem: hoje o motorista é avaliado contra a média geral
 * da frota, o que compara linha de morro com linha plana. Aqui cada linha
 * declara o que se espera dela, e o motorista passa a ser medido contra o
 * padrão da linha que ele efetivamente rodou.
 *
 * O cadastro é **opcional e parcial**: linha sem nada configurado usa o padrão
 * global, e linha que só precisa ajustar um indicador grava um indicador. É o
 * que evita transformar 23 linhas × 4 faixas em 92 formulários para preencher.
 */

const ORIGEM_TONE = {
  linha_faixa: "text-brand-navy",
  linha: "text-brand-sky",
  global: "text-muted-foreground",
} as const;

export default function PadraoPorLinha() {
  const linhasQ = useQuery(linhasQuery());
  const padroesQ = useQuery(padroesLinhaQuery());
  const amostraQ = useQuery(amostraContextoQuery());

  const [linhaId, setLinhaId] = useState("l1");
  const [faixaId, setFaixaId] = useState<string | null>(null);
  const [locais, setLocais] = useState<PadraoLinha[] | null>(null);
  const [categoria, setCategoria] = useState<CategoriaMeta | "todas">("todas");

  const padroes = useMemo(() => locais ?? padroesQ.data ?? [], [locais, padroesQ.data]);
  const linhas = linhasQ.data ?? [];
  const linha = linhas.find((l) => l.id === linhaId);
  const comPadrao = linhasComPadrao(padroes);

  const resolvidos = useMemo(
    () => resolverTodos(padroes, linhaId, faixaId),
    [padroes, linhaId, faixaId],
  );

  const amostra = (amostraQ.data ?? {})[`${linhaId}|${faixaId ?? "null"}`];

  const indicadores = useMemo(
    () => (categoria === "todas" ? INDICADORES : INDICADORES.filter((i) => i.categoria === categoria)),
    [categoria],
  );

  /** Grava o valor no nível atualmente selecionado (linha ou linha+faixa). */
  const definir = (chave: string, valor: number | null) => {
    const base = padroes;
    const existente = base.find((p) => p.linhaId === linhaId && p.faixaHorariaId === faixaId);

    const novoRegistro: PadraoLinha = existente
      ? {
          ...existente,
          indicadores: { ...existente.indicadores, [chave]: { esperado: valor } },
          atualizadoEm: new Date().toISOString(),
          atualizadoPor: "Operador",
        }
      : {
          id: `pdl${Date.now()}`,
          linhaId,
          faixaHorariaId: faixaId,
          indicadores: { [chave]: { esperado: valor } },
          atualizadoEm: new Date().toISOString(),
          atualizadoPor: "Operador",
        };

    setLocais(existente ? base.map((p) => (p === existente ? novoRegistro : p)) : [...base, novoRegistro]);
  };

  /** Remove o valor deste nível — o indicador volta a herdar. */
  const herdar = (chave: string) => {
    const existente = padroes.find((p) => p.linhaId === linhaId && p.faixaHorariaId === faixaId);
    if (!existente) return;
    const { [chave]: _removido, ...resto } = existente.indicadores;
    setLocais(padroes.map((p) => (p === existente ? { ...existente, indicadores: resto } : p)));
  };

  const sugerir = () => {
    if (!amostra) {
      toast.error("Sem histórico suficiente neste contexto.", {
        description: "Não há viagens bastantes para calcular uma sugestão confiável.",
      });
      return;
    }
    const existente = padroes.find((p) => p.linhaId === linhaId && p.faixaHorariaId === faixaId);
    const novos = Object.fromEntries(
      Object.entries(amostra.p75).map(([k, v]) => [k, { esperado: v }]),
    );
    const registro: PadraoLinha = existente
      ? { ...existente, indicadores: { ...existente.indicadores, ...novos }, atualizadoEm: new Date().toISOString(), atualizadoPor: "Operador" }
      : { id: `pdl${Date.now()}`, linhaId, faixaHorariaId: faixaId, indicadores: novos, atualizadoEm: new Date().toISOString(), atualizadoPor: "Operador" };

    setLocais(existente ? padroes.map((p) => (p === existente ? registro : p)) : [...padroes, registro]);
    toast.success(`${Object.keys(novos).length} indicadores preenchidos.`, {
      description: `P75 de ${amostra.viagens} viagens. Revise antes de salvar.`,
    });
  };

  const salvar = () => {
    registrarAuditoria(
      "padrao_linha",
      `Padrão salvo — linha ${linha?.codigo ?? linhaId}${faixaId ? ` · ${FAIXAS_HORARIAS.find((f) => f.id === faixaId)?.nome}` : " · linha inteira"}.`,
    );
    toast.success("Padrão salvo.", {
      description: "Passa a valer para as próximas viagens desta linha.",
    });
  };

  const definidosNoNivel = contarDefinidos(padroes, linhaId, faixaId);

  if (linhasQ.error) {
    return (
      <>
        <PageHeader title="Padrão por linha" subtitle="Transporte urbano" />
        <div className="mx-auto max-w-[1360px] px-6 py-6">
          <ErrorBox error={linhasQ.error} onRetry={() => linhasQ.refetch()} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Padrão por linha"
        subtitle="Transporte urbano › Referência de condução"
        actions={
          <button
            onClick={salvar}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Check className="h-[15px] w-[15px]" />
            Salvar padrão
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-5 px-6 py-6 md:px-8">
        <SeloDadosExemplo motivo="O padrão por linha é cálculo sobre a base histórica e ainda não foi desenvolvido." />

        {/* Explicação permanente — o conceito não é óbvio na primeira visita. */}
        <div
          data-tour="conceito"
          className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            O motorista é avaliado contra o padrão da linha que ele rodou, não contra a média geral da frota — linha de
            morro e linha plana deixam de ser comparadas entre si. Configurar é{" "}
            <strong className="text-foreground">opcional</strong>: linha sem padrão próprio usa o padrão global, e você
            só precisa preencher os indicadores que realmente diferem.
          </p>
        </div>

        {/* Seleção de contexto. */}
        <Card title="Contexto" icon={Route} bodyClassName="p-4">
          <div data-tour="seletor-linha" className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="text-[13px] text-muted-foreground">Linha</span>
              <select
                value={linhaId}
                onChange={(e) => setLinhaId(e.target.value)}
                className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
              >
                {linhas.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.codigo} — {l.nome}
                    {comPadrao.has(l.id) ? "  ✓" : ""}
                  </option>
                ))}
              </select>
            </label>

            <span className="text-[12px] text-muted-foreground">
              {comPadrao.size} de {linhas.length} linhas com padrão próprio · ✓ marca as configuradas
            </span>
          </div>

          {/* Faixa horária. */}
          <div data-tour="faixa-horaria" className="mt-4">
            <p className="mb-2 text-[13px] text-muted-foreground">
              Faixa horária — pico e entrepico na mesma linha são operações diferentes.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFaixaId(null)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                  faixaId === null
                    ? "bg-brand-navy text-white"
                    : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                Linha inteira
                <span className="ml-1.5 font-mono opacity-70">{contarDefinidos(padroes, linhaId, null)}</span>
              </button>
              {FAIXAS_HORARIAS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFaixaId(f.id)}
                  title={`${f.inicio} às ${f.fim}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                    faixaId === f.id
                      ? "bg-brand-navy text-white"
                      : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {f.nome}
                  <span className="font-mono opacity-70">{contarDefinidos(padroes, linhaId, f.id)}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              O número em cada aba é quantos indicadores foram definidos ali. Faixa sem definição herda da linha
              inteira, que por sua vez herda do padrão global.
            </p>
          </div>
        </Card>

        {/* Indicadores. */}
        <Card
          title={`Indicadores — ${linha?.codigo ?? ""}${faixaId ? ` · ${FAIXAS_HORARIAS.find((f) => f.id === faixaId)?.nome}` : " · linha inteira"}`}
          icon={Sparkles}
          action={
            <div className="flex items-center gap-2">
              <Pill tone={definidosNoNivel ? "sky" : "neutral"}>
                {definidosNoNivel} definidos aqui
              </Pill>
              <button
                data-tour="sugestao"
                onClick={sugerir}
                disabled={!amostra}
                title={amostra ? `P75 de ${amostra.viagens} viagens` : "Sem histórico suficiente"}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-1.5 text-[13px] font-medium text-brand-navy transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Sugerir do histórico
              </button>
            </div>
          }
          bodyClassName="p-4"
        >
          {amostra ? (
            <p className="mb-3 text-[12px] text-muted-foreground">
              Histórico deste contexto: <strong className="text-foreground">{amostra.viagens} viagens</strong> nos
              últimos 90 dias. A sugestão usa o percentil 75 — o que o quarto superior dos motoristas consegue fazer
              aqui, não a média.
            </p>
          ) : (
            <p className="mb-3 text-[12px] text-gold">
              Sem viagens suficientes neste contexto para sugerir um valor. Preencha manualmente ou deixe herdar.
            </p>
          )}

          <div className="mb-3 flex flex-wrap gap-1.5">
            {(["todas", "faixas", "ociosidade", "seguranca", "operacao"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategoria(c)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                  categoria === c
                    ? "bg-brand-navy text-white"
                    : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                {c === "todas" ? "Todas" : CATEGORIA_LABEL[c]}
              </button>
            ))}
          </div>

          {padroesQ.isPending ? (
            <SkeletonRows rows={6} />
          ) : indicadores.length ? (
            <div data-tour="indicadores" className="grid gap-2.5 lg:grid-cols-2">
              {indicadores.map((ind) => (
                <LinhaIndicador
                  key={ind.chave}
                  chave={ind.chave}
                  label={ind.label}
                  descricao={ind.descricao}
                  unidade={UNIDADE_SUFIXO[ind.unidade]}
                  direcao={ind.direcao}
                  cor={CATEGORIA_COR[ind.categoria]}
                  valor={resolvidos[ind.chave]}
                  sugestao={amostra?.p75[ind.chave]}
                  nivelAtual={faixaId ? "linha_faixa" : "linha"}
                  onDefinir={(v) => definir(ind.chave, v)}
                  onHerdar={() => herdar(ind.chave)}
                />
              ))}
            </div>
          ) : (
            <EmptyNote>Nenhum indicador nesta categoria.</EmptyNote>
          )}
        </Card>
      </div>
    </>
  );
}

/* ---------------------------- Linha de indicador --------------------------- */

function LinhaIndicador({
  label,
  descricao,
  unidade,
  direcao,
  cor,
  valor,
  sugestao,
  nivelAtual,
  onDefinir,
  onHerdar,
}: {
  chave: string;
  label: string;
  descricao: string;
  unidade: string;
  direcao: "maior" | "menor";
  cor: string;
  valor: ValorResolvido;
  sugestao?: number;
  nivelAtual: "linha" | "linha_faixa";
  onDefinir: (v: number | null) => void;
  onHerdar: () => void;
}) {
  const proprio = valor.origem === nivelAtual;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        proprio ? "border-border bg-card" : "border-dashed border-border bg-secondary/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} />
            <span className={cn("text-[14px] font-semibold", proprio ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
            <span
              title={direcao === "maior" ? "Quanto maior, melhor" : "Quanto menor, melhor"}
              className={cn(
                "inline-flex items-center rounded px-1 py-0.5 text-[12px] font-semibold",
                direcao === "maior" ? "bg-leaf-tint text-leaf" : "bg-coral-tint text-coral",
              )}
            >
              {direcao === "maior" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground" title={descricao}>
            {descricao}
          </p>
        </div>

        {/* Origem do valor — sem isso o gestor não sabe se é dele ou herdado. */}
        <button
          onClick={() => (proprio ? onHerdar() : onDefinir(valor.esperado ?? sugestao ?? 0))}
          title={proprio ? "Voltar a herdar" : "Definir neste nível"}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-medium transition-colors hover:bg-secondary",
            ORIGEM_TONE[valor.origem],
          )}
        >
          {proprio ? <Pencil className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
          {ORIGEM_PADRAO_LABEL[valor.origem]}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            value={valor.esperado ?? ""}
            placeholder="—"
            disabled={!proprio}
            onChange={(e) => onDefinir(e.target.value === "" ? null : Number(e.target.value))}
            className={cn(
              "h-9 w-full rounded-lg border pl-2.5 pr-12 font-mono text-[13px] outline-none focus:border-accent",
              proprio ? "border-border bg-white text-foreground" : "border-border bg-transparent text-muted-foreground",
            )}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
            {unidade}
          </span>
        </div>

        {sugestao !== undefined && proprio && valor.esperado !== sugestao && (
          <button
            onClick={() => onDefinir(sugestao)}
            title={`Aplicar sugestão do histórico: ${sugestao}${unidade}`}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-border bg-white px-2 text-[12px] font-medium text-brand-navy hover:bg-secondary"
          >
            <Sparkles className="h-3 w-3" />
            {sugestao}
          </button>
        )}

        {proprio && (
          <button
            onClick={onHerdar}
            title="Voltar a herdar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
