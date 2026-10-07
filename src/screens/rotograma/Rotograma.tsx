import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Coffee,
  Download,
  Fuel,
  Gauge,
  Loader2,
  MapPin,
  ShieldAlert,
  Ticket,
  TriangleAlert,
  X,
} from "lucide-react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { SSOrb } from "@/components/ss/brand/SSOrb";
import { api } from "@/lib/api";
import {
  CHAVE_ROTOGRAMA,
  ROTULO_NIVEL,
  type ItemRotograma,
  type NivelRisco,
} from "@/lib/rotas-seguras-api";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Rotograma (pedido do CEO, 06/10/2026): o documento da rota que o motorista
 * leva — o que ele vai encontrar trecho a trecho, em ordem de quilômetro.
 * Sai na tela e em PDF (Baixar PDF = imprimir como PDF do navegador), para um
 * cliente ou para todos; sem assinatura do motorista (PM, 06/10/2026).
 *
 * Recebe o mesmo pedido da roteirização, guardado no navegador pela aba que
 * abriu esta.
 */

type Resposta = {
  rota: {
    km_total: number;
    conducao_min: number;
    duracao_total_min: number;
    saida: string;
    chegada: string;
    fonte_rota: string;
    operacao: "carga" | "passageiros";
    trechos: { de: string; para: string; km: number; conducao_min: number }[];
    combustivel: { litros: number | null; kml: number };
    pedagio: { valor: number | null; pracas: unknown[] };
    areas_risco: {
      nome: string;
      nivel: NivelRisco;
      na_rota: boolean;
      dist_m: number;
      poligonos: [number, number][][];
    }[];
    aviso_risco: string | null;
  };
  itens: ItemRotograma[];
  linha: [number, number][];
  veiculo: string | null;
  gerado_em: string;
  estimada: boolean;
  observacoes: string[];
};

const TIPO: Record<ItemRotograma["tipo"], { rotulo: string; cor: string; I: typeof Gauge }> = {
  area_risco: { rotulo: "Área de risco", cor: "#d84a3a", I: ShieldAlert },
  atencao: { rotulo: "Atenção", cor: "#d4a017", I: TriangleAlert },
  critico: { rotulo: "Ponto crítico", cor: "#e07a1f", I: AlertTriangle },
  velocidade: { rotulo: "Velocidade", cor: "#16325c", I: Gauge },
  pedagio: { rotulo: "Pedágio", cor: "#5b6b82", I: Ticket },
  pausa: { rotulo: "Pausa", cor: "#2e7d32", I: Coffee },
  apoio: { rotulo: "Apoio", cor: "#1d7fb8", I: Fuel },
};

