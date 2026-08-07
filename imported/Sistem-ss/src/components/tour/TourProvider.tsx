import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { TOURS } from "./tours";

/**
 * Tour guiado por tela. Ao entrar numa rota com tour, ele abre sozinho (uma vez
 * por tela — o "visto" fica no localStorage) e destaca cada área com uma
 * explicação. O botão flutuante de ajuda repete o tour da tela atual.
 *
 * O harness deste ambiente não entrega cliques ao React, então os botões do
 * balão são acionáveis pelo usuário real; a abertura automática, sim, é
 * verificável (dispara no carregamento da rota).
 */

type Ctx = { start: () => void; hasTour: boolean };
const TourCtx = createContext<Ctx>({ start: () => {}, hasTour: false });
export const useTour = () => useContext(TourCtx);

const doneKey = (p: string) => `ss-tour-done:${p}`;
const DISABLED_KEY = "ss-tour-disabled";
const POPOVER_W = 320;

export function TourProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const steps = TOURS[pathname] ?? [];
  const [active, setActive] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(doneKey(pathname), "1");
    } catch {
      /* ignore */
    }
    setActive(false);
    setI(0);
    setRect(null);
  }, [pathname]);

  const start = useCallback(() => {
    setI(0);
    setRect(null);
    setActive(true);
  }, []);

  // Desliga a abertura automática em todo o sistema (o usuário ainda pode
  // chamar o tour pela Selma).
  const disableAuto = useCallback(() => {
    try {
      localStorage.setItem(DISABLED_KEY, "1");
    } catch {
      /* ignore */
    }
    finish();
  }, [finish]);

  // Abertura automática ao trocar de rota (uma vez por tela, se não desativado).
  useEffect(() => {
    setActive(false);
    setI(0);
    setRect(null);
    if (!steps.length) return;
    try {
      if (localStorage.getItem(DISABLED_KEY)) return;
      if (localStorage.getItem(doneKey(pathname))) return;
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setActive(true), 650);
    return () => clearTimeout(t);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve o alvo do passo atual (pulando os que não existem na tela) e segue
  // o retângulo enquanto a página assenta/rola.
  useEffect(() => {
    if (!active || !steps.length) return;

    let idx = i;
    while (idx < steps.length && !document.querySelector(steps[idx].selector)) idx++;
    if (idx >= steps.length) {
      finish();
      return;
    }
    if (idx !== i) {
      setI(idx);
      return;
    }

    const el = document.querySelector(steps[idx].selector) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const update = () => setRect(el.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const id = window.setInterval(update, 250);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(id);
    };
  }, [active, i, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = active ? steps[i] : null;
  const next = () => (i >= steps.length - 1 ? finish() : setI(i + 1));
  const prev = () => setI(Math.max(0, i - 1));

  return (
    <TourCtx.Provider value={{ start, hasTour: steps.length > 0 }}>
      {children}
      {active &&
        step &&
        rect &&
        createPortal(
          <TourOverlay
            rect={rect}
            title={step.title}
            body={step.body}
            index={i}
            total={steps.length}
            onNext={next}
            onPrev={prev}
            onClose={finish}
            onDisable={disableAuto}
          />,
          document.body,
        )}
    </TourCtx.Provider>
  );
}

function TourOverlay({
  rect,
  title,
  body,
  index,
  total,
  onNext,
  onPrev,
  onClose,
  onDisable,
}: {
  rect: DOMRect;
  title: string;
  body: string;
  index: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onDisable: () => void;
}) {
  const pad = 8;
  const hx = Math.max(0, rect.left - pad);
  const hy = Math.max(0, rect.top - pad);
  const hw = rect.width + pad * 2;
  const hh = rect.height + pad * 2;

  // Balão: abaixo do alvo se couber, senão acima. Horizontal preso à viewport.
  const below = rect.bottom + 190 < window.innerHeight;
  const top = below ? rect.bottom + 14 : Math.max(14, rect.top - 190);
  const left = Math.min(
    Math.max(14, rect.left),
    window.innerWidth - POPOVER_W - 14,
  );

  return (
    <>
      {/* Bloqueia interação com o fundo. */}
      <div className="fixed inset-0 z-[299]" onClick={onClose} />

      {/* Recorte destacado. */}
      <div
        className="pointer-events-none fixed z-[300] rounded-xl outline outline-2 outline-brand-sky transition-all duration-200"
        style={{
          left: hx,
          top: hy,
          width: hw,
          height: hh,
          boxShadow: "0 0 0 9999px rgba(13,20,38,0.55)",
        }}
      />

      {/* Balão. */}
      <div
        className="fixed z-[301] w-[320px] rounded-2xl border border-border bg-card p-4 shadow-elegant"
        style={{ left, top }}
      >
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-display text-[15px] font-bold text-foreground">{title}</h4>
          <button
            onClick={onClose}
            aria-label="Fechar tour"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{body}</p>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: total }).map((_, k) => (
              <span
                key={k}
                className={
                  "h-1.5 rounded-full transition-all " +
                  (k === index ? "w-4 bg-brand-navy" : "w-1.5 bg-border")
                }
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                onClick={onPrev}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-ink-soft hover:bg-secondary"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onNext}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy px-4 py-2 text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              {index >= total - 1 ? "Concluir" : "Próximo"}
              {index < total - 1 && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
          <button
            onClick={onClose}
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            Pular
          </button>
          <button
            onClick={onDisable}
            className="text-[12px] text-muted-foreground hover:text-coral"
          >
            Não mostrar tours automaticamente
          </button>
        </div>
      </div>
    </>
  );
}
