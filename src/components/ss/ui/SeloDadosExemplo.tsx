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
/**
 * Tela de módulo que não tem nenhuma fonte real.
 *
 * Ligado à API, substitui o conteúdo inteiro: a tela era protótipo de
 * interface, com número e lista escritos no código, e o selo sozinho não
 * bastava — ninguém lê selo e o número inventado continuava na frente.
 * Com dados de exemplo ligados, a demonstração aparece como antes.
 */
export function ModuloSemFonte({
  titulo,
  motivo,
  children,
}: {
  titulo: string;
  /** O que falta para o módulo ter dado real. */
  motivo: string;
  children: React.ReactNode;
}) {
  if (usandoMock()) return <>{children}</>;
  return (
    <div className="mx-auto max-w-[900px] px-6 py-16 text-center md:px-8">
      <Database className="mx-auto h-10 w-10 text-muted-foreground/60" />
      <h1 className="mt-4 font-display text-xl font-bold text-foreground">{titulo}</h1>
      <p className="mt-2 text-sm font-semibold text-gold">Módulo ainda sem dados reais no sistema novo.</p>
      <p className="mx-auto mt-3 max-w-[560px] text-[13px] leading-relaxed text-muted-foreground">{motivo}</p>
    </div>
  );
}

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
          "inline-flex items-center gap-1 rounded-full bg-gold-tint px-2 py-0.5 text-[12px] font-semibold text-gold",
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
      <p className="text-[13px] leading-relaxed text-gold">
        <strong>Esta tela ainda usa dados de exemplo.</strong> {motivo}{" "}
        <span className="opacity-80">
          O restante do sistema já está lendo da API — só este módulo continua com exemplo.
        </span>
      </p>
    </div>
  );
}
