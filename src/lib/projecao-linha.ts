/**
 * Projeção da posição do veículo sobre o itinerário da linha.
 *
 * O painel sinótico mostra cada carro numa régua que representa a linha, do
 * primeiro ao último ponto. Para isso é preciso responder duas perguntas a
 * partir de uma coordenada solta: entre quais paradas o veículo está, e quanto
 * já andou do trecho.
 *
 * A abordagem é geométrica: projeta-se o ponto do GPS sobre cada segmento do
 * itinerário e escolhe-se o mais próximo. É o mesmo princípio do *map matching*,
 * simplificado — sem grafo de ruas, o que basta porque o itinerário de ônibus
 * é uma sequência conhecida e o carro não sai dela.
 *
 * O que este cálculo **não** resolve: linha que passa duas vezes pelo mesmo
 * trecho em sentidos diferentes. Nesse caso a projeção pode escolher o
 * segmento errado, e por isso o resultado carrega um nível de confiança.
 */

export type PontoItinerario = {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  ordem: number;
  /** Horário programado de passagem, em minutos desde a meia-noite. */
  horarioMin?: number;
  /** Ponto de controle: onde a viagem abre ou fecha. */
  pontoControle?: boolean;
};

export type PosicaoGps = {
  veiculoId: string;
  lat: number;
  lng: number;
  em: string;
  velocidade?: number;
};

export type ProjecaoNaLinha = {
  veiculoId: string;
  /** Índice do ponto anterior na sequência. */
  indiceAnterior: number;
  pontoAnterior: PontoItinerario;
  pontoProximo: PontoItinerario | null;
  /** Progresso dentro do trecho atual, de 0 a 1. */
  progressoTrecho: number;
  /** Progresso na linha inteira, de 0 a 1 — é o que posiciona na régua. */
  progressoLinha: number;
  /** Distância entre o GPS e o traçado, em metros. */
  desvioMetros: number;
  /**
   * Confiança da projeção.
   *
   * Declarada porque um desvio grande significa que o veículo não está na
   * linha — desviou, está na garagem, ou o itinerário está desatualizado. Sem
   * isso, o painel mostraria com a mesma segurança um carro na rota e outro a
   * três quilômetros dela.
   */
  confianca: "alta" | "media" | "baixa";
  /** Desvio de horário em minutos. Negativo = adiantado. */
  desvioMin: number | null;
};

/** Distância entre coordenadas, em metros. */
function distanciaMetros(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Projeta um ponto sobre um segmento de reta.
 *
 * Devolve a fração do segmento onde a projeção caiu (limitada entre 0 e 1, para
 * o resultado nunca cair fora do trecho) e a distância até ele.
 *
 * Em escala de quarteirão, tratar latitude e longitude como plano cartesiano
 * introduz erro desprezível — e evita trigonometria esférica num laço que roda
 * para cada veículo a cada atualização.
 */
function projetarNoSegmento(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): { fracao: number; distancia: number } {
  // Corrige a longitude pelo cosseno da latitude: um grau de longitude vale
  // menos que um de latitude conforme se afasta do equador. Sem isso, a
  // projeção entorta em rota que corre no sentido leste-oeste.
  const k = Math.cos((aLat * Math.PI) / 180);
  const ax = aLng * k;
  const ay = aLat;
  const bx = bLng * k;
  const by = bLat;
  const px = pLng * k;
  const py = pLat;

  const dx = bx - ax;
  const dy = by - ay;
  const comprimento2 = dx * dx + dy * dy;

  if (comprimento2 === 0) {
    return { fracao: 0, distancia: distanciaMetros(pLat, pLng, aLat, aLng) };
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / comprimento2));
  const projLat = ay + t * dy;
  const projLng = (ax + t * dx) / k;

  return { fracao: t, distancia: distanciaMetros(pLat, pLng, projLat, projLng) };
}

/** Comprimento acumulado até cada ponto, para converter trecho em progresso. */
function acumularDistancias(itinerario: PontoItinerario[]): { parciais: number[]; total: number } {
  const parciais = [0];
  let total = 0;
  for (let i = 1; i < itinerario.length; i++) {
    total += distanciaMetros(
      itinerario[i - 1].lat,
      itinerario[i - 1].lng,
      itinerario[i].lat,
      itinerario[i].lng,
    );
    parciais.push(total);
  }
  return { parciais, total };
}

