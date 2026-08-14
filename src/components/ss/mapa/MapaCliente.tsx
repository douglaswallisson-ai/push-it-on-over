import { lazy, Suspense, useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import type { VeiculoMapa } from "./MapaLeaflet";

/**
 * Envoltório que carrega o mapa apenas no navegador.
 *
 * O Leaflet toca em `window` já na importação do módulo, então incluí-lo na
 * árvore renderizada no servidor derruba o SSR com "window is not defined" —
 * a página inteira falha, não só o mapa.
 *
 * Duas camadas resolvem: `lazy` mantém o Leaflet fora do bundle inicial, e o
 * estado `montado` garante que nada seja renderizado antes da hidratação.
 * Enquanto isso o usuário vê um esqueleto, não um espaço vazio.
 */

const MapaLeaflet = lazy(() =>
  import("./MapaLeaflet").then((m) => ({ default: m.MapaLeaflet })),
);

function Esqueleto({ altura }: { altura: string }) {
  return (
    <div className={`flex w-full items-center justify-center rounded-xl bg-secondary/60 ${altura}`}>
      <span className="flex flex-col items-center gap-2 text-muted-foreground">
        <MapPin className="h-6 w-6 animate-pulse" />
        <span className="text-[12.5px]">Carregando mapa…</span>
      </span>
    </div>
  );
}

export function MapaCliente(props: {
  veiculos: VeiculoMapa[];
  selecionado: string | null;
  onSelect: (placa: string) => void;
  altura?: string;
}) {
  const [montado, setMontado] = useState(false);
  const altura = props.altura ?? "h-[520px] lg:h-[640px]";

  useEffect(() => setMontado(true), []);

  if (!montado) return <Esqueleto altura={altura} />;

  return (
    <Suspense fallback={<Esqueleto altura={altura} />}>
      <MapaLeaflet {...props} altura={altura} />
    </Suspense>
  );
}
