import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { PopupVeiculo } from "./PopupVeiculo";
import { CamadasMapa, type CamadasVisiveis } from "./CamadasMapa";
import { COR_SITUACAO, NOME_TIPO, svgVeiculo, type TipoVeiculo } from "./iconesVeiculo";

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
  /** Desenho do marcador (caminhão, ônibus…). Sem tipo, caminhão. */
  tipo?: TipoVeiculo;
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
const COR_ESTADO = COR_SITUACAO;

/** Só o que exige ação pulsa — se tudo pulsa, nada chama atenção. */
const PULSA = new Set(["evento_critico", "manutencao"]);

/** Rótulo da situação, para a dica do marcador. */
const NOME_ESTADO: Record<string, string> = {
  evento_critico: "evento crítico",
  manutencao: "em manutenção",
  em_viagem: "em movimento",
  ligado_parado: "motor ligado parado",
  desligado: "desligado",
  sem_transmissao: "sem sinal recente",
};

/**
 * Marcador do veículo: círculo na cor da situação com o desenho do tipo
 * (caminhão, ônibus, carro…) em branco, e o prefixo ao lado numa etiqueta
 * branca — legível de longe e sem esconder a cor. Só o que exige ação pulsa.
 */
function iconeVeiculo(rotulo: string, estado: string, selecionado: boolean, tipo: TipoVeiculo = "caminhao") {
  const cor = COR_ESTADO[estado] ?? "#5a6b7d";
  const pulsa = PULSA.has(estado);
  const d = selecionado ? 38 : 32;

  return L.divIcon({
    className: "",
    html: `
      <div title="${NOME_TIPO[tipo]} ${rotulo} · ${NOME_ESTADO[estado] ?? estado}" style="
        display:flex;align-items:center;width:max-content;transform:translate(-${d / 2}px,-50%);
        ${pulsa ? "animation:ss-pulsar 1.1s ease-in-out infinite;" : ""}
      ">
        <span style="
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
          width:${d}px;height:${d}px;border-radius:50%;
          background:${cor};color:#fff;border:2.5px solid #fff;
          box-shadow:0 2px 8px rgba(15,25,40,.35)${selecionado ? ",0 0 0 5px rgba(46,134,193,.35)" : ""};
          position:relative;z-index:1;
        ">${svgVeiculo(tipo, selecionado ? 21 : 18)}</span>
        <span style="
          margin-left:-8px;padding:3px 9px 3px 13px;border-radius:0 999px 999px 0;
          background:#fff;color:#16263a;border:1.5px solid ${cor};border-left:0;
          font:700 12px/1.1 ui-monospace,monospace;letter-spacing:.02em;white-space:nowrap;
          flex-shrink:0;width:max-content;max-width:118px;overflow:hidden;text-overflow:ellipsis;
          box-shadow:0 2px 6px rgba(15,25,40,.18);
        ">${rotulo}</span>
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
function AjustarEnquadramento({ pontos, chave: chaveConjunto }: { pontos: [number, number][]; chave?: string }) {
  const map = useMap();
  // Com `chave`, só reenquadra quando muda QUEM está no mapa (filtro, empresa),
  // não a cada posição nova — senão o zoom do operador se perde a cada 30 s.
  const chave = chaveConjunto ?? pontos.map((p) => p.join()).join("|");

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

/** Ponto em destaque (ex.: um evento aberto de outra tela): centraliza e aproxima uma vez. */
function IrParaFoco({ foco }: { foco?: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (foco) map.setView([foco.lat, foco.lng], 16, { animate: true });
  }, [foco?.lat, foco?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
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
  foco,
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
  /** Ponto em destaque, com o texto do balão. */
  foco?: { lat: number; lng: number; titulo: string; detalhe?: string } | null;
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

        <AjustarEnquadramento
          pontos={percurso?.length ? percurso : pontos}
          chave={percurso?.length ? undefined : comCoordenada.map((v) => v.placa).sort().join("|")}
        />

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
              <div className="text-[13px]">
                <p className="font-semibold" style={{ color: e.cor }}>{e.titulo}</p>
                <p>{e.hora}{e.detalhe ? ` · ${e.detalhe}` : ""}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        <SeguirSelecionado posicao={posSelecionado} />
        {foco && (
          <>
            <IrParaFoco foco={foco} />
            <CircleMarker center={[foco.lat, foco.lng]} radius={16} pathOptions={{ color: "#c0392b", weight: 2, fillColor: "#c0392b", fillOpacity: 0.15 }} />
            <CircleMarker center={[foco.lat, foco.lng]} radius={7} pathOptions={{ color: "#ffffff", weight: 2.5, fillColor: "#c0392b", fillOpacity: 1 }}>
              <Tooltip direction="top" offset={[0, -8]} permanent>
                <span className="font-semibold">{foco.titulo}</span>
                {foco.detalhe ? <span> · {foco.detalhe}</span> : null}
              </Tooltip>
            </CircleMarker>
          </>
        )}

        {comCoordenada.map((v) => (
          <Marker
            key={v.placa}
            position={[v.lat, v.lng]}
            icon={iconeVeiculo(v.rotulo, v.situacao, selecionado === v.placa, v.tipo)}
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
            <span className="rounded-md bg-white/95 px-2 py-1 text-[12px] text-slate-600 shadow">
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
        <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg bg-white/95 px-3 py-1.5 text-[12px] text-slate-600 shadow">
          {semCoordenada} veículo{semCoordenada > 1 ? "s" : ""} sem posição de GPS — não aparece{semCoordenada > 1 ? "m" : ""} no mapa.
        </div>
      )}
    </div>
  );
}
