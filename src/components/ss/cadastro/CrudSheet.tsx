import { useEffect, useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Input, Select, Textarea, Toggle } from "@/components/ss/ui/form";
import { VeiculoPicker } from "@/components/ss/cadastro/VeiculoPicker";
import { GaragemPicker } from "@/components/ss/cadastro/GaragemPicker";
import { cn } from "@/lib/utils";

/**
 * Painel lateral de criação e edição usado por todos os cadastros.
 *
 * Antes cada tela de cadastro tinha um botão "Novo" sem handler e nenhuma forma
 * de abrir um registro existente. Em vez de escrever oito formulários, cada
 * cadastro declara seus campos e este componente cuida do resto — assim o
 * comportamento (validação, cancelar, excluir, foco) é igual em todos.
 */

export type CampoTipo =
  | "texto"
  | "numero"
  | "select"
  | "textarea"
  | "toggle"
  | "data"
  | "veiculos"
  | "garagens"
  | "cor";

export type Campo<T> = {
  nome: keyof T & string;
  label: string;
  tipo: CampoTipo;
  /** Ocupa a linha inteira. */
  full?: boolean;
  obrigatorio?: boolean;
  opcoes?: string[];
  placeholder?: string;
  hint?: string;
  sufixo?: string;
};

export type CrudSheetProps<T> = {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  campos: Campo<T>[];
  valor: Partial<T>;
  /** null quando é criação. */
  editando: T | null;
  onSalvar: (v: Partial<T>) => void;
  onExcluir?: (v: T) => void;
  /** Conteúdo extra abaixo dos campos (ex.: leitura de indicadores). */
  extra?: React.ReactNode;
};

export function CrudSheet<T extends Record<string, unknown>>({
  aberto,
  onFechar,
  titulo,
  campos,
  valor,
  editando,
  onSalvar,
  onExcluir,
  extra,
}: CrudSheetProps<T>) {
  const [form, setForm] = useState<Partial<T>>(valor);
  const [erros, setErros] = useState<string[]>([]);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  useEffect(() => {
    if (aberto) {
      setForm(valor);
      setErros([]);
      setConfirmarExclusao(false);
    }
  }, [aberto, valor]);

  // Esc fecha o painel — comportamento esperado em qualquer drawer.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  const set = (nome: string, v: unknown) => setForm((f) => ({ ...f, [nome]: v }));

  const salvar = () => {
    const faltando = campos
      .filter((c) => c.obrigatorio)
      .filter((c) => {
        const v = form[c.nome];
        return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      })
      .map((c) => c.label);

    if (faltando.length) {
      setErros(faltando);
      return;
    }
    onSalvar(form);
  };

  return (
    <div className="fixed inset-0 z-[300] flex justify-end">
      <button
        aria-label="Fechar"
        onClick={onFechar}
        className="absolute inset-0 bg-[oklch(0.15_0.03_260)]/40 backdrop-blur-[2px]"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        data-tour="crud-sheet"
        className="relative flex h-full w-full max-w-[520px] flex-col bg-card shadow-[0_0_60px_-10px_rgba(0,0,0,0.4)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <h2 className="text-[16px] font-semibold text-foreground">{titulo}</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {editando ? "Altere os campos e salve." : "Preencha os campos e salve."}
            </p>
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {erros.length > 0 && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-coral-line bg-coral-tint/50 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
              <p className="text-[12.5px] text-coral">
                Preencha: <strong>{erros.join(", ")}</strong>
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {campos.map((c) => (
              <div key={c.nome} className={cn("space-y-1.5", (c.full || c.tipo === "veiculos" || c.tipo === "garagens") && "sm:col-span-2")}>
                <label className="block text-[12px] font-medium text-ink-soft">
                  {c.label}
                  {c.obrigatorio ? (
                    <span className="ml-1 text-coral">*</span>
                  ) : (
                    <span className="ml-1.5 text-[10.5px] font-normal text-muted-foreground">opcional</span>
                  )}
                </label>

                {c.tipo === "select" ? (
                  <Select value={String(form[c.nome] ?? "")} onChange={(e) => set(c.nome, e.target.value)}>
                    <option value="">Selecione…</option>
                    {(c.opcoes ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                ) : c.tipo === "textarea" ? (
                  <Textarea
                    value={String(form[c.nome] ?? "")}
                    placeholder={c.placeholder}
                    onChange={(e) => set(c.nome, e.target.value)}
                  />
                ) : c.tipo === "toggle" ? (
                  <div className="pt-1.5">
                    <Toggle
                      checked={Boolean(form[c.nome])}
                      onChange={(v) => set(c.nome, v)}
                      label={form[c.nome] ? "Ativo" : "Inativo"}
                    />
                  </div>
                ) : c.tipo === "veiculos" ? (
                  <VeiculoPicker
                    selecionadas={(form[c.nome] as string[]) ?? []}
                    onChange={(v) => set(c.nome, v)}
                  />
                ) : c.tipo === "garagens" ? (
                  <GaragemPicker
                    selecionadas={(form[c.nome] as string[]) ?? []}
                    onChange={(v) => set(c.nome, v)}
                  />
                ) : c.tipo === "cor" ? (
                  <input
                    type="color"
                    value={String(form[c.nome] ?? "#1B3A6B")}
                    onChange={(e) => set(c.nome, e.target.value)}
                    className="h-10 w-full cursor-pointer rounded-lg border border-border bg-white px-1.5"
                  />
                ) : (
                  <div className="relative">
                    <Input
                      type={c.tipo === "numero" ? "number" : c.tipo === "data" ? "date" : "text"}
                      inputMode={c.tipo === "numero" ? "numeric" : undefined}
                      value={String(form[c.nome] ?? "")}
                      placeholder={c.placeholder}
                      onChange={(e) =>
                        set(c.nome, c.tipo === "numero" ? Number(e.target.value || 0) : e.target.value)
                      }
                      className={c.sufixo ? "pr-12" : undefined}
                    />
                    {c.sufixo && (
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                        {c.sufixo}
                      </span>
                    )}
                  </div>
                )}

                {c.hint && <span className="block text-[11px] text-muted-foreground">{c.hint}</span>}
              </div>
            ))}
          </div>

          {extra && <div className="mt-6 border-t border-border pt-5">{extra}</div>}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div>
            {editando && onExcluir && (
              <>
                {confirmarExclusao ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-muted-foreground">Confirma?</span>
                    <button
                      onClick={() => onExcluir(editando)}
                      className="rounded-lg bg-coral px-3 py-1.5 text-[12.5px] font-semibold text-white"
                    >
                      Excluir
                    </button>
                    <button
                      onClick={() => setConfirmarExclusao(false)}
                      className="text-[12.5px] text-muted-foreground underline"
                    >
                      cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmarExclusao(true)}
                    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-coral transition-colors hover:text-coral/80"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onFechar}
              className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              className="rounded-full bg-brand-navy px-5 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              Salvar
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
