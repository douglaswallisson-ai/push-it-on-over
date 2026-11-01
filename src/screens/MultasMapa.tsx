import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { EmptyNote } from "@/components/ss/ui/QueryState";
import type { DetalheMulta } from "@/lib/multas-api";

/** Em arquivo próprio e carregado só no navegador: o Leaflet toca em `window` na importação. */
export default function MultasMapa({ d }: { d: DetalheMulta }) {
  const real =
    d.telemetria?.latitude && d.telemetria.longitude
      ? ([d.telemetria.latitude, d.telemetria.longitude] as [number, number])
      : null;
  const aprox = d.local_aproximado
    ? ([d.local_aproximado.lat, d.local_aproximado.lng] as [number, number])
    : null;
  const centro = real ?? aprox;
  if (!centro) return <EmptyNote>Sem localização para mostrar no mapa.</EmptyNote>;
  return (
    <div className="space-y-1.5">
      <div className="h-[220px] overflow-hidden rounded-xl border border-border">
        <MapContainer
          center={centro}
          zoom={15}
          bounds={real && aprox ? [real, aprox] : undefined}
          boundsOptions={{ padding: [30, 30], maxZoom: 16 }}
          className="h-full w-full"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {aprox && (
            <CircleMarker
              center={aprox}
              radius={11}
              pathOptions={{ color: "#c0392b", fillOpacity: 0.25 }}
            >
              <Popup>Local aproximado informado na multa</Popup>
            </CircleMarker>
          )}
          {real && (
            <CircleMarker
              center={real}
              radius={7}
              pathOptions={{ color: "#1f3a5f", fillOpacity: 0.9 }}
            >
              <Popup>Posição real do veículo</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Vermelho: local aproximado da multa. Azul: posição real do veículo.
      </p>
    </div>
  );
}
