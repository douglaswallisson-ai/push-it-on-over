import { useQuery } from "@tanstack/react-query";
import { PerfilElevacao } from "@/components/ss/frota/PerfilElevacao";
import { relevoTrajetoQuery } from "@/lib/relevo-api";

/**
 * Perfil do dia de um veículo (o mesmo do Tracking): altitude, velocidade e rotação pelo percurso, com as
 * faixas de condução e as bolinhas dos eventos onde aconteceram. Usado na janela de Relevo do motorista
 * e no Gerencial › Relevo (PM, 13/10/2026: "era bem melhor, com as faixas e as bolinhas dos eventos").
 */
export function PerfilDoDia({
  unitId,
  dia,
  rotulo,
}: {
  unitId: string | number;
  dia: string;
  rotulo: string;
}) {
  const q = useQuery(relevoTrajetoQuery(String(unitId), dia));
  return (
    <PerfilElevacao
      dados={q.data}
      carregando={q.isLoading}
      erro={q.error}
      onHover={() => {}}
      rotuloVeiculo={rotulo}
      linkMapa={(e) =>
        `/app/frota/tracking?veiculo=${encodeURIComponent(String(unitId))}&dia=${dia}&foco=${e.lat},${e.lon}&focoTitulo=${encodeURIComponent(`${e.evento ?? "Evento"} · ${e.hora.slice(0, 5)}`)}`
      }
    />
  );
}
