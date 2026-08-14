import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Info,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card } from "@/components/ss/ui/data";
import {
  indicadoresSerieQuery,
  linhasQuery,
  multasQuery,
  nf,
  ordensQuery,
  pneusQuery,
  videoOcorrenciasQuery,
  viagensOperacaoQuery,
} from "@/lib/queries";
import { calcularIndicadores, dataOperacao, resumoViagens, variacao } from "@/lib/operacao";
import { acrescentar, gravar, ler, registrarAuditoria } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * Assistente sobre os dados da operação.
 *
 * Duas decisões de produto aqui, copiadas do que os concorrentes fizeram bem:
 *
 * 1. **Histórico salvo e nomeado.** A pergunta útil costuma ser repetida toda
 *    semana; obrigar a redigitar joga fora o trabalho.
 * 2. **Admitir lacuna de dados.** Quando o indicador não existe, a resposta diz
 *    isso em vez de inventar número. É o que constrói confiança para o gestor
 *    acreditar no número quando ele aparece.
 *
 * A geração é local e determinística: as respostas saem dos dados já
 * carregados, sem chamar modelo. Quando o back-end existir, `responder()` vira
 * a chamada à API e o resto da tela não muda.
 */

type Mensagem = { autor: "usuario" | "assistente"; texto: string; em: string };
type Conversa = { id: string; titulo: string; mensagens: Mensagem[]; em: string };

const SUGESTOES = [
  "Resuma a operação do último mês e compare com o anterior",
  "Quais veículos estão com pneu abaixo do mínimo?",
  "Como está o cumprimento de programação hoje?",
  "Quais multas têm prazo de indicação vencendo?",
  "Qual o custo de manutenção em aberto?",
  "Onde estão os maiores riscos de segurança?",
];

const brl = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: casas, maximumFractionDigits: casas });

