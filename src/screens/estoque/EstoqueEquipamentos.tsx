import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  FileText,
  Loader2,
  PackagePlus,
  Search,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { api } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Estoque,
  estoqueQuery,
  historicoSerialQuery,
  MODELOS_EXPEDICAO,
  ROTULO_ALERTA,
  type AcaoLancamento,
  type CodigoAlerta,
  type ContratoEstoque,
  type Equipamento,
  type StatusEquip,
} from "@/lib/estoque-api";
import { exportarCSV } from "@/lib/export";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Estoque de equipamentos — onde está cada serial expedido, em que situação e
 * a qual contrato (ou aditivo) pertence.
 *
 * Regras: especificação do MVP de Controle de Estoque (Operações, 06/10/2026),
 * com placa e histórico de instalação ao vivo do banco (ver estoque.py).
 * Status: lançamento manual > Ativo (tem placa) > Em estoque. A expedição só
 * lista contratos do cliente, mostra o saldo e bloqueia contrato encerrado ou
 * sem saldo (pede aditivo).
 */

const MATRIZ = "Estoque SS (matriz)";
const ROTULO_STATUS: Record<StatusEquip, string> = {
  ativo: "Ativo",
  estoque: "Em estoque",
  manutencao: "Em manutenção",
  devolucao: "Em devolução",
};
const TOM_STATUS: Record<StatusEquip, PillTone> = {
  ativo: "green",
  estoque: "sky",
  manutencao: "gold",
  devolucao: "coral",
};
const COR_STATUS: Record<StatusEquip, string> = {
  ativo: "var(--leaf)",
  estoque: "var(--brand-sky)",
  manutencao: "var(--gold)",
  devolucao: "var(--coral)",
};
const ORDEM: StatusEquip[] = ["ativo", "estoque", "manutencao", "devolucao"];

