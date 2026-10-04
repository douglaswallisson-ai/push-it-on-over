import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { lerSessao } from "@/lib/session";
import { mensagemErro } from "@/lib/suporte-api";
import {
  CombustivelApi,
  fBRL,
  fDT,
  fKm,
  fKmL,
  fL,
  fN0,
  fN2,
  lerNumero,
  plural,
  type Abastecimento,
  type Alerta,
  type Catalogo,
  type ContaAlertas,
  type DetalhePendencia,
  type Issue,
  type LinhaPlanilha,
  type Pendencia,
  type Posto,
  type ResumoVeiculo,
  type StatusConsumo,
  type Telemetria,
} from "@/lib/combustivel-api";
import { cn } from "@/lib/utils";

/**
 * Controle de Combustível — o mesmo módulo que o time de TI fez no Dashboard
 * Start ("Controle de Combustível V2"), trazido para a plataforma a pedido do PM
 * (04/10/2026): mesmas abas, colunas, alertas e textos. Os números vêm prontos
 * do backend (combustivel.py); esta tela só formata e decide o que mostrar.
 */

type Aba = "painel" | "alertas" | "pendencias" | "postos" | "sem" | "veiculo";
const ABAS: [Aba, string][] = [
  ["painel", "Painel"],
  ["alertas", "Alertas"],
  ["pendencias", "Pendências"],
  ["postos", "Postos"],
  ["sem", "Sem abastecimento"],
];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const periodoPadrao = () => {
  const fim = new Date();
  const ini = new Date();
  ini.setDate(ini.getDate() - 29);
  return { inicio: iso(ini), fim: iso(fim) };
};
const ORIGEM: Record<string, string> = { MANUAL: "Manual", LEGADO: "Migrado", PLANILHA: "Planilha" };
const origem = (c?: string) => (c ? ORIGEM[c] || c : "—");

/* ---------------------------------------------------------------- peças */

const TAG: Record<string, string> = {
  error: "bg-coral/12 text-coral border-coral/30",
  warn: "bg-gold-tint text-gold border-gold-line",
  info: "bg-brand-sky/10 text-brand-navy border-brand-sky/30",
  ok: "bg-leaf/10 text-leaf border-leaf/30",
  neutro: "bg-secondary text-muted-foreground border-border",
};
function Tag({ v = "neutro", title, children }: { v?: keyof typeof TAG; title?: string; children: React.ReactNode }) {
  return (
    <span title={title} className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-medium", TAG[v])}>
      {children}
    </span>
  );
}

function Kpi({ rotulo, valor, sub, tom, onClick }: { rotulo: string; valor: string; sub?: string; tom?: "alerta" | "erro"; onClick?: () => void }) {
  const C = onClick ? "button" : "div";
  return (
    <C
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn("rounded-xl border border-border bg-card px-4 py-3 text-left", onClick && "transition-colors hover:border-brand-sky")}
    >
      <p className="text-[12px] text-muted-foreground">{rotulo}</p>
      <p className={cn("text-[20px] font-semibold leading-tight tabular-nums", tom === "erro" && "text-coral", tom === "alerta" && "text-gold")}>{valor}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted-foreground">{sub}</p>}
    </C>
  );
}

