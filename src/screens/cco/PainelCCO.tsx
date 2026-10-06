import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCheck,
  Columns2,
  Eye,
  ExternalLink,
  Fuel,
  Gauge,
  Grid2x2,
  Maximize,
  Minimize,
  Mountain,
  Square,
  Thermometer,
  User,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import { SSOrb } from "@/components/ss/brand/SSOrb";
import {
  AREAS,
  avancar,
  avisosExemplo,
  CATALOGO,
  COR_HEX,
  comunicando,
  corDoCarro,
  frotaExemplo,
  ROTULO_COR,
  ROTULO_FONTE,
  type Aviso,
  type CorCarro,
  type Fonte,
  type VeiculoCCO,
} from "@/lib/cco";
import { lerSessao } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * Painel CCO — fase 1 (protótipo com DADOS DE EXEMPLO para aprovação).
 *
 * Especificação combinada com o PM em 06/10/2026 (ver lib/cco.ts):
 * - tela própria, aberta em outra aba (segundo monitor / telão), tela cheia;
 * - até 4 mapas, cada um com o seu zoom; o layout fica guardado no navegador;
 * - cores: vermelho crítico, amarelo moderado, verde em movimento, cinza parado;
 * - wifi vermelho só sem comunicação há mais de 2 h;
 * - avisos sem som, saem só com Visto ou Tratado;
 * - card do veículo com faixa, consumo e altitude do momento, e atalhos que
 *   abrem o sistema em OUTRA aba — o painel nunca é trocado.
 */

type Layout = 1 | 2 | 4;
type Vista = { centro: [number, number]; zoom: number; area: string };
const CHAVE = "ss:cco:layout";
const ATUALIZA_MS = 30_000;

function lerLayout(): { layout: Layout; vistas: Vista[] } {
  const padrao = {
    layout: 1 as Layout,
    vistas: [AREAS[0], AREAS[1], AREAS[5], AREAS[4]].map((a) => ({
      centro: a.centro,
      zoom: a.zoom,
      area: a.id,
    })),
  };
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    if (v && [1, 2, 4].includes(v.layout) && Array.isArray(v.vistas) && v.vistas.length === 4)
      return v;
  } catch {
    /* navegador sem armazenamento: usa o padrão */
  }
  return padrao;
}

