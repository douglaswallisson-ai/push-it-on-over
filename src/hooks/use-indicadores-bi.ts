import { useMemo } from "react";
import { useRelatorioCompleto } from "@/lib/relatorios-api";
import { usandoMock } from "@/lib/modo";

/**
 * Indicadores por veículo, nas mesmas fontes que o BI usa.
 *
 * As telas da plataforma liam `con_telemetry` — uma linha por viagem. O BI lê
 * as tabelas consolidadas por dia, e os dois **não batem**: `con_driver_h_km`
 * é superconjunto de `con_telemetry`, com 14,8% mais quilômetro em julho de
 * 2026. A diferença vem de pares (veículo, condutor) que só existem lá, e de
 * viagem que cruza a meia-noite, contada inteira no dia de início.
 *
 * Como o cliente confere o número contra o BI, é o BI que define a verdade.
 *
 *     km, combustível, horas   driver-km-fuel-hours/cursor → con_driver_h_km
 *     faixas de condução       rpm-band-time/cursor        → con_telemetry_day
 *
 * Os dois endpoints já entregam convertido: quilômetro, litro e hora. Não há
 * divisão por mil aqui — diferente do endpoint de telemetria por viagem, que
 * devolve o valor bruto da tabela.
 */

export type IndicadoresBiVeiculo = {
  /** Consumo médio, em km/l. */
  kml: number | null;
  /** Quilometragem total do período. */
  km: number;
  /** Quilometragem das linhas com combustível plausível — base do km/l. */
  kmFiltrado: number;
  litros: number;
  horas: number;
  /** Velocidade média: quilômetro total sobre hora. */
  velocidadeMedia: number | null;
  /**
   * Alguma linha do período teve distância e combustível substituídos pelos
   * valores estimados.
   *
   * O backend faz a troca quando o combustível do dia vem zerado, e marca
   * `is_estimated`. O BI não lê essa marca e soma tudo junto; aqui ela é
   * preservada para a tela poder declarar.
   */
  temEstimado: boolean;
  dias: number;
};

/** Percentual de tempo em cada faixa, na classificação do BI. */
export type FaixasBiVeiculo = {
  /** Parado com motor ligado — **inclui** o parado produtivo. */
  paradoLigadoPct: number | null;
  /** Complemento do parado ligado. */
  eficienciaOperacionalPct: number | null;
  verdePct: number | null;
  amarelaPct: number | null;
  vermelhaPct: number | null;
  inerciaPct: number | null;
  /** `blue` — batendo transmissão. */
  batendoPct: number | null;
  /** Soma das onze colunas, em segundos. */
  tempoClassificado: number;
};

type LinhaKmFuel = {
  unit_id?: number | null;
  driver_id?: number | null;
  dt?: string | null;
  distance_traveled_hist?: number | null;
  distance_traveled_hist_filtrado?: number | null;
  used_fuel_hist?: number | null;
  time_traveled_hist?: number | null;
  is_estimated?: boolean | null;
};

/**
 * Nomes da **API**, não das colunas de `con_telemetry_day`.
 *
 * O endpoint renomeia na consulta (`time_green AS green`, `time_inercia AS
 * inercia`…). Com os nomes da tabela, as quatro faixas chegavam como
 * `undefined`, somavam zero, e a tela mostrava todo veículo com 0% — só
 * parado ligado e total, que têm o mesmo nome nos dois lados, apareciam. O BI
 * (`useRpmBandTime.js`) já lê estes nomes; ver a nota de divergência das
 * faixas no vault.
 */
type LinhaFaixa = {
  unit_id?: number | null;
  stop_engine_on?: number | null;
  total_time?: number | null;
  green?: number | null;
  yellow?: number | null;
  red?: number | null;
  inercia?: number | null;
  blue?: number | null;
};

function janela(dias: number) {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  return { inicio: iso(inicio), fim: iso(fim) };
}

