import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Copy, Loader2, MessageSquare, NotebookPen, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Gestão de Viagens no CCO (user stories do PM, 09/11/2026). Grade programado × realizado, intervalo entre ônibus
 * (headway) e encadeamento pelo veículo. Regras: ss-fleet-core app/core/gestao_viagens.py.
 *
 * Cor só onde exige ação (US-C2): vermelho = agir agora, amarelo = atenção, o resto neutro.
 */

type Viagem = {
  id: string;
  linha: string;
  linha_desc: string | null;
  sentido: "ida" | "volta";
  tabela: string | null;
  situacao: string;
  desvio_min: number | null;
  veiculo_prog: string | null;
  veiculo_real: string | null;
  placa_real: string | null;
  motorista: string | null;
  pct: number | null;
  inicio_prog: string | null;
  inicio_real: string | null;
  termino_prog: string | null;
  termino_real: string | null;
  termino_previsto: string | null;
  headway_real_min: number | null;
  headway_prog_min: number | null;
  headway_ref_min: number | null;
  headway_flag: "agrupamento" | "lacuna" | null;
  proxima_id?: string;
  proxima_hora?: string | null;
  conflito_proxima?: boolean;
  ordem: string | null;
};

type Resposta = {
  dia: string;
  janela: [string, string];
  corte: string;
  quadro: boolean;
  fonte: "sistema" | "telemetria";
  tolerancia: { antes: number; depois: number };
  resumo: {
    pct: number | null;
    cumpridas?: number;
    devidas?: number;
    programadas_dia?: number;
    realizadas?: number;
    contagens?: Record<string, number>;
    regularidade_pct: number | null;
    agrupamentos: number;
    lacunas: number;
    conflitos: number;
  };
  linhas: {
    linha: string;
    descricao: string | null;
    viagens: number;
    problemas: number;
    agrupamentos: number;
    lacunas: number;
  }[];
  linhas_na_grade: string[];
  viagens: Viagem[];
  atualizado_em: string;
};

const ROTULO: Record<string, string> = {
  ok: "No horário",
  atrasada: "Atrasada",
  adiantada: "Adiantada",
  suspeita: "Suspeita",
  em_andamento: "Em andamento",
  aguardando: "Aguardando",
  nao_realizada: "Não realizada",
  reforco: "Reforço",
  realizada: "Realizada",
};
/** Vermelho: agir agora. Amarelo: atenção. Resto neutro. */
const URGENCIA: Record<string, "vermelho" | "amarelo" | null> = {
  nao_realizada: "vermelho",
  atrasada: "amarelo",
  adiantada: "amarelo",
  suspeita: "amarelo",
};
const COR = { vermelho: "var(--coral)", amarelo: "var(--gold)" };
const dataBR = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
const hojeJornada = () => {
  const a = new Date();
  if (a.getHours() < 3) a.setDate(a.getDate() - 1);
  return a.toLocaleDateString("en-CA");
};

type Coluna = {
  k: string;
  rot: string;
  telao?: boolean;
  valor: (v: Viagem) => string | number | null;
};
const COLUNAS: Coluna[] = [
  { k: "linha", rot: "Linha", telao: true, valor: (v) => v.linha },
  { k: "sentido", rot: "Sentido", valor: (v) => v.sentido },
  { k: "tabela", rot: "Tabela", valor: (v) => v.tabela },
  {
    k: "inicio",
    rot: "Início prog. / real",
    telao: true,
    valor: (v) => v.inicio_real ?? v.inicio_prog,
  },
  {
    k: "termino",
    rot: "Término prog. / previsto",
    valor: (v) => v.termino_real ?? v.termino_previsto,
  },
  { k: "pct", rot: "%", valor: (v) => v.pct },
  { k: "proxima", rot: "Próxima do veículo", valor: (v) => v.proxima_hora ?? null },
  {
    k: "veiculo",
    rot: "Veículo prog. / real",
    telao: true,
    valor: (v) => v.veiculo_real ?? v.veiculo_prog,
  },
  { k: "headway", rot: "Intervalo real / esperado", telao: true, valor: (v) => v.headway_real_min },
  { k: "situacao", rot: "Situação", telao: true, valor: (v) => ROTULO[v.situacao] ?? v.situacao },
];

function ler<T>(k: string, padrao: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
}
function gravar(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* sem armazenamento: vale só nesta aba */
  }
}

