import { useEffect, useMemo, useState } from "react";
import { usandoMock } from "@/lib/modo";
import ManutencaoReal from "@/screens/manutencao/ManutencaoReal";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/lib/router-compat";
import {
  Monitor,
  Activity,
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  Fuel,
  History,
  LayoutGrid,
  Sparkles,
  TrendingDown,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { SeloDadosExemplo } from "@/components/ss/ui/SeloDadosExemplo";
import { Card, DataTable, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { ScoreGauge } from "@/components/ss/ui/gauges";
import { BusInspection, HOTSPOTS } from "@/components/ss/frota/BusInspection";
import { ManutencaoKanban } from "@/components/ss/frota/ManutencaoKanban";
import { TelemetriaEquipamentos } from "@/components/ss/frota/TelemetriaEquipamentos";
import { PlanoPreventivo } from "@/components/ss/frota/PlanoPreventivo";
import { usePreventivaFrota } from "@/hooks/use-preventiva-frota";
import { colunaKanban } from "@/lib/preventiva";
import { acrescentar, registrarAuditoria } from "@/lib/session";
import type { PreventivaPrevista } from "@/types";
import { HistoricoConducao } from "@/components/ss/frota/HistoricoConducao";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { MANUTENCAO_COLUNAS, kanbanManutencaoQuery, manutencaoQuery, nf } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { filtrarPorGaragem } from "@/lib/escopo";
import { FiltroGaragem } from "@/components/ss/ui/FiltroGaragem";
import { useSessao } from "@/hooks/use-sessao";
import { MOCK_GARAGENS } from "@/lib/mock-data";
import { exemploOuVazio } from "@/lib/modo";
import type { CardManutencao, StatusManutencao } from "@/types";

/**
 * Manutenção. A visão geral é um kanban com todas as placas da frota; clicar
 * num card abre a inspeção visual daquele veículo (hotspots, predições e
 * componentes monitorados).
 *
 * As abas agora renderizam conteúdo distinto — antes o estado `tab` só pintava
 * o botão ativo e as cinco abas mostravam a mesma tela.
 *
 * A placa também pode vir pela URL (`?placa=ABC1D23`), que é o que permite os
 * atalhos vindos de Veículos e do histórico de condução.
 */

const TABS = [
  { id: "geral", label: "Visão geral", icon: LayoutGrid },
  { id: "preventiva", label: "Plano preventivo", icon: CalendarClock },
  { id: "consumiveis", label: "Consumíveis", icon: Fuel },
  { id: "telemetria", label: "Telemetria", icon: Activity },
  { id: "predicoes", label: "Predições", icon: Sparkles },
  { id: "historico", label: "Histórico", icon: History },
] as const;

type TabId = (typeof TABS)[number]["id"];

const BUS_PHOTO: string | null = "/onibus.webp";

/** Com a API ligada, a manutenção é a real; o quadro abaixo fica para o modo demonstração. */
export default function Manutencao() {
  return usandoMock() ? <ManutencaoExemplo /> : <ManutencaoReal />;
}

function ManutencaoExemplo() {
  const location = useLocation();
  const placaUrl = useMemo(() => {
    const s = (location as { searchStr?: string; search?: unknown }).searchStr;
    if (typeof s === "string") return new URLSearchParams(s).get("placa");
    const obj = (location as { search?: Record<string, unknown> }).search;
    const p = obj && typeof obj === "object" ? obj["placa"] : undefined;
    return typeof p === "string" ? p : null;
  }, [location]);

  const [tab, setTab] = useState<TabId>("geral");
  const [selecionado, setSelecionado] = useState<CardManutencao | null>(null);

  const kanbanQ = useQuery(kanbanManutencaoQuery());

  /**
   * Mudanças de status feitas na sessão (agendar / liberar). Ficam por cima do
   * que veio da API para o quadro refletir a ação na hora.
   */
  const [ajustes, setAjustes] = useState<Record<string, StatusManutencao>>({});
  const { sessao } = useSessao();
  const [garagem, setGaragem] = useState("");

  // Preventiva calculada pelo catálogo. O mesmo resultado alimenta a aba
  // "Plano preventivo" e o quadro — calcular nos dois lugares abriria espaço
  // para o kanban e a lista discordarem sobre a mesma placa.
  const { porVeiculo } = usePreventivaFrota(garagem || undefined);
  const [agendadas, setAgendadas] = useState<Record<string, boolean>>({});

  /**
   * Modo TV: o quadro vive num telão de oficina, onde ninguém interage. Sem
   * ele, o gestor precisa lembrar de atualizar a página — e um quadro
   * congelado é pior que nenhum, porque parece atual.
   */
  const [modoTV, setModoTV] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(() => new Date());

  useEffect(() => {
    if (!modoTV) return;
    const t = setInterval(() => {
      kanbanQ.refetch();
      setAtualizadoEm(new Date());
    }, 60_000);
    return () => clearInterval(t);
  }, [modoTV]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sair com Esc, porque no modo TV a barra lateral some.
  useEffect(() => {
    if (!modoTV) return;
    const sair = (e: KeyboardEvent) => e.key === "Escape" && setModoTV(false);
    window.addEventListener("keydown", sair);
    return () => window.removeEventListener("keydown", sair);
  }, [modoTV]);

  const cards = useMemo(() => {
    const comAjuste = (kanbanQ.data ?? []).map((c) =>
      ajustes[c.veiculoId] ? { ...c, status: ajustes[c.veiculoId] } : c,
    );
    // O kanban traz o nome da garagem; o escopo trabalha com id.
    // Garagens do exemplo servem só ao modo sem API: em modo real o escopo é
    // aplicado pelo servidor, e traduzir nome para id de uma lista fixa
    // associaria o veículo a uma garagem que não é a dele.
    const idPorNome = new Map(exemploOuVazio(MOCK_GARAGENS).map((g) => [g.nome, g.id]));
    const noEscopo = filtrarPorGaragem(comAjuste, sessao, (c) => (c.garagem ? idPorNome.get(c.garagem) : undefined));
    const filtrados = garagem
      ? noEscopo.filter((c) => (c.garagem ? idPorNome.get(c.garagem) : undefined) === garagem)
      : noEscopo;

    /**
     * Todo veículo cadastrado precisa aparecer no quadro.
     *
     * Antes o quadro só listava o que existia na base fixa de cartões: veículo
     * cadastrado depois nunca aparecia, mesmo com preventiva vencida — ficava
     * invisível justamente para quem precisava agir.
     *
     * Agora a lista de cartões é a frota inteira; quem não tem cartão pronto
     * ganha um derivado do próprio veículo.
     */
    const comCartao = new Set(filtrados.map((c) => c.veiculoId));
    const semCartao: CardManutencao[] = porVeiculo
      .filter((p) => !comCartao.has(p.veiculo.id))
      .map((p) => ({
        veiculoId: p.veiculo.id,
        placa: p.veiculo.placa,
        marca: p.veiculo.marca,
        modelo: p.veiculo.modelo,
        status: "em_dia" as StatusManutencao,
        servico: p.semCatalogo ? "Modelo sem parâmetro cadastrado" : "Nenhuma pendência",
        prazoDias: null,
        // Sem histórico de falha, a saúde parte de 100 e só cai com pendência
        // real. Inventar um número intermediário daria falsa impressão.
        indiceSaude: p.semCatalogo ? 0 : 100,
        custoEstimado: null,
        pendencias: 0,
        garagem: undefined,
      }));

    // A preventiva calculada tem precedência sobre o status estático: ela vem
    // do parâmetro do fabricante cruzado com o odômetro real. Ajuste manual do
    // operador continua vencendo os dois — quem está na oficina sabe mais que
    // o cálculo.
    return [...filtrados, ...semCartao].map((c) => {
      if (ajustes[c.veiculoId]) return c;

      const calc = porVeiculo.find((p) => p.veiculo.id === c.veiculoId);
      const top = calc?.preventivas[0];
      if (!top || top.urgencia === "em_dia" || top.urgencia === "programada") return c;

      const agendado = agendadas[`${c.veiculoId}-${top.parametroId}`];
      const coluna = agendado ? "preventiva" : colunaKanban(top.urgencia);

      return {
        ...c,
        status: coluna as CardManutencao["status"],
        servico: agendado ? `${top.item} — agendada` : top.item,
        prazoDias: top.diasRestante ?? (top.kmRestante !== null && top.kmRestante < 0 ? -1 : null),
        pendencias: calc?.preventivas.filter((x) => x.urgencia === "vencida" || x.urgencia === "critica").length ?? 0,
      };
    });
  }, [kanbanQ.data, ajustes, sessao, garagem, porVeiculo, agendadas]);

  /**
   * Agendar gera a ordem de serviço e move o card para Preventiva. Antes o
   * botão marcava um estado local e o quadro seguia mostrando o veículo como
   * se nada tivesse sido feito.
   */
  const agendarPreventiva = (veiculoId: string, p: PreventivaPrevista, prefixo: string) => {
    const numero = `OS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

    acrescentar("ordens-servico", {
      id: `os${Date.now()}`,
      numero,
      veiculoId,
      abertaEm: new Date().toISOString(),
      status: "aberta",
      tipo: "preventiva",
      origem: "plano",
      descricao: p.item,
      oficina: "A definir",
      interna: true,
      itens: [],
      custoPrevisto: 0,
      odometro: porVeiculo.find((x) => x.veiculo.id === veiculoId)?.veiculo.odometro ?? 0,
      parametroId: p.parametroId,
    });

    setAgendadas((a) => ({ ...a, [`${veiculoId}-${p.parametroId}`]: true }));
    registrarAuditoria(
      "manutencao_preventiva",
      `Preventiva agendada — ${prefixo}: ${p.item}. ${numero}${p.intervaloAplicadoKm ? ` · intervalo ${nf(p.intervaloAplicadoKm)} km` : ""}.`,
    );
    toast.success(`${numero} aberta.`, {
      description: `${prefixo} · ${p.item} — o veículo passou para Preventiva no quadro.`,
    });
  };

  const mudarStatus = (card: CardManutencao, status: StatusManutencao, mensagem: string) => {
    setAjustes((a) => ({ ...a, [card.veiculoId]: status }));
    setSelecionado((s) => (s && s.veiculoId === card.veiculoId ? { ...s, status } : s));
    toast.success(mensagem, { description: `${card.placa} · ${card.marca} ${card.modelo}` });
  };

  // Atalho vindo de outra tela: /app/manutencao?placa=EBZ3590
  useEffect(() => {
    if (!placaUrl || !cards.length) return;
    const alvo = cards.find((c) => c.placa.toUpperCase() === placaUrl.toUpperCase());
    if (alvo) setSelecionado(alvo);
  }, [placaUrl, cards]);

  return (
    <>
      {/* Modo TV: ocupa a tela inteira, sem menu nem interação. */}
      {modoTV && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-canvas">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-8 py-4">
            <div>
              <h1 className="font-display text-[26px] font-bold leading-none text-foreground">
                Torre de controle · Manutenção
              </h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                {cards.length} veículos · atualizado às{" "}
                {atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · recarrega a cada
                minuto
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Resumo grande, legível do fundo da oficina. */}
              <div className="flex gap-5">
                {MANUTENCAO_COLUNAS.map((col) => {
                  const n = cards.filter((c) => c.status === col.id).length;
                  return (
                    <div key={col.id} className="text-right">
                      <div className="font-display text-[30px] font-bold leading-none" style={{ color: col.cor }}>
                        {n}
                      </div>
                      <div className="mt-1 text-[11.5px] text-muted-foreground">{col.label}</div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setModoTV(false)}
                className="rounded-full border border-border px-4 py-2 text-[13px] font-medium text-muted-foreground hover:bg-secondary"
              >
                Sair (Esc)
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
            <ManutencaoKanban cards={cards} onSelect={() => {}} modoTV />
          </div>
        </div>
      )}

      <PageHeader
        title="Manutenção"
        subtitle={selecionado ? `Frota › Manutenção › ${selecionado.placa}` : "Frota › Manutenção"}
        actions={
          selecionado ? (
            <button
              onClick={() => setSelecionado(null)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao quadro
            </button>
          ) : (
            <button
              onClick={() => setModoTV(true)}
              title="Leitura à distância, com atualização automática"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary"
            >
              <Monitor className="h-3.5 w-3.5" />
              Modo TV
            </button>
          )
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        <SeloDadosExemplo motivo="O módulo de manutenção não existe no backend — catálogo, plano e ordens são funcionalidade nova." />

        {/* Abas e filtro de garagem. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-card">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-medium transition-colors",
                tab === t.id ? "bg-brand-navy text-white" : "text-muted-foreground hover:bg-secondary",
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
          </div>
          <FiltroGaragem valor={garagem} onChange={setGaragem} />
        </div>

        {tab === "geral" &&
          (selecionado ? (
            <DetalheVeiculo card={selecionado} onMudarStatus={mudarStatus} />
          ) : (
            <VisaoGeral
              cards={cards}
              carregando={kanbanQ.isPending}
              erro={kanbanQ.error}
              onRetry={() => kanbanQ.refetch()}
              onSelect={setSelecionado}
            />
          ))}

        {tab === "preventiva" && (
          <PlanoPreventivo garagem={garagem || undefined} agendadas={agendadas} onAgendar={agendarPreventiva} />
        )}

        {tab === "consumiveis" && <Consumiveis card={selecionado} />}

        {tab === "telemetria" && <TelemetriaEquipamentos />}

        {tab === "predicoes" && (
          <PredicoesFrota
            cards={cards}
            onSelect={(c) => {
              setSelecionado(c);
              setTab("geral");
            }}
          />
        )}

        {tab === "historico" && <HistoricoManutencao cards={cards} />}
      </div>
    </>
  );
}

/* ------------------------------- Visão geral ------------------------------ */

function VisaoGeral({
  cards,
  carregando,
  erro,
  onRetry,
  onSelect,
}: {
  cards: CardManutencao[];
  carregando: boolean;
  erro: unknown;
  onRetry: () => void;
  onSelect: (c: CardManutencao) => void;
}) {
  const conta = (id: string) => cards.filter((c) => c.status === id).length;
  const atrasados = cards.filter((c) => (c.prazoDias ?? 0) < 0).length;
  const custo = cards.reduce((a, c) => a + (c.custoEstimado ?? 0), 0);

  if (erro) return <ErrorBox error={erro} onRetry={onRetry} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Wrench} label="Placas na frota" value={nf(cards.length)} color="var(--brand-navy)" />
        <StatTile icon={ClipboardList} label="Em dia" value={nf(conta("em_dia"))} color="var(--leaf)" />
        <StatTile icon={CalendarClock} label="Em atraso" value={nf(atrasados)} color="var(--coral)" />
        <StatTile icon={TrendingDown} label="Custo previsto" value={`R$ ${nf(custo)}`} color="var(--gold)" />
      </div>

      {carregando ? (
        <Card title="Quadro de manutenção" icon={LayoutGrid}>
          <SkeletonRows rows={6} />
        </Card>
      ) : (
        <>
          <ManutencaoKanban cards={cards} onSelect={onSelect} />
          <p className="text-[11.5px] text-muted-foreground">
            Um card por placa. Veículo com mais de uma pendência aparece na coluna mais grave (corretiva &gt;
            preventiva &gt; preditiva) e informa as demais no rodapé do card. Clique para abrir a inspeção visual.
          </p>
        </>
      )}
    </div>
  );
}

/* ----------------------------- Detalhe do veículo ---------------------------- */

function DetalheVeiculo({
  card,
  onMudarStatus,
}: {
  card: CardManutencao;
  onMudarStatus: (c: CardManutencao, s: StatusManutencao, msg: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>("oleo");
  const comp = HOTSPOTS.find((h) => h.id === selected) ?? null;

  const manutQ = useQuery(manutencaoQuery(card.veiculoId));
  const manut = manutQ.data;
  const predicoes = manut?.predicoes ?? [];
  const componentes = manut?.componentes ?? [];

  const coluna = MANUTENCAO_COLUNAS.find((c) => c.id === card.status);

  return (
    <div className="space-y-5">
      {/* Faixa compacta do veículo — placa, situação e índice de saúde. */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-card">
        <div className="flex items-center gap-4">
          <ScoreGauge score={Math.round(manut?.indiceSaude ?? card.indiceSaude ?? 0)} size={64} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[20px] font-bold leading-none text-foreground">{card.placa}</span>
              {coluna && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                  style={{
                    background: `color-mix(in oklab, ${coluna.cor} 14%, white)`,
                    color: `color-mix(in oklab, ${coluna.cor} 82%, black)`,
                  }}
                >
                  {coluna.label}
                </span>
              )}
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {card.marca} {card.modelo}
              {card.garagem ? ` · ${card.garagem}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="text-right">
            <p className="text-[11.5px] text-muted-foreground">Serviço a executar</p>
            <p className="max-w-[380px] text-[13.5px] font-medium text-foreground">{card.servico}</p>
          </div>
          {card.status !== "liberado" && (
            <button
              onClick={() => onMudarStatus(card, "liberado", "Veículo liberado de manutenção.")}
              className="inline-flex items-center gap-2 rounded-full bg-leaf px-4 py-2 text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              <ClipboardList className="h-4 w-4" />
              Liberar veículo
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card title="Predições de manutenção" icon={CalendarClock} action={<Pill tone="sky">{card.placa}</Pill>}>
            {manutQ.error ? (
              <ErrorBox error={manutQ.error} onRetry={() => manutQ.refetch()} />
            ) : manutQ.isPending ? (
              <SkeletonRows rows={3} />
            ) : predicoes.length ? (
              <div className="space-y-3">
                {predicoes.map((p, i) => {
                  const crit = p.severidade === "critico";
                  return (
                    <div
                      key={p.titulo ?? i}
                      className={cn(
                        "rounded-xl border p-3",
                        crit ? "border-coral-line bg-coral-tint/50" : "border-gold-line bg-gold-tint/50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13.5px] font-semibold text-foreground">{p.titulo}</p>
                        <span
                          className={cn("shrink-0 font-mono text-[12px] font-bold", crit ? "text-coral" : "text-gold")}
                        >
                          {p.prazoDias} dias
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <button
                          onClick={() =>
                            onMudarStatus(
                              card,
                              crit ? "corretiva" : "preventiva",
                              `Manutenção agendada: ${p.titulo}.`,
                            )
                          }
                          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-navy hover:text-brand-blue"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          Agendar manutenção
                        </button>
                        <span className="font-mono text-[12.5px] font-semibold text-foreground">R$ {nf(p.custo)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyNote>{manut?._aviso ?? "Sem predições disponíveis para este veículo."}</EmptyNote>
            )}
          </Card>

          <Card title="Componentes monitorados" icon={TrendingDown}>
            {manutQ.isPending ? (
              <SkeletonRows rows={3} />
            ) : componentes.length ? (
              <div className="space-y-2.5">
                {componentes.map((c) => {
                  const critico = c.severidade === "critico";
                  const atencao = c.severidade === "atencao";
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                        <span
                          className={cn(
                            "inline-block h-2 w-2 rounded-full",
                            critico ? "bg-coral" : atencao ? "bg-gold" : "bg-leaf",
                          )}
                        />
                        {c.label}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[12.5px] font-semibold",
                          critico ? "text-coral" : atencao ? "text-gold" : "text-leaf",
                        )}
                      >
                        {c.valor}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyNote>Sem componentes retornados pela API.</EmptyNote>
            )}
          </Card>
        </div>

        <Card
          title="Inspeção visual"
          icon={ClipboardList}
          action={<span className="text-[12px] text-muted-foreground">clique nos componentes</span>}
        >
          <div className="rounded-xl bg-gradient-to-b from-secondary/40 to-transparent p-4">
            <BusInspection selected={selected} onSelect={setSelected} image={BUS_PHOTO} />
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-ink-soft">
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-leaf" /> Saudável
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-gold" /> Atenção
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-coral" /> Crítico
            </span>
          </div>

          {comp && (
            <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      comp.tone === "crit" ? "bg-coral-tint" : comp.tone === "warn" ? "bg-gold-tint" : "bg-leaf-tint",
                    )}
                  >
                    <comp.icon
                      className={cn(
                        "h-5 w-5",
                        comp.tone === "crit" ? "text-coral" : comp.tone === "warn" ? "text-gold" : "text-leaf",
                      )}
                    />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-foreground">{comp.label}</p>
                    <p className="font-mono text-[12px] text-muted-foreground">Leitura atual: {comp.value}</p>
                  </div>
                </div>
                <Pill tone={comp.tone === "crit" ? "coral" : comp.tone === "warn" ? "gold" : "green"}>
                  {comp.tone === "crit" ? "Crítico" : comp.tone === "warn" ? "Atenção" : "Saudável"}
                </Pill>
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{comp.detail}</p>
              <p className="mt-2 flex items-start gap-2 text-[13px] leading-relaxed text-brand-navy">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
                {comp.recomendacao}
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Quem dirigiu esta placa. */}
      <HistoricoConducao modo="veiculo" veiculoId={card.veiculoId} />
    </div>
  );
}

/* -------------------------------- Consumíveis ------------------------------- */

type ConsumivelRow = {
  item: string;
  intervalo: string;
  ultima: string;
  proxima: string;
  vidaUtil: number;
};

const CONSUMIVEIS: ConsumivelRow[] = [
  { item: "Óleo do motor", intervalo: "40.000 km", ultima: "812.400 km", proxima: "852.400 km", vidaUtil: 18 },
  { item: "Filtro de ar", intervalo: "60.000 km", ultima: "790.000 km", proxima: "850.000 km", vidaUtil: 25 },
  { item: "Filtro de combustível", intervalo: "40.000 km", ultima: "800.100 km", proxima: "840.100 km", vidaUtil: 42 },
  { item: "Arla 32", intervalo: "conforme consumo", ultima: "—", proxima: "nível 62%", vidaUtil: 62 },
  { item: "Pastilhas de freio", intervalo: "80.000 km", ultima: "760.000 km", proxima: "840.000 km", vidaUtil: 34 },
  { item: "Correia do alternador", intervalo: "120.000 km", ultima: "720.000 km", proxima: "840.000 km", vidaUtil: 28 },
];

function Consumiveis({ card }: { card: CardManutencao | null }) {
  const cols: Column<ConsumivelRow & Record<string, unknown>>[] = [
    { key: "item", header: "Item", render: (r) => <span className="font-medium text-foreground">{r.item}</span> },
    {
      key: "intervalo",
      header: "Intervalo",
      render: (r) => <span className="text-muted-foreground">{r.intervalo}</span>,
    },
    { key: "ultima", header: "Última troca", align: "right", render: (r) => <span className="font-mono">{r.ultima}</span> },
    { key: "proxima", header: "Próxima", align: "right", render: (r) => <span className="font-mono">{r.proxima}</span> },
    {
      key: "vidaUtil",
      header: "Vida útil",
      align: "right",
      render: (r) => (
        <div className="ml-auto w-28">
          <div className="flex items-center justify-end gap-2">
            <span
              className={cn(
                "font-mono text-[12.5px] font-semibold",
                r.vidaUtil < 25 ? "text-coral" : r.vidaUtil < 50 ? "text-gold" : "text-leaf",
              )}
            >
              {r.vidaUtil}%
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-1.5 rounded-full",
                r.vidaUtil < 25 ? "bg-coral" : r.vidaUtil < 50 ? "bg-gold" : "bg-leaf",
              )}
              style={{ width: `${r.vidaUtil}%` }}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <Card
      title="Consumíveis e trocas programadas"
      icon={Fuel}
      action={card ? <Pill tone="sky">{card.placa}</Pill> : <Pill tone="neutral">Selecione uma placa no quadro</Pill>}
      bodyClassName="p-4"
    >
      <DataTable columns={cols} rows={CONSUMIVEIS as (ConsumivelRow & Record<string, unknown>)[]} />
      <p className="mt-3 text-[11.5px] text-muted-foreground">
        Intervalos do plano de manutenção do fabricante, confrontados com o odômetro de telemetria.
      </p>
    </Card>
  );
}

/* --------------------------------- Predições -------------------------------- */

function PredicoesFrota({ cards, onSelect }: { cards: CardManutencao[]; onSelect: (c: CardManutencao) => void }) {
  const comPredicao = cards
    .filter((c) => c.prazoDias !== null)
    .sort((a, b) => (a.prazoDias ?? 0) - (b.prazoDias ?? 0));

  const cols: Column<CardManutencao & Record<string, unknown>>[] = [
    {
      key: "placa",
      header: "Veículo",
      render: (c) => (
        <div>
          <div className="font-mono font-semibold text-foreground">{c.placa}</div>
          <div className="text-[11.5px] text-muted-foreground">
            {c.marca} {c.modelo}
          </div>
        </div>
      ),
    },
    { key: "servico", header: "Serviço previsto" },
    {
      key: "prazoDias",
      header: "Prazo",
      align: "right",
      render: (c) => {
        const d = c.prazoDias ?? 0;
        return (
          <span className={cn("font-mono font-semibold", d < 0 ? "text-coral" : d <= 7 ? "text-gold" : "text-ink-soft")}>
            {d < 0 ? `${Math.abs(d)} d em atraso` : `${d} d`}
          </span>
        );
      },
    },
    {
      key: "custoEstimado",
      header: "Custo estimado",
      align: "right",
      render: (c) => <span className="font-mono">{c.custoEstimado ? `R$ ${nf(c.custoEstimado)}` : "—"}</span>,
    },
    {
      key: "indiceSaude",
      header: "Saúde",
      align: "center",
      render: (c) => (
        <Pill tone={(c.indiceSaude ?? 0) >= 70 ? "green" : (c.indiceSaude ?? 0) >= 50 ? "gold" : "coral"}>{c.indiceSaude}</Pill>
      ),
    },
  ];

  return (
    <Card title="Predições da frota" icon={Sparkles} bodyClassName="p-4">
      {comPredicao.length ? (
        <DataTable
          columns={cols}
          rows={comPredicao as (CardManutencao & Record<string, unknown>)[]}
          onRowClick={(c) => onSelect(c)}
        />
      ) : (
        <EmptyNote>Nenhuma predição aberta na frota.</EmptyNote>
      )}
    </Card>
  );
}

/* --------------------------------- Histórico -------------------------------- */

type HistRow = { data: string; placa: string; servico: string; tipo: string; custo: number; responsavel: string };

const HISTORICO: HistRow[] = [
  { data: "09/08/2026", placa: "SB157940", servico: "Troca de óleo e filtros", tipo: "Preventiva", custo: 1240, responsavel: "Oficina Central" },
  { data: "05/08/2026", placa: "GAP4C73", servico: "Revisão do sistema de freios", tipo: "Preventiva", custo: 2180, responsavel: "Oficina Central" },
  { data: "28/07/2026", placa: "EBZ3590", servico: "Substituição do sensor de rotação", tipo: "Corretiva", custo: 890, responsavel: "Terceirizada RJ" },
  { data: "21/07/2026", placa: "LUO5I08", servico: "Reparo no radiador", tipo: "Corretiva", custo: 1560, responsavel: "Oficina CIC" },
  { data: "14/07/2026", placa: "BCA7A56", servico: "Alinhamento e balanceamento", tipo: "Preventiva", custo: 420, responsavel: "Oficina Central" },
  { data: "02/07/2026", placa: "AYK7080", servico: "Troca da correia dentada", tipo: "Preditiva", custo: 1980, responsavel: "Oficina Zona Leste" },
];

function HistoricoManutencao({ cards }: { cards: CardManutencao[] }) {
  const total = HISTORICO.reduce((a, h) => a + h.custo, 0);

  const cols: Column<HistRow & Record<string, unknown>>[] = [
    { key: "data", header: "Data", render: (h) => <span className="font-mono text-ink-soft">{h.data}</span> },
    {
      key: "placa",
      header: "Veículo",
      render: (h) => <span className="font-mono font-semibold text-foreground">{h.placa}</span>,
    },
    { key: "servico", header: "Serviço" },
    {
      key: "tipo",
      header: "Tipo",
      render: (h) => (
        <Pill tone={h.tipo === "Corretiva" ? "coral" : h.tipo === "Preventiva" ? "gold" : "sky"}>{h.tipo}</Pill>
      ),
    },
    {
      key: "responsavel",
      header: "Executado por",
      render: (h) => <span className="text-muted-foreground">{h.responsavel}</span>,
    },
    {
      key: "custo",
      header: "Custo",
      align: "right",
      render: (h) => <span className="font-mono font-semibold">R$ {nf(h.custo)}</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={History} label="Ordens no período" value={nf(HISTORICO.length)} color="var(--brand-navy)" />
        <StatTile icon={TrendingDown} label="Custo total" value={`R$ ${nf(total)}`} color="var(--gold)" />
        <StatTile
          icon={Wrench}
          label="Corretivas"
          value={nf(HISTORICO.filter((h) => h.tipo === "Corretiva").length)}
          color="var(--coral)"
        />
        <StatTile
          icon={ClipboardList}
          label="Placas atendidas"
          value={nf(new Set(HISTORICO.map((h) => h.placa)).size)}
          color="var(--leaf)"
        />
      </div>

      <Card title="Histórico de manutenções" icon={History} bodyClassName="p-4">
        <DataTable columns={cols} rows={HISTORICO as (HistRow & Record<string, unknown>)[]} />
        <p className="mt-3 text-[11.5px] text-muted-foreground">{cards.length} placas na frota · últimos 60 dias.</p>
      </Card>
    </div>
  );
}
