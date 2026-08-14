import { useEffect, useMemo, useRef, useState } from "react";
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
import { SUGESTOES_ASSISTENTE, useAssistente } from "@/hooks/use-assistente";
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

export default function AssistenteDados() {
  const { responder, carregando } = useAssistente();

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
                    {SUGESTOES_ASSISTENTE.map((s) => (
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
