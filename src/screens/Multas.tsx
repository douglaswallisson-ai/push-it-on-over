import { lazy, Suspense, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Barcode,
  CalendarClock,
  Copy,
  Download,
  FileText,
  Gavel,
  Loader2,
  Paperclip,
  Printer,
  QrCode,
  RefreshCw,
  Scale,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { StatTile } from "@/components/ss/ui/data";
import { ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { exportarCSV } from "@/lib/export";
import { grupoAtivo } from "@/lib/escopo-ativo";
import {
  abrirBoleto,
  anexarBoleto,
  detalheMultaQuery,
  gerarRelatorioMulta,
  marcarAvisosVistos,
  moverMulta,
  quadroMultasQuery,
  type CardMulta,
  type ChaveColuna,
  type DetalheMulta,
  type QuadroMultas,
} from "@/lib/multas-api";
import { cn } from "@/lib/utils";

const MultasMapa = lazy(() => import("@/screens/MultasMapa"));

/**
 * Quadro de multas (PM, 01/11/2026). O status oficial manda: o gestor só leva o card
 * para etapas internas (hoje, Recorrida); Paga e Cancelada só entram pelo órgão.
 */

const ROTULO: Record<ChaveColuna, string> = {
  autuacao: "Autuação",
  infracao: "Infração",
  recorrida: "Recorrida",
  paga: "Paga",
  cancelada: "Cancelada",
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR") : "—";
const dataHoraBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

/** A API devolve a recusa como `{"detail": "..."}`; o gestor só deve ler a frase. */
function mensagemDoErro(e: Error): string {
  try {
    return JSON.parse(e.message).detail ?? e.message;
  } catch {
    return e.message;
  }
}

function Prazo({
  rotulo,
  data,
  destaque,
}: {
  rotulo: string;
  data: string | null;
  destaque: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12px]">
      <span className="text-muted-foreground">{rotulo}</span>
      <span
        className={cn(
          "font-mono",
          destaque ? "rounded bg-coral-tint px-1.5 font-bold text-coral" : "text-ink-soft",
        )}
      >
        {dataBR(data)}
      </span>
    </div>
  );
}

const copiar = (texto: string, nome: string) =>
  navigator.clipboard.writeText(texto).then(
    () => toast.success(`${nome} copiado.`),
    () => toast.error(`Não foi possível copiar: ${nome}.`),
  );

/** Formas de pagar. Só em multa aberta: paga ou cancelada não tem mais o que pagar. */
function Pagamento({ m }: { m: CardMulta }) {
  if (
    m.coluna === "paga" ||
    m.coluna === "cancelada" ||
    !(m.codigo_barras || m.pix || m.tem_boleto)
  )
    return null;
  const botao =
    "inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-secondary";
  const acao = (fn: () => void) => (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    fn();
  };
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {m.codigo_barras && (
        <span
          role="button"
          tabIndex={0}
          className={botao}
          title={m.codigo_barras}
          onClick={acao(() => copiar(m.codigo_barras!, "Código de barras"))}
        >
          <Barcode className="h-3 w-3" /> Código
        </span>
      )}
      {m.pix && (
        <span
          role="button"
          tabIndex={0}
          className={botao}
          title="Copiar Pix copia e cola"
          onClick={acao(() => copiar(m.pix!, "Pix"))}
        >
          <QrCode className="h-3 w-3" /> Pix
        </span>
      )}
      {m.tem_boleto && (
        <span
          role="button"
          tabIndex={0}
          className={botao}
          title="Abrir o boleto"
          onClick={acao(() =>
            abrirBoleto(m.id).catch((e: Error) => toast.error(mensagemDoErro(e))),
          )}
        >
          <Paperclip className="h-3 w-3" /> Boleto
        </span>
      )}
    </div>
  );
}

function Cartao({ m, aoAbrir }: { m: CardMulta; aoAbrir: () => void }) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(m.id))}
      onClick={aoAbrir}
      className="w-full cursor-grab space-y-1.5 rounded-xl border border-border bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[14px] font-bold text-foreground">{m.placa}</span>
        <span className="flex items-center gap-1">
          {m.exemplo && (
            <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[11px] font-bold text-gold">
              Exemplo
            </span>
          )}
          {m.uf && (
            <span className="rounded border border-border px-1.5 py-0.5 text-[11px] font-bold text-ink-soft">
              {m.uf}
            </span>
          )}
        </span>
      </div>
      <div className="truncate text-[12px] text-ink-soft">
        {m.veiculo ?? "Veículo sem modelo no cadastro"}
      </div>
      <div className="truncate text-[12px] text-ink-soft">{m.motorista ?? "Acesso restrito"}</div>
      <Prazo rotulo="Autuação" data={m.autuada_em} destaque={false} />
      <Prazo rotulo="Recorrer até" data={m.prazo_recurso} destaque={m.destaque_recurso} />
      <Prazo rotulo="Pagar até" data={m.prazo_pagamento} destaque={m.destaque_pagamento} />
      <Pagamento m={m} />
    </button>
  );
}

