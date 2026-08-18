/**
 * Silhuetas por tipo de veículo.
 *
 * Num pátio misto — ônibus urbano, rodoviário, carreta, van — a forma
 * identifica o veículo antes de o olho chegar no texto. Numa coluna com vinte
 * cartões, isso é a diferença entre varrer e ler.
 *
 * São desenhadas em SVG com `currentColor` para herdar a cor semântica do
 * cartão, em vez de imagens: escalam sem borrar e não somam requisições.
 */

export type TipoVeiculo =
  | "urbano"
  | "rodoviario"
  | "micro"
  | "van"
  | "carreta"
  | "caminhao"
  | "utilitario";

export const TIPO_VEICULO_LABEL: Record<TipoVeiculo, string> = {
  urbano: "Ônibus urbano",
  rodoviario: "Ônibus rodoviário",
  micro: "Micro-ônibus",
  van: "Van",
  carreta: "Carreta",
  caminhao: "Caminhão",
  utilitario: "Utilitário",
};

/**
 * Deduz o tipo a partir de marca e modelo.
 *
 * É heurística sobre texto livre, e por isso o padrão é `urbano` — a maior
 * parte da frota atendida. Quando o backend expuser `unit_type_id` com domínio
 * mapeado, esta função deixa de ser necessária.
 */
export function tipoDoVeiculo(marca?: string, modelo?: string): TipoVeiculo {
  const t = `${marca ?? ""} ${modelo ?? ""}`.toLowerCase();

  if (/carreta|bitrem|semi.?reboque|rodotrem/.test(t)) return "carreta";
  if (/van|sprinter|ducato|master|daily/.test(t)) return "van";
  if (/micro|volare|senior|neobus.?thunder/.test(t)) return "micro";
  if (/paradiso|marcopolo.?g[78]|dd|rodovi|viaggio|busscar/.test(t)) return "rodoviario";
  if (/caminh|constellation|atego|axor|cargo|actros|fh|fm\b/.test(t)) return "caminhao";
  if (/pickup|hilux|s10|strada|saveiro|fiorino/.test(t)) return "utilitario";
  return "urbano";
}

/** Caminhos SVG por tipo, todos no mesmo viewBox para trocarem sem saltar. */
const CAMINHOS: Record<TipoVeiculo, string> = {
  // Ônibus urbano: janela corrida, portas marcadas.
  urbano:
    "M3 7.5C3 6.1 4.1 5 5.5 5h29C35.9 5 37 6.1 37 7.5V22c0 .8-.5 1.5-1.2 1.8V26c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1v-2H8.2v2c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1v-2.2C3.5 23.5 3 22.8 3 22V7.5Zm3 1v8h9v-8H6Zm12 0v8h6v-8h-6Zm9 0v8h7v-8h-7ZM8.5 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm23 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  // Rodoviário: dois andares de janela, bagageiro.
  rodoviario:
    "M3 8c0-1.7 1.3-3 3-3h28c1.7 0 3 1.3 3 3v13.5c0 .9-.5 1.6-1.2 2V26c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1v-2H8.2v2c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1v-2.5c-.7-.4-1.2-1.1-1.2-2V8Zm3 .8v6.4h28V8.8H6ZM6 17v3h28v-3H6Zm2.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm23 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  // Micro-ônibus: mais curto, proporção diferente.
  micro:
    "M7 8c0-1.7 1.3-3 3-3h20c1.7 0 3 1.3 3 3v14c0 .8-.5 1.5-1.2 1.8V26c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1v-2H12.2v2c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1v-2.2C7.5 23.5 7 22.8 7 22V8Zm3 1v7h8V9h-8Zm11 0v7h9V9h-9Zm-8.5 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm15 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  // Van: capô inclinado à frente.
  van:
    "M4 13.5 8.5 7C9 6.4 9.8 6 10.6 6H30c1.7 0 3 1.3 3 3v13c0 .8-.5 1.5-1.2 1.8V26c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1v-2H10.2v2c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1v-2.2C5.5 23.5 5 22.8 5 22v-6H4v-2.5Zm7.5-3.5-2.8 4H16v-4h-4.5ZM19 10v4h11v-4H19Zm-8.5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm18 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  // Carreta: cavalo mecânico e semirreboque.
  carreta:
    "M2 10c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v11H2V10Zm22 1h5.5c.6 0 1.2.3 1.6.8l4.5 5.6c.3.3.4.7.4 1.1V21h-12v-10Zm-17 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm8 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm16 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  // Caminhão: cabine e baú.
  caminhao:
    "M3 9c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v12H3V9Zm22 3h4.8c.6 0 1.2.3 1.6.8l3.8 4.8c.3.4.5.8.5 1.3V21h-10.7V12ZM9 24.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm20 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  // Utilitário: cabine e caçamba.
  utilitario:
    "M5 14.5 9 9c.4-.6 1-.9 1.7-.9H19c1.1 0 2 .9 2 2v4h14c1.1 0 2 .9 2 2v5H5v-7.6ZM12 10.5l-2.3 3.5H17v-3.5h-5Zm-1 12a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Zm19 0a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z",
};

export function SilhuetaVeiculo({
  tipo,
  className,
  titulo,
}: {
  tipo: TipoVeiculo;
  className?: string;
  titulo?: string;
}) {
  return (
    <svg
      viewBox="0 0 40 32"
      className={className}
      fill="currentColor"
      role="img"
      aria-label={titulo ?? TIPO_VEICULO_LABEL[tipo]}
    >
      <title>{titulo ?? TIPO_VEICULO_LABEL[tipo]}</title>
      <path d={CAMINHOS[tipo]} />
    </svg>
  );
}
