import { useMemo } from "react";
import { useRelatorioCursor, type TelemetriaApi } from "@/lib/relatorios-api";
import { usandoMock } from "@/lib/modo";
import type { IndicadoresConducao } from "@/types";

/* ------------------------------------------------------------------ */
/* Unidades e travas de invariante físico                              */
/* ------------------------------------------------------------------ */

/**
 * O endpoint de cursor devolve o valor bruto da tabela — em metros e
 * mililitros.
 *
 * O schema anota `# km` e `# liters` em `TelemetryResponse`, mas a consulta
 * seleciona `ct.distance_traveled` e `ct.fuel_used` direto, sem dividir. O
 * comentário descreve uma intenção que a consulta não cumpre.
 *
 * Confirmado no dado real: 8.895 em 2.570 segundos dá 12,7 km/h se for metro,
 * e 12.458 km/h se for quilômetro. E `end_odometer` de 183.159.270 é odômetro
 * de 183 mil km em metros — em quilômetro seriam 183 milhões.
 *
 * Outros endpoints **convertem**: o relatório de jornada divide por mil na
 * própria consulta. A regra não é uniforme na API, e por isso a conversão fica
 * declarada aqui, por endpoint.
 */
const METROS_POR_KM = 1000;
const ML_POR_LITRO = 1000;

/**
 * Descarta viagem fisicamente impossível.
 *
 * Não é filtro de bom senso: são três defeitos conhecidos do dado bruto, e sem
 * eles o total da frota fica ordens de grandeza errado.
 *
 * 1. **Distância negativa.** Overflow de odômetro de 32 bits — o contador
 *    estoura em 4.294.967.295 e volta a zero, produzindo diferença negativa.
 *    Atinge cerca de 0,5% das viagens, e sem a trava o quilômetro da frota
 *    fica negativo na casa do milhão.
 *
 * 2. **Velocidade implícita acima de 300 km/h.** Salto do mesmo defeito: há
 *    registro de ~405.000 km em uma hora. É esta trava que separa dezenas de
 *    milhões de quilômetros brutos dos poucos milhares reais.
 *
 * 3. **Consumo acima de 5 litros por quilômetro.** Acontece quando o contador
 *    cumulativo do equipamento é copiado no lugar do consumo da viagem. Afeta
 *    só o par usado no km/l, não o total de distância.
 */
const VELOCIDADE_MAX_KMH = 300;
const LITROS_POR_KM_MAX = 5;

function viagemPlausivel(metros: number, segundos: number, mililitros: number) {
  if (metros < 0) return false;

  const km = metros / METROS_POR_KM;
  const horas = segundos / 3600;
  if (horas > 0 && km / horas > VELOCIDADE_MAX_KMH) return false;

  const litros = mililitros / ML_POR_LITRO;

  // O consumo é zerado, não a viagem inteira: a distância continua válida
  // mesmo quando o contador de combustível veio corrompido.
  return { km, litros: litros <= km * LITROS_POR_KM_MAX ? litros : 0 };
}

/**
 * Indicadores de operação por veículo, a partir da telemetria do período.
 *
 * O cadastro (`/vehicles`) entrega a ficha: placa, prefixo, modelo. Consumo,
 * odômetro atual e faixas de condução vivem em `con_telemetry`, viagem a
 * viagem. Este hook faz a ponte, agregando as viagens por veículo.
 *
 * A agregação é ponderada por distância, não uma média simples das viagens.
 * Uma viagem de 2 km e outra de 200 km não valem o mesmo: média simples deixa
 * o trecho curto — que costuma ter consumo pior, porque inclui a partida a
 * frio — pesar tanto quanto o trecho longo, e distorce o número da frota.
 */

export type IndicadoresVeiculo = {
  /** Consumo médio ponderado pela distância, em km/l. */
  kml: number | null;
  /** Odômetro da viagem mais recente. */
  odometro: number | null;
  /** Distância percorrida no período. */
  distanciaKm: number;
  /** Combustível consumido no período, em litros. */
  litros: number;
  viagens: number;
  /** Fração do tempo em movimento na faixa econômica, de 0 a 100. */
  faixaVerdePct: number | null;
  /** Fração do tempo ligado com o veículo parado. */
  motorLigadoParadoPct: number | null;
  /** Fração do tempo sob chuva — distorce comparação de consumo. */
  chuvaPct: number | null;
  contagemFreadas: number;
  contagemAceleracoes: number;
  excessos: number;
  /** Instante da última viagem registrada. */
  ultimaViagem: string | null;
  /** Viagens descartadas por invariante físico. */
  descartadas: number;
  /* Somas em segundos, para compor os indicadores de condução. */
  segEmbalo: number;
  segAcimaVerde: number;
  segPiloto: number;
  segRetarder: number;
  segFaixas: number;
  /** Tempo nas cinco faixas ideais, em segundos. */
  segIdeal: number;
  /**
   * Percentual de tempo ideal sobre o tempo classificado — o indicador que o
   * painel do fleet-insights chama de "ideal".
   */
  idealPct: number | null;
};

