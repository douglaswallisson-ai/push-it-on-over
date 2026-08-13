import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/lib/router-compat";
import {
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
import { Card, DataTable, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { ScoreGauge } from "@/components/ss/ui/gauges";
import { BusInspection, HOTSPOTS } from "@/components/ss/frota/BusInspection";
import { ManutencaoKanban } from "@/components/ss/frota/ManutencaoKanban";
import { TelemetriaEquipamentos } from "@/components/ss/frota/TelemetriaEquipamentos";
import { HistoricoConducao } from "@/components/ss/frota/HistoricoConducao";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { MANUTENCAO_COLUNAS, kanbanManutencaoQuery, manutencaoQuery, nf } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { CardManutencao } from "@/types";

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
  { id: "consumiveis", label: "Consumíveis", icon: Fuel },
  { id: "telemetria", label: "Telemetria", icon: Activity },
  { id: "predicoes", label: "Predições", icon: Sparkles },
  { id: "historico", label: "Histórico", icon: History },
] as const;

type TabId = (typeof TABS)[number]["id"];

const BUS_PHOTO: string | null = "/onibus.webp";

export default function Manutencao() {
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
  const cards = useMemo(() => kanbanQ.data ?? [], [kanbanQ.data]);

  // Atalho vindo de outra tela: /app/frota/manutencao?placa=EBZ3590
  useEffect(() => {
    if (!placaUrl || !cards.length) return;
    const alvo = cards.find((c) => c.placa.toUpperCase() === placaUrl.toUpperCase());
    if (alvo) setSelecionado(alvo);
  }, [placaUrl, cards]);

  return (
    <>
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
          ) : undefined
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        {/* Abas. */}
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

        {tab === "geral" &&
          (selecionado ? (
            <DetalheVeiculo card={selecionado} />
          ) : (
            <VisaoGeral
              cards={cards}
              carregando={kanbanQ.isPending}
              erro={kanbanQ.error}
              onRetry={() => kanbanQ.refetch()}
              onSelect={setSelecionado}
            />
          ))}

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

function DetalheVeiculo({ card }: { card: CardManutencao }) {
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
          <ScoreGauge score={Math.round(manut?.indiceSaude ?? card.indiceSaude)} size={64} />
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
        <div className="text-right">
          <p className="text-[11.5px] text-muted-foreground">Serviço a executar</p>
          <p className="max-w-[380px] text-[13.5px] font-medium text-foreground">{card.servico}</p>
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
                        <button className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-navy hover:text-brand-blue">
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
        <Pill tone={c.indiceSaude >= 70 ? "green" : c.indiceSaude >= 50 ? "gold" : "coral"}>{c.indiceSaude}</Pill>
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
