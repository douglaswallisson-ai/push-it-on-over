import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Factory,
  FileWarning,
  Gauge,
  Pencil,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { CrudSheet, type Campo } from "@/components/ss/cadastro/CrudSheet";
import {
  modelosQuery,
  montadorasQuery,
  nf,
  parametrosCatalogoQuery,
  regrasAjusteQuery,
} from "@/lib/queries";
import { registrarAuditoria } from "@/lib/session";
import {
  STATUS_DADO_LABEL,
  STATUS_DADO_TOM,
  TIPO_OPERACAO_LABEL,
  type ModeloVeiculo,
  CAMADA_LABEL,
  type CamadaManutencao,
  type ParametroManutencao,
  type StatusDado,
  type TipoOperacao,
} from "@/types";
import { cn } from "@/lib/utils";

/**
 * Catálogo de manutenção do fabricante.
 *
 * Guarda o que cada montadora exige por modelo, e é a partir daqui que a
 * manutenção preventiva sabe quando um veículo precisa entrar na oficina.
 *
 * Duas decisões estruturais:
 *
 * 1. **A procedência de cada número fica visível.** Se o sistema mandar trocar
 *    o óleo em 45.000 km, o cliente seguir e o motor quebrar com garantia
 *    negada, a pergunta vai ser de onde saiu o número. Parâmetro sem fonte
 *    oficial não dispara alerta — vira pendência de confirmação.
 * 2. **O intervalo varia por tipo de operação.** O mesmo motor Scania DC13 vai
 *    de 20.000 km em construção a 120.000 km em longa distância leve. Um plano
 *    por modelo sem tipo de operação erraria por um fator de seis.
 */

// Reaproveita o tom definido no tipo, para a tela não divergir do domínio.
const STATUS_TONE = STATUS_DADO_TOM;

const CAMPOS_PARAM: Campo<ParametroManutencao>[] = [
  { nome: "sistema", label: "Sistema", tipo: "select", obrigatorio: true, opcoes: ["Motor", "Alimentação", "Admissão", "Transmissão", "Eixo", "Freios", "Arrefecimento", "Ar comprimido", "Pós-tratamento", "Direção", "Pneus", "Carroceria", "Tração", "Segurança", "Geral"] },
  { nome: "item", label: "Item", tipo: "texto", obrigatorio: true, full: true },
  { nome: "acao", label: "Ação", tipo: "select", obrigatorio: true, opcoes: ["Trocar", "Inspecionar", "Trocar/Inspecionar", "Drenar", "Reapertar", "Lubrificar"] },
  { nome: "intervaloKm", label: "Intervalo", tipo: "numero", sufixo: "km", hint: "Deixe vazio se o item não é controlado por quilometragem." },
  { nome: "intervaloMeses", label: "Intervalo", tipo: "numero", sufixo: "meses" },
  { nome: "intervaloHoras", label: "Intervalo", tipo: "numero", sufixo: "horas", hint: "O disparo é o que ocorrer primeiro entre os três." },
  { nome: "especificacao", label: "Especificação do fluido ou peça", tipo: "texto", full: true },
  { nome: "obsUsoSevero", label: "Observação de uso severo", tipo: "textarea", full: true },
  { nome: "fonte", label: "Fonte", tipo: "texto", full: true, hint: "De onde veio o número. Obrigatório para virar regra de produção." },
  { nome: "ativo", label: "Parâmetro ativo", tipo: "toggle" },
];

