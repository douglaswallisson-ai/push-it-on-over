import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Cpu, Layers, Search, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { api, Empresas, Unidades, type EmpresaApi, type UnidadeApi } from "@/lib/api";
import { chaveComGrupo, grupoAtivo } from "@/lib/escopo-ativo";

/**
 * Cadastros com dado real, em modo consulta.
 *
 * Os três eram protótipo, com "6 grupos", "48 veículos" e "45 online" escritos
 * no código. Agora leem as rotas reais do backend, já filtradas pelo acesso do
 * usuário.
 *
 * Só consulta, de propósito: o backend local grava direto no banco de
 * produção, e o cadastro de verdade continua sendo feito no sistema atual.
 */

const nf = (v: number) => v.toLocaleString("pt-BR");

function ListaConsulta<T extends object>({
  titulo,
  subtitulo,
  icone,
  q,
  colunas,
  busca,
  resumo,
}: {
  titulo: string;
  subtitulo: string;
  icone: LucideIcon;
  q: { data?: T[]; isPending: boolean; error: unknown };
  colunas: Column<T>[];
  busca: (t: T) => string;
  resumo: { rotulo: string; valor: number }[];
}) {
  const [termo, setTermo] = useState("");
  const linhas = useMemo(() => {
    const t = termo.trim().toLowerCase();
    const todas = q.data ?? [];
    return t ? todas.filter((x) => busca(x).toLowerCase().includes(t)) : todas;
  }, [q.data, termo, busca]);
  const Icone = icone;

  return (
    <>
      <PageHeader title={titulo} subtitle={subtitulo} />
      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {resumo.map((r) => (
            <StatTile key={r.rotulo} icon={Icone} label={r.rotulo} value={q.data ? nf(r.valor) : "—"} color="var(--brand-navy)" />
          ))}
        </div>
        <Card
          title={titulo}
          icon={Icone}
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Buscar"
                  className="h-8 w-52 rounded-full border border-border bg-white pl-8 pr-3 text-[12.5px]"
                />
              </div>
              <Pill tone="sky">{nf(linhas.length)}</Pill>
            </div>
          }
          bodyClassName="p-4"
        >
          {q.error ? (
            <p className="py-8 text-center text-sm text-coral">Não foi possível carregar: {(q.error as Error).message}</p>
          ) : q.isPending ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : !linhas.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nada encontrado.</p>
          ) : (
            <DataTable
              columns={colunas as unknown as Column<Record<string, unknown>>[]}
              rows={linhas as unknown as Record<string, unknown>[]}
            />
          )}
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Consulta. Inclusão e edição continuam no sistema atual — o backend local grava direto em produção.
        </p>
      </div>
    </>
  );
}

/* --------------------------------- Grupos -------------------------------- */