/** Acima disto, o veículo provavelmente não está no itinerário. */
const DESVIO_ALTO_M = 300;
const DESVIO_MEDIO_M = 120;

export function projetarNaLinha(
  posicao: PosicaoGps,
  itinerario: PontoItinerario[],
): ProjecaoNaLinha | null {
  if (itinerario.length < 2) return null;

  const ordenado = [...itinerario].sort((a, b) => a.ordem - b.ordem);
  const { parciais, total } = acumularDistancias(ordenado);

  let melhor = { indice: 0, fracao: 0, distancia: Infinity };

  for (let i = 0; i < ordenado.length - 1; i++) {
    const r = projetarNoSegmento(
      posicao.lat,
      posicao.lng,
      ordenado[i].lat,
      ordenado[i].lng,
      ordenado[i + 1].lat,
      ordenado[i + 1].lng,
    );
    if (r.distancia < melhor.distancia) {
      melhor = { indice: i, fracao: r.fracao, distancia: r.distancia };
    }
  }

  const anterior = ordenado[melhor.indice];
  const proximo = ordenado[melhor.indice + 1] ?? null;

  const percorrido =
    parciais[melhor.indice] +
    melhor.fracao * ((parciais[melhor.indice + 1] ?? parciais[melhor.indice]) - parciais[melhor.indice]);

  const confianca =
    melhor.distancia > DESVIO_ALTO_M ? "baixa" : melhor.distancia > DESVIO_MEDIO_M ? "media" : "alta";

  return {
    veiculoId: posicao.veiculoId,
    indiceAnterior: melhor.indice,
    pontoAnterior: anterior,
    pontoProximo: proximo,
    progressoTrecho: melhor.fracao,
    progressoLinha: total ? percorrido / total : 0,
    desvioMetros: Math.round(melhor.distancia),
    confianca,
    desvioMin: calcularDesvioHorario(posicao.em, anterior, proximo, melhor.fracao),
  };
}

/**
 * Desvio contra o horário programado.
 *
 * Interpola o horário esperado entre as duas paradas conforme o progresso no
 * trecho: se o carro está na metade do caminho, deveria estar na metade do
 * tempo. É aproximação — o trecho não é percorrido em velocidade constante —
 * mas erra por menos de um minuto na maioria dos casos, e é o suficiente para
 * classificar adiantado, no horário ou atrasado.
 */
function calcularDesvioHorario(
  em: string,
  anterior: PontoItinerario,
  proximo: PontoItinerario | null,
  fracao: number,
): number | null {
  if (anterior.horarioMin == null) return null;

  const agora = new Date(em);
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes() + agora.getSeconds() / 60;

  const esperado =
    proximo?.horarioMin != null
      ? anterior.horarioMin + fracao * (proximo.horarioMin - anterior.horarioMin)
      : anterior.horarioMin;

  return Math.round(minutosAgora - esperado);
}

/**
 * Intervalo entre veículos consecutivos na linha.
 *
 * É o indicador que revela comboio: dois carros grudados com um vão grande
 * atrás. Contar só atraso individual não mostra isso — ambos podem estar no
 * horário e ainda assim mal distribuídos.
 */
export function calcularIntervalos(projecoes: ProjecaoNaLinha[], duracaoLinhaMin: number) {
  const ordenadas = [...projecoes].sort((a, b) => a.progressoLinha - b.progressoLinha);

  return ordenadas.map((p, i) => {
    const anterior = ordenadas[i - 1];
    if (!anterior) return { ...p, intervaloMin: null as number | null, comboio: false };

    const deltaProgresso = p.progressoLinha - anterior.progressoLinha;
    const intervaloMin = Math.round(deltaProgresso * duracaoLinhaMin);

    return {
      ...p,
      intervaloMin,
      // Menos de dois minutos entre um carro e outro é comboio — os dois
      // param no mesmo ponto e um deles roda vazio.
      comboio: intervaloMin < 2,
    };
  });
}
