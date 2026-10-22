import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Bus,
  Download,
  FileSpreadsheet,
  Footprints,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Rota automática de fretamento (PM, 22/10/2026). A empresa contratante manda a lista de
 * funcionários (nome, endereço, empresa); para cada empresa o operador diz o endereço dela, quanto
 * o funcionário aceita caminhar até o ponto (ex.: 800 m) e os lugares do veículo. O sistema
 * localiza os endereços no mapa, escolhe o menor número de pontos de embarque que deixa todos
 * dentro do raio e monta as rotas até a empresa (ss-fleet-core core/fretamento_auto.py).
 *
 * A lista de funcionários não é gravada no servidor: fica só nesta tela enquanto ela está aberta.
 */

type Campo = "nome" | "endereco" | "numero" | "bairro" | "cidade" | "uf" | "cep" | "empresa";
const CAMPOS: [Campo, string, boolean][] = [
  ["nome", "Nome", true],
  ["endereco", "Endereço", true],
  ["numero", "Número", false],
  ["bairro", "Bairro", false],
  ["cidade", "Cidade", false],
  ["uf", "UF", false],
  ["cep", "CEP", false],
  ["empresa", "Empresa", true],
];

type Geo = { lat: number; lng: number; precisao: string; achado?: string } | { erro: string };
type Func = { indice: number; nome: string; endereco: string; empresa: string };
type CfgEmpresa = { endereco: string; raio: number; lugares: number; chegada: string };
type Parada = {
  ordem: number;
  lat: number;
  lng: number;
  horario: string | null;
  maior_caminhada_m: number;
  funcionarios: { indice: number; nome: string | null; caminhada_m: number }[];
};
type Rota = {
  rota: number;
  passageiros: number;
  lugares: number;
  km: number;
  minutos: number;
  saida: string | null;
  paradas: Parada[];
  caminho: [number, number][];
};
type Resultado = {
  pontos: number;
  funcionarios: number;
  veiculos: number;
  km_total: number;
  raio_m: number;
  rotas: Rota[];
};

const PRECISAS = new Set(["numero", "rua"]);
const ROTULO_PRECISAO: Record<string, string> = {
  numero: "achou a casa",
  rua: "achou só a rua",
  bairro: "achou só o bairro",
  cidade: "achou só a cidade",
};
const CORES = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#c026d3",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
];
const LOTE = 15;

const ok = (
  g: Geo | undefined,
): g is { lat: number; lng: number; precisao: string; achado?: string } => Boolean(g && "lat" in g);
const chaveEnd = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

function lerBase64(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Não consegui ler o arquivo."));
    r.readAsDataURL(f);
  });
}

