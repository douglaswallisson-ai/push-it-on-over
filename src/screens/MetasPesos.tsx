import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  RotateCcw,
  Scale,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card } from "@/components/ss/ui/data";
import {
  CATEGORIA_COR,
  CATEGORIA_LABEL,
  CONFIG_PADRAO,
  INDICADORES,
  UNIDADE_SUFIXO,
  type CategoriaMeta,
  type ConfigMetas,
  type IndicadorMeta,
  somaPesos,
} from "@/lib/faixas";
import { cn } from "@/lib/utils";

/**
 * Metas e pesos da premiação.
 *
 * A tela antiga era uma tabela de 24 linhas com dois campos vazios cada: sem
 * agrupamento, sem unidade, sem dizer se o número deveria subir ou descer, e
 * sem mostrar quanto cada indicador pesa no resultado. Preencher exigia saber
 * de cor o significado de cada linha.
 *
 * Três mudanças resolvem isso:
 *
 * 1. Só o que está ligado aparece em detalhe. O peso deixa de ser um campo em
 *    branco e vira um interruptor: indicador desligado não entra na conta.
 * 2. O peso é sempre mostrado como participação relativa (%) no total, e a
 *    barra no topo avisa em tempo real quando a soma não fecha 100.
 * 3. Cada indicador diz sua unidade e sua direção ("quanto maior melhor" /
 *    "quanto menor melhor"), que era exatamente a informação que faltava.
 */

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export default function MetasPesos() {
  const [config, setConfig] = useState<ConfigMetas>(CONFIG_PADRAO);
  const [busca, setBusca] = useState("");
  const [soAtivos, setSoAtivos] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const total = somaPesos(config);
  const ativos = INDICADORES.filter((i) => config[i.chave]?.ativo).length;

  const set = (chave: string, patch: Partial<{ meta: number; peso: number; ativo: boolean }>) => {
    setConfig((c) => ({ ...c, [chave]: { ...(c[chave] ?? { meta: 0, peso: 0, ativo: false }), ...patch } }));
    setSalvo(false);
  };

  const porCategoria = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const filtrados = INDICADORES.filter((i) => {
      if (soAtivos && !config[i.chave]?.ativo) return false;
      if (!t) return true;
      return i.label.toLowerCase().includes(t) || i.descricao.toLowerCase().includes(t);
    });
    const mapa = new Map<CategoriaMeta, IndicadorMeta[]>();
    for (const i of filtrados) {
      if (!mapa.has(i.categoria)) mapa.set(i.categoria, []);
      mapa.get(i.categoria)!.push(i);
    }
    return mapa;
  }, [busca, soAtivos, config]);

  /** Redistribui os pesos dos ativos para somar exatamente 100. */
  const normalizar = () => {
    const chaves = INDICADORES.filter((i) => config[i.chave]?.ativo).map((i) => i.chave);
    if (!chaves.length) return;
    const soma = chaves.reduce((a, k) => a + (config[k]?.peso ?? 0), 0) || 1;
    const novo = { ...config };
    let acumulado = 0;
    chaves.forEach((k, idx) => {
      const v =
        idx === chaves.length - 1
          ? 100 - acumulado
          : Math.round(((novo[k]?.peso ?? 0) / soma) * 100);
      acumulado += v;
      novo[k] = { ...novo[k], peso: v };
    });
    setConfig(novo);
    setSalvo(false);
  };

  return (
    <>
      <PageHeader
        title="Metas e pesos"
        subtitle="Premiação › Configuração do índice"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setConfig(CONFIG_PADRAO);
                setSalvo(false);
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary"
            >
              <RotateCcw className="h-[15px] w-[15px]" />
              Restaurar padrão
            </button>
            <button
              onClick={() => setSalvo(true)}
              disabled={total !== 100}
              title={total !== 100 ? "Os pesos precisam somar 100%" : undefined}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              <Check className="h-[15px] w-[15px]" />
              {salvo ? "Salvo" : "Salvar configuração"}
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1200px] space-y-5 px-6 py-6 md:px-8">
        {/* Barra de pesos — o controle que a tela antiga não tinha. */}
        <BarraPesos config={config} total={total} ativos={ativos} onNormalizar={normalizar} />

        {/* Filtros. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar indicador…"
              className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-[14px] outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={() => setSoAtivos((v) => !v)}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-medium transition-colors",
              soAtivos ? "bg-brand-navy text-white" : "border border-border bg-card text-muted-foreground hover:bg-secondary",
            )}
          >
            {soAtivos ? "Mostrando só ativos" : "Mostrar só ativos"}
          </button>
        </div>

        {/* Grupos. */}
        {(["faixas", "ociosidade", "seguranca", "operacao"] as CategoriaMeta[]).map((cat) => {
          const itens = porCategoria.get(cat);
          if (!itens?.length) return null;
          const pesoCat = itens.reduce((a, i) => a + (config[i.chave]?.ativo ? config[i.chave].peso : 0), 0);

          return (
            <Card
              key={cat}
              title={CATEGORIA_LABEL[cat]}
              icon={Target}
              action={
                <span className="flex items-center gap-2 text-[12px]">
                  <span className="text-muted-foreground">peso do grupo</span>
                  <span
                    className="rounded-full px-2 py-0.5 font-mono text-[12px] font-bold"
                    style={{
                      background: `color-mix(in oklab, ${CATEGORIA_COR[cat]} 14%, white)`,
                      color: `color-mix(in oklab, ${CATEGORIA_COR[cat]} 82%, black)`,
                    }}
                  >
                    {pesoCat}%
                  </span>
                </span>
              }
              bodyClassName="p-3"
            >
              <div className="grid gap-2.5 lg:grid-cols-2">
                {itens.map((ind) => (
                  <LinhaIndicador
                    key={ind.chave}
                    ind={ind}
                    cfg={config[ind.chave] ?? { meta: 0, peso: 0, ativo: false }}
                    totalPesos={total}
                    onChange={(patch) => set(ind.chave, patch)}
                  />
                ))}
              </div>
            </Card>
          );
        })}

        <p className="pb-4 text-center text-[12px] text-muted-foreground">
          A nota final do motorista é a média dos indicadores ativos, ponderada pelos pesos acima.
        </p>
      </div>
    </>
  );
}