function FaixaSincronizacao({ s }: { s: QuadroMultas["sincronizacao"] }) {
  if (s.situacao === "ok") {
    return (
      <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5" /> Última sincronização: {dataHoraBR(s.ultima_em)}
      </p>
    );
  }
  const texto =
    s.situacao === "falha"
      ? `A integração falhou em ${dataHoraBR(s.tentativa_em)}. Estes são os dados da última sincronização${s.ultima_em ? `, de ${dataHoraBR(s.ultima_em)}` : ""}.`
      : `A integração com o e-Frotas ainda não está ligada${s.ultima_em ? `. Última sincronização: ${dataHoraBR(s.ultima_em)}` : ""}.`;
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-coral-line bg-coral-tint/50 px-4 py-3 text-[13px] text-coral">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {texto}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5 text-[13px] last:border-0">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right font-medium text-foreground">{valor ?? "—"}</span>
    </div>
  );
}

function BlocoTelemetria({ d }: { d: DetalheMulta }) {
  const t = d.telemetria;
  if (!t)
    return (
      <p className="text-[13px] text-muted-foreground">
        Sem leitura do rastreador até {d.janela_telemetria_min} minutos do horário da multa.
      </p>
    );
  return (
    <>
      <Linha
        rotulo="Leitura do rastreador"
        valor={new Date(t.local_time).toLocaleString("pt-BR")}
      />
      <Linha rotulo="Velocidade (GPS)" valor={t.speed != null ? `${t.speed} km/h` : null} />
      <Linha rotulo="Velocidade (painel)" valor={t.can_speed ? `${t.can_speed} km/h` : null} />
      <Linha rotulo="RPM" valor={t.rpm || null} />
      <Linha rotulo="Faixa de RPM" valor={t.faixa} />
      <Linha rotulo="Endereço do rastreador" valor={t.address} />
    </>
  );
}

function BlocoMotorista({ d }: { d: DetalheMulta }) {
  if (!d.motorista)
    return (
      <p className="text-[13px] text-muted-foreground">
        Seu perfil não tem acesso aos dados do motorista.
      </p>
    );
  return (
    <>
      <Linha rotulo="Motorista no horário" valor={d.motorista.nome} />
      <Linha rotulo="Matrícula" valor={d.motorista.matricula} />
      <Linha rotulo="Telefone" valor={d.motorista.telefone} />
      <Linha
        rotulo="CNH"
        valor={d.motorista.cnh_categoria ? `Categoria ${d.motorista.cnh_categoria}` : null}
      />
      <Linha
        rotulo="Validade da CNH"
        valor={d.motorista.cnh_validade ? dataBR(d.motorista.cnh_validade.slice(0, 10)) : null}
      />
    </>
  );
}

