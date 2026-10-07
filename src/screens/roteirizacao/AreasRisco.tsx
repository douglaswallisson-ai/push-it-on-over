import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Pencil, Search, ShieldAlert, Trash2, Undo2, X } from "lucide-react";
import { MapContainer, Polygon, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import {
  areasRiscoQuery,
  cercasParaMarcarQuery,
  COR_NIVEL,
  ROTULO_NIVEL,
  RotasSeguras,
  type AreaRisco,
  type NivelRisco,
} from "@/lib/rotas-seguras-api";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Áreas de risco do cliente (PM/CEO, 06/10/2026): a roteirização desvia delas,
 * o rotograma mostra as que ficam perto da rota e o CCO avisa quando um
 * veículo entra numa área "Evitar".
 *
 * Três origens: cercas do sistema atual com a categoria "Área de Risco",
 * cercas existentes marcadas aqui e áreas desenhadas aqui (clicando no mapa).
 */

const ROTULO_ORIGEM = {
  categoria: "categoria da cerca",
  marcada: "cerca marcada aqui",
  desenhada: "desenhada aqui",
};

function Enquadrar({ poligonos }: { poligonos: [number, number][][] }) {
  const map = useMap();
  const chave = poligonos.length ? `${poligonos.length}:${poligonos[0][0]?.join(",")}` : "";
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  useEffect(() => {
    const pts = poligonos.flat();
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return null;
}

function Desenho({ ativo, onPonto }: { ativo: boolean; onPonto: (p: [number, number]) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!ativo) return;
    const f = (e: L.LeafletMouseEvent) => onPonto([e.latlng.lat, e.latlng.lng]);
    map.on("click", f);
    map.getContainer().style.cursor = "crosshair";
    return () => {
      map.off("click", f);
      map.getContainer().style.cursor = "";
    };
  }, [map, ativo, onPonto]);
  return null;
}

export function AreasRisco({ grupo }: { grupo: string }) {
  const qc = useQueryClient();
  const areasQ = useQuery(areasRiscoQuery(grupo));
  const cercasQ = useQuery(cercasParaMarcarQuery(grupo));
  const areas = useMemo(() => areasQ.data?.data ?? [], [areasQ.data]);
  const [desenhando, setDesenhando] = useState(false);
  const [rascunho, setRascunho] = useState<[number, number][]>([]);
  const [form, setForm] = useState<{ nome: string; nivel: NivelRisco; motivo: string }>({
    nome: "",
    nivel: "evitar",
    motivo: "",
  });
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");
  const [foco, setFoco] = useState<[number, number][][] | null>(null);

  const recarregar = () => qc.invalidateQueries({ queryKey: ["areas-risco"] });

  const cercas = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (b.length < 2) return [];
    return (cercasQ.data?.data ?? []).filter((c) => c.nome.toLowerCase().includes(b)).slice(0, 40);
  }, [busca, cercasQ.data]);

  const salvarDesenho = async () => {
    if (rascunho.length < 3 || form.nome.trim().length < 2) return;
    setSalvando(true);
    try {
      await RotasSeguras.criarArea({
        group_id: Number(grupo),
        nome: form.nome.trim(),
        nivel: form.nivel,
        motivo: form.motivo || undefined,
        pontos: rascunho,
      });
      toast.success("Área de risco salva. A roteirização e o CCO já passam a considerar.");
      setRascunho([]);
      setDesenhando(false);
      setForm({ nome: "", nivel: "evitar", motivo: "" });
      await recarregar();
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (a: AreaRisco) => {
    try {
      if (a.origem === "desenhada" && a.area_id) await RotasSeguras.removerArea(a.area_id);
      else if (a.origem === "marcada" && a.cerca_id)
        await RotasSeguras.marcarCerca(a.cerca_id, Number(grupo), null);
      toast.success("Área retirada");
      await recarregar();
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  };

  const marcar = async (cercaId: number, nivel: NivelRisco | null) => {
    try {
      await RotasSeguras.marcarCerca(cercaId, Number(grupo), nivel);
      toast.success(nivel ? `Cerca marcada como "${ROTULO_NIVEL[nivel]}"` : "Cerca desmarcada");
      await recarregar();
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  };

  const campo = "h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]";
  const todas = areas.flatMap((a) => a.poligonos);

  return (
    <main className="mx-auto grid max-w-[1760px] gap-4 px-4 py-4 md:px-6 lg:grid-cols-[400px_1fr]">
      <section className="space-y-3">
        <p className="rounded-lg bg-brand-sky/10 px-3 py-2 text-[12px] text-brand-navy">
          <b>Evitar:</b> a roteirização desvia (quando o motor de rotas estiver ligado) e o CCO
          avisa na hora quando um veículo entra. <b>Atenção:</b> só aparece no rotograma, como ponto
          de cuidado.
        </p>

        <div className="rounded-xl border border-border bg-card p-3">
          {!desenhando ? (
            <button
              type="button"
              onClick={() => {
                setDesenhando(true);
                setRascunho([]);
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-[13px] font-semibold text-white"
            >
              <Pencil className="h-4 w-4" /> Desenhar nova área de risco
            </button>
          ) : (
            <div className="space-y-2 text-[12px]">
              <p className="font-semibold text-foreground">
                Clique no mapa para marcar os cantos da área ({rascunho.length} pontos).
              </p>
              <input
                className={campo}
                placeholder="Nome (ex.: Comunidade X, trecho de roubo de carga)"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                aria-label="Nome da área"
              />
              <div className="flex gap-2">
                <select
                  className={campo}
                  value={form.nivel}
                  onChange={(e) => setForm((f) => ({ ...f, nivel: e.target.value as NivelRisco }))}
                  aria-label="Nível"
                >
                  <option value="evitar">Evitar (desvia e avisa no CCO)</option>
                  <option value="atencao">Atenção (só no rotograma)</option>
                </select>
              </div>
              <input
                className={campo}
                placeholder="Motivo (opcional)"
                value={form.motivo}
                onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                aria-label="Motivo"
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={!rascunho.length}
                  onClick={() => setRascunho((r) => r.slice(0, -1))}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 disabled:opacity-40"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Desfazer ponto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDesenhando(false);
                    setRascunho([]);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1"
                >
                  <X className="h-3.5 w-3.5" /> Cancelar
                </button>
                <button
                  type="button"
                  disabled={salvando || rascunho.length < 3 || form.nome.trim().length < 2}
                  onClick={salvarDesenho}
                  className="ml-auto inline-flex items-center gap-1 rounded-md bg-brand-navy px-3 py-1 font-semibold text-white disabled:opacity-40"
                >
                  {salvando ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}{" "}
                  Salvar área
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <p className="mb-2 text-[13px] font-semibold">Marcar uma cerca existente como risco</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Buscar entre ${(cercasQ.data?.data ?? []).length} cercas do cliente…`}
              className={cn(campo, "pl-8")}
              aria-label="Buscar cerca"
            />
          </div>
          {cercas.length > 0 && (
            <ul className="mt-1 max-h-72 space-y-1 overflow-y-auto">
              {cercas.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-[12px]"
                  onMouseEnter={() => setFoco(c.poligonos)}
                >
                  <button
                    type="button"
                    onClick={() => setFoco(c.poligonos)}
                    className="min-w-0 flex-1 truncate text-left"
                    title={c.nome}
                  >
                    {c.nome}{" "}
                    <span className="text-muted-foreground">· {c.categoria ?? c.tipo}</span>
                  </button>
                  {c.por_categoria ? (
                    <span className="text-[11px] text-muted-foreground">risco pela categoria</span>
                  ) : (
                    <select
                      value={c.nivel ?? ""}
                      onChange={(e) => marcar(c.id, (e.target.value || null) as NivelRisco | null)}
                      className="h-7 rounded border border-border bg-white px-1 text-[12px]"
                      aria-label={`Nível de ${c.nome}`}
                    >
                      <option value="">Não é risco</option>
                      <option value="evitar">Evitar</option>
                      <option value="atencao">Atenção</option>
                    </select>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-3">
          <p className="mb-2 text-[13px] font-semibold">
            Áreas de risco do cliente ({areas.length})
          </p>
          {areasQ.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {areasQ.error && <p className="text-[12px] text-coral">{mensagemErro(areasQ.error)}</p>}
          {!areasQ.isPending && !areas.length && (
            <p className="text-[12px] text-muted-foreground">
              Nenhuma área ainda. Desenhe uma ou marque uma cerca.
            </p>
          )}
          <ul className="space-y-1">
            {areas.map((a) => (
              <li
                key={a.chave}
                className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-[12px]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: COR_NIVEL[a.nivel] }}
                />
                <button
                  type="button"
                  onClick={() => setFoco(a.poligonos)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate font-medium text-foreground">{a.nome}</span>
                  <span className="block truncate text-muted-foreground">
                    {ROTULO_NIVEL[a.nivel]} · {ROTULO_ORIGEM[a.origem]}
                    {a.motivo ? ` · ${a.motivo}` : ""}
                  </span>
                </button>
                {a.origem !== "categoria" && (
                  <button
                    type="button"
                    onClick={() => remover(a)}
                    aria-label={`Retirar ${a.nome}`}
                    title="Retirar"
                    className="text-muted-foreground hover:text-coral"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Marcações e áreas desenhadas ficam no armazenamento provisório da plataforma nova até a
            engenharia criar a tabela definitiva.
          </p>
        </div>
      </section>

      <section className="h-[calc(100vh-180px)] min-h-[420px] overflow-hidden rounded-xl border border-border">
        <MapContainer center={[-19.92, -43.94]} zoom={6} className="h-full w-full" scrollWheelZoom>
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {areas.map((a) =>
            a.poligonos.map((pol, i) => (
              <Polygon
                key={`${a.chave}-${i}`}
                positions={pol}
                pathOptions={{ color: COR_NIVEL[a.nivel], weight: 2, fillOpacity: 0.25 }}
              >
                <Tooltip>
                  {a.nome} · {ROTULO_NIVEL[a.nivel]}
                </Tooltip>
              </Polygon>
            )),
          )}
          {foco?.map((pol, i) => (
            <Polygon
              key={`f${i}`}
              positions={pol}
              pathOptions={{ color: "#16325c", weight: 3, dashArray: "6 4", fillOpacity: 0.05 }}
            />
          ))}
          {rascunho.length > 0 && (
            <Polygon
              positions={rascunho}
              pathOptions={{
                color: COR_NIVEL[form.nivel],
                weight: 3,
                dashArray: "4 4",
                fillOpacity: 0.2,
              }}
            />
          )}
          <Desenho ativo={desenhando} onPonto={(p) => setRascunho((r) => [...r, p])} />
          <Enquadrar poligonos={foco ?? todas} />
        </MapContainer>
        {!areas.length && !desenhando && (
          <p className="pointer-events-none relative -mt-10 ml-3 inline-flex items-center gap-1 rounded bg-white/90 px-2 py-1 text-[12px] text-muted-foreground shadow">
            <MapPin className="h-3.5 w-3.5" /> Desenhe a primeira área clicando em "Desenhar nova
            área de risco".
          </p>
        )}
      </section>
    </main>
  );
}
