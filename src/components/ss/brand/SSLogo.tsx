import { cn } from "@/lib/utils";
import { SSOrb } from "./SSOrb";

/**
 * Lockup horizontal da marca: orb + assinatura "Telemática".
 *
 * O PNG oficial do logo vive como asset remoto no projeto do site, então aqui a
 * assinatura é composta — orb (arquivo oficial) + wordmark em Space Grotesk.
 * Basta trocar por <img src="/ss-logo.png" /> quando o arquivo for colocado em
 * `public/`.
 */
export function SSLogo({
  size = 40,
  tone = "dark",
  animated = true,
  className,
}: {
  size?: number;
  /** `dark` = wordmark navy sobre fundo claro; `light` = branco sobre navy. */
  tone?: "dark" | "light";
  animated?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <SSOrb size={size} still={!animated} />
      <span
        className={cn(
          "font-display font-semibold tracking-tight",
          tone === "dark" ? "text-brand-navy" : "text-white",
        )}
        style={{ fontSize: size * 0.62 }}
      >
        Telemática
      </span>
    </div>
  );
}