const nf = (v: number | null | undefined, c = 0) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const hhmm = (min: number) =>
  `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;
const quando = (s: string | null) =>
  s
    ? new Date(s).toLocaleString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const marcador = (n: number, cor: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${cor};color:#fff;border:2px solid #fff;border-radius:999px;min-width:20px;height:20px;display:flex;align-items:center;justify-content:center;font:700 10px Inter,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.4);padding:0 3px">${n}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

function Enquadrar({ linha }: { linha: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize();
      if (linha.length) map.fitBounds(L.latLngBounds(linha), { padding: [20, 20] });
    }, 200);
    return () => clearTimeout(t);
  }, [map, linha]);
  return null;
}

export default function Rotograma() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pedido = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(CHAVE_ROTOGRAMA) ?? "null") as {
        pontos: { nome: string }[];
      } | null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!pedido) {
      setErro("Abra o rotograma pela Roteirização (botão “Rotograma”).");
      return;
    }
    api
      .post<Resposta>("/api/v1/roteirizacao/rotograma", pedido)
      .then(setDados)
      .catch((e) => setErro(mensagemErro(e)));
  }, [pedido]);

  if (erro)
    return (
      <div className="flex h-screen items-center justify-center p-6 text-center text-[14px] text-coral">
        {erro}
      </div>
    );
  if (!dados)
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-[14px] text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Montando o rotograma…
      </div>
    );

  const r = dados.rota;
  const origem = pedido?.pontos[0]?.nome ?? "Origem";
  const destino = pedido?.pontos[pedido.pontos.length - 1]?.nome ?? "Destino";
  const noMapa = dados.itens.filter((x) => x.lat != null && x.lng != null);
  const numero = new Map(noMapa.map((x, i) => [x, i + 1]));
  const contagem = (t: ItemRotograma["tipo"]) => dados.itens.filter((x) => x.tipo === t).length;

  return (
    <div className="min-h-screen bg-background text-foreground print:bg-white">
      <div className="mx-auto max-w-[1000px] px-4 py-4 print:max-w-none print:p-0">
        <div className="mb-3 flex items-center justify-end gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-[13px] font-semibold text-white"
          >
            <Download className="h-4 w-4" /> Baixar PDF
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-[13px]"
          >
            <X className="h-4 w-4" /> Fechar
          </button>
        </div>

        <header className="flex items-start gap-3 border-b-2 border-brand-navy pb-3">
          <SSOrb size={36} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-muted-foreground">
              Rotograma
            </p>
            <h1 className="text-[22px] font-bold leading-tight">
              {origem} → {destino}
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {dados.veiculo ? `Veículo ${dados.veiculo} · ` : ""}saída {quando(r.saida)} · chegada
              prevista {quando(r.chegada)}
            </p>
          </div>
          <p className="text-right text-[11px] text-muted-foreground">
            gerado em
            <br />
            {quando(dados.gerado_em)}
          </p>
        </header>

        <section className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Distância", `${nf(r.km_total)} km`],
            ["Tempo total", hhmm(r.duracao_total_min)],
            ["Dirigindo", hhmm(r.conducao_min)],
            ["Pontos de atenção", nf(dados.itens.length)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{k}</p>
              <p className="text-[18px] font-semibold tabular-nums">{v}</p>
            </div>
          ))}
        </section>

        {r.aviso_risco && (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-coral bg-coral-tint px-3 py-2 text-[13px] font-semibold">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" /> {r.aviso_risco}
          </p>
        )}

        <section className="mt-3 h-[380px] overflow-hidden rounded-lg border border-border print:h-[330px] print:break-inside-avoid">
          <MapContainer
            center={dados.linha[0] ?? [-19.92, -43.94]}
            zoom={8}
            className="h-full w-full"
            zoomControl={false}
            preferCanvas={false}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {r.areas_risco.map((a, i) =>
              a.poligonos.map((pol, j) => (
                <Polygon
                  key={`a${i}-${j}`}
                  positions={pol}
                  pathOptions={{
                    color: a.nivel === "evitar" ? "#d84a3a" : "#d4a017",
                    weight: 2,
                    fillOpacity: 0.3,
                  }}
                >
                  <Tooltip>
                    {a.nome} · {ROTULO_NIVEL[a.nivel]}
                  </Tooltip>
                </Polygon>
              )),
            )}
            <Polyline
              positions={dados.linha}
              pathOptions={{
                color: "#1d4ed8",
                weight: 4,
                dashArray: dados.estimada ? "8 6" : undefined,
              }}
            />
            {noMapa.map((x) => (
              <Marker
                key={`${x.tipo}${x.km}${x.titulo}`}
                position={[x.lat!, x.lng!]}
                icon={marcador(numero.get(x)!, TIPO[x.tipo].cor)}
              >
                <Tooltip>
                  km {nf(x.km, 1)} · {x.titulo}
                </Tooltip>
              </Marker>
            ))}
            <Enquadrar linha={dados.linha} />
          </MapContainer>
        </section>

        <section className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
          {(Object.keys(TIPO) as ItemRotograma["tipo"][])
            .filter((t) => contagem(t))
            .map((t) => {
              const { rotulo, cor, I } = TIPO[t];
              return (
                <span key={t} className="inline-flex items-center gap-1">
                  <I className="h-3.5 w-3.5" style={{ color: cor }} /> {rotulo}{" "}
                  <b className="text-foreground">{contagem(t)}</b>
                </span>
              );
            })}
        </section>

        <section className="mt-3">
          <h2 className="mb-1 text-[15px] font-semibold">O que o motorista vai encontrar</h2>
          {dados.itens.length === 0 ? (
            <p className="rounded-lg border border-border px-3 py-4 text-[13px] text-muted-foreground">
              Nenhum ponto de atenção cadastrado ou registrado neste caminho.
            </p>
          ) : (
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="w-16 py-1.5 pr-2">km</th>
                  <th className="w-8 py-1.5" />
                  <th className="py-1.5">Atenção</th>
                </tr>
              </thead>
              <tbody>
                {dados.itens.map((x, i) => {
                  const { cor, I, rotulo } = TIPO[x.tipo];
                  return (
                    <tr
                      key={i}
                      className={cn(
                        "border-b border-border align-top print:break-inside-avoid",
                        x.tipo === "area_risco" && "bg-coral-tint/60",
                      )}
                    >
                      <td className="py-1.5 pr-2 font-mono tabular-nums">{nf(x.km, 1)}</td>
                      <td className="py-1.5">
                        {numero.has(x) ? (
                          <span
                            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                            style={{ background: cor }}
                          >
                            {numero.get(x)}
                          </span>
                        ) : (
                          <I className="h-4 w-4" style={{ color: cor }} />
                        )}
                      </td>
                      <td className="py-1.5">
                        <b>{x.titulo}</b>{" "}
                        <span className="text-[11px] text-muted-foreground">· {rotulo}</span>
                        {x.detalhe && (
                          <span className="block text-[12px] text-muted-foreground">
                            {x.detalhe}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="mt-3 print:break-inside-avoid">
          <h2 className="mb-1 text-[15px] font-semibold">Trechos</h2>
          <table className="w-full text-[13px]">
            <tbody className="divide-y divide-border">
              {r.trechos.map((t, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2">
                    <MapPin className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />
                    {t.de} → {t.para}
                  </td>
                  <td className="py-1 text-right tabular-nums">{nf(t.km, 1)} km</td>
                  <td className="py-1 pl-2 text-right tabular-nums">{hhmm(t.conducao_min)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="mt-4 space-y-0.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
          <p>
            Caminho: {r.fonte_rota}. Pausas pelas regras de{" "}
            {r.operacao === "carga" ? "carga" : "passageiros"} (CTB 67-C e CLT 235-C).
          </p>
          {dados.observacoes.map((o) => (
            <p key={o}>{o}</p>
          ))}
          <p>SS Telemática · documento de orientação ao motorista.</p>
        </footer>
      </div>
    </div>
  );
}
