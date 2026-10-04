import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Cable, Camera, Database, Info, Link2, Radio, Search, Unlink, Video } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { nf, veiculosApiQuery, vinculosCameraQuery, vinculosRastreadorQuery } from "@/lib/queries";
import { usandoMock } from "@/lib/modo";
import { cn } from "@/lib/utils";

/**
 * Vínculos de equipamento.
 *
 * É o cadastro que sustenta todo o resto: sem saber qual rastreador está em
 * qual veículo, posição e vídeo não têm a quem pertencer. Existia no backend em
 * dois endpoints e nenhuma tela mostrava.
 *
 * A tela é organizada por veículo, não por equipamento, porque a pergunta que o
 * técnico faz é "este carro tem rastreador?" — e não "onde está este
 * rastreador?". A busca resolve o segundo caso.
 */

/**
 * Vínculo veículo ↔ equipamento.
 *
 * Os nomes seguem o backend: o veículo é `tracked_unit_id`, não `unit_id`, e o
 * serial do equipamento **não vem** nesta listagem — só em
 * `/device-associations/{id}`, que traz `device_identifier`. Buscar o detalhe
 * de cada vínculo daria centenas de requisições para montar uma tela, então o
 * identificador fica de fora e o que se mostra é o vínculo em si.
 */
type Vinculo = {
  id: number;
  tracked_unit_id: number;
  device_id?: number | null;
  association_date?: string | null;
  release_date?: string | null;
  status?: number | null;
  device_primary?: boolean | null;
};