function baixar(nome: string, texto: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csv = (linhas: (string | number | null | undefined)[][]) =>
  linhas
    .map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");

function Enquadrar({ pontos }: { pontos: [number, number][] }) {
  const map = useMap();
  const chave = pontos.length
    ? `${pontos.length}:${pontos[0].join(",")}:${pontos[pontos.length - 1].join(",")}`
    : "";
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  useEffect(() => {
    if (pontos.length) map.fitBounds(L.latLngBounds(pontos), { padding: [30, 30], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return null;
}

export function FretamentoAutomatico() {
  const [arquivo, setArquivo] = useState<string>("");
  const [lendo, setLendo] = useState(false);
  const [cabecalho, setCabecalho] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<string[][]>([]);
  const [colunas, setColunas] = useState<Record<Campo, number>>({} as Record<Campo, number>);
  const [geo, setGeo] = useState<Record<string, Geo>>({});
  const [editado, setEditado] = useState<Record<number, string>>({});
  const [rascunho, setRascunho] = useState<Record<number, string>>({});
  const [cfg, setCfg] = useState<Record<string, CfgEmpresa>>({});
  const [aba, setAba] = useState<string>("");
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [res, setRes] = useState<Record<string, Resultado>>({});
  const [gerando, setGerando] = useState(false);
  const [rotaFoco, setRotaFoco] = useState<number | null>(null);

  const funcionarios: Func[] = useMemo(() => {
    const c = colunas;
    const v = (l: string[], k: Campo) => (c[k] >= 0 ? (l[c[k]] ?? "").trim() : "");
    return linhas
      .map((l, i) => {
        const partes = [
          v(l, "endereco"),
          v(l, "numero"),
          v(l, "bairro"),
          v(l, "cidade"),
          v(l, "uf"),
          v(l, "cep"),
        ].filter(Boolean);
        return {
          indice: i,
          nome: v(l, "nome"),
          endereco: editado[i] ?? partes.join(", "),
          empresa: v(l, "empresa") || "Sem empresa",
        };
      })
      .filter((f) => f.nome || f.endereco);
  }, [linhas, colunas, editado]);

  const empresas = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of funcionarios) m.set(f.empresa, (m.get(f.empresa) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [funcionarios]);

  useEffect(() => {
    if (empresas.length && !empresas.some(([e]) => e === aba)) setAba(empresas[0][0]);
    setCfg((atual) => {
      const novo = { ...atual };
      for (const [e] of empresas) novo[e] ??= { endereco: "", raio: 800, lugares: 44, chegada: "" };
      return novo;
    });
  }, [empresas, aba]);

  async function enviar(f: File) {
    setLendo(true);
    try {
      const r = await api.post<{
        cabecalho: string[];
        colunas: Record<Campo, number>;
        linhas: string[][];
      }>("/api/v1/roteirizacao/fretamento-auto/planilha", {
        nome_arquivo: f.name,
        conteudo_base64: await lerBase64(f),
      });
      setArquivo(f.name);
      setCabecalho(r.cabecalho);
      setColunas(r.colunas);
      setLinhas(r.linhas);
      setEditado({});
      setRes({});
      toast.success(`${r.linhas.length} linhas lidas de ${f.name}`);
    } catch (e) {
      toast.error("Não consegui ler a planilha", { description: mensagemErro(e) });
    } finally {
      setLendo(false);
    }
  }

  /** Busca no mapa os endereços ainda sem coordenada (funcionários e empresas), em lotes. */
  async function localizar(soEstes?: string[]) {
    const todos = soEstes ?? [
      ...funcionarios.map((f) => f.endereco),
      ...Object.values(cfg).map((c) => c.endereco),
    ];
    const faltam = [
      ...new Set(todos.filter((e) => e.trim()).filter((e) => soEstes || !geo[chaveEnd(e)])),
    ];
    if (!faltam.length) {
      toast.info("Todos os endereços já foram localizados.");
      return;
    }
    setProgresso({ feito: 0, total: faltam.length });
    try {
      for (let i = 0; i < faltam.length; i += LOTE) {
        const r = await api.post<{ itens: ({ endereco: string } & Geo)[] }>(
          "/api/v1/roteirizacao/fretamento-auto/geocodificar",
          {
            enderecos: faltam.slice(i, i + LOTE),
          },
        );
        setGeo((g) => {
          const n = { ...g };
          for (const it of r.itens) n[chaveEnd(it.endereco)] = it;
          return n;
        });
        setProgresso({ feito: Math.min(faltam.length, i + LOTE), total: faltam.length });
      }
    } catch (e) {
      toast.error("A busca de endereços parou", { description: mensagemErro(e) });
    } finally {
      setProgresso(null);
    }
  }

  const doAba = funcionarios.filter((f) => f.empresa === aba);
  const c = cfg[aba];
  const geoEmpresa = c ? geo[chaveEnd(c.endereco)] : undefined;
  const localizados = doAba.filter(
    (f) =>
      ok(geo[chaveEnd(f.endereco)]) &&
      PRECISAS.has((geo[chaveEnd(f.endereco)] as { precisao: string }).precisao),
  );
  const revisar = doAba.filter((f) => {
    const g = geo[chaveEnd(f.endereco)];
    return g && (!ok(g) || !PRECISAS.has(g.precisao));
  });
  const naoBuscados = doAba.filter((f) => !geo[chaveEnd(f.endereco)]).length;
  const r = res[aba];

  async function gerar() {
    if (!c || !ok(geoEmpresa)) {
      toast.error("Informe e localize o endereço da empresa antes.");
      return;
    }
    if (!localizados.length) {
      toast.error("Nenhum funcionário desta empresa localizado no mapa ainda.");
      return;
    }
    setGerando(true);
    try {
      const out = await api.post<Resultado>("/api/v1/roteirizacao/fretamento-auto/otimizar", {
        empresa: { nome: aba, lat: geoEmpresa.lat, lng: geoEmpresa.lng },
        raio_m: c.raio,
        lugares: c.lugares,
        chegada: c.chegada || null,
        funcionarios: localizados.map((f) => {
          const g = geo[chaveEnd(f.endereco)] as { lat: number; lng: number };
          return { indice: f.indice, nome: f.nome, lat: g.lat, lng: g.lng };
        }),
      });
      setRes((x) => ({ ...x, [aba]: out }));
      setRotaFoco(null);
    } catch (e) {
      toast.error("Não consegui montar as rotas", { description: mensagemErro(e) });
    } finally {
      setGerando(false);
    }
  }

  function exportar() {
    if (!r) return;
    const linhasCsv: (string | number | null)[][] = [
      [
        "Nome",
        "Empresa",
        "Rota",
        "Ordem do ponto",
        "Horário de embarque",
        "Caminhada até o ponto (m)",
        "Latitude do ponto",
        "Longitude do ponto",
        "Endereço do funcionário",
      ],
    ];
    for (const ro of r.rotas)
      for (const p of ro.paradas)
        for (const f of p.funcionarios)
          linhasCsv.push([
            f.nome,
            aba,
            ro.rota,
            p.ordem,
            p.horario,
            f.caminhada_m,
            p.lat,
            p.lng,
            funcionarios.find((x) => x.indice === f.indice)?.endereco ?? "",
          ]);
    for (const f of revisar)
      linhasCsv.push([
        f.nome,
        aba,
        "FORA DA ROTA",
        "",
        "",
        "",
        "",
        "",
        `${f.endereco} (endereço não localizado com precisão)`,
      ]);
    baixar(`embarque-${aba.replace(/[^\w-]+/g, "_")}.csv`, csv(linhasCsv));
  }

  const set = (k: keyof CfgEmpresa, v: string | number) =>
    setCfg((x) => ({ ...x, [aba]: { ...x[aba], [k]: v } }));
  const pontosMapa: [number, number][] = [
    ...(ok(geoEmpresa) ? [[geoEmpresa.lat, geoEmpresa.lng] as [number, number]] : []),
    ...(r
      ? r.rotas.flatMap((ro) => ro.paradas.map((p) => [p.lat, p.lng] as [number, number]))
      : localizados.map((f) => {
          const g = geo[chaveEnd(f.endereco)] as { lat: number; lng: number };
          return [g.lat, g.lng] as [number, number];
        })),
  ];
  const corDe = (indice: number) => {
    if (!r) return "#64748b";
    const ro = r.rotas.find((x) =>
      x.paradas.some((p) => p.funcionarios.some((f) => f.indice === indice)),
    );
    return ro ? CORES[(ro.rota - 1) % CORES.length] : "#64748b";
  };

  return (
    <main className="mx-auto max-w-[1760px] space-y-4 px-4 py-4 md:px-6">
      {/* 1. Planilha */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <FileSpreadsheet className="h-5 w-5 text-brand-navy" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">1. Planilha dos funcionários</p>
            <p className="text-[12px] text-muted-foreground">
              Excel (.xlsx) ou .csv com nome, endereço e empresa. Número, bairro, cidade, UF e CEP
              em colunas separadas também servem. A lista não é guardada no servidor.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              baixar(
                "modelo-fretamento.csv",
                csv([
                  ["Nome", "Endereço", "Número", "Bairro", "Cidade", "UF", "Empresa"],
                  [
                    "Maria Souza",
                    "Rua Felipe Schmidt",
                    "300",
                    "Centro",
                    "Florianópolis",
                    "SC",
                    "Empresa A",
                  ],
                ]),
              )
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[13px] hover:bg-secondary"
          >
            <Download className="h-4 w-4" /> Baixar modelo
          </button>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-brand-navy px-3 text-[13px] font-semibold text-white">
            {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {arquivo ? "Trocar planilha" : "Enviar planilha"}
            <input
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void enviar(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {cabecalho.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-[13px]">
              <b>{arquivo}</b> · {funcionarios.length} funcionários · <b>{empresas.length}</b>{" "}
              {empresas.length === 1 ? "empresa" : "empresas diferentes"}
            </p>
            <div className="flex flex-wrap gap-2 text-[12px]">
              {CAMPOS.map(([k, rot, obrig]) => (
                <label key={k} className="flex items-center gap-1">
                  <span className={cn(obrig && colunas[k] < 0 && "font-semibold text-coral")}>
                    {rot}
                  </span>
                  <select
                    value={colunas[k] ?? -1}
                    onChange={(e) => setColunas((x) => ({ ...x, [k]: Number(e.target.value) }))}
                    className="h-7 max-w-[160px] rounded border border-border bg-white px-1"
                  >
                    <option value={-1}>—</option>
                    {cabecalho.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Coluna ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {CAMPOS.some(([k, , o]) => o && colunas[k] < 0) && (
              <p className="text-[12px] text-coral">Escolha a coluna dos campos em vermelho.</p>
            )}
          </div>
        )}
      </section>

      {empresas.length > 0 && c && (
        <>
          {/* 2. Uma aba por empresa */}
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="Empresas">
            {empresas.map(([e, n]) => (
              <button
                key={e}
                type="button"
                role="tab"
                aria-selected={aba === e}
                onClick={() => {
                  setAba(e);
                  setRotaFoco(null);
                }}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold",
                  aba === e
                    ? "border-brand-navy bg-brand-navy text-white"
                    : "border-border bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                <Building2 className="h-4 w-4" /> {e}{" "}
                <span className="font-mono text-[11px] opacity-80">{n}</span>
                {res[e] && <span className="h-2 w-2 rounded-full bg-leaf" title="Rotas geradas" />}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
            <section className="space-y-3">
              <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                <p className="text-[14px] font-semibold">2. Regras da empresa {aba}</p>
                <label className="block text-[12px]">
                  Endereço da empresa (destino)
                  <input
                    value={c.endereco}
                    onChange={(e) => set("endereco", e.target.value)}
                    placeholder="Rua, número, bairro, cidade"
                    className="mt-0.5 h-8 w-full rounded-lg border border-border bg-white px-2 text-[13px]"
                  />
                </label>
                {c.endereco && geoEmpresa && (
                  <p
                    className={cn(
                      "text-[12px]",
                      ok(geoEmpresa) ? "text-muted-foreground" : "text-coral",
                    )}
                  >
                    {ok(geoEmpresa) ? `No mapa: ${geoEmpresa.achado ?? ""}` : geoEmpresa.erro}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[12px]">
                    Caminhada máxima (m)
                    <input
                      type="number"
                      min={50}
                      max={5000}
                      step={50}
                      value={c.raio}
                      onChange={(e) => set("raio", Number(e.target.value) || 800)}
                      className="mt-0.5 h-8 w-full rounded-lg border border-border bg-white px-2 text-[13px]"
                    />
                  </label>
                  <label className="text-[12px]">
                    Lugares por veículo
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={c.lugares}
                      onChange={(e) => set("lugares", Number(e.target.value) || 44)}
                      className="mt-0.5 h-8 w-full rounded-lg border border-border bg-white px-2 text-[13px]"
                    />
                  </label>
                  <label className="text-[12px]">
                    Chegada na empresa
                    <input
                      type="time"
                      value={c.chegada}
                      onChange={(e) => set("chegada", e.target.value)}
                      className="mt-0.5 h-8 w-full rounded-lg border border-border bg-white px-2 text-[13px]"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                <p className="text-[14px] font-semibold">3. Localizar no mapa</p>
                <p className="text-[12px] text-muted-foreground">
                  {doAba.length} funcionários ·{" "}
                  <b className="text-foreground">{localizados.length}</b> localizados
                  {revisar.length > 0 && (
                    <>
                      {" "}
                      · <b className="text-coral">{revisar.length}</b> para revisar
                    </>
                  )}
                  {naoBuscados > 0 && <> · {naoBuscados} ainda não buscados</>}
                </p>
                <button
                  type="button"
                  disabled={!!progresso}
                  onClick={() => void localizar()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-navy px-3 text-[13px] font-semibold text-brand-navy hover:bg-navy-tint disabled:opacity-60"
                >
                  {progresso ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {progresso
                    ? `Localizando ${progresso.feito} de ${progresso.total}…`
                    : "Localizar endereços (todas as empresas)"}
                </button>
                {progresso && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-1.5 rounded-full bg-brand-navy transition-all"
                      style={{ width: `${(100 * progresso.feito) / progresso.total}%` }}
                    />
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Cerca de 1 endereço por segundo na primeira vez (mapa do OpenStreetMap); o mesmo
                  endereço não é buscado de novo. Só o endereço sai do sistema, nunca o nome.
                </p>
                {revisar.length > 0 && (
                  <div className="max-h-[260px] space-y-1.5 overflow-y-auto rounded-lg border border-coral/30 bg-coral-tint/30 p-2">
                    <p className="flex items-center gap-1 text-[12px] font-semibold text-coral">
                      <AlertTriangle className="h-3.5 w-3.5" /> Fora da rota até corrigir o endereço
                    </p>
                    {revisar.map((f) => {
                      const g = geo[chaveEnd(f.endereco)];
                      return (
                        <div key={f.indice} className="text-[12px]">
                          <p>
                            <b>{f.nome}</b> ·{" "}
                            <span className="text-muted-foreground">
                              {ok(g) ? ROTULO_PRECISAO[g.precisao] : g && "erro" in g ? g.erro : ""}
                            </span>
                          </p>
                          <div className="flex gap-1">
                            <input
                              value={rascunho[f.indice] ?? f.endereco}
                              onChange={(e) =>
                                setRascunho((x) => ({ ...x, [f.indice]: e.target.value }))
                              }
                              className="h-7 min-w-0 flex-1 rounded border border-border bg-white px-1.5"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const novo = (rascunho[f.indice] ?? f.endereco).trim();
                                setEditado((x) => ({ ...x, [f.indice]: novo }));
                                void localizar([novo]);
                              }}
                              className="h-7 rounded border border-border bg-white px-2 hover:bg-secondary"
                            >
                              Buscar
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-border bg-card p-4">
                <p className="text-[14px] font-semibold">4. Rotas</p>
                <button
                  type="button"
                  disabled={gerando}
                  onClick={() => void gerar()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-navy px-3 text-[13px] font-semibold text-white disabled:opacity-60"
                >
                  {gerando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Gerar rotas de {aba}
                </button>
                {r && (
                  <>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      {[
                        ["Pontos", r.pontos],
                        ["Veículos", r.veiculos],
                        ["Pessoas", r.funcionarios],
                        ["Km total", r.km_total.toLocaleString("pt-BR")],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-lg border border-border px-2 py-1.5">
                          <p className="text-[11px] text-muted-foreground">{k}</p>
                          <p className="font-mono text-[16px] font-bold">{v}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={exportar}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[12px] hover:bg-secondary"
                    >
                      <Download className="h-3.5 w-3.5" /> Planilha de embarque (quem pega em qual
                      ponto)
                    </button>
                    <ul className="max-h-[420px] space-y-1.5 overflow-y-auto">
                      {r.rotas.map((ro) => (
                        <li key={ro.rota}>
                          <button
                            type="button"
                            onClick={() => setRotaFoco(rotaFoco === ro.rota ? null : ro.rota)}
                            className={cn(
                              "w-full rounded-lg border px-2.5 py-2 text-left text-[12px]",
                              rotaFoco === ro.rota
                                ? "border-brand-navy bg-navy-tint"
                                : "border-border hover:bg-secondary",
                            )}
                          >
                            <p className="flex items-center gap-1.5 font-semibold">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ background: CORES[(ro.rota - 1) % CORES.length] }}
                              />
                              <Bus className="h-3.5 w-3.5" /> Rota {ro.rota} · {ro.passageiros}/
                              {ro.lugares} lugares · {ro.paradas.length} pontos ·{" "}
                              {ro.km.toLocaleString("pt-BR")} km · {ro.minutos} min
                              {ro.saida && (
                                <span className="ml-auto font-mono">sai {ro.saida}</span>
                              )}
                            </p>
                            {rotaFoco === ro.rota && (
                              <ol className="mt-1.5 space-y-1">
                                {ro.paradas.map((p) => (
                                  <li key={p.ordem} className="rounded bg-white/70 px-1.5 py-1">
                                    <b>
                                      {p.ordem}º ponto{p.horario ? ` · ${p.horario}` : ""}
                                    </b>{" "}
                                    <span className="text-muted-foreground">
                                      · até {p.maior_caminhada_m} m a pé
                                    </span>
                                    <br />
                                    {p.funcionarios.map((f) => f.nome).join(", ")}
                                  </li>
                                ))}
                                <li className="px-1.5 font-semibold">
                                  → {aba}
                                  {c.chegada ? ` · ${c.chegada}` : ""}
                                </li>
                              </ol>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-muted-foreground">
                      Caminhada estimada (linha reta × 1,25) e km da rota estimados (linha reta ×
                      1,3, a 25 km/h e 1 min por ponto) até o motor de rotas ser ligado pelo TI.
                    </p>
                  </>
                )}
              </div>
            </section>

            <section className="relative h-[calc(100vh-220px)] min-h-[520px] overflow-hidden rounded-xl border border-border">
              <MapContainer center={[-27.59, -48.55]} zoom={12} className="h-full w-full">
                <TileLayer
                  attribution="&copy; OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Enquadrar pontos={pontosMapa} />
                {r?.rotas
                  .filter((ro) => rotaFoco == null || ro.rota === rotaFoco)
                  .map((ro) => (
                    <Polyline
                      key={`l${ro.rota}`}
                      positions={ro.caminho}
                      pathOptions={{
                        color: CORES[(ro.rota - 1) % CORES.length],
                        weight: 4,
                        opacity: 0.85,
                      }}
                    />
                  ))}
                {r?.rotas
                  .filter((ro) => rotaFoco == null || ro.rota === rotaFoco)
                  .flatMap((ro) =>
                    ro.paradas.map((p) => (
                      <Circle
                        key={`r${ro.rota}-${p.ordem}`}
                        center={[p.lat, p.lng]}
                        radius={r.raio_m / 1.25}
                        pathOptions={{
                          color: CORES[(ro.rota - 1) % CORES.length],
                          weight: 1,
                          fillOpacity: 0.06,
                        }}
                      />
                    )),
                  )}
                {doAba.map((f) => {
                  const g = geo[chaveEnd(f.endereco)];
                  if (!ok(g) || !PRECISAS.has(g.precisao)) return null;
                  return (
                    <CircleMarker
                      key={`f${f.indice}`}
                      center={[g.lat, g.lng]}
                      radius={3}
                      pathOptions={{
                        color: corDe(f.indice),
                        fillColor: corDe(f.indice),
                        fillOpacity: 0.9,
                        weight: 1,
                      }}
                    >
                      <Tooltip>
                        {f.nome} · {f.endereco}
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
                {r?.rotas
                  .filter((ro) => rotaFoco == null || ro.rota === rotaFoco)
                  .flatMap((ro) =>
                    ro.paradas.map((p) => (
                      <CircleMarker
                        key={`p${ro.rota}-${p.ordem}`}
                        center={[p.lat, p.lng]}
                        radius={7}
                        pathOptions={{
                          color: "#fff",
                          fillColor: CORES[(ro.rota - 1) % CORES.length],
                          fillOpacity: 1,
                          weight: 2,
                        }}
                      >
                        <Tooltip>
                          Rota {ro.rota} · {p.ordem}º ponto{p.horario ? ` · ${p.horario}` : ""} ·{" "}
                          {p.funcionarios.length} pessoas · até {p.maior_caminhada_m} m a pé
                        </Tooltip>
                      </CircleMarker>
                    )),
                  )}
                {ok(geoEmpresa) && (
                  <CircleMarker
                    center={[geoEmpresa.lat, geoEmpresa.lng]}
                    radius={10}
                    pathOptions={{ color: "#fff", fillColor: "#dc2626", fillOpacity: 1, weight: 3 }}
                  >
                    <Tooltip permanent direction="top">
                      {aba}
                    </Tooltip>
                  </CircleMarker>
                )}
              </MapContainer>
              <div className="pointer-events-none absolute bottom-3 left-3 z-[500] flex flex-wrap gap-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] shadow">
                <span className="flex items-center gap-1">
                  <span className="h-3 w-3 rounded-full bg-[#dc2626]" /> empresa
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> ponto de embarque (círculo = caminhada máxima)
                </span>
                <span className="flex items-center gap-1">
                  <Footprints className="h-3 w-3" /> casa do funcionário
                </span>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
