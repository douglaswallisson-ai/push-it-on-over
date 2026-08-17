import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, MapPin, Plus, Route, Search, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Dot, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { CrudSheet, type Campo } from "@/components/ss/cadastro/CrudSheet";
import { gruposLinhasQuery, itinerariosQuery, linhasApiQuery, linhasQuery, nf, pontosQuery } from "@/lib/queries";
import { usandoMock } from "@/lib/modo";
import { SeloDadosExemplo } from "@/components/ss/ui/SeloDadosExemplo";
import { registrarAuditoria } from "@/lib/session";
import { MODALIDADE_LABEL, type Linha, type Modalidade } from "@/types";

/**
 * Cadastro de linhas.
 *
 * A linha é o eixo da operação de passageiros: programação, indicadores e
 * alarmes operacionais dependem dela existir. Abrir uma linha mostra seus
 * itinerários (ida, volta ou circular) com as paradas em ordem.
 */

const CAMPOS: Campo<Linha>[] = [
  { nome: "codigo", label: "Código da linha", tipo: "texto", obrigatorio: true, placeholder: "8207-01" },
  { nome: "nome", label: "Denominação", tipo: "texto", obrigatorio: true, full: true, placeholder: "Terminal Central / Terminal Pinheiros" },
  { nome: "modalidade", label: "Modalidade", tipo: "select", obrigatorio: true, opcoes: ["publico", "fretamento", "carga"], hint: "Público usa programação e headway; fretamento usa contrato." },
  { nome: "operadora", label: "Operadora / contratante", tipo: "texto" },
  { nome: "tarifa", label: "Tarifa", tipo: "numero", sufixo: "R$", hint: "Aplicável ao transporte público." },
  { nome: "cor", label: "Cor no mapa", tipo: "cor" },
  { nome: "ativa", label: "Linha ativa", tipo: "toggle" },
];

const NOVA: Partial<Linha> = { modalidade: "publico", ativa: true, cor: "#1B3A6B", tarifa: 5.2 };