function Janela({
  titulo,
  aoFechar,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-[rgba(10,16,28,0.5)] p-4"
      onClick={aoFechar}
    >
      <div
        className="w-full max-w-[520px] space-y-3 rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold">{titulo}</h2>
          <button onClick={aoFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function rascunho(v: Viagem): string {
  const quem = v.motorista ? `${v.motorista.split(" ")[0]}, ` : "";
  if (v.situacao === "atrasada" && v.inicio_real)
    return `${quem}a viagem da linha ${v.linha} (${v.sentido}) saiu às ${v.inicio_real}, programada para ${v.inicio_prog}. Consegue recuperar o horário até o fim da viagem? Me avise se houver algum problema.`;
  if (v.headway_flag === "agrupamento")
    return `${quem}você está muito perto do ônibus da frente na linha ${v.linha} (${v.headway_real_min} min de intervalo; o esperado é ${v.headway_ref_min}). Segure um pouco para espaçar, por favor.`;
  if (v.headway_flag === "lacuna")
    return `${quem}há um buraco de ${v.headway_real_min} min antes de você na linha ${v.linha}. Se possível, mantenha o ritmo para não lotar.`;
  return `${quem}sobre a viagem da linha ${v.linha} (${v.sentido}) das ${v.inicio_real ?? v.inicio_prog}: `;
}

export default function GestaoViagensCCO({ grupo }: { grupo?: string }) {
  const [dia, setDia] = useState(hojeJornada);
  const [linhas, setLinhas] = useState<string[] | null>(null);
  const [telao, setTelao] = useState<boolean>(() => ler("ss:cco:viagens:telao", false));
  const [ordem, setOrdem] = useState<{ k: string; asc: boolean }>(() =>
    ler("ss:cco:viagens:ordem", { k: "inicio", asc: true }),
  );
  const [acao, setAcao] = useState<{ tipo: "ocorrencia" | "mensagem"; v: Viagem } | null>(null);
  const [texto, setTexto] = useState("");
  const q = useQuery({
    queryKey: ["cco", "gestao-viagens", grupo, dia, linhas?.join(",") ?? ""],
    queryFn: () =>
      api.get<Resposta>(
        `/api/v1/operacao/gestao-viagens?group_id=${grupo}&dia=${dia}${linhas?.length ? `&linhas=${encodeURIComponent(linhas.join(","))}` : ""}`,
      ),
    enabled: Boolean(grupo),
    refetchInterval: 30_000,
  });
  const d = q.data;
  const registrar = useMutation({
    mutationFn: () =>
      api.post("/api/v1/operacao/gestao-viagens/ocorrencias", {
        group_id: Number(grupo),
        dia,
        viagem_id: acao!.v.id,
        linha: acao!.v.linha,
        veiculo: acao!.v.veiculo_real ?? acao!.v.veiculo_prog,
        texto,
      }),
    onSuccess: () => {
      toast.success("Ocorrência registrada.");
      setAcao(null);
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  const grade = useMemo(() => {
    const col = COLUNAS.find((c) => c.k === ordem.k) ?? COLUNAS[3];
    const vs = [...(d?.viagens ?? [])];
    vs.sort((a, b) => {
      const x = col.valor(a);
      const y = col.valor(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      const r =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "pt-BR", { numeric: true });
      return ordem.asc ? r : -r;
    });
    return vs;
  }, [d, ordem]);

  if (!grupo)
    return (
      <p className="p-8 text-center text-[14px] text-muted-foreground">
        Escolha uma empresa para ver as viagens.
      </p>
    );
  const ordenar = (k: string) => {
    const n = { k, asc: ordem.k === k ? !ordem.asc : true };
    setOrdem(n);
    gravar("ss:cco:viagens:ordem", n);
  };
  const ir = (id?: string) => {
    if (!id) return;
    const el = document.getElementById(`viagem-${id}`);
    if (el) {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("ring-2", "ring-brand-navy");
      setTimeout(() => el.classList.remove("ring-2", "ring-brand-navy"), 2500);
    } else toast.message("A próxima viagem é de outra linha: inclua a linha na grade.");
  };
  const cols = COLUNAS.filter((c) => !telao || c.telao);
  const r = d?.resumo;
  const cont = r?.contagens ?? {};
  const grupos: [string, number, "vermelho" | "amarelo" | null][] = d
    ? d.quadro
      ? [
          [
            "Não realizadas",
            cont.nao_realizada ?? 0,
            (cont.nao_realizada ?? 0) > 0 ? "vermelho" : null,
          ],
          ["Atrasadas", cont.atrasada ?? 0, (cont.atrasada ?? 0) > 0 ? "amarelo" : null],
          ["Suspeitas", cont.suspeita ?? 0, (cont.suspeita ?? 0) > 0 ? "amarelo" : null],
          ["Em andamento", cont.em_andamento ?? 0, null],
          ["Reforço", cont.reforco ?? 0, null],
          ["Conflito com a próxima", r?.conflitos ?? 0, (r?.conflitos ?? 0) > 0 ? "amarelo" : null],
        ]
      : [
          ["Lacunas", r?.lacunas ?? 0, (r?.lacunas ?? 0) > 0 ? "vermelho" : null],
          ["Agrupamentos", r?.agrupamentos ?? 0, (r?.agrupamentos ?? 0) > 0 ? "amarelo" : null],
          ["Viagens realizadas", r?.realizadas ?? 0, null],
        ]
    : [];

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-3 overflow-auto bg-canvas p-3",
        telao && "text-[17px]",
      )}
    >
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="min-w-[260px] rounded-xl border border-border bg-card px-5 py-3">
          {!d ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : d.quadro ? (
            <>
              <div
                className="font-mono text-[56px] font-bold leading-none"
                title="Cumpridas ÷ as que já deveriam ter saído"
              >
                {r?.pct ?? "—"}%
              </div>
              <div className="mt-1 text-[14px] font-semibold">
                das viagens que já deveriam ter saído
              </div>
              <div className="text-[13px] text-muted-foreground">
                {r?.cumpridas} de {r?.devidas} · {r?.programadas_dia} programadas no dia
              </div>
            </>
          ) : (
            <>
              <div
                className="font-mono text-[56px] font-bold leading-none"
                title="Intervalos dentro da faixa esperada"
              >
                {r?.regularidade_pct ?? "—"}%
              </div>
              <div className="mt-1 text-[14px] font-semibold">dos intervalos regulares</div>
              <div className="max-w-[300px] text-[12px] text-muted-foreground">
                Sem quadro de horários no sistema: o intervalo é comparado com o típico da linha no
                dia.
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {grupos.map(([rot, n, u]) => (
            <div
              key={rot}
              className="min-w-[120px] rounded-xl border bg-card px-4 py-3"
              style={{ borderColor: u ? COR[u] : "var(--border)" }}
            >
              <div className="text-[12px] text-muted-foreground">{rot}</div>
              <div
                className="font-mono text-[28px] font-bold"
                style={{ color: u ? COR[u] : undefined }}
              >
                {n}
              </div>
            </div>
          ))}
        </div>
        <div className="ml-auto flex flex-col items-end justify-between gap-2 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1">
              Jornada de
              <input
                type="date"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="h-8 rounded-md border border-border bg-white px-2 text-[13px]"
              />
            </label>
            <label className="flex cursor-pointer items-center gap-1">
              <input
                type="checkbox"
                checked={telao}
                onChange={(e) => {
                  setTelao(e.target.checked);
                  gravar("ss:cco:viagens:telao", e.target.checked);
                }}
              />
              Modo telão
            </label>
          </div>
          {d && (
            <span title="Recorte em uso">
              Jornada de {dataBR(d.dia)} · {d.corte} às {d.corte} do dia seguinte · tolerância −
              {d.tolerancia.antes} / +{d.tolerancia.depois} min (da unidade) ·{" "}
              {d.fonte === "sistema" ? "viagens abertas no sistema" : "viagens da telemetria"} ·
              atualizado{" "}
              {new Date(d.atualizado_em).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
      </div>

      {d && (
        <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
          <span className="text-muted-foreground">Linhas na grade:</span>
          {d.linhas.slice(0, 40).map((l) => {
            const ativa = d.linhas_na_grade.includes(l.linha);
            return (
              <button
                key={l.linha}
                title={`${l.descricao ?? ""} · ${l.viagens} viagens · ${l.problemas} pontos de atenção`}
                onClick={() => {
                  const atual = linhas ?? d.linhas_na_grade;
                  const n = ativa ? atual.filter((x) => x !== l.linha) : [...atual, l.linha];
                  setLinhas(n.length ? n : null);
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 font-medium",
                  ativa ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-white",
                )}
              >
                {l.linha}
                {l.problemas > 0 && <span className="ml-1 opacity-80">· {l.problemas}</span>}
              </button>
            );
          })}
        </div>
      )}

      {q.error ? (
        <p className="p-6 text-center text-coral">{mensagemErro(q.error)}</p>
      ) : d && !grade.length ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
          Nenhuma viagem nesta jornada.
        </p>
      ) : d ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className={cn("w-full", telao ? "text-[18px]" : "min-w-[1180px] text-[13px]")}>
            <thead className="sticky top-0 bg-card text-left text-[12px] text-muted-foreground">
              <tr>
                {cols.map((c) => (
                  <th key={c.k} className="whitespace-nowrap px-3 py-2 font-semibold">
                    <button onClick={() => ordenar(c.k)} className="inline-flex items-center gap-1">
                      {c.rot}
                      {ordem.k === c.k &&
                        (ordem.asc ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        ))}
                    </button>
                  </th>
                ))}
                {!telao && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {grade.map((v) => {
                const u = URGENCIA[v.situacao] ?? null;
                const uh =
                  v.headway_flag === "lacuna"
                    ? "vermelho"
                    : v.headway_flag === "agrupamento"
                      ? "amarelo"
                      : null;
                const forte = telao ? "font-semibold" : "";
                return (
                  <tr key={v.id} id={`viagem-${v.id}`} className="border-t border-border/60">
                    {cols.map((c) => (
                      <td
                        key={c.k}
                        className={cn("whitespace-nowrap px-3 py-1.5 font-mono", forte)}
                      >
                        {c.k === "linha" ? (
                          <span title={v.linha_desc ?? ""}>{v.linha}</span>
                        ) : c.k === "sentido" ? (
                          v.sentido
                        ) : c.k === "tabela" ? (
                          (v.tabela ?? "—")
                        ) : c.k === "inicio" ? (
                          <span>
                            {v.inicio_prog ?? "—"} /{" "}
                            <span style={{ color: u ? COR[u] : undefined }}>
                              {v.inicio_real ?? "—"}
                            </span>
                            {v.desvio_min != null && v.desvio_min !== 0 && (
                              <span className="ml-1 text-[11px] text-muted-foreground">
                                ({v.desvio_min > 0 ? "+" : ""}
                                {v.desvio_min})
                              </span>
                            )}
                          </span>
                        ) : c.k === "termino" ? (
                          `${v.termino_prog ?? "—"} / ${v.termino_real ?? v.termino_previsto ?? "—"}`
                        ) : c.k === "pct" ? (
                          v.pct != null ? (
                            `${v.pct}%`
                          ) : (
                            "—"
                          )
                        ) : c.k === "proxima" ? (
                          v.proxima_hora ? (
                            <button
                              onClick={() => ir(v.proxima_id)}
                              className="underline"
                              style={{ color: v.conflito_proxima ? COR.amarelo : undefined }}
                              title={
                                v.conflito_proxima
                                  ? "O término previsto passa da partida seguinte"
                                  : "Ir para a próxima viagem"
                              }
                            >
                              {v.proxima_hora}
                              {v.conflito_proxima ? " · conflito" : ""}
                            </button>
                          ) : (
                            "—"
                          )
                        ) : c.k === "veiculo" ? (
                          telao ? (
                            (v.veiculo_real ?? v.veiculo_prog ?? "—")
                          ) : (
                            `${v.veiculo_prog ?? "—"} / ${v.veiculo_real ?? "—"}`
                          )
                        ) : c.k === "headway" ? (
                          <span
                            style={{ color: uh ? COR[uh] : undefined }}
                            title={
                              v.headway_flag === "agrupamento"
                                ? "Agrupamento: dois ônibus juntos"
                                : v.headway_flag === "lacuna"
                                  ? "Lacuna: buraco na linha"
                                  : ""
                            }
                          >
                            {v.headway_real_min ?? "—"} / {v.headway_ref_min ?? "—"} min
                            {v.headway_flag ? ` · ${v.headway_flag}` : ""}
                          </span>
                        ) : (
                          <span
                            className="rounded-full border px-2 py-0.5 font-sans text-[12px] font-semibold"
                            style={u ? { borderColor: COR[u], color: COR[u] } : undefined}
                          >
                            {ROTULO[v.situacao] ?? v.situacao}
                          </span>
                        )}
                      </td>
                    ))}
                    {!telao && (
                      <td className="whitespace-nowrap px-2 py-1.5 text-right">
                        <button
                          title="Registrar ocorrência"
                          onClick={() => {
                            setTexto("");
                            setAcao({ tipo: "ocorrencia", v });
                          }}
                          className="rounded p-1 hover:bg-secondary"
                        >
                          <NotebookPen className="h-4 w-4" />
                        </button>
                        <button
                          title="Rascunho de mensagem ao motorista"
                          onClick={() => {
                            setTexto(rascunho(v));
                            setAcao({ tipo: "mensagem", v });
                          }}
                          className="rounded p-1 hover:bg-secondary"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {acao && (
        <Janela
          titulo={`${acao.tipo === "ocorrencia" ? "Ocorrência" : "Mensagem ao motorista"} · linha ${acao.v.linha} ${acao.v.inicio_real ?? acao.v.inicio_prog ?? ""}`}
          aoFechar={() => setAcao(null)}
        >
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-border p-2 text-[13px]"
          />
          {acao.tipo === "ocorrencia" ? (
            <button
              onClick={() => registrar.mutate()}
              disabled={registrar.isPending || texto.trim().length < 3}
              className="rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Registrar
            </button>
          ) : (
            <>
              <p className="text-[12px] text-muted-foreground">
                Rascunho: revise antes de enviar. O canal de envio ainda não foi definido; copie e
                mande pelo meio que você usa hoje.
              </p>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(texto).then(
                    () => toast.success("Mensagem copiada."),
                    () => toast.error("Não foi possível copiar."),
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white"
              >
                <Copy className="h-4 w-4" /> Copiar
              </button>
            </>
          )}
        </Janela>
      )}
    </div>
  );
}