/* ------------------------------- Barra de pesos ------------------------------ */

function BarraPesos({
  config,
  total,
  ativos,
  onNormalizar,
}: {
  config: ConfigMetas;
  total: number;
  ativos: number;
  onNormalizar: () => void;
}) {
  const fecha = total === 100;
  const segmentos = INDICADORES.filter((i) => config[i.chave]?.ativo && config[i.chave].peso > 0);

  return (
    <div data-tour="pesos" className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-foreground">
            <Scale className="h-4 w-4 text-brand-navy" />
            Distribuição dos pesos
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {ativos} indicador{ativos === 1 ? "" : "es"} ativo{ativos === 1 ? "" : "s"} compõem a nota.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p
              className={cn(
                "font-display text-[30px] font-bold leading-none tabular-nums",
                fecha ? "text-leaf" : "text-coral",
              )}
            >
              {total}%
            </p>
            <p className="text-[12px] text-muted-foreground">soma dos pesos</p>
          </div>
          {!fecha && (
            <button
              onClick={onNormalizar}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold-tint px-3 py-1.5 text-[13px] font-semibold text-gold transition-colors hover:bg-gold-tint/70"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Ajustar para 100%
            </button>
          )}
        </div>
      </div>

      {/* Barra proporcional: mostra o peso relativo de cada indicador ativo. */}
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full border border-border bg-secondary">
        {segmentos.map((i) => (
          <span
            key={i.chave}
            title={`${i.label}: ${config[i.chave].peso}%`}
            style={{
              width: `${(config[i.chave].peso / Math.max(total, 100)) * 100}%`,
              background: CATEGORIA_COR[i.categoria],
            }}
            className="h-full border-r border-white/40 last:border-r-0"
          />
        ))}
      </div>

      {!fecha && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-coral">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {total > 100
            ? `Excedendo em ${total - 100} pontos — a nota ficaria inflada.`
            : `Faltam ${100 - total} pontos para fechar a nota.`}
        </p>
      )}
    </div>
  );
}

