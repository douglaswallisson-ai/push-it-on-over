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
export function baixarArquivo(conteudo: string, nomeArquivo: string, mime = "text/csv;charset=utf-8") {
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
export function exportarCSV<T>(
  linhas: T[],
  colunas: ColunaExport<T>[],
  nomeBase: string,
): number {
  const carimbo = new Date().toISOString().slice(0, 10);
  baixarArquivo(gerarCSV(linhas, colunas), `${nomeBase}-${carimbo}.csv`);
  return linhas.length;
}

/** Abre o diálogo de impressão do navegador (gera PDF pelo "Salvar como PDF"). */
export function imprimir() {
  if (isBrowser) window.print();
}
