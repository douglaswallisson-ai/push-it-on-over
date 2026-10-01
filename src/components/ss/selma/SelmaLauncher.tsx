import { useState } from "react";
import { Link } from "@/lib/router-compat";
import { AlertTriangle, ArrowUpRight, Compass, Maximize2, Send, Sparkles, X } from "lucide-react";
import { SSOrb } from "@/components/ss/brand/SSOrb";
import { useTour } from "@/components/ss/tour/TourProvider";
import { SUGESTOES_ASSISTENTE, useAssistente } from "@/hooks/use-assistente";
import { cn } from "@/lib/utils";

/**
 * Foto da Selma. Coloque o arquivo em public/ (ex.: /selma.png, de preferência
 * com fundo transparente) e troque para "/selma.png". Enquanto for null, usa o
 * orb da marca como avatar.
 */
const SELMA_IMG: string | null = null;

function SelmaAvatar({ size, halo = false }: { size: number; halo?: boolean }) {
  if (SELMA_IMG) {
    return (
      <img
        src={SELMA_IMG}
        alt="Selma"
        className="rounded-full object-cover object-top"
        style={{ width: size, height: size }}
      />
    );
  }
  return <SSOrb size={size} halo={halo} className="text-brand-green" />;
}

/**
 * Selma — a copiloto SS. Orb girando no canto inferior direito; ao clicar, abre
 * o chat. Persona acolhedora (skill de marca): "no banco do lado, sem
 * julgamento". Protótipo: respostas simuladas; a IA real entra depois.
 *
 * Também é a casa do tour agora: um atalho no chat refaz o tour da tela atual.
 */

type Msg = { from: "selma" | "user"; text: string };

const SAUDACAO: Msg = {
  from: "selma",
  text: "Oi! Eu sou a Selma, a copiloto da SS. Posso responder sobre os dados da sua operação — indicadores, programação, manutenção, pneus, multas e segurança. O que você quer saber?",
};

export function SelmaLauncher() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([SAUDACAO]);
  const [draft, setDraft] = useState("");
  const [pensando, setPensando] = useState(false);
  const { start, hasTour } = useTour();

  // Mesmo motor da tela cheia do assistente: as respostas saem dos dados
  // carregados, não de texto fixo.
  const { responder, carregando } = useAssistente();

  function perguntar(text: string) {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...m, { from: "user", text: t }]);
    setDraft("");
    setPensando(true);
    setTimeout(() => {
      setMsgs((m) => [...m, { from: "selma", text: responder(t) }]);
      setPensando(false);
    }, 420);
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    perguntar(draft);
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-[201] flex w-[400px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elegant">
          {/* Cabeçalho na faixa da marca. */}
          <div className="flex items-center gap-3 bg-gradient-hero px-4 py-3.5 text-white">
            <SelmaAvatar size={38} />
            <div className="flex-1">
              <p className="flex items-center gap-1.5 text-[14px] font-semibold">
                Selma
                <span className="h-2 w-2 rounded-full bg-brand-green" />
              </p>
              <p className="text-[11px] text-white/70">Copiloto SS · online</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Mensagens. */}
          <div className="flex max-h-[340px] flex-col gap-2.5 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
                  m.from === "selma"
                    ? "self-start rounded-tl-sm bg-secondary text-ink-soft"
                    : "self-end rounded-tr-sm bg-brand-navy text-white",
                )}
              >
                {m.text.split("\n").map((linha, j) =>
                  linha.startsWith("⚠") ? (
                    <span key={j} className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-gold-tint/70 px-2 py-1 text-[12px] text-gold">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{linha.replace("⚠ ", "")}</span>
                    </span>
                  ) : (
                    <span key={j} className={cn("block", linha === "" && "h-1.5")}>
                      {linha}
                    </span>
                  ),
                )}
              </div>
            ))}
            {pensando && (
              <div className="max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-secondary px-3.5 py-2 text-[13px] text-muted-foreground">
                Consultando os dados…
              </div>
            )}
          </div>

          {/* Sugestões — só enquanto a conversa está no início. */}
          {msgs.length === 1 && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-1">
              {SUGESTOES_ASSISTENTE.slice(0, 3).map((sug) => (
                <button
                  key={sug}
                  onClick={() => perguntar(sug)}
                  disabled={carregando}
                  className="rounded-full border border-border bg-white px-2.5 py-1 text-left text-[11.5px] text-ink-soft transition-colors hover:bg-secondary disabled:opacity-50"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Ação sugerida do dia (do IA Ops Advisor). */}
          <div className="mx-4 mb-2 rounded-xl border border-navy-line bg-navy-tint/60 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-blue">
              <Sparkles className="h-3.5 w-3.5" />
              Ação sugerida de hoje
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
              Retreinar 16 motoristas com condução ideal abaixo de 65,3% — pode render{" "}
              <strong className="text-foreground">+8%</strong> de condução ideal.
            </p>
            <Link
              to="/app/estrategico"
              onClick={() => setOpen(false)}
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-brand-navy hover:text-brand-blue"
            >
              Ver no IA Ops Advisor
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Atalhos. */}
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {hasTour && (
              <button
                onClick={() => {
                  setOpen(false);
                  start();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-brand-navy hover:bg-secondary"
              >
                <Compass className="h-3.5 w-3.5" />
                Tour desta tela
              </button>
            )}
            <Link
              to="/app/assistente"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-brand-navy hover:bg-secondary"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Abrir em tela cheia
            </Link>
          </div>

          {/* Entrada. */}
          <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escreva para a Selma…"
              className="h-10 flex-1 rounded-full border border-border bg-secondary/60 px-4 text-[13px] outline-none focus:border-accent focus:bg-white"
            />
            <button
              type="submit"
              aria-label="Enviar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-navy text-white transition-transform hover:-translate-y-0.5"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* Orb-lançador. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Falar com a Selma"
        className="fixed bottom-6 right-6 z-[200] flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-white shadow-elegant transition-transform hover:-translate-y-0.5"
      >
        <SelmaAvatar size={52} halo />
      </button>
    </>
  );
}