function BlocoMulta({ m }: { m: CardMulta }) {
  return (
    <>
      <Linha rotulo="AIT" valor={m.ait} />
      <Linha rotulo="Veículo" valor={[m.placa, m.veiculo].filter(Boolean).join(" · ")} />
      <Linha rotulo="Infração" valor={m.infracao} />
      <Linha rotulo="Hora da multa" valor={new Date(m.autuada_em).toLocaleString("pt-BR")} />
      <Linha rotulo="Local" valor={m.local} />
      <Linha rotulo="Órgão" valor={[m.orgao, m.uf].filter(Boolean).join(" · ")} />
      <Linha rotulo="Valor" valor={m.valor != null ? brl(m.valor) : null} />
      <Linha rotulo="Recorrer até" valor={dataBR(m.prazo_recurso)} />
      <Linha rotulo="Pagar até" valor={dataBR(m.prazo_pagamento)} />
      <Linha rotulo="Pontos" valor={m.pontos} />
    </>
  );
}

function RelatorioContestacao({ d, aoFechar }: { d: DetalheMulta; aoFechar: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[300] overflow-y-auto bg-[rgba(10,16,28,0.6)] p-4 md:p-10">
      <style>{`@media print { @page { size: A4; margin: 12mm; } body * { visibility: hidden !important; } .rel-multa, .rel-multa * { visibility: visible !important; } .rel-multa { position: absolute; inset: 0; box-shadow: none !important; padding: 0 !important; } .rel-nao-imprimir { display: none !important; } }`}</style>
      <div className="rel-nao-imprimir mx-auto mb-3 flex max-w-[860px] justify-end gap-2">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white"
        >
          <Printer className="h-4 w-4" /> Salvar em PDF
        </button>
        <button
          onClick={aoFechar}
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold"
        >
          Fechar
        </button>
      </div>
      <div className="rel-multa mx-auto max-w-[860px] space-y-5 rounded-xl bg-white p-8 shadow-xl">
        <header>
          <h2 className="font-display text-[22px] font-bold">
            Relatório de telemetria para contestação
          </h2>
          <p className="text-[12px] text-muted-foreground">
            Gerado em {dataHoraBR(d.gerado_em)} · dados do rastreador SS Telemática
          </p>
        </header>
        <section>
          <h3 className="mb-1 text-[14px] font-bold">Multa</h3>
          <BlocoMulta m={d.multa} />
        </section>
        <section>
          <h3 className="mb-1 text-[14px] font-bold">Motorista</h3>
          <BlocoMotorista d={d} />
        </section>
        <section>
          <h3 className="mb-1 text-[14px] font-bold">Telemetria no instante</h3>
          <BlocoTelemetria d={d} />
          {d.telemetria?.latitude != null && (
            <Linha
              rotulo="Coordenadas do veículo"
              valor={`${d.telemetria.latitude}, ${d.telemetria.longitude}`}
            />
          )}
        </section>
      </div>
    </div>,
    document.body,
  );
}