function icone(v: VeiculoCCO, cor: CorCarro, selecionado: boolean, comunica: boolean) {
  const hex = COR_HEX[cor];
  const d = selecionado ? 22 : 16;
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;transform:translate(-${d / 2}px,-50%);width:max-content;${cor === "vermelho" ? "animation:ss-pulsar 1.1s ease-in-out infinite;" : ""}">
      <span style="width:${d}px;height:${d}px;border-radius:50%;background:${hex};border:2px solid #fff;box-shadow:0 1px 5px rgba(15,25,40,.45)${selecionado ? ",0 0 0 4px rgba(46,134,193,.45)" : ""};${comunica ? "" : "opacity:.55;"}"></span>
      <span style="margin-left:3px;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,.92);color:#16263a;font:700 11px/1.2 ui-monospace,monospace;border:1px solid ${hex}">${v.prefixo}</span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export default function PainelCCO() {
  const sessao = lerSessao();
  const ehSS = sessao?.perfil === "super_admin";
  const [agora, setAgora] = useState(() => Date.now());
  const [frota, setFrota] = useState<VeiculoCCO[]>(() => frotaExemplo());
  const [avisos, setAvisos] = useState<Aviso[]>(() => avisosExemplo(frotaExemplo()));
  const [, setCiclo] = useState(0);
  const [empresa, setEmpresa] = useState("");
  const [{ layout, vistas }, setCfg] = useState(lerLayout);
  const [selId, setSelId] = useState<string | null>(null);
  const [foco, setFoco] = useState<{ id: string; n: number; mapa: number } | null>(null);
  // Cada mapa informa se um ponto está na área que ele mostra.
  const contem = useRef<((lat: number, lng: number) => boolean)[]>([]);
  const [fonte, setFonte] = useState<"" | Fonte>("");
  const [cheia, setCheia] = useState(false);

  // Atualização a cada 30 s (no protótipo, simulada).
  useEffect(() => {
    const t = setInterval(() => {
      const ag = Date.now();
      setAgora(ag);
      setCiclo((c) => {
        const n = c + 1;
        setFrota((f) => {
          const r = avancar(f, ag, n);
          if (r.novo) setAvisos((a) => [r.novo!, ...a]);
          return r.frota;
        });
        return n;
      });
    }, ATUALIZA_MS);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ layout, vistas }));
    } catch {
      /* sem armazenamento */
    }
  }, [layout, vistas]);
  useEffect(() => {
    const f = () => setCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  const empresas = useMemo(() => [...new Set(frota.map((v) => v.empresa))].sort(), [frota]);
  const visiveis = useMemo(
    () => frota.filter((v) => !empresa || v.empresa === empresa),
    [frota, empresa],
  );
  const ids = useMemo(() => new Set(visiveis.map((v) => v.id)), [visiveis]);
  const abertos = useMemo(
    () => avisos.filter((a) => a.situacao === "aberto" && ids.has(a.veiculoId)),
    [avisos, ids],
  );
  const cores = useMemo(
    () => new Map(visiveis.map((v) => [v.id, corDoCarro(v, abertos)])),
    [visiveis, abertos],
  );
  const contagem = (c: CorCarro) => [...cores.values()].filter((x) => x === c).length;
  const semSinal = visiveis.filter((v) => !comunicando(v, agora)).length;
  const sel = frota.find((v) => v.id === selId) ?? null;
  const tratadosHoje = avisos.filter((a) => a.situacao !== "aberto" && ids.has(a.veiculoId)).length;

  const listaAvisos = abertos
    .filter((a) => !fonte || CATALOGO[a.tipo].fonte === fonte)
    .sort((a, b) =>
      CATALOGO[a.tipo].gravidade === CATALOGO[b.tipo].gravidade
        ? b.em - a.em
        : CATALOGO[a.tipo].gravidade === "critico"
          ? -1
          : 1,
    );

  const marcar = (id: string, situacao: "visto" | "tratado", nota?: string) =>
    setAvisos((l) =>
      l.map((a) =>
        a.id === id
          ? { ...a, situacao, por: sessao?.nome || "Operador", quando: Date.now(), nota }
          : a,
      ),
    );

  const focar = (veiculoId: string) => {
    setSelId(veiculoId);
    const v = frota.find((x) => x.id === veiculoId);
    // Usa o mapa que já mostra o carro; se nenhum mostra, leva o Mapa 1 até ele.
    const mapa = v
      ? Array.from({ length: layout }, (_, i) => i).find((i) => contem.current[i]?.(v.lat, v.lng))
      : undefined;
    setFoco((f) => ({ id: veiculoId, n: (f?.n ?? 0) + 1, mapa: mapa ?? 0 }));
  };

  const telaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };

  const setVista = (i: number, v: Vista) =>
    setCfg((c) => ({ ...c, vistas: c.vistas.map((x, k) => (k === i ? v : x)) }));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Barra do topo */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-[#0f1f38] px-4 py-2 text-white">
        <div className="flex items-center gap-2">
          <SSOrb size={26} />
          <div className="leading-tight">
            <div className="text-[14px] font-semibold">Painel CCO</div>
            <div className="text-[11px] text-white/60">
              Operação em tempo real · atualiza a cada 30 s
            </div>
          </div>
        </div>
        <span className="rounded bg-gold/90 px-2 py-0.5 text-[11px] font-bold text-[#0f1f38]">
          DADOS DE EXEMPLO — protótipo para aprovação
        </span>

        {ehSS && (
          <select
            id="cco-empresa"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="h-8 rounded-md border border-white/20 bg-white/10 px-2 text-[12px] text-white [&>option]:text-foreground"
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        )}

        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          {(["vermelho", "amarelo", "verde", "cinza"] as CorCarro[]).map((c) => (
            <span key={c} className="flex items-center gap-1.5" title={ROTULO_COR[c]}>
              <span
                className="h-3 w-3 rounded-full border-2 border-white"
                style={{ background: COR_HEX[c] }}
              />
              {ROTULO_COR[c]} <b className="font-mono">{contagem(c)}</b>
            </span>
          ))}
          <span className="flex items-center gap-1.5" title="Sem comunicação há mais de 2 h">
            <WifiOff className="h-3.5 w-3.5 text-coral" /> Sem comunicação{" "}
            <b className="font-mono">{semSinal}</b>
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {([1, 2, 4] as Layout[]).map((n) => {
            const Ic = n === 1 ? Square : n === 2 ? Columns2 : Grid2x2;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setCfg((c) => ({ ...c, layout: n }))}
                aria-pressed={layout === n}
                title={`${n} mapa${n > 1 ? "s" : ""}`}
                className={cn(
                  "inline-flex h-8 w-8 items-center justify-center rounded-md border",
                  layout === n ? "border-white bg-white/20" : "border-white/20 hover:bg-white/10",
                )}
              >
                <Ic className="h-4 w-4" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={telaCheia}
            title={cheia ? "Sair da tela cheia" : "Tela cheia"}
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md border border-white/20 px-2.5 text-[12px] hover:bg-white/10"
          >
            {cheia ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}{" "}
            {cheia ? "Sair" : "Tela cheia"}
          </button>
          <span className="ml-2 font-mono text-[12px] text-white/70">
            {new Date(agora).toLocaleTimeString("pt-BR")}
          </span>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px]">
        {/* Mapas */}
        <div
          className={cn(
            "grid min-h-0 gap-1 bg-border p-1",
            layout === 1 ? "grid-cols-1" : layout === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2",
          )}
        >
          {Array.from({ length: layout }, (_, i) => (
            <MapaCCO
              key={i}
              indice={i}
              vista={vistas[i]}
              onVista={(v) => setVista(i, v)}
              frota={visiveis}
              cores={cores}
              agora={agora}
              selId={selId}
              onSelecionar={setSelId}
              foco={foco && foco.mapa === i ? foco : null}
              registrar={(fn) => (contem.current[i] = fn)}
            />
          ))}
        </div>

        {/* Avisos */}
        <aside className="flex min-h-0 flex-col border-l border-border bg-card">
          <div className="border-b border-border px-3 py-2">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[14px] font-semibold">
                <AlertTriangle className="h-4 w-4 text-coral" /> Avisos em aberto · {abertos.length}
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {tratadosHoje} vistos/tratados
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {(
                [
                  ["", "Todos"],
                  ["seguranca", "Segurança"],
                  ["camera", "Câmera"],
                  ["manutencao", "Manutenção"],
                  ["equipamento", "Equipamento"],
                ] as [string, string][]
              ).map(([k, r]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFonte(k as "" | Fonte)}
                  aria-pressed={fonte === k}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-[11px] font-medium",
                    fonte === k
                      ? "border-brand-navy bg-brand-navy text-white"
                      : "border-border hover:bg-secondary",
                  )}
                >
                  {r} {k ? `· ${abertos.filter((a) => CATALOGO[a.tipo].fonte === k).length}` : ""}
                </button>
              ))}
            </div>
          </div>
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {listaAvisos.length === 0 && (
              <li className="p-6 text-center text-[13px] text-muted-foreground">
                Nenhum aviso em aberto.
              </li>
            )}
            {listaAvisos.map((a) => {
              const c = CATALOGO[a.tipo];
              const v = frota.find((x) => x.id === a.veiculoId)!;
              return (
                <li key={a.id} className="overflow-hidden rounded-lg border border-border bg-white">
                  <button
                    type="button"
                    onClick={() => focar(a.veiculoId)}
                    className="flex w-full gap-2 p-2 text-left hover:bg-secondary/50"
                  >
                    <span
                      className="w-1 shrink-0 rounded"
                      style={{
                        background: c.gravidade === "critico" ? COR_HEX.vermelho : COR_HEX.amarelo,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-semibold">{c.nome}</span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                          {new Date(a.em).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        <b className="font-mono text-foreground">{v.prefixo}</b> {v.placa} ·{" "}
                        {ROTULO_FONTE[c.fonte]}
                        {a.detalhe ? ` · ${a.detalhe}` : ""}
                      </span>
                    </span>
                  </button>
                  <div className="flex border-t border-border text-[12px]">
                    {(c.fonte === "camera" || c.fonte === "equipamento") && (
                      <a
                        href="/app/seguranca/video"
                        target="_blank"
                        rel="noreferrer"
                        className="flex flex-1 items-center justify-center gap-1 py-1.5 text-brand-navy hover:bg-secondary"
                      >
                        <Camera className="h-3.5 w-3.5" /> Vídeo
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => marcar(a.id, "visto")}
                      className="flex flex-1 items-center justify-center gap-1 border-l border-border py-1.5 hover:bg-secondary first:border-l-0"
                    >
                      <Eye className="h-3.5 w-3.5" /> Visto
                    </button>
                    <button
                      type="button"
                      onClick={() => marcar(a.id, "tratado")}
                      className="flex flex-1 items-center justify-center gap-1 border-l border-border py-1.5 font-medium text-leaf hover:bg-secondary"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Tratado
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            Sem som. O aviso só sai da lista quando alguém marca Visto ou Tratado (fica registrado
            quem e quando).
          </p>
        </aside>
      </div>

      {sel && (
        <CardVeiculo
          v={sel}
          cor={cores.get(sel.id) ?? "cinza"}
          avisos={abertos.filter((a) => a.veiculoId === sel.id)}
          agora={agora}
          onFechar={() => setSelId(null)}
          onMarcar={marcar}
        />
      )}
    </div>
  );
}

function MapaCCO({
  indice,
  vista,
  onVista,
  frota,
  cores,
  agora,
  selId,
  onSelecionar,
  foco,
  registrar,
}: {
  indice: number;
  vista: Vista;
  onVista: (v: Vista) => void;
  frota: VeiculoCCO[];
  cores: Map<string, CorCarro>;
  agora: number;
  selId: string | null;
  onSelecionar: (id: string) => void;
  foco: { id: string; n: number; mapa: number } | null;
  registrar: (fn: (lat: number, lng: number) => boolean) => void;
}) {
  return (
    <div className="relative min-h-0 overflow-hidden bg-white">
      <MapContainer
        center={vista.centro}
        zoom={vista.zoom}
        className="h-full w-full"
        style={{ zIndex: 0 }}
        preferCanvas
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Guardar vista={vista} onVista={onVista} />
        <Focar foco={foco} frota={frota} registrar={registrar} />
        {frota.map((v) => (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={icone(v, cores.get(v.id) ?? "cinza", selId === v.id, comunicando(v, agora))}
            zIndexOffset={
              { vermelho: 3000, amarelo: 2000, verde: 1000, cinza: 0 }[cores.get(v.id) ?? "cinza"] +
              (selId === v.id ? 5000 : 0)
            }
            eventHandlers={{ click: () => onSelecionar(v.id) }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {v.prefixo} · {v.placa} · {ROTULO_COR[cores.get(v.id) ?? "cinza"]}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
      <div className="absolute right-2 top-2 z-[400] flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-1 text-[12px] shadow">
        <span className="font-semibold text-muted-foreground">Mapa {indice + 1}</span>
        <select
          id={`cco-area-${indice}`}
          value={vista.area}
          onChange={(e) => {
            const a = AREAS.find((x) => x.id === e.target.value);
            if (a) onVista({ centro: a.centro, zoom: a.zoom, area: a.id });
          }}
          className="h-7 rounded border border-border bg-white px-1 text-[12px]"
        >
          {AREAS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
          <option value="livre">Área livre</option>
        </select>
      </div>
    </div>
  );
}

/** Aplica a área escolhida e guarda o enquadramento quando o operador arrasta. */
function Guardar({ vista, onVista }: { vista: Vista; onVista: (v: Vista) => void }) {
  const map = useMap();
  const ultimo = useRef(vista.area + vista.zoom + vista.centro.join());
  // Movimento feito pelo próprio painel (troca de área) não vira "Área livre".
  const programatico = useRef(false);
  useEffect(() => {
    const k = vista.area + vista.zoom + vista.centro.join();
    if (k !== ultimo.current && vista.area !== "livre") {
      programatico.current = true;
      map.setView(vista.centro, vista.zoom);
    }
    ultimo.current = k;
  }, [vista, map]);
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map]);
  useMapEvents({
    moveend: (e) => {
      if (programatico.current) {
        programatico.current = false;
        return;
      }
      const m = e.target as L.Map;
      const c = m.getCenter();
      const nova = {
        centro: [Number(c.lat.toFixed(4)), Number(c.lng.toFixed(4))] as [number, number],
        zoom: m.getZoom(),
        area: "livre",
      };
      ultimo.current = nova.area + nova.zoom + nova.centro.join();
      onVista(nova);
    },
  });
  return null;
}

function Focar({
  foco,
  frota,
  registrar,
}: {
  foco: { id: string; n: number } | null;
  frota: VeiculoCCO[];
  registrar: (fn: (lat: number, lng: number) => boolean) => void;
}) {
  const map = useMap();
  useEffect(() => {
    // Bloco (sem retorno): o que a função devolvesse viraria a limpeza do efeito.
    registrar((lat, lng) => {
      try {
        return map.getBounds().contains([lat, lng]);
      } catch {
        return false; // mapa ainda montando ou já desmontado
      }
    });
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!foco) return;
    const v = frota.find((x) => x.id === foco.id);
    // Já visível: só centraliza, sem mudar o zoom que o operador escolheu.
    if (v && map.getBounds().contains([v.lat, v.lng])) map.panTo([v.lat, v.lng], { animate: false });
    else if (v) map.setView([v.lat, v.lng], Math.max(map.getZoom(), 12), { animate: false });
  }, [foco]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function CardVeiculo({
  v,
  cor,
  avisos,
  agora,
  onFechar,
  onMarcar,
}: {
  v: VeiculoCCO;
  cor: CorCarro;
  avisos: Aviso[];
  agora: number;
  onFechar: () => void;
  onMarcar: (id: string, s: "visto" | "tratado") => void;
}) {
  const ok = comunicando(v, agora);
  const desligado = !v.ignicao;
  const metr = (rot: string, valor: string, Ic: typeof Gauge) => (
    <div className="rounded-lg border border-border bg-secondary/40 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Ic className="h-3.5 w-3.5" /> {rot}
      </div>
      <div className="mt-0.5 font-mono text-[15px] font-semibold text-foreground">{valor}</div>
    </div>
  );
  const atalhos: [string, string, typeof Gauge][] = [
    ["Sinais do motor", `/app/frota/sinais?veiculo=${v.id}`, Activity],
    ["Tracking do dia", `/app/frota/tracking?veiculo=${encodeURIComponent(v.placa)}`, Gauge],
    ["Eventos", "/app/eventos", AlertTriangle],
    ...(v.temCamera
      ? ([["Câmera ao vivo", "/app/seguranca/video", Camera]] as [string, string, typeof Gauge][])
      : []),
    ["Manutenção", "/app/manutencao/", Wrench],
    ["Ficha do veículo", "/app/veiculos/", ExternalLink],
  ];
  return (
    <div className="fixed bottom-4 left-4 z-[1000] w-[420px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-2xl">
      <div
        className="flex items-start gap-3 border-b border-border p-3"
        style={{
          borderTop: `4px solid ${COR_HEX[cor]}`,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[16px] font-bold">{v.prefixo}</span>
            <span className="font-mono text-[13px] text-muted-foreground">{v.placa}</span>
            <span title={ok ? "Comunicando" : "Sem comunicação há mais de 2 h"}>
              {ok ? (
                <Wifi className="h-4 w-4 text-leaf" />
              ) : (
                <WifiOff className="h-4 w-4 text-coral" />
              )}
            </span>
          </div>
          <div className="text-[12px] text-muted-foreground">
            {v.empresa} ·{" "}
            <span style={{ color: COR_HEX[cor] }} className="font-semibold">
              {ROTULO_COR[cor]}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
            <User className="h-3.5 w-3.5" /> {v.motorista ?? "Motorista não identificado"} · ignição{" "}
            {v.ignicao ? "ligada" : "desligada"} ·{" "}
            {ok
              ? `há ${Math.max(0, Math.round((agora - v.ultimaComunicacao) / 60000))} min`
              : `sem sinal há ${Math.round((agora - v.ultimaComunicacao) / 3600000)} h`}
          </div>
        </div>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        {metr("Velocidade", desligado ? "—" : `${v.velocidade} km/h`, Gauge)}
        {metr("Rotação", desligado || v.rpm == null ? "—" : `${v.rpm} rpm`, Activity)}
        {metr("Faixa agora", desligado || !v.faixa ? "—" : v.faixa, Gauge)}
        {metr(
          "Consumo agora",
          desligado || v.consumoLh == null ? "—" : `${v.consumoLh.toLocaleString("pt-BR")} L/h`,
          Fuel,
        )}
        {metr("Altitude", v.altitude == null ? "—" : `${v.altitude} m`, Mountain)}
        {metr(
          "Temperatura",
          desligado || v.temperatura == null ? "—" : `${v.temperatura} °C`,
          Thermometer,
        )}
      </div>

      {avisos.length > 0 && (
        <div className="space-y-1 px-3 pb-2">
          {avisos.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-[12px]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  background:
                    CATALOGO[a.tipo].gravidade === "critico" ? COR_HEX.vermelho : COR_HEX.amarelo,
                }}
              />
              <span className="min-w-0 flex-1 truncate">
                <b>{CATALOGO[a.tipo].nome}</b> ·{" "}
                {new Date(a.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button
                type="button"
                onClick={() => onMarcar(a.id, "visto")}
                className="rounded px-1.5 py-0.5 hover:bg-secondary"
              >
                Visto
              </button>
              <button
                type="button"
                onClick={() => onMarcar(a.id, "tratado")}
                className="rounded px-1.5 py-0.5 font-medium text-leaf hover:bg-secondary"
              >
                Tratado
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 border-t border-border p-3">
        {atalhos.map(([rot, href, Ic]) => (
          <a
            key={rot}
            href={href}
            target="_blank"
            rel="noreferrer"
            title="Abre em outra aba (o painel continua aqui)"
            className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[12px] font-medium text-brand-navy hover:bg-navy-tint"
          >
            <Ic className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{rot}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
