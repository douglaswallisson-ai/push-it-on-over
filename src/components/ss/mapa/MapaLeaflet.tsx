import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PopupVeiculo } from "./PopupVeiculo";

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
  veiculoId?: string;
  lat: number;
  lng: number;
  /** Estado do mapa: define cor e pulso do marcador. */
  situacao: string;
  velocidade: number;
  endereco?: string;
  atualizado?: string;
  motorista?: string;
  linha?: string;
  eventosAbertos?: number;
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

/**
 * Cor por estado. A leitura pretendida é de longe, num telão de CCO: verde
 * transmitindo, âmbar parado com motor ligado, vermelho e laranja pulsando
 * quando exigem ação, preto quando o equipamento sumiu.
 */
const COR_ESTADO: Record<string, string> = {
  evento_critico: "#c0392b",
  manutencao: "#e07b1a",
  em_viagem: "#2f9e44",
  ligado_parado: "#d6a419",
  desligado: "#5a6b7d",
  sem_transmissao: "#1c1c1c",
};

/** Só o que exige ação pulsa — se tudo pulsa, nada chama atenção. */
const PULSA = new Set(["evento_critico", "manutencao"]);

/** Silhueta de ônibus, desenhada em SVG para herdar a cor do estado. */
const SVG_ONIBUS = `
<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
  <path d="M4 16V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a2 2 0 0 1-1 1.73V19a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1.27A2 2 0 0 1 4 16Zm2-9v5h12V7H6Zm1.5 9a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Zm9 0a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"/>
</svg>`;

/**
 * Marcador do veículo: silhueta de ônibus na cor do estado, com o prefixo ao
 * lado para o operador identificar sem clicar.
 */
function iconeVeiculo(rotulo: string, estado: string, selecionado: boolean) {
  const cor = COR_ESTADO[estado] ?? "#5a6b7d";
  const pulsa = PULSA.has(estado);

  return L.divIcon({
    className: "",
    html: `
      <div style="
        display:flex;align-items:center;gap:7px;
        background:#fff;border:3px solid ${cor};
        border-radius:999px;padding:5px 12px 5px 8px;
        font:800 15px/1.1 ui-monospace,monospace;color:#1f2d3d;
        box-shadow:0 3px 12px rgba(0,0,0,.35);
        ${selecionado ? "outline:4px solid rgba(46,134,193,.55);outline-offset:3px;transform:translate(-50%,-50%) scale(1.12);" : ""}
        ${pulsa ? "animation:ss-pulsar 1.1s ease-in-out infinite;" : ""}
        white-space:nowrap;
        ${selecionado ? "" : "transform:translate(-50%,-50%);"}
      ">
        <span style="color:${cor};display:flex;line-height:0">${SVG_ONIBUS}</span>
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
  percurso,
}: {
  veiculos: VeiculoMapa[];
  selecionado: string | null;
  onSelect: (placa: string) => void;
  altura?: string;
  /** Traçado do percurso do veículo selecionado, quando solicitado. */
  percurso?: [number, number][];
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

        <AjustarEnquadramento pontos={percurso?.length ? percurso : pontos} />

        {/* Percurso: linha grossa clara por baixo, fina escura por cima — o
            contorno mantém o traçado legível sobre ruas de qualquer cor. */}
        {percurso && percurso.length > 1 && (
          <>
            <Polyline positions={percurso} pathOptions={{ color: "#ffffff", weight: 7, opacity: 0.9 }} />
            <Polyline positions={percurso} pathOptions={{ color: "#1B3A6B", weight: 3.5, opacity: 0.95 }} />
          </>
        )}
        <SeguirSelecionado posicao={posSelecionado} />

        {comCoordenada.map((v) => (
          <Marker
            key={v.placa}
            position={[v.lat, v.lng]}
            icon={iconeVeiculo(v.rotulo, v.situacao, selecionado === v.placa)}
            eventHandlers={{ click: () => onSelect(v.placa) }}
          >
            <Popup minWidth={300} maxWidth={320} autoPanPadding={[24, 24]}>
              <PopupVeiculo
                placa={v.placa}
                rotulo={v.rotulo}
                veiculoId={v.veiculoId}
                estado={v.situacao}
                velocidade={v.velocidade}
                endereco={v.endereco}
                atualizado={v.atualizado}
                motorista={v.motorista}
                linha={v.linha}
                eventosAbertos={v.eventosAbertos}
              />
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
