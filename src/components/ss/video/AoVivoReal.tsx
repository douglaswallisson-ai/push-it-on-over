import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  Clock,
  Gauge,
  KeyRound,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  User,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { PlayerAoVivo, type ErroPlayer } from "@/components/ss/video/PlayerAoVivo";
import { Cameras, camerasQuery, type Transmissao, type VeiculoCamera } from "@/lib/cameras-api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { desde, nf } from "@/lib/queries";
import { registrarAuditoria } from "@/lib/session";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Monitoramento ao vivo com as câmeras reais — a tela "Vídeos Online" da
 * plataforma de câmeras trazida para cá.
 *
 * Igual à de lá: lista de veículos com câmera, status online, telemetria do
 * veículo e canais 1 a 5 abertos um a um, com até 3 tentativas de reconexão
 * (2 s, 4 s, 6 s). Diferente: até 4 canais ao mesmo tempo (consumo de dados do
 * chip) e os motivos de botão desabilitado aparecem no próprio botão.
 */

const MAX_ABERTOS = 4;
const MAX_TENTATIVAS = 3;

type Canal = {
  numero: number;
  estado: "abrindo" | "tocando" | "erro";
  transmissao?: Transmissao;
  erro?: string;
  tentativa: number;
};

function statusVeiculo(v: VeiculoCamera): { tone: PillTone; texto: string } {
  if (!v.ao_vivo) return { tone: "neutral", texto: "Sem vídeo ao vivo" };
  if (v.online === true) return { tone: "green", texto: "Online" };
  if (v.online === false) return { tone: "coral", texto: "Offline" };
  return { tone: "neutral", texto: "Status desconhecido" };
}

/** Por que não dá para abrir o vídeo agora (null = pode abrir). */
function bloqueio(v: VeiculoCamera | null): string | null {
  if (!v) return "Selecione um veículo";
  if (!v.ao_vivo) return `O modelo ${v.modelo ?? ""} não tem vídeo ao vivo`;
  if (!v.codigo) return "Veículo sem câmera configurada";
  if (v.online === false) return "Câmera offline";
  if (v.ignicao === false) return "Ignição desligada — a câmera fica em espera";
  return null;
}

