import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCheck,
  Columns2,
  ExternalLink,
  Eye,
  Fuel,
  Gauge,
  Grid2x2,
  Loader2,
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
import { toast } from "sonner";
import { SSOrb } from "@/components/ss/brand/SSOrb";
import { NOME_TIPO, svgVeiculo } from "@/components/ss/mapa/iconesVeiculo";
import {
  AREAS,
  avancar,
  avisosExemplo,
  CATALOGO,
  COR_HEX,
  corDoCarro,
  frotaExemplo,
  LIMITE_SEM_COMUNICACAO_MS,
  ROTULO_COR,
  ROTULO_FONTE,
  type Aviso,
  type VeiculoCCO,
} from "@/lib/cco";
import {
  CCO,
  consumoQuery,
  painelCCOQuery,
  type AvisoPainel,
  type CorCarro,
  type FonteAviso,
  type VeiculoPainel,
} from "@/lib/cco-api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { usandoMock } from "@/lib/modo";
import { lerSessao } from "@/lib/session";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Painel CCO — a operação em tempo real numa tela própria (aberta em outra aba
 * para o segundo monitor ou o telão). Especificação combinada com o PM em
 * 06/10/2026 (ver lib/cco.ts e ss-fleet-core endpoints/cco.py):
 * - até 4 mapas, cada um com o seu zoom; o layout fica guardado no navegador;
 * - carro desenhado pelo tipo (caminhão, ônibus, van…) na cor da situação:
 *   vermelho crítico, amarelo moderado, verde andando, cinza parado — sem piscar;
 * - wifi vermelho só sem comunicação há mais de 2 h;
 * - avisos sem som, agrupados por veículo e tipo, saem só com Visto ou Tratado;
 * - o card e os avisos abrem o sistema em OUTRA aba (rel="opener" para levar o
 *   login, que fica no sessionStorage) — o painel nunca é trocado.
 * Em modo de demonstração usa os dados de exemplo de lib/cco.ts.
 */

type Layout = 1 | 2 | 4;
type Vista = { centro: [number, number]; zoom: number; area: string };
const CHAVE = "ss:cco:layout";
const HORAS = [1, 2, 6, 12];

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
    /* navegador sem armazenamento */
  }
  return padrao;
}

