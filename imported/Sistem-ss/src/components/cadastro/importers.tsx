import { useRef, useState } from "react";
import {
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  ScanLine,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Componentes de cadastro por upload: OCR de documento e importação em massa
 * por planilha.
 *
 * Protótipo: a extração de OCR é SIMULADA (o reconhecimento real roda no
 * back-end Python). A leitura de CSV é feita de verdade no navegador; .xlsx cai
 * numa prévia de exemplo (o parse real também fica no back).
 */

/** Área de arrastar-e-soltar / clicar para escolher arquivo. */
export function FileDropzone({
  accept,
  hint,
  onFile,
  icon: Icon = UploadCloud,
}: {
  accept: string;
  hint: string;
  onFile: (file: File) => void;
  icon?: typeof UploadCloud;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
        drag ? "border-brand-sky bg-navy-tint" : "border-border bg-secondary/40 hover:border-brand-navy/50",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-card">
        <Icon className="h-6 w-6 text-brand-navy" />
      </div>
      <div>
        <p className="text-[14px] font-semibold text-foreground">
          Arraste aqui ou <span className="text-brand-blue">clique para escolher</span>
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

export type OcrField = { key: string; label: string; value: string };

/**
 * Painel de OCR: sobe o documento (CNH, CRLV…), "lê" e devolve os campos
 * extraídos para preencher o formulário.
 */
export function OcrPanel({
  docLabel,
  hint,
  sample,
  onUse,
}: {
  docLabel: string;
  hint: string;
  sample: OcrField[];
  onUse: (data: Record<string, string>) => void;
}) {
  const [status, setStatus] = useState<"idle" | "reading" | "done">("idle");
  const [fileName, setFileName] = useState("");

  const handle = (file: File) => {
    setFileName(file.name);
    setStatus("reading");
    // Simula o OCR do back-end.
    window.setTimeout(() => setStatus("done"), 1600);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl bg-navy-tint px-4 py-3 text-[12.5px] text-brand-navy">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
        <span>
          Suba a foto ou PDF do <strong>{docLabel}</strong> e a plataforma extrai os dados
          automaticamente. Você confere e completa o que faltar.
        </span>
      </div>

      {status === "idle" && (
        <FileDropzone accept="image/*,.pdf" hint={hint} onFile={handle} icon={ScanLine} />
      )}

      {status === "reading" && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center shadow-card">
          <Loader2 className="h-7 w-7 animate-spin text-brand-blue" />
          <p className="text-[14px] font-semibold">Lendo {docLabel}…</p>
          <p className="text-[12px] text-muted-foreground">{fileName}</p>
        </div>
      )}

      {status === "done" && (
        <div className="rounded-2xl border border-leaf-line bg-leaf-tint/40 p-5">
          <div className="mb-4 flex items-center gap-2 text-[13px] font-semibold text-leaf">
            <Check className="h-4 w-4" />
            Dados extraídos de {fileName}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {sample.map((f) => (
              <div key={f.key} className="rounded-lg border border-border bg-white px-3 py-2">
                <p className="text-[11px] text-muted-foreground">{f.label}</p>
                <p className="text-[13.5px] font-medium text-foreground">{f.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              onClick={() => setStatus("idle")}
              className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
            >
              Enviar outro
            </button>
            <button
              onClick={() => onUse(Object.fromEntries(sample.map((f) => [f.key, f.value])))}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2 text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              <Check className="h-4 w-4" />
              Usar estes dados
            </button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Protótipo — extração simulada. No sistema, o reconhecimento roda no back-end.
          </p>
        </div>
      )}
    </div>
  );
}

/** Importação em massa por planilha, com modelo, prévia e confirmação. */
export function BulkImport({
  entityPlural,
  columns,
  sampleRows,
  onImport,
}: {
  entityPlural: string;
  columns: string[];
  sampleRows: string[][];
  onImport: (count: number) => void;
}) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [fileName, setFileName] = useState("");

  const handle = (file: File) => {
    setFileName(file.name);
    if (file.name.toLowerCase().endsWith(".csv")) {
      const reader = new FileReader();
      reader.onload = () => {
        const parsed = String(reader.result)
          .trim()
          .split(/\r?\n/)
          .map((line) => line.split(",").map((c) => c.trim()));
        // Descarta o cabeçalho se ele bater com as colunas.
        const body = parsed.length && parsed[0][0]?.toLowerCase() === columns[0].toLowerCase() ? parsed.slice(1) : parsed;
        setRows(body.filter((r) => r.some((c) => c)));
      };
      reader.readAsText(file);
    } else {
      // .xlsx: parse real no back-end; aqui mostramos uma prévia de exemplo.
      setRows(sampleRows);
    }
  };

  const templateHref =
    "data:text/csv;charset=utf-8," + encodeURIComponent(columns.join(",") + "\n");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3">
        <p className="text-[12.5px] text-ink-soft">
          Baixe o modelo, preencha uma linha por {entityPlural.slice(0, -1)} e suba a planilha.
        </p>
        <a
          href={templateHref}
          download={`modelo-${entityPlural}.csv`}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-2 text-[12.5px] font-medium text-brand-navy hover:bg-secondary"
        >
          <Download className="h-3.5 w-3.5" />
          Baixar modelo
        </a>
      </div>

      {!rows ? (
        <FileDropzone
          accept=".csv,.xlsx,.xls"
          hint="Planilha .xlsx ou .csv — uma linha por registro"
          onFile={handle}
          icon={FileSpreadsheet}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold">
              <FileSpreadsheet className="h-4 w-4 text-leaf" />
              {rows.length} {entityPlural} em {fileName}
            </div>
            <button
              onClick={() => setRows(null)}
              aria-label="Trocar arquivo"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-secondary">
                  {columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-mono text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i} className={cn("border-t border-border", i % 2 && "bg-[#FafbfC]")}>
                    {columns.map((_, j) => (
                      <td key={j} className="px-3 py-2 text-ink-soft">
                        {r[j] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 8 && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                +{rows.length - 8} linhas não exibidas na prévia
              </p>
            )}
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-3">
            <button
              onClick={() => setRows(null)}
              className="rounded-full border border-border bg-white px-5 py-2 text-[13px] font-medium text-ink-soft hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={() => onImport(rows.length)}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-2 text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              <Check className="h-4 w-4" />
              Importar {rows.length}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Seletor de modo de cadastro (manual / documento / planilha). */
export function ModoTabs({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const tabs = [
    { id: "manual", label: "Preencher manualmente" },
    { id: "ocr", label: "Enviar documento (OCR)" },
    { id: "bulk", label: "Importar planilha" },
  ];
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-card">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-[13px] font-medium transition-colors",
            value === t.id ? "bg-brand-navy text-white" : "text-muted-foreground hover:bg-secondary",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
