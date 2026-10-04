import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Camera,
  Grid2x2,
  HardDrive,
  Maximize2,
  Radio,
  RefreshCw,
  Search,
  Volume2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { FiltroGaragem } from "@/components/ss/ui/FiltroGaragem";
import { desde, dispositivosVideoQuery, nf, veiculosQuery } from "@/lib/queries";
import { registrarAuditoria } from "@/lib/session";
import type { DispositivoVideo, StatusDVR } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Monitoramento ao vivo.
 *
 * O cliente não quer só o clipe do evento — quer abrir a câmera de um carro
 * agora, sem esperar acontecer alguma coisa. Casos típicos: reclamação de
 * passageiro em curso, suspeita de assalto, verificação de lotação, conferência
 * de motorista em rota.
 *
 * O consumo de dados móveis é a restrição real aqui, por isso o padrão é grade
 * de 4 e a abertura é sempre por escolha explícita do operador — nunca todas
 * as câmeras da frota transmitindo ao mesmo tempo.
 */

const STATUS_LABEL: Record<StatusDVR, string> = {
  online: "Online",
  gravando: "Gravando",
  offline: "Offline",
  sem_sinal_gps: "Sem GPS",
};

const STATUS_TONE: Record<StatusDVR, PillTone> = {
  online: "sky",
  gravando: "green",
  offline: "coral",
  sem_sinal_gps: "gold",
};