function icone(v: VeiculoPainel, selecionado: boolean) {
  const hex = COR_HEX[v.cor];
  const d = selecionado ? 34 : 28;
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;transform:translate(-${d / 2}px,-50%);width:max-content">
      <span style="display:flex;align-items:center;justify-content:center;width:${d}px;height:${d}px;border-radius:50%;background:${hex};color:#fff;border:2px solid #fff;box-shadow:0 1px 5px rgba(15,25,40,.45)${selecionado ? ",0 0 0 4px rgba(46,134,193,.5)" : ""};${v.comunicando ? "" : "opacity:.55;"}">${svgVeiculo(v.tipo, selecionado ? 19 : 16)}</span>
      <span style="margin-left:-6px;padding:2px 7px 2px 10px;border-radius:0 999px 999px 0;background:#fff;color:#16263a;font:700 11px/1.2 ui-monospace,monospace;border:1.5px solid ${hex};border-left:0;white-space:nowrap">${v.prefixo}</span>
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

const ESCALA: Record<CorCarro, number> = { vermelho: 3000, amarelo: 2000, verde: 1000, cinza: 0 };

// ----------------------------------------------------- dados de exemplo (demonstração)

function exemploParaPainel(
  frota: VeiculoCCO[],
  avisos: Aviso[],
  agora: number,
): { veiculos: VeiculoPainel[]; avisos: AvisoPainel[] } {
  const abertos = avisos.filter((a) => a.situacao === "aberto");
  return {
    veiculos: frota.map((v, i) => ({
      id: v.id,
      placa: v.placa,
      prefixo: v.prefixo,
      empresa: v.empresa,
      tipo: v.empresa.includes("Viação") ? "onibus" : i % 9 === 0 ? "van" : "caminhao",
      lat: v.lat,
      lng: v.lng,
      ignicao: v.ignicao,
      velocidade: v.velocidade,
      rpm: v.rpm,
      faixa: v.faixa,
      altitude: v.altitude,
      temperatura: v.temperatura,
      combustivel: v.combustivelPct,
      motorista: v.motorista,
      ultima_comunicacao: new Date(v.ultimaComunicacao).toISOString(),
      comunicando: agora - v.ultimaComunicacao <= LIMITE_SEM_COMUNICACAO_MS,
      tem_camera: v.temCamera,
      cor: corDoCarro(v, abertos),
    })),
    avisos: abertos.map((a) => ({
      id: a.id,
      unit_id: a.veiculoId,
      nome: CATALOGO[a.tipo].nome,
      fonte: CATALOGO[a.tipo].fonte,
      gravidade: CATALOGO[a.tipo].gravidade,
      quantidade: 1,
      ultimo: new Date(a.em).toISOString(),
      detalhe: a.detalhe,
    })),
  };
}

function useExemplo(ativo: boolean) {
  const [frota, setFrota] = useState<VeiculoCCO[]>(() => frotaExemplo());
  const [avisos, setAvisos] = useState<Aviso[]>(() => avisosExemplo(frotaExemplo()));
  const [agora, setAgora] = useState(() => Date.now());
  const n = useRef(0);
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => {
      const ag = Date.now();
      n.current += 1;
      setAgora(ag);
      setFrota((f) => {
        const r = avancar(f, ag, n.current);
        if (r.novo) setAvisos((a) => [r.novo!, ...a]);
        return r.frota;
      });
    }, 30_000);
    return () => clearInterval(t);
  }, [ativo]);
  const dados = useMemo(() => exemploParaPainel(frota, avisos, agora), [frota, avisos, agora]);
  const marcar = (id: string, situacao: "visto" | "tratado") =>
    setAvisos((l) => l.map((a) => (a.id === id ? { ...a, situacao } : a)));
  const consumo = (id: string | number) => frota.find((v) => v.id === id)?.consumoLh ?? null;
  return { dados, marcar, consumo };
}

// ------------------------------------------------------------------ painel

