/**
 * Exportação de dados e impressão.
 *
 * Os botões "Exportar", "Baixar" e "Imprimir" espalhados pelo sistema não tinham
 * implementação. Como os dados já estão no cliente, dá para gerar o arquivo sem
 * depender do back-end — e quando a API existir, basta trocar a origem dos dados.
 *
 * CSV com BOM e separador ponto e vírgula: é o que o Excel em português abre
 * corretamente sem passar pelo assistente de importação.
 */

const isBrowser = typeof window !== "undefined";

export type ColunaExport<T> = {
  cabecalho: string;
  valor: (linha: T) => string | number | null | undefined;
};

function escapar(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Aspas duplicadas e envolve o campo se houver separador, aspas ou quebra.
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function gerarCSV<T>(linhas: T[], colunas: ColunaExport<T>[]): string {
  const cabecalho = colunas.map((c) => escapar(c.cabecalho)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => escapar(c.valor(l))).join(";"));
  return [cabecalho, ...corpo].join("\r\n");
}

/** Dispara o download de um texto como arquivo. */
export function baixarArquivo(
  conteudo: string,
  nomeArquivo: string,
  mime = "text/csv;charset=utf-8",
) {
  if (!isBrowser) return;
  // BOM para o Excel reconhecer UTF-8 e não quebrar acentuação.
  const bom = mime.startsWith("text/csv") ? "\uFEFF" : "";
  const blob = new Blob([bom + conteudo], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libera a URL depois do clique para não vazar memória.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Atalho: monta o CSV e já baixa. Devolve quantas linhas foram exportadas. */
export function exportarCSV<T>(linhas: T[], colunas: ColunaExport<T>[], nomeBase: string): number {
  const carimbo = new Date().toISOString().slice(0, 10);
  baixarArquivo(gerarCSV(linhas, colunas), `${nomeBase}-${carimbo}.csv`);
  return linhas.length;
}

/**
 * Baixa um elemento da tela como imagem PNG (gráfico, ranking, mapa de calor).
 * Pedido da CECOTI (30/01/2026): exportar o gráfico como aparece, sem refazer
 * no Excel. A biblioteca só é carregada no clique.
 */
export async function baixarImagem(el: HTMLElement, nomeBase: string) {
  if (!isBrowser) return;
  const { toSvg } = await import("html-to-image");
  const fundo = getComputedStyle(document.body).backgroundColor || "#ffffff";
  // toSvg + canvas próprio: o toPng da biblioteca espera um quadro de animação
  // e trava com a aba em segundo plano.
  const svg = await toSvg(el, {
    pixelRatio: 2,
    // A fonte vem do Google Fonts, que não deixa ler o CSS de outro site; sem
    // isto a geração travava. A imagem usa a fonte do sistema.
    skipFonts: true,
    backgroundColor: fundo,
    // O próprio botão de baixar não entra na imagem.
    filter: (n) => !(n instanceof HTMLElement && n.dataset.semExportar !== undefined),
  });
  const img = new Image();
  await new Promise<void>((ok, erro) => {
    img.onload = () => ok();
    img.onerror = () => erro(new Error("imagem"));
    img.src = svg;
  });
  const escala = 2;
  const canvas = document.createElement("canvas");
  canvas.width = el.offsetWidth * escala;
  canvas.height = el.offsetHeight * escala;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nomeArquivo(nomeBase)}-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** Nome de arquivo sem acento nem espaço. */
export function nomeArquivo(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "grafico"
  );
}

/** Abre o diálogo de impressão do navegador (gera PDF pelo "Salvar como PDF"). */
export function imprimir() {
  if (isBrowser) window.print();
}