/* ------------------------------ Linha do indicador --------------------------- */

function LinhaIndicador({
  ind,
  cfg,
  totalPesos,
  onChange,
}: {
  ind: IndicadorMeta;
  cfg: { meta: number; peso: number; ativo: boolean };
  totalPesos: number;
  onChange: (p: Partial<{ meta: number; peso: number; ativo: boolean }>) => void;
}) {
  const participacao = totalPesos > 0 && cfg.ativo ? Math.round((cfg.peso / totalPesos) * 100) : 0;
  const passoMeta = ind.unidade === "km" ? 500 : ind.unidade === "horas" ? 5 : 1;

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-colors",
        cfg.ativo ? "border-border bg-card" : "border-dashed border-border bg-secondary/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("text-[14px] font-semibold", cfg.ativo ? "text-foreground" : "text-muted-foreground")}>
              {ind.label}
            </span>
            <span
              title={ind.direcao === "maior" ? "Quanto maior, melhor" : "Quanto menor, melhor"}
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[12px] font-semibold",
                ind.direcao === "maior" ? "bg-leaf-tint text-leaf" : "bg-coral-tint text-coral",
              )}
            >
              {ind.direcao === "maior" ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
              {ind.direcao === "maior" ? "maior" : "menor"}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground" title={ind.descricao}>
            {ind.descricao}
          </p>
        </div>

        {/* Interruptor: indicador desligado não entra na nota. */}
        <button
          role="switch"
          aria-checked={cfg.ativo}
          aria-label={`${cfg.ativo ? "Desativar" : "Ativar"} ${ind.label}`}
          onClick={() => onChange({ ativo: !cfg.ativo, peso: cfg.ativo ? 0 : cfg.peso || 5 })}
          className={cn(
            "relative h-5 w-9 shrink-0 rounded-full transition-colors",
            cfg.ativo ? "bg-brand-green" : "bg-[#cbd5dd]",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
              cfg.ativo ? "left-0.5 translate-x-4" : "left-0.5",
            )}
          />
        </button>
      </div>

      {cfg.ativo && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {/* Meta. */}
          <div>
            <label className="mb-1 block text-[12px] font-medium text-muted-foreground">Meta</label>
            <div className="relative">
              <input
                type="number"
                value={cfg.meta}
                min={ind.min}
                max={ind.max}
                step={passoMeta}
                onChange={(e) => onChange({ meta: Number(e.target.value) })}
                className="h-9 w-full rounded-lg border border-border bg-white pl-2.5 pr-12 text-[13px] font-mono outline-none focus:border-accent"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                {UNIDADE_SUFIXO[ind.unidade]}
              </span>
            </div>
          </div>

          {/* Peso. */}
          <div>
            <label className="mb-1 flex items-center justify-between text-[12px] font-medium text-muted-foreground">
              <span>Peso</span>
              <span className="font-mono text-foreground">
                {cfg.peso}
                <span className="ml-0.5 text-muted-foreground">({participacao}% da nota)</span>
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={30}
              value={cfg.peso}
              onChange={(e) => onChange({ peso: Number(e.target.value) })}
              aria-label={`Peso de ${ind.label}`}
              className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-secondary accent-[color:var(--brand-navy)]"
              style={{ accentColor: CATEGORIA_COR[ind.categoria] }}
            />
          </div>
        </div>
      )}

      {!cfg.ativo && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Fora da nota. Meta sugerida: {fmt(cfg.meta)} {UNIDADE_SUFIXO[ind.unidade]}.
        </p>
      )}
    </div>
  );
}
