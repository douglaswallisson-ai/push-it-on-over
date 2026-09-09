import { useMemo } from "react";
import { useRelatorioCursor, type TelemetriaApi } from "@/lib/relatorios-api";
import { usandoMock } from "@/lib/modo";

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
};

/** Últimos 30 dias, que é o recorte usual de fechamento. */
function janelaPadrao(dias: number) {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  return { inicio: iso(inicio), fim: iso(fim) };
}

export function useIndicadoresPorVeiculo(dias = 30) {
  const filtro = useMemo(() => {
    const j = janelaPadrao(dias);
    // Limite alto porque a agregação precisa de todas as viagens do período —
    // uma amostra parcial daria consumo de alguns veículos e não de outros,
    // sem o usuário saber quais.
    return { inicio: j.inicio, fim: j.fim, limite: 1000 };
  }, [dias]);

  const q = useRelatorioCursor<TelemetriaApi>("telemetry", filtro, !usandoMock());

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
      };

      a.km += t.distance_traveled ?? 0;
      a.litros += t.fuel_used ?? 0;
      a.viagens += 1;
      a.segMovimento += t.time_moving ?? 0;
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
      });
    }

    return mapa;
  }, [q.registros]);

  return {
    porVeiculo,
    carregando: q.isPending,
    erro: q.error,
    /** Quantas viagens entraram na conta, para a tela declarar a base. */
    viagensAnalisadas: q.registros.length,
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