export function AoVivo() {
  const { data, isPending, error, refetch, isFetching } = useQuery(dispositivosVideoQuery());
  const veiculosQ = useQuery(veiculosQuery(1, 200));

  const [busca, setBusca] = useState("");
  const [garagem, setGaragem] = useState("");
  const [selecionado, setSelecionado] = useState<DispositivoVideo | null>(null);
  const [grade, setGrade] = useState<1 | 4>(4);
  const [canalFoco, setCanalFoco] = useState(1);

  const veiculoPorId = useMemo(() => {
    const m = new Map<string, { prefixo: string; placa: string; garagemId?: string }>();
    for (const v of veiculosQ.data?.items ?? []) {
      m.set(v.id, { prefixo: v.prefixo ?? v.placa, placa: v.placa, garagemId: v.garagemId });
    }
    return m;
  }, [veiculosQ.data]);

  const dispositivos = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (data ?? []).filter((d) => {
      const v = veiculoPorId.get(d.veiculoId);
      if (garagem && v?.garagemId !== garagem) return false;
      if (!t) return true;
      return (
        (v?.prefixo ?? "").toLowerCase().includes(t) ||
        (v?.placa ?? "").toLowerCase().includes(t) ||
        d.imei.includes(t)
      );
    });
  }, [data, busca, garagem, veiculoPorId]);

  const online = (data ?? []).filter((d) => d.status !== "offline");
  const gravando = (data ?? []).filter((d) => d.status === "gravando");
  const armazenamentoCritico = (data ?? []).filter((d) => d.armazenamentoPct >= 85);

  const abrir = (d: DispositivoVideo) => {
    if (d.status === "offline") {
      toast.error("Equipamento offline.", { description: "Não é possível abrir transmissão ao vivo." });
      return;
    }
    setSelecionado(d);
    setCanalFoco(d.canais.find((c) => c.online)?.numero ?? 1);
    registrarAuditoria(
      "video_ao_vivo",
      `Transmissão ao vivo aberta — veículo ${veiculoPorId.get(d.veiculoId)?.prefixo ?? d.veiculoId}.`,
    );
  };

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;

  const canaisVisiveis = selecionado
    ? grade === 1
      ? selecionado.canais.filter((c) => c.numero === canalFoco)
      : selecionado.canais.slice(0, 4)
    : [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Wifi} label="Equipamentos online" value={nf(online.length)} color="var(--leaf)" />
        <StatTile icon={Radio} label="Gravando agora" value={nf(gravando.length)} color="var(--brand-sky)" />
        <StatTile icon={WifiOff} label="Offline" value={nf((data ?? []).length - online.length)} color="var(--coral)" />
        <StatTile
          icon={HardDrive}
          label="Armazenamento crítico"
          value={nf(armazenamentoCritico.length)}
          color={armazenamentoCritico.length ? "var(--gold)" : "var(--leaf)"}
          foot="acima de 85%"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Lista de veículos. */}
        <Card
          title="Veículos"
          icon={Camera}
          action={
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-60"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            </button>
          }
          bodyClassName="p-3"
        >
          <div className="mb-2 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Prefixo, placa ou IMEI…"
                className="h-9 w-full rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
              />
            </div>
            <FiltroGaragem valor={garagem} onChange={setGaragem} className="inline-flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-white px-3" />
          </div>

          {isPending ? (
            <SkeletonRows rows={5} />
          ) : dispositivos.length === 0 ? (
            <EmptyNote>Nenhum equipamento encontrado.</EmptyNote>
          ) : (
            <ul className="max-h-[420px] space-y-1 overflow-y-auto">
              {dispositivos.map((d) => {
                const v = veiculoPorId.get(d.veiculoId);
                const ativo = selecionado?.imei === d.imei;
                const canaisOn = d.canais.filter((c) => c.online).length;
                return (
                  <li key={d.imei}>
                    <button
                      onClick={() => abrir(d)}
                      disabled={d.status === "offline"}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                        ativo ? "bg-navy-tint" : "hover:bg-secondary",
                        d.status === "offline" && "opacity-55",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full",
                          d.status === "gravando" ? "bg-leaf" : d.status === "offline" ? "bg-coral" : d.status === "sem_sinal_gps" ? "bg-gold" : "bg-brand-sky",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[13px] font-bold text-foreground">
                          {v?.prefixo ?? "—"}
                        </span>
                        <span className="block truncate text-[12px] text-muted-foreground">
                          {canaisOn}/{d.canais.length} câmeras · {desde(d.ultimaComunicacao)}
                        </span>
                      </span>
                      {d.velocidadeKmh != null && d.status !== "offline" && (
                        <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{d.velocidadeKmh} km/h</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Player. */}
        <Card
          title={selecionado ? `Ao vivo — ${veiculoPorId.get(selecionado.veiculoId)?.prefixo ?? ""}` : "Transmissão ao vivo"}
          icon={Radio}
          action={
            selecionado && (
              <div className="flex items-center gap-2">
                <Pill tone={STATUS_TONE[selecionado.status]}>{STATUS_LABEL[selecionado.status]}</Pill>
                <button
                  onClick={() => setGrade(grade === 4 ? 1 : 4)}
                  title={grade === 4 ? "Ver um canal" : "Ver quatro canais"}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
                >
                  {grade === 4 ? <Maximize2 className="h-3.5 w-3.5" /> : <Grid2x2 className="h-3.5 w-3.5" />}
                </button>
              </div>
            )
          }
          bodyClassName="p-4"
        >
          {!selecionado ? (
            <div className="flex h-[360px] flex-col items-center justify-center text-center">
              <Camera className="h-9 w-9 text-muted-foreground" />
              <p className="mt-3 text-[14px] font-medium text-foreground">Escolha um veículo para abrir a transmissão</p>
              <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
                A transmissão consome dados móveis do plano do equipamento, por isso é aberta sob demanda e não fica
                ligada para toda a frota.
              </p>
            </div>
          ) : (
            <>
              <div className={cn("grid gap-3", grade === 4 ? "sm:grid-cols-2" : "grid-cols-1")}>
                {canaisVisiveis.map((c) => (
                  <div
                    key={c.numero}
                    className={cn(
                      "relative overflow-hidden rounded-xl border border-border bg-[oklch(0.22_0.02_260)]",
                      grade === 1 ? "aspect-video" : "aspect-video",
                    )}
                  >
                    {c.online ? (
                      <>
                        {/* Área do stream. O player real entra aqui quando o
                            serviço de mídia existir. */}
                        <div className="flex h-full w-full items-center justify-center">
                          <span className="flex flex-col items-center gap-2 text-white/40">
                            <Camera className="h-8 w-8" />
                            <span className="text-[12px]">Aguardando serviço de mídia</span>
                          </span>
                        </div>
                        <span className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded bg-black/60 px-2 py-0.5 text-[12px] font-medium text-white">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-coral" />
                          AO VIVO
                        </span>
                        <span className="absolute right-2.5 top-2.5 rounded bg-black/60 px-2 py-0.5 font-mono text-[12px] text-white">
                          {c.nome}
                        </span>
                        <span className="absolute bottom-2.5 left-2.5 rounded bg-black/60 px-2 py-0.5 font-mono text-[12px] text-white/80">
                          {new Date().toLocaleTimeString("pt-BR")}
                          {selecionado.velocidadeKmh != null ? ` · ${selecionado.velocidadeKmh} km/h` : ""}
                        </span>
                        {grade === 4 && (
                          <button
                            onClick={() => {
                              setCanalFoco(c.numero);
                              setGrade(1);
                            }}
                            className="absolute inset-0"
                            aria-label={`Expandir ${c.nome}`}
                          />
                        )}
                      </>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/35">
                        <WifiOff className="h-7 w-7" />
                        <span className="text-[12px]">{c.nome} indisponível</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Contexto do equipamento. */}
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3 text-[12px] text-muted-foreground">
                <span>
                  IMEI <span className="font-mono text-foreground">{selecionado.imei}</span>
                </span>
                <span>
                  Modelo <span className="text-foreground">{selecionado.modelo}</span>
                </span>
                <span>
                  Armazenamento{" "}
                  <span className={cn("font-mono font-semibold", selecionado.armazenamentoPct >= 85 ? "text-coral" : "text-foreground")}>
                    {selecionado.armazenamentoPct}%
                  </span>
                </span>
                <span>
                  Retenção <span className="font-mono text-foreground">{selecionado.retencaoDias} dias</span>
                </span>
                {selecionado.gpsLat ? (
                  <span className="font-mono">
                    {selecionado.gpsLat.toFixed(4)}, {selecionado.gpsLng?.toFixed(4)}
                  </span>
                ) : (
                  <span className="text-gold">sem posição de GPS</span>
                )}
                <button
                  onClick={() => toast.info("Áudio bidirecional", { description: "Depende do serviço de mídia e do modelo do equipamento." })}
                  className="inline-flex items-center gap-1.5 text-brand-navy underline"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Falar com o motorista
                </button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
