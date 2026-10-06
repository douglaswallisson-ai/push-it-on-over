import { Fragment, useEffect, useRef, useState } from "react";
import { Circle, CircleMarker, Polygon, Polyline, Tooltip, useMap } from "react-leaflet";
import { api } from "@/lib/api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { usandoMock } from "@/lib/modo";

/**
 * Cercas e pontos de interesse (POIs) cadastrados pelo cliente, desenhados
 * sobre o mapa. Busca só o que está na área visível e recarrega quando o
 * usuário arrasta ou dá zoom (com uma pequena espera, para não disparar a cada
 * movimento).
 *
 * Com o mapa afastado (abaixo do zoom 10):
 * - empresa escolhida → as cercas vêm mesmo assim, com o desenho simplificado,
 *   e cada uma ganha um ponto no centro (uma cerca de 300 m some no zoom 5).
 *   Antes não vinha nada e a CECOTI, com ~680 cercas espalhadas por três
 *   estados, nunca via as cercas: o mapa abre no zoom 5 para caber a frota;
 * - pontos de interesse (milhares) e "todas as empresas" continuam pedindo zoom.
 */

export type PoiCamada = {
  id: number;
  nome: string;
  lat: number;
  lon: number;
  raio: number | null;
  cor: string | null;
  descricao: string | null;
};
export type CercaCamada = {
  id: number;
  nome: string;
  tipo: "circular" | "poligono" | "linha";
  cor: string | null;
  raio: number | null;
  velocidade_max: number | null;
  descricao: string | null;
  lat: number | null;
  lon: number | null;
  /** Já em [latitude, longitude]. */
  pontos: [number, number][][] | null;
};
type Resposta = { pois: PoiCamada[]; cercas: CercaCamada[]; truncado: boolean };

export type CamadasVisiveis = { pois: boolean; cercas: boolean };

/** Abaixo deste zoom a área é grande demais para desenhar as camadas. */
export const ZOOM_MINIMO_CAMADAS = 10;

/** Abaixo deste zoom cada cerca ganha um ponto no centro. */
const ZOOM_MARCA_CERCA = 12;

function centroDa(c: CercaCamada): [number, number] | null {
  if (c.tipo === "circular") return c.lat && c.lon ? [c.lat, c.lon] : null;
  const anel = c.pontos?.[0];
  if (!anel?.length) return null;
  const [la, lo] = anel.reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
  return [la / anel.length, lo / anel.length];
}

