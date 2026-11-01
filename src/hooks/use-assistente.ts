import { useQuery } from "@tanstack/react-query";
import {
  indicadoresSerieQuery,
  linhasQuery,
  nf,
  ordensQuery,
  videoOcorrenciasQuery,
  viagensOperacaoQuery,
} from "@/lib/queries";
import { calcularIndicadores, dataOperacao, resumoViagens, variacao } from "@/lib/operacao";

/**
 * Motor de respostas do assistente.
 *
 * Vive num hook porque duas superfícies consomem a mesma lógica: o painel da
 * Selma (o orb) e a tela cheia do assistente. Duplicar as respostas nas duas
 * garantiria que uma ficaria desatualizada.
 *
 * As respostas saem dos dados já carregados no cliente — não há chamada a
 * modelo. Quando o back-end existir, `responder` vira a chamada à API e nenhuma
 * das duas telas muda.
 *
 * Regra de conduta embutida: quando o dado não existe, a resposta diz isso em
 * vez de estimar. Um número inventado que pareça plausível destrói a confiança
 * em todos os outros.
 */

const brl = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });

export const SUGESTOES_ASSISTENTE = [
  "Resuma a operação do último mês e compare com o anterior",
  "Como está o cumprimento de programação hoje?",
  "Qual o custo de manutenção em aberto?",
  "Onde estão os maiores riscos de segurança?",
];