function DetalheLateral({
  id,
  aoFechar,
  aoMover,
}: {
  id: number;
  aoFechar: () => void;
  aoMover: (m: CardMulta, para: ChaveColuna) => void;
}) {
  const q = useQuery(detalheMultaQuery(id));
  const qc = useQueryClient();
  const [relatorio, setRelatorio] = useState<DetalheMulta | null>(null);
  const gerar = useMutation({
    mutationFn: () => gerarRelatorioMulta(id),
    onSuccess: (r) => {
      setRelatorio(r);
      qc.invalidateQueries({ queryKey: ["multas", "detalhe", id] });
    },
    onError: (e: Error) => toast.error(mensagemDoErro(e)),
  });
  const entradaBoleto = useRef<HTMLInputElement>(null);
  const anexar = useMutation({
    mutationFn: (f: File) => anexarBoleto(id, f),
    onSuccess: () => {
      toast.success("Boleto anexado.");
      qc.invalidateQueries({ queryKey: ["multas"] });
    },
    onError: (e: Error) => toast.error(mensagemDoErro(e)),
  });
  const d = q.data;
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex justify-end bg-[rgba(10,16,28,0.4)]"
      onClick={aoFechar}
    >
      <aside
        className="h-full w-full max-w-[520px] space-y-5 overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[20px] font-bold">
            {d ? `${d.multa.placa} · ${ROTULO[d.multa.coluna]}` : "Multa"}
          </h2>
          <button onClick={aoFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {q.error ? (
          <ErrorBox error={q.error} onRetry={() => q.refetch()} />
        ) : !d ? (
          <SkeletonRows rows={8} />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {d.pode_dados_pessoais && (
                <button
                  onClick={() => gerar.mutate()}
                  disabled={gerar.isPending}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {gerar.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}{" "}
                  Gerar relatório de telemetria
                </button>
              )}
              {(d.multa.coluna === "autuacao" || d.multa.coluna === "infracao") && (
                <button
                  onClick={() => aoMover(d.multa, "recorrida")}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
                >
                  Marcar como recorrida
                </button>
              )}
              <button
                onClick={() => entradaBoleto.current?.click()}
                disabled={anexar.isPending}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                <Paperclip className="h-4 w-4" />{" "}
                {d.multa.tem_boleto ? "Trocar boleto" : "Anexar boleto"}
              </button>
              <input
                ref={entradaBoleto}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) anexar.mutate(f);
                  e.target.value = "";
                }}
              />
            </div>
            {(d.multa.codigo_barras || d.multa.pix) && (
              <section className="space-y-2">
                <h3 className="text-[14px] font-bold">Pagamento</h3>
                {d.multa.codigo_barras && (
                  <button
                    onClick={() => copiar(d.multa.codigo_barras!, "Código de barras")}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left"
                  >
                    <span className="min-w-0 break-all font-mono text-[12px]">
                      {d.multa.codigo_barras}
                    </span>
                    <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                )}
                {d.multa.pix && (
                  <button
                    onClick={() => copiar(d.multa.pix!, "Pix")}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left"
                  >
                    <span className="min-w-0 truncate font-mono text-[12px]">{d.multa.pix}</span>
                    <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                )}
              </section>
            )}
            <section>
              <BlocoMulta m={d.multa} />
            </section>
            <section className="space-y-1">
              <h3 className="text-[14px] font-bold">Mapa</h3>
              <Suspense fallback={<SkeletonRows rows={3} />}>
                <MultasMapa d={d} />
              </Suspense>
            </section>
            <section>
              <h3 className="mb-1 text-[14px] font-bold">Telemetria no instante</h3>
              <BlocoTelemetria d={d} />
            </section>
            <section>
              <h3 className="mb-1 text-[14px] font-bold">Motorista</h3>
              <BlocoMotorista d={d} />
            </section>
            <section>
              <h3 className="mb-1 text-[14px] font-bold">Histórico</h3>
              {d.auditoria.map((a) => (
                <Linha
                  key={a.id}
                  rotulo={dataHoraBR(a.em)}
                  valor={
                    a.tipo === "relatorio"
                      ? `Relatório gerado (usuário ${a.usuario_id})`
                      : a.tipo === "boleto"
                        ? `Boleto anexado (usuário ${a.usuario_id})`
                        : `${a.de ? `${ROTULO[a.de]} → ` : "Entrada em "}${a.para ? ROTULO[a.para] : ""} (${a.origem === "oficial" ? "órgão oficial" : `usuário ${a.usuario_id}`})`
                  }
                />
              ))}
            </section>
          </>
        )}
        {relatorio && <RelatorioContestacao d={relatorio} aoFechar={() => setRelatorio(null)} />}
      </aside>
    </div>,
    document.body,
  );
}