export function GruposReal() {
  const q = useQuery({
    queryKey: ["cadastro", "grupos"],
    queryFn: async () => ((await Empresas.lista()) ?? []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  });
  const colunas: Column<EmpresaApi>[] = [
    { key: "id", header: "Id", render: (g) => <span className="font-mono text-[12px]">{g.id}</span> },
    { key: "name", header: "Nome", render: (g) => <span className="font-semibold">{g.name}</span> },
    { key: "corporate_name", header: "Razão social", render: (g) => g.corporate_name ?? "—" },
    { key: "cnpj", header: "CNPJ", render: (g) => <span className="font-mono text-[12px]">{g.cnpj ?? "—"}</span> },
    { key: "client_cod", header: "Código", render: (g) => g.client_cod ?? "—" },
  ];
  return (
    <ListaConsulta
      titulo="Grupos"
      subtitulo="Cadastros › Empresas (mova.group)"
      icone={Layers}
      q={q}
      colunas={colunas}
      busca={(g) => `${g.name} ${g.corporate_name ?? ""} ${g.cnpj ?? ""} ${g.id}`}
      resumo={[{ rotulo: "Grupos com acesso", valor: q.data?.length ?? 0 }]}
    />
  );
}

/* -------------------------------- Unidades ------------------------------- */

export function UnidadesReal() {
  const grupo = grupoAtivo();
  const q = useQuery({
    queryKey: chaveComGrupo("cadastro", "unidades"),
    queryFn: async () => ((await Unidades.lista(grupo)) ?? []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  });
  const colunas: Column<UnidadeApi>[] = [
    { key: "id", header: "Id", render: (u) => <span className="font-mono text-[12px]">{u.id}</span> },
    { key: "name", header: "Nome", render: (u) => <span className="font-semibold">{u.name}</span> },
    { key: "group_id", header: "Grupo", render: (u) => <span className="font-mono text-[12px]">{u.group_id}</span> },
    { key: "company", header: "Empresa", render: (u) => u.company ?? "—" },
    { key: "cnpj", header: "CNPJ", render: (u) => <span className="font-mono text-[12px]">{u.cnpj ?? "—"}</span> },
    {
      key: "suspended",
      header: "Situação",
      align: "center",
      render: (u) => <Pill tone={u.suspended ? "neutral" : "green"}>{u.suspended ? "Suspensa" : "Ativa"}</Pill>,
    },
  ];
  const ativas = (q.data ?? []).filter((u) => !u.suspended).length;
  return (
    <ListaConsulta
      titulo="Unidades"
      subtitulo="Cadastros › Subgrupos (mova.subgroup)"
      icone={Building2}
      q={q}
      colunas={colunas}
      busca={(u) => `${u.name} ${u.company ?? ""} ${u.id}`}
      resumo={[
        { rotulo: "Unidades", valor: q.data?.length ?? 0 },
        { rotulo: "Ativas", valor: ativas },
        { rotulo: "Suspensas", valor: (q.data?.length ?? 0) - ativas },
      ]}
    />
  );
}

/* ------------------------------ Dispositivos ----------------------------- */

type DispositivoApi = {
  id: number;
  identifier: string;
  device_model_id: number;
  operadora?: string | null;
  number?: string | null;
  imei?: string | null;
  iccid?: string | null;
  serial_number?: string | null;
  asset?: number | null;
  group_id?: number | null;
  status: number;
};

/** `/devices` pagina por skip/limit até 1000; segue até a página vir incompleta. */
async function todosDispositivos(): Promise<DispositivoApi[]> {
  const todos: DispositivoApi[] = [];
  for (let skip = 0; skip < 50_000; skip += 1000) {
    const pagina = await api.get<DispositivoApi[]>(`/api/v1/devices/?skip=${skip}&limit=1000`);
    todos.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return todos;
}

export function DispositivosReal() {
  const grupo = grupoAtivo();
  const q = useQuery({
    queryKey: chaveComGrupo("cadastro", "dispositivos"),
    // A rota não aceita filtro de empresa; o recorte pela empresa ativa é aqui.
    queryFn: async () => (await todosDispositivos()).filter((d) => !grupo || String(d.group_id) === grupo),
  });
  const colunas: Column<DispositivoApi>[] = [
    { key: "identifier", header: "Identificador", render: (d) => <span className="font-mono font-semibold">{d.identifier}</span> },
    { key: "device_model_id", header: "Modelo", render: (d) => <span className="font-mono text-[12px]">{d.device_model_id}</span> },
    { key: "imei", header: "IMEI", render: (d) => <span className="font-mono text-[12px]">{d.imei ?? "—"}</span> },
    { key: "iccid", header: "ICCID", render: (d) => <span className="font-mono text-[12px]">{d.iccid ?? "—"}</span> },
    { key: "operadora", header: "Operadora", render: (d) => d.operadora ?? "—" },
    { key: "asset", header: "Veículo", render: (d) => (d.asset ? <span className="font-mono text-[12px]">{d.asset}</span> : <Pill tone="neutral">livre</Pill>) },
  ];
  const vinculados = (q.data ?? []).filter((d) => d.asset).length;
  return (
    <ListaConsulta
      titulo="Dispositivos"
      subtitulo="Cadastros › Rastreadores (mova.device)"
      icone={Cpu}
      q={q}
      colunas={colunas}
      busca={(d) => `${d.identifier} ${d.imei ?? ""} ${d.iccid ?? ""} ${d.serial_number ?? ""}`}
      resumo={[
        { rotulo: "Dispositivos", valor: q.data?.length ?? 0 },
        { rotulo: "Vinculados a veículo", valor: vinculados },
        { rotulo: "Livres", valor: (q.data?.length ?? 0) - vinculados },
      ]}
    />
  );
}
