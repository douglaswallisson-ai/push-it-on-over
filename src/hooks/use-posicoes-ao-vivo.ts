import { useEffect, useRef, useState } from "react";
import { usandoMock } from "@/lib/modo";

/**
 * Posições em tempo real por WebSocket.
 *
 * Substitui o polling do mapa. O serviço `ss-nexus-websocket-api` mantém a
 * conexão aberta e empurra a posição a cada 3 segundos, em vez de o navegador
 * refazer a consulta inteira periodicamente — menos tráfego, menos carga no
 * banco e latência menor.
 *
 * Canais disponíveis no serviço:
 *
 *     /ws/unit/{unit_id}                         um veículo
 *     /ws/subgroup/{subgroup_id}                 todos de um subgrupo
 *     /ws/subgroup/{id}/driver/{driver_id}       um motorista dentro do subgrupo
 *     /ws/location?unit_id=&subgroup_id=         combinação livre por query
 *
 * O último é o mais flexível e é o usado aqui: aceita várias unidades e vários
 * subgrupos na mesma conexão, o que evita abrir uma por veículo.
 */

/** Formato devolvido pelo serviço, conforme o DAO de localização. */
export type PosicaoAoVivo = {
  unit_id: number;
  label: string;
  latitude: number;
  longitude: number;
  driver_id?: number | null;
  driver_name?: string | null;
  speed?: number;
  ignition?: boolean;
  local_time?: string;
};

export type EstadoConexao = "desligado" | "conectando" | "conectado" | "erro" | "reconectando";

const BASE_WS = (import.meta.env.VITE_WS_BASE as string) || "";

/**
 * Reconexão com espera crescente.
 *
 * Rede de operação cai — túnel, troca de rede, servidor reiniciando. Sem
 * reconexão automática o mapa congela sem avisar, que é pior do que mostrar
 * dado velho: o operador não sabe que parou. Com espera crescente, uma queda
 * prolongada não vira martelada de tentativas no servidor.
 */
const ESPERA_MS = [1000, 2000, 5000, 10000, 30000];

export function usePosicoesAoVivo({
  unitIds = [],
  subgroupIds = [],
  ativo = true,
}: {
  unitIds?: number[];
  subgroupIds?: number[];
  ativo?: boolean;
}) {
  const [posicoes, setPosicoes] = useState<Map<number, PosicaoAoVivo>>(new Map());
  const [estado, setEstado] = useState<EstadoConexao>("desligado");
  const [ultimaMensagem, setUltimaMensagem] = useState<number | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const tentativaRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desmontadoRef = useRef(false);

  // Chave estável: sem isto, um array novo a cada render reabriria a conexão.
  const chave = `${unitIds.join(",")}|${subgroupIds.join(",")}`;

  useEffect(() => {
    desmontadoRef.current = false;

    // Com dados de exemplo não há servidor para conectar, e tentar geraria erro
    // no console a cada poucos segundos.
    if (!ativo || usandoMock() || !BASE_WS) {
      setEstado("desligado");
      return;
    }

    const conectar = () => {
      if (desmontadoRef.current) return;

      const params = new URLSearchParams();
      for (const u of unitIds) params.append("unit_id", String(u));
      for (const s of subgroupIds) params.append("subgroup_id", String(s));

      const url = `${BASE_WS}/ws/location${params.toString() ? `?${params}` : ""}`;
      setEstado(tentativaRef.current === 0 ? "conectando" : "reconectando");

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        agendarReconexao();
        return;
      }
      socketRef.current = ws;

      ws.onopen = () => {
        tentativaRef.current = 0;
        setEstado("conectado");
      };

      ws.onmessage = (ev) => {
        try {
          const bruto = JSON.parse(ev.data);
          const lista: PosicaoAoVivo[] = Array.isArray(bruto) ? bruto : [bruto];

          // Mescla em vez de substituir: o serviço pode enviar só o que mudou,
          // e trocar o mapa inteiro faria os demais veículos sumirem.
          setPosicoes((atual) => {
            const novo = new Map(atual);
            for (const p of lista) {
              if (p && typeof p.unit_id === "number") novo.set(p.unit_id, p);
            }
            return novo;
          });
          setUltimaMensagem(Date.now());
        } catch {
          // Mensagem malformada não derruba a conexão — apenas é ignorada.
        }
      };

      ws.onerror = () => setEstado("erro");
      ws.onclose = () => {
        socketRef.current = null;
        if (!desmontadoRef.current) agendarReconexao();
      };
    };

    const agendarReconexao = () => {
      const espera = ESPERA_MS[Math.min(tentativaRef.current, ESPERA_MS.length - 1)];
      tentativaRef.current += 1;
      setEstado("reconectando");
      timerRef.current = setTimeout(conectar, espera);
    };

    conectar();

    return () => {
      desmontadoRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [chave, ativo]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    posicoes,
    estado,
    ultimaMensagem,
    /** true quando o canal está entregando dado, e não só conectado. */
    recebendo: estado === "conectado" && ultimaMensagem !== null,
  };
}