export function AoVivoReal() {
  const g = grupoAtivo();
  const q = useQuery(camerasQuery(g));
  const [busca, setBusca] = useState("");
  const [selId, setSelId] = useState<number | null>(null);
  const [canais, setCanais] = useState<Canal[]>([]);
  const timers = useRef<number[]>([]);
  // Para as respostas e reconexões atrasadas não reabrirem um canal já fechado
  // nem caírem no veículo seguinte.
  const canaisRef = useRef(canais);
  canaisRef.current = canais;
  const selRef = useRef(selId);
  selRef.current = selId;

  const veiculos = useMemo(() => q.data?.veiculos ?? [], [q.data]);
  const sel = veiculos.find((v) => v.unit_id === selId) ?? null;
  const motivo = bloqueio(sel);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const ordem = (v: VeiculoCamera) =>
      !v.ao_vivo ? 3 : v.online === true ? 0 : v.online == null ? 1 : 2;
    return veiculos
      .filter(
        (v) =>
          !t ||
          [v.placa, v.prefixo, v.codigo, v.motorista].some((x) =>
            (x ?? "").toLowerCase().includes(t),
          ),
      )
      .sort((a, b) => ordem(a) - ordem(b) || a.placa.localeCompare(b.placa));
  }, [veiculos, busca]);

  const limparTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // Trocar de veículo fecha tudo (igual à plataforma de câmeras).
  useEffect(() => {
    limparTimers();
    setCanais([]);
  }, [selId]);
  useEffect(() => limparTimers, []);

  const abrir = async (unitId: number, numero: number, tentativa = 0) => {
    setCanais((cs): Canal[] => {
      const outros = cs.filter((c) => c.numero !== numero);
      const novo: Canal = { numero, estado: "abrindo", tentativa };
      return [...outros, novo].sort((a, b) => a.numero - b.numero);
    });
    try {
      const t = await Cameras.abrir(unitId, numero);
      if (selRef.current !== unitId) return;
      setCanais((cs) =>
        cs.map((c) =>
          c.numero === numero ? { ...c, estado: "tocando", transmissao: t, erro: undefined } : c,
        ),
      );
    } catch (e) {
      if (selRef.current !== unitId) return;
      setCanais((cs) =>
        cs.map((c) => (c.numero === numero ? { ...c, estado: "erro", erro: mensagemErro(e) } : c)),
      );
    }
  };

  const alternar = (numero: number) => {
    if (!sel) return;
    if (canais.some((c) => c.numero === numero)) {
      setCanais((cs) => cs.filter((c) => c.numero !== numero));
      return;
    }
    if (canais.length >= MAX_ABERTOS) return;
    registrarAuditoria("video_ao_vivo", `Canal ${numero} aberto — veículo ${sel.placa}.`);
    void abrir(sel.unit_id, numero);
  };

  const aoErroDoPlayer = (numero: number) => (e: ErroPlayer) => {
    const c = canais.find((x) => x.numero === numero);
    if (!sel || !c) return;
    const proxima = c.tentativa + 1;
    const origem =
      e.categoria === "rede" ? "Câmera sem sinal ou serviço de vídeo instável" : "Falha do player";
    if (proxima > MAX_TENTATIVAS) {
      setCanais((cs) =>
        cs.map((x) =>
          x.numero === numero
            ? {
                ...x,
                estado: "erro",
                erro: `${origem} (${e.motivo}). Sem sucesso após ${MAX_TENTATIVAS} tentativas.`,
              }
            : x,
        ),
      );
      return;
    }
    setCanais((cs) =>
      cs.map((x) =>
        x.numero === numero
          ? {
              ...x,
              estado: "abrindo",
              transmissao: undefined,
              tentativa: proxima,
              erro: `${origem} — tentativa ${proxima}/${MAX_TENTATIVAS}`,
            }
          : x,
      ),
    );
    const unitId = sel.unit_id;
    timers.current.push(
      window.setTimeout(() => {
        if (selRef.current === unitId && canaisRef.current.some((x) => x.numero === numero))
          void abrir(unitId, numero, proxima);
      }, 2000 * proxima),
    );
  };

  if (!g) return <EmptyNote>Escolha uma empresa no topo do menu para ver as câmeras.</EmptyNote>;
  if (q.error) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;

  const comVideo = veiculos.filter((v) => v.ao_vivo);
  const online = comVideo.filter((v) => v.online === true).length;
  const offline = comVideo.filter((v) => v.online === false).length;
  const nCanais = q.data?.canais ?? 5;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Camera}
          label="Veículos com câmera"
          value={nf(veiculos.length)}
          color="var(--brand-sky)"
        />
        <StatTile
          icon={Wifi}
          label="Câmeras online"
          value={nf(online)}
          color="var(--leaf)"
          foot={`de ${nf(comVideo.length)} com vídeo ao vivo`}
        />
        <StatTile icon={WifiOff} label="Offline" value={nf(offline)} color="var(--coral)" />
        <StatTile
          icon={VideoOff}
          label="Sem vídeo ao vivo"
          value={nf(veiculos.length - comVideo.length)}
          color="var(--gold)"
          foot="modelo não suporta (ex.: MV03)"
        />
      </div>

      {(q.data?.avisos ?? []).map((a) => (
        <p
          key={a}
          className="flex items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-[13px] text-foreground"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          {a}
        </p>
      ))}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card
          title="Veículos"
          icon={Camera}
          action={
            <button
              onClick={() => q.refetch()}
              disabled={q.isFetching}
              title="Atualizar status"
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", q.isFetching && "animate-spin")} />
            </button>
          }
          bodyClassName="p-3"
        >
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Placa, prefixo, IMEI ou motorista…"
              className="h-9 w-full rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
            />
          </div>
          {q.isPending ? (
            <SkeletonRows rows={6} />
          ) : lista.length === 0 ? (
            <EmptyNote>
              {veiculos.length
                ? "Nenhum veículo encontrado."
                : "Esta empresa não tem veículo com câmera."}
            </EmptyNote>
          ) : (
            <ul className="max-h-[520px] space-y-1 overflow-y-auto">
              {lista.map((v) => {
                const st = statusVeiculo(v);
                return (
                  <li key={v.unit_id}>
                    <button
                      onClick={() => setSelId(v.unit_id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                        selId === v.unit_id ? "bg-navy-tint" : "hover:bg-secondary",
                        !v.ao_vivo && "opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          v.online === true
                            ? "bg-leaf"
                            : v.online === false
                              ? "bg-coral"
                              : "bg-muted-foreground/40",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[13px] font-bold text-foreground">
                          {v.placa}
                        </span>
                        <span className="block truncate text-[12px] text-muted-foreground">
                          {v.modelo ?? "—"} · {st.texto}
                          {v.ultima_posicao ? ` · ${desde(v.ultima_posicao)}` : ""}
                        </span>
                      </span>
                      {v.ignicao && v.velocidade != null && (
                        <span className="shrink-0 font-mono text-[12px] text-muted-foreground">
                          {Math.round(v.velocidade)} km/h
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          title={
            sel ? `${sel.placa}${sel.prefixo ? ` — ${sel.prefixo}` : ""}` : "Transmissão ao vivo"
          }
          icon={Video}
          action={sel && <Pill tone={statusVeiculo(sel).tone}>{statusVeiculo(sel).texto}</Pill>}
          bodyClassName="p-4"
        >
          {!sel ? (
            <div className="flex h-[360px] flex-col items-center justify-center text-center">
              <Camera className="h-9 w-9 text-muted-foreground" />
              <p className="mt-3 text-[14px] font-medium text-foreground">
                Selecione um veículo com câmera na lista ao lado
              </p>
              <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
                Os canais são abertos um a um porque a transmissão consome dados móveis do chip do
                equipamento.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-[12px] text-muted-foreground">
                IMEI <span className="font-mono text-foreground">{sel.codigo ?? "—"}</span> · Modelo{" "}
                <span className="text-foreground">{sel.modelo ?? "—"}</span>
              </p>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <Metrica
                  icon={Gauge}
                  rotulo="Velocidade"
                  valor={
                    sel.ignicao && sel.velocidade != null
                      ? `${Math.round(sel.velocidade)} km/h`
                      : "—"
                  }
                />
                <Metrica
                  icon={KeyRound}
                  rotulo="Ignição"
                  valor={sel.ignicao == null ? "—" : sel.ignicao ? "Ligada" : "Desligada"}
                  destaque={sel.ignicao ? "leaf" : "coral"}
                />
                <Metrica icon={User} rotulo="Motorista" valor={sel.motorista || "—"} />
                <Metrica
                  icon={Clock}
                  rotulo="Última posição"
                  valor={
                    sel.ultima_posicao ? new Date(sel.ultima_posicao).toLocaleString("pt-BR") : "—"
                  }
                />
                <Metrica
                  icon={MapPin}
                  rotulo="Ponto / cerca"
                  valor={sel.ponto || sel.cerca || "—"}
                />
                <Metrica
                  icon={MapPin}
                  rotulo="Localização"
                  valor={
                    sel.endereco ||
                    (sel.latitude
                      ? `${sel.latitude.toFixed(4)}, ${sel.longitude?.toFixed(4)}`
                      : "—")
                  }
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-medium text-muted-foreground">Canais:</span>
                {Array.from({ length: nCanais }, (_, i) => i + 1).map((n) => {
                  const aberto = canais.some((c) => c.numero === n);
                  const cheio = !aberto && canais.length >= MAX_ABERTOS;
                  const titulo = aberto
                    ? `Fechar canal ${n}`
                    : (motivo ??
                      (cheio
                        ? `No máximo ${MAX_ABERTOS} canais ao mesmo tempo`
                        : `Abrir canal ${n}`));
                  return (
                    <span key={n} title={titulo}>
                      <button
                        onClick={() => alternar(n)}
                        disabled={!aberto && (Boolean(motivo) || cheio)}
                        className={cn(
                          "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          aberto
                            ? "border-brand-navy bg-brand-navy text-white"
                            : "border-border bg-white text-foreground hover:bg-secondary",
                        )}
                      >
                        <Video className="h-3.5 w-3.5" />
                        Canal {n}
                      </button>
                    </span>
                  );
                })}
                {motivo && <span className="text-[12px] text-muted-foreground">{motivo}</span>}
              </div>

              {canais.length > 0 && (
                <div className={cn("mt-4 grid gap-3", canais.length > 1 && "sm:grid-cols-2")}>
                  {canais.map((c) => (
                    <div
                      key={c.numero}
                      className="relative aspect-video overflow-hidden rounded-xl border border-border bg-[oklch(0.22_0.02_260)]"
                    >
                      {c.estado === "tocando" && c.transmissao ? (
                        <PlayerAoVivo
                          url={c.transmissao.url}
                          formato={c.transmissao.formato}
                          onErro={aoErroDoPlayer(c.numero)}
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-white/60">
                          {c.estado === "abrindo" ? (
                            <Loader2 className="h-7 w-7 animate-spin" />
                          ) : (
                            <VideoOff className="h-7 w-7" />
                          )}
                          <span className="text-[12px]">
                            {c.estado === "abrindo"
                              ? `Conectando ao canal ${c.numero}…`
                              : `Canal ${c.numero} indisponível`}
                          </span>
                          {c.erro && <span className="text-[12px] text-white/50">{c.erro}</span>}
                          {c.estado === "erro" && (
                            <button
                              onClick={() => void abrir(sel.unit_id, c.numero)}
                              className="mt-1 rounded-lg border border-white/30 px-3 py-1 text-[12px] text-white hover:bg-white/10"
                            >
                              Tentar de novo
                            </button>
                          )}
                        </div>
                      )}
                      <span className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded bg-black/60 px-2 py-0.5 text-[12px] font-medium text-white">
                        {c.estado === "tocando" && (
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-coral" />
                        )}
                        Canal {c.numero}
                        {c.estado === "tocando" ? " · AO VIVO" : ""}
                      </span>
                      <button
                        onClick={() => setCanais((cs) => cs.filter((x) => x.numero !== c.numero))}
                        title={`Fechar canal ${c.numero}`}
                        className="absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center rounded bg-black/60 text-white hover:bg-black/80"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Metrica({
  icon: Icon,
  rotulo,
  valor,
  destaque,
}: {
  icon: typeof Gauge;
  rotulo: string;
  valor: string;
  destaque?: "leaf" | "coral";
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-2">
      <Icon
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground",
          destaque === "leaf" && "text-leaf",
          destaque === "coral" && "text-coral",
        )}
      />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground">{rotulo}</div>
        <div className="truncate text-[13px] font-medium text-foreground" title={valor}>
          {valor}
        </div>
      </div>
    </div>
  );
}