export function useIndicadoresBi(dias = 30, veiculoIds?: string[]) {
  const filtro = useMemo(() => {
    const j = janela(dias);
    return {
      inicio: j.inicio,
      fim: j.fim,
      limite: 5000,
      // A frota inteira. A divisão em lotes (a URL tem teto) é feita pela
      // busca completa, que consulta todos eles — antes o corte em 300 aqui
      // deixava o resto da frota sem indicador.
      veiculos: veiculoIds?.length ? veiculoIds : undefined,
    };
  }, [dias, veiculoIds?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const habilitado = !usandoMock() && Boolean(veiculoIds?.length);

  // O período inteiro, não a primeira página: são somas por veículo, e uma
  // soma parcial passa por total sem que ninguém perceba.
  const kmQ = useRelatorioCompleto<LinhaKmFuel>("driver-km-fuel-hours", filtro, habilitado);
  const faixasQ = useRelatorioCompleto<LinhaFaixa>("rpm-band-time", filtro, habilitado);

  const porVeiculo = useMemo(() => {
    const mapa = new Map<string, IndicadoresBiVeiculo>();

    const acc = new Map<
      string,
      { km: number; kmF: number; litros: number; horas: number; est: boolean; dias: Set<string> }
    >();

    for (const l of kmQ.registros) {
      const id = String(l.unit_id ?? "");
      if (!id) continue;

      const a = acc.get(id) ?? { km: 0, kmF: 0, litros: 0, horas: 0, est: false, dias: new Set<string>() };
      a.km += l.distance_traveled_hist ?? 0;
      a.kmF += l.distance_traveled_hist_filtrado ?? 0;
      a.litros += l.used_fuel_hist ?? 0;
      a.horas += l.time_traveled_hist ?? 0;
      a.est = a.est || Boolean(l.is_estimated);
      if (l.dt) a.dias.add(l.dt);
      acc.set(id, a);
    }

    for (const [id, a] of acc) {
      mapa.set(id, {
        // Quilômetro **filtrado** sobre litro, como o BI faz. O filtrado exclui
        // linhas com combustível fora de 0 a 500.000 mL — leitura corrompida
        // do equipamento, que distorceria o consumo.
        kml: a.litros > 0 ? Math.round((a.kmF / a.litros) * 100) / 100 : null,
        km: Math.round(a.km * 10) / 10,
        kmFiltrado: Math.round(a.kmF * 10) / 10,
        litros: Math.round(a.litros * 10) / 10,
        horas: Math.round(a.horas * 10) / 10,
        // Velocidade usa o quilômetro **total**, não o filtrado. A assimetria
        // é do BI e está preservada de propósito: mudar aqui faria a tela
        // divergir do que o cliente confere.
        velocidadeMedia: a.horas > 0 ? Math.round((a.km / a.horas) * 10) / 10 : null,
        temEstimado: a.est,
        dias: a.dias.size,
      });
    }

    return mapa;
  }, [kmQ.registros]);

  const faixasPorVeiculo = useMemo(() => {
    const mapa = new Map<string, FaixasBiVeiculo>();

    const acc = new Map<
      string,
      { parado: number; total: number; verde: number; amarela: number; vermelha: number; inercia: number; azul: number }
    >();

    for (const l of faixasQ.registros) {
      const id = String(l.unit_id ?? "");
      if (!id) continue;

      const a = acc.get(id) ?? { parado: 0, total: 0, verde: 0, amarela: 0, vermelha: 0, inercia: 0, azul: 0 };
      // `stop_engine_on` já vem somado com o parado produtivo pelo backend.
      a.parado += l.stop_engine_on ?? 0;
      // `total_time` é a soma das onze colunas. Eco-roll e baixa velocidade
      // ficam de fora — é a classificação do BI, diferente das treze faixas
      // do AI Ops Advisor.
      a.total += l.total_time ?? 0;
      a.verde += l.green ?? 0;
      a.amarela += l.yellow ?? 0;
      a.vermelha += l.red ?? 0;
      a.inercia += l.inercia ?? 0;
      a.azul += l.blue ?? 0;
      acc.set(id, a);
    }

    const pct = (parte: number, total: number) =>
      total > 0 ? Math.round((parte / total) * 1000) / 10 : null;

    for (const [id, a] of acc) {
      const paradoPct = pct(a.parado, a.total);
      mapa.set(id, {
        paradoLigadoPct: paradoPct,
        // Complemento exato do parado ligado — é a definição do BI. Entram nela
        // parado acelerando, amarela e vermelha, o que é questionável mas
        // preservado para o número bater.
        eficienciaOperacionalPct: paradoPct != null ? Math.round((100 - paradoPct) * 10) / 10 : null,
        verdePct: pct(a.verde, a.total),
        amarelaPct: pct(a.amarela, a.total),
        vermelhaPct: pct(a.vermelha, a.total),
        inerciaPct: pct(a.inercia, a.total),
        batendoPct: pct(a.azul, a.total),
        tempoClassificado: a.total,
      });
    }

    return mapa;
  }, [faixasQ.registros]);

  return {
    porVeiculo,
    faixasPorVeiculo,
    carregando: kmQ.isPending || faixasQ.isPending,
    erro: kmQ.error ?? faixasQ.error,
    linhasKm: kmQ.registros.length,
    linhasFaixa: faixasQ.registros.length,
    /** Algum veículo teve valor estimado no período. */
    temEstimado: [...porVeiculo.values()].some((v) => v.temEstimado),
  };
}