function cor(c: string | null | undefined, padrao: string) {
  if (!c) return padrao;
  const v = c.trim();
  if (/^#?[0-9a-f]{6}$/i.test(v)) return v.startsWith("#") ? v : `#${v}`;
  return padrao;
}

export function CamadasMapa({
  visiveis,
  onEstado,
}: {
  visiveis: CamadasVisiveis;
  onEstado?: (e: { carregando: boolean; longe: boolean; truncado: boolean; erro: boolean }) => void;
}) {
  const map = useMap();
  const [dados, setDados] = useState<Resposta>({ pois: [], cercas: [], truncado: false });
  const pedido = useRef(0);
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    if (usandoMock() || (!visiveis.pois && !visiveis.cercas)) {
      setDados({ pois: [], cercas: [], truncado: false });
      return;
    }
    let espera: ReturnType<typeof setTimeout> | undefined;
    const carregar = () => {
      const z = map.getZoom();
      setZoom(z);
      const grupo = grupoAtivo();
      const perto = z >= ZOOM_MINIMO_CAMADAS;
      const pedirCercas = visiveis.cercas && (perto || Boolean(grupo));
      const pedirPois = visiveis.pois && perto;
      // "longe" = algo ligado que só aparece aproximando.
      const longe = (visiveis.pois && !perto) || (visiveis.cercas && !perto && !grupo);
      if (!pedirCercas && !pedirPois) {
        setDados({ pois: [], cercas: [], truncado: false });
        onEstado?.({ carregando: false, longe, truncado: false, erro: false });
        return;
      }
      const b = map.getBounds().pad(0.2);
      const qs = new URLSearchParams({
        min_lat: b.getSouth().toFixed(5),
        min_lon: b.getWest().toFixed(5),
        max_lat: b.getNorth().toFixed(5),
        max_lon: b.getEast().toFixed(5),
        pois: String(pedirPois),
        cercas: String(pedirCercas),
        tolerancia: z >= ZOOM_MINIMO_CAMADAS ? "0.00003" : z >= 7 ? "0.0003" : "0.001",
      });
      if (grupo) qs.set("group_id", grupo);
      const meu = ++pedido.current;
      onEstado?.({ carregando: true, longe: false, truncado: false, erro: false });
      api
        .get<Resposta>(`/api/v1/mapa/camadas?${qs}`)
        .then((r) => {
          if (meu !== pedido.current) return;
          setDados(r);
          onEstado?.({ carregando: false, longe, truncado: r.truncado, erro: false });
        })
        .catch(() => {
          if (meu === pedido.current)
            onEstado?.({ carregando: false, longe: false, truncado: false, erro: true });
        });
    };
    const agendar = () => {
      clearTimeout(espera);
      espera = setTimeout(carregar, 400);
    };
    agendar();
    map.on("moveend", agendar);
    return () => {
      clearTimeout(espera);
      map.off("moveend", agendar);
    };
  }, [map, visiveis.pois, visiveis.cercas]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {visiveis.cercas &&
        dados.cercas.map((c) => {
          const tom = cor(c.cor, "#2E86C1");
          const estilo = {
            color: tom,
            weight: 2,
            opacity: 0.85,
            fillColor: tom,
            fillOpacity: 0.12,
            dashArray: "6 4",
          };
          const dica = (
            <Tooltip sticky>
              <span className="font-semibold">Cerca: {c.nome || "sem nome"}</span>
              {c.velocidade_max ? ` · máx. ${c.velocidade_max} km/h` : ""}
            </Tooltip>
          );
          const centro = centroDa(c);
          // Mapa afastado: a forma vira um ponto, para a cerca não sumir.
          const marca =
            zoom < ZOOM_MARCA_CERCA && centro ? (
              <CircleMarker
                key={`m${c.id}`}
                center={centro}
                radius={4}
                pathOptions={{ color: "#ffffff", weight: 1, fillColor: tom, fillOpacity: 0.9 }}
              >
                {dica}
              </CircleMarker>
            ) : null;
          if (c.tipo === "circular" && c.lat && c.lon && c.raio)
            return (
              <Fragment key={`c${c.id}`}>
                <Circle center={[c.lat, c.lon]} radius={c.raio} pathOptions={estilo}>
                  {dica}
                </Circle>
                {marca}
              </Fragment>
            );
          if (c.tipo === "linha" && c.pontos?.length)
            return (
              <Fragment key={`c${c.id}`}>
                <Polyline positions={c.pontos} pathOptions={{ ...estilo, weight: 4 }}>
                  {dica}
                </Polyline>
                {marca}
              </Fragment>
            );
          if (c.pontos?.length)
            return (
              <Fragment key={`c${c.id}`}>
                <Polygon positions={c.pontos} pathOptions={estilo}>
                  {dica}
                </Polygon>
                {marca}
              </Fragment>
            );
          return null;
        })}
      {visiveis.pois &&
        dados.pois.map((p) => {
          const tom = cor(p.cor, "#7B4FBF");
          return (
            <Fragment key={`p${p.id}`}>
              {p.raio ? (
                <Circle
                  center={[p.lat, p.lon]}
                  radius={p.raio}
                  pathOptions={{
                    color: tom,
                    weight: 1,
                    opacity: 0.6,
                    fillColor: tom,
                    fillOpacity: 0.08,
                  }}
                  interactive={false}
                />
              ) : null}
              <CircleMarker
                center={[p.lat, p.lon]}
                radius={5}
                pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: tom, fillOpacity: 1 }}
              >
                <Tooltip direction="top" offset={[0, -4]}>
                  <span className="font-semibold">Ponto: {p.nome || "sem nome"}</span>
                  {p.raio ? ` · raio ${p.raio} m` : ""}
                </Tooltip>
              </CircleMarker>
            </Fragment>
          );
        })}
    </>
  );
}
