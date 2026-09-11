import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Frota } from "@/lib/api";
import { eventosApiQuery, posicoesQuery, veiculosApiQuery } from "@/lib/queries";
import { useIndicadoresPorVeiculo } from "@/hooks/use-indicadores-veiculo";
import { usandoMock } from "@/lib/modo";
import type { ResumoOperacao } from "@/types";

/**
 * Resumo da operação para a tela inicial.
 *
 * Não existe endpoint que devolva isso pronto — o `/api/frota/resumo` que eu
 * havia declarado nunca existiu no servidor. Então os números são compostos a
 * partir do que a API entrega de fato:
 *
 *     veículos ativos   contagem de `/vehicles`
 *     alertas abertos   resumo de `/events`, campo `pending`
 *     disponibilidade   veículos comunicando sobre o total
 *     consumo médio     `/indicators`, campo `kml`
 *
 * Compor aqui em vez de esperar um endpoint novo evita a tela inicial ficar
 * mostrando número de exemplo enquanto o resto do sistema já é real — que é o
 * pior cenário, porque ninguém desconfia da primeira tela.
 */
export function useResumoFrota() {
  const mockQ = useQuery({
    queryKey: ["frota", "resumo", "mock"],
    queryFn: () => Frota.resumo(),
    enabled: usandoMock(),
  });

  const veiculosQ = useQuery(veiculosApiQuery(1, 500));
  const posicoesQ = useQuery(posicoesQuery());
  const eventosQ = useQuery(eventosApiQuery({ only_pending: true, limit: 1 }));

  /**
   * Consumo médio, da telemetria.
   *
   * Vinha de `/indicators`, que não está publicado no servidor e responde 404.
   * O cartão mostrava zero como se a frota rodasse a 0 km/l — e zero parece
   * medição, não ausência.
   *
   * A telemetria por viagem tem o dado e já está no ar.
   */
  const idsDaFrota = useMemo(
    () => (veiculosQ.data?.items ?? []).map((v) => v.id),
    [veiculosQ.data],
  );
  const telemetria = useIndicadoresPorVeiculo(30, idsDaFrota);

  const resumo = useMemo<ResumoOperacao | undefined>(() => {
    if (usandoMock()) return mockQ.data;

    const veiculos = veiculosQ.data?.items ?? [];
    if (!veiculos.length) return undefined;

    // Comunicando nos últimos 20 minutos. Janela curta demais marcaria como
    // indisponível quem só perdeu sinal num túnel.
    const limite = Date.now() - 20 * 60_000;
    const comunicando = (posicoesQ.data ?? []).filter(
      (p) => new Date(p.atualizadoEm).getTime() > limite,
    ).length;

    const eventos = eventosQ.data as { summary?: { pending: number } } | undefined;

    // Consumo da frota: quilômetros somados sobre litros somados, não a média
    // das médias. Veículo que rodou 10 km não pesa igual ao que rodou 3.000.
    const vals = [...telemetria.porVeiculo.values()];
    const kmTotal = vals.reduce((a, v) => a + v.distanciaKm, 0);
    const litrosTotal = vals.reduce((a, v) => a + v.litros, 0);

    return {
      veiculosAtivos: veiculos.length,
      alertasAbertos: eventos?.summary?.pending ?? 0,
      disponibilidade: veiculos.length ? Math.round((comunicando / veiculos.length) * 1000) / 10 : 0,
      // Nulo quando não há medição — zero diria que a frota roda a 0 km/l.
      consumoMedio: litrosTotal > 0 ? Math.round((kmTotal / litrosTotal) * 100) / 100 : null,
      // Custo por km depende de `cost_km` no cadastro do veículo e de custo
      // operacional, que ainda não é exposto. Zero em vez de número inventado.
      custoPorKm: null,
    };
  }, [mockQ.data, veiculosQ.data, posicoesQ.data, eventosQ.data, telemetria.porVeiculo]);

  return {
    resumo,
    carregando: usandoMock() ? mockQ.isPending : veiculosQ.isPending,
    erro: usandoMock() ? mockQ.error : veiculosQ.error,
    recarregar: () => {
      veiculosQ.refetch();
      posicoesQ.refetch();
    },
  };
}