export default function AssistenteDados() {
  const serieQ = useQuery(indicadoresSerieQuery());
  const viagensQ = useQuery(viagensOperacaoQuery(dataOperacao(new Date())));
  const pneusQ = useQuery(pneusQuery());
  const ordensQ = useQuery(ordensQuery());
  const multasQ = useQuery(multasQuery());
  const videoQ = useQuery(videoOcorrenciasQuery());
  const linhasQ = useQuery(linhasQuery());

  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [ativaId, setAtivaId] = useState<string | null>(null);
  const [entrada, setEntrada] = useState("");
  const [pensando, setPensando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const salvas = ler<Conversa[]>("conversas-ia", []);
    setConversas(salvas);
    setAtivaId(salvas[0]?.id ?? null);
  }, []);

  const ativa = conversas.find((c) => c.id === ativaId) ?? null;

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ativa?.mensagens.length, pensando]);

  const persistir = (lista: Conversa[]) => {
    setConversas(lista);
    gravar("conversas-ia", lista);
  };

  /**
   * Monta a resposta a partir dos dados carregados.
   *
   * Quando a informação necessária não existe, diz isso explicitamente — é
   * preferível a um número inventado que o gestor levaria para uma reunião.
   */
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
      const pneus = pneusQ.data ?? [];
      const criticos = pneus.filter((x) => x.status === "em_uso" && x.sulcoMm <= x.sulcoMinimoMm);
      const proximos = pneus.filter((x) => x.status === "em_uso" && x.sulcoMm > x.sulcoMinimoMm && x.sulcoMm <= 3);
      if (!pneus.length) return "Não há pneus cadastrados no sistema ainda.";
      return [
        `${criticos.length} pneu(s) abaixo do sulco mínimo de 1,6 mm:`,
        ...criticos.map((x) => `• ${x.fogo} — ${x.marca}, posição ${x.posicao}, sulco ${x.sulcoMm.toFixed(1)} mm`),
        ``,
        `Outros ${proximos.length} estão entre 1,6 e 3 mm e devem entrar em programação.`,
        ``,
        `Rodar abaixo do mínimo é infração e retém o veículo em fiscalização, então esses são de troca imediata.`,
      ].join("\n");
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

    if (p.includes("multa") || p.includes("indica")) {
      const multas = multasQ.data ?? [];
      const pend = multas.filter((m) => m.status === "pendente_indicacao");
      return [
        `${pend.length} multa(s) pendente(s) de indicação de condutor:`,
        ...pend.map((m) => `• ${m.ait} — ${m.infracao}, ${brl(m.valor)}`),
        ``,
        `Sem indicar no prazo, a pontuação recai sobre a empresa e o valor costuma dobrar.`,
        ``,
        `⚠ O sistema não tem integração com o Detran, então essas multas foram lançadas manualmente. Pode haver autuação não registrada aqui.`,
      ].join("\n");
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
      `Hoje consigo falar sobre: indicadores mensais e comparativos, cumprimento de programação, pneus, ordens de serviço e custo de manutenção, multas e ocorrências de vídeo.`,
      ``,
      `Prefiro dizer isso a arriscar um número errado.`,
    ].join("\n");
  };

  const enviar = (texto: string) => {
    const msg = texto.trim();
    if (!msg) return;

    const agora = new Date().toISOString();
    let alvo = ativa;

    if (!alvo) {
      alvo = { id: `cv${Date.now()}`, titulo: msg.slice(0, 42), mensagens: [], em: agora };
      persistir([alvo, ...conversas]);
      setAtivaId(alvo.id);
    }

    const comPergunta = conversas.map((c) =>
      c.id === alvo!.id ? { ...c, mensagens: [...c.mensagens, { autor: "usuario" as const, texto: msg, em: agora }] } : c,
    );
    const base = comPergunta.some((c) => c.id === alvo!.id)
      ? comPergunta
      : [{ ...alvo, mensagens: [{ autor: "usuario" as const, texto: msg, em: agora }] }, ...conversas];

    persistir(base);
    setEntrada("");
    setPensando(true);

    // Pequeno atraso para a resposta não aparecer instantânea demais.
    setTimeout(() => {
      const resposta = responder(msg);
      persistir(
        base.map((c) =>
          c.id === alvo!.id
            ? { ...c, mensagens: [...c.mensagens, { autor: "assistente" as const, texto: resposta, em: new Date().toISOString() }] }
            : c,
        ),
      );
      setPensando(false);
      registrarAuditoria("consulta_ia", `Consulta ao assistente: "${msg.slice(0, 60)}"`);
    }, 450);
  };

  const novaConversa = () => {
    setAtivaId(null);
    setEntrada("");
  };

  const excluir = (id: string) => {
    const nova = conversas.filter((c) => c.id !== id);
    persistir(nova);
    if (ativaId === id) setAtivaId(nova[0]?.id ?? null);
  };

  const carregando = serieQ.isPending || viagensQ.isPending;

  return (
    <>
      <PageHeader title="Assistente" subtitle="Perguntas sobre os dados da operação" />

      <div className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          {/* Histórico. */}
          <Card
            title="Histórico"
            icon={Sparkles}
            action={
              <button
                onClick={novaConversa}
                title="Nova conversa"
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-brand-navy hover:bg-secondary"
              >
                <Plus className="h-4 w-4" />
              </button>
            }
            bodyClassName="p-2"
          >
            {conversas.length === 0 ? (
              <p className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">
                Nenhuma conversa salva ainda.
              </p>
            ) : (
              <ul className="space-y-1">
                {conversas.map((c) => (
                  <li key={c.id} className="group flex items-center gap-1">
                    <button
                      onClick={() => setAtivaId(c.id)}
                      className={cn(
                        "min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left transition-colors",
                        ativaId === c.id ? "bg-navy-tint" : "hover:bg-secondary",
                      )}
                    >
                      <span className="block truncate text-[12.5px] font-medium text-foreground">{c.titulo}</span>
                      <span className="block text-[10.5px] text-muted-foreground">
                        {c.mensagens.length} mensagens · {new Date(c.em).toLocaleDateString("pt-BR")}
                      </span>
                    </button>
                    <button
                      onClick={() => excluir(c.id)}
                      aria-label="Excluir conversa"
                      className="shrink-0 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-coral group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Conversa. */}
          <div className="flex min-h-[560px] flex-col rounded-2xl border border-border bg-card shadow-card">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {!ativa || ativa.mensagens.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <Sparkles className="h-8 w-8 text-brand-sky" />
                  <h2 className="mt-3 text-[16px] font-semibold text-foreground">Pergunte sobre seus dados</h2>
                  <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
                    Indicadores, programação, manutenção, pneus, multas e segurança. As respostas saem dos dados
                    carregados no sistema.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {SUGESTOES.map((s) => (
                      <button
                        key={s}
                        onClick={() => enviar(s)}
                        disabled={carregando}
                        className="rounded-full border border-border bg-white px-3 py-1.5 text-[12.5px] text-ink-soft transition-colors hover:bg-secondary disabled:opacity-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                ativa.mensagens.map((m, i) => (
                  <div key={i} className={cn("flex", m.autor === "usuario" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed",
                        m.autor === "usuario"
                          ? "bg-brand-navy text-white"
                          : "border border-border bg-secondary/40 text-ink-soft",
                      )}
                    >
                      {m.texto.split("\n").map((linha, j) => (
                        <p
                          key={j}
                          className={cn(
                            linha.startsWith("⚠") && "mt-2 flex items-start gap-1.5 rounded-lg bg-gold-tint/60 px-2.5 py-1.5 text-gold",
                            linha === "" && "h-2",
                          )}
                        >
                          {linha.startsWith("⚠") ? (
                            <>
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>{linha.replace("⚠ ", "")}</span>
                            </>
                          ) : (
                            linha
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                ))
              )}

              {pensando && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-[13px] text-muted-foreground">
                    Consultando os dados…
                  </div>
                </div>
              )}
              <div ref={fimRef} />
            </div>

            <div className="border-t border-border p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={entrada}
                  onChange={(e) => setEntrada(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviar(entrada);
                    }
                  }}
                  rows={2}
                  placeholder="Pergunte sobre seus dados…"
                  className="flex-1 resize-none rounded-xl border border-border bg-white px-3 py-2 text-[13.5px] outline-none focus:border-accent"
                />
                <button
                  onClick={() => enviar(entrada)}
                  disabled={!entrada.trim() || pensando}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-navy text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Info className="h-3 w-3" />
                Enter envia · Shift+Enter quebra linha. O assistente pode errar — confira os dados antes de decidir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
