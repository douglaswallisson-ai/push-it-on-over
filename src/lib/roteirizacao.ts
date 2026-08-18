/**
 * Otimização de rota.
 *
 * O problema é o do caixeiro-viajante com ponto de partida fixo: dado um
 * conjunto de paradas, qual a ordem que minimiza a distância total. Não tem
 * solução exata viável — com 20 paradas são 10^17 combinações — então o
 * caminho é heurística.
 *
 * A estratégia aqui é **vizinho mais próximo seguido de 2-opt**:
 *
 * 1. Vizinho mais próximo constrói uma rota inicial rápida, sempre indo ao
 *    ponto mais perto ainda não visitado. É gulosa e costuma ficar 20–25%
 *    acima do ótimo.
 * 2. 2-opt melhora essa rota desfazendo cruzamentos: sempre que dois trechos
 *    se cruzam, invertê-los encurta o caminho. Reduz para 5% acima do ótimo,
 *    em geral.
 *
 * Isso roda em milissegundos para as dezenas de paradas de um roteiro de
 * fretamento — não precisa de servidor nem de serviço pago.
 */

export type Parada = {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  /** Passageiros que embarcam aqui. Usado para checar capacidade. */
  passageiros?: number;
  /** Minutos de permanência. Entra no tempo total, não na distância. */
  paradaMin?: number;
  /** Ponto obrigatório de início ou fim — não é reordenado. */
  fixo?: "inicio" | "fim";
  endereco?: string;
};

export type Rota = {
  ordem: Parada[];
  distanciaKm: number;
  duracaoMin: number;
  passageiros: number;
  /** Trechos entre paradas consecutivas, para desenhar e detalhar. */
  trechos: { de: Parada; para: Parada; km: number; min: number }[];
};

/** Velocidade média usada para converter distância em tempo. */
const VELOCIDADE_MEDIA_KMH = 32;

/**
 * Fator de sinuosidade.
 *
 * A distância em linha reta subestima o percurso real, porque nenhuma rua é
 * reta. 1,35 é o valor usual para malha urbana brasileira — usar a distância
 * pura faria a rota parecer 25% mais curta do que é, e o motorista chegaria
 * atrasado.
 */
const FATOR_RUA = 1.35;

/** Distância entre dois pontos pela fórmula de Haversine, em quilômetros. */
export function distancia(a: Parada, b: Parada): number {
  const R = 6371;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * FATOR_RUA;
}

/** Matriz de distâncias, calculada uma vez e reusada nas iterações. */
function matriz(paradas: Parada[]): number[][] {
  const n = paradas.length;
  const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = distancia(paradas[i], paradas[j]);
      m[i][j] = d;
      m[j][i] = d;
    }
  }
  return m;
}

const custoTotal = (ordem: number[], m: number[][]) =>
  ordem.slice(0, -1).reduce((soma, atual, i) => soma + m[atual][ordem[i + 1]], 0);

/** Rota inicial: sempre para o ponto mais próximo ainda não visitado. */
function vizinhoMaisProximo(m: number[][], n: number, inicio: number, fim: number | null): number[] {
  const visitado = new Set<number>([inicio]);
  if (fim !== null) visitado.add(fim);

  const ordem = [inicio];
  let atual = inicio;

  while (visitado.size < n) {
    let melhor = -1;
    let menor = Infinity;
    for (let j = 0; j < n; j++) {
      if (visitado.has(j)) continue;
      if (m[atual][j] < menor) {
        menor = m[atual][j];
        melhor = j;
      }
    }
    if (melhor === -1) break;
    ordem.push(melhor);
    visitado.add(melhor);
    atual = melhor;
  }

  if (fim !== null) ordem.push(fim);
  return ordem;
}

/**
 * Melhora a rota desfazendo cruzamentos.
 *
 * Para cada par de trechos, testa inverter o segmento entre eles. Se encurtar,
 * mantém. Repete até nenhuma troca melhorar — ou até o limite de iterações,
 * que existe para a interface nunca travar com muitas paradas.
 */
