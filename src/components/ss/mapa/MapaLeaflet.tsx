import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PopupVeiculo } from "./PopupVeiculo";
import { CamadasMapa, type CamadasVisiveis } from "./CamadasMapa";

const CHAVE_CAMADAS = "ss:mapa:camadas";

function lerCamadas(): CamadasVisiveis {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_CAMADAS) ?? "null");
    if (v && typeof v.pois === "boolean" && typeof v.cercas === "boolean") return v;
  } catch {
    /* sem armazenamento: usa o padrão */
  }
  return { pois: true, cercas: true };
}

/**
 * Contrato próprio do mapa, em vez de `PosicaoVeiculo` cru.
 *
 * A tela já deriva situação, rótulo e "há quanto tempo" para a lista lateral;
 * repetir essa derivação aqui abriria espaço para o marcador e a lista
 * discordarem sobre o mesmo veículo.
 */
export type EventoMapa = { lat: number; lng: number; cor: string; titulo: string; hora: string; detalhe?: string };

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

/**
 * Silhueta de ônibus vista de frente.
 *
 * A vista lateral que estava aqui antes ficava ilegível no tamanho do
 * marcador: os detalhes viravam borrão. De frente, a forma é reconhecível
 * mesmo em 20 pixels — que é o tamanho real na tela.
 */
const SVG_ONIBUS = `
<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
  <path d="M5 4.5C5 3.1 6.1 2 7.5 2h9C17.9 2 19 3.1 19 4.5v13c0 .6-.3 1.1-.8 1.4v1.6c0 .3-.2.5-.5.5h-1.4c-.3 0-.5-.2-.5-.5V19H8.2v1.5c0 .3-.2.5-.5.5H6.3c-.3 0-.5-.2-.5-.5v-1.6c-.5-.3-.8-.8-.8-1.4v-13Zm2.2.7v5.6h9.6V5.2H7.2Zm1 10.9a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Zm7.6 0a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z"/>
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
        display:flex;align-items:center;gap:6px;
        background:${cor};border:2px solid #fff;
        border-radius:999px;padding:4px 11px 4px 7px;
        font:700 13px/1.1 ui-monospace,monospace;color:#fff;
        letter-spacing:.02em;
        box-shadow:0 2px 10px rgba(15,25,40,.32), 0 0 0 1px rgba(15,25,40,.06);
        ${selecionado ? "outline:3px solid rgba(255,255,255,.9);outline-offset:0;box-shadow:0 4px 16px rgba(15,25,40,.45), 0 0 0 6px rgba(46,134,193,.35);transform:translate(-50%,-50%) scale(1.1);" : ""}
        ${pulsa ? "animation:ss-pulsar 1.1s ease-in-out infinite;" : ""}
        white-space:nowrap;
        ${selecionado ? "" : "transform:translate(-50%,-50%);"}
      ">
        <span style="display:flex;line-height:0;opacity:.95">${SVG_ONIBUS}</span>
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
  eventos,
  camadas = true,
}: {
  veiculos: VeiculoMapa[];
  selecionado: string | null;
  onSelect: (placa: string) => void;
  altura?: string;
  /** Traçado do percurso do veículo selecionado, quando solicitado. */
  percurso?: [number, number][];
  /** Eventos no ponto exato em que aconteceram (sobre o traçado). */
  eventos?: EventoMapa[];
  /** Mostra o seletor de cercas e pontos de interesse do cliente. */
  camadas?: boolean;
}) {
  const [visiveis, setVisiveis] = useState<CamadasVisiveis>(lerCamadas);
  const [estadoCamadas, setEstadoCamadas] = useState({ carregando: false, longe: false, truncado: false, erro: false });
  const alternar = (k: keyof CamadasVisiveis) =>
    setVisiveis((v) => {
      const n = { ...v, [k]: !v[k] };
      try {
        localStorage.setItem(CHAVE_CAMADAS, JSON.stringify(n));
      } catch {
        /* ignora */
      }
      return n;
    });
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

        {camadas && <CamadasMapa visiveis={visiveis} onEstado={setEstadoCamadas} />}

        <AjustarEnquadramento pontos={percurso?.length ? percurso : pontos} />

        {/* Percurso: linha grossa clara por baixo, fina escura por cima — o
            contorno mantém o traçado legível sobre ruas de qualquer cor. */}
        {percurso && percurso.length > 1 && (
          <>
            <Polyline positions={percurso} pathOptions={{ color: "#ffffff", weight: 7, opacity: 0.9 }} />
            <Polyline positions={percurso} pathOptions={{ color: "#1B3A6B", weight: 3.5, opacity: 0.95 }} />
          </>
        )}
        {(eventos ?? []).map((e, i) => (
          <CircleMarker
            key={`ev-${i}`}
            center={[e.lat, e.lng]}
            radius={7}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: e.cor, fillOpacity: 0.95 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>{e.titulo} · {e.hora}</Tooltip>
            <Popup>
              <div className="text-[12.5px]">
                <p className="font-semibold" style={{ color: e.cor }}>{e.titulo}</p>
                <p>{e.hora}{e.detalhe ? ` · ${e.detalhe}` : ""}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
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

      {camadas && (
        <div className="absolute right-3 top-3 z-[400] flex flex-col items-end gap-1">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white/95 text-[12px] font-medium shadow">
            {(
              [
                ["cercas", "Cercas", "#2E86C1"],
                ["pois", "Pontos (POIs)", "#7B4FBF"],
              ] as const
            ).map(([k, rotulo, tom]) => (
              <button
                key={k}
                type="button"
                onClick={() => alternar(k)}
                aria-pressed={visiveis[k]}
                title={visiveis[k] ? `Esconder ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors ${visiveis[k] ? "text-slate-800" : "text-slate-400 hover:text-slate-600"}`}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full border"
                  style={{ background: visiveis[k] ? tom : "transparent", borderColor: tom }}
                />
                {rotulo}
              </button>
            ))}
          </div>
          {(visiveis.pois || visiveis.cercas) && (estadoCamadas.longe || estadoCamadas.truncado || estadoCamadas.erro || estadoCamadas.carregando) && (
            <span className="rounded-md bg-white/95 px-2 py-1 text-[11px] text-slate-600 shadow">
              {estadoCamadas.erro
                ? "Não foi possível carregar cercas e pontos."
                : estadoCamadas.carregando
                  ? "Carregando cercas e pontos…"
                  : estadoCamadas.longe
                    ? "Aproxime o mapa para ver cercas e pontos."
                    : "Muitos itens nesta área — aproxime para ver todos."}
            </span>
          )}
        </div>
      )}

      {/* Veículo sem posição não some sem explicação. */}
      {semCoordenada > 0 && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg bg-white/95 px-3 py-1.5 text-[11.5px] text-slate-600 shadow">
          {semCoordenada} veículo{semCoordenada > 1 ? "s" : ""} sem posição de GPS — não aparece{semCoordenada > 1 ? "m" : ""} no mapa.
        </div>
      )}
    </div>
  );
}
