import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  execucoesQuery,
  modelosQuery,
  parametrosCatalogoQuery,
  regrasAjusteQuery,
  sinaisOperacaoQuery,
  veiculosApiQuery,
  veiculosQuery,
  vinculosModeloQuery,
  dtcQuery,
} from "@/lib/queries";
import { recomendarPorDTC } from "@/lib/dtc";
import { calcularPreventivas, classificarOperacao } from "@/lib/preventiva";
import type { ModeloVeiculo, PreventivaPrevista, TipoOperacao, Veiculo } from "@/types";
import { usandoMock } from "@/lib/modo";
import { useIndicadoresPorVeiculo } from "@/hooks/use-indicadores-veiculo";

/**
 * Cálculo da preventiva de toda a frota.
 *
 * Vive num hook porque duas superfícies consomem o mesmo resultado: a aba
 * "Plano preventivo", que mostra item a item, e o quadro kanban, que precisa
 * saber em qual coluna cada placa entra. Calcular nos dois lugares abriria a
 * porta para o kanban e a lista discordarem sobre o mesmo veículo.
 */

export type PreventivaVeiculo = {
  veiculo: Veiculo;
  modelo: ModeloVeiculo | undefined;
  operacao: TipoOperacao;
  sinais: Record<string, number>;
  preventivas: PreventivaPrevista[];
  /** Sem modelo vinculado ou sem parâmetro com intervalo utilizável. */
  semCatalogo: boolean;
};

export function usePreventivaFrota(garagem?: string) {
  /**
   * Frota, da API quando disponível.
   *
   * A preventiva depende de odômetro real: com o mock, o cálculo roda sobre
   * uma frota que não existe. E o odômetro do cadastro é o **inicial** — o
   * atual vem da telemetria, e é o que define se o intervalo venceu.
   */
  const mockVeicQ = useQuery(veiculosQuery(1, 200));
  const apiVeicQ = useQuery(veiculosApiQuery(1, 500));
  const veiculosQ = usandoMock() ? mockVeicQ : apiVeicQ;

  const indicadores = useIndicadoresPorVeiculo(30);
  const modelosQ = useQuery(modelosQuery());
  const parametrosQ = useQuery(parametrosCatalogoQuery());
  const execucoesQ = useQuery(execucoesQuery());
  const regrasQ = useQuery(regrasAjusteQuery());
  const sinaisQ = useQuery(sinaisOperacaoQuery());
  const vinculosQ = useQuery(vinculosModeloQuery());
  const dtcQ = useQuery(dtcQuery());

  const porVeiculo = useMemo<PreventivaVeiculo[]>(() => {
    /**
     * Frota com o odômetro atual, não o de cadastro.
     *
     * `tracked_unit.initial_odometer` é o valor de quando o equipamento foi
     * instalado — usá-lo faria a preventiva calcular sobre uma quilometragem
     * de meses atrás, e nada venceria nunca. O atual vem da última viagem.
     */
    const veiculos = (veiculosQ.data?.items ?? []).map((v) => {
      const ind = indicadores.porVeiculo.get(v.id);
      return ind?.odometro != null ? { ...v, odometro: ind.odometro } : v;
    });
    const modelos = modelosQ.data ?? [];
    const parametros = parametrosQ.data ?? [];
    const execucoes = execucoesQ.data ?? [];
    const regras = regrasQ.data ?? [];
    const sinais = sinaisQ.data ?? {};
    const vinculos = vinculosQ.data ?? {};
    const codigos = dtcQ.data ?? [];

    return veiculos
      .filter((v) => !garagem || v.garagemId === garagem)
      .map((v) => {
        const vinculo = vinculos[v.id];
        const modelo = modelos.find((m) => m.id === vinculo?.modeloId);
        const sinaisV = sinais[v.id] ?? {};

        // Códigos de falha do veículo viram recomendações, e as de confiança
        // alta antecipam o item de manutenção do sistema afetado.
        const recomendacoes = recomendarPorDTC(codigos.filter((d) => d.veiculoId === v.id));

        const preventivas = calcularPreventivas(
          { ...v, modeloId: vinculo?.modeloId, montadoraId: vinculo?.montadoraId },
          modelo,
          parametros,
          execucoes,
          regras,
          sinaisV,
          recomendacoes,
        );

        return {
          veiculo: v,
          modelo,
          operacao: classificarOperacao({
            marchaLentaPct: sinaisV.parado_motor_ligado,
            velocidadeMediaKmh: sinaisV.velocidade_media,
            paradasPorDia: sinaisV.paradas_por_dia,
          }),
          sinais: sinaisV,
          preventivas,
          semCatalogo: !modelo || preventivas.length === 0,
        };
      })
      .sort((a, b) => (b.preventivas[0]?.consumidoPct ?? 0) - (a.preventivas[0]?.consumidoPct ?? 0));
  }, [
    veiculosQ.data,
    indicadores.porVeiculo,
    modelosQ.data,
    parametrosQ.data,
    execucoesQ.data,
    regrasQ.data,
    sinaisQ.data,
    vinculosQ.data,
    dtcQ.data,
    garagem,
  ]);

  return {
    porVeiculo,
    carregando: veiculosQ.isPending || modelosQ.isPending || parametrosQ.isPending || execucoesQ.isPending,
    erro: veiculosQ.error ?? modelosQ.error ?? parametrosQ.error,
    recarregar: () => {
      veiculosQ.refetch();
      execucoesQ.refetch();
    },
  };
}
