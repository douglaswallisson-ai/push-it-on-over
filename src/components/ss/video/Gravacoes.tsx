import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudDownload, Download, HardDrive, Play, Server, Video } from "lucide-react";
import { toast } from "sonner";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import {
  dispositivosVideoQuery,
  nf,
  solicitacoesGravacaoQuery,
  trechosGravacaoQuery,
  veiculosQuery,
} from "@/lib/queries";
import { registrarAuditoria } from "@/lib/session";
import type { SolicitacaoGravacao, StatusDownload, TrechoGravacao } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Gravações contínuas.
 *
 * Diferente do clipe de ocorrência, que tem segundos e já subiu para o
 * servidor: a gravação contínua fica no cartão dentro do veículo e precisa ser
 * pedida.
 *
 * Isso muda a interface. Não dá para simplesmente listar e tocar — o operador
 * precisa ver **o que existe** (com as lacunas, que acontecem quando o
 * equipamento fica sem energia ou o cartão falha), escolher a janela e
 * solicitar. O download compete com o dado móvel do veículo, então a fila é
 * parte do fluxo, não um detalhe.
 */

const STATUS_LABEL: Record<StatusDownload, string> = {
  solicitado: "Na fila",
  baixando: "Baixando",
  disponivel: "Disponível",
  falhou: "Falhou",
};