export default function PainelCCO() {
  const qc = useQueryClient();
  const mock = usandoMock();
  const sessao = lerSessao();
  const ehSS = sessao?.perfil === "super_admin";
  const [grupo, setGrupo] = useState<string | undefined>(() => (ehSS ? undefined : grupoAtivo()));
  const [horas, setHoras] = useState(2);
  const q = useQuery(painelCCOQuery(grupo, horas));
  const ex = useExemplo(mock);
  const [{ layout, vistas }, setCfg] = useState(lerLayout);
  const [selId, setSelId] = useState<string | number | null>(null);
  const [foco, setFoco] = useState<{ id: string | number; n: number; mapa: number } | null>(null);
  const contem = useRef<((lat: number, lng: number) => boolean)[]>([]);
  const [fonte, setFonte] = useState<"" | FonteAviso>("");
  const [cheia, setCheia] = useState(false);
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const [empresas, setEmpresas] = useState<{ id: number; nome: string }[]>([]);
  const [relogio, setRelogio] = useState(() => Date.now());

  const dados = mock ? ex.dados : q.data;
  const veiculos = useMemo(() => dados?.veiculos ?? [], [dados]);
  const avisos = useMemo(
    () => (dados?.avisos ?? []).filter((a) => !ocultos.has(a.id)),
    [dados, ocultos],
  );

  // Empresas do seletor da SS: vêm da visão "todas" (cada veículo traz o grupo).
  useEffect(() => {
    if (!mock && !grupo && q.data) {
      const m = new Map<number, string>();
      for (const v of q.data.veiculos)
        if (v.group_id) m.set(v.group_id, v.empresa ?? `Grupo ${v.group_id}`);
      setEmpresas(
        [...m].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome)),
      );
    }
  }, [q.data, grupo, mock]);
  useEffect(() => setOcultos(new Set()), [q.dataUpdatedAt]);
  useEffect(() => {
    const t = setInterval(() => setRelogio(Date.now()), 1000);
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

  // A cor vem do servidor, mas um aviso marcado agora já tira a cor do carro.
  const comCor = useMemo(() => {
    const porUnidade = new Map<string, AvisoPainel[]>();
    for (const a of avisos)
      porUnidade.set(String(a.unit_id), [...(porUnidade.get(String(a.unit_id)) ?? []), a]);
    return veiculos.map((v) => {
      const meus = porUnidade.get(String(v.id)) ?? [];
      const cor: CorCarro = meus.some((a) => a.gravidade === "critico")
        ? "vermelho"
        : meus.length
          ? "amarelo"
          : v.ignicao && v.velocidade > 3
            ? "verde"
            : "cinza";
      return { ...v, cor };
    });
  }, [veiculos, avisos]);

  const contagem = (c: CorCarro) => comCor.filter((v) => v.cor === c).length;
  const semSinal = comCor.filter((v) => !v.comunicando).length;
  const sel = comCor.find((v) => String(v.id) === String(selId)) ?? null;
  const lista = avisos
    .filter((a) => !fonte || a.fonte === fonte)
    .sort((a, b) =>
      a.gravidade === b.gravidade
        ? String(b.ultimo).localeCompare(String(a.ultimo))
        : a.gravidade === "critico"
          ? -1
          : 1,
    );

  const marcar = async (a: AvisoPainel, situacao: "visto" | "tratado") => {
    setOcultos((s) => new Set(s).add(a.id));
    if (mock) return ex.marcar(a.id, situacao);
    try {
      await CCO.marcar(a, situacao);
      await qc.invalidateQueries({ queryKey: ["cco"] });
    } catch (e) {
      setOcultos((s) => {
        const n = new Set(s);
        n.delete(a.id);
        return n;
      });
      toast.error(mensagemErro(e));
    }
  };

  const focar = (id: string | number) => {
    setSelId(id);
    const v = comCor.find((x) => String(x.id) === String(id));
    const mapa = v
      ? Array.from({ length: layout }, (_, i) => i).find((i) => contem.current[i]?.(v.lat, v.lng))
      : undefined;
    setFoco((f) => ({ id, n: (f?.n ?? 0) + 1, mapa: mapa ?? 0 }));
  };

  const telaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  const setVista = (i: number, v: Vista) =>
    setCfg((c) => ({ ...c, vistas: c.vistas.map((x, k) => (k === i ? v : x)) }));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
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
        {mock && (
          <span className="rounded bg-gold/90 px-2 py-0.5 text-[11px] font-bold text-[#0f1f38]">
            DADOS DE EXEMPLO
          </span>
        )}

        {ehSS && !mock && (
          <select
            id="cco-empresa"
            value={grupo ?? ""}
            onChange={(e) => {
              setGrupo(e.target.value || undefined);
              setSelId(null);
            }}
            className="h-8 max-w-[260px] rounded-md border border-white/20 bg-white/10 px-2 text-[12px] text-white [&>option]:text-foreground"
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        )}
        {!mock && (
          <select
            id="cco-horas"
            value={horas}
            onChange={(e) => setHoras(Number(e.target.value))}
            title="Avisos de quanto tempo para trás"
            className="h-8 rounded-md border border-white/20 bg-white/10 px-2 text-[12px] text-white [&>option]:text-foreground"
          >
            {HORAS.map((h) => (
              <option key={h} value={h}>
                Avisos: última{h > 1 ? `s ${h} horas` : " hora"}
              </option>
            ))}
          </select>
        )}

        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          {(["vermelho", "amarelo", "verde", "cinza"] as CorCarro[]).map((c) => (
            <span key={c} className="flex items-center gap-1.5">
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
          {q.isFetching && !mock && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" />}
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
                aria-label={`${n} mapa${n > 1 ? "s" : ""}`}
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
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md border border-white/20 px-2.5 text-[12px] hover:bg-white/10"
          >
            {cheia ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}{" "}
            {cheia ? "Sair" : "Tela cheia"}
          </button>
          <span className="ml-2 font-mono text-[12px] text-white/70">
            {new Date(relogio).toLocaleTimeString("pt-BR")}
          </span>
        </div>
      </header>

      {!mock && q.error ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-[14px] text-coral">
          {mensagemErro(q.error)}
        </div>
      ) : !mock && q.isPending ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-[14px] text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando a operação…
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px]">
          <div
            className={cn(
              "grid min-h-0 gap-1 bg-border p-1",
              layout === 1
                ? "grid-cols-1"
                : layout === 2
                  ? "grid-cols-2"
                  : "grid-cols-2 grid-rows-2",
            )}
          >
            {Array.from({ length: layout }, (_, i) => (
              <MapaCCO
                key={i}
                indice={i}
                vista={vistas[i]}
                onVista={(v) => setVista(i, v)}
                veiculos={comCor}
                selId={selId}
                onSelecionar={setSelId}
                foco={foco && foco.mapa === i ? foco : null}
                registrar={(fn) => (contem.current[i] = fn)}
              />
            ))}
          </div>

          <aside className="flex min-h-0 flex-col border-l border-border bg-card">
            <div className="border-b border-border px-3 py-2">
              <h2 className="flex items-center gap-1.5 text-[14px] font-semibold">
                <AlertTriangle className="h-4 w-4 text-coral" /> Avisos em aberto · {avisos.length}
              </h2>
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
                    onClick={() => setFonte(k as "" | FonteAviso)}
                    aria-pressed={fonte === k}
                    className={cn(
                      "h-7 rounded-full border px-2.5 text-[11px] font-medium",
                      fonte === k
                        ? "border-brand-navy bg-brand-navy text-white"
                        : "border-border hover:bg-secondary",
                    )}
                  >
                    {r} {k ? `· ${avisos.filter((a) => a.fonte === k).length}` : ""}
                  </button>
                ))}
              </div>
              {!mock && !q.data?.manutencao_disponivel && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Avisos de manutenção aparecem ao escolher uma empresa.
                </p>
              )}
            </div>
            <ul className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
              {lista.length === 0 && (
                <li className="p-6 text-center text-[13px] text-muted-foreground">
                  Nenhum aviso em aberto.
                </li>
              )}
              {lista.slice(0, 300).map((a) => {
                const v = comCor.find((x) => String(x.id) === String(a.unit_id));
                if (!v) return null;
                return (
                  <li
                    key={a.id}
                    className="overflow-hidden rounded-lg border border-border bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => focar(v.id)}
                      className="flex w-full gap-2 p-2 text-left hover:bg-secondary/50"
                    >
                      <span
                        className="w-1 shrink-0 rounded"
                        style={{
                          background:
                            a.gravidade === "critico" ? COR_HEX.vermelho : COR_HEX.amarelo,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold">
                            {a.nome}
                            {a.quantidade > 1 ? ` ×${a.quantidade}` : ""}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            {a.ultimo
                              ? new Date(a.ultimo).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </span>
                        <span className="block truncate text-[12px] text-muted-foreground">
                          <b className="font-mono text-foreground">{v.prefixo}</b> {v.placa} ·{" "}
                          {ROTULO_FONTE[a.fonte]}
                          {a.detalhe ? ` · ${a.detalhe}` : ""}
                          {a.reaberto ? " · voltou a ocorrer" : ""}
                        </span>
                      </span>
                    </button>
                    <div className="flex border-t border-border text-[12px]">
                      {(a.fonte === "camera" || a.fonte === "equipamento") && (
                        <a
                          href="/app/seguranca/video"
                          target="_blank"
                          rel="opener"
                          className="flex flex-1 items-center justify-center gap-1 py-1.5 text-brand-navy hover:bg-secondary"
                        >
                          <Camera className="h-3.5 w-3.5" /> Vídeo
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => marcar(a, "visto")}
                        className="flex flex-1 items-center justify-center gap-1 border-l border-border py-1.5 hover:bg-secondary first:border-l-0"
                      >
                        <Eye className="h-3.5 w-3.5" /> Visto
                      </button>
                      <button
                        type="button"
                        onClick={() => marcar(a, "tratado")}
                        className="flex flex-1 items-center justify-center gap-1 border-l border-border py-1.5 font-medium text-leaf hover:bg-secondary"
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> Tratado
                      </button>
                    </div>
                  </li>
                );
              })}
              {lista.length > 300 && (
                <li className="p-2 text-center text-[12px] text-muted-foreground">
                  Mostrando os 300 primeiros de {lista.length}. Escolha uma empresa ou um tipo para
                  ver o resto.
                </li>
              )}
            </ul>
            <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
              Sem som. Um aviso junta as ocorrências do mesmo tipo no veículo e só sai com Visto ou
              Tratado; se voltar a ocorrer depois, reaparece.
            </p>
          </aside>
        </div>
      )}

      {sel && (
        <CardVeiculo
          v={sel}
          avisos={avisos.filter((a) => String(a.unit_id) === String(sel.id))}
          onFechar={() => setSelId(null)}
          onMarcar={marcar}
          consumoExemplo={mock ? ex.consumo(sel.id) : undefined}
          agora={relogio}
        />
      )}
    </div>
  );
}

function MapaCCO({
  indice,
  vista,
  onVista,
  veiculos,
  selId,
  onSelecionar,
  foco,
  registrar,
}: {
  indice: number;
  vista: Vista;
  onVista: (v: Vista) => void;
  veiculos: VeiculoPainel[];
  selId: string | number | null;
  onSelecionar: (id: string | number) => void;
  foco: { id: string | number; n: number } | null;
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
        <Focar foco={foco} veiculos={veiculos} registrar={registrar} />
        {veiculos.map((v) => (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={icone(v, String(selId) === String(v.id))}
            zIndexOffset={ESCALA[v.cor] + (String(selId) === String(v.id) ? 5000 : 0)}
            eventHandlers={{ click: () => onSelecionar(v.id) }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              {NOME_TIPO[v.tipo]} {v.prefixo} · {v.placa} · {ROTULO_COR[v.cor]}
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
      map.setView(vista.centro, vista.zoom, { animate: false });
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
  veiculos,
  registrar,
}: {
  foco: { id: string | number; n: number } | null;
  veiculos: VeiculoPainel[];
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
    const v = veiculos.find((x) => String(x.id) === String(foco.id));
    // Sem animação: aba em segundo plano não anima e o voo calculava posição inválida.
    if (v && map.getBounds().contains([v.lat, v.lng]))
      map.panTo([v.lat, v.lng], { animate: false });
    else if (v) map.setView([v.lat, v.lng], Math.max(map.getZoom(), 12), { animate: false });
  }, [foco]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function CardVeiculo({
  v,
  avisos,
  onFechar,
  onMarcar,
  consumoExemplo,
  agora,
}: {
  v: VeiculoPainel;
  avisos: AvisoPainel[];
  onFechar: () => void;
  onMarcar: (a: AvisoPainel, s: "visto" | "tratado") => void;
  consumoExemplo?: number | null;
  agora: number;
}) {
  const cq = useQuery(consumoQuery(typeof v.id === "number" ? v.id : null));
  const desligado = !v.ignicao;
  const consumo = consumoExemplo !== undefined ? consumoExemplo : (cq.data?.consumo_lh ?? null);
  const minCom = v.ultima_comunicacao
    ? Math.round((agora - new Date(v.ultima_comunicacao).getTime()) / 60000)
    : null;
  const metr = (rot: string, valor: string, Ic: typeof Gauge, dica?: string) => (
    <div className="rounded-lg border border-border bg-secondary/40 px-2.5 py-2" title={dica}>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Ic className="h-3.5 w-3.5" /> {rot}
      </div>
      <div className="mt-0.5 font-mono text-[15px] font-semibold text-foreground">{valor}</div>
    </div>
  );
  const id = encodeURIComponent(String(v.id));
  const atalhos: [string, string, typeof Gauge][] = [
    ["Sinais do motor", `/app/frota/sinais?veiculo=${id}`, Activity],
    ["Tracking do dia", `/app/frota/tracking?veiculo=${encodeURIComponent(v.prefixo)}`, Gauge],
    ["Eventos", "/app/eventos", AlertTriangle],
    ...(v.tem_camera
      ? ([["Câmera ao vivo", "/app/seguranca/video", Camera]] as [string, string, typeof Gauge][])
      : []),
    ["Manutenção", "/app/manutencao/", Wrench],
    ["Ficha do veículo", "/app/veiculos/", ExternalLink],
  ];
  return (
    <div className="fixed bottom-4 left-4 z-[1000] w-[430px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-2xl">
      <div
        className="flex items-start gap-3 border-b border-border p-3"
        style={{
          borderTop: `4px solid ${COR_HEX[v.cor]}`,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: COR_HEX[v.cor] }}
          dangerouslySetInnerHTML={{ __html: svgVeiculo(v.tipo, 22) }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[16px] font-bold">{v.prefixo}</span>
            <span className="font-mono text-[13px] text-muted-foreground">{v.placa}</span>
            <span title={v.comunicando ? "Comunicando" : "Sem comunicação há mais de 2 h"}>
              {v.comunicando ? (
                <Wifi className="h-4 w-4 text-leaf" />
              ) : (
                <WifiOff className="h-4 w-4 text-coral" />
              )}
            </span>
          </div>
          <div className="truncate text-[12px] text-muted-foreground">
            {NOME_TIPO[v.tipo]}{v.descricao ? ` ${v.descricao}` : ""} · {v.empresa} ·{" "}
            <span style={{ color: COR_HEX[v.cor] }} className="font-semibold">
              {ROTULO_COR[v.cor]}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {v.motorista ?? "Motorista não identificado"} · ignição{" "}
              {v.ignicao ? "ligada" : "desligada"} ·{" "}
              {minCom == null
                ? "sem registro"
                : minCom < 120
                  ? `há ${Math.max(0, minCom)} min`
                  : `sem sinal há ${Math.round(minCom / 60)} h`}
            </span>
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
          desligado || consumo == null ? "—" : `${consumo.toLocaleString("pt-BR")} L/h`,
          Fuel,
          cq.data?.consumo_minutos
            ? `Média dos últimos ${cq.data.consumo_minutos} min, pelo totalizador de combustível`
            : undefined,
        )}
        {metr("Altitude", v.altitude == null ? "—" : `${v.altitude} m`, Mountain)}
        {metr(
          "Temperatura",
          desligado || v.temperatura == null ? "—" : `${v.temperatura} °C`,
          Thermometer,
        )}
      </div>

      {avisos.length > 0 && (
        <div className="max-h-[140px] space-y-1 overflow-y-auto px-3 pb-2">
          {avisos.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-[12px]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  background: a.gravidade === "critico" ? COR_HEX.vermelho : COR_HEX.amarelo,
                }}
              />
              <span className="min-w-0 flex-1 truncate">
                <b>{a.nome}</b>
                {a.quantidade > 1 ? ` ×${a.quantidade}` : ""} ·{" "}
                {a.ultimo
                  ? new Date(a.ultimo).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </span>
              <button
                type="button"
                onClick={() => onMarcar(a, "visto")}
                className="rounded px-1.5 py-0.5 hover:bg-secondary"
              >
                Visto
              </button>
              <button
                type="button"
                onClick={() => onMarcar(a, "tratado")}
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
            rel="opener"
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