export default function Linhas() {
  const mockLinhasQ = useQuery(linhasQuery());
  const apiLinhasQ = useQuery(linhasApiQuery());
  const linhasQ = usandoMock() ? mockLinhasQ : apiLinhasQ;
  const gruposQ = useQuery(gruposLinhasQuery());
  const itinerariosQ = useQuery(itinerariosQuery());
  const pontosQ = useQuery(pontosQuery());

  const [locais, setLocais] = useState<Linha[] | null>(null);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Linha | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);

  const linhas = useMemo(() => locais ?? linhasQ.data ?? [], [locais, linhasQ.data]);
  const grupoNome = useMemo(
    () => new Map((gruposQ.data ?? []).map((g) => [g.id, g.nome])),
    [gruposQ.data],
  );
  const pontoNome = useMemo(() => new Map((pontosQ.data ?? []).map((p) => [p.id, p])), [pontosQ.data]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return linhas;
    return linhas.filter(
      (l) =>
        l.codigo.toLowerCase().includes(t) ||
        l.nome.toLowerCase().includes(t) ||
        (l.operadora ?? "").toLowerCase().includes(t),
    );
  }, [linhas, busca]);

  const COLS: Column<Linha & Record<string, unknown>>[] = [
    {
      key: "codigo",
      header: "Linha",
      render: (l) => (
        <div className="flex items-center gap-3">
          <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: l.cor }} />
          <div>
            <div className="font-mono text-[13px] font-bold text-foreground">{l.codigo}</div>
            <div className="max-w-[280px] truncate text-[11.5px] text-muted-foreground">{l.nome}</div>
          </div>
        </div>
      ),
    },
    {
      key: "modalidade",
      header: "Modalidade",
      render: (l) => (
        <Pill tone={l.modalidade === "publico" ? "sky" : l.modalidade === "fretamento" ? "green" : "gold"}>
          {MODALIDADE_LABEL[l.modalidade as Modalidade]}
        </Pill>
      ),
    },
    { key: "operadora", header: "Operadora", render: (l) => <span className="text-[12.5px]">{l.operadora ?? "—"}</span> },
    {
      key: "grupoId",
      header: "Grupo",
      render: (l) => <span className="text-[12.5px] text-muted-foreground">{l.grupoId ? grupoNome.get(l.grupoId) ?? "—" : "—"}</span>,
    },
    {
      key: "itinerarios",
      header: "Itinerários",
      align: "center",
      render: (l) => {
        const n = (itinerariosQ.data ?? []).filter((i) => i.linhaId === l.id).length;
        return n ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandida(expandida === l.id ? null : l.id);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[12px] font-medium text-brand-navy transition-colors hover:bg-secondary"
          >
            <Route className="h-3.5 w-3.5" />
            {n}
          </button>
        ) : (
          <span className="text-[12px] text-gold">nenhum</span>
        );
      },
    },
    {
      key: "tarifa",
      header: "Tarifa",
      align: "right",
      render: (l) => <span className="font-mono text-[12.5px]">{l.tarifa ? `R$ ${l.tarifa.toFixed(2)}` : "—"}</span>,
    },
    {
      key: "ativa",
      header: "Status",
      align: "center",
      render: (l) => (
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px]">
          <Dot tone={l.ativa ? "green" : "neutral"} />
          {l.ativa ? "Ativa" : "Inativa"}
        </span>
      ),
    },
  ];

  const itinerariosDa = (linhaId: string) => (itinerariosQ.data ?? []).filter((i) => i.linhaId === linhaId);
  const semItinerario = linhas.filter((l) => l.ativa && itinerariosDa(l.id).length === 0).length;

  return (
    <>
      <PageHeader
        title="Linhas"
        subtitle="Cadastros › Linhas e itinerários"
        actions={
          <button
            onClick={() => {
              setEditando(null);
              setAberto(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-[15px] w-[15px]" />
            Nova linha
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        {linhasQ.error ? (
          <ErrorBox error={linhasQ.error} onRetry={() => linhasQ.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={Route} label="Linhas" value={nf(linhas.length)} color="var(--brand-navy)" />
              <StatTile icon={Route} label="Ativas" value={nf(linhas.filter((l) => l.ativa).length)} color="var(--leaf)" />
              <StatTile icon={ArrowLeftRight} label="Itinerários" value={nf((itinerariosQ.data ?? []).length)} color="var(--brand-sky)" />
              <StatTile
                icon={Warehouse}
                label="Sem itinerário"
                value={nf(semItinerario)}
                color={semItinerario ? "var(--coral)" : "var(--leaf)"}
                foot="linha ativa não programável"
              />
            </div>

            <SeloDadosExemplo
              motivo="As linhas vêm do banco; os itinerários e paradas ainda são de exemplo — o endpoint de detalhe existe, falta ligar a expansão."
              className="mb-1"
            />

            <Card
              title="Linhas cadastradas"
              icon={Route}
              action={
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Código, nome ou operadora…"
                    className="h-9 w-56 rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
                  />
                </div>
              }
              bodyClassName="p-4"
            >
              {linhasQ.isPending ? (
                <SkeletonRows rows={5} />
              ) : lista.length ? (
                <DataTable
                  columns={COLS}
                  rows={lista as (Linha & Record<string, unknown>)[]}
                  onRowClick={(l) => {
                    setEditando(l as Linha);
                    setAberto(true);
                  }}
                />
              ) : (
                <EmptyNote>Nenhuma linha encontrada.</EmptyNote>
              )}
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                Linha ativa sem itinerário não entra na programação nem gera indicador por linha.
              </p>
            </Card>

            {/* Itinerários da linha expandida. */}
            {expandida && (
              <Card
                title={`Itinerários — ${linhas.find((l) => l.id === expandida)?.codigo ?? ""}`}
                icon={ArrowLeftRight}
                action={
                  <button onClick={() => setExpandida(null)} className="text-[12.5px] text-muted-foreground underline">
                    fechar
                  </button>
                }
                bodyClassName="p-4"
              >
                <div className="space-y-4">
                  {itinerariosDa(expandida).map((it) => (
                    <div key={it.id} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Pill tone={it.sentido === "ida" ? "sky" : "neutral"}>
                            {it.sentido === "ida" ? "Ida" : it.sentido === "volta" ? "Volta" : "Circular"}
                          </Pill>
                          <span className="text-[13.5px] font-semibold text-foreground">{it.nome}</span>
                        </span>
                        <span className="font-mono text-[12.5px] text-muted-foreground">
                          {it.extensaoKm} km · {it.duracaoMin} min · {it.paradas.length} paradas
                        </span>
                      </div>

                      {/* Sequência de paradas com PC destacado. */}
                      <ol className="mt-3 space-y-1.5">
                        {it.paradas.map((pa) => {
                          const p = pontoNome.get(pa.pontoId);
                          return (
                            <li key={pa.pontoId} className="flex items-center gap-3 text-[12.5px]">
                              <span className="w-5 shrink-0 text-right font-mono text-muted-foreground">{pa.ordem}</span>
                              <MapPin className={p?.controle ? "h-3.5 w-3.5 shrink-0 text-coral" : "h-3.5 w-3.5 shrink-0 text-muted-foreground"} />
                              <span className="flex-1 truncate text-ink-soft">
                                {p?.nome ?? pa.pontoId}
                                {p?.controle && (
                                  <span className="ml-2 rounded bg-coral-tint px-1.5 text-[10px] font-semibold text-coral">
                                    PC
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 font-mono text-muted-foreground">
                                {pa.minutosAcumulados} min · {pa.kmAcumulado} km
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      <CrudSheet<Linha>
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo={editando ? "Editar linha" : "Nova linha"}
        campos={CAMPOS}
        valor={editando ?? NOVA}
        editando={editando}
        onSalvar={(v) => {
          const base = linhas;
          if (editando) {
            setLocais(base.map((l) => (l === editando ? ({ ...l, ...v } as Linha) : l)));
            registrarAuditoria("edicao", `Linha alterada: ${v.codigo ?? editando.codigo}.`);
            toast.success("Linha atualizada.");
          } else {
            setLocais([{ ...NOVA, ...v, id: `l${Date.now()}` } as Linha, ...base]);
            registrarAuditoria("criacao", `Linha criada: ${v.codigo}.`);
            toast.success("Linha criada.", { description: "Cadastre o itinerário para poder programá-la." });
          }
          setAberto(false);
        }}
        onExcluir={(l) => {
          setLocais(linhas.filter((x) => x !== l));
          registrarAuditoria("exclusao", `Linha excluída: ${l.codigo}.`);
          setAberto(false);
          toast.success("Linha excluída.");
        }}
      />
    </>
  );
}
