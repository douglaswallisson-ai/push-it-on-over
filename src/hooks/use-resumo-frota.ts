import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Frota } from "@/lib/api";
import { eventosApiQuery, posicoesQuery, veiculosApiQuery } from "@/lib/queries";
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

  // Consumo médio: a tela Início usa a série diária do Gerencial (uma consulta, mesma tabela e regra).
  // Antes este hook também puxava os relatórios do mês inteiro de todos os veículos, em páginas
  // (driver-km-fuel-hours e rpm-band-time), só como reserva do mesmo número — era o que mais
  // pesava no banco ao entrar na plataforma (TI, 11/10/2026).

  const resumo = useMemo<ResumoOperacao | undefined>(() => {
    if (usandoMock()) return mockQ.data;

    const veiculos = veiculosQ.data?.items ?? [];
    if (!veiculos.length) return undefined;

    // Comunicando nos últimos 20 minutos. Janela curta demais marcaria como
    // indisponível quem só perdeu sinal num túnel.
    //
    // Só conta posição de veículo que está no denominador. `/positions` não
    // recebe o filtro de empresa e devolve todo o escopo do usuário; com a
    // lista de veículos filtrada pela empresa ativa, o numerador trazia as
    // outras empresas e a disponibilidade passava de 1.700%.
    const limite = Date.now() - 20 * 60_000;
    const daFrota = new Set(veiculos.map((v) => v.id));
    const comunicando = (posicoesQ.data ?? []).filter(
      (p) => daFrota.has(p.veiculoId) && new Date(p.atualizadoEm).getTime() > limite,
    ).length;

    const eventos = eventosQ.data as { summary?: { pending: number } } | undefined;

    return {
      veiculosAtivos: veiculos.length,
      alertasAbertos: eventos?.summary?.pending ?? 0,
      disponibilidade: veiculos.length
        ? Math.round((comunicando / veiculos.length) * 1000) / 10
        : 0,
      // Vem da série do Gerencial na tela Início (buildKpis); nulo aqui.
      consumoMedio: null,
      // Custo por km depende de `cost_km` no cadastro do veículo e de custo
      // operacional, que ainda não é exposto. Zero em vez de número inventado.
      custoPorKm: null,
    };
  }, [mockQ.data, veiculosQ.data, posicoesQ.data, eventosQ.data]);

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
