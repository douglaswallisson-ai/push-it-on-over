import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { Circle, MapContainer, Marker, Polygon, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { ehSuperAdmin } from "@/lib/permissoes";
import { lerSessao } from "@/lib/session";
import { mensagemErro } from "@/lib/suporte-api";
import { CadastrosApi, type Opcao, type Opcoes, type Registro, type TipoCadastro } from "@/lib/cadastros-api";
import { cn } from "@/lib/utils";

/**
 * Tela única dos cadastros: lista com busca, painel lateral de criação e
 * edição, exclusão com confirmação (e motivo quando o sistema atual pede).
 * Cada cadastro declara colunas e campos em `config.tsx`; as regras ficam no
 * backend (cadastros.py), as mesmas do sistema atual.
 */

export type TipoCampo =
  | "texto" | "numero" | "select" | "multi" | "toggle" | "cor" | "area" | "email" | "hora" | "data"
  | "mapa" | "regras" | "geometria" | "pontos" | "imagem";

export type Campo = {
  nome: string;
  rotulo: string;
  tipo: TipoCampo;
  /** Chave das listas de apoio (`/cadastros/opcoes/todas`) ou lista fixa. */
  opcoes?: keyof Opcoes | { id: string | number; nome: string }[];
  /** Filtra as opções pelos valores já preenchidos (ex.: modelo pelo fabricante). */
  filtro?: (o: Opcao, v: Record<string, unknown>) => boolean;
  obrig?: boolean;
  ajuda?: string;
  cheio?: boolean;
  max?: number;
  visivel?: (v: Record<string, unknown>) => boolean;
  somenteSS?: boolean;
  placeholder?: string;
};
export type Secao = { titulo?: string; campos: Campo[] };
export type Coluna = { chave: string; rotulo: string; render?: (r: Registro, op?: Opcoes) => React.ReactNode; num?: boolean };
export type ConfigCadastro = {
  tipo: TipoCadastro;
  titulo: string;
  subtitulo: string;
  singular: string;
  explicacao?: string;
  colunas: Coluna[];
  secoes: Secao[];
  podeCriar?: boolean | "ss";
  podeExcluir?: boolean;
  motivoExclusao?: "texto" | "motivos_remocao";
  padrao?: Record<string, unknown>;
  rotulo: (r: Registro) => string;
};

const campoCss = "h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px] text-foreground disabled:bg-secondary";

function listaOpcoes(c: Campo, op: Opcoes | undefined, v: Record<string, unknown>): { id: string | number; nome: string }[] {
  if (!c.opcoes) return [];
  const base = Array.isArray(c.opcoes) ? c.opcoes : ((op?.[c.opcoes] as unknown as Opcao[]) ?? []).map((o) => (typeof o === "string" ? { id: o, nome: o } : o));
  return c.filtro ? (base as Opcao[]).filter((o) => c.filtro!(o, v)) : base;
}

export function nomeDe(op: Opcoes | undefined, chave: keyof Opcoes, id: unknown) {
  const l = (op?.[chave] as unknown as Opcao[]) ?? [];
  return l.find((o) => String(o.id) === String(id))?.nome ?? null;
}

export default function CadastroTela({ cfg }: { cfg: ConfigCadastro }) {
  const g = grupoAtivo();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [alvo, setAlvo] = useState<Registro | "novo" | null>(null);
  const [excluir, setExcluir] = useState<Registro | null>(null);
  const [pagina, setPagina] = useState(0);
  const ss = ehSuperAdmin(lerSessao()?.perfil);
  const q = useQuery({ queryKey: ["cad", cfg.tipo, g], queryFn: () => CadastrosApi.listar(cfg.tipo, g!), enabled: !!g });
  const op = useQuery({ queryKey: ["cad-opcoes", g], queryFn: () => CadastrosApi.opcoes(g!), enabled: !!g, staleTime: 600_000 });
  const LIM = 50;
  useEffect(() => setPagina(0), [busca]);

  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const l = q.data?.data ?? [];
    return b ? l.filter((r) => JSON.stringify(r).toLowerCase().includes(b)) : l;
  }, [q.data, busca]);
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["cad", cfg.tipo] });
    qc.invalidateQueries({ queryKey: ["cad-opcoes"] });
  };
  const podeCriar = cfg.podeCriar === "ss" ? ss : cfg.podeCriar !== false;

  if (!g) {
    return (
      <>
        <PageHeader title={cfg.titulo} subtitle={cfg.subtitulo} />
        <p className="px-8 py-6 text-[13px] text-muted-foreground">Escolha uma empresa no topo do menu.</p>
      </>
    );
  }
  const pg = lista.slice(pagina * LIM, pagina * LIM + LIM);
  return (
    <div className="tema-denso">
      <PageHeader title={cfg.titulo} subtitle={cfg.subtitulo} />
      <main className="mx-auto max-w-[1760px] space-y-3 px-4 py-4 md:px-6">
        {cfg.explicacao && <p className="text-[13px] text-muted-foreground">{cfg.explicacao}</p>}
        <p className="text-[12px] text-muted-foreground">
          O que você cria, edita ou exclui aqui fica salvo provisoriamente nesta plataforma (marcado como "provisório") e ainda não chega ao
          sistema atual nem aos equipamentos.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar ${cfg.singular.toLowerCase()}…`}
              aria-label="Buscar" className="h-9 w-64 rounded-lg border border-border bg-white pl-8 pr-3 text-[13px]" />
          </label>
          {q.data && (
            <span className="text-[13px] text-muted-foreground">
              {lista.length.toLocaleString("pt-BR")} de {q.data.total.toLocaleString("pt-BR")}
              {q.data.provisorios > 0 && ` · ${q.data.provisorios} provisório(s)`}
            </span>
          )}
          {podeCriar && (
            <button onClick={() => setAlvo("novo")} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-[13px] font-semibold text-white">
              <Plus className="h-4 w-4" /> Novo {cfg.singular.toLowerCase()}
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full border-collapse text-[13px]">
            <thead className="border-b border-border bg-secondary/60">
              <tr>
                {cfg.colunas.map((c) => <th key={c.chave} className={cn("px-3 py-2 text-left text-[12px] font-medium uppercase tracking-wide text-muted-foreground", c.num && "text-right")}>{c.rotulo}</th>)}
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {q.isPending ? (
                <tr><td colSpan={cfg.colunas.length + 1} className="px-4 py-8 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Carregando…</td></tr>
              ) : q.error ? (
                <tr><td colSpan={cfg.colunas.length + 1} className="px-4 py-8 text-center text-coral">{mensagemErro(q.error)}</td></tr>
              ) : pg.length ? pg.map((r) => (
                <tr key={r.id} onClick={() => setAlvo(r)} className="cursor-pointer hover:bg-secondary/50">
                  {cfg.colunas.map((c, i) => (
                    <td key={c.chave} className={cn("px-3 py-2 align-top", c.num && "text-right tabular-nums")}>
                      {c.render ? c.render(r, op.data) : String(r[c.chave] ?? "—") || "—"}
                      {i === 0 && r.provisorio && <span className="ml-2 rounded-full border border-brand-sky/30 bg-brand-sky/10 px-2 py-0.5 text-[12px] text-brand-navy">provisório</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    {cfg.podeExcluir !== false && (
                      <button title="Excluir" aria-label={`Excluir ${cfg.rotulo(r)}`} onClick={() => setExcluir(r)} className="rounded-md p-1 text-muted-foreground hover:bg-coral/10 hover:text-coral"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={cfg.colunas.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                  {busca ? "Nada encontrado com essa busca." : `Nenhum(a) ${cfg.singular.toLowerCase()} cadastrado(a) ainda.`}
                </td></tr>
              )}
            </tbody>
          </table>
          {lista.length > LIM && (
            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2 text-[13px]">
              <span className="text-muted-foreground">{pagina * LIM + 1}–{Math.min(lista.length, (pagina + 1) * LIM)} de {lista.length}</span>
              <button className="rounded-md border border-border px-2 py-1 disabled:opacity-40" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button>
              <button className="rounded-md border border-border px-2 py-1 disabled:opacity-40" disabled={(pagina + 1) * LIM >= lista.length} onClick={() => setPagina(pagina + 1)}>Próxima</button>
            </div>
          )}
        </div>
      </main>

      {alvo && <Formulario cfg={cfg} g={g} op={op.data} alvo={alvo === "novo" ? null : alvo} ss={ss} onFechar={(m) => { setAlvo(null); if (m) recarregar(); }} />}
      {excluir && <Exclusao cfg={cfg} g={g} op={op.data} alvo={excluir} onFechar={(m) => { setExcluir(null); if (m) recarregar(); }} />}
    </div>
  );
}

function Exclusao({ cfg, g, op, alvo, onFechar }: { cfg: ConfigCadastro; g: string; op?: Opcoes; alvo: Registro; onFechar: (m: boolean) => void }) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onFechar(false)}>
      <DialogContent>
        <DialogHeader><DialogTitle>Excluir {cfg.singular.toLowerCase()}</DialogTitle></DialogHeader>
        <p className="text-[13px]">Deseja remover <b>{cfg.rotulo(alvo)}</b>?</p>
        {cfg.motivoExclusao === "motivos_remocao" ? (
          <select className={campoCss} value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo">
            <option value="">Motivo da exclusão</option>
            {(op?.motivos_remocao ?? []).map((m) => <option key={m.id} value={m.nome}>{m.nome}</option>)}
          </select>
        ) : cfg.motivoExclusao === "texto" ? (
          <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo" className="w-full rounded-lg border border-border px-3 py-2 text-[13px]" />
        ) : null}
        <DialogFooter>
          <button className="rounded-lg border border-border px-4 py-2 text-[13px]" onClick={() => onFechar(false)}>Cancelar</button>
          <button disabled={enviando || (!!cfg.motivoExclusao && !motivo)} className="rounded-lg bg-coral px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            onClick={async () => {
              setEnviando(true);
              try { await CadastrosApi.excluir(cfg.tipo, g, alvo.id, motivo || undefined); toast.success(`${cfg.singular} excluído(a)`); onFechar(true); }
              catch (e) { toast.error(mensagemErro(e)); } finally { setEnviando(false); }
            }}>Excluir</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Formulario({ cfg, g, op, alvo, ss, onFechar }: { cfg: ConfigCadastro; g: string; op?: Opcoes; alvo: Registro | null; ss: boolean; onFechar: (m: boolean) => void }) {
  const [v, setV] = useState<Record<string, unknown>>(() => (alvo ? { ...alvo } : { ...(cfg.padrao ?? {}) }));
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, x: unknown) => setV((o) => ({ ...o, [k]: x }));

  const salvar = async () => {
    for (const s of cfg.secoes) for (const c of s.campos) {
      if (c.obrig && (c.visivel?.(v) ?? true) && (v[c.nome] === undefined || v[c.nome] === "" || v[c.nome] === null)) {
        setErroCampo(c.nome);
        toast.error(`${c.rotulo} é obrigatório.`);
        return;
      }
    }
    setSalvando(true);
    setErroCampo(null);
    try {
      const r = alvo ? await CadastrosApi.editar(cfg.tipo, g, alvo.id, v) : await CadastrosApi.criar(cfg.tipo, g, v);
      r.avisos?.forEach((a) => toast.warning(a));
      toast.success(alvo ? "Alterações salvas (provisório)" : `${cfg.singular} cadastrado(a) (provisório)`);
      onFechar(true);
    } catch (e) {
      const m = mensagemErro(e);
      try { const f = JSON.parse((e as Error).message)?.detail?.field; if (f) setErroCampo(f); } catch { /* sem campo */ }
      toast.error(m);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onFechar(false)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[620px]">
        <SheetHeader><SheetTitle>{alvo ? cfg.rotulo(alvo) : `Novo ${cfg.singular.toLowerCase()}`}</SheetTitle></SheetHeader>
        {alvo?.provisorio && <p className="mt-2 rounded-lg bg-brand-sky/10 px-3 py-2 text-[12px] text-brand-navy">Editado nesta plataforma em {String(alvo.editado_em ?? "").replace("T", " ")} (provisório).</p>}
        <div className="mt-4 space-y-5">
          {cfg.secoes.map((s, i) => (
            <fieldset key={i} className="space-y-3">
              {s.titulo && <legend className="mb-1 text-[13px] font-semibold">{s.titulo}</legend>}
              <div className="grid grid-cols-2 gap-3">
                {s.campos.filter((c) => (c.visivel?.(v) ?? true) && (!c.somenteSS || ss)).map((c) => (
                  <div key={c.nome} className={cn(["area", "mapa", "regras", "geometria", "pontos", "multi", "imagem"].includes(c.tipo) || c.cheio ? "col-span-2" : "")}>
                    <CampoEditor c={c} v={v} set={set} op={op} erro={erroCampo === c.nome} g={g} />
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="rounded-lg border border-border px-4 py-2 text-[13px]" onClick={() => onFechar(false)}>Cancelar</button>
          <button disabled={salvando} onClick={salvar} className="rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50">
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Rotulo({ c, erro, children }: { c: Campo; erro: boolean; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-[12px] text-muted-foreground">
      <span className={cn(erro && "font-semibold text-coral")}>{c.rotulo}{c.obrig && " *"}</span>
      {children}
      {c.ajuda && <span className="block text-[12px] text-muted-foreground">{c.ajuda}</span>}
    </label>
  );
}

function CampoEditor({ c, v, set, op, erro, g }: { c: Campo; v: Record<string, unknown>; set: (k: string, x: unknown) => void; op?: Opcoes; erro: boolean; g: string }) {
  const val = v[c.nome];
  const css = cn(campoCss, erro && "border-coral");
  switch (c.tipo) {
    case "toggle":
      return (
        <label className="flex items-center gap-2 pt-5 text-[13px]">
          <input type="checkbox" checked={Boolean(val)} onChange={(e) => set(c.nome, e.target.checked)} /> {c.rotulo}
        </label>
      );
    case "select":
      return (
        <Rotulo c={c} erro={erro}>
          <select className={css} value={val == null ? "" : String(val)} onChange={(e) => set(c.nome, e.target.value === "" ? null : (/^\d+$/.test(e.target.value) ? Number(e.target.value) : e.target.value))}>
            <option value="">—</option>
            {listaOpcoes(c, op, v).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
          </select>
        </Rotulo>
      );
    case "multi": {
      const sel = new Set(((val as unknown[]) ?? []).map(String));
      const ops = listaOpcoes(c, op, v);
      return (
        <Rotulo c={c} erro={erro}>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-white p-2">
            {ops.length ? ops.map((o) => (
              <label key={o.id} className="flex items-center gap-2 py-0.5 text-[13px] text-foreground">
                <input type="checkbox" checked={sel.has(String(o.id))} onChange={(e) => {
                  const n = new Set(sel);
                  e.target.checked ? n.add(String(o.id)) : n.delete(String(o.id));
                  set(c.nome, [...n].map((x) => (/^\d+$/.test(x) ? Number(x) : x)));
                }} /> {o.nome}
              </label>
            )) : <span className="text-[12px]">Sem opções.</span>}
          </div>
        </Rotulo>
      );
    }
    case "cor":
      return (
        <Rotulo c={c} erro={erro}>
          <div className="flex items-center gap-2"><input type="color" value={String(val || "#808080").slice(0, 7).padEnd(7, "0")} onChange={(e) => set(c.nome, e.target.value)} className="h-9 w-12 rounded border border-border" /><span className="font-mono text-[12px]">{String(val || "")}</span></div>
        </Rotulo>
      );
    case "area":
      return <Rotulo c={c} erro={erro}><textarea rows={3} maxLength={c.max} className={cn(css, "h-auto py-2")} value={String(val ?? "")} onChange={(e) => set(c.nome, e.target.value)} placeholder={c.placeholder} /></Rotulo>;
    case "numero":
      return <Rotulo c={c} erro={erro}><input inputMode="decimal" className={css} value={val == null ? "" : String(val)} onChange={(e) => set(c.nome, e.target.value === "" ? null : e.target.value.replace(",", "."))} placeholder={c.placeholder} /></Rotulo>;
    case "hora":
      return <Rotulo c={c} erro={erro}><input type="time" className={css} value={String(val ?? "").slice(0, 5)} onChange={(e) => set(c.nome, e.target.value || null)} /></Rotulo>;
    case "data":
      return <Rotulo c={c} erro={erro}><input type="date" className={css} value={String(val ?? "").slice(0, 10)} onChange={(e) => set(c.nome, e.target.value || null)} /></Rotulo>;
    case "imagem":
      return (
        <Rotulo c={c} erro={erro}>
          <div className="flex items-center gap-3">
            {val ? <img src={String(val)} alt="Logo" className="h-12 max-w-[160px] rounded border border-border bg-white object-contain p-1" /> : <span className="text-[12px]">Sem imagem.</span>}
            <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-[12px] text-foreground">
              Enviar imagem
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 500_000) { toast.error("A imagem deve ter no máximo 500 KB."); return; }
                const r = new FileReader();
                r.onload = () => set(c.nome, String(r.result));
                r.readAsDataURL(f);
              }} />
            </label>
            {Boolean(val) && <button type="button" className="text-[12px] text-coral underline" onClick={() => set(c.nome, null)}>Remover</button>}
          </div>
        </Rotulo>
      );
    case "mapa":
      return <EditorMapa v={v} set={set} />;
    case "geometria":
      return <EditorGeometria v={v} set={set} />;
    case "regras":
      return <EditorRegras v={v} set={set} op={op} />;
    case "pontos":
      return <EditorPontosLinha v={v} set={set} g={g} />;
    default:
      return <Rotulo c={c} erro={erro}><input type={c.tipo === "email" ? "email" : "text"} maxLength={c.max} className={css} value={String(val ?? "")} onChange={(e) => set(c.nome, e.target.value)} placeholder={c.placeholder} /></Rotulo>;
  }
}

/* ---------------------------------------------------------- editores de mapa */

const pinoSimples = L.divIcon({ className: "", html: '<div style="width:14px;height:14px;border-radius:99px;background:#16325c;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });

function Clique({ onClique }: { onClique: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const f = (e: L.LeafletMouseEvent) => onClique(e.latlng.lat, e.latlng.lng);
    map.on("click", f);
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => { map.off("click", f); clearTimeout(t); };
  }, [map, onClique]);
  return null;
}

function Centrar({ centro }: { centro: [number, number] | null }) {
  const map = useMap();
  const k = centro?.join(",");
  useEffect(() => { if (centro) map.setView(centro, Math.max(map.getZoom(), 14)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [k]);
  return null;
}

function EditorMapa({ v, set }: { v: Record<string, unknown>; set: (k: string, x: unknown) => void }) {
  const lat = v.latitude != null ? Number(v.latitude) : null;
  const lng = v.longitude != null ? Number(v.longitude) : null;
  const raio = Number(v.raio_m ?? 50) || 50;
  const centro: [number, number] | null = lat != null && lng != null && !(lat === 0 && lng === 0) ? [lat, lng] : null;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-[12px] text-muted-foreground">
        <label className="space-y-1"><span>Latitude *</span><input className={campoCss} value={lat ?? ""} onChange={(e) => set("latitude", e.target.value === "" ? null : Number(e.target.value.replace(",", ".")))} /></label>
        <label className="space-y-1"><span>Longitude *</span><input className={campoCss} value={lng ?? ""} onChange={(e) => set("longitude", e.target.value === "" ? null : Number(e.target.value.replace(",", ".")))} /></label>
        <label className="space-y-1"><span>Raio (m)</span><input className={campoCss} inputMode="numeric" value={String(v.raio_m ?? "")} onChange={(e) => set("raio_m", e.target.value === "" ? null : Number(e.target.value))} placeholder="50" /></label>
      </div>
      <div className="h-56 overflow-hidden rounded-lg border border-border">
        <MapContainer center={centro ?? [-19.92, -43.94]} zoom={centro ? 15 : 6} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <Clique onClique={(a, b) => { set("latitude", Number(a.toFixed(6))); set("longitude", Number(b.toFixed(6))); }} />
          <Centrar centro={centro} />
          {centro && <><Marker position={centro} icon={pinoSimples} /><Circle center={centro} radius={raio} pathOptions={{ color: "#1d4ed8", weight: 1.5 }} /></>}
        </MapContainer>
      </div>
      <p className="text-[12px] text-muted-foreground">Clique no mapa para marcar o ponto.</p>
    </div>
  );
}

const TIPOS_CERCA = [{ id: 1, nome: "Circular" }, { id: 2, nome: "Quadrada" }, { id: 3, nome: "Poligonal" }, { id: 4, nome: "Vetor (trajeto)" }];

function EditorGeometria({ v, set }: { v: Record<string, unknown>; set: (k: string, x: unknown) => void }) {
  const tipo = Number(v.tipo ?? 3);
  const pts = ((v.pontos as [number, number][]) ?? []).filter((p) => Array.isArray(p) && p.length === 2);
  const lat = Number(v.latitude ?? 0);
  const lng = Number(v.longitude ?? 0);
  const centro: [number, number] | null = tipo === 1 ? (lat || lng ? [lat, lng] : null) : pts.length ? pts[0] : null;
  const limite = tipo === 4 ? 32 : 31;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2 text-[12px] text-muted-foreground">
        <label className="space-y-1"><span>Área *</span>
          <select className={campoCss} value={tipo} onChange={(e) => { set("tipo", Number(e.target.value)); set("pontos", []); }}>
            {TIPOS_CERCA.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select></label>
        {tipo === 1 && <label className="space-y-1"><span>Raio da cerca (m) *</span><input className={campoCss} inputMode="numeric" value={String(v.raio_m ?? "")} onChange={(e) => set("raio_m", Number(e.target.value) || null)} /></label>}
        {tipo === 4 && <label className="space-y-1"><span>Espessura do vetor *</span>
          <select className={campoCss} value={String(v.espessura ?? 25)} onChange={(e) => set("espessura", Number(e.target.value))}>{[15, 25, 50].map((x) => <option key={x} value={x}>{x} m</option>)}</select></label>}
        {tipo !== 1 && (
          <div className="flex items-end gap-1">
            <button type="button" className="rounded-md border border-border px-2 py-1.5 text-[12px]" disabled={!pts.length} onClick={() => set("pontos", pts.slice(0, -1))}>Desfazer ponto</button>
            <button type="button" className="rounded-md border border-border px-2 py-1.5 text-[12px]" disabled={!pts.length} onClick={() => set("pontos", [])}>Limpar</button>
          </div>
        )}
      </div>
      <div className="h-64 overflow-hidden rounded-lg border border-border">
        <MapContainer center={centro ?? [-19.92, -43.94]} zoom={centro ? 14 : 6} className="h-full w-full">
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <Clique onClique={(a, b) => {
            const p: [number, number] = [Number(a.toFixed(6)), Number(b.toFixed(6))];
            if (tipo === 1) { set("latitude", p[0]); set("longitude", p[1]); return; }
            if (tipo === 2) {
              // Quadrada: dois cliques (cantos opostos) viram o retângulo.
              const base = pts.length >= 4 ? [] : pts;
              if (base.length === 1) {
                const [x, y] = base[0];
                set("pontos", [[x, y], [x, p[1]], p, [p[0], y]]);
              } else set("pontos", [p]);
              return;
            }
            set("pontos", [...pts, p]);
          }} />
          <Centrar centro={centro} />
          {tipo === 1 && centro && <Circle center={centro} radius={Number(v.raio_m) || 100} pathOptions={{ color: String(v.cor || "#808080") }} />}
          {tipo === 4 && pts.length > 1 && <Polyline positions={pts} pathOptions={{ color: String(v.cor || "#808080"), weight: 5 }} />}
          {(tipo === 2 || tipo === 3) && pts.length > 2 && <Polygon positions={pts} pathOptions={{ color: String(v.cor || "#808080") }} />}
          {pts.map((p, i) => <Marker key={i} position={p} icon={pinoSimples} />)}
        </MapContainer>
      </div>
      <p className="text-[12px] text-muted-foreground">
        {tipo === 1 ? "Clique no mapa para marcar o centro." : tipo === 2 ? "Clique em dois cantos opostos." : `Clique para incluir os pontos. Número de pontos ${pts.length} de ${limite}.`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------- regras do alarme */

type Regra = { parametro_id?: number; operador?: string; valor?: string; km_sem_ocorrencia?: string; kml_maximo?: string; janela_min?: string; sustentacao_s?: string; tolerancia_km?: string };

function EditorRegras({ v, set, op }: { v: Record<string, unknown>; set: (k: string, x: unknown) => void; op?: Opcoes }) {
  const regras = ((v.regras as Regra[]) ?? []).map((r) => ({ ...r }));
  const params = op?.parametros_alarme ?? [];
  const mudar = (i: number, patch: Partial<Regra>) => set("regras", regras.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold text-muted-foreground">Disparar alarme quando *</p>
      {regras.map((r, i) => {
        const p = params.find((x) => x.id === Number(r.parametro_id));
        const ops = (p?.operadores ?? "=").replace(/[[\]]/g, "").split(",").map((x) => x.trim()).filter(Boolean);
        const pid = Number(r.parametro_id);
        const lista = pid === 15 || pid === 26 || pid === 25 ? op?.eventos : pid === 20 ? op?.motoristas : null;
        return (
          <div key={i} className="space-y-2 rounded-lg border border-border p-2">
            <div className="grid grid-cols-[1fr_90px_1fr_32px] gap-2">
              <select className={campoCss} value={r.parametro_id ?? ""} onChange={(e) => {
                const np = params.find((x) => x.id === Number(e.target.value));
                const primeiro = (np?.operadores ?? "=").replace(/[[\]]/g, "").split(",")[0]?.trim() || "=";
                mudar(i, { parametro_id: Number(e.target.value), operador: primeiro, valor: "" });
              }} aria-label="Parâmetro">
                <option value="">Parâmetro</option>{params.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
              <select className={campoCss} value={r.operador ?? ops[0] ?? "="} onChange={(e) => mudar(i, { operador: e.target.value })} aria-label="Operador">
                {ops.map((o) => <option key={o} value={o}>{o === "in" ? "dentro" : o === "out" ? "fora" : o}</option>)}
              </select>
              {lista ? (
                <select className={campoCss} value={r.valor ?? ""} onChange={(e) => mudar(i, { valor: e.target.value })} aria-label="Valor">
                  <option value="">Escolha</option>{lista.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </select>
              ) : <input className={campoCss} value={r.valor ?? ""} onChange={(e) => mudar(i, { valor: e.target.value })} placeholder="Valor" aria-label="Valor" />}
              <button type="button" aria-label="Remover regra" onClick={() => set("regras", regras.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-coral"><X className="h-4 w-4" /></button>
            </div>
            {pid === 26 && <input className={campoCss} value={r.km_sem_ocorrencia ?? ""} onChange={(e) => mudar(i, { km_sem_ocorrencia: e.target.value })} placeholder="Distância sem ocorrência (km), ex.: 300 — quantos km o veículo pode rodar sem gerar o evento" />}
            {pid === 28 && <input className={campoCss} value={r.kml_maximo ?? ""} onChange={(e) => mudar(i, { kml_maximo: e.target.value })} placeholder="Valor máximo de km/L, ex.: 5,0 (o valor acima é o mínimo)" />}
            {pid === 30 && (
              <div className="grid grid-cols-3 gap-2">
                <input className={campoCss} value={r.janela_min ?? ""} onChange={(e) => mudar(i, { janela_min: e.target.value })} placeholder="Janela (min), ex.: 10" />
                <input className={campoCss} value={r.sustentacao_s ?? ""} onChange={(e) => mudar(i, { sustentacao_s: e.target.value })} placeholder="Sustentação (s), ex.: 60" />
                <input className={campoCss} value={r.tolerancia_km ?? ""} onChange={(e) => mudar(i, { tolerancia_km: e.target.value })} placeholder="Tolerância (km), ex.: 0,5" />
              </div>
            )}
          </div>
        );
      })}
      <button type="button" onClick={() => set("regras", [...regras, {}])} className="inline-flex items-center gap-1 text-[13px] text-brand-navy underline"><Plus className="h-3.5 w-3.5" /> Adicionar regra</button>
    </div>
  );
}

/* ------------------------------------------------------- pontos da linha */

function EditorPontosLinha({ v, set, g }: { v: Record<string, unknown>; set: (k: string, x: unknown) => void; g: string }) {
  const poi = useQuery({ queryKey: ["cad", "poi", g], queryFn: () => CadastrosApi.listar("poi", g) });
  const par = useQuery({ queryKey: ["cad", "ponto_parada", g], queryFn: () => CadastrosApi.listar("ponto_parada", g) });
  const todos = [...(par.data?.data ?? []), ...(poi.data?.data ?? [])];
  const nome = (id: unknown) => String(todos.find((x) => String(x.origem_id ?? x.id) === String(id))?.nome ?? `ponto ${id}`);
  const ids = ((v.pontos as unknown[]) ?? []).filter((x) => x != null);
  const [novo, setNovo] = useState("");
  return (
    <div className="space-y-1.5">
      <p className="text-[12px] font-semibold text-muted-foreground">Itinerário (pontos em ordem)</p>
      <ol className="space-y-1">
        {ids.map((id, i) => (
          <li key={`${id}-${i}`} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-[13px]">
            <b className="w-5 text-muted-foreground">{i + 1}</b><span className="flex-1">{nome(id)}</span>
            <button type="button" aria-label="Remover ponto" onClick={() => set("pontos", ids.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-coral"><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <select className={campoCss} value={novo} onChange={(e) => setNovo(e.target.value)} aria-label="Ponto">
          <option value="">Escolha um ponto de parada ou de interesse</option>
          {todos.map((x) => <option key={x.id} value={String(x.origem_id ?? x.id)}>{String(x.nome)}</option>)}
        </select>
        <button type="button" disabled={!novo} onClick={() => { set("pontos", [...ids, /^\d+$/.test(novo) ? Number(novo) : novo]); setNovo(""); }} className="rounded-lg border border-border px-3 text-[13px] disabled:opacity-40">Incluir</button>
      </div>
    </div>
  );
}
