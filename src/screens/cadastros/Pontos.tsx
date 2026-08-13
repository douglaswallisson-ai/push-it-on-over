import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Accessibility, MapPin, Plus, Search, Umbrella } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { CrudSheet, type Campo } from "@/components/ss/cadastro/CrudSheet";
import { nf, pontosQuery } from "@/lib/queries";
import { registrarAuditoria } from "@/lib/session";
import type { PontoParada } from "@/types";

/**
 * Pontos de parada e pontos de controle.
 *
 * O PC (ponto de controle) é onde a viagem é aberta e encerrada e onde a
 * passagem é conferida contra o horário — é dele que saem os alarmes de
 * "abertura de viagem fora do PC" e "veículo parado com viagem aberta".
 */

const CAMPOS: Campo<PontoParada>[] = [
  { nome: "codigo", label: "Código", tipo: "texto", obrigatorio: true, placeholder: "PC1 ou P002" },
  { nome: "nome", label: "Nome do ponto", tipo: "texto", obrigatorio: true, placeholder: "Terminal Central" },
  { nome: "endereco", label: "Endereço", tipo: "texto", full: true },
  { nome: "lat", label: "Latitude", tipo: "numero", placeholder: "-23.5505" },
  { nome: "lng", label: "Longitude", tipo: "numero", placeholder: "-46.6333" },
  { nome: "controle", label: "É ponto de controle (PC)", tipo: "toggle", hint: "PC abre e encerra viagem, e gera alarme de abertura fora do ponto." },
  { nome: "toleranciaMin", label: "Tolerância de passagem", tipo: "numero", sufixo: "min" },
  { nome: "abrigo", label: "Tem abrigo", tipo: "toggle" },
  { nome: "acessivel", label: "Acessível", tipo: "toggle" },
];

const NOVO: Partial<PontoParada> = { controle: false, toleranciaMin: 2, abrigo: false, acessivel: false, lat: 0, lng: 0 };

export default function Pontos() {
  const { data, isPending, error, refetch } = useQuery(pontosQuery());
  const [locais, setLocais] = useState<PontoParada[] | null>(null);
  const [busca, setBusca] = useState("");
  const [soPC, setSoPC] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<PontoParada | null>(null);

  const pontos = useMemo(() => locais ?? data ?? [], [locais, data]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return pontos.filter((p) => {
      if (soPC && !p.controle) return false;
      if (!t) return true;
      return p.codigo.toLowerCase().includes(t) || p.nome.toLowerCase().includes(t) || p.endereco.toLowerCase().includes(t);
    });
  }, [pontos, busca, soPC]);

  const COLS: Column<PontoParada & Record<string, unknown>>[] = [
    {
      key: "codigo",
      header: "Ponto",
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className={p.controle ? "flex h-8 w-8 items-center justify-center rounded-lg bg-coral-tint" : "flex h-8 w-8 items-center justify-center rounded-lg bg-navy-tint"}>
            <MapPin className={p.controle ? "h-4 w-4 text-coral" : "h-4 w-4 text-brand-navy"} />
          </div>
          <div>
            <div className="font-mono text-[13px] font-bold text-foreground">{p.codigo}</div>
            <div className="max-w-[240px] truncate text-[11.5px] text-muted-foreground">{p.nome}</div>
          </div>
        </div>
      ),
    },
    { key: "endereco", header: "Endereço", render: (p) => <span className="text-[12.5px] text-ink-soft">{p.endereco}</span> },
    {
      key: "controle",
      header: "Tipo",
      align: "center",
      render: (p) => (p.controle ? <Pill tone="coral">Ponto de controle</Pill> : <Pill tone="neutral">Parada</Pill>),
    },
    {
      key: "toleranciaMin",
      header: "Tolerância",
      align: "right",
      render: (p) => <span className="font-mono text-[12.5px]">{p.toleranciaMin} min</span>,
    },
    {
      key: "infra",
      header: "Infraestrutura",
      align: "center",
      render: (p) => (
        <span className="inline-flex items-center gap-2">
          {p.abrigo && <Umbrella className="h-3.5 w-3.5 text-brand-sky" aria-label="Com abrigo" />}
          {p.acessivel && <Accessibility className="h-3.5 w-3.5 text-leaf" aria-label="Acessível" />}
          {!p.abrigo && !p.acessivel && <span className="text-[12px] text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      key: "coords",
      header: "Coordenada",
      align: "right",
      render: (p) => (
        <span className="font-mono text-[11.5px] text-muted-foreground">
          {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Pontos de parada"
        subtitle="Cadastros › Pontos e pontos de controle"
        actions={
          <button
            onClick={() => {
              setEditando(null);
              setAberto(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-[15px] w-[15px]" />
            Novo ponto
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        {error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={MapPin} label="Pontos" value={nf(pontos.length)} color="var(--brand-navy)" />
              <StatTile icon={MapPin} label="Pontos de controle" value={nf(pontos.filter((p) => p.controle).length)} color="var(--coral)" />
              <StatTile icon={Umbrella} label="Com abrigo" value={nf(pontos.filter((p) => p.abrigo).length)} color="var(--brand-sky)" />
              <StatTile icon={Accessibility} label="Acessíveis" value={nf(pontos.filter((p) => p.acessivel).length)} color="var(--leaf)" />
            </div>

            <Card
              title="Pontos cadastrados"
              icon={MapPin}
              action={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSoPC((v) => !v)}
                    className={soPC ? "rounded-full bg-brand-navy px-3 py-1.5 text-[12px] font-medium text-white" : "rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-secondary"}
                  >
                    Só PC
                  </button>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Código, nome ou endereço…"
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
                  rows={lista as (PontoParada & Record<string, unknown>)[]}
                  onRowClick={(p) => {
                    setEditando(p as PontoParada);
                    setAberto(true);
                  }}
                />
              ) : (
                <EmptyNote>Nenhum ponto encontrado.</EmptyNote>
              )}
            </Card>
          </>
        )}
      </div>

      <CrudSheet<PontoParada>
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo={editando ? "Editar ponto" : "Novo ponto"}
        campos={CAMPOS}
        valor={editando ?? NOVO}
        editando={editando}
        onSalvar={(v) => {
          const base = pontos;
          if (editando) {
            setLocais(base.map((p) => (p === editando ? ({ ...p, ...v } as PontoParada) : p)));
            registrarAuditoria("edicao", `Ponto alterado: ${v.codigo ?? editando.codigo}.`);
            toast.success("Ponto atualizado.");
          } else {
            setLocais([{ ...NOVO, ...v, id: `p${Date.now()}` } as PontoParada, ...base]);
            registrarAuditoria("criacao", `Ponto criado: ${v.codigo}.`);
            toast.success("Ponto criado.");
          }
          setAberto(false);
        }}
        onExcluir={(p) => {
          setLocais(pontos.filter((x) => x !== p));
          registrarAuditoria("exclusao", `Ponto excluído: ${p.codigo}.`);
          setAberto(false);
          toast.success("Ponto excluído.");
        }}
      />
    </>
  );
}
