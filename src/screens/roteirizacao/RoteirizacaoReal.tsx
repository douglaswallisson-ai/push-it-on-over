import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Clock, Coffee, Fuel, Loader2, MapPin, Moon, Plus, Route, Save, Sparkles, Trash2, Wallet } from "lucide-react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { api } from "@/lib/api";
import { Escala, escalaPoisQuery, escalaRotasQuery, type PontoPlano } from "@/lib/escala-api";
import { rotaOtimizada, type Parada } from "@/lib/roteirizacao";
import { veiculosApiQuery } from "@/lib/queries";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Roteirização com dado real. Recebe os pontos de uma viagem da Escala de
 * Viagem (?viagem=ID), de uma rota padrão ou montados aqui, e estima km, tempo
 * com as pausas da Lei do Motorista, combustível pelo km/L real do veículo,
 * custo pelo preço ANP e pedágio. As duas ferramentas são separadas e
 * conversam: daqui se salva a rota para a escala usar (decisão do PM, 04/10/2026).
 */

type Ponto = { id: string; nome: string; latitude: number; longitude: number; parada_min: number; tipo?: string };
type Resultado = {
  operacao: "carga" | "passageiros";
  fonte_rota: string;
  trechos: { de: string; para: string; km: number; conducao_min: number }[];
  km_total: number;
  conducao_min: number;
  pausas: { tipo: "pausa" | "descanso"; min: number; quando: string; trecho: string; regra: string }[];
  pausas_min: number;
  paradas_min: number;
  saida: string;
  chegada: string;
  duracao_total_min: number;
  agenda: { ponto: string; chegada: string | null; saida: string | null }[];
  combustivel: { kml: number; fonte_kml: string; litros: number | null; preco_litro: number | null; fonte_preco: string | null; custo: number | null };
  pedagio: { pracas: { nome: string; rodovia: string; uf: string }[]; base_disponivel: boolean; eixos: number; tarifa_eixo: number | null; tarifa_estimada?: boolean; valor: number | null; observacao: string | null };
  geometria: [number, number][] | null;
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const nf = (v: number | null | undefined, c = 0) => (v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c }));
const hhmm = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;
const quando = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const agoraLocal = () => {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:00`;
};
let seq = 0;
const novoId = () => `p${++seq}`;

const pino = (cor: string, rotulo: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${cor};color:#fff;border:2px solid #fff;border-radius:999px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;font:600 11px Inter,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.35);padding:0 4px">${rotulo}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

function Enquadrar({ pontos }: { pontos: [number, number][] }) {
  const map = useMap();
  const chave = pontos.map((p) => p.join(",")).join(";");
  // O mapa monta antes da grade terminar de calcular a largura: sem isso só
  // parte dos ladrilhos aparece.
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  useEffect(() => {
    if (pontos.length) map.fitBounds(L.latLngBounds(pontos), { padding: [30, 30], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return null;
}

export default function RoteirizacaoReal() {
  const g = grupoAtivo();
  const qc = useQueryClient();
  const qs = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const viagemId = qs.get("viagem");
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [unitId, setUnitId] = useState<string>("");
  const [saida, setSaida] = useState(agoraLocal());
  const [eixos, setEixos] = useState(3);
  const [tarifa, setTarifa] = useState("");
  const [busca, setBusca] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [origemTxt, setOrigemTxt] = useState<string | null>(null);

  const pois = useQuery(escalaPoisQuery(g));
  const rotas = useQuery(escalaRotasQuery(g));
  const veiculos = useQuery(veiculosApiQuery());

  // Pontos de uma viagem da Escala (a conversa entre as duas ferramentas).
  useEffect(() => {
    if (!viagemId || !g) return;
    api.get<{ unit_id: number; saida_prevista: string; pontos: PontoPlano[]; codigo?: string }>(`/api/v1/escala-viagem/viagens/${viagemId}`)
      .then((v) => {
        setPontos(v.pontos.map((p) => ({ id: novoId(), nome: p.nome, latitude: p.latitude, longitude: p.longitude, parada_min: p.tipo === "origem" || p.tipo === "destino" ? 0 : 30, tipo: p.tipo })));
        setUnitId(String(v.unit_id));
        if (v.saida_prevista) setSaida(v.saida_prevista.slice(0, 16));
        setOrigemTxt(`Pontos da viagem ${v.codigo ?? viagemId} da Escala de Viagem.`);
      })
      .catch((e) => toast.error(mensagemErro(e)));
  }, [viagemId, g]);

  const sugestoes = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (b.length < 2) return [];
    return (pois.data ?? []).filter((p) => p.nome.toLowerCase().includes(b)).slice(0, 8);
  }, [busca, pois.data]);

  const calcular = async () => {
    if (!g || pontos.length < 2) return;
    setCalculando(true);
    try {
      const r = await api.post<Resultado>("/api/v1/roteirizacao/calcular", {
        group_id: Number(g), unit_id: unitId ? Number(unitId) : null, saida: saida.length === 16 ? `${saida}:00` : saida, eixos,
        tarifa_eixo: tarifa ? Number(tarifa.replace(",", ".")) : null,
        pontos: pontos.map(({ nome, latitude, longitude, parada_min }) => ({ nome, latitude, longitude, parada_min })),
      });
      setRes(r);
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setCalculando(false);
    }
  };

  // Recalcula sozinho quando os pontos mudam (com espera curta).
  const chave = JSON.stringify([pontos, unitId, saida, eixos, tarifa]);
  useEffect(() => {
    if (pontos.length < 2) { setRes(null); return; }
    const t = setTimeout(calcular, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const mover = (i: number, d: -1 | 1) => setPontos((ps) => {
    const n = [...ps];
    const j = i + d;
    if (j < 0 || j >= n.length) return ps;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  const otimizar = () => {
    if (pontos.length < 4) return;
    const paradas: Parada[] = pontos.map((p, i) => ({ id: p.id, nome: p.nome, lat: p.latitude, lng: p.longitude, paradaMin: p.parada_min, fixo: i === 0 ? "inicio" : i === pontos.length - 1 ? "fim" : undefined }));
    const r = rotaOtimizada(paradas);
    const porId = new Map(pontos.map((p) => [p.id, p]));
    setPontos(r.ordem.map((p) => porId.get(p.id)!));
    toast.success("Ordem das paradas otimizada (origem e destino mantidos)");
  };

  const salvarComoRota = async () => {
    if (!g || pontos.length < 2) return;
    const nome = window.prompt("Nome da rota padrão (a Escala de Viagem passa a oferecer esta rota):", `${pontos[0].nome} → ${pontos[pontos.length - 1].nome}`);
    if (!nome) return;
    try {
      await Escala.salvarRota({
        group_id: Number(g), nome,
        pontos: pontos.map((p, i) => ({ tipo: i === 0 ? "origem" : i === pontos.length - 1 ? "destino" : p.tipo && !["origem", "destino"].includes(p.tipo) ? p.tipo : "posto",
          nome: p.nome, latitude: p.latitude, longitude: p.longitude, raio_m: 300 })),
        destinatarios: [],
      });
      await qc.invalidateQueries({ queryKey: ["escala", "rotas"] });
      toast.success("Rota salva: já aparece na Escala de Viagem");
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  };

  if (!g) {
    return (
      <>
        <PageHeader title="Roteirização" subtitle="Rota, tempo, combustível e pedágio" />
        <p className="px-8 py-6 text-[13px] text-muted-foreground">Escolha uma empresa no topo do menu.</p>
      </>
    );
  }

  const linha: [number, number][] = res?.geometria ?? pontos.map((p) => [p.latitude, p.longitude]);
  const campo = "h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]";

  return (
    <div className="tema-denso">
      <PageHeader title="Roteirização" subtitle="Rota, tempo com as pausas da Lei do Motorista, combustível, custo e pedágio" />
      <main className="mx-auto grid max-w-[1760px] gap-4 px-4 py-4 md:px-6 lg:grid-cols-[420px_1fr]">
        <section className="space-y-3">
          {origemTxt && <p className="rounded-lg bg-brand-sky/10 px-3 py-2 text-[12px] text-brand-navy">{origemTxt}</p>}
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
              <label className="col-span-2 space-y-1"><span>Veículo (o km/L vem do histórico dele)</span>
                <select className={campo} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                  <option value="">Média da frota</option>
                  {(veiculos.data?.items ?? []).map((v) => <option key={v.id} value={v.id}>{[v.prefixo, v.placa].filter(Boolean).join(" · ")}</option>)}
                </select></label>
              <label className="space-y-1"><span>Saída</span><input type="datetime-local" className={campo} value={saida} onChange={(e) => setSaida(e.target.value)} /></label>
              <label className="space-y-1"><span>Eixos</span><input type="number" min={2} max={9} className={campo} value={eixos} onChange={(e) => setEixos(Number(e.target.value) || 2)} /></label>
              <label className="col-span-2 space-y-1"><span>Tarifa média de pedágio por eixo (R$, opcional)</span><input className={campo} inputMode="decimal" value={tarifa} onChange={(e) => setTarifa(e.target.value)} placeholder="padrão: R$ 8,00 (estimativa)" /></label>
              {(rotas.data?.length ?? 0) > 0 && (
                <label className="col-span-2 space-y-1"><span>Carregar rota padrão</span>
                  <select className={campo} value="" onChange={(e) => {
                    const r = rotas.data!.find((x) => String(x.id) === e.target.value);
                    if (r) setPontos(r.pontos.map((p) => ({ id: novoId(), nome: p.nome, latitude: p.latitude, longitude: p.longitude, parada_min: p.tipo === "origem" || p.tipo === "destino" ? 0 : 30, tipo: p.tipo })));
                  }}>
                    <option value="">—</option>
                    {rotas.data!.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                  </select></label>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold">Pontos da rota ({pontos.length})</p>
              <div className="flex gap-1">
                <button disabled={pontos.length < 4} onClick={otimizar} title="Reordena as paradas do meio pelo menor caminho" className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] disabled:opacity-40"><Sparkles className="h-3.5 w-3.5" /> Otimizar ordem</button>
                <button disabled={pontos.length < 2} onClick={salvarComoRota} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] disabled:opacity-40"><Save className="h-3.5 w-3.5" /> Salvar para a escala</button>
              </div>
            </div>
            <ol className="space-y-1.5">
              {pontos.map((p, i) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-[13px]">
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white", i === 0 ? "bg-leaf" : i === pontos.length - 1 ? "bg-coral" : "bg-brand-navy")}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate" title={p.nome}>{p.nome}</span>
                  {i > 0 && i < pontos.length - 1 && (
                    <input type="number" min={0} title="Minutos parado" aria-label={`Minutos parado em ${p.nome}`} value={p.parada_min}
                      onChange={(e) => setPontos((ps) => ps.map((x) => (x.id === p.id ? { ...x, parada_min: Number(e.target.value) || 0 } : x)))}
                      className="h-7 w-14 rounded border border-border px-1 text-right text-[12px]" />
                  )}
                  <button aria-label="Subir" onClick={() => mover(i, -1)} className="text-muted-foreground"><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button aria-label="Descer" onClick={() => mover(i, 1)} className="text-muted-foreground"><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button aria-label="Remover" onClick={() => setPontos((ps) => ps.filter((x) => x.id !== p.id))} className="text-muted-foreground hover:text-coral"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ol>
            <div className="relative mt-2">
              <Plus className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Adicionar ponto cadastrado (cliente, posto, base)…" className="h-9 w-full rounded-lg border border-border pl-8 pr-3 text-[13px]" />
              {sugestoes.length > 0 && (
                <ul className="absolute z-[500] mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                  {sugestoes.map((s) => (
                    <li key={s.id}><button className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-secondary" onClick={() => {
                      setPontos((ps) => [...ps, { id: novoId(), nome: s.nome, latitude: s.latitude, longitude: s.longitude, parada_min: ps.length ? 30 : 0 }]);
                      setBusca("");
                    }}>{s.nome}</button></li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">Ou clique no mapa para incluir um ponto. A primeira é a origem e a última, o destino.</p>
          </div>
        </section>

        <section className="space-y-3">
          <div className="h-[380px] overflow-hidden rounded-xl border border-border">
            <MapContainer center={[-19.92, -43.94]} zoom={6} className="h-full w-full" scrollWheelZoom>
              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <CliqueNoMapa onClique={(lat, lng) => setPontos((ps) => [...ps, { id: novoId(), nome: `Ponto ${lat.toFixed(4)}, ${lng.toFixed(4)}`, latitude: lat, longitude: lng, parada_min: ps.length ? 30 : 0 }])} />
              {linha.length > 1 && <Polyline positions={linha} pathOptions={{ color: "#1d4ed8", weight: 4, opacity: 0.8, dashArray: res?.geometria ? undefined : "8 6" }} />}
              {pontos.map((p, i) => (
                <Marker key={p.id} position={[p.latitude, p.longitude]} icon={pino(i === 0 ? "#2e7d32" : i === pontos.length - 1 ? "#d84a3a" : "#16325c", String(i + 1))}>
                  <Tooltip>{p.nome}</Tooltip>
                </Marker>
              ))}
              <Enquadrar pontos={pontos.map((p) => [p.latitude, p.longitude])} />
            </MapContainer>
          </div>

          {pontos.length < 2 ? (
            <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-[13px] text-muted-foreground">Inclua a origem e o destino para calcular.</p>
          ) : !res ? (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculando…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Kpi icone={Route} rotulo="Distância" valor={`${nf(res.km_total)} km`} sub={res.fonte_rota} />
                <Kpi icone={Clock} rotulo="Tempo total" valor={hhmm(res.duracao_total_min)} sub={`${hhmm(res.conducao_min)} dirigindo + ${hhmm(res.pausas_min)} de pausas legais + ${hhmm(res.paradas_min)} em paradas`} />
                <Kpi icone={MapPin} rotulo="Chegada prevista" valor={quando(res.chegada)} sub={`saída ${quando(res.saida)}`} />
                <Kpi icone={Fuel} rotulo="Combustível" valor={`${nf(res.combustivel.litros)} L`} sub={`${nf(res.combustivel.kml, 2)} km/L (${res.combustivel.fonte_kml})`} />
                <Kpi icone={Wallet} rotulo="Custo estimado" valor={res.combustivel.custo != null ? BRL.format(res.combustivel.custo + (res.pedagio.valor ?? 0)) : "—"}
                  sub={`diesel ${res.combustivel.preco_litro != null ? BRL.format(res.combustivel.preco_litro) : "—"}/L (${res.combustivel.fonte_preco ?? "sem preço"})${res.pedagio.valor != null ? ` + pedágio ${BRL.format(res.pedagio.valor)}` : ""}`} />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="mb-2 text-[13px] font-semibold">Programação da viagem ({res.operacao === "carga" ? "regras de carga" : "regras de passageiros"})</p>
                  <ol className="space-y-1.5 text-[13px]">
                    {res.agenda.map((a, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate"><b>{i + 1}.</b> {a.ponto}</span>
                        <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{a.chegada ? `chega ${quando(a.chegada)}` : ""}{a.saida ? ` · sai ${quando(a.saida)}` : ""}</span>
                      </li>
                    ))}
                  </ol>
                  {res.pausas.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-border pt-2 text-[12px]">
                      {res.pausas.map((p, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          {p.tipo === "descanso" ? <Moon className="mt-0.5 h-3.5 w-3.5 text-brand-navy" /> : <Coffee className="mt-0.5 h-3.5 w-3.5 text-gold" />}
                          <span>{p.tipo === "descanso" ? "Descanso de 11 h" : "Pausa de 30 min"} em {quando(p.quando)}, no trecho {p.trecho}. <span className="text-muted-foreground">{p.regra}</span></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="mb-2 text-[13px] font-semibold">Trechos e pedágio</p>
                  <table className="w-full text-[13px]">
                    <tbody className="divide-y divide-border">
                      {res.trechos.map((t, i) => (
                        <tr key={i}><td className="py-1 pr-2">{t.de} → {t.para}</td><td className="py-1 text-right tabular-nums">{nf(t.km)} km</td><td className="py-1 pl-2 text-right tabular-nums">{hhmm(t.conducao_min)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 border-t border-border pt-2 text-[12px]">
                    {res.pedagio.base_disponivel ? (
                      <>
                        <p>
                          <b>{res.pedagio.pracas.length} praças</b> de rodovias federais no caminho
                          {res.pedagio.valor != null && <> · <b>{BRL.format(res.pedagio.valor)}</b> para {res.pedagio.eixos} eixos</>}
                          {res.pedagio.pracas.length ? `: ${res.pedagio.pracas.map((p) => `${p.nome} (${p.rodovia}/${p.uf})`).join(", ")}` : ""}.
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {res.pedagio.tarifa_estimada ? `Estimativa com R$ ${nf(res.pedagio.tarifa_eixo, 2)} por eixo por praça (a tarifa de cada praça não é dado aberto); informe a tarifa média acima se souber. ` : ""}
                          Conta só praças federais (ANTT); pedágios estaduais e o Free Flow da Dutra ficam de fora.
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">{res.pedagio.observacao} Para o valor exato por eixo, a recomendação é ligar um serviço de rotas com pedágio (Amazon Location Service ou QualP).</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          {calculando && res && <p className="text-[12px] text-muted-foreground">Recalculando…</p>}
        </section>
      </main>
    </div>
  );
}

function CliqueNoMapa({ onClique }: { onClique: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const f = (e: L.LeafletMouseEvent) => onClique(e.latlng.lat, e.latlng.lng);
    map.on("click", f);
    return () => { map.off("click", f); };
  }, [map, onClique]);
  return null;
}

function Kpi({ icone: I, rotulo, valor, sub }: { icone: typeof Route; rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground"><I className="h-3.5 w-3.5" /> {rotulo}</p>
      <p className="text-[20px] font-semibold leading-tight tabular-nums">{valor}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