/** Últimos 30 dias, que é o recorte usual de fechamento. */
function janelaPadrao(dias: number) {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  return { inicio: iso(inicio), fim: iso(fim) };
}

export function useIndicadoresPorVeiculo(
  dias = 30,
  /**
   * Veículos a consultar.
   *
   * O endpoint de telemetria filtra por veículo, não por empresa — então o
   * recorte da empresa ativa entra por aqui, com os ids que a tela já carregou.
   * Sem a lista, a consulta traria a frota inteira e o gestor veria número de
   * outro cliente.
   */
  veiculoIds?: string[],
) {
  const filtro = useMemo(() => {
    const j = janelaPadrao(dias);
    /**
     * Página cheia, e a tela segue o cursor conforme precisa.
     *
     * A frota gera mais de um milhão de viagens em 30 dias. Carregar tudo de
     * uma vez travaria o navegador, e parar na primeira página daria consumo
     * de alguns veículos e não de outros — sem o usuário saber quais ficaram
     * de fora.
     *
     * O caminho é carregar por partes e declarar o que já entrou na conta, que
     * é o que o aviso na tela faz.
     */
    return {
      inicio: j.inicio,
      fim: j.fim,
      limite: 5000,
      // Lote limitado: a URL tem teto de tamanho, e mil ids passariam disso.
      veiculos: veiculoIds?.length ? veiculoIds.slice(0, 300) : undefined,
    };
  }, [dias, veiculoIds?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Só consulta quando há veículos: sem eles, a chamada traria a base inteira.
  const q = useRelatorioCursor<TelemetriaApi>(
    "telemetry",
    filtro,
    !usandoMock() && Boolean(veiculoIds?.length),
  );

  /** Mapa de `unit_id` para os indicadores agregados. */
  const porVeiculo = useMemo(() => {
    const mapa = new Map<string, IndicadoresVeiculo>();
    if (usandoMock()) return mapa;

    // Acumuladores separados: a ponderação exige somar distância e litros
    // antes de dividir, não a média das razões.
    const acc = new Map<
      string,
      {
        km: number;
        litros: number;
        viagens: number;
        segVerde: number;
        segTotal: number;
        segOcioso: number;
        segChuva: number;
        segEmbalo: number;
        segAcimaVerde: number;
        segPiloto: number;
        segRetarder: number;
        segFaixas: number;
        segIdeal: number;
        freadas: number;
        aceleracoes: number;
        excessos: number;
        odometro: number | null;
        ultima: string | null;
        /** Viagens descartadas por invariante físico, para a tela declarar. */
        descartadas: number;
      }
    >();

    for (const t of q.registros) {
      const id = String(t.unit_id);
      const a = acc.get(id) ?? {
        km: 0,
        litros: 0,
        viagens: 0,
        segVerde: 0,
        segTotal: 0,
        segOcioso: 0,
        segChuva: 0,
        segEmbalo: 0,
        segAcimaVerde: 0,
        segPiloto: 0,
        segRetarder: 0,
        segFaixas: 0,
        segIdeal: 0,
        freadas: 0,
        aceleracoes: 0,
        excessos: 0,
        odometro: null,
        ultima: null,
        descartadas: 0,
      };

      // Converte e valida antes de somar: viagem impossível não entra na conta.
      const ok = viagemPlausivel(
        t.distance_traveled ?? 0,
        t.total_time ?? 0,
        t.fuel_used ?? 0,
      );
      if (!ok) {
        a.descartadas += 1;
        acc.set(id, a);
        continue;
      }

      a.km += ok.km;
      a.litros += ok.litros;
      a.viagens += 1;
      /**
       * Denominador: a soma das **13 faixas**, como no `ss-worker-fleet-insights`.
       *
       * Não é `time_moving`. Três das treze acontecem com o veículo parado —
       * marcha lenta, parado acelerando e parado ligado produtivo — e portanto
       * ficam fora do tempo em movimento.
       *
       * A diferença não é marginal. Marcha lenta sozinha representava 25% do
       * tempo da frota no piloto, e incluí-la levou o indicador de condução
       * ideal de 45,47% para 55,32% em julho de 2026. O irregular não piorou:
       * passou a ser medido.
       *
       * As treze, na classificação oficial:
       *
       *   Ideal (5)      verde, inércia, extra econômica, eco-roll,
       *                  baixa velocidade
       *   Irregular (8)  marcha lenta, parado ligado produtivo,
       *                  batendo transmissão, amarela, vermelha,
       *                  parado acelerando, banguela, tolerância
       *
       * Elas não somam 100% do tempo total — sobrou 1,09% em julho. "Ideal
       * mais irregular igual a cem" é consequência de escolher esta soma como
       * denominador, não propriedade do dado.
       *
       * Quem calcula as faixas é o **rastreador**, não o servidor: os limites
       * de RPM vão por comando remoto e ficam em `device_config`. Faixa que
       * parece errada tem causa na configuração daquele equipamento.
       */
      const faixas =
        // Ideal
        (t.time_green ?? 0) +
        (t.time_inercia ?? 0) +
        (t.time_extra_eco ?? 0) +
        (t.time_eco_roll ?? 0) +
        (t.time_low_speed ?? 0) +
        // Irregular
        (t.time_stop_engine_on ?? 0) +
        (t.time_stop_engine_on_productive ?? 0) +
        (t.time_blue ?? 0) +
        (t.time_yellow ?? 0) +
        (t.time_red ?? 0) +
        (t.time_stop_accel ?? 0) +
        (t.time_banguela ?? 0) +
        (t.time_tolerancia ?? 0);

      a.segFaixas += faixas;

      // Ideal e irregular, para os indicadores agregados baterem com o painel.
      a.segIdeal +=
        (t.time_green ?? 0) +
        (t.time_inercia ?? 0) +
        (t.time_extra_eco ?? 0) +
        (t.time_eco_roll ?? 0) +
        (t.time_low_speed ?? 0);

      // Andar sem consumir: inércia, eco-roll e retarder.
      a.segEmbalo += (t.time_inercia ?? 0) + (t.time_eco_roll ?? 0) + (t.time_retarder ?? 0);
      a.segAcimaVerde += (t.time_yellow ?? 0) + (t.time_red ?? 0);
      a.segPiloto += t.time_autopilot ?? 0;
      a.segRetarder += t.time_retarder ?? 0;

      // Verde e extra econômica somam: as duas são condução na faixa desejada,
      // e separá-las na lista da frota seria detalhe demais.
      a.segVerde += (t.time_green ?? 0) + (t.time_extra_eco ?? 0);
      a.segTotal += t.total_time ?? 0;
      a.segOcioso += t.time_stop_engine_on ?? 0;
      a.segChuva += t.time_raining ?? 0;
      a.freadas += t.count_hard_brake ?? 0;
      a.aceleracoes += t.count_hard_acel ?? 0;
      a.excessos += (t.count_speed_violation_l2 ?? 0) + (t.count_speed_violation_l3 ?? 0);

      // Odômetro da viagem mais recente, não o maior: troca de equipamento
      // pode ter deixado um valor alto de outro aparelho no histórico.
      if (!a.ultima || (t.start_time ?? "") > a.ultima) {
        a.ultima = t.start_time ?? a.ultima;
        a.odometro = t.end_odometer != null ? Math.round(t.end_odometer / METROS_POR_KM) : a.odometro;
      }

      acc.set(id, a);
    }

    for (const [id, a] of acc) {
      const pct = (parte: number, total: number) =>
        total > 0 ? Math.round((parte / total) * 1000) / 10 : null;

      mapa.set(id, {
        // Ponderado: soma dos quilômetros sobre soma dos litros.
        kml: a.litros > 0 ? Math.round((a.km / a.litros) * 100) / 100 : null,
        odometro: a.odometro,
        distanciaKm: Math.round(a.km * 10) / 10,
        litros: Math.round(a.litros * 10) / 10,
        viagens: a.viagens,
        faixaVerdePct: pct(a.segVerde, a.segFaixas),
        motorLigadoParadoPct: pct(a.segOcioso, a.segTotal),
        chuvaPct: pct(a.segChuva, a.segTotal),
        contagemFreadas: a.freadas,
        contagemAceleracoes: a.aceleracoes,
        excessos: a.excessos,
        ultimaViagem: a.ultima,
        descartadas: a.descartadas,
        segEmbalo: a.segEmbalo,
        segAcimaVerde: a.segAcimaVerde,
        segPiloto: a.segPiloto,
        segRetarder: a.segRetarder,
        segFaixas: a.segFaixas,
        segIdeal: a.segIdeal,
        idealPct: pct(a.segIdeal, a.segFaixas),
      });
    }

    /**
     * Diagnóstico impresso uma vez por carga.
     *
     * Rastrear do dado até a tela por tentativa custou várias rodadas. Com o
     * primeiro registro no console dá para comparar o que o servidor devolveu
     * com o que o código espera, campo a campo, sem adivinhar.
     */
    if (q.registros.length && mapa.size === 0) {
      // eslint-disable-next-line no-console
      console.warn("[indicadores] viagens recebidas mas nenhum veículo agregado", {
        recebidas: q.registros.length,
        primeiro: q.registros[0],
        idsEsperados: veiculoIds?.slice(0, 3),
      });
    }

    return mapa;
  }, [q.registros]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    porVeiculo,
    /**
     * Diagnóstico da consulta, para a tela dizer o que houve.
     *
     * "Nenhuma viagem" e "a consulta nem saiu" parecem iguais na tela e têm
     * causas opostas — sem distinguir, a investigação vira tentativa e erro.
     */
    diagnostico: {
      consultou: Boolean(veiculoIds?.length) && !usandoMock(),
      veiculosConsultados: veiculoIds?.length ?? 0,
      periodo: `${filtro.inicio} a ${filtro.fim}`,
      status: (q.error as { status?: number } | null)?.status ?? null,
    },
    carregando: q.isPending,
    erro: q.error,
    /** Quantas viagens entraram na conta, para a tela declarar a base. */
    viagensAnalisadas: q.registros.length,
    /** Descartadas por invariante físico, somadas de todos os veículos. */
    viagensDescartadas: [...porVeiculo.values()].reduce((a, v) => a + v.descartadas, 0),
    /** true quando há mais viagens no período do que as carregadas. */
    parcial: q.hasNextPage,
    carregarMais: q.fetchNextPage,
    carregandoMais: q.isFetchingNextPage,
  };
}

/**
 * Os oito indicadores de condução, na escala de estrelas da interface.
 *
 * Cada um sai de uma relação entre campos da telemetria. Onde o numerador
 * existe mas o denominador é zero, o resultado é nulo — a tela mostra "não
 * avaliado", que é diferente de nota zero.
 *
 * `mp` e `av` invertem a escala: quanto menos motor ligado parado e menos
 * aceleração acima da faixa verde, melhor. Sem inverter, o pior veículo
 * apareceria com cinco estrelas.
 */
export function indicadoresDeConducao(v: IndicadoresVeiculo): IndicadoresConducao {
  const pct = (parte: number, total: number) => (total > 0 ? (parte / total) * 100 : null);

  return {
    // Tempo na faixa verde sobre o tempo em faixa.
    iv: notaDePercentual(v.faixaVerdePct),
    // Inércia, eco-roll e retarder: andar sem consumir.
    ae: notaDePercentual(pct(v.segEmbalo, v.segFaixas)),
    mp: notaDePercentual(v.motorLigadoParadoPct, false),
    // Amarela e vermelha somadas.
    av: notaDePercentual(pct(v.segAcimaVerde, v.segFaixas), false),
    pa: notaDePercentual(pct(v.segPiloto, v.segFaixas)),
    // Violações por 100 km, convertidas em nota: 0 violação vira 5 estrelas,
    // 10 ou mais viram zero.
    ev:
      v.distanciaKm > 0
        ? Math.max(0, Math.round((5 - (v.excessos / v.distanciaKm) * 100 * 0.5) * 10) / 10)
        : null,
    // Retarder e freio motor.
    fm: notaDePercentual(pct(v.segRetarder, v.segFaixas)),
    // Sem campo equivalente na telemetria por viagem.
    pac: null,
  };
}

/**
 * Converte um percentual em nota de 0 a 5.
 *
 * A tela da frota usa estrelas, na mesma escala da tela de motoristas. Manter a
 * conversão aqui evita cada tela inventar a própria régua e mostrar notas
 * diferentes para o mesmo desempenho.
 */
export function notaDePercentual(pct: number | null, maiorEhMelhor = true): number | null {
  if (pct == null) return null;
  const v = maiorEhMelhor ? pct : 100 - pct;
  return Math.round((Math.max(0, Math.min(100, v)) / 100) * 5 * 10) / 10;
}
