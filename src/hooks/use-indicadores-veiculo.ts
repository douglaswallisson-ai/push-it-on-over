import { useMemo } from "react";
import { useRelatorioCursor, type TelemetriaApi } from "@/lib/relatorios-api";
import { usandoMock } from "@/lib/modo";

/* ------------------------------------------------------------------ */
/* Unidades e travas de invariante físico                              */
/* ------------------------------------------------------------------ */

/**
 * A API já converte as unidades; a tabela não.
 *
 * `mova.con_telemetry` guarda distância em metros e combustível em mililitros,
 * mas `TelemetryResponse` devolve **quilômetro e litro** — a conversão acontece
 * no servidor. Tempo continua em segundos nos dois.
 *
 * Converter de novo aqui transformava 50 km em 0,05 km, e todo o consumo da
 * frota virava nulo. A documentação do worker descreve a tabela, não a resposta
 * da API, e eu apliquei uma na outra.
 */

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

function viagemPlausivel(km: number, segundos: number, litros: number) {
  if (km < 0) return false;

  const horas = segundos / 3600;
  if (horas > 0 && km / horas > VELOCIDADE_MAX_KMH) return false;

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
        segMovimento: number;
        segVerde: number;
        segTotal: number;
        segOcioso: number;
        segChuva: number;
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
        segMovimento: 0,
        segVerde: 0,
        segTotal: 0,
        segOcioso: 0,
        segChuva: 0,
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
       * Denominador das faixas: a soma das próprias faixas, não `time_moving`.
       *
       * O relatório oficial usa
       * `verde + extra_eco + amarela + vermelha + inércia + banguela + tolerância`.
       * A tolerância não aparece como coluna em lugar nenhum, mas entra na
       * conta — e sem ela os percentuais saem de 10 a 17% inflados.
       */
      const faixas =
        (t.time_green ?? 0) +
        (t.time_extra_eco ?? 0) +
        (t.time_yellow ?? 0) +
        (t.time_red ?? 0) +
        (t.time_inercia ?? 0) +
        (t.time_banguela ?? 0) +
        (t.time_tolerancia ?? 0);
      a.segMovimento += faixas;

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
        a.odometro = t.end_odometer ?? a.odometro;
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
        faixaVerdePct: pct(a.segVerde, a.segMovimento),
        motorLigadoParadoPct: pct(a.segOcioso, a.segTotal),
        chuvaPct: pct(a.segChuva, a.segTotal),
        contagemFreadas: a.freadas,
        contagemAceleracoes: a.aceleracoes,
        excessos: a.excessos,
        ultimaViagem: a.ultima,
        descartadas: a.descartadas,
      });
    }

    return mapa;
  }, [q.registros]);

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