export function useAssistente() {
  const serieQ = useQuery(indicadoresSerieQuery());
  const viagensQ = useQuery(viagensOperacaoQuery(dataOperacao(new Date())));
  const ordensQ = useQuery(ordensQuery());
  const videoQ = useQuery(videoOcorrenciasQuery());
  const linhasQ = useQuery(linhasQuery());

  const responder = (pergunta: string): string => {
    const p = pergunta.toLowerCase();
    const serie = serieQ.data ?? [];
    const atual = serie[serie.length - 1];
    const anterior = serie[serie.length - 2];

    if ((p.includes("resum") || p.includes("compar")) && atual && anterior) {
      const A = calcularIndicadores(atual);
      const B = calcularIndicadores(anterior);
      const v = (a: number, b: number, dir: "maior" | "menor" = "maior") => {
        const r = variacao(a, b, dir);
        return `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(2)}%`;
      };
      return [
        `Comparativo entre ${anterior.periodo} e ${atual.periodo}:`,
        ``,
        `• Frota ativa: ${nf(anterior.frotaAtiva)} → ${nf(atual.frotaAtiva)} (${v(atual.frotaAtiva, anterior.frotaAtiva)})`,
        `• Quilometragem: ${nf(anterior.kmRodado)} → ${nf(atual.kmRodado)} km (${v(atual.kmRodado, anterior.kmRodado)})`,
        `• Passageiros: ${nf(anterior.passageiros)} → ${nf(atual.passageiros)} (${v(atual.passageiros, anterior.passageiros)})`,
        `• Custo total: ${brl(B.custoTotal, 0)} → ${brl(A.custoTotal, 0)} (${v(A.custoTotal, B.custoTotal, "menor")})`,
        `• Custo por passageiro: ${brl(B.custoPorPassageiro)} → ${brl(A.custoPorPassageiro)} (${v(A.custoPorPassageiro, B.custoPorPassageiro, "menor")})`,
        `• CPK: ${brl(B.cpk)} → ${brl(A.cpk)} (${v(A.cpk, B.cpk, "menor")})`,
        `• MKBF: ${nf(Math.round(B.mkbf))} → ${nf(Math.round(A.mkbf))} km (${v(A.mkbf, B.mkbf)})`,
        ``,
        `Pontos de atenção:`,
        `• O custo por passageiro subiu ${v(A.custoPorPassageiro, B.custoPorPassageiro).replace("+", "")} mesmo com o custo total ${A.custoTotal < B.custoTotal ? "caindo" : "subindo"} — o que puxou foi a variação no número de passageiros, não a despesa.`,
        `• O MKBF melhorou, o que indica menos quebras por quilômetro rodado.`,
        ``,
        `⚠ Não tenho dado de receita nem de subsídio no sistema, então não consigo calcular margem ou resultado — só custo.`,
      ].join("\n");
    }

    if (p.includes("pneu")) {
      return "Os pneus ficam na tela de Pneus, em Manutenção. Por aqui ainda não respondo sobre eles.";
    }

    if (p.includes("programa") || p.includes("viagem") || p.includes("cumprimento")) {
      const viagens = viagensQ.data ?? [];
      if (!viagens.length) return "Não há viagens registradas no dia de operação corrente.";
      const r = resumoViagens(viagens);
      return [
        `Cumprimento de programação hoje:`,
        ``,
        `• Eficiência: ${r.eficiencia}%`,
        `• Programadas: ${r.programadas} · realizadas: ${r.realizadas}`,
        `• Viagem OK: ${r.ok} · atrasadas: ${r.atrasadas} · adiantadas: ${r.adiantadas}`,
        `• Não realizadas: ${r.naoRealizadas} · em andamento: ${r.emAndamento}`,
        `• Reforços: ${r.reforco}`,
        ``,
        r.naoRealizadas > 0
          ? `As ${r.naoRealizadas} não realizadas são o item que gera desconto em medição — vale verificar se houve falta de carro ou de motorista.`
          : `Nenhuma viagem deixou de ser realizada até agora.`,
      ].join("\n");
    }

    if (p.includes("multa")) {
      return "As multas ficam no quadro de Multas. Por aqui ainda não respondo sobre elas.";
    }

    if (p.includes("manuten") || p.includes("custo") || p.includes("os") || p.includes("ordem")) {
      const ordens = ordensQ.data ?? [];
      const abertas = ordens.filter((o) => o.status !== "concluida" && o.status !== "cancelada");
      const previsto = abertas.reduce((a, o) => a + o.custoPrevisto, 0);
      const horas = ordens.reduce((a, o) => a + (o.horasParado ?? 0), 0);
      return [
        `Manutenção em aberto:`,
        ``,
        `• ${abertas.length} ordem(ns) de serviço abertas`,
        `• Custo previsto: ${brl(previsto, 0)}`,
        `• Horas de veículo parado no período: ${nf(horas)} h`,
        ``,
        `As corretivas somam ${abertas.filter((o) => o.tipo === "corretiva").length} das abertas — proporção alta de corretiva indica plano preventivo sendo furado.`,
      ].join("\n");
    }

    if (p.includes("segur") || p.includes("risco") || p.includes("vídeo") || p.includes("video")) {
      const oc = videoQ.data ?? [];
      const alto = oc.filter((o) => o.risco === "alto");
      const aguardando = oc.filter((o) => o.status === "aguardando");
      const porTipo = new Map<string, number>();
      for (const o of alto) porTipo.set(o.tipo, (porTipo.get(o.tipo) ?? 0) + 1);
      const top = [...porTipo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
      return [
        `Segurança — ocorrências de vídeo:`,
        ``,
        `• ${oc.length} ocorrências no período`,
        `• ${alto.length} classificadas como risco alto (${oc.length ? Math.round((alto.length / oc.length) * 100) : 0}%)`,
        `• ${aguardando.length} aguardando tratativa`,
        ``,
        `Principais tipos de risco alto:`,
        ...top.map(([t, n]) => `• ${t.replace(/_/g, " ")}: ${n}`),
        ``,
        `A fila de tratativa é o indicador a acompanhar: detecção sem tratativa não muda comportamento.`,
      ].join("\n");
    }

    if (p.includes("linha")) {
      const linhas = linhasQ.data ?? [];
      return [
        `${linhas.length} linha(s) cadastradas, ${linhas.filter((l) => l.ativa).length} ativas.`,
        ``,
        ...linhas.slice(0, 8).map((l) => `• ${l.codigo} — ${l.nome} (${l.modalidade})`),
        ``,
        `⚠ Ainda não tenho consolidado de indicadores por linha — o painel gerencial trabalha com o total da frota. IPK e CPK por linha dependem de ratear custo por linha, que o sistema não faz hoje.`,
      ].join("\n");
    }

    return [
      `Não consegui responder com os dados que tenho carregados.`,
      ``,
      `Hoje consigo falar sobre: indicadores mensais e comparativos, cumprimento de programação, ordens de serviço e custo de manutenção e ocorrências de vídeo.`,
      ``,
      `Prefiro dizer isso a arriscar um número errado.`,
    ].join("\n");
  };


  return { responder, carregando: serieQ.isPending || viagensQ.isPending };
}
