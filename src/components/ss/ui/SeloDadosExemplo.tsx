import { Database, Info } from "lucide-react";
import { usandoMock } from "@/lib/modo";
import { cn } from "@/lib/utils";

/**
 * Selo de dados de exemplo.
 *
 * Parte do sistema já lê da API e parte ainda não — ou porque o módulo é novo
 * e não existe no backend, ou porque depende de cálculo que ainda não foi
 * escrito. Sem sinalizar, o usuário olha um número inventado achando que é a
 * operação dele, e isso é pior do que não mostrar nada.
 *
 * O selo aparece **mesmo em modo API**: é justamente aí que a confusão
 * aconteceria, porque o resto da tela está real.
 */
export function SeloDadosExemplo({
  motivo,
  compacto,
  className,
}: {
  /** Por que esta tela ainda não tem dado real. Uma frase, sem rodeio. */
  motivo: string;
  compacto?: boolean;
  className?: string;
}) {
  // Em modo de exemplo tudo é exemplo — repetir o aviso em cada tela viraria
  // ruído e as pessoas parariam de ler.
  if (usandoMock()) return null;

  if (compacto) {
    return (
      <span
        title={motivo}
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-gold-tint px-2 py-0.5 text-[10.5px] font-semibold text-gold",
          className,
        )}
      >
        <Database className="h-3 w-3" />
        dados de exemplo
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border border-gold-line bg-gold-tint/40 px-4 py-3",
        className,
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
      <p className="text-[12.5px] leading-relaxed text-gold">
        <strong>Esta tela ainda usa dados de exemplo.</strong> {motivo}{" "}
        <span className="opacity-80">
          O restante do sistema já está lendo da API — só este módulo continua com exemplo.
        </span>
      </p>
    </div>
  );
}