const nf = (v: unknown) => (v == null ? "—" : Number(v).toLocaleString("pt-BR"));
const dataHora = (s: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
const dia = (s: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
const leitura = (e: Equipamento) =>
  e.ultima_leitura
    ? dataHora(e.ultima_leitura)
    : e.leitura_planilha
      ? `${e.leitura_planilha} (planilha)`
      : "—";
const contratoTexto = (e: Equipamento) =>
  e.aditivo_numero ? e.aditivo_numero : (e.contrato_numero ?? "Sem contrato");

type Coluna =
  | "serial"
  | "modelo"
  | "cliente"
  | "contrato"
  | "placa"
  | "status"
  | "alertas"
  | "leitura"
  | "origem";
const COLUNAS: { id: Coluna; rotulo: string; valor: (e: Equipamento) => string | number }[] = [
  { id: "serial", rotulo: "Serial", valor: (e) => e.serial },
  { id: "modelo", rotulo: "Modelo", valor: (e) => e.modelo },
  { id: "cliente", rotulo: "Cliente", valor: (e) => e.cliente },
  { id: "contrato", rotulo: "Contrato", valor: (e) => contratoTexto(e) },
  { id: "placa", rotulo: "Placa", valor: (e) => e.placa ?? "" },
  { id: "status", rotulo: "Status", valor: (e) => ORDEM.indexOf(e.status) },
  { id: "alertas", rotulo: "Verificar", valor: (e) => e.alertas.length },
  { id: "leitura", rotulo: "Última leitura", valor: (e) => e.ultima_leitura ?? "" },
  { id: "origem", rotulo: "Origem do status", valor: (e) => e.origem_status },
];

type Filtros = {
  cliente: string | null;
  contrato: number | null;
  status: StatusEquip | null;
  busca: string;
  modelo: string;
  vinculo: "" | "com" | "sem";
  alerta: "" | "qualquer" | CodigoAlerta;
  leitura: "" | "hoje" | "com" | "sem";
  origem: "" | "calculado" | "manual";
  soDesinstalados: boolean;
};
const FILTROS_VAZIOS: Filtros = {
  cliente: null,
  contrato: null,
  status: null,
  busca: "",
  modelo: "",
  vinculo: "",
  alerta: "",
  leitura: "",
  origem: "",
  soDesinstalados: false,
};

export default function EstoqueEquipamentos() {
  const q = useQuery(estoqueQuery());
  const [f, setF] = useState<Filtros>(FILTROS_VAZIOS);
  const [ordem, setOrdem] = useState<{ col: Coluna; dir: 1 | -1 } | null>(null);
  const [porPagina, setPorPagina] = useState(50);
  const [pagina, setPagina] = useState(0);
  const [selId, setSelId] = useState<number | null>(null);
  const [expedir, setExpedir] = useState(false);
  const [destaque, setDestaque] = useState<Set<number>>(new Set());
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setPagina(0);
  };

  const itens = useMemo(() => q.data?.itens ?? [], [q.data]);
  const hoje = new Date().toISOString().slice(0, 10);

  // Todos os filtros menos o de status (os chips contam respeitando os demais).
  const semStatus = useMemo(() => {
    const t = f.busca.trim().toUpperCase();
    return itens.filter((e) => {
      if (f.cliente && e.cliente !== f.cliente) return false;
      if (f.contrato && e.contrato_id !== f.contrato) return false;
      if (f.modelo && e.modelo !== f.modelo) return false;
      if (f.vinculo === "com" && !e.contrato_id) return false;
      if (f.vinculo === "sem" && e.contrato_id) return false;
      if (f.alerta === "qualquer" && !e.alertas.length) return false;
      if (f.alerta && f.alerta !== "qualquer" && !e.alertas.some((a) => a.codigo === f.alerta))
        return false;
      if (f.leitura === "hoje" && !(e.ultima_leitura ?? "").startsWith(hoje)) return false;
      if (f.leitura === "com" && !e.ultima_leitura) return false;
      if (f.leitura === "sem" && e.ultima_leitura) return false;
      if (f.origem && e.origem_status !== f.origem) return false;
      if (f.soDesinstalados && e.subtipo !== "desinstalado") return false;
      if (t && !e.serial.toUpperCase().includes(t) && !(e.placa ?? "").toUpperCase().includes(t))
        return false;
      return true;
    });
  }, [itens, f, hoje]);

  const filtrados = useMemo(() => {
    const l = f.status ? semStatus.filter((e) => e.status === f.status) : semStatus;
    if (!ordem) return l;
    const c = COLUNAS.find((x) => x.id === ordem.col)!;
    return [...l].sort((a, b) => {
      const va = c.valor(a),
        vb = c.valor(b);
      return (
        (typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt-BR", { numeric: true })) * ordem.dir
      );
    });
  }, [semStatus, f.status, ordem]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / porPagina));
  const atual = Math.min(pagina, paginas - 1);
  const visiveis = filtrados.slice(atual * porPagina, atual * porPagina + porPagina);
  const sel = itens.find((e) => e.id === selId) ?? null;
  const contratosDoCliente = useMemo(
    () =>
      (q.data?.contratos ?? []).filter(
        (c) =>
          itens.some((e) => e.cliente === f.cliente && e.contrato_id === c.id) ||
          q.data?.clientes.find((x) => x.cliente === f.cliente)?.contrato_id === c.id,
      ),
    [q.data, itens, f.cliente],
  );
  const ativos = Object.entries(f).filter(
    ([k, v]) => k !== "status" && v !== FILTROS_VAZIOS[k as keyof Filtros],
  ).length;
  const modelos = useMemo(() => [...new Set(itens.map((e) => e.modelo))].sort(), [itens]);
  const contagem = (s: StatusEquip | null) =>
    s ? semStatus.filter((e) => e.status === s).length : semStatus.length;

  const ordenar = (col: Coluna) =>
    setOrdem((o) =>
      !o || o.col !== col ? { col, dir: 1 } : o.dir === 1 ? { col, dir: -1 } : null,
    );

  const exportar = () => {
    const n = exportarCSV(
      filtrados,
      [
        { cabecalho: "Serial", valor: (e) => e.serial },
        { cabecalho: "Modelo", valor: (e) => e.modelo },
        { cabecalho: "Cliente", valor: (e) => e.cliente },
        { cabecalho: "Contrato", valor: (e) => e.contrato_numero },
        { cabecalho: "Aditivo", valor: (e) => e.aditivo_numero },
        { cabecalho: "Placa", valor: (e) => e.placa },
        { cabecalho: "Grupo da placa", valor: (e) => e.grupo_placa },
        { cabecalho: "Status", valor: (e) => ROTULO_STATUS[e.status] },
        {
          cabecalho: "Subtipo",
          valor: (e) =>
            e.subtipo === "desinstalado" ? "Desinstalado" : e.subtipo === "matriz" ? "Matriz" : "",
        },
        { cabecalho: "Placa anterior", valor: (e) => e.placa_anterior },
        { cabecalho: "Retirado em", valor: (e) => e.retirado_em?.slice(0, 10) },
        {
          cabecalho: "Última leitura",
          valor: (e) => e.ultima_leitura?.replace("T", " ").slice(0, 16) ?? e.leitura_planilha,
        },
        {
          cabecalho: "Verificar",
          valor: (e) => e.alertas.map((a) => ROTULO_ALERTA[a.codigo]).join(" | "),
        },
        {
          cabecalho: "Origem do status",
          valor: (e) => (e.origem_status === "manual" ? "Manual" : "Calculado"),
        },
      ],
      "estoque-equipamentos",
    );
    toast.success(`${nf(n)} seriais exportados.`);
  };

  const r = q.data?.resumo;
  return (
    <>
      <PageHeader
        title="Estoque de equipamentos"
        subtitle="Onde está cada serial expedido, em que situação e a qual contrato pertence"
      />
      <main className="space-y-5 px-4 py-6 sm:px-8">
        {q.error ? (
          <ErrorBox error={q.error} onRetry={() => q.refetch()} />
        ) : q.isPending ? (
          <SkeletonRows rows={10} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile
                icon={Boxes}
                label="Seriais expedidos"
                value={nf(r?.total)}
                foot={`${nf(q.data?.clientes.length)} clientes`}
              />
              <StatTile
                icon={Truck}
                label="Ativos (em placa)"
                value={nf(r?.ativo ?? 0)}
                color="var(--leaf)"
              />
              <StatTile
                icon={PackagePlus}
                label="Em estoque no cliente"
                value={nf(r?.estoque ?? 0)}
                color="var(--brand-sky)"
                foot={`${nf(itens.filter((e) => e.subtipo === "desinstalado").length)} desinstalados`}
              />
              <StatTile
                icon={AlertTriangle}
                label="Para verificar"
                value={nf(r?.com_alerta)}
                color="var(--gold)"
                foot={`${nf(r?.sem_contrato)} sem contrato`}
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
              <ListaClientes
                clientes={q.data?.clientes ?? []}
                atual={f.cliente}
                onEscolher={(c) => {
                  setF((x) => ({ ...x, cliente: c, contrato: null }));
                  setPagina(0);
                }}
              />

              <div className="min-w-0 space-y-4">
                {f.cliente && (
                  <PainelContratos
                    contratos={contratosDoCliente}
                    atual={f.contrato}
                    cliente={q.data?.clientes.find((c) => c.cliente === f.cliente)}
                    onEscolher={(id) => set("contrato", f.contrato === id ? null : id)}
                  />
                )}

                <Card
                  title={f.cliente ?? "Todos os clientes"}
                  icon={Boxes}
                  action={
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={exportar}
                        className="h-8 rounded-lg border border-border px-3 text-[12px] font-medium hover:bg-secondary"
                      >
                        Exportar CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpedir(true)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-navy px-3 text-[12px] font-semibold text-white hover:opacity-90"
                      >
                        <PackagePlus className="h-3.5 w-3.5" /> Registrar expedição
                      </button>
                    </div>
                  }
                  bodyClassName="p-4 space-y-3"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {([null, ...ORDEM] as (StatusEquip | null)[]).map((s) => (
                      <button
                        key={s ?? "todos"}
                        type="button"
                        aria-pressed={f.status === s}
                        onClick={() => set("status", s)}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium",
                          f.status === s
                            ? "border-brand-navy bg-brand-navy text-white"
                            : "border-border bg-white text-foreground hover:bg-secondary",
                        )}
                      >
                        {s && (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: COR_STATUS[s] }}
                          />
                        )}
                        {s ? ROTULO_STATUS[s] : "Todos"} · {nf(contagem(s))}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full max-w-[240px]">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        id="est-busca"
                        value={f.busca}
                        onChange={(e) => set("busca", e.target.value)}
                        placeholder="Serial ou placa…"
                        className="h-9 w-full rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
                      />
                    </div>
                    <Sel
                      id="est-modelo"
                      valor={f.modelo}
                      onChange={(v) => set("modelo", v)}
                      opcoes={[
                        ["", "Todos os modelos"],
                        ...modelos.map((m) => [m, m] as [string, string]),
                      ]}
                    />
                    <Sel
                      id="est-vinculo"
                      valor={f.vinculo}
                      onChange={(v) => set("vinculo", v as Filtros["vinculo"])}
                      opcoes={[
                        ["", "Contrato: todos"],
                        ["com", "Com contrato"],
                        ["sem", "Sem contrato"],
                      ]}
                    />
                    <Sel
                      id="est-alerta"
                      valor={f.alerta}
                      onChange={(v) => set("alerta", v as Filtros["alerta"])}
                      opcoes={[
                        ["", "Verificar: todos"],
                        ["qualquer", "Qualquer pendência"],
                        ...(Object.keys(ROTULO_ALERTA) as CodigoAlerta[]).map(
                          (k) => [k, `${k} · ${ROTULO_ALERTA[k]}`] as [string, string],
                        ),
                      ]}
                    />
                    <Sel
                      id="est-leitura"
                      valor={f.leitura}
                      onChange={(v) => set("leitura", v as Filtros["leitura"])}
                      opcoes={[
                        ["", "Leitura: todas"],
                        ["hoje", "Leitura hoje"],
                        ["com", "Com leitura"],
                        ["sem", "Sem leitura"],
                      ]}
                    />
                    <Sel
                      id="est-origem"
                      valor={f.origem}
                      onChange={(v) => set("origem", v as Filtros["origem"])}
                      opcoes={[
                        ["", "Origem: todas"],
                        ["calculado", "Calculado"],
                        ["manual", "Manual"],
                      ]}
                    />
                    <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <input
                        id="est-desinst"
                        type="checkbox"
                        checked={f.soDesinstalados}
                        onChange={(e) => set("soDesinstalados", e.target.checked)}
                      />{" "}
                      Só desinstalados
                    </label>
                    {ativos > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setF({ ...FILTROS_VAZIOS, status: f.status });
                          setPagina(0);
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-brand-navy hover:underline"
                      >
                        <X className="h-3.5 w-3.5" /> Limpar filtros ({ativos})
                      </button>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full min-w-[980px] text-[13px]">
                      <thead className="bg-secondary/60 text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          {COLUNAS.map((c) => (
                            <th key={c.id} className="px-3 py-2 font-medium">
                              <button
                                type="button"
                                onClick={() => ordenar(c.id)}
                                className="inline-flex items-center gap-1 hover:text-foreground"
                              >
                                {c.rotulo}
                                {ordem?.col === c.id &&
                                  (ordem.dir === 1 ? (
                                    <ArrowUp className="h-3 w-3" />
                                  ) : (
                                    <ArrowDown className="h-3 w-3" />
                                  ))}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visiveis.length === 0 ? (
                          <tr>
                            <td
                              colSpan={COLUNAS.length}
                              className="px-3 py-8 text-center text-muted-foreground"
                            >
                              Nenhum serial com estes filtros.
                            </td>
                          </tr>
                        ) : (
                          visiveis.map((e) => (
                            <tr
                              key={e.id}
                              onClick={() => setSelId(e.id)}
                              className={cn(
                                "cursor-pointer border-t border-border transition-colors hover:bg-secondary/50",
                                destaque.has(e.id) && "bg-gold/15",
                              )}
                            >
                              <td className="px-3 py-2 font-mono font-semibold text-foreground">
                                {e.serial}
                              </td>
                              <td className="px-3 py-2">{e.modelo}</td>
                              <td className="max-w-[200px] truncate px-3 py-2" title={e.cliente}>
                                {e.cliente}
                              </td>
                              <td className="px-3 py-2 font-mono text-[12px]">
                                {e.contrato_numero ? (
                                  <span title={e.contrato_nome ?? ""}>
                                    {e.aditivo_numero ?? e.contrato_numero}
                                    {e.aditivo_numero && (
                                      <span className="block text-[11px] text-muted-foreground">
                                        aditivo de {e.contrato_numero}
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-coral">Sem contrato</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono">
                                {e.placa ??
                                  (e.placa_anterior ? (
                                    <span className="text-muted-foreground" title="Placa anterior">
                                      ({e.placa_anterior})
                                    </span>
                                  ) : (
                                    "—"
                                  ))}
                              </td>
                              <td className="px-3 py-2">
                                <Pill tone={TOM_STATUS[e.status]}>{ROTULO_STATUS[e.status]}</Pill>
                                {e.subtipo === "desinstalado" && (
                                  <span className="block text-[11px] text-muted-foreground">
                                    desinstalado
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {e.alertas.map((a) => (
                                  <span
                                    key={a.codigo}
                                    title={a.texto}
                                    className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded bg-gold/20 font-mono text-[11px] font-bold text-foreground"
                                  >
                                    {a.codigo}
                                  </span>
                                ))}
                              </td>
                              <td className="px-3 py-2 text-[12px] text-muted-foreground">
                                {leitura(e)}
                              </td>
                              <td className="px-3 py-2 text-[12px]">
                                {e.origem_status === "manual" ? (
                                  <Pill tone="gold">Manual</Pill>
                                ) : (
                                  "Calculado"
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
                    <span>
                      {nf(filtrados.length)} seriais · página {atual + 1} de {paginas}
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      <Sel
                        id="est-pp"
                        valor={String(porPagina)}
                        onChange={(v) => {
                          setPorPagina(Number(v));
                          setPagina(0);
                        }}
                        opcoes={[25, 50, 100, 200].map(
                          (n) => [String(n), `${n} por página`] as [string, string],
                        )}
                      />
                      <BotaoPag disabled={atual === 0} onClick={() => setPagina(atual - 1)}>
                        Anterior
                      </BotaoPag>
                      {Array.from({ length: paginas }, (_, i) => i)
                        .filter((i) => i === 0 || i === paginas - 1 || Math.abs(i - atual) <= 2)
                        .map((i, k, arr) => (
                          <span key={i} className="flex items-center gap-1">
                            {k > 0 && i - arr[k - 1] > 1 && <span>…</span>}
                            <BotaoPag ativo={i === atual} onClick={() => setPagina(i)}>
                              {i + 1}
                            </BotaoPag>
                          </span>
                        ))}
                      <BotaoPag
                        disabled={atual >= paginas - 1}
                        onClick={() => setPagina(atual + 1)}
                      >
                        Próxima
                      </BotaoPag>
                    </div>
                  </div>
                </Card>
                <p className="text-[12px] text-muted-foreground">
                  Placa, grupo e última leitura vêm do banco da plataforma a cada consulta. Os
                  seriais e os lançamentos (expedição, manutenção, devolução) ficam no armazenamento
                  provisório até a gravação ser liberada. "Desinstalado" usa o histórico de
                  instalação do banco.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      <Sheet open={sel !== null} onOpenChange={(v) => !v && setSelId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[560px]">
          {sel && (
            <DetalheSerial
              e={sel}
              contratos={q.data?.contratos ?? []}
              onFeito={() => q.refetch()}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={expedir} onOpenChange={setExpedir}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[560px]">
          {expedir && (
            <FormExpedicao
              clientes={(q.data?.clientes ?? []).map((c) => c.cliente).filter((c) => c !== MATRIZ)}
              clienteInicial={f.cliente && f.cliente !== MATRIZ ? f.cliente : ""}
              onFeito={async (cliente, expedidos) => {
                setExpedir(false);
                const r2 = await q.refetch();
                const novos = new Set(
                  (r2.data?.itens ?? [])
                    .filter((e) => e.cliente === cliente && expedidos.includes(e.serial))
                    .map((e) => e.id),
                );
                setF({ ...FILTROS_VAZIOS, cliente });
                setOrdem(null);
                // Vai para a página onde a primeira linha nova aparece e destaca por 6 s.
                const lista = (r2.data?.itens ?? []).filter((e) => e.cliente === cliente);
                const idx = lista.findIndex((e) => novos.has(e.id));
                setPagina(idx >= 0 ? Math.floor(idx / porPagina) : 0);
                setDestaque(novos);
                setTimeout(() => setDestaque(new Set()), 6000);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Sel({
  id,
  valor,
  onChange,
  opcoes,
}: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: [string, string][];
}) {
  return (
    <select
      id={id}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-border bg-white px-2 text-[12px] text-foreground"
    >
      {opcoes.map(([v, r]) => (
        <option key={v} value={v}>
          {r}
        </option>
      ))}
    </select>
  );
}

function BotaoPag({
  children,
  onClick,
  disabled,
  ativo,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  ativo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-8 min-w-8 rounded-lg border px-2 text-[12px] disabled:opacity-40",
        ativo
          ? "border-brand-navy bg-brand-navy text-white"
          : "border-border bg-white hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function ListaClientes({
  clientes,
  atual,
  onEscolher,
}: {
  clientes: {
    cliente: string;
    total: number;
    ativo: number;
    estoque: number;
    manutencao: number;
    devolucao: number;
  }[];
  atual: string | null;
  onEscolher: (c: string | null) => void;
}) {
  const [busca, setBusca] = useState("");
  const lista = clientes.filter(
    (c) => !busca || c.cliente.toLowerCase().includes(busca.toLowerCase()),
  );
  return (
    <Card
      title="Clientes"
      icon={Truck}
      bodyClassName="p-2"
      className="self-start lg:sticky lg:top-4"
    >
      <input
        id="est-busca-cli"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar cliente…"
        className="mb-2 h-9 w-full rounded-lg border border-border bg-secondary/60 px-3 text-[13px] outline-none focus:border-accent focus:bg-white"
      />
      <ul className="max-h-[70vh] space-y-0.5 overflow-y-auto">
        <li>
          <button
            type="button"
            onClick={() => onEscolher(null)}
            className={cn(
              "w-full rounded-lg px-2.5 py-2 text-left text-[13px]",
              !atual ? "bg-navy-tint font-semibold" : "hover:bg-secondary",
            )}
          >
            Todos os clientes
          </button>
        </li>
        {lista.map((c) => (
          <li key={c.cliente}>
            <button
              type="button"
              onClick={() => onEscolher(c.cliente)}
              className={cn(
                "w-full rounded-lg px-2.5 py-2 text-left",
                atual === c.cliente ? "bg-navy-tint" : "hover:bg-secondary",
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className={cn("truncate text-[13px]", atual === c.cliente && "font-semibold")}
                  title={c.cliente}
                >
                  {c.cliente}
                </span>
                <span className="font-mono text-[12px] text-muted-foreground">{nf(c.total)}</span>
              </span>
              <span
                className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-secondary"
                title={ORDEM.map((s) => `${ROTULO_STATUS[s]}: ${c[s]}`).join(" · ")}
              >
                {ORDEM.map(
                  (s) =>
                    c[s] > 0 && (
                      <span
                        key={s}
                        style={{ width: `${(100 * c[s]) / c.total}%`, background: COR_STATUS[s] }}
                      />
                    ),
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function BarraConsumo({
  rotulo,
  usado,
  contratado,
}: {
  rotulo: string;
  usado: number;
  contratado: number | null;
}) {
  const pct = contratado ? Math.min(100, (100 * usado) / contratado) : 0;
  const acima = contratado != null && usado > contratado;
  return (
    <div className="text-[12px]">
      <div className="flex justify-between">
        <span className="text-muted-foreground">{rotulo}</span>
        <span className={cn("font-medium", acima && "text-coral")}>
          {nf(usado)} de {contratado == null ? "?" : nf(contratado)}
          {contratado != null &&
            (acima ? ` · ${nf(usado - contratado)} acima` : ` · saldo ${nf(contratado - usado)}`)}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: acima ? "var(--coral)" : "var(--brand-navy)" }}
        />
      </div>
    </div>
  );
}

function PainelContratos({
  contratos,
  atual,
  cliente,
  onEscolher,
}: {
  contratos: ContratoEstoque[];
  atual: number | null;
  cliente?: { grupo: string | null; como_ligado: string };
  onEscolher: (id: number) => void;
}) {
  return (
    <Card title="Contratos do cliente" icon={FileText} bodyClassName="p-4">
      {cliente && (
        <p className="mb-3 text-[12px] text-muted-foreground">
          {cliente.grupo
            ? `Ligado ao grupo ${cliente.grupo} ${cliente.como_ligado === "placas" ? "pelas placas onde os seriais estão instalados" : cliente.como_ligado === "nome" ? "pelo nome" : "manualmente"}.`
            : "Cliente da planilha sem grupo correspondente na plataforma: os seriais ficam sem contrato."}
        </p>
      )}
      {contratos.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nenhum contrato para este cliente.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {contratos.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onEscolher(c.id)}
              aria-pressed={atual === c.id}
              className={cn(
                "space-y-2 rounded-xl border p-3 text-left transition-colors",
                atual === c.id
                  ? "border-brand-navy bg-navy-tint"
                  : "border-border hover:bg-secondary/50",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] font-semibold">{c.numero}</span>
                <span className="truncate text-[12px] text-muted-foreground">{c.nome}</span>
                {c.status !== "ativo" && (
                  <Pill tone={c.status === "encerrado" ? "neutral" : "gold"}>
                    {c.status === "encerrado" ? "Encerrado" : "Suspenso"}
                  </Pill>
                )}
                {c.vencido && c.status === "ativo" && <Pill tone="coral">Vencido</Pill>}
              </div>
              <BarraConsumo
                rotulo="Rastreadores"
                usado={c.rastreadores}
                contratado={c.contratado}
              />
              <BarraConsumo rotulo="Câmeras" usado={c.cameras} contratado={c.contratado} />
              <p className="text-[11px] text-muted-foreground">
                Vigência até {dia(c.fim)}
                {c.aditivos.length > 0 &&
                  ` · aditivos ${c.aditivos.map((a) => `${a.numero} (${a.tipo === "retirada" ? "−" : "+"}${a.qtd})`).join(", ")}`}
              </p>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function DetalheSerial({
  e,
  contratos,
  onFeito,
}: {
  e: Equipamento;
  contratos: ContratoEstoque[];
  onFeito: () => void;
}) {
  const qc = useQueryClient();
  const h = useQuery(historicoSerialQuery(e.id));
  const [acao, setAcao] = useState<AcaoLancamento | null>(null);
  const [motivo, setMotivo] = useState("");
  const [chamado, setChamado] = useState("");
  const [nfRet, setNfRet] = useState("");
  const [contratoId, setContratoId] = useState<string>(e.contrato_id ? String(e.contrato_id) : "");
  const [aditivoId, setAditivoId] = useState<string>(e.aditivo_id ? String(e.aditivo_id) : "");
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    setAcao(null);
    setMotivo("");
    setChamado("");
    setNfRet("");
  }, [e.id]);

  const lancar = async (a: AcaoLancamento) => {
    setSalvando(true);
    try {
      const r = await Estoque.lancar(e.id, {
        acao: a,
        motivo: motivo || undefined,
        chamado: chamado || undefined,
        nf: nfRet || undefined,
        contrato_id: a === "vincular" ? (contratoId ? Number(contratoId) : null) : undefined,
        aditivo_id: a === "vincular" ? (aditivoId ? Number(aditivoId) : null) : undefined,
      });
      toast.success(r.texto);
      setAcao(null);
      await qc.invalidateQueries({ queryKey: ["estoque", "historico", e.id] });
      onFeito();
    } catch (err) {
      toast.error(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };
  const precisaMotivo = acao === "manutencao" || acao === "devolucao";
  const contratoSel = contratos.find((c) => String(c.id) === contratoId);

  return (
    <div className="space-y-5 pb-8">
      <SheetHeader>
        <SheetTitle className="font-mono">{e.serial}</SheetTitle>
        <SheetDescription>
          {e.modelo} · {e.tipo === "camera" ? "câmera" : "rastreador / telemetria"}
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={TOM_STATUS[e.status]}>{ROTULO_STATUS[e.status]}</Pill>
          {e.subtipo === "desinstalado" && <Pill tone="neutral">Desinstalado</Pill>}
          <span className="text-[12px] text-muted-foreground">
            {e.origem_status === "manual" ? "Status lançado manualmente" : "Status calculado"}
          </span>
        </div>
        <p className="text-[13px] text-foreground">{e.explicacao}</p>
      </div>

      {e.alertas.length > 0 && (
        <div className="space-y-1.5">
          {e.alertas.map((a) => (
            <p
              key={a.codigo}
              className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[12px]"
            >
              <span className="font-mono font-bold">{a.codigo}</span>
              <span>
                <span className="font-semibold">{ROTULO_ALERTA[a.codigo]}.</span> {a.texto}
              </span>
            </p>
          ))}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        {(
          [
            ["Cliente", e.cliente],
            [
              "Contrato",
              e.contrato_numero
                ? `${e.contrato_numero}${e.contrato_nome ? ` · ${e.contrato_nome}` : ""}`
                : "Sem contrato",
            ],
            ["Aditivo", e.aditivo_numero ?? "—"],
            [
              "Vínculo",
              e.vinculo === "manual"
                ? "Escolhido à mão"
                : e.vinculo === "automatico"
                  ? "Contrato do grupo do cliente"
                  : "—",
            ],
            ["Placa", e.placa ?? "—"],
            ["Grupo da placa", e.grupo_placa ?? "—"],
            [
              "Placa anterior",
              e.placa_anterior ? `${e.placa_anterior} (até ${dia(e.retirado_em)})` : "—",
            ],
            ["Última leitura", leitura(e)],
            ["NF / pedido", e.nf ?? "—"],
            ["Entrada no controle", e.origem],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
            <dd className="truncate text-foreground" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2">
        <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Ações
        </h4>
        <div className="flex flex-wrap gap-2">
          {e.status === "manutencao" ? (
            <AcaoBtn onClick={() => lancar("concluir_manutencao")} disabled={salvando}>
              Concluir manutenção
            </AcaoBtn>
          ) : e.status === "devolucao" ? (
            <>
              <AcaoBtn onClick={() => lancar("confirmar_devolucao")} disabled={salvando}>
                Confirmar recebimento na matriz
              </AcaoBtn>
              <AcaoBtn onClick={() => lancar("cancelar_devolucao")} disabled={salvando}>
                Cancelar devolução
              </AcaoBtn>
            </>
          ) : (
            <>
              <AcaoBtn onClick={() => setAcao("manutencao")}>
                <Wrench className="h-3.5 w-3.5" /> Enviar para manutenção
              </AcaoBtn>
              {e.cliente !== MATRIZ && (
                <AcaoBtn onClick={() => setAcao("devolucao")}>Iniciar devolução</AcaoBtn>
              )}
              {e.cliente !== MATRIZ && (
                <AcaoBtn onClick={() => setAcao("vincular")}>Trocar contrato</AcaoBtn>
              )}
            </>
          )}
        </div>
        {acao && (
          <div className="space-y-2 rounded-xl border border-brand-navy/40 p-3">
            {precisaMotivo && (
              <input
                id="est-motivo"
                value={motivo}
                onChange={(ev) => setMotivo(ev.target.value)}
                placeholder="Motivo *"
                className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]"
              />
            )}
            {acao === "manutencao" && (
              <input
                id="est-chamado"
                value={chamado}
                onChange={(ev) => setChamado(ev.target.value)}
                placeholder="Chamado (opcional)"
                className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]"
              />
            )}
            {acao === "devolucao" && (
              <input
                id="est-nf-ret"
                value={nfRet}
                onChange={(ev) => setNfRet(ev.target.value)}
                placeholder="NF de retorno (opcional)"
                className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]"
              />
            )}
            {acao === "vincular" && (
              <>
                <select
                  id="est-vinc-ct"
                  value={contratoId}
                  onChange={(ev) => {
                    setContratoId(ev.target.value);
                    setAditivoId("");
                  }}
                  className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[13px]"
                >
                  <option value="">Contrato do grupo do cliente (automático)</option>
                  {contratos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.numero} · {c.nome}
                    </option>
                  ))}
                </select>
                {contratoSel && contratoSel.aditivos.length > 0 && (
                  <select
                    id="est-vinc-ad"
                    value={aditivoId}
                    onChange={(ev) => setAditivoId(ev.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-white px-2 text-[13px]"
                  >
                    <option value="">Sem aditivo (contrato original)</option>
                    {contratoSel.aditivos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.numero}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={salvando || (precisaMotivo && !motivo.trim())}
                onClick={() => lancar(acao)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-navy px-4 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar
              </button>
              <button
                type="button"
                onClick={() => setAcao(null)}
                className="h-9 rounded-lg border border-border px-3 text-[13px]"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico
        </h4>
        {h.isPending ? (
          <SkeletonRows rows={3} />
        ) : (
          <ol className="space-y-1.5 border-l border-border pl-3">
            {(h.data?.data ?? []).map((m) => (
              <li key={m.id} className="text-[12px]">
                <span className="font-mono text-muted-foreground">{dataHora(m.em)}</span>
                <span className="block text-foreground">{m.texto}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function AcaoBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[13px] font-medium hover:bg-secondary disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function FormExpedicao({
  clientes,
  clienteInicial,
  onFeito,
}: {
  clientes: string[];
  clienteInicial: string;
  onFeito: (cliente: string, expedidos: string[]) => void;
}) {
  const [cliente, setCliente] = useState(clienteInicial);
  const [contrato, setContrato] = useState("");
  const [aditivo, setAditivo] = useState("");
  const [modelo, setModelo] = useState("");
  const [seriais, setSeriais] = useState("");
  const [nfPed, setNfPed] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [lista, setLista] = useState<ContratoEstoque[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    setContrato("");
    setAditivo("");
    if (!cliente) return setLista([]);
    setCarregando(true);
    api
      .get<{ contratos: ContratoEstoque[] }>(
        `/api/v1/estoque/contratos-do-cliente?cliente=${encodeURIComponent(cliente)}`,
      )
      .then((r) => {
        setLista(r.contratos);
        if (r.contratos.length === 1) setContrato(String(r.contratos[0].id));
      })
      .catch((e) => toast.error(mensagemErro(e)))
      .finally(() => setCarregando(false));
  }, [cliente]);

  const qtd = new Set(
    seriais
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map((s) => s.toUpperCase()),
  ).size;
  const ct = lista.find((c) => String(c.id) === contrato);
  const camera = ["MV 03", "G40 PRO", "G40 BASICA", "JIMI JC450"].includes(modelo);
  const saldo = ct ? (camera ? ct.saldo_cameras : ct.saldo_rastreadores) : null;
  const bloqueio = !ct
    ? null
    : ct.status === "encerrado"
      ? "Contrato encerrado: não é possível expedir."
      : saldo != null && qtd > saldo
        ? `Passa do saldo (${nf(saldo)}). Cadastre um aditivo de ${nf(qtd - saldo)} veículo(s) no contrato.`
        : null;

  const enviar = async () => {
    setSalvando(true);
    try {
      const r = await Estoque.expedir({
        cliente,
        contrato_id: Number(contrato),
        aditivo_id: aditivo ? Number(aditivo) : null,
        modelo,
        seriais,
        nf: nfPed || undefined,
      });
      toast.success(`${nf(r.expedidos.length)} serial(is) expedido(s) para ${cliente}.`, {
        description:
          [
            r.ignorados.length
              ? `Ignorados por estarem com outro cliente (devolva antes): ${r.ignorados.join(", ")}.`
              : "",
            r.ja_no_cliente.length
              ? `Já estavam com este cliente: ${r.ja_no_cliente.join(", ")}.`
              : "",
            r.aviso ?? "",
          ]
            .filter(Boolean)
            .join(" ") || undefined,
        duration: 12000,
      });
      onFeito(cliente, r.expedidos);
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  const css = "mt-1 h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]";
  return (
    <div className="space-y-4 pb-8">
      <SheetHeader>
        <SheetTitle>Registrar expedição</SheetTitle>
        <SheetDescription>
          Os seriais entram como Em estoque no cliente, sem placa, ligados ao contrato escolhido.
        </SheetDescription>
      </SheetHeader>
      <label htmlFor="exp-cliente" className="block text-[12px] text-muted-foreground">
        Cliente *
        <select
          id="exp-cliente"
          value={cliente}
          onChange={(e) => setCliente(e.target.value)}
          className={css}
        >
          <option value="">Escolha…</option>
          {clientes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="exp-contrato" className="block text-[12px] text-muted-foreground">
        Contrato *
        <select
          id="exp-contrato"
          value={contrato}
          onChange={(e) => {
            setContrato(e.target.value);
            setAditivo("");
          }}
          disabled={!cliente || carregando}
          className={css}
        >
          <option value="">
            {carregando
              ? "Carregando…"
              : lista.length
                ? "Escolha…"
                : cliente
                  ? "Cliente sem contrato"
                  : "Escolha o cliente antes"}
          </option>
          {lista.map((c) => (
            <option key={c.id} value={c.id}>
              {c.numero} · {c.nome}
              {c.status !== "ativo" ? ` (${c.status})` : ""}
            </option>
          ))}
        </select>
      </label>
      {ct && ct.aditivos.length > 0 && (
        <label htmlFor="exp-aditivo" className="block text-[12px] text-muted-foreground">
          Aditivo (se os veículos vieram por aditivo)
          <select
            id="exp-aditivo"
            value={aditivo}
            onChange={(e) => setAditivo(e.target.value)}
            className={css}
          >
            <option value="">Contrato original</option>
            {ct.aditivos
              .filter((a) => a.tipo === "inclusao")
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.numero} (+{a.qtd} veículos)
                </option>
              ))}
          </select>
        </label>
      )}
      <label htmlFor="exp-modelo" className="block text-[12px] text-muted-foreground">
        Modelo dos seriais *
        <select
          id="exp-modelo"
          value={modelo}
          onChange={(e) => setModelo(e.target.value)}
          className={css}
        >
          <option value="">Escolha…</option>
          {MODELOS_EXPEDICAO.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="exp-seriais" className="block text-[12px] text-muted-foreground">
        Seriais * (um por linha ou separados por vírgula)
        <textarea
          id="exp-seriais"
          value={seriais}
          onChange={(e) => setSeriais(e.target.value)}
          rows={6}
          className={cn(css, "h-auto py-2 font-mono")}
        />
      </label>
      <label htmlFor="exp-nf" className="block text-[12px] text-muted-foreground">
        NF ou pedido
        <input
          id="exp-nf"
          value={nfPed}
          onChange={(e) => setNfPed(e.target.value)}
          className={css}
        />
      </label>

      <div
        className={cn(
          "rounded-xl border p-3 text-[12px]",
          bloqueio ? "border-coral/50 bg-coral/10" : "border-border bg-secondary/40",
        )}
      >
        <p>{nf(qtd)} serial(is) identificado(s).</p>
        {ct && (
          <p>
            Saldo do contrato {ct.numero} para {camera ? "câmeras" : "rastreadores"}:{" "}
            {saldo == null ? "quantidade não informada no contrato" : nf(saldo)}.
          </p>
        )}
        {bloqueio && <p className="mt-1 font-semibold text-coral">{bloqueio}</p>}
      </div>

      <button
        type="button"
        onClick={enviar}
        disabled={salvando || !cliente || !contrato || !modelo || !qtd || Boolean(bloqueio)}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-navy px-4 text-[13px] font-semibold text-white disabled:opacity-50"
      >
        {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar expedição
      </button>
    </div>
  );
}