const STATUS_TONE: Record<StatusDownload, PillTone> = {
  solicitado: "neutral",
  baixando: "sky",
  disponivel: "green",
  falhou: "coral",
};

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function Gravacoes() {
  const veiculosQ = useQuery(veiculosQuery(1, 200));
  const dispositivosQ = useQuery(dispositivosVideoQuery());
  const solicitacoesQ = useQuery(solicitacoesGravacaoQuery());

  const [veiculoId, setVeiculoId] = useState("");
  const [canal, setCanal] = useState(1);
  const [locais, setLocais] = useState<SolicitacaoGravacao[]>([]);

  const trechosQ = useQuery({ ...trechosGravacaoQuery(veiculoId || undefined), enabled: Boolean(veiculoId) });

  const prefixo = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of veiculosQ.data?.items ?? []) m.set(v.id, v.prefixo ?? v.placa);
    return m;
  }, [veiculosQ.data]);

  const comCamera = useMemo(() => {
    const ids = new Set((dispositivosQ.data ?? []).map((d) => d.veiculoId));
    return (veiculosQ.data?.items ?? []).filter((v) => ids.has(v.id));
  }, [dispositivosQ.data, veiculosQ.data]);

  const trechos = useMemo(
    () => (trechosQ.data ?? []).filter((t) => t.canal === canal).sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [trechosQ.data, canal],
  );

  const solicitacoes = [...locais, ...(solicitacoesQ.data ?? [])];
  const dispositivo = (dispositivosQ.data ?? []).find((d) => d.veiculoId === veiculoId);

  /** Régua de 24 h do dia de operação, para enxergar as lacunas. */
  const reguaHoras = Array.from({ length: 24 }, (_, h) => h);
  const cobertura = useMemo(() => {
    const mapa = new Map<number, TrechoGravacao>();
    for (const t of trechos) {
      const ini = new Date(t.inicio).getHours();
      const fim = new Date(t.fim).getHours();
      for (let h = ini; h < (fim === 0 ? 24 : fim); h++) mapa.set(h, t);
    }
    return mapa;
  }, [trechos]);

  const solicitar = (t: TrechoGravacao) => {
    const nova: SolicitacaoGravacao = {
      id: `sg${Date.now()}`,
      veiculoId: t.veiculoId,
      canal: t.canal,
      inicio: t.inicio,
      fim: t.fim,
      solicitadoPor: "Operador",
      solicitadoEm: new Date().toISOString(),
      status: t.local === "servidor" ? "disponivel" : "solicitado",
      progressoPct: t.local === "servidor" ? 100 : 0,
      motivo: "Solicitação manual",
    };
    setLocais((l) => [nova, ...l]);
    registrarAuditoria(
      "solicitacao_gravacao",
      `Gravação solicitada — veículo ${prefixo.get(t.veiculoId) ?? t.veiculoId}, canal ${t.canal}, ${hora(t.inicio)}–${hora(t.fim)}.`,
    );
    toast.success(
      t.local === "servidor" ? "Trecho já está no servidor." : "Solicitação enviada ao equipamento.",
      { description: `${prefixo.get(t.veiculoId)} · CAM ${t.canal} · ${hora(t.inicio)}–${hora(t.fim)}` },
    );
  };

  const COLS: Column<SolicitacaoGravacao & Record<string, unknown>>[] = [
    {
      key: "veiculoId",
      header: "Veículo",
      render: (s) => <span className="font-mono text-[13px] font-semibold">{prefixo.get(s.veiculoId) ?? "—"}</span>,
    },
    { key: "canal", header: "Canal", align: "center", render: (s) => <span className="font-mono text-[13px]">CAM {s.canal}</span> },
    {
      key: "janela",
      header: "Janela",
      render: (s) => (
        <span className="whitespace-nowrap font-mono text-[13px] text-ink-soft">
          {dataHora(s.inicio)} — {hora(s.fim)}
        </span>
      ),
    },
    { key: "motivo", header: "Motivo", render: (s) => <span className="text-[13px]">{s.motivo ?? "—"}</span> },
    { key: "solicitadoPor", header: "Solicitante", render: (s) => <span className="text-[13px] text-muted-foreground">{s.solicitadoPor}</span> },
    {
      key: "status",
      header: "Status",
      align: "center",
      render: (s) =>
        s.status === "baixando" ? (
          <span className="inline-flex w-28 flex-col items-center gap-1">
            <span className="font-mono text-[12px] text-brand-sky">{s.progressoPct}%</span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <span className="block h-1.5 rounded-full bg-brand-sky" style={{ width: `${s.progressoPct}%` }} />
            </span>
          </span>
        ) : (
          <Pill tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Pill>
        ),
    },
    {
      key: "acao",
      header: "",
      align: "right",
      render: (s) =>
        s.status === "disponivel" ? (
          <button
            onClick={() => toast.info("Reprodução", { description: "O player entra com o serviço de mídia." })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-2.5 py-1 text-[12px] font-semibold text-white"
          >
            <Play className="h-3.5 w-3.5" />
            Assistir
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Video} label="Veículos com câmera" value={nf(comCamera.length)} color="var(--brand-navy)" />
        <StatTile
          icon={HardDrive}
          label="Retenção média"
          value={`${Math.round(((dispositivosQ.data ?? []).reduce((a, d) => a + d.retencaoDias, 0) || 0) / Math.max(1, (dispositivosQ.data ?? []).length))}`}
          unit="dias"
          color="var(--brand-sky)"
          foot="no cartão do veículo"
        />
        <StatTile icon={CloudDownload} label="Downloads na fila" value={nf(solicitacoes.filter((s) => s.status !== "disponivel").length)} color="var(--gold)" />
        <StatTile icon={Server} label="Prontos no servidor" value={nf(solicitacoes.filter((s) => s.status === "disponivel").length)} color="var(--leaf)" />
      </div>

      <Card
        title="Consultar gravação"
        icon={Video}
        action={
          <div className="flex items-center gap-2">
            <select
              value={veiculoId}
              onChange={(e) => setVeiculoId(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
            >
              <option value="">Selecione o veículo…</option>
              {comCamera.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.prefixo ?? v.placa} — {v.placa}
                </option>
              ))}
            </select>
            {dispositivo && (
              <select
                value={canal}
                onChange={(e) => setCanal(Number(e.target.value))}
                className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
              >
                {dispositivo.canais.map((c) => (
                  <option key={c.numero} value={c.numero}>
                    {c.nome}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
        bodyClassName="p-4"
      >
        {!veiculoId ? (
          <EmptyNote>Escolha um veículo para ver o que está gravado no equipamento.</EmptyNote>
        ) : trechosQ.isPending ? (
          <SkeletonRows rows={3} />
        ) : trechosQ.error ? (
          <ErrorBox error={trechosQ.error} onRetry={() => trechosQ.refetch()} />
        ) : (
          <>
            {/* Régua do dia com as lacunas visíveis. */}
            <div className="mb-2 flex gap-[2px]">
              {reguaHoras.map((h) => {
                const t = cobertura.get(h);
                return (
                  <button
                    key={h}
                    onClick={() => t && solicitar(t)}
                    disabled={!t}
                    title={t ? `${String(h).padStart(2, "0")}:00 — ${t.local === "servidor" ? "no servidor" : "no equipamento"}` : `${String(h).padStart(2, "0")}:00 — sem gravação`}
                    className={cn(
                      "h-9 flex-1 rounded-[3px] transition-opacity",
                      !t
                        ? "cursor-not-allowed bg-secondary"
                        : t.local === "servidor"
                          ? "bg-leaf hover:opacity-80"
                          : "bg-brand-sky hover:opacity-80",
                    )}
                  />
                );
              })}
            </div>
            <div className="flex justify-between font-mono text-[12px] text-muted-foreground">
              {[0, 6, 12, 18, 23].map((h) => (
                <span key={h}>{String(h).padStart(2, "0")}h</span>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-[12px]">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-leaf" /> Já no servidor
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-brand-sky" /> No equipamento — precisa solicitar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-secondary" /> Sem gravação
              </span>
            </div>

            <p className="mt-3 text-[12px] text-muted-foreground">
              Clique numa faixa para solicitar o trecho. As lacunas costumam ser queda de energia do equipamento ou
              falha de cartão — vale investigar quando se repetem no mesmo veículo.
            </p>
          </>
        )}
      </Card>

      <Card
        title="Solicitações de download"
        icon={Download}
        action={<Pill tone="sky">{solicitacoes.length} registros</Pill>}
        bodyClassName="p-4"
      >
        {solicitacoes.length ? (
          <DataTable columns={COLS} rows={solicitacoes as (SolicitacaoGravacao & Record<string, unknown>)[]} />
        ) : (
          <EmptyNote>Nenhuma solicitação de gravação.</EmptyNote>
        )}
        <p className="mt-3 text-[12px] text-muted-foreground">
          O download compete com o dado móvel do veículo em operação, por isso entra em fila e não é imediato. Toda
          solicitação fica registrada em auditoria com o solicitante.
        </p>
      </Card>
    </div>
  );
}