function Faceta({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[13px]",
        ativo ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-card text-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function Busca({ valor, onChange, placeholder = "Buscar placa…" }: { valor: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <input value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="h-9 w-56 rounded-lg border border-border bg-white pl-8 pr-3 text-[13px]" />
    </label>
  );
}

function useAtraso<T>(v: T, ms = 300) {
  const [x, setX] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setX(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return x;
}

function ContagemAlertas({ o }: { o: ContaAlertas }) {
  if (!o.error && !o.warn) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {o.error > 0 && <Tag v="error">{plural(o.error, "erro", "erros")}</Tag>}
      {o.warn > 0 && <Tag v="warn">{plural(o.warn, "aviso", "avisos")}</Tag>}
    </span>
  );
}

/** Régua do consumo dentro da faixa esperada do veículo. */
function Medidor({ kml, faixa, status }: { kml: number | null; faixa: { min: number; max: number } | null; status: StatusConsumo }) {
  if (kml == null) return <span className="text-muted-foreground">—</span>;
  const fora = status === "below" || status === "above";
  if (!faixa) return <span className="font-semibold tabular-nums">{fKmL(kml)}</span>;
  const lo = faixa.min * 0.7;
  const hi = faixa.max * 1.3;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`;
  return (
    <div className="min-w-[110px]">
      <span className={cn("font-semibold tabular-nums", fora && "text-coral")}>{fKmL(kml)}</span>
      <div className="relative mt-1 h-1.5 rounded-full bg-secondary">
        <div className="absolute inset-y-0 rounded-full bg-leaf/40" style={{ left: pos(faixa.min), right: `calc(100% - ${pos(faixa.max)})` }} />
        <div className={cn("absolute -top-0.5 h-2.5 w-1 rounded-full", fora ? "bg-coral" : "bg-brand-navy")} style={{ left: pos(kml) }} />
      </div>
      <span className="text-[12px] text-muted-foreground">faixa {fKmL(faixa.min)}–{fKmL(faixa.max)}</span>
    </div>
  );
}

function CelulaTelemetria({ t }: { t: Telemetria }) {
  switch (t.classification) {
    case "DIVERGENTE":
      return <Tag v="warn" title={t.divergenceKm != null ? `Rastreador marcava ${fKm(t.odometer)}; diferença de ${fKm(Math.abs(t.divergenceKm))}` : undefined}>difere {fN0(Math.abs(t.divergencePct ?? 0))}%</Tag>;
    case "SEM_TELEMETRIA":
      return <Tag v="info">sem dados</Tag>;
    case "SEM_KM_INFORMADO":
      return <Tag v="info">sem km</Tag>;
    case "PENDENTE":
      return <Tag v="info" title="A conferência com o rastreador ainda não foi feita para este registro.">pendente</Tag>;
    case "OK":
      return <Tag v="ok" title={t.odometer != null ? `Rastreador: ${fKm(t.odometer)}` : undefined}>confere</Tag>;
    default:
      return <span className="text-muted-foreground">—</span>;
  }
}

function TagsAlerta({ cat, alertas, verificado }: { cat: Catalogo; alertas: Alerta[]; verificado: boolean }) {
  if (!alertas.length) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {alertas.map((a) => (
        <Tag key={a.code} v={verificado ? "ok" : a.severity} title={cat.alertTypes.find((t) => t.code === a.code)?.description}>
          {a.label}
        </Tag>
      ))}
    </span>
  );
}

function Paginador({ pagina, total, limite, onPagina }: { pagina: number; total: number; limite: number; onPagina: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / limite));
  if (paginas <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2 text-[13px]">
      <span className="text-muted-foreground">
        {fN0(pagina * limite + 1)}–{fN0(Math.min(total, (pagina + 1) * limite))} de {fN0(total)}
      </span>
      <button className="rounded-md border border-border px-2 py-1 disabled:opacity-40" disabled={pagina === 0} onClick={() => onPagina(pagina - 1)}>Anterior</button>
      <button className="rounded-md border border-border px-2 py-1 disabled:opacity-40" disabled={pagina >= paginas - 1} onClick={() => onPagina(pagina + 1)}>Próxima</button>
    </div>
  );
}

const TH = "px-3 py-2 text-left text-[12px] font-medium uppercase tracking-wide text-muted-foreground";
const TD = "px-3 py-2 align-top";
const NUM = "text-right tabular-nums";

function Tabela({ children, cab }: { children: React.ReactNode; cab: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full border-collapse text-[13px]">
        <thead className="border-b border-border bg-secondary/60">
          <tr>{cab}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

function LinhaVazia({ col, children }: { col: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={col} className="px-4 py-8 text-center text-muted-foreground">{children}</td>
    </tr>
  );
}

function Rot({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-[12px] text-muted-foreground"><span>{t}</span>{children}</label>;
}

/** Pede um motivo antes de uma ação (excluir, verificar, descartar). */
function DialogoMotivo({ aberto, titulo, descricao, placeholder, confirmar, perigo, onFechar, onConfirmar }: {
  aberto: boolean; titulo: string; descricao: string; placeholder: string; confirmar: string; perigo?: boolean;
  onFechar: () => void; onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (aberto) setMotivo(""); }, [aberto]);
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{titulo}</DialogTitle></DialogHeader>
        <p className="text-[13px] text-muted-foreground">{descricao}</p>
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder={placeholder}
          className="w-full rounded-lg border border-border px-3 py-2 text-[13px]" />
        <DialogFooter>
          <button className="rounded-lg border border-border px-4 py-2 text-[13px]" onClick={onFechar}>Cancelar</button>
          <button
            disabled={motivo.trim().length < 3 || enviando}
            onClick={async () => {
              setEnviando(true);
              try { await onConfirmar(motivo.trim()); } catch (e) { toast.error(mensagemErro(e)); } finally { setEnviando(false); }
            }}
            className={cn("rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50", perigo ? "bg-coral" : "bg-brand-navy")}
          >
            {enviando ? "Enviando…" : confirmar}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- tela */

export default function ControleCombustivel({ abaInicial = "painel" }: { abaInicial?: Aba }) {
  const g = grupoAtivo();
  const qs = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [aba, setAba] = useState<Aba>((qs.get("tab") as Aba) || abaInicial);
  const [unitId, setUnitId] = useState<number | null>(qs.get("unitId") ? Number(qs.get("unitId")) : null);
  const [periodo, setPeriodo] = useState(periodoPadrao);
  const [importar, setImportar] = useState(false);
  const cat = useQuery({ queryKey: ["comb-cat", g], queryFn: () => CombustivelApi.catalogo(g!), enabled: !!g, staleTime: 300_000 });

  const abrirVeiculo = (id: number) => {
    setUnitId(id);
    setAba("veiculo");
    window.scrollTo({ top: 0 });
  };

  if (!g) {
    return (
      <>
        <PageHeader title="Controle de Combustível" subtitle="Frota › Abastecimentos" />
        <p className="px-8 py-6 text-[13px] text-muted-foreground">Escolha uma empresa no topo do menu.</p>
      </>
    );
  }

  return (
    <div className="tema-denso">
      <PageHeader title="Controle de Combustível" subtitle="Frota › Abastecimentos dos cartões, do posto interno e lançamentos" />
      <main className="mx-auto max-w-[1760px] space-y-4 px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1" aria-label="Seções">
            {ABAS.map(([id, rot]) => (
              <button key={id} type="button" onClick={() => setAba(id)} aria-current={aba === id ? "page" : undefined}
                className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium", aba === id || (aba === "veiculo" && id === "painel") ? "bg-brand-navy text-white" : "text-muted-foreground hover:bg-secondary")}>
                {rot}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 text-[13px]">
            <input type="date" value={periodo.inicio} max={periodo.fim} onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
              aria-label="Início do período" className="h-9 rounded-lg border border-border bg-white px-2" />
            <span className="text-muted-foreground">a</span>
            <input type="date" value={periodo.fim} min={periodo.inicio} max={iso(new Date())} onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))}
              aria-label="Fim do período" className="h-9 rounded-lg border border-border bg-white px-2" />
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setImportar(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[13px]">
              <Upload className="h-4 w-4" /> Importar planilha
            </button>
          </div>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Lançamentos, correções e verificações feitos aqui ficam salvos provisoriamente nesta plataforma (marcados como "provisório") e não
          chegam ao sistema do time até a gravação ser liberada.
        </p>

        {cat.isPending ? (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando módulo de combustível…</p>
        ) : cat.error ? (
          <p className="rounded-lg border border-coral/30 bg-coral/5 px-4 py-3 text-[13px] text-coral">{mensagemErro(cat.error)}</p>
        ) : (
          <>
            {aba === "painel" && <PainelAba g={g} cat={cat.data} periodo={periodo} onVeiculo={abrirVeiculo} onAba={setAba} />}
            {aba === "veiculo" && unitId && <VeiculoAba g={g} cat={cat.data} unitId={unitId} periodo={periodo} onVoltar={() => setAba("painel")} />}
            {aba === "alertas" && <AlertasAba g={g} cat={cat.data} periodo={periodo} onVeiculo={abrirVeiculo} />}
            {aba === "pendencias" && <PendenciasAba g={g} cat={cat.data} />}
            {aba === "postos" && <PostosAba g={g} cat={cat.data} periodo={periodo} />}
            {aba === "sem" && <SemAbastecimentoAba g={g} onVeiculo={abrirVeiculo} />}
            <ImportarPlanilha g={g} aberto={importar} onFechar={() => setImportar(false)} />
          </>
        )}
      </main>
    </div>
  );
}

/* ---------------------------------------------------------------- painel */

const COLS_PAINEL: [string, string | null, boolean][] = [
  ["Veículo", "plate", false], ["Combustível", null, false], ["Abast.", "supplies", true], ["Litros", "liters", true],
  ["Gasto", "spent", true], ["Km rodados", "kmDriven", true], ["Consumo (km/L)", "kmPerLiter", false],
  ["R$/km", "costPerKm", true], ["Último abastecimento", "lastSupply", false], ["Alertas", "alerts", false],
];

function exportarCsv(nome: string, cab: string[], linhas: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const txt = "﻿" + [cab, ...linhas].map((l) => l.map(esc).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
  a.download = nome;
  a.click();
}

function PainelAba({ g, cat, periodo, onVeiculo, onAba }: {
  g: string; cat: Catalogo; periodo: { inicio: string; fim: string }; onVeiculo: (id: number) => void; onAba: (a: Aba) => void;
}) {
  const [busca, setBusca] = useState("");
  const b = useAtraso(busca);
  const [filtro, setFiltro] = useState<"all" | "alerts" | "range">("all");
  const [ordem, setOrdem] = useState({ campo: "alerts", dir: "desc" as "asc" | "desc" });
  const [pagina, setPagina] = useState(0);
  const LIM = 50;
  useEffect(() => setPagina(0), [b, filtro, ordem, periodo]);
  const q = useQuery({
    queryKey: ["comb-painel", g, periodo, b, filtro, ordem, pagina],
    queryFn: () => CombustivelApi.painel(g, { ...periodo, busca: b, filtro, ordem: ordem.campo, direcao: ordem.dir, pagina, limite: LIM }),
  });
  const pend = useQuery({ queryKey: ["comb-pend-n", g], queryFn: () => CombustivelApi.pendencias(g, { situacao: "open" }) });
  const t = q.data?.totals;
  const tipo = (id: number | null) => cat.fuelTypes.find((f) => f.id === id)?.name ?? "—";
  const mudar = (campo: string) => setOrdem((o) => (o.campo === campo ? { campo, dir: o.dir === "asc" ? "desc" : "asc" } : { campo, dir: campo === "plate" ? "asc" : "desc" }));

  const exportar = async () => {
    const tudo = await CombustivelApi.painel(g, { ...periodo, busca: b, filtro, ordem: ordem.campo, direcao: ordem.dir, pagina: 0, limite: 200 });
    exportarCsv(`combustivel_painel_${periodo.inicio}_${periodo.fim}.csv`,
      ["Placa", "Frota", "Base", "Abastecimentos", "Litros", "ARLA (L)", "Gasto (R$)", "Km rodados", "Km/L", "R$/km", "Erros", "Avisos"],
      tudo.data.map((r) => [r.plate, r.fleetNumber, r.subgroupName, r.supplies, r.liters, r.litersArla, r.spent, r.kmDriven, r.kmPerLiter, r.costPerKm, r.openAlerts.error, r.openAlerts.warn]));
  };

  if (q.error) return <p className="text-[13px] text-coral">{mensagemErro(q.error)}</p>;
  return (
    <div className="space-y-4">
      {t && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi rotulo="Gasto no período" valor={fBRL(t.spent)} sub={`${fL(t.liters)} de combustível${t.litersArla ? ` e ${fL(t.litersArla)} de ARLA` : ""}`} />
          <Kpi rotulo="Custo por km" valor={t.costPerKm == null ? "—" : fBRL(t.costPerKm)} sub={`${fKm(t.kmDriven)} rodados em ${plural(t.vehicles, "veículo", "veículos")} · média ${fKmL(t.kmPerLiter)} km/L`} />
          <Kpi rotulo="Consumo fora da faixa" valor={plural(t.vehiclesOutOfRange, "veículo", "veículos")} tom={t.vehiclesOutOfRange ? "alerta" : undefined}
            sub="comparado com a faixa esperada de cada veículo" onClick={() => setFiltro("range")} />
          <Kpi rotulo="Alertas em aberto" valor={fN0(t.openAlerts.error + t.openAlerts.warn)}
            tom={t.openAlerts.error ? "erro" : t.openAlerts.warn ? "alerta" : undefined}
            sub={`${plural(t.openAlerts.error, "erro", "erros")} e ${plural(t.openAlerts.warn, "aviso", "avisos")}`} onClick={() => onAba("alertas")} />
          <Kpi rotulo="Pendências da integração" valor={pend.data ? fN0(pend.data.facets.byStatus.open ?? 0) : "—"} tom={pend.data?.facets.byStatus.open ? "alerta" : undefined}
            sub="transações dos cartões que não viraram abastecimento" onClick={() => onAba("pendencias")} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Busca valor={busca} onChange={setBusca} />
        {q.data && (
          <>
            <Faceta ativo={filtro === "all"} onClick={() => setFiltro("all")}>Todos <b>{fN0(q.data.facets.all)}</b></Faceta>
            <Faceta ativo={filtro === "alerts"} onClick={() => setFiltro("alerts")}>Com alerta <b>{fN0(q.data.facets.withAlerts)}</b></Faceta>
            <Faceta ativo={filtro === "range"} onClick={() => setFiltro("range")}>Consumo fora da faixa <b>{fN0(q.data.facets.outOfRange)}</b></Faceta>
          </>
        )}
        <button onClick={exportar} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[13px]">
          <Download className="h-4 w-4" /> Exportar
        </button>
      </div>
      <Tabela cab={COLS_PAINEL.map(([rot, campo, num]) => (
        <th key={rot} className={cn(TH, num && "text-right")}>
          {campo ? <button className="uppercase" onClick={() => mudar(campo)}>{rot} {ordem.campo === campo ? (ordem.dir === "asc" ? "▲" : "▼") : ""}</button> : rot}
        </th>
      ))}>
        {q.isPending ? (
          <LinhaVazia col={10}>Carregando…</LinhaVazia>
        ) : q.data!.data.length ? (
          q.data!.data.map((x: ResumoVeiculo) => (
            <tr key={x.unitId} onClick={() => onVeiculo(x.unitId)} className="cursor-pointer hover:bg-secondary/50">
              <td className={TD}><div className="font-mono font-semibold">{x.plate}</div><div className="text-[12px] text-muted-foreground">{[x.subgroupName, x.fleetNumber && `frota ${x.fleetNumber}`].filter(Boolean).join(", ")}</div></td>
              <td className={TD}>{tipo(x.fuelTypeId)}<div className="text-[12px] text-muted-foreground">{x.tankCapacityL ? `tanque ${fN0(x.tankCapacityL)} L` : "sem perfil de consumo"}</div></td>
              <td className={cn(TD, NUM)}>{fN0(x.supplies)}</td>
              <td className={cn(TD, NUM)}>{fL(x.liters)}</td>
              <td className={cn(TD, NUM)}>{fBRL(x.spent)}</td>
              <td className={cn(TD, NUM)}>{fKm(x.kmDriven)}</td>
              <td className={TD}><Medidor kml={x.kmPerLiter} faixa={x.expectedKmL} status={x.consumptionStatus} /></td>
              <td className={cn(TD, NUM)}>{x.costPerKm == null ? "—" : fBRL(x.costPerKm)}</td>
              <td className={TD}>{x.lastSupply ? <><div className="font-mono">{fDT(x.lastSupply.at)}</div><div className="text-[12px] text-muted-foreground">{fKm(x.lastSupply.km)}</div></> : "—"}</td>
              <td className={TD}><ContagemAlertas o={x.openAlerts} /></td>
            </tr>
          ))
        ) : (
          <LinhaVazia col={10}><b>Nenhum veículo com abastecimento neste período.</b> Amplie o período ou limpe os filtros.</LinhaVazia>
        )}
      </Tabela>
      {q.data && <Paginador pagina={pagina} total={q.data.total} limite={LIM} onPagina={setPagina} />}
    </div>
  );
}

/* ---------------------------------------------------------------- veículo */

const CONSUMO_TXT: Record<StatusConsumo, string> = {
  below: "abaixo da faixa do veículo",
  above: "acima da faixa: confira se há parciais marcados como tanque cheio",
  slightly_below: "um pouco abaixo da faixa, dentro da tolerância de 10%",
  slightly_above: "um pouco acima da faixa, dentro da tolerância de 10%",
  ok: "dentro da faixa do veículo",
  no_data: "sem faixa para comparar",
};

function VeiculoAba({ g, cat, unitId, periodo, onVoltar }: { g: string; cat: Catalogo; unitId: number; periodo: { inicio: string; fim: string }; onVoltar: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["comb-veic", g, unitId, periodo], queryFn: () => CombustivelApi.veiculo(g, unitId, periodo.inicio, periodo.fim) });
  const [filtro, setFiltro] = useState<"all" | "alerts">("all");
  const [pagina, setPagina] = useState(0);
  const [gaveta, setGaveta] = useState<null | "novo" | Abastecimento>(null);
  const [perfil, setPerfil] = useState(false);
  const [excluir, setExcluir] = useState<Abastecimento | null>(null);
  const recarregar = () => qc.invalidateQueries({ predicate: (k) => String(k.queryKey[0]).startsWith("comb-") });

  const lista = useMemo(() => {
    const todos = (q.data?.supplies ?? []).slice().reverse();
    const com = todos.filter((s) => s.alerts.some((a) => a.severity !== "info") && !s.review);
    return { todos, com, ver: filtro === "alerts" ? com : todos };
  }, [q.data, filtro]);
  const LIM = 25;

  if (q.isPending) return <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando veículo…</p>;
  if (q.error) return <p className="text-[13px] text-coral">{mensagemErro(q.error)}</p>;
  const { vehicle: v, totals: t } = q.data;
  const fora = t.consumptionStatus === "below" || t.consumptionStatus === "above";
  const consTxt = t.kmPerLiter == null ? "nenhum ciclo de tanque cheio a tanque cheio" : !v.profile ? "sem faixa esperada: cadastre o perfil de consumo para comparar" : CONSUMO_TXT[t.consumptionStatus];
  const abertos = t.openAlerts.error + t.openAlerts.warn;
  const pg = lista.ver.slice(pagina * LIM, pagina * LIM + LIM);

  return (
    <div className="space-y-4">
      <button onClick={onVoltar} className="inline-flex items-center gap-1 text-[13px] text-brand-navy hover:underline"><ArrowLeft className="h-4 w-4" /> Painel</button>
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <h2 className="font-mono text-[20px] font-semibold">{v.plate}</h2>
          <p className="text-[13px] text-muted-foreground">{[v.groupName, v.subgroupName, v.fleetNumber && `frota ${v.fleetNumber}`].filter(Boolean).join(", ")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <Tag>{cat.fuelTypes.find((f) => f.id === v.fuelTypeId)?.name ?? "Combustível não definido"}</Tag>
          {v.profile ? (
            <>
              <Tag>Tanque <b className="ml-1">{fN0(v.profile.tankCapacityL)} L</b></Tag>
              <Tag>Faixa esperada <b className="ml-1">{fKmL(v.profile.expectedMin)} a {fKmL(v.profile.expectedMax)} km/L</b></Tag>
              {v.profile.provisorio && <Tag v="info">perfil provisório</Tag>}
            </>
          ) : <Tag v="warn">Sem perfil de consumo</Tag>}
          <button onClick={() => setPerfil(true)} className="text-brand-navy underline">{v.profile ? "Editar perfil de consumo" : "Cadastrar tanque e faixa de consumo"}</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi rotulo="Consumo no período" valor={t.kmPerLiter == null ? "—" : `${fKmL(t.kmPerLiter)} km/L`} tom={fora ? "alerta" : undefined} sub={consTxt} />
        <Kpi rotulo="Gasto" valor={fBRL(t.spent)} sub={`${fL(t.liters)} em ${plural(t.supplies, "abastecimento", "abastecimentos")}`} />
        <Kpi rotulo="Custo por km" valor={t.costPerKm == null ? "—" : fBRL(t.costPerKm)} sub={`sobre ${fKm(t.kmDriven)} de ciclos completos`} />
        <Kpi rotulo="ARLA 32" valor={fL(t.litersArla)} sub="fora do cálculo de km/L" />
        <Kpi rotulo="Alertas em aberto" valor={fN0(abertos)} tom={t.openAlerts.error ? "erro" : abertos ? "alerta" : undefined}
          sub={`${plural(t.openAlerts.error, "erro", "erros")} e ${plural(t.openAlerts.warn, "aviso", "avisos")}`} onClick={() => setFiltro("alerts")} />
      </div>
      <GraficoConsumo supplies={q.data.supplies} faixa={v.profile ? { min: v.profile.expectedMin, max: v.profile.expectedMax } : null} media={t.kmPerLiter} />
      <div className="flex flex-wrap items-center gap-2">
        <Faceta ativo={filtro === "all"} onClick={() => { setFiltro("all"); setPagina(0); }}>Todos <b>{lista.todos.length}</b></Faceta>
        <Faceta ativo={filtro === "alerts"} onClick={() => { setFiltro("alerts"); setPagina(0); }}>Com alerta em aberto <b>{lista.com.length}</b></Faceta>
        <button onClick={() => setGaveta("novo")} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-[13px] font-semibold text-white">
          <Plus className="h-4 w-4" /> Novo abastecimento
        </button>
      </div>
      <Tabela cab={["Quando", "Origem", "Posto", "Combustível", "Litros", "Preço", "Total", "Km", "Km rodados", "Km/L", "Telemetria", "Alertas", ""].map((h, i) => (
        <th key={h + i} className={cn(TH, [4, 5, 6, 7, 8, 9].includes(i) && "text-right")}>{h}</th>
      ))}>
        {pg.length ? pg.map((s) => {
          const arla = s.fuelFamily === "arla";
          const cons = s.alerts.some((a) => a.code === "CONSUMO_FORA_DA_FAIXA" || a.code === "CONSUMO_IMPOSSIVEL");
          return (
            <tr key={s.id} onClick={() => setGaveta(s)} className="cursor-pointer hover:bg-secondary/50">
              <td className={TD}><div className="font-mono">{fDT(s.eventDatetime)}</div>{s.driver?.name && <div className="text-[12px] text-muted-foreground">{s.driver.name}</div>}</td>
              <td className={TD}><Tag title={s.supplier.name}>{origem(s.supplier.code)}</Tag>{s.provisorio && <div className="mt-1"><Tag v="info">provisório</Tag></div>}</td>
              <td className={TD}>{s.station?.name ?? s.localInformado ?? "—"}{!s.station && s.localInformado && <div className="text-[12px] text-muted-foreground">posto não cadastrado</div>}</td>
              <td className={TD}>{s.fuelTypeName ?? "—"}</td>
              <td className={cn(TD, NUM)}>{fL(s.liters)}{!arla && !s.fullTank && <div><Tag>parcial</Tag></div>}</td>
              <td className={cn(TD, NUM)}>{s.pricePerLiter == null ? "—" : fN2(s.pricePerLiter)}</td>
              <td className={cn(TD, NUM)}>{fBRL(s.totalValue)}</td>
              <td className={cn(TD, NUM)}>{arla ? "—" : fKm(s.kmInformed)}</td>
              <td className={cn(TD, NUM)}>{arla ? "—" : fKm(s.computed.kmDriven)}</td>
              <td className={cn(TD, NUM)}>
                {arla ? <span className="text-muted-foreground">ARLA</span> : s.computed.kmPerLiter != null ? <b className={cn(cons && "text-coral")}>{fKmL(s.computed.kmPerLiter)}</b>
                  : s.fullTank ? <span className="text-muted-foreground">—</span> : <span className="text-muted-foreground">no próximo</span>}
              </td>
              <td className={TD}>{arla ? "" : <CelulaTelemetria t={s.telemetry} />}</td>
              <td className={TD}><TagsAlerta cat={cat} alertas={s.alerts} verificado={!!s.review} />{s.review && <div className="text-[12px] text-muted-foreground">verificado por {s.review.user ?? "—"}</div>}</td>
              <td className={TD} onClick={(e) => e.stopPropagation()}>
                <button title="Excluir" aria-label="Excluir abastecimento" onClick={() => setExcluir(s)} className="rounded-md p-1 text-muted-foreground hover:bg-coral/10 hover:text-coral"><Trash2 className="h-4 w-4" /></button>
              </td>
            </tr>
          );
        }) : (
          <LinhaVazia col={13}><b>{filtro === "alerts" ? "Nenhum alerta em aberto neste período." : "Nenhum abastecimento neste período."}</b>{filtro !== "alerts" && " Registre um abastecimento ou amplie o período."}</LinhaVazia>
        )}
      </Tabela>
      <Paginador pagina={pagina} total={lista.ver.length} limite={LIM} onPagina={setPagina} />

      {gaveta && <GavetaAbastecimento g={g} cat={cat} unitId={unitId} placa={v.plate} alvo={gaveta === "novo" ? null : gaveta} onFechar={(mudou) => { setGaveta(null); if (mudou) recarregar(); }} />}
      <DialogoPerfil g={g} cat={cat} unitId={unitId} aberto={perfil} atual={v.profile} combustivel={v.fuelTypeId} onFechar={(mudou) => { setPerfil(false); if (mudou) recarregar(); }} />
      <DialogoMotivo aberto={!!excluir} titulo="Excluir abastecimento" perigo confirmar="Excluir abastecimento"
        descricao={excluir ? `${fL(excluir.liters)} em ${fDT(excluir.eventDatetime, true)}, ${excluir.station?.name ?? excluir.localInformado ?? ""}. O registro sai dos cálculos, mas continua no histórico com o motivo.` : ""}
        placeholder="Ex.: lançado em duplicidade com a transação da CTA" onFechar={() => setExcluir(null)}
        onConfirmar={async (m) => { await CombustivelApi.excluir(g, excluir!.id, m); setExcluir(null); toast.success("Abastecimento excluído"); recarregar(); }} />
    </div>
  );
}

function GraficoConsumo({ supplies, faixa, media }: { supplies: Abastecimento[]; faixa: { min: number; max: number } | null; media: number | null }) {
  const pontos = supplies.filter((s) => s.fuelFamily !== "arla" && s.computed.kmPerLiter != null)
    .map((s) => ({ quando: fDT(s.eventDatetime), kml: s.computed.kmPerLiter, fora: s.alerts.some((a) => a.code.startsWith("CONSUMO")) }));
  if (pontos.length < 2) {
    return <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-[13px] text-muted-foreground">O gráfico aparece com dois ou mais ciclos de tanque cheio no período.</p>;
  }
  const max = Math.max(...pontos.map((p) => p.kml ?? 0), faixa?.max ?? 0) * 1.15;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-[13px] font-semibold">Consumo por ciclo de tanque cheio (km/L)</p>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={pontos} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="quando" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} domain={[0, Math.ceil(max)]} />
          {faixa && <ReferenceArea y1={faixa.min} y2={faixa.max} fill="var(--leaf)" fillOpacity={0.12} />}
          {media != null && <ReferenceLine y={media} stroke="var(--brand-navy)" strokeDasharray="4 4" label={{ value: `média ${fKmL(media)}`, fontSize: 11, position: "insideTopRight" }} />}
          <Tooltip formatter={(v: number) => [`${fKmL(v)} km/L`, "Consumo"]} />
          <Line dataKey="kml" stroke="var(--brand-sky)" strokeWidth={2} dot={(p: { cx?: number; cy?: number; payload?: { fora: boolean }; index?: number }) => (
            <circle key={p.index} cx={p.cx} cy={p.cy} r={3.5} fill={p.payload?.fora ? "var(--coral)" : "var(--brand-sky)"} />
          )} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ----------------------------------------------------- lançar / corrigir */

function GavetaAbastecimento({ g, cat, unitId, placa, alvo, onFechar }: {
  g: string; cat: Catalogo; unitId: number; placa: string; alvo: Abastecimento | null; onFechar: (mudou: boolean) => void;
}) {
  const agora = new Date();
  const ini = alvo ?? null;
  const [f, setF] = useState({
    quando: ini?.eventDatetime?.slice(0, 16) ?? `${iso(agora)}T${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`,
    tipo: String(ini?.fuelTypeId ?? cat.fuelTypes[0]?.id ?? ""),
    litros: ini?.liters != null ? String(ini.liters).replace(".", ",") : "",
    preco: ini?.pricePerLiter != null ? String(ini.pricePerLiter).replace(".", ",") : "",
    km: ini?.kmInformed != null ? String(ini.kmInformed) : "",
    cheio: ini?.fullTank ?? true,
    posto: String(ini?.station?.id ?? ""),
    local: ini?.localInformado ?? "",
    nota: ini?.invoiceNumber ?? "",
    valorNota: ini?.totalValueInformed != null ? String(ini.totalValueInformed).replace(".", ",") : "",
    obs: ini?.notes ?? "",
  });
  const pode = (campo: string) => !ini || ini.editableFields.includes(campo);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [calc, setCalc] = useState<Record<string, number | null>>({});
  const [salvando, setSalvando] = useState(false);
  const sug = useQuery({ queryKey: ["comb-km", g, unitId, f.quando], queryFn: () => CombustivelApi.kmSugerido(g, unitId, f.quando.replace("T", " ")), enabled: !ini });

  const corpo = () => ({
    group_id: Number(g), unit_id: unitId, event_datetime: f.quando.replace("T", " "), fuel_type_id: Number(f.tipo),
    liters: lerNumero(f.litros) ?? 0, price_per_liter: lerNumero(f.preco) ?? 0, km_informado_atual: lerNumero(f.km),
    full_tank: f.cheio, fuel_station_id: f.posto ? Number(f.posto) : null, local_informado: f.local || null,
    total_value_informed: lerNumero(f.valorNota), invoice_number: f.nota || null, notes: f.obs || null,
  });
  const chave = JSON.stringify(f);
  useEffect(() => {
    const b = corpo();
    if (!b.liters || !b.fuel_type_id) return;
    const t = setTimeout(() => {
      CombustivelApi.validar(b, ini?.id).then((r) => { setIssues(r.issues); setCalc(r.computed); }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const salvar = async () => {
    setSalvando(true);
    try {
      if (ini) {
        const b = corpo();
        const campos: Record<string, unknown> = {};
        const mapa: Record<string, [unknown, unknown]> = {
          event_datetime: [b.event_datetime, ini.eventDatetime?.replace("T", " ")], fuel_type_id: [b.fuel_type_id, ini.fuelTypeId],
          liters: [b.liters, ini.liters], price_per_liter: [b.price_per_liter, ini.pricePerLiter], km_informado_atual: [b.km_informado_atual, ini.kmInformed],
          full_tank: [b.full_tank, ini.fullTank], fuel_station_id: [b.fuel_station_id, ini.station?.id ?? null], local_informado: [b.local_informado, ini.localInformado],
          total_value_informed: [b.total_value_informed, ini.totalValueInformed], invoice_number: [b.invoice_number, ini.invoiceNumber], notes: [b.notes, ini.notes],
        };
        for (const [k, [novo, velho]] of Object.entries(mapa)) if (pode(k) && String(novo ?? "") !== String(velho ?? "")) campos[k] = novo;
        if (!Object.keys(campos).length) { onFechar(false); return; }
        await CombustivelApi.corrigir(g, ini.id, campos);
        toast.success("Abastecimento corrigido");
      } else {
        await CombustivelApi.criar(corpo());
        toast.success("Abastecimento registrado");
      }
      onFechar(true);
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  const campo = "h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px] disabled:bg-secondary disabled:text-muted-foreground";
  const temErro = issues.some((i) => i.severity === "error" && !(ini && i.code === "DUPLICADO"));
  return (
    <Sheet open onOpenChange={(o) => !o && onFechar(false)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>{ini ? `Abastecimento de ${placa}` : `Novo abastecimento · ${placa}`}</SheetTitle>
        </SheetHeader>
        {ini && ini.editableFields.length < 6 && (
          <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-[12px] text-muted-foreground">
            Veio da integração ({ini.supplier.name}): só dá para corrigir km, tanque cheio, motorista e observação.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Rot t="Data e hora"><input type="datetime-local" className={campo} value={f.quando} disabled={!pode("event_datetime")} onChange={(e) => setF({ ...f, quando: e.target.value })} /></Rot>
          <Rot t="Combustível"><select className={campo} value={f.tipo} disabled={!pode("fuel_type_id")} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{cat.fuelTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Rot>
          <Rot t="Litros"><input inputMode="decimal" className={campo} value={f.litros} disabled={!pode("liters")} onChange={(e) => setF({ ...f, litros: e.target.value })} placeholder="0,00" /></Rot>
          <Rot t="Preço por litro (R$)"><input inputMode="decimal" className={campo} value={f.preco} disabled={!pode("price_per_liter")} onChange={(e) => setF({ ...f, preco: e.target.value })} placeholder="0,000" /></Rot>
          <Rot t="Km do hodômetro"><input inputMode="numeric" className={campo} value={f.km} disabled={!pode("km_informado_atual")} onChange={(e) => setF({ ...f, km: e.target.value })} /></Rot>
          <label className="flex items-end gap-2 pb-2 text-[13px]"><input type="checkbox" checked={f.cheio} disabled={!pode("full_tank")} onChange={(e) => setF({ ...f, cheio: e.target.checked })} /> Tanque cheio</label>
          {!ini && sug.data && (
            <p className="col-span-2 text-[12px] text-muted-foreground">
              {sug.data.lastSupply ? `Último abastecimento: ${fKm(sug.data.lastSupply.km)} em ${fDT(sug.data.lastSupply.at)}. ` : ""}
              {sug.data.trackerKm != null ? `Rastreador nesse horário: ${fKm(sug.data.trackerKm)}.` : "Rastreador sem leitura nesse horário."}
              {sug.data.trackerKm != null && !f.km && (
                <button className="ml-1 text-brand-navy underline" onClick={() => setF({ ...f, km: String(Math.round(sug.data!.trackerKm!)) })}>usar</button>
              )}
            </p>
          )}
          <Rot t="Posto cadastrado"><select className={campo} value={f.posto} disabled={!pode("fuel_station_id")} onChange={(e) => {
            const p = cat.stations.find((s) => String(s.id) === e.target.value);
            setF({ ...f, posto: e.target.value, preco: f.preco || (p?.pricePerLiter != null ? String(p.pricePerLiter).replace(".", ",") : "") });
          }}><option value="">—</option>{cat.stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Rot>
          <Rot t="Ou local do abastecimento"><input className={campo} value={f.local} disabled={!pode("local_informado")} onChange={(e) => setF({ ...f, local: e.target.value })} /></Rot>
          <Rot t="Nota fiscal"><input className={campo} value={f.nota} disabled={!pode("invoice_number")} onChange={(e) => setF({ ...f, nota: e.target.value })} /></Rot>
          <Rot t="Valor da nota (R$)"><input inputMode="decimal" className={campo} value={f.valorNota} disabled={!pode("total_value_informed")} onChange={(e) => setF({ ...f, valorNota: e.target.value })} /></Rot>
          <div className="col-span-2"><Rot t="Observação"><textarea rows={2} className={cn(campo, "h-auto py-2")} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></Rot></div>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[13px]">
          <p>Total: <b>{fBRL(calc.totalValue ?? null)}</b>{calc.kmDriven != null && <> · rodou <b>{fKm(calc.kmDriven)}</b> desde {fKm(calc.kmInitial ?? null)}</>}
            {calc.kmPerLiter != null && <> · <b>{fKmL(calc.kmPerLiter)} km/L</b></>}</p>
          <p className="text-[12px] text-muted-foreground">Prévia deste lançamento. O km/L definitivo sai do ciclo de tanque cheio a tanque cheio.</p>
        </div>
        {issues.length > 0 && (
          <ul className="mt-3 space-y-1">
            {issues.map((i, k) => (
              <li key={k} className={cn("rounded-md px-3 py-1.5 text-[12px]", i.severity === "error" ? "bg-coral/10 text-coral" : "bg-gold-tint text-gold")}>{i.message}</li>
            ))}
          </ul>
        )}
        {ini?.alerts.length ? (
          <div className="mt-3"><TagsAlerta cat={cat} alertas={ini.alerts} verificado={!!ini.review} />
            {ini.review && <p className="mt-1 text-[12px] text-muted-foreground">Verificado: {ini.review.reason}</p>}</div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-border px-4 py-2 text-[13px]" onClick={() => onFechar(false)}>Cancelar</button>
          <button disabled={salvando || temErro || !lerNumero(f.litros)} onClick={salvar} className="rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {salvando ? "Salvando…" : ini ? "Salvar correção" : "Registrar abastecimento"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DialogoPerfil({ g, cat, unitId, aberto, atual, combustivel, onFechar }: {
  g: string; cat: Catalogo; unitId: number; aberto: boolean; atual: { tankCapacityL: number; expectedMin: number; expectedMax: number; defaultFuelTypeId: number | null } | null;
  combustivel: number | null; onFechar: (mudou: boolean) => void;
}) {
  const [f, setF] = useState({ tanque: "", min: "", max: "", tipo: "" });
  useEffect(() => {
    if (aberto) setF({
      tanque: atual ? String(atual.tankCapacityL) : "", min: atual ? String(atual.expectedMin).replace(".", ",") : "",
      max: atual ? String(atual.expectedMax).replace(".", ",") : "", tipo: String(atual?.defaultFuelTypeId ?? combustivel ?? ""),
    });
  }, [aberto, atual, combustivel]);
  const campo = "h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]";
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar(false)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Perfil de consumo</DialogTitle></DialogHeader>
        <p className="text-[13px] text-muted-foreground">Com o tanque e a faixa de km/L esperada, o sistema aponta litros acima do tanque, km fora do possível e consumo fora da faixa.</p>
        <div className="grid grid-cols-2 gap-3 text-[12px] text-muted-foreground">
          <label className="space-y-1"><span>Combustível padrão</span><select className={campo} value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}><option value="">—</option>{cat.fuelTypes.filter((t) => t.family !== "arla").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="space-y-1"><span>Capacidade do tanque (L)</span><input className={campo} inputMode="numeric" value={f.tanque} onChange={(e) => setF({ ...f, tanque: e.target.value })} /></label>
          <label className="space-y-1"><span>km/L mínimo esperado</span><input className={campo} inputMode="decimal" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></label>
          <label className="space-y-1"><span>km/L máximo esperado</span><input className={campo} inputMode="decimal" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></label>
        </div>
        <DialogFooter>
          <button className="rounded-lg border border-border px-4 py-2 text-[13px]" onClick={() => onFechar(false)}>Cancelar</button>
          <button className="rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-semibold text-white" onClick={async () => {
            try {
              await CombustivelApi.salvarPerfil(g, unitId, {
                default_fuel_type_id: f.tipo ? Number(f.tipo) : null, tank_capacity_l: lerNumero(f.tanque) ?? 0,
                expected_kml_min: lerNumero(f.min) ?? 0, expected_kml_max: lerNumero(f.max) ?? 0,
              });
              toast.success("Perfil salvo");
              onFechar(true);
            } catch (e) { toast.error(mensagemErro(e)); }
          }}>Salvar perfil</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- alertas */

function AlertasAba({ g, cat, periodo, onVeiculo }: { g: string; cat: Catalogo; periodo: { inicio: string; fim: string }; onVeiculo: (id: number) => void }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const b = useAtraso(busca);
  const [grav, setGrav] = useState("");
  const [rev, setRev] = useState("open");
  const [tipos, setTipos] = useState<Set<string>>(new Set());
  const [pagina, setPagina] = useState(0);
  const [alvo, setAlvo] = useState<Abastecimento | null>(null);
  const LIM = 50;
  useEffect(() => setPagina(0), [b, grav, rev, tipos, periodo]);
  const q = useQuery({
    queryKey: ["comb-alertas", g, periodo, b, grav, rev, [...tipos].join(","), pagina],
    queryFn: () => CombustivelApi.alertas(g, { ...periodo, busca: b, gravidade: grav, revisado: rev, tipos: [...tipos].join(","), pagina, limite: LIM }),
  });
  const recarregar = () => qc.invalidateQueries({ predicate: (k) => String(k.queryKey[0]).startsWith("comb-") });
  const porTipo = q.data?.facets.byType ?? {};
  const visiveis = cat.alertTypes.filter((a) => porTipo[a.code] || tipos.has(a.code));
  if (q.error) return <p className="text-[13px] text-coral">{mensagemErro(q.error)}</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Busca valor={busca} onChange={setBusca} />
        {[["", "Todas"], ["error", "Erro"], ["warn", "Aviso"], ["info", "Info"]].map(([k, r]) => <Faceta key={k || "t"} ativo={grav === k} onClick={() => setGrav(k)}>{r}</Faceta>)}
        <span className="mx-1 h-5 w-px bg-border" />
        {[["open", "Em aberto"], ["only", "Verificados"], ["all", "Todos"]].map(([k, r]) => <Faceta key={k} ativo={rev === k} onClick={() => setRev(k)}>{r}</Faceta>)}
      </div>
      <div className="flex flex-wrap gap-2">
        {visiveis.length ? visiveis.map((a) => (
          <Faceta key={a.code} ativo={tipos.has(a.code)} onClick={() => setTipos((s) => { const n = new Set(s); n.has(a.code) ? n.delete(a.code) : n.add(a.code); return n; })}>
            <span title={a.description}>{a.label} <b>{fN0(porTipo[a.code] ?? 0)}</b></span>
          </Faceta>
        )) : <span className="text-[13px] text-muted-foreground">Nenhum alerta com esses filtros.</span>}
      </div>
      <Tabela cab={["Quando", "Veículo", "Posto", "Litros", "Km rodados", "Km/L", "Telemetria", "Alertas", "Situação", ""].map((h, i) => <th key={h + i} className={cn(TH, [3, 4, 5].includes(i) && "text-right")}>{h}</th>)}>
        {q.isPending ? <LinhaVazia col={10}>Carregando…</LinhaVazia> : q.data!.data.length ? q.data!.data.map((s) => (
          <tr key={s.id}>
            <td className={TD}><div className="font-mono">{fDT(s.eventDatetime)}</div><Tag title={s.supplier.name}>{origem(s.supplier.code)}</Tag></td>
            <td className={TD}><button className="font-mono font-semibold text-brand-navy hover:underline" onClick={() => onVeiculo(s.unitId)}>{s.vehicle.plate}</button><div className="text-[12px] text-muted-foreground">{s.vehicle.subgroupName}</div></td>
            <td className={TD}>{s.station?.name ?? s.localInformado ?? "—"}</td>
            <td className={cn(TD, NUM)}>{fL(s.liters)}</td>
            <td className={cn(TD, NUM)}>{fKm(s.computed.kmDriven)}</td>
            <td className={cn(TD, NUM)}>{fKmL(s.computed.kmPerLiter)}</td>
            <td className={TD}><CelulaTelemetria t={s.telemetry} /></td>
            <td className={TD}><TagsAlerta cat={cat} alertas={s.alerts} verificado={!!s.review} /></td>
            <td className={TD}>{s.review ? <><Tag v="ok" title={s.review.reason}>Verificado</Tag><div className="text-[12px] text-muted-foreground">{s.review.user}, {fDT(s.review.date)}</div></> : <Tag v="warn">Aberto</Tag>}</td>
            <td className={cn(TD, "whitespace-nowrap")}>
              <button className="mr-1 rounded-md border border-border px-2 py-1 text-[12px]" onClick={() => onVeiculo(s.unitId)}>Abrir</button>
              {s.review ? (
                <button className="text-[12px] text-brand-navy underline" onClick={async () => { await CombustivelApi.desfazerVerificacao(g, s.id); recarregar(); }}>Desfazer</button>
              ) : (
                <button className="rounded-md bg-gold px-2 py-1 text-[12px] font-semibold text-white" onClick={() => setAlvo(s)}>Verificar</button>
              )}
            </td>
          </tr>
        )) : <LinhaVazia col={10}><b>{rev === "only" ? "Nenhum alerta verificado neste período." : "Nenhum alerta em aberto."}</b>{rev !== "only" && " Tudo conferido para este período."}</LinhaVazia>}
      </Tabela>
      {q.data && <Paginador pagina={pagina} total={q.data.total} limite={LIM} onPagina={setPagina} />}
      <DialogoMotivo aberto={!!alvo} titulo="Marcar como verificado" confirmar="Marcar como verificado"
        descricao="O alerta deixa de contar como aberto. A explicação fica registrada no histórico do abastecimento."
        placeholder="Ex.: conferido com a nota fiscal; o motorista abasteceu o tanque reserva" onFechar={() => setAlvo(null)}
        onConfirmar={async (m) => { await CombustivelApi.verificar(g, alvo!.id, m, lerSessao()?.nome); setAlvo(null); toast.success("Alerta verificado"); recarregar(); }} />
    </div>
  );
}

/* ---------------------------------------------------------------- pendências */

function PendenciasAba({ g, cat }: { g: string; cat: Catalogo }) {
  const qc = useQueryClient();
  const [situacao, setSituacao] = useState("open");
  const [codigo, setCodigo] = useState("");
  const [busca, setBusca] = useState("");
  const b = useAtraso(busca);
  const [pagina, setPagina] = useState(0);
  const [descartar, setDescartar] = useState<Pendencia | null>(null);
  const [resolver, setResolver] = useState<Pendencia | null>(null);
  const LIM = 50;
  useEffect(() => setPagina(0), [situacao, codigo, b]);
  const q = useQuery({ queryKey: ["comb-pend", g, situacao, codigo, b], queryFn: () => CombustivelApi.pendencias(g, { situacao, codigo, busca: b }) });
  const recarregar = () => qc.invalidateQueries({ predicate: (k) => String(k.queryKey[0]).startsWith("comb-") });
  const rotulo = (c: string | null) => cat.pendingErrorCodes.find((x) => x.code === c)?.label ?? c ?? "Pendente";
  if (q.error) return <p className="text-[13px] text-coral">{mensagemErro(q.error)}</p>;
  const lista = q.data?.data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {[["open", "A resolver"], ["RESOLVED", "Resolvidas"], ["DISCARDED", "Descartadas"]].map(([k, r]) => (
          <Faceta key={k} ativo={situacao === k} onClick={() => { setSituacao(k); setCodigo(""); }}>{r} <b>{fN0(q.data?.facets.byStatus[k] ?? 0)}</b></Faceta>
        ))}
        <span className="ml-auto"><Busca valor={busca} onChange={setBusca} /></span>
      </div>
      {situacao === "open" && q.data && Object.keys(q.data.facets.byErrorCode).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(q.data.facets.byErrorCode).map(([c, n]) => <Faceta key={c} ativo={codigo === c} onClick={() => setCodigo(codigo === c ? "" : c)}>{rotulo(c)} <b>{fN0(n)}</b></Faceta>)}
        </div>
      )}
      <Tabela cab={["Recebida", "Origem", "Placa", "Abastecimento", "Produto", "Litros", "Posto", "Situação", ""].map((h, i) => <th key={h + i} className={cn(TH, i === 5 && "text-right")}>{h}</th>)}>
        {q.isPending ? <LinhaVazia col={9}>Carregando…</LinhaVazia> : lista.length ? lista.slice(pagina * LIM, pagina * LIM + LIM).map((p) => (
          <tr key={p.id}>
            <td className={cn(TD, "font-mono")}>{fDT(p.dateAdd)}</td>
            <td className={TD}><Tag>{p.supplier.code}</Tag></td>
            <td className={cn(TD, "font-mono font-semibold")}>{p.summary.plate ?? "—"}</td>
            <td className={cn(TD, "font-mono")}>{fDT(p.summary.eventDatetime)}</td>
            <td className={TD}>{p.summary.product ?? "—"}</td>
            <td className={cn(TD, NUM)}>{fL(p.summary.liters)}</td>
            <td className={TD}>{p.summary.station ?? "—"}</td>
            <td className={TD}>
              <Tag v={p.status === "RESOLVED" ? "ok" : p.status === "DISCARDED" ? "neutro" : "warn"}>{p.status === "RESOLVED" ? "Resolvida" : p.status === "DISCARDED" ? "Descartada" : rotulo(p.errorCode)}</Tag>
              <div className="text-[12px] text-muted-foreground">{p.resolution?.note ?? p.errorMessage}</div>
              {p.provisorio && <Tag v="info">provisório</Tag>}
            </td>
            <td className={cn(TD, "whitespace-nowrap")}>
              {["PENDING", "ERROR"].includes(p.status) && (
                <>
                  <button className="mr-1 rounded-md bg-brand-navy px-2 py-1 text-[12px] font-semibold text-white" onClick={() => setResolver(p)}>Resolver</button>
                  <button className="rounded-md border border-border px-2 py-1 text-[12px]" onClick={() => setDescartar(p)}>Descartar</button>
                </>
              )}
            </td>
          </tr>
        )) : <LinhaVazia col={9}><b>{situacao === "open" ? "Nenhuma pendência em aberto." : "Nada por aqui."}</b>{situacao === "open" && " Todas as transações dos cartões viraram abastecimentos."}</LinhaVazia>}
      </Tabela>
      <Paginador pagina={pagina} total={lista.length} limite={LIM} onPagina={setPagina} />
      <DialogoMotivo aberto={!!descartar} titulo="Descartar pendência" perigo confirmar="Descartar pendência"
        descricao='A transação não vira abastecimento. Ela continua visível em "Descartadas", com o motivo.' placeholder="Ex.: transação de teste do cartão"
        onFechar={() => setDescartar(null)} onConfirmar={async (m) => { await CombustivelApi.descartar(g, descartar!.id, m); setDescartar(null); recarregar(); }} />
      {resolver && <DialogoResolver g={g} cat={cat} item={resolver} onFechar={(m) => { setResolver(null); if (m) recarregar(); }} />}
    </div>
  );
}

function DialogoResolver({ g, cat, item, onFechar }: { g: string; cat: Catalogo; item: Pendencia; onFechar: (mudou: boolean) => void }) {
  const d = useQuery({ queryKey: ["comb-pend-det", g, item.id], queryFn: () => CombustivelApi.pendencia(g, item.id) });
  const veic = useQuery({ queryKey: ["comb-sem-todos", g], queryFn: () => CombustivelApi.painel(g, { inicio: iso(new Date(Date.now() - 364 * 864e5)), fim: iso(new Date()), limite: 200 }) });
  const [sel, setSel] = useState("");
  const [outra, setOutra] = useState("");
  const [tipo, setTipo] = useState("");
  const [litros, setLitros] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    const x: DetalhePendencia | undefined = d.data;
    if (!x) return;
    setSel(x.suggestions.length ? String(x.suggestions[0].unitId) : "outro");
    if (x.suggestedFuelTypeId) setTipo(String(x.suggestedFuelTypeId));
  }, [d.data]);
  const x = d.data;
  const outrasPlacas = veic.data?.data ?? [];
  const unidade = sel === "outro" ? outrasPlacas.find((v) => v.plate.replace("-", "").toUpperCase() === outra.replace("-", "").toUpperCase())?.unitId : Number(sel);
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar(false)}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Resolver pendência</DialogTitle></DialogHeader>
        {!x ? <p className="text-[13px] text-muted-foreground">Carregando…</p> : (
          <div className="space-y-3 text-[13px]">
            <p>
              {x.supplier.name}, transação {x.externalRef ?? "—"}. {x.errorMessage}<br />
              <b>{x.summary.plate ?? "Placa não informada"}</b>, {fDT(x.summary.eventDatetime, true)}, {x.summary.product ?? "produto não informado"},{" "}
              {x.summary.liters != null ? fL(x.summary.liters) : "sem litros"}{x.summary.pricePerLiter != null ? ` a ${fBRL(x.summary.pricePerLiter)}/L` : ""}. Km informado: {fKm(x.summary.km)}.
              {x.summary.driver && <> Motorista: {x.summary.driver}.</>}
            </p>
            <fieldset className="space-y-1.5">
              <legend className="mb-1 text-[12px] text-muted-foreground">A qual veículo pertence?</legend>
              {x.suggestions.map((s) => (
                <label key={s.unitId} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2">
                  <input type="radio" name="rsUnit" checked={sel === String(s.unitId)} onChange={() => setSel(String(s.unitId))} className="mt-1" />
                  <span><b className="font-mono">{s.plate}</b> <span className="text-muted-foreground">{s.subgroupName}</span><br /><small className="text-muted-foreground">{s.reason}</small></span>
                </label>
              ))}
              <label className="flex items-start gap-2 rounded-lg border border-border px-3 py-2">
                <input type="radio" name="rsUnit" checked={sel === "outro"} onChange={() => setSel("outro")} className="mt-1" />
                <span className="w-full"><b>Outro veículo</b>
                  {sel === "outro" && (
                    <>
                      <input list="placas-comb" value={outra} onChange={(e) => setOutra(e.target.value)} placeholder="Digite a placa" className="mt-1 h-9 w-full rounded-lg border border-border px-3" />
                      <datalist id="placas-comb">{outrasPlacas.map((v) => <option key={v.unitId} value={v.plate}>{v.subgroupName}</option>)}</datalist>
                      {outra && !unidade && <small className="text-coral">Placa não encontrada entre os veículos deste cliente.</small>}
                    </>
                  )}
                </span>
              </label>
            </fieldset>
            <div className="grid grid-cols-2 gap-3 text-[12px] text-muted-foreground">
              <label className="space-y-1"><span>Combustível{x.needs.fuelType ? ` ("${x.summary.product}" não foi reconhecido)` : ""}</span>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px] text-foreground"><option value="">Escolha</option>{cat.fuelTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              {x.needs.liters && <label className="space-y-1"><span>Litros (a transação veio sem quantidade)</span><input value={litros} onChange={(e) => setLitros(e.target.value)} inputMode="decimal" className="h-9 w-full rounded-lg border border-border px-3 text-[13px] text-foreground" /></label>}
              <label className="col-span-2 space-y-1"><span>Observação (opcional)</span><input value={nota} onChange={(e) => setNota(e.target.value)} className="h-9 w-full rounded-lg border border-border px-3 text-[13px] text-foreground" /></label>
            </div>
          </div>
        )}
        <DialogFooter>
          <button className="rounded-lg border border-border px-4 py-2 text-[13px]" onClick={() => onFechar(false)}>Cancelar</button>
          <button disabled={!x || !unidade || !tipo || enviando} className="rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            onClick={async () => {
              setEnviando(true);
              try {
                await CombustivelApi.resolver(g, item.id, { unit_id: unidade!, fuel_type_id: Number(tipo), liters: lerNumero(litros), note: nota || undefined });
                toast.success("Pendência resolvida: virou abastecimento");
                onFechar(true);
              } catch (e) { toast.error(mensagemErro(e)); } finally { setEnviando(false); }
            }}>{enviando ? "Enviando…" : "Criar abastecimento"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- postos */

function PostosAba({ g, cat, periodo }: { g: string; cat: Catalogo; periodo: { inicio: string; fim: string } }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [gaveta, setGaveta] = useState<null | "novo" | Posto | { local: string }>(null);
  const [inativar, setInativar] = useState<Posto | null>(null);
  const q = useQuery({ queryKey: ["comb-postos", g, periodo], queryFn: () => CombustivelApi.postos(g, periodo.inicio, periodo.fim) });
  const recarregar = () => qc.invalidateQueries({ predicate: (k) => String(k.queryKey[0]).startsWith("comb-") });
  const filtra = <T extends { name?: string; local?: string }>(l: T[]) => l.filter((x) => !busca || (x.name ?? x.local ?? "").toLowerCase().includes(busca.toLowerCase()));
  if (q.error) return <p className="text-[13px] text-coral">{mensagemErro(q.error)}</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Busca valor={busca} onChange={setBusca} placeholder="Buscar posto…" />
        <button onClick={() => setGaveta("novo")} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-[13px] font-semibold text-white"><Plus className="h-4 w-4" /> Novo posto</button>
      </div>
      <Tabela cab={["Nome", "CNPJ", "Bomba", "Localização", "Combustível", "Preço/L", "Abast. no período", "Litros", "Gasto", ""].map((h, i) => <th key={h + i} className={cn(TH, [5, 6, 7, 8].includes(i) && "text-right")}>{h}</th>)}>
        {q.isPending ? <LinhaVazia col={10}>Carregando…</LinhaVazia> : filtra(q.data!.stations).length ? filtra(q.data!.stations).map((s) => (
          <tr key={s.id}>
            <td className={TD}><div className="font-medium">{s.name}</div><div className="text-[12px] text-muted-foreground">{[s.company, s.branch].filter(Boolean).join(", ")}</div>{s.provisorio && <Tag v="info">provisório</Tag>}</td>
            <td className={TD}>{s.cnpj ?? "—"}</td>
            <td className={TD}>{s.pumpCode ?? "—"}</td>
            <td className={TD}>{s.latitude != null ? <><a className="text-brand-navy underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}>{s.latitude.toFixed(4)}, {s.longitude?.toFixed(4)}</a><div className="text-[12px] text-muted-foreground">raio de {fN0(s.radiusM)} m</div></> : <span className="text-muted-foreground">sem localização</span>}</td>
            <td className={TD}>{cat.fuelTypes.find((f) => f.id === s.fuelTypeId)?.name ?? <span className="text-muted-foreground">vários</span>}</td>
            <td className={cn(TD, NUM)}>{s.pricePerLiter != null ? fBRL(s.pricePerLiter) : "—"}</td>
            <td className={cn(TD, NUM)}>{fN0(s.supplies)}</td>
            <td className={cn(TD, NUM)}>{fL(s.liters)}</td>
            <td className={cn(TD, NUM)}>{fBRL(s.spent)}</td>
            <td className={cn(TD, "whitespace-nowrap")}>
              <button title="Editar" aria-label={`Editar ${s.name}`} onClick={() => setGaveta(s)} className="rounded-md p-1 text-muted-foreground hover:bg-secondary"><Pencil className="h-4 w-4" /></button>
              <button title="Inativar" aria-label={`Inativar ${s.name}`} onClick={() => setInativar(s)} className="rounded-md p-1 text-muted-foreground hover:bg-coral/10 hover:text-coral"><Trash2 className="h-4 w-4" /></button>
            </td>
          </tr>
        )) : <LinhaVazia col={10}><b>Nenhum posto cadastrado{busca ? " com essa busca" : ""}.</b> Cadastre os postos usados pela frota para ligar os abastecimentos a eles.</LinhaVazia>}
      </Tabela>

      {q.data && q.data.unregistered.length > 0 && (
        <>
          <h3 className="pt-2 text-[14px] font-semibold">Locais informados pelos cartões, ainda sem cadastro</h3>
          <Tabela cab={["Local", "Abast. no período", "Veículos", "Litros", "Preço médio/L", "Gasto", "Último", ""].map((h, i) => <th key={h + i} className={cn(TH, [1, 2, 3, 4, 5].includes(i) && "text-right")}>{h}</th>)}>
            {filtra(q.data.unregistered).map((l) => (
              <tr key={l.local}>
                <td className={TD}>{l.local}</td>
                <td className={cn(TD, NUM)}>{fN0(l.supplies)}</td>
                <td className={cn(TD, NUM)}>{fN0(l.vehicles)}</td>
                <td className={cn(TD, NUM)}>{fL(l.liters)}</td>
                <td className={cn(TD, NUM)}>{l.avgPrice != null ? fBRL(l.avgPrice) : "—"}</td>
                <td className={cn(TD, NUM)}>{fBRL(l.spent)}</td>
                <td className={cn(TD, "font-mono")}>{fDT(l.lastSupply)}</td>
                <td className={TD}><button className="text-[12px] text-brand-navy underline" onClick={() => setGaveta({ local: l.local })}>Cadastrar como posto</button></td>
              </tr>
            ))}
          </Tabela>
        </>
      )}

      {gaveta && <GavetaPosto g={g} cat={cat} alvo={gaveta === "novo" ? null : gaveta} onFechar={(m) => { setGaveta(null); if (m) recarregar(); }} />}
      <Dialog open={!!inativar} onOpenChange={(o) => !o && setInativar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Inativar posto</DialogTitle></DialogHeader>
          <p className="text-[13px]"><b>{inativar?.name}</b> deixa de aparecer na lista de postos do formulário. Os abastecimentos já registrados continuam ligados a ele.</p>
          <DialogFooter>
            <button className="rounded-lg border border-border px-4 py-2 text-[13px]" onClick={() => setInativar(null)}>Cancelar</button>
            <button className="rounded-lg bg-coral px-4 py-2 text-[13px] font-semibold text-white" onClick={async () => { await CombustivelApi.removerPosto(g, inativar!.id); setInativar(null); recarregar(); }}>Inativar posto</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GavetaPosto({ g, cat, alvo, onFechar }: { g: string; cat: Catalogo; alvo: Posto | { local: string } | null; onFechar: (mudou: boolean) => void }) {
  const p = alvo && "id" in alvo ? alvo : null;
  const [f, setF] = useState({
    name: p?.name ?? (alvo && "local" in alvo ? alvo.local : ""), company: p?.company ?? "", branch: p?.branch ?? "", cnpj: p?.cnpj ?? "",
    pump_cod: p?.pumpCode ?? "", fuel_type_id: String(p?.fuelTypeId ?? ""), price: p?.pricePerLiter != null ? String(p.pricePerLiter).replace(".", ",") : "",
    lat: p?.latitude != null ? String(p.latitude) : "", lng: p?.longitude != null ? String(p.longitude) : "", raio: String(p?.radiusM ?? 250),
  });
  const campo = "h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px] text-foreground";
  const L = ({ t, c, full }: { t: string; c: keyof typeof f; full?: boolean }) => (
    <label className={cn("space-y-1 text-[12px] text-muted-foreground", full && "col-span-2")}><span>{t}</span><input className={campo} value={f[c]} onChange={(e) => setF({ ...f, [c]: e.target.value })} /></label>
  );
  return (
    <Sheet open onOpenChange={(o) => !o && onFechar(false)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[480px]">
        <SheetHeader><SheetTitle>{p ? `Editar ${p.name}` : "Novo posto"}</SheetTitle></SheetHeader>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {L({ t: "Nome", c: "name", full: true })}
          {L({ t: "Empresa", c: "company" })}
          {L({ t: "Filial", c: "branch" })}
          {L({ t: "CNPJ", c: "cnpj" })}
          {L({ t: "Código da bomba", c: "pump_cod" })}
          <label className="space-y-1 text-[12px] text-muted-foreground"><span>Combustível</span><select className={campo} value={f.fuel_type_id} onChange={(e) => setF({ ...f, fuel_type_id: e.target.value })}><option value="">Vários</option>{cat.fuelTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          {L({ t: "Preço por litro (R$)", c: "price" })}
          {L({ t: "Latitude", c: "lat" })}
          {L({ t: "Longitude", c: "lng" })}
          {L({ t: "Raio do posto (m)", c: "raio" })}
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">Com a localização, dá para conferir se o veículo estava no posto na hora do abastecimento.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border border-border px-4 py-2 text-[13px]" onClick={() => onFechar(false)}>Cancelar</button>
          <button className="rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-semibold text-white" onClick={async () => {
            try {
              await CombustivelApi.salvarPosto(g, {
                name: f.name, company: f.company || null, branch: f.branch || null, cnpj: f.cnpj || null, pump_cod: f.pump_cod || null,
                fuel_type_id: f.fuel_type_id ? Number(f.fuel_type_id) : null, price_per_liter: lerNumero(f.price),
                latitude: lerNumero(f.lat), longitude: lerNumero(f.lng), radius_m: Number(f.raio) || 250,
              }, p?.id);
              toast.success("Posto salvo");
              onFechar(true);
            } catch (e) { toast.error(mensagemErro(e)); }
          }}>Salvar posto</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------------------------------------------------- sem abastecimento */

function SemAbastecimentoAba({ g, onVeiculo }: { g: string; onVeiculo: (id: number) => void }) {
  const [busca, setBusca] = useState("");
  const b = useAtraso(busca);
  const [pagina, setPagina] = useState(0);
  const q = useQuery({ queryKey: ["comb-sem", g, b], queryFn: () => CombustivelApi.semAbastecimento(g, b) });
  const LIM = 50;
  useEffect(() => setPagina(0), [b]);
  if (q.error) return <p className="text-[13px] text-coral">{mensagemErro(q.error)}</p>;
  const l = q.data?.data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Busca valor={busca} onChange={setBusca} />
        <p className="text-[13px] text-muted-foreground">Veículos ativos que nunca tiveram abastecimento registrado. Abra um para lançar o primeiro.</p>
      </div>
      <Tabela cab={["Veículo", "Frota", "Base", "Cadastrado em", ""].map((h) => <th key={h} className={TH}>{h}</th>)}>
        {q.isPending ? <LinhaVazia col={5}>Carregando…</LinhaVazia> : l.length ? l.slice(pagina * LIM, pagina * LIM + LIM).map((v) => (
          <tr key={v.unitId} className="cursor-pointer hover:bg-secondary/50" onClick={() => onVeiculo(v.unitId)}>
            <td className={cn(TD, "font-mono font-semibold")}>{v.plate}</td>
            <td className={TD}>{v.fleetNumber ?? "—"}</td>
            <td className={TD}>{v.subgroupName ?? "—"}</td>
            <td className={cn(TD, "font-mono")}>{v.dateAdd ? new Date(`${v.dateAdd}T12:00`).toLocaleDateString("pt-BR") : "—"}</td>
            <td className={TD}><span className="text-[12px] text-brand-navy underline">Lançar abastecimento</span></td>
          </tr>
        )) : <LinhaVazia col={5}><b>Todos os veículos ativos já têm abastecimento registrado.</b></LinhaVazia>}
      </Tabela>
      <Paginador pagina={pagina} total={l.length} limite={LIM} onPagina={setPagina} />
    </div>
  );
}

/* ---------------------------------------------------------------- planilha */

const COLUNAS_PLANILHA = ["placa", "data", "combustivel", "litros", "preco_litro", "km", "posto", "tanque_cheio", "nota_fiscal", "valor_nota", "motorista"];

function lerCsv(txt: string): LinhaPlanilha[] {
  const linhas = txt.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const sep = linhas[0].split(";").length >= linhas[0].split(",").length ? ";" : ",";
  const cab = linhas[0].split(sep).map((c) => c.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_"));
  const idx = (n: string) => cab.indexOf(n);
  return linhas.slice(1).map((l) => {
    const c = l.split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
    const v = (n: string) => (idx(n) >= 0 ? c[idx(n)] : "");
    return {
      placa: v("placa"), data: v("data"), combustivel: v("combustivel"), litros: lerNumero(v("litros")) ?? 0, preco_litro: lerNumero(v("preco_litro")) ?? 0,
      km: lerNumero(v("km")), posto: v("posto") || null, tanque_cheio: !/^(n|nao|não|0|false)$/i.test(v("tanque_cheio") || "s"),
      nota_fiscal: v("nota_fiscal") || null, valor_nota: lerNumero(v("valor_nota")), motorista: v("motorista") || null,
    };
  });
}

function ImportarPlanilha({ g, aberto, onFechar }: { g: string; aberto: boolean; onFechar: () => void }) {
  const qc = useQueryClient();
  const [linhas, setLinhas] = useState<LinhaPlanilha[]>([]);
  const [res, setRes] = useState<Awaited<ReturnType<typeof CombustivelApi.planilha>> | null>(null);
  const [enviando, setEnviando] = useState(false);
  useEffect(() => { if (!aberto) { setLinhas([]); setRes(null); } }, [aberto]);
  const conferir = async (ls: LinhaPlanilha[], confirmar: boolean) => {
    setEnviando(true);
    try {
      const r = await CombustivelApi.planilha(g, ls, confirmar);
      setRes(r);
      if (confirmar) {
        toast.success(`${plural(r.gravadas, "abastecimento importado", "abastecimentos importados")}`);
        qc.invalidateQueries({ predicate: (k) => String(k.queryKey[0]).startsWith("comb-") });
        onFechar();
      }
    } catch (e) { toast.error(mensagemErro(e)); } finally { setEnviando(false); }
  };
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Importar planilha de abastecimentos</DialogTitle></DialogHeader>
        <p className="text-[13px] text-muted-foreground">
          Arquivo CSV (separado por ; ou ,) com as colunas: <span className="font-mono">{COLUNAS_PLANILHA.join(", ")}</span>. Data como 03/10/2026 14:30.
          Cada linha passa pelas mesmas regras do lançamento manual antes de gravar.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px]">
            <Upload className="h-4 w-4" /> Escolher arquivo
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => {
              const arq = e.target.files?.[0];
              if (!arq) return;
              const ls = lerCsv(await arq.text());
              setLinhas(ls);
              if (ls.length) conferir(ls, false);
            }} />
          </label>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px]" onClick={() =>
            exportarCsv("modelo_abastecimentos.csv", COLUNAS_PLANILHA, [["ABC-1D23", "03/10/2026 14:30", "Diesel S10", "350,5", "6,19", "125430", "Posto Exemplo", "sim", "12345", "2169,60", "João"]])}>
            <Download className="h-4 w-4" /> Baixar modelo
          </button>
        </div>
        {res && (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
            <p className="sticky top-0 bg-secondary px-3 py-2 text-[13px]"><b>{fN0(res.validas)}</b> linhas prontas · <b className="text-coral">{fN0(res.comErro)}</b> com erro (não entram)</p>
            <ul className="divide-y divide-border text-[12px]">
              {res.linhas.filter((l) => l.issues.length).slice(0, 200).map((l) => (
                <li key={l.linha} className="px-3 py-1.5"><b>Linha {l.linha}</b> ({l.placa}): {l.issues.map((i) => i.message).join(" · ")}</li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <button className="rounded-lg border border-border px-4 py-2 text-[13px]" onClick={onFechar}>Cancelar</button>
          <button disabled={!res || !res.validas || enviando} onClick={() => conferir(linhas, true)} className="rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {enviando ? "Enviando…" : res ? `Importar ${fN0(res.validas)} linhas` : "Importar"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

