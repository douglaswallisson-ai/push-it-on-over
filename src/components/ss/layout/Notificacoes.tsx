import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Settings, X } from "lucide-react";
import { toast } from "sonner";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { usandoMock } from "@/lib/modo";
import {
  gravarPreferencias,
  marcarLidas,
  notificacoesQuery,
  preferenciasQuery,
  type Notificacao,
  type Preferencia,
} from "@/lib/notificacoes-api";
import { cn } from "@/lib/utils";

/**
 * Sino de notificações (especificação SS 2.0, item 8). Só o que é imediato conta no número; o resto fica
 * no resumo do turno, sem interromper. Pânico sempre imediato.
 */

const COR = { critico: "var(--coral)", moderado: "var(--gold)" } as const;
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function Linha({ n, aoLer }: { n: Notificacao; aoLer?: () => void }) {
  return (
    <li className={cn("flex gap-2 px-3 py-2 text-[13px]", n.lida && "opacity-60")}>
      <span
        className="mt-1 h-2 w-2 shrink-0 rounded-full"
        style={{ background: COR[n.gravidade] }}
      />
      <a href={`/cco`} target="_blank" rel="opener" className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{n.titulo}</span>
        <span className="block truncate text-[12px] text-muted-foreground">
          <b className="font-mono text-foreground">{n.veiculo}</b> {n.placa}
          {n.quantidade > 1 ? ` · ${n.quantidade} vezes` : ""}
          {n.reincidente ? " · também ontem" : ""} · desde {hora(n.desde)}
        </span>
      </a>
      {aoLer && !n.lida && (
        <button
          onClick={aoLer}
          className="shrink-0 self-start text-[11px] font-semibold text-brand-navy underline"
        >
          Lida
        </button>
      )}
    </li>
  );
}

function Preferencias({ aoFechar }: { aoFechar: () => void }) {
  const q = useQuery(preferenciasQuery());
  const qc = useQueryClient();
  const [mudadas, setMudadas] = useState<Record<string, Preferencia["modo"]>>({});
  const salvar = useMutation({
    mutationFn: () =>
      gravarPreferencias(
        Object.entries(mudadas).map(([k, modo]) => {
          const [fonte, gravidade] = k.split("|");
          return { fonte, gravidade: gravidade as Preferencia["gravidade"], modo };
        }),
      ),
    onSuccess: () => {
      toast.success("Preferências salvas.");
      qc.invalidateQueries({ queryKey: ["notificacoes"] });
      aoFechar();
    },
  });
  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-[rgba(10,16,28,0.5)] p-4"
      onClick={aoFechar}
    >
      <div
        className="w-full max-w-[520px] space-y-3 rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[18px] font-bold">O que me avisa</h2>
          <button onClick={aoFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="text-[12px] text-muted-foreground">
          Imediato aparece no sino. Resumo fica na lista do turno, sem interromper.{" "}
          {q.data?.observacao}
        </p>
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-[13px]">
            <tbody>
              {(q.data?.preferencias ?? []).map((p) => {
                const k = `${p.fonte}|${p.gravidade}`;
                return (
                  <tr key={k} className="border-t border-border/60">
                    <td className="py-1.5 pr-2">{p.rotulo}</td>
                    <td className="py-1.5 pr-2 text-muted-foreground">
                      {p.gravidade === "critico" ? "Crítico" : "Moderado"}
                    </td>
                    <td className="py-1.5 text-right">
                      <select
                        value={mudadas[k] ?? p.modo}
                        onChange={(e) =>
                          setMudadas((m) => ({ ...m, [k]: e.target.value as Preferencia["modo"] }))
                        }
                        className="h-8 rounded-lg border border-border bg-white px-2 text-[13px]"
                      >
                        <option value="imediato">Imediato</option>
                        <option value="resumo">Resumo</option>
                        <option value="desligado">Não avisar</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending || !Object.keys(mudadas).length}
          className="rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Salvar
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function Notificacoes() {
  const grupo = grupoAtivo() ?? "";
  const q = useQuery({ ...notificacoesQuery(grupo), enabled: !usandoMock() });
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<"agora" | "resumo">("agora");
  const [prefs, setPrefs] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const f = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, [aberto]);
  const ler = useMutation({
    mutationFn: marcarLidas,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes", grupo] }),
  });
  if (usandoMock()) return null;
  const d = q.data;
  const n = d?.nao_lidas ?? 0;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        title="Notificações"
        aria-label={`Notificações${n ? `: ${n} não lidas` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white text-muted-foreground hover:bg-secondary"
      >
        <Bell className="h-4 w-4" />
        {n > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-coral px-1 text-center text-[11px] font-bold leading-[18px] text-white">
            {n > 99 ? "99+" : n}
          </span>
        )}
      </button>
      {aberto && (
        <div className="absolute right-0 top-11 z-[300] w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex gap-1">
              {(
                [
                  ["agora", `Agora${n ? ` · ${n}` : ""}`],
                  ["resumo", "Resumo do turno"],
                ] as const
              ).map(([k, r]) => (
                <button
                  key={k}
                  onClick={() => setAba(k)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[12px] font-medium",
                    aba === k
                      ? "bg-brand-navy text-white"
                      : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <button onClick={() => setPrefs(true)} title="O que me avisa" aria-label="Preferências">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          {!d ? (
            <p className="p-4 text-[13px] text-muted-foreground">
              {q.error ? "Não foi possível carregar." : "Carregando…"}
            </p>
          ) : d.precisa_empresa ? (
            <p className="p-4 text-[13px] text-muted-foreground">
              Escolha uma empresa no topo do menu para ver as notificações dela.
            </p>
          ) : aba === "agora" ? (
            <>
              {d.imediatas.length ? (
                <ul className="max-h-[420px] divide-y divide-border/60 overflow-y-auto">
                  {d.imediatas.map((x) => (
                    <Linha key={x.chave} n={x} aoLer={() => ler.mutate({ chaves: [x.chave] })} />
                  ))}
                </ul>
              ) : (
                <p className="p-4 text-[13px] text-muted-foreground">Nada urgente agora.</p>
              )}
              {n > 0 && (
                <button
                  onClick={() => ler.mutate({ todas: true, group_id: Number(grupo) })}
                  className="w-full border-t border-border py-2 text-[12px] font-semibold text-brand-navy hover:bg-secondary"
                >
                  Marcar todas como lidas
                </button>
              )}
            </>
          ) : (
            <div className="max-h-[460px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 p-3">
                {d.resumo.map((r) => (
                  <div key={r.fonte} className="rounded-lg border border-border px-2.5 py-2">
                    <div className="text-[11px] text-muted-foreground">{r.rotulo}</div>
                    <div className="font-mono text-[16px] font-bold">{r.total}</div>
                    {r.criticos > 0 && (
                      <div className="text-[11px] text-coral">
                        {r.criticos} crítico{r.criticos > 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                ))}
                {!d.resumo.length && (
                  <p className="col-span-2 text-[13px] text-muted-foreground">Nada no resumo.</p>
                )}
              </div>
              <ul className="divide-y divide-border/60 border-t border-border">
                {d.resumo_itens.slice(0, 30).map((x) => (
                  <Linha key={x.chave} n={x} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {prefs && <Preferencias aoFechar={() => setPrefs(false)} />}
    </div>
  );
}