export default function CatalogoManutencao() {
  const montadorasQ = useQuery(montadorasQuery());
  const modelosQ = useQuery(modelosQuery());
  const parametrosQ = useQuery(parametrosCatalogoQuery());
  const regrasQ = useQuery(regrasAjusteQuery());

  const [expandida, setExpandida] = useState<string | null>("mt-scania");
  const [modeloAberto, setModeloAberto] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  /**
   * Filtro por camada.
   *
   * Ônibus encarroçado acumula dois planos, com fornecedores diferentes: o
   * chassi segue a montadora, a carroceria segue a encarroçadora. Misturar os
   * dois numa lista só esconde que o filtro do ar-condicionado é semanal
   * enquanto o óleo do motor é a cada 30 mil km.
   */
  const [camada, setCamada] = useState<CamadaManutencao | "todas">("todas");
  const [soPendentes, setSoPendentes] = useState(false);
  const [locais, setLocais] = useState<ParametroManutencao[] | null>(null);
  const [editando, setEditando] = useState<ParametroManutencao | null>(null);
  const [sheetAberto, setSheetAberto] = useState(false);

  const montadoras = montadorasQ.data ?? [];
  const modelos = modelosQ.data ?? [];
  const parametros = useMemo(() => locais ?? parametrosQ.data ?? [], [locais, parametrosQ.data]);
  // Camada filtra antes de qualquer outra coisa: chassi e carroceria são
  // planos independentes, e ver os dois juntos raramente é o que se quer.
  const porCamada = (p: ParametroManutencao) =>
    camada === "todas" || (p.camada ?? "chassi") === camada;

  const paramsDo = (modeloId: string) => parametros.filter((p) => p.modeloId === modeloId);

  /** Modelo sem nenhum parâmetro utilizável é pendência de configuração. */
  const pendente = (m: ModeloVeiculo) => {
    const ps = paramsDo(m.id);
    if (m.pendenteConfiguracao) return true;
    if (ps.length === 0) return true;
    return ps.every((p) => p.statusDado === "nao_localizado" || (!p.intervaloKm && !p.intervaloMeses && !p.intervaloHoras));
  };

  const modelosPendentes = modelos.filter(pendente);

  const modelosFiltrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return modelos.filter((m) => {
      if (soPendentes && !pendente(m)) return false;
      if (!t) return true;
      const mont = montadoras.find((x) => x.id === m.montadoraId)?.nome ?? "";
      return m.nome.toLowerCase().includes(t) || (m.motor ?? "").toLowerCase().includes(t) || mont.toLowerCase().includes(t);
    });
  }, [modelos, montadoras, busca, soPendentes, parametros]);

  const totalOficial = parametros.filter((p) => p.statusDado === "oficial").length;
  const totalNaoLocalizado = parametros.filter((p) => p.statusDado === "nao_localizado").length;

  const salvarParam = (v: Partial<ParametroManutencao>) => {
    if (!editando) return;
    setLocais(parametros.map((p) => (p.id === editando.id ? ({ ...p, ...v } as ParametroManutencao) : p)));
    registrarAuditoria("catalogo_manutencao", `Parâmetro alterado: ${v.item ?? editando.item}.`);
    toast.success("Parâmetro atualizado.");
    setSheetAberto(false);
  };

  if (montadorasQ.error) {
    return (
      <>
        <PageHeader title="Catálogo de manutenção" subtitle="Administração" />
        <div className="mx-auto max-w-[1360px] px-6 py-6">
          <ErrorBox error={montadorasQ.error} onRetry={() => montadorasQ.refetch()} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Catálogo de manutenção"
        subtitle="Administração › Parâmetros do fabricante"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Camada primeiro: define qual plano se está olhando. */}
            <div className="flex gap-1.5">
              {(["todas", "chassi", "carroceria"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCamada(c)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                    camada === c
                      ? "bg-brand-navy text-white"
                      : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {c === "todas" ? "Todas" : CAMADA_LABEL[c]}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Montadora, modelo ou motor…"
                className="h-9 w-56 rounded-lg border border-border bg-white pl-8 pr-3 text-[13px] outline-none focus:border-accent"
              />
            </div>
          </div>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-5 px-6 py-6 md:px-8">
        <div data-tour="stat" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Factory} label="Montadoras" value={nf(montadoras.length)} color="var(--brand-navy)" />
          <StatTile icon={Route} label="Modelos" value={nf(modelos.length)} color="var(--brand-sky)" />
          <StatTile icon={ShieldCheck} label="Parâmetros oficiais" value={nf(totalOficial)} color="var(--leaf)" foot="podem virar regra" />
          <StatTile
            icon={FileWarning}
            label="Aguardando confirmação"
            value={nf(totalNaoLocalizado)}
            color={totalNaoLocalizado ? "var(--gold)" : "var(--leaf)"}
            foot="sem fonte oficial"
          />
        </div>

        {/* Pendências — é o que o admin precisa ver primeiro. */}
        {modelosPendentes.length > 0 && (
          <div data-tour="pendencias" className="rounded-xl border border-gold-line bg-gold-tint/40 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-gold">
                  {modelosPendentes.length} modelo{modelosPendentes.length > 1 ? "s" : ""} sem parâmetro utilizável
                </p>
                <p className="mt-1 text-[13px] text-gold/90">
                  Veículos desses modelos não geram alerta de preventiva. Ou o modelo foi criado automaticamente no
                  cadastro de um veículo, ou o número não foi localizado em fonte pública — nesse caso, confirme com a
                  concessionária antes de virar regra.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {modelosPendentes.slice(0, 8).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setExpandida(m.montadoraId);
                        setModeloAberto(m.id);
                        setSoPendentes(false);
                      }}
                      className="rounded-full bg-white/70 px-2.5 py-1 text-[12px] font-medium text-gold hover:bg-white"
                    >
                      {montadoras.find((x) => x.id === m.montadoraId)?.nome} · {m.nome}
                    </button>
                  ))}
                  {modelosPendentes.length > 8 && (
                    <button
                      onClick={() => setSoPendentes(true)}
                      className="rounded-full px-2.5 py-1 text-[12px] font-medium text-gold underline"
                    >
                      ver todos os {modelosPendentes.length}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => setSoPendentes((v) => !v)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              soPendentes ? "bg-gold text-white" : "border border-border bg-white text-muted-foreground hover:bg-secondary",
            )}
          >
            {soPendentes ? "Mostrando só pendentes" : "Mostrar só pendentes"}
          </button>
        </div>

        {/* Montadoras → modelos → parâmetros. */}
        {modelosQ.isPending ? (
          <Card title="Carregando" icon={Factory}>
            <SkeletonRows rows={6} />
          </Card>
        ) : (
          <div data-tour="arvore" className="space-y-3">
            {montadoras.map((mont) => {
              const seus = modelosFiltrados.filter((m) => m.montadoraId === mont.id);
              if (!seus.length) return null;
              const aberta = expandida === mont.id;
              const pendentesAqui = seus.filter(pendente).length;

              return (
                <div key={mont.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  <button
                    onClick={() => setExpandida(aberta ? null : mont.id)}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-secondary/50"
                  >
                    {aberta ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <Factory className="h-4 w-4 shrink-0 text-brand-navy" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-foreground">{mont.nome}</span>
                      <span className="block text-[12px] text-muted-foreground">
                        {mont.tipo === "chassi" ? "Chassi" : mont.tipo === "carroceria" ? "Carroceria" : "Encarroçado"} ·{" "}
                        {seus.length} modelo{seus.length > 1 ? "s" : ""}
                      </span>
                    </span>
                    {pendentesAqui > 0 && (
                      <Pill tone="gold">
                        {pendentesAqui} pendente{pendentesAqui > 1 ? "s" : ""}
                      </Pill>
                    )}
                  </button>

                  {aberta && (
                    <div className="border-t border-border">
                      {seus.map((mod) => {
                        const ps = paramsDo(mod.id);
                        const abertoModelo = modeloAberto === mod.id;
                        const pend = pendente(mod);

                        return (
                          <div key={mod.id} className="border-b border-border last:border-b-0">
                            <button
                              onClick={() => setModeloAberto(abertoModelo ? null : mod.id)}
                              className={cn(
                                "flex w-full items-center gap-3 px-5 py-3 pl-12 text-left transition-colors hover:bg-secondary/40",
                                abertoModelo && "bg-secondary/30",
                              )}
                            >
                              {abertoModelo ? (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                              {mod.propulsao === "eletrico" && <Zap className="h-3.5 w-3.5 shrink-0 text-gold" />}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-medium text-foreground">{mod.nome}</span>
                                <span className="block truncate text-[12px] text-muted-foreground">
                                  {mod.motor ?? "—"}
                                  {mod.anos ? ` · ${mod.anos}` : ""}
                                  {mod.faseProconve ? ` · ${mod.faseProconve}` : ""}
                                </span>
                              </span>
                              {mod.pendenteConfiguracao && <Pill tone="coral">criado automaticamente</Pill>}
                              <Pill tone={pend ? "gold" : "green"}>
                                {ps.length} parâmetro{ps.length === 1 ? "" : "s"}
                              </Pill>
                            </button>

                            {abertoModelo && (
                              <div className="bg-secondary/20 px-5 py-4 pl-12">
                                {ps.length === 0 ? (
                                  <EmptyNote>
                                    Nenhum parâmetro cadastrado. Enquanto isso, veículos deste modelo não geram alerta de
                                    manutenção preventiva.
                                  </EmptyNote>
                                ) : (
                                  <ul className="space-y-2">
                                    {ps.map((p) => (
                                      <ItemParametro
                                        key={p.id}
                                        p={p}
                                        onEditar={() => {
                                          setEditando(p);
                                          setSheetAberto(true);
                                        }}
                                      />
                                    ))}
                                  </ul>
                                )}

                                <button
                                  onClick={() => {
                                    setEditando({
                                      id: `pm${Date.now()}`,
                                      modeloId: mod.id,
                                      tipoOperacao: null,
                                      sistema: "Motor",
                                      item: "",
                                      acao: "Trocar",
                                      intervaloKm: null,
                                      intervaloMeses: null,
                                      intervaloHoras: null,
                                      statusDado: "oficial",
                                      ativo: true,
                                    });
                                    setSheetAberto(true);
                                  }}
                                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[13px] font-medium text-brand-navy hover:bg-secondary"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Novo parâmetro
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Regras de ajuste — o que torna o plano adaptativo. */}
        <Card
          title="Ajuste automático pela operação"
          icon={Gauge}
          action={<Pill tone="sky">{(regrasQ.data ?? []).filter((r) => r.ativa).length} regras ativas</Pill>}
          bodyClassName="p-4"
        >
          <p className="mb-3 text-[13px] text-muted-foreground">
            O intervalo do catálogo é o ponto de partida. Estas regras encurtam o prazo quando a telemetria mostra
            operação mais severa que a prevista — é o que os fabricantes vendem como plano flexível, usando dados que o
            sistema já coleta.
          </p>
          <ul className="space-y-2">
            {(regrasQ.data ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card p-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-foreground">{r.nome}</span>
                  <span className="block text-[12px] text-muted-foreground">{r.fonte}</span>
                </span>
                <span className="shrink-0 font-mono text-[12px] text-ink-soft">
                  {r.indicador} {r.operador === "maior_que" ? ">" : "<"} {r.limiar}
                </span>
                {r.fator !== 1 && (
                  <Pill tone="gold">intervalo × {r.fator}</Pill>
                )}
                <Pill tone={r.ativa ? "green" : "neutral"}>{r.ativa ? "Ativa" : "Inativa"}</Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {editando && (
        <CrudSheet<ParametroManutencao>
          aberto={sheetAberto}
          onFechar={() => setSheetAberto(false)}
          titulo={editando.item ? `Editar — ${editando.item}` : "Novo parâmetro"}
          campos={CAMPOS_PARAM}
          valor={editando}
          editando={editando}
          onSalvar={salvarParam}
          onExcluir={(p) => {
            setLocais(parametros.filter((x) => x.id !== p.id));
            registrarAuditoria("catalogo_manutencao", `Parâmetro excluído: ${p.item}.`);
            setSheetAberto(false);
            toast.success("Parâmetro excluído.");
          }}
        />
      )}
    </>
  );
}

function ItemParametro({ p, onEditar }: { p: ParametroManutencao; onEditar: () => void }) {
  const semIntervalo = !p.intervaloKm && !p.intervaloMeses && !p.intervaloHoras;

  return (
    <li className="rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[12px] font-semibold text-ink-soft">
              {p.sistema}
            </span>
            <span className="text-[13px] font-medium text-foreground">{p.item}</span>
            <span className="text-[12px] text-muted-foreground">· {p.acao}</span>
          </div>

          {p.especificacao && (
            <p className="mt-1 text-[12px] text-muted-foreground">{p.especificacao}</p>
          )}
        </div>

        <button
          onClick={onEditar}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
          aria-label="Editar parâmetro"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {/* Disparo: o que ocorrer primeiro entre os três. */}
        {semIntervalo ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-gold">
            <AlertTriangle className="h-3.5 w-3.5" />
            sem intervalo definido
          </span>
        ) : (
          <span className="inline-flex flex-wrap items-center gap-2 font-mono text-[13px]">
            {p.intervaloKm && <span className="font-semibold text-foreground">{nf(p.intervaloKm)} km</span>}
            {p.intervaloKm && (p.intervaloMeses || p.intervaloHoras) && (
              <span className="text-muted-foreground">ou</span>
            )}
            {p.intervaloMeses && <span className="font-semibold text-foreground">{p.intervaloMeses} meses</span>}
            {p.intervaloMeses && p.intervaloHoras && <span className="text-muted-foreground">ou</span>}
            {p.intervaloHoras && <span className="font-semibold text-foreground">{p.intervaloHoras} h</span>}
            <span className="text-[12px] text-muted-foreground">— o que ocorrer primeiro</span>
          </span>
        )}

        {p.tipoOperacao && (
          <span className="inline-flex items-center gap-1 text-[12px] text-ink-soft">
            <Route className="h-3 w-3" />
            {TIPO_OPERACAO_LABEL[p.tipoOperacao as TipoOperacao]}
          </span>
        )}

        <span title={p.fonte} className="ml-auto">
          <Pill tone={STATUS_TONE[p.statusDado]}>
            {p.statusDado === "oficial" ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {STATUS_DADO_LABEL[p.statusDado]}
          </Pill>
        </span>
      </div>

      {p.obsUsoSevero && (
        <p className="mt-2 border-t border-border pt-2 text-[12px] text-muted-foreground">{p.obsUsoSevero}</p>
      )}
    </li>
  );
}
