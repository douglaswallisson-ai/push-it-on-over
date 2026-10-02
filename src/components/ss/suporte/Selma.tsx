import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { PoseSelma } from "@/lib/suporte-faq";

/**
 * Selma, a atendente do Suporte. A pose acompanha o que o cliente está
 * fazendo (boas-vindas, procurando, explicando, dica, problema) e troca com
 * um pequeno fade para não "pular" na tela.
 *
 * As imagens têm fundo branco; `mix-blend-multiply` deixa o fundo sumir sobre
 * os cartões claros.
 */

const ALT: Record<PoseSelma, string> = {
  "boas-vindas": "Selma, do Suporte SS, estendendo a mão para ajudar",
  explicando: "Selma explicando com as mãos abertas",
  dica: "Selma com o dedo levantado, dando uma dica",
  pensando: "Selma pensando, com a mão no queixo",
  preocupada: "Selma com expressão preocupada",
};

const TODAS: PoseSelma[] = ["boas-vindas", "explicando", "dica", "pensando", "preocupada"];

export function Selma({ pose, className }: { pose: PoseSelma; className?: string }) {
  const [atual, setAtual] = useState(pose);
  const [visivel, setVisivel] = useState(true);

  // Pré-carrega as outras poses para a troca ser instantânea.
  useEffect(() => {
    TODAS.forEach((p) => {
      const i = new Image();
      i.src = `/selma/${p}.webp`;
    });
  }, []);

  useEffect(() => {
    // Se a pose voltou para a atual antes da troca terminar, só reaparece.
    if (pose === atual) {
      setVisivel(true);
      return;
    }
    setVisivel(false);
    const t = setTimeout(() => {
      setAtual(pose);
      setVisivel(true);
    }, 160);
    return () => clearTimeout(t);
  }, [pose]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <img
      src={`/selma/${atual}.webp`}
      alt={ALT[atual]}
      draggable={false}
      className={cn(
        "pointer-events-none select-none object-contain mix-blend-multiply transition-all duration-200",
        visivel ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        className,
      )}
    />
  );
}

/** Balão de fala ao lado da Selma. */
export function BalaoSelma({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "relative rounded-2xl border border-brand-sky/30 bg-white px-4 py-3 text-[13.5px] leading-snug text-foreground shadow-sm",
        "before:absolute before:-left-2 before:top-6 before:h-4 before:w-4 before:rotate-45 before:border-b before:border-l before:border-brand-sky/30 before:bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}