const dataBR = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export default function Equipamentos() {
  const veiculosQ = useQuery(veiculosApiQuery(1, 300));
  const rastQ = useQuery(vinculosRastreadorQuery());
  const camQ = useQuery(vinculosCameraQuery());

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "sem_rastreador" | "sem_camera" | "completo">("todos");

  // Os endpoints de vínculo devolvem lista direta, sem envelope de paginação —
  // ao contrário de veículos e motoristas, que usam cursor com `data`. Ler
  // `.items` aqui trazia sempre vazio, sem erro nenhum aparecer.
  const rastreadores = (Array.isArray(rastQ.data) ? rastQ.data : []) as Vinculo[];
  const cameras = (Array.isArray(camQ.data) ? camQ.data : []) as Vinculo[];

  /**
   * Só vínculos ativos entram na conta. Um veículo pode ter histórico de
   * equipamentos trocados, e contar os liberados faria parecer que tem três
   * rastreadores instalados.
   */
  const ativos = (lista: Vinculo[]) => lista.filter((v) => !v.release_date && v.status !== 0);

  const linhas = useMemo(() => {
    const rast = new Map(ativos(rastreadores).map((v) => [v.tracked_unit_id, v]));
    const cam = new Map(ativos(cameras).map((v) => [v.tracked_unit_id, v]));
    const t = busca.trim().toLowerCase();

    return (veiculosQ.data?.items ?? [])
      .map((v) => {
        const r = rast.get(Number(v.id));
        const c = cam.get(Number(v.id));
        return {
          id: v.id,
          prefixo: v.prefixo ?? v.placa,
          placa: v.placa,
          rastreador: r,
          camera: c,
          completo: Boolean(r && c),
        };
      })
      .filter((l) => {
        if (filtro === "sem_rastreador" && l.rastreador) return false;
        if (filtro === "sem_camera" && l.camera) return false;
        if (filtro === "completo" && !l.completo) return false;
        if (!t) return true;
        return (
          l.prefixo.toLowerCase().includes(t) ||
          l.placa.toLowerCase().includes(t) ||
          String(l.rastreador?.device_id ?? "").includes(t) ||
          String(l.camera?.device_id ?? "").includes(t)
        );
      });
  }, [veiculosQ.data, rastreadores, cameras, busca, filtro]);

  const semRastreador = linhas.filter((l) => !l.rastreador).length;
  const semCamera = linhas.filter((l) => !l.camera).length;

  const COLS: Column<(typeof linhas)[number] & Record<string, unknown>>[] = [
    {
      key: "prefixo",
      header: "Veículo",
      render: (l) => (
        <div>
          <div className="font-mono text-[13px] font-bold text-foreground">{l.prefixo}</div>
          <div className="font-mono text-[12px] text-muted-foreground">{l.placa}</div>
        </div>
      ),
    },
    {
      key: "rastreador",
      header: "Rastreador",
      render: (l) =>
        l.rastreador ? (
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 shrink-0 text-leaf" />
            <div className="min-w-0">
              <div className="truncate font-mono text-[12px] text-foreground">
                equipamento #{l.rastreador.device_id}
              </div>
              {l.rastreador.device_primary && (
                <div className="text-[12px] text-muted-foreground">principal</div>
              )}
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-coral">
            <Unlink className="h-3.5 w-3.5" />
            sem rastreador
          </span>
        ),
    },
    {
      key: "camera",
      header: "Câmera",
      render: (l) =>
        l.camera ? (
          <div className="flex items-center gap-2">
            <Camera className="h-3.5 w-3.5 shrink-0 text-brand-sky" />
            <span className="truncate font-mono text-[12px] text-foreground">
              equipamento #{l.camera.device_id}
            </span>
          </div>
        ) : (
          <span className="text-[12px] text-muted-foreground">—</span>
        ),
    },
    {
      key: "instalacao",
      header: "Instalado em",
      align: "right",
      render: (l) => (
        <span className="whitespace-nowrap font-mono text-[12px] text-muted-foreground">
          {dataBR(l.rastreador?.association_date)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Situação",
      align: "center",
      render: (l) =>
        l.completo ? (
          <Pill tone="green">completo</Pill>
        ) : l.rastreador ? (
          <Pill tone="sky">só rastreador</Pill>
        ) : (
          <Pill tone="coral">sem equipamento</Pill>
        ),
    },
  ];

  if (usandoMock()) {
    return (
      <>
        <PageHeader title="Equipamentos" subtitle="Cadastros › Vínculos de equipamento" />
        <div className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
            <p className="text-[13px] text-muted-foreground">
              Esta tela lê direto da API — não tem versão de exemplo. Alterne para <strong>API real</strong> em
              Console de gestão › Configurações.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Equipamentos"
        subtitle="Cadastros › Vínculos de equipamento"
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Prefixo, placa ou número do equipamento…"
              className="h-9 w-64 rounded-lg border border-border bg-white pl-8 pr-3 text-[13px] outline-none focus:border-accent"
            />
          </div>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-5 px-6 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Cable} label="Veículos" value={nf(linhas.length)} color="var(--brand-navy)" />
          <StatTile
            icon={Radio}
            label="Sem rastreador"
            value={nf(semRastreador)}
            color={semRastreador ? "var(--coral)" : "var(--leaf)"}
            foot="não transmitem posição"
          />
          <StatTile icon={Video} label="Sem câmera" value={nf(semCamera)} color="var(--gold)" />
          <StatTile
            icon={Link2}
            label="Completos"
            value={nf(linhas.filter((l) => l.completo).length)}
            color="var(--leaf)"
          />
        </div>

        {semRastreador > 0 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-coral-line bg-coral-tint/40 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
            <p className="text-[13px] text-coral">
              <strong>
                {semRastreador} veículo{semRastreador > 1 ? "s" : ""} sem rastreador vinculado.
              </strong>{" "}
              Eles não aparecem no mapa, não geram telemetria e não entram em nenhum indicador — do ponto de vista do
              sistema, é como se não existissem.
            </p>
          </div>
        )}

        <Card
          title="Vínculos"
          icon={Cable}
          action={
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["todos", "Todos"],
                  ["sem_rastreador", "Sem rastreador"],
                  ["sem_camera", "Sem câmera"],
                  ["completo", "Completos"],
                ] as const
              ).map(([v, r]) => (
                <button
                  key={v}
                  onClick={() => setFiltro(v)}
                  className={cn(
                    "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                    filtro === v
                      ? "bg-brand-navy text-white"
                      : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          }
          bodyClassName="p-4"
        >
          {veiculosQ.isPending || rastQ.isPending ? (
            <SkeletonRows rows={8} />
          ) : rastQ.error ? (
            <ErrorBox error={rastQ.error} onRetry={() => rastQ.refetch()} />
          ) : linhas.length === 0 ? (
            <EmptyNote>Nenhum veículo nesse filtro.</EmptyNote>
          ) : (
            <DataTable columns={COLS} rows={linhas as ((typeof linhas)[number] & Record<string, unknown>)[]} />
          )}

          <p className="mt-3 text-[12px] text-muted-foreground">
            Só vínculos ativos aparecem. Um veículo pode ter histórico de equipamentos trocados, e contar os
            liberados faria parecer que tem três rastreadores instalados.
          </p>
        </Card>
      </div>
    </>
  );
}
