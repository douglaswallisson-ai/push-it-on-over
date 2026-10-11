import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";

/** Comparativo com iguais (ss-fleet-core, endpoints/comparativo.py — regras na docstring de lá). */

export type SituacaoComparativo =
  "melhor" | "media" | "pior" | "sem_dado" | "poucos_iguais" | "nao_comparavel";

export type IndicadorComparativo = {
  chave: string;
  nome: string;
  unidade: string;
  menor_melhor: boolean;
  explicacao: string;
  valor: number | null;
  comparavel: boolean;
  situacao: SituacaoComparativo;
  motivo?: string;
  posicao?: number;
  de?: number;
  melhor_que_pct?: number;
  mediana?: number;
  p25?: number;
  p75?: number;
  melhor?: number;
  iguais: { nome: string; valor: number }[];
};

export type Comparativo = {
  group_id: number;
  segmento: string;
  segmento_nome: string;
  inicio: string;
  fim: string;
  dias: number;
  iguais: number;
  nomes_visiveis: boolean;
  base: { veiculos: number; km: number };
  indicadores: IndicadorComparativo[];
  regras: { km_min: number; veiculos_min: number; iguais_min: number };
};

export const comparativoQuery = (grupo: string | undefined, dias: number) =>
  queryOptions({
    queryKey: ["comparativo", grupo ?? "", dias],
    queryFn: () => api.get<Comparativo>(`/api/v1/comparativo?group_id=${grupo}&dias=${dias}`),
    enabled: !usandoMock() && Boolean(grupo),
    staleTime: 60 * 60_000,
    retry: false,
  });

/** Exemplo para o modo de demonstração (números inventados, sem cliente real). */
export function comparativoExemplo(): Comparativo {
  const ig = (xs: number[]) => xs.map((valor, i) => ({ nome: `Cliente ${"ABCDEFGH"[i]}`, valor }));
  return {
    group_id: 0,
    segmento: "urbano",
    segmento_nome: "Transporte urbano",
    inicio: "2026-09-10",
    fim: "2026-10-09",
    dias: 30,
    iguais: 6,
    nomes_visiveis: false,
    base: { veiculos: 120, km: 640000 },
    regras: { km_min: 20000, veiculos_min: 5, iguais_min: 3 },
    indicadores: [
      {
        chave: "kml",
        nome: "Consumo",
        unidade: "km/l",
        menor_melhor: false,
        explicacao: "Km rodados com combustível válido ÷ litros.",
        valor: 2.9,
        comparavel: true,
        situacao: "media",
        posicao: 4,
        de: 7,
        melhor_que_pct: 50,
        mediana: 2.85,
        p25: 2.6,
        p75: 3.1,
        melhor: 3.4,
        iguais: ig([2.4, 2.6, 2.8, 2.9, 3.1, 3.4]),
      },
      {
        chave: "eventos100",
        nome: "Acelerações e freadas bruscas",
        unidade: "a cada 100 km",
        menor_melhor: true,
        explicacao: "Acelerações + freadas bruscas a cada 100 km rodados.",
        valor: 6.2,
        comparavel: false,
        situacao: "nao_comparavel",
        motivo:
          "Cada cliente tem o equipamento configurado com limites próprios: este número serve para acompanhar a própria frota, não para comparar com outros.",
        iguais: [],
      },
      {
        chave: "ocioso_pct",
        nome: "Parado com motor ligado",
        unidade: "% do tempo",
        menor_melhor: true,
        explicacao: "Tempo parado com motor ligado ÷ tempo total com motor ligado.",
        valor: 21.5,
        comparavel: true,
        situacao: "melhor",
        posicao: 2,
        de: 7,
        melhor_que_pct: 83,
        mediana: 27,
        p25: 23,
        p75: 33,
        melhor: 18,
        iguais: ig([18, 23, 26, 28, 33, 41]),
      },
      {
        chave: "sem_motorista_pct",
        nome: "Rodando sem motorista identificado",
        unidade: "% dos km",
        menor_melhor: true,
        explicacao: "Km rodados sem motorista identificado ÷ km rodados.",
        valor: 38,
        comparavel: true,
        situacao: "pior",
        posicao: 6,
        de: 7,
        melhor_que_pct: 17,
        mediana: 20,
        p25: 9,
        p75: 31,
        melhor: 4,
        iguais: ig([4, 9, 15, 25, 31, 52]),
      },
      {
        chave: "km_veiculo_dia",
        nome: "Uso da frota",
        unidade: "km por veículo por dia",
        menor_melhor: false,
        explicacao: "Km rodados ÷ veículos ÷ dias do período.",
        valor: 178,
        comparavel: true,
        situacao: "media",
        posicao: 3,
        de: 7,
        melhor_que_pct: 67,
        mediana: 150,
        p25: 110,
        p75: 185,
        melhor: 220,
        iguais: ig([90, 110, 140, 160, 185, 220]),
      },
    ],
  };
}