export default function Multas() {
  const grupo = grupoAtivo() ?? "";
  const { data, isPending, error, refetch } = useQuery(quadroMultasQuery(grupo));
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);
  const [sobre, setSobre] = useState<ChaveColuna | null>(null);

  const atualizar = () => qc.invalidateQueries({ queryKey: ["multas"] });
  const mover = useMutation({
    mutationFn: ({ id, para }: { id: number; para: ChaveColuna }) => moverMulta(id, para),
    onSuccess: (_, v) => {
      toast.success(`Card movido para ${ROTULO[v.para]}.`);
      atualizar();
    },
    onError: (e: Error) => toast.warning(mensagemDoErro(e)),
  });
  const vistos = useMutation({ mutationFn: marcarAvisosVistos, onSuccess: atualizar });

  const estados = useMemo(
    () =>
      [
        ...new Set(
          (data?.colunas ?? [])
            .flatMap((c) => c.cards.map((m) => m.uf))
            .filter(Boolean) as string[],
        ),
      ].sort(),
    [data],
  );

  const colunas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (data?.colunas ?? []).map((c) => {
      const cards = c.cards.filter(
        (m) =>
          (!termo ||
            m.placa.toLowerCase().includes(termo) ||
            (m.motorista ?? "").toLowerCase().includes(termo)) &&
          (!uf || m.uf === uf) &&
          (!de || m.autuada_em.slice(0, 10) >= de) &&
          (!ate || m.autuada_em.slice(0, 10) <= ate),
      );
      return {
        ...c,
        cards,
        quantidade: cards.length,
        valor_total: cards.reduce((a, m) => a + (m.valor ?? 0), 0),
      };
    });
  }, [data, busca, uf, de, ate]);

  const tentarMover = (m: CardMulta | undefined, para: ChaveColuna) => {
    if (!m || m.coluna === para) return;
    if (para === "paga" || para === "cancelada") {
      toast.warning(data?.aviso_so_oficial ?? "Aguardando confirmação do órgão oficial");
      return;
    }
    mover.mutate({ id: m.id, para });
  };

  const soltar = (e: DragEvent, para: ChaveColuna) => {
    e.preventDefault();
    setSobre(null);
    const id = Number(e.dataTransfer.getData("text/plain"));
    tentarMover(
      data?.colunas.flatMap((c) => c.cards).find((m) => m.id === id),
      para,
    );
  };

  const total = (data?.colunas ?? []).reduce((a, c) => a + c.quantidade, 0);
  const visiveis = colunas.flatMap((c) => c.cards);
  const abertas = visiveis.filter((m) => m.coluna !== "paga" && m.coluna !== "cancelada");
  const exportar = () => {
    const n = exportarCSV(
      visiveis,
      [
        { cabecalho: "AIT", valor: (m) => m.ait },
        { cabecalho: "Placa", valor: (m) => m.placa },
        { cabecalho: "Veículo", valor: (m) => m.veiculo ?? "" },
        { cabecalho: "Motorista", valor: (m) => m.motorista ?? "" },
        { cabecalho: "Data da autuação", valor: (m) => dataBR(m.autuada_em) },
        { cabecalho: "Infração", valor: (m) => m.infracao ?? "" },
        { cabecalho: "Estado", valor: (m) => m.uf ?? "" },
        { cabecalho: "Recorrer até", valor: (m) => dataBR(m.prazo_recurso) },
        { cabecalho: "Pagar até", valor: (m) => dataBR(m.prazo_pagamento) },
        { cabecalho: "Pontos", valor: (m) => m.pontos ?? "" },
        { cabecalho: "Valor", valor: (m) => m.valor ?? "" },
        { cabecalho: "Etapa", valor: (m) => ROTULO[m.coluna] },
      ],
      "multas",
    );
    toast.success(`${n} multas exportadas.`);
  };
  const campo = "h-9 rounded-lg border border-border bg-white px-3 text-[13px]";

  return (
    <>
      <PageHeader
        title="Multas"
        subtitle="Pessoas › Quadro de multas"
        actions={
          <button
            onClick={exportar}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Download className="h-[15px] w-[15px]" /> Exportar
          </button>
        }
      />
      <div className="mx-auto max-w-[1600px] space-y-4 px-6 py-6 md:px-8">
        {error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : isPending || !data ? (
          <SkeletonRows rows={6} />
        ) : (
          <>
            <FaixaSincronizacao s={data.sincronizacao} />

            {data.avisos.length > 0 && (
              <div className="rounded-xl border border-border bg-white px-4 py-3 text-[13px]">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <strong>
                    O órgão oficial mudou{" "}
                    {data.avisos.length === 1 ? "1 multa" : `${data.avisos.length} multas`}
                  </strong>
                  <button
                    onClick={() => vistos.mutate(data.avisos[0].id)}
                    className="text-[12px] font-semibold text-brand-navy underline"
                  >
                    Ok, visto
                  </button>
                </div>
                {data.avisos.slice(0, 5).map((a) => (
                  <div key={a.id} className="text-ink-soft">
                    {a.placa} · AIT {a.ait}: {ROTULO[a.de]} → {ROTULO[a.para]} ({dataHoraBR(a.em)})
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile
                icon={Gavel}
                label="Multas registradas"
                value={String(visiveis.length)}
                color="var(--brand-navy)"
              />
              <StatTile
                icon={CalendarClock}
                label="Prazo vencendo"
                value={String(
                  abertas.filter((m) => m.destaque_recurso || m.destaque_pagamento).length,
                )}
                color="var(--coral)"
                foot="em até 7 dias"
              />
              <StatTile
                icon={Scale}
                label="Valor em aberto"
                value={brl(abertas.reduce((a, m) => a + (m.valor ?? 0), 0))}
                color="var(--gold)"
              />
              <StatTile
                icon={AlertTriangle}
                label="Pontos em aberto"
                value={String(abertas.reduce((a, m) => a + (m.pontos ?? 0), 0))}
                color="var(--coral)"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Placa ou motorista"
                  className={cn(campo, "w-[220px] pl-8")}
                />
              </div>
              <select
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className={campo}
                aria-label="Estado"
              >
                <option value="">Todos os estados</option>
                {estados.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                De{" "}
                <input
                  type="date"
                  value={de}
                  onChange={(e) => setDe(e.target.value)}
                  className={campo}
                />
              </label>
              <label className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                Até{" "}
                <input
                  type="date"
                  value={ate}
                  onChange={(e) => setAte(e.target.value)}
                  className={campo}
                />
              </label>
            </div>

            {total === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
                <Gavel className="h-7 w-7 text-muted-foreground" />
                <p className="text-[14px] font-semibold">Nenhuma multa registrada</p>
              </div>
            ) : (
              <div className="grid gap-3 overflow-x-auto pb-2 lg:grid-cols-5">
                {colunas.map((c) => (
                  <section
                    key={c.chave}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setSobre(c.chave);
                    }}
                    onDragLeave={() => setSobre(null)}
                    onDrop={(e) => soltar(e, c.chave)}
                    className={cn(
                      "min-w-[230px] space-y-2 rounded-xl bg-secondary/60 p-2.5",
                      sobre === c.chave && "ring-2 ring-brand-navy",
                    )}
                  >
                    <header className="px-1">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[14px] font-bold">{c.rotulo}</h2>
                        <span className="font-mono text-[13px] font-bold">{c.quantidade}</span>
                      </div>
                      <div className="font-mono text-[12px] text-muted-foreground">
                        {brl(c.valor_total)}
                      </div>
                    </header>
                    {c.cards.map((m) => (
                      <Cartao key={m.id} m={m} aoAbrir={() => setAberta(m.id)} />
                    ))}
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {aberta != null && (
        <DetalheLateral id={aberta} aoFechar={() => setAberta(null)} aoMover={tentarMover} />
      )}
    </>
  );
}
