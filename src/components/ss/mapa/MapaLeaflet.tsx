import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Contrato próprio do mapa, em vez de `PosicaoVeiculo` cru.
 *
 * A tela já deriva situação, rótulo e "há quanto tempo" para a lista lateral;
 * repetir essa derivação aqui abriria espaço para o marcador e a lista
 * discordarem sobre o mesmo veículo.
 */
export type VeiculoMapa = {
  placa: string;
  rotulo: string;
  lat: number;
  lng: number;
  situacao: string;
  velocidade: number;
  endereco?: string;
  atualizado?: string;
  motorista?: string;
};

/**
 * Mapa real, com Leaflet sobre tiles do OpenStreetMap.
 *
 * Substitui o canvas decorativo que desenhava "rodovias" em SVG e posicionava
 * marcadores por coordenada convertida — bonito, mas não era mapa: não dava
 * para saber em que rua o veículo estava.
 *
 * OSM foi escolhido para validar por não exigir chave nem cartão. Google Maps e
 * Mapbox cobrem melhor vias secundárias no Brasil, e a troca é localizada: só
 * o `TileLayer` muda.
 *
 * Cuidados que o Leaflet exige e não são óbvios:
 *
 * - Ele mede o container no momento da montagem. Dentro de aba ou painel que
 *   começa oculto, o mapa nasce com altura zero e fica cinza — daí o
 *   `invalidateSize` no efeito.
 * - Os ícones padrão vêm de URLs relativas que o bundler não resolve. Aqui os
 *   marcadores são `divIcon` com HTML próprio, o que também evita baixar PNG.
 */

/** Centro padrão: São Paulo, usado quando não há veículo posicionado. */
const CENTRO_PADRAO: [number, number] = [-23.5505, -46.6333];

const COR_SITUACAO: Record<string, string> = {
  em_rota: "#5a9a3c",
  parado: "#b5590c",
  manutencao: "#2E86C1",
  sem_sinal: "#c0392b",
};

/** Marcador com o prefixo dentro, para o operador ler sem clicar. */
function iconeVeiculo(rotulo: string, cor: string, selecionado: boolean) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        display:flex;align-items:center;gap:4px;
        background:#fff;border:2px solid ${cor};
        border-radius:999px;padding:2px 7px;
        font:700 11px/1.1 ui-monospace,monospace;color:#1f2d3d;
        box-shadow:0 2px 6px rgba(0,0,0,.25);
        ${selecionado ? "outline:3px solid rgba(46,134,193,.45);outline-offset:2px;" : ""}
        white-space:nowrap;
      ">
        <span style="width:7px;height:7px;border-radius:50%;background:${cor};flex:0 0 auto"></span>
        ${rotulo}
      </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/**
 * Enquadra o mapa nos veículos visíveis.
 *
 * Precisa ser um componente filho porque o `useMap` só existe dentro do
 * `MapContainer`. Reenquadra quando o conjunto muda, mas não quando o usuário
 * apenas seleciona um veículo — arrastar o mapa embaixo do operador a cada
 * clique é desorientador.
 */
function AjustarEnquadramento({ pontos }: { pontos: [number, number][] }) {
  const map = useMap();
  const chave = pontos.map((p) => p.join()).join("|");

  useEffect(() => {
    // O container pode ter nascido oculto (aba, painel colapsado). Sem isto o
    // mapa fica cinza até o primeiro redimensionamento da janela.
    map.invalidateSize();

    if (!pontos.length) return;
    if (pontos.length === 1) {
      map.setView(pontos[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(pontos), { padding: [48, 48], maxZoom: 15 });
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/** Centraliza no veículo selecionado, sem alterar o zoom escolhido. */
function SeguirSelecionado({ posicao }: { posicao: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (posicao) map.panTo(posicao, { animate: true });
  }, [posicao?.[0], posicao?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function MapaLeaflet({
  veiculos,
  selecionado,
  onSelect,
  altura = "h-[520px] lg:h-[640px]",
}: {
  veiculos: VeiculoMapa[];
  selecionado: string | null;
  onSelect: (placa: string) => void;
  altura?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  /** Só entra no mapa quem tem coordenada — sem isso o marcador cairia na Ilha Null. */
  const comCoordenada = useMemo(
    () => veiculos.filter((v) => typeof v.lat === "number" && typeof v.lng === "number" && (v.lat !== 0 || v.lng !== 0)),
    [veiculos],
  );

  const pontos = useMemo(
    () => comCoordenada.map((v) => [v.lat, v.lng] as [number, number]),
    [comCoordenada],
  );

  const posSelecionado = useMemo(() => {
    const v = comCoordenada.find((x) => x.placa === selecionado);
    return v ? ([v.lat, v.lng] as [number, number]) : null;
  }, [comCoordenada, selecionado]);

  const semCoordenada = veiculos.length - comCoordenada.length;

  return (
    <div ref={containerRef} className={`relative w-full overflow-hidden rounded-xl ${altura}`}>
      <MapContainer
        center={pontos[0] ?? CENTRO_PADRAO}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full"
        // O Leaflet usa z-index alto por padrão e passaria por cima de painéis
        // e do próprio menu lateral.
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        <AjustarEnquadramento pontos={pontos} />
        <SeguirSelecionado posicao={posSelecionado} />

        {comCoordenada.map((v) => (
          <Marker
            key={v.placa}
            position={[v.lat, v.lng]}
            icon={iconeVeiculo(v.rotulo, COR_SITUACAO[v.situacao] ?? "#8A9199", selecionado === v.placa)}
            eventHandlers={{ click: () => onSelect(v.placa) }}
          >
            <Popup>
              <div className="min-w-[180px] text-[12.5px]">
                <div className="font-mono text-[14px] font-bold">{v.rotulo}</div>
                <div className="font-mono text-[11px] text-slate-500">{v.placa}</div>
                <div className="mt-1.5 space-y-0.5">
                  {v.motorista && <div>{v.motorista}</div>}
                  <div>{v.velocidade} km/h</div>
                  {v.endereco && <div className="text-slate-500">{v.endereco}</div>}
                  {v.atualizado && <div className="text-slate-500">atualizado {v.atualizado}</div>}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Veículo sem posição não some sem explicação. */}
      {semCoordenada > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg bg-white/95 px-3 py-1.5 text-[11.5px] text-slate-600 shadow">
          {semCoordenada} veículo{semCoordenada > 1 ? "s" : ""} sem posição de GPS — não aparece{semCoordenada > 1 ? "m" : ""} no mapa.
        </div>
      )}
    </div>
  );
}
