import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, Plus, Search, Truck, Warehouse } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Dot, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { garagensQuery, nf } from "@/lib/queries";
import { CrudSheet, type Campo } from "@/components/ss/cadastro/CrudSheet";
import type { Garagem } from "@/types";

/**
 * Cadastro de garagens.
 *
 * Uma empresa pode ter várias garagens na mesma cidade — por isso este cadastro
 * é separado de Unidades (filial). A garagem é também o escopo natural de
 * permissão: o gestor do pátio Norte não precisa enxergar o Sul.
 *
 * Lista agrupada por unidade para deixar essa hierarquia explícita.
 */

const COLS: Column<Garagem & Record<string, unknown>>[] = [
  {
    key: "nome",
    header: "Garagem",
    render: (g) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-tint">
          <Warehouse className="h-4 w-4 text-brand-navy" />
        </div>
        <div>
          <div className="font-semibold text-foreground">{g.nome}</div>
          <div className="text-[11.5px] text-muted-foreground">{g.endereco}</div>
        </div>
      </div>
    ),
  },
  {
    key: "unidade",
    header: "Unidade",
    render: (g) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        {g.unidade}
      </span>
    ),
  },
  {
    key: "cidade",
    header: "Cidade / UF",
    render: (g) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        {g.cidade} / {g.uf}
      </span>
    ),
  },
  { key: "responsavel", header: "Responsável" },
  {
    key: "ocupacao",
    header: "Ocupação",
    align: "right",
    render: (g) => {
      const pct = g.vagas ? Math.round((g.veiculos / g.vagas) * 100) : 0;
      const tone = pct >= 95 ? "text-coral" : pct >= 80 ? "text-gold" : "text-leaf";
      const barra = pct >= 95 ? "bg-coral" : pct >= 80 ? "bg-gold" : "bg-leaf";
      return (
        <div className="ml-auto w-28">
          <div className="flex items-baseline justify-end gap-1.5">
            <span className={`font-mono text-[12.5px] font-semibold ${tone}`}>{pct}%</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {g.veiculos}/{g.vagas}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className={`h-1.5 rounded-full ${barra}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </div>
      );
    },
  },
  {
    key: "ativa",
    header: "Status",
    align: "center",
    render: (g) => (
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px]">
        <Dot tone={g.ativa ? "green" : "neutral"} />
        {g.ativa ? "Ativa" : "Inativa"}
      </span>
    ),
  },
];

const CAMPOS: Campo<Garagem>[] = [
  { nome: "nome", label: "Nome da garagem", tipo: "texto", obrigatorio: true, full: true, placeholder: "Ex.: Garagem Zona Leste" },
  { nome: "unidade", label: "Unidade / filial", tipo: "select", obrigatorio: true, opcoes: ["Matriz São Paulo", "Filial Rio de Janeiro", "Filial Paraná", "Filial Bahia"], hint: "Uma unidade pode ter várias garagens." },
  { nome: "endereco", label: "Endereço", tipo: "texto", full: true, placeholder: "Av. Aricanduva, 1500" },
  { nome: "cidade", label: "Cidade", tipo: "texto", obrigatorio: true },
  { nome: "uf", label: "UF", tipo: "texto", placeholder: "SP" },
  { nome: "responsavel", label: "Responsável", tipo: "texto" },
  { nome: "vagas", label: "Vagas", tipo: "numero" },
  { nome: "veiculos", label: "Veículos alocados", tipo: "numero" },
  { nome: "ativa", label: "Garagem ativa", tipo: "toggle" },
];

const NOVA: Partial<Garagem> = { ativa: true, vagas: 0, veiculos: 0, uf: "SP", unidade: "Matriz São Paulo" };

export default function Garagens() {
  const { data, isPending, error, refetch } = useQuery(garagensQuery());
  const [busca, setBusca] = useState("");
  const [locais, setLocais] = useState<Garagem[] | null>(null);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Garagem | null>(null);

  const garagens = useMemo(() => locais ?? data ?? [], [locais, data]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return garagens;
    return garagens.filter(
      (g) =>
        g.nome.toLowerCase().includes(t) ||
        g.cidade.toLowerCase().includes(t) ||
        g.unidade.toLowerCase().includes(t) ||
        g.responsavel.toLowerCase().includes(t),
    );
  }, [garagens, busca]);

  const ativas = garagens.filter((g) => g.ativa).length;
  const vagas = garagens.reduce((a, g) => a + g.vagas, 0);
  const alocados = garagens.reduce((a, g) => a + g.veiculos, 0);
  const unidades = new Set(garagens.map((g) => g.unidadeId)).size;

  return (
    <>
      <PageHeader
        title="Garagens"
        subtitle="Cadastros › Garagens"
        actions={
          <button
            onClick={() => {
              setEditando(null);
              setAberto(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-[15px] w-[15px]" />
            Nova garagem
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        {error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={Warehouse} label="Garagens" value={nf(garagens.length)} color="var(--brand-navy)" />
              <StatTile icon={Warehouse} label="Ativas" value={nf(ativas)} color="var(--leaf)" />
              <StatTile icon={Building2} label="Unidades atendidas" value={nf(unidades)} color="var(--brand-sky)" />
              <StatTile
                icon={Truck}
                label="Ocupação da rede"
                value={vagas ? `${Math.round((alocados / vagas) * 100)}%` : "—"}
                color="var(--gold)"
                foot={`${nf(alocados)} de ${nf(vagas)} vagas`}
              />
            </div>

            <Card
              title="Garagens cadastradas"
              icon={Warehouse}
              action={
                <div className="flex items-center gap-3">
                  <Pill tone="sky">{lista.length} registros</Pill>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar garagem ou cidade…"
                      className="h-9 w-52 rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
                    />
                  </div>
                </div>
              }
              bodyClassName="p-4"
            >
              {isPending ? (
                <SkeletonRows rows={5} />
              ) : lista.length ? (
                <DataTable
                  columns={COLS}
                  rows={lista as (Garagem & Record<string, unknown>)[]}
                  onRowClick={(g) => {
                    setEditando(g as Garagem);
                    setAberto(true);
                  }}
                />
              ) : (
                <EmptyNote>Nenhuma garagem encontrada com esse filtro.</EmptyNote>
              )}
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                Uma unidade pode ter várias garagens. A garagem é o menor escopo de permissão previsto para gestores de
                pátio.
              </p>
            </Card>
          </>
        )}
      </div>

      <CrudSheet<Garagem>
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo={editando ? "Editar garagem" : "Nova garagem"}
        campos={CAMPOS}
        valor={editando ?? NOVA}
        editando={editando}
        onSalvar={(v) => {
          const base = garagens;
          setLocais(
            editando
              ? base.map((g) => (g === editando ? ({ ...g, ...v } as Garagem) : g))
              : [{ ...NOVA, ...v, id: `g${Date.now()}`, unidadeId: "u1" } as Garagem, ...base],
          );
          setAberto(false);
        }}
        onExcluir={(g) => {
          setLocais(garagens.filter((x) => x !== g));
          setAberto(false);
        }}
      />
    </>
  );
}
