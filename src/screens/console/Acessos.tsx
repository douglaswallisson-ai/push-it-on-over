import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  Bot,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  Laptop,
  Loader2,
  MonitorSmartphone,
  Search,
  Smartphone,
  UserMinus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, type Column } from "@/components/ss/ui/data";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Aviso, DicaGrafico, Grafico, Info, Kpi, MatrizCalor } from "@/screens/gerencial/pecas";
import {
  detalhePessoaQuery,
  painelAcessosQuery,
  paginasAcessosQuery,
  paginasPessoaQuery,
  type EmpresaAcesso,
  type PaginaAcesso,
  type PessoaAcesso,
} from "@/lib/acessos-api";
import { usandoMock } from "@/lib/modo";
import { cn } from "@/lib/utils";

/**
 * Acessos — quem usa a plataforma, quando e com que frequência. Exclusivo da
 * equipe SS (fica no Console).
 *
 * Fonte: entradas do sistema antigo (`mova.session`), só pessoas. Robôs de
 * integração e o Power BI ficam num quadro à parte, porque são ~95% das linhas
 * e apagariam o desenho do uso humano.
 */

const nf = (v: number | null | undefined, c = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dataHora = (s?: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
/** 95 → "1 min 35 s". */
const duracao = (s: number) =>
  s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
const haDias = (s?: string | null) => (s ? Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000) : null);

type PeriodoId = "7" | "30" | "90" | "180";
const PERIODOS: { id: PeriodoId; rotulo: string }[] = [
  { id: "7", rotulo: "Últimos 7 dias" },
  { id: "30", rotulo: "Últimos 30 dias" },
  { id: "90", rotulo: "Últimos 90 dias" },
  { id: "180", rotulo: "Últimos 180 dias" },
];

/** O backend usa 1 = segunda … 7 = domingo; o mapa de calor usa 0 = domingo. */
const paraMatriz = (m: { dia: number; hora: number; acessos?: number; pessoas?: number }[], campo: "acessos" | "pessoas" = "acessos") =>
  m.map((c) => ({ dow: c.dia % 7, hora: c.hora, n: (c[campo] as number) ?? 0 }));

function Frequencia({ dias, periodo }: { dias: number; periodo: number }) {
  const uteis = Math.max(1, Math.round((periodo * 5) / 7));
  const pct = dias / uteis;
  const [rotulo, tom] =
    pct >= 0.6 ? ["diário", "green"] : pct >= 0.25 ? ["semanal", "sky"] : pct >= 0.08 ? ["eventual", "gold"] : ["raro", "neutral"];
  return <Pill tone={tom as "green" | "sky" | "gold" | "neutral"}>{rotulo}</Pill>;
}

/** O Console não tem o provedor de dicas (ⓘ) que a área /app tem. */
export default function Acessos() {
  return (
    <TooltipProvider delayDuration={150}>
      <PainelAcessos />
    </TooltipProvider>
  );
}

function PainelAcessos() {
  const [periodo, setPeriodo] = useState<PeriodoId>("30");
  const [grupo, setGrupo] = useState<string>("");
  const [incluirSS, setIncluirSS] = useState(false);
  const [medida, setMedida] = useState<"acessos" | "pessoas">("pessoas");
  const [busca, setBusca] = useState("");
  const [pessoaId, setPessoaId] = useState<number | null>(null);

  const janela = useMemo(() => {
    const fim = new Date();
    const ini = new Date();
    ini.setDate(fim.getDate() - Number(periodo) + 1);
    return { inicio: iso(ini), fim: iso(fim) };
  }, [periodo]);

  const q = useQuery(painelAcessosQuery({ ...janela, grupo: grupo || undefined, incluirSS }));
  // A lista de clientes vem sempre do painel sem filtro, para o seletor não encolher.
  const todos = useQuery(painelAcessosQuery({ ...janela, incluirSS }));
  const r = q.data;
  const t = r?.totais;

  const clientes = useMemo(
    () => (todos.data?.empresas ?? []).filter((e) => e.group_id != null).sort((a, b) => a.nome.localeCompare(b.nome)),
    [todos.data],
  );

  const pessoas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (r?.pessoas ?? []).filter((p) => !b || `${p.nome} ${p.login} ${p.empresa}`.toLowerCase().includes(b));
  }, [r, busca]);

  const serie = (r?.por_dia ?? []).map((d) => ({ rotulo: ddmm(d.dia), Pessoas: d.pessoas, Acessos: d.acessos }));

  const aparelhos = useMemo(() => {
    const por = new Map<string, number>();
    const nav = new Map<string, number>();
    for (const d of r?.dispositivos ?? []) {
      por.set(d.dispositivo, (por.get(d.dispositivo) ?? 0) + d.acessos);
      nav.set(d.navegador, (nav.get(d.navegador) ?? 0) + d.acessos);
    }
    const total = [...por.values()].reduce((a, b) => a + b, 0) || 1;
    return {
      por: [...por.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ nome: k, pct: (100 * v) / total })),
      nav: [...nav.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ nome: k, pct: (100 * v) / total })),
    };
  }, [r]);

  const colsEmpresa: Column<EmpresaAcesso>[] = [
    { key: "nome", header: "Cliente", render: (e) => <span className="font-semibold">{e.nome}</span> },
    { key: "pessoas", header: "Pessoas que usaram", align: "right", render: (e) => <span className="font-mono">{nf(e.pessoas)}</span> },
    { key: "cad", header: "Usuários ativos", align: "right", render: (e) => <span className="font-mono text-muted-foreground">{nf(e.cadastrados)}</span> },
    {
      key: "adocao",
      header: "Adoção",
      align: "right",
      render: (e) =>
        e.adocao_pct == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="inline-flex items-center justify-end gap-2">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
              <span
                className={cn("block h-full rounded-full", e.adocao_pct >= 50 ? "bg-leaf" : e.adocao_pct >= 25 ? "bg-gold" : "bg-coral")}
                style={{ width: `${Math.min(100, e.adocao_pct)}%` }}
              />
            </span>
            <span className="w-12 font-mono">{nf(e.adocao_pct, 0)}%</span>
          </span>
        ),
    },
    { key: "freq", header: "Dias por pessoa", align: "right", render: (e) => <span className="font-mono">{nf(e.dias_por_pessoa, 1)}</span> },
    { key: "ultimo", header: "Último acesso", align: "right", render: (e) => <span className="text-[13px] text-muted-foreground">{dataHora(e.ultimo)}</span> },
  ];

  const colsPessoa: Column<PessoaAcesso>[] = [
    {
      key: "nome",
      header: "Pessoa",
      render: (p) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold">{p.nome}</span>
          <span className="block truncate text-[12px] text-muted-foreground">{p.empresa}</span>
        </span>
      ),
    },
    { key: "freq", header: "Frequência", render: (p) => <Frequencia dias={p.dias} periodo={r?.periodo.dias ?? 30} /> },
    { key: "dias", header: "Dias com acesso", align: "right", render: (p) => <span className="font-mono">{nf(p.dias)}</span> },
    { key: "acessos", header: "Entradas", align: "right", render: (p) => <span className="font-mono">{nf(p.acessos)}</span> },
    {
      key: "disp",
      header: "Aparelho",
      render: (p) => (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
          {p.dispositivo === "computador" ? <Laptop className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
          {p.navegador}
        </span>
      ),
    },
    { key: "ultimo", header: "Último acesso", align: "right", render: (p) => <span className="text-[13px] text-muted-foreground">{dataHora(p.ultimo)}</span> },
  ];

  if (usandoMock()) {
    return (
      <>
        <PageHeader title="Acessos" subtitle="Quem usa a plataforma, quando e com que frequência" />
        <main className="px-8 py-6">
          <Aviso>Esta tela usa os dados reais de acesso. Entre com a API ligada para vê-la.</Aviso>
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Acessos"
        subtitle={r ? `Uso da plataforma · ${ddmm(r.periodo.inicio)} a ${ddmm(r.periodo.fim)}` : "Quem usa a plataforma, quando e com que frequência"}
      />
      <main className="space-y-5 px-4 py-6 sm:px-8">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as PeriodoId)}
            aria-label="Período"
            className="h-9 rounded-lg border border-border bg-white px-3 text-[13px]"
          >
            {PERIODOS.map((p) => (
              <option key={p.id} value={p.id}>{p.rotulo}</option>
            ))}
          </select>
          <Building2 className="ml-2 h-4 w-4 text-muted-foreground" />
          <select
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            aria-label="Cliente"
            className="h-9 max-w-[280px] rounded-lg border border-border bg-white px-3 text-[13px]"
          >
            <option value="">Todos os clientes</option>
            {clientes.map((c) => (
              <option key={c.group_id} value={String(c.group_id)}>{c.nome}</option>
            ))}
          </select>
          <label className="ml-2 flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
            <input type="checkbox" checked={incluirSS} onChange={(e) => setIncluirSS(e.target.checked)} className="h-4 w-4 accent-[var(--brand-navy)]" />
            Incluir equipe SS
          </label>
          {q.isFetching && <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {q.isError ? (
          <Aviso>Não foi possível carregar os acessos agora. Tente de novo em instantes.</Aviso>
        ) : !r ? (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-10 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo as entradas do período…
          </div>
        ) : (
          <>
            <Aviso tom="sky">
              Fonte: entradas no <b>sistema atual</b> (cada login ou renovação de sessão), só de pessoas. As <b>páginas abertas</b> vêm da
              plataforma nova, que passou a registrar cada tela visitada.
            </Aviso>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <Kpi icon={Users} label="Pessoas que usaram" valor={t!.pessoas} atual={t!.pessoas} anterior={t!.anterior.pessoas} dica="Pessoas diferentes com pelo menos uma entrada no período, comparado ao período anterior do mesmo tamanho." />
              <Kpi icon={Activity} label="Entradas" valor={t!.acessos} atual={t!.acessos} anterior={t!.anterior.acessos} dica="Logins e renovações de sessão feitos por pessoas (sem robôs de integração)." />
              <Kpi icon={CalendarDays} label="Dias de uso por pessoa" valor={t!.dias_por_pessoa} fmt={(n) => nf(n, 1)} sub={`em ${r.periodo.dias} dias`} dica="Média de dias diferentes em que cada pessoa entrou." />
              <Kpi icon={Building2} label="Clientes com uso" valor={t!.empresas} sub="grupos com pelo menos 1 pessoa" />
              <Kpi icon={UserMinus} label="Pararam de entrar" valor={t!.sumidos} alerta={t!.sumidos > 0} sub="usavam nos 60 dias antes" dica="Pessoas ativas que entraram nos 60 dias antes do período e não entraram nele. Bom ponto de contato do CS." />
            </div>

            <Card
              title="Mapa de calor — dia da semana × hora"
              icon={Clock}
              action={
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
                    {(["pessoas", "acessos"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMedida(m)}
                        aria-pressed={medida === m}
                        className={cn("rounded-md px-3 py-1 text-[12px] font-medium", medida === m ? "bg-white shadow-sm" : "text-muted-foreground")}
                      >
                        {m === "pessoas" ? "Pessoas" : "Entradas"}
                      </button>
                    ))}
                  </div>
                  <Info texto="Cada quadrado é uma hora de um dia da semana, somando todo o período. Em Pessoas, conta quantas pessoas diferentes entraram naquela hora (no total da linha, quem entrou em várias horas conta em cada uma). Hora de Brasília." />
                </div>
              }
              bodyClassName="p-4"
            >
              <MatrizCalor celulas={paraMatriz(r.matriz, medida)} unidade={medida === "pessoas" ? "pessoas" : "entradas"} />
            </Card>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
              <Grafico titulo="Uso por dia" icon={Activity} altura={260} dica="Pessoas diferentes que entraram em cada dia.">
                <AreaChart data={serie}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="p" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<DicaGrafico fmt={(v) => nf(v)} />} />
                  <Area yAxisId="p" dataKey="Pessoas" stroke="var(--brand-navy)" fill="var(--brand-navy)" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </Grafico>
              <Card title="Como acessam" icon={MonitorSmartphone} bodyClassName="space-y-4 p-4">
                {[["Aparelho", aparelhos.por], ["Navegador", aparelhos.nav]].map(([titulo, lista]) => (
                  <div key={titulo as string}>
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo as string}</p>
                    <div className="space-y-1.5">
                      {(lista as { nome: string; pct: number }[]).slice(0, 5).map((x) => (
                        <div key={x.nome} className="flex items-center gap-3 text-[13px]">
                          <span className="w-24 shrink-0 capitalize">{x.nome}</span>
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                            <span className="block h-full rounded-full bg-brand-navy/70" style={{ width: `${x.pct}%` }} />
                          </span>
                          <span className="w-12 text-right font-mono text-[13px]">{nf(x.pct, 0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            {!grupo && (
              <Card title="Uso por cliente" icon={Building2} action={<Info texto="Cliente = grupo principal do usuário. Adoção = pessoas que entraram ÷ usuários ativos do cliente. Clique para filtrar." />} bodyClassName="p-4">
                <DataTable
                  columns={colsEmpresa as unknown as Column<Record<string, unknown>>[]}
                  rows={r.empresas as unknown as Record<string, unknown>[]}
                  onRowClick={(e) => (e as unknown as EmpresaAcesso).group_id && setGrupo(String((e as unknown as EmpresaAcesso).group_id))}
                />
              </Card>
            )}

            <Card
              title="Pessoas"
              icon={Users}
              action={
                <label className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar pessoa ou cliente"
                    aria-label="Buscar pessoa ou cliente"
                    className="h-8 w-56 rounded-lg border border-border bg-white pl-8 pr-3 text-[13px]"
                  />
                </label>
              }
              bodyClassName="p-4"
            >
              <DataTable
                columns={colsPessoa as unknown as Column<Record<string, unknown>>[]}
                rows={pessoas as unknown as Record<string, unknown>[]}
                onRowClick={(p) => setPessoaId((p as unknown as PessoaAcesso).user_id)}
                empty="Ninguém com esse nome no período."
              />
              <p className="mt-2 text-[12px] text-muted-foreground">Clique numa pessoa para ver o mapa de calor dela e as últimas entradas.</p>
            </Card>

            <PaginasMaisAcessadas janela={janela} grupo={grupo || undefined} incluirSS={incluirSS} onPessoa={setPessoaId} />

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <Card title="Pararam de entrar" icon={UserMinus} action={<Pill tone="coral">{r.sumidos.length}</Pill>} bodyClassName="p-4">
                {r.sumidos.length ? (
                  <ul className="divide-y divide-border">
                    {r.sumidos.slice(0, 15).map((s) => (
                      <li key={s.user_id}>
                        <button type="button" onClick={() => setPessoaId(s.user_id)} className="flex w-full items-center gap-3 py-2 text-left hover:bg-secondary/40">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium">{s.nome}</span>
                            <span className="block truncate text-[12px] text-muted-foreground">{s.empresa}</span>
                          </span>
                          <span className="text-right text-[12px] text-muted-foreground">
                            última entrada há <b className="text-foreground">{haDias(s.ultimo)} dias</b>
                            <span className="block">usava {s.dias_antes} dias antes</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted-foreground">Todo mundo que usava continua entrando.</p>
                )}
              </Card>
              <Card
                title="Integrações (fora da contagem)"
                icon={Bot}
                action={<Info texto="Robôs e ferramentas que entram com usuário de pessoa: o Synapse a cada 15 segundos e o Power BI ao atualizar relatórios. Não entram no mapa de calor nem nos totais." />}
                bodyClassName="p-4"
              >
                <ul className="divide-y divide-border">
                  {r.integracoes.slice(0, 8).map((i) => (
                    <li key={`${i.user_id}-${i.tipo}`} className="flex items-center gap-3 py-2 text-[13px]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{i.nome}</span>
                        <span className="block truncate text-[12px] text-muted-foreground">{i.empresa}</span>
                      </span>
                      <Pill tone="neutral">{i.tipo}</Pill>
                      <span className="w-20 text-right font-mono text-[13px]">{nf(i.acessos)}</span>
                    </li>
                  ))}
                  {!r.integracoes.length && <li className="py-2 text-[13px] text-muted-foreground">Nenhuma integração no período.</li>}
                </ul>
              </Card>
            </div>
          </>
        )}
      </main>

      <DetalhePessoa id={pessoaId} janela={janela} onClose={() => setPessoaId(null)} />
    </>
  );
}

function DetalhePessoa({ id, janela, onClose }: { id: number | null; janela: { inicio: string; fim: string }; onClose: () => void }) {
  const q = useQuery(detalhePessoaQuery(id, janela));
  const pg = useQuery(paginasPessoaQuery(id, janela));
  const d = q.data;
  return (
    <Sheet open={id != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[820px]">
        <SheetHeader>
          <SheetTitle>{d?.usuario.nome ?? "Carregando…"}</SheetTitle>
          {d && (
            <p className="text-[13px] text-muted-foreground">
              {d.usuario.empresa} · {d.usuario.login}
              {!d.usuario.ativo && <span className="ml-2"><Pill tone="coral">usuário inativo</Pill></span>}
            </p>
          )}
        </SheetHeader>
        {q.isLoading ? (
          <p className="mt-6 flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo as entradas…
          </p>
        ) : d ? (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border px-4 py-3">
                <p className="text-[12px] text-muted-foreground">Entradas</p>
                <p className="font-mono text-xl font-semibold">{nf(d.ultimos.length ? d.por_dia.reduce((a, x) => a + x.acessos, 0) : 0)}</p>
              </div>
              <div className="rounded-xl border border-border px-4 py-3">
                <p className="text-[12px] text-muted-foreground">Dias com acesso</p>
                <p className="font-mono text-xl font-semibold">{nf(d.por_dia.length)}</p>
              </div>
              <div className="rounded-xl border border-border px-4 py-3">
                <p className="text-[12px] text-muted-foreground">Última entrada</p>
                <p className="font-mono text-[16px] font-semibold">{dataHora(d.ultimos[0]?.em)}</p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold">Quando entra</p>
              {d.matriz.length ? <MatrizCalor celulas={paraMatriz(d.matriz)} unidade="entradas" /> : <p className="text-[13px] text-muted-foreground">Sem entradas no período.</p>}
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold">Páginas que mais abre (plataforma nova)</p>
              {pg.data?.paginas.length ? (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {pg.data.paginas.slice(0, 10).map((p) => (
                    <li key={p.caminho} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                      <span className="min-w-0 flex-1 truncate">{p.titulo}</span>
                      <span className="font-mono">{nf(p.visitas)}×</span>
                      <span className="w-24 text-right text-muted-foreground">{duracao(p.tempo_medio_s)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted-foreground">Nenhuma página registrada para esta pessoa no período.</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold">Últimas entradas</p>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {d.ultimos.slice(0, 15).map((u, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                    {u.dispositivo === "computador" ? <Laptop className="h-3.5 w-3.5 text-muted-foreground" /> : <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="flex-1">{dataHora(u.em)}</span>
                    <span className="text-muted-foreground">{u.navegador}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PaginasMaisAcessadas({
  janela,
  grupo,
  incluirSS,
  onPessoa,
}: {
  janela: { inicio: string; fim: string };
  grupo?: string;
  incluirSS: boolean;
  onPessoa: (id: number) => void;
}) {
  const q = useQuery(paginasAcessosQuery({ ...janela, grupo, incluirSS }));
  const [aberta, setAberta] = useState<string | null>(null);
  const d = q.data;
  const max = Math.max(1, ...(d?.paginas ?? []).map((p) => p.visitas));
  const desde = d?.registro_desde ? new Date(d.registro_desde).toLocaleDateString("pt-BR") : null;

  return (
    <Card
      title="Páginas mais acessadas"
      icon={FileText}
      action={
        <div className="flex items-center gap-2">
          {d && <Pill tone="sky">{nf(d.total_visitas)} visitas</Pill>}
          <Info texto="Telas abertas na plataforma nova: quantas vezes, por quantas pessoas e quanto tempo ficaram na tela (só o tempo com a aba visível; passagens de menos de 2 s não contam). Clique numa página para ver quem mais usa." />
        </div>
      }
      bodyClassName="p-4"
    >
      {q.isLoading ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : !d?.paginas.length ? (
        <p className="text-[13px] text-muted-foreground">
          {desde
            ? "Nenhuma página aberta neste período ou filtro."
            : "O registro de páginas acabou de ser ligado: as visitas aparecem aqui conforme as pessoas usarem a plataforma nova."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="bg-secondary/60 text-[12px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Página</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Visitas</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Pessoas</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Tempo médio</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Última visita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.paginas.map((p: PaginaAcesso) => (
                  <Fragment key={p.caminho}>
                    <tr className="cursor-pointer hover:bg-secondary/40" onClick={() => setAberta(aberta === p.caminho ? null : p.caminho)}>
                      <td className="px-4 py-2.5">
                        <span className="block font-medium">{p.titulo}</span>
                        <span className="block font-mono text-[12px] text-muted-foreground">{p.caminho}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-28 overflow-hidden rounded-full bg-secondary">
                            <span className="block h-full rounded-full bg-brand-navy/75" style={{ width: `${(100 * p.visitas) / max}%` }} />
                          </span>
                          <span className="font-mono">{nf(p.visitas)}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">{nf(p.pessoas)}</td>
                      <td className="px-3 py-2.5 text-right">{duracao(p.tempo_medio_s)}</td>
                      <td className="px-4 py-2.5 text-right text-[13px] text-muted-foreground">{dataHora(p.ultimo)}</td>
                    </tr>
                    {aberta === p.caminho && (
                      <tr className="bg-secondary/30">
                        <td colSpan={5} className="px-4 py-3">
                          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Quem mais usa</p>
                          <div className="flex flex-wrap gap-2">
                            {p.quem_mais_usa.map((u) => (
                              <button
                                key={u.user_id}
                                type="button"
                                onClick={() => onPessoa(u.user_id)}
                                className="rounded-lg border border-border bg-white px-3 py-1.5 text-left text-[13px] hover:border-brand-sky"
                              >
                                <span className="font-medium">{u.nome}</span>
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {u.empresa ?? "—"} · {nf(u.visitas)}×
                                </span>
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {desde && <p className="mt-2 text-[12px] text-muted-foreground">Registro de páginas desde {desde}.</p>}
        </>
      )}
    </Card>
  );
}