function doisOpt(
  ordem: number[],
  m: number[][],
  temFim: boolean,
  maxIteracoes = 2000,
): number[] {
  let melhor = [...ordem];
  let melhorou = true;
  let iteracoes = 0;

  // Extremos ficam de fora: início e fim são pontos fixos do roteiro.
  const primeiro = 1;
  const ultimo = temFim ? melhor.length - 2 : melhor.length - 1;

  while (melhorou && iteracoes < maxIteracoes) {
    melhorou = false;
    for (let i = primeiro; i < ultimo; i++) {
      for (let j = i + 1; j <= ultimo; j++) {
        iteracoes++;
        const candidato = [
          ...melhor.slice(0, i),
          ...melhor.slice(i, j + 1).reverse(),
          ...melhor.slice(j + 1),
        ];
        if (custoTotal(candidato, m) < custoTotal(melhor, m)) {
          melhor = candidato;
          melhorou = true;
        }
      }
    }
  }

  return melhor;
}

function montarRota(paradas: Parada[], ordem: number[]): Rota {
  const seq = ordem.map((i) => paradas[i]);
  const trechos: Rota["trechos"] = [];
  let km = 0;

  for (let i = 0; i < seq.length - 1; i++) {
    const d = distancia(seq[i], seq[i + 1]);
    km += d;
    trechos.push({
      de: seq[i],
      para: seq[i + 1],
      km: Math.round(d * 10) / 10,
      min: Math.round((d / VELOCIDADE_MEDIA_KMH) * 60),
    });
  }

  const minutosParadas = seq.reduce((a, p) => a + (p.paradaMin ?? 0), 0);

  return {
    ordem: seq,
    distanciaKm: Math.round(km * 10) / 10,
    duracaoMin: Math.round((km / VELOCIDADE_MEDIA_KMH) * 60) + minutosParadas,
    passageiros: seq.reduce((a, p) => a + (p.passageiros ?? 0), 0),
    trechos,
  };
}

/** Rota na ordem em que as paradas foram cadastradas, sem otimizar. */
export function rotaManual(paradas: Parada[]): Rota {
  return montarRota(paradas, paradas.map((_, i) => i));
}

/**
 * Rota otimizada.
 *
 * Respeita os pontos marcados como fixos: garagem na saída e destino na
 * chegada não são reordenados, porque a operação não aceita começar no meio.
 */
export function rotaOtimizada(paradas: Parada[]): Rota {
  if (paradas.length < 3) return rotaManual(paradas);

  const m = matriz(paradas);
  const iInicio = Math.max(0, paradas.findIndex((p) => p.fixo === "inicio"));
  const iFimBruto = paradas.findIndex((p) => p.fixo === "fim");
  const iFim = iFimBruto >= 0 ? iFimBruto : null;

  const inicial = vizinhoMaisProximo(m, paradas.length, iInicio, iFim);
  const refinada = doisOpt(inicial, m, iFim !== null);

  return montarRota(paradas, refinada);
}

/** Comparação entre a ordem cadastrada e a otimizada. */
export function compararRotas(paradas: Parada[]) {
  const manual = rotaManual(paradas);
  const otimizada = rotaOtimizada(paradas);

  const economiaKm = Math.round((manual.distanciaKm - otimizada.distanciaKm) * 10) / 10;
  const economiaPct = manual.distanciaKm
    ? Math.round((economiaKm / manual.distanciaKm) * 1000) / 10
    : 0;

  return {
    manual,
    otimizada,
    economiaKm,
    economiaPct,
    economiaMin: manual.duracaoMin - otimizada.duracaoMin,
  };
}

/**
 * Projeção de economia mensal.
 *
 * É o número que sustenta a decisão: quilômetro economizado por viagem vira
 * combustível e hora de motorista ao longo do mês. Os parâmetros ficam
 * explícitos para o gestor ajustar aos custos dele, em vez de embutir um valor
 * que não corresponde à realidade dele.
 */
export function projetarEconomia(
  economiaKmPorViagem: number,
  viagensPorMes: number,
  custoPorKm: number,
) {
  const kmMes = economiaKmPorViagem * viagensPorMes;
  return {
    kmMes: Math.round(kmMes),
    kmAno: Math.round(kmMes * 12),
    reaisMes: Math.round(kmMes * custoPorKm),
    reaisAno: Math.round(kmMes * custoPorKm * 12),
  };
}
