import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Bus, Clock, Loader2, MapPin, RefreshCw, Route, Ruler, Users } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, Pill, StatTile } from "@/components/ss/ui/data";
import { api } from "@/lib/api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { cn } from "@/lib/utils";

/**
 * Painel sinótico do urbano com dados reais (ss-fleet-core, endpoints/sinotico.py).
 *
 * Cada sentido da linha é uma régua montada pelo trajeto real de uma viagem
 * completa recente; os ônibus em operação aparecem na posição em que estão e
 * o espaço até o carro da frente vira minutos. Dois carros colados com um
 * buraco atrás é o problema que o painel existe para mostrar.
 */

type Onibus = {
  unit_id: number;
  prefixo: string;
  placa: string;
  viagem: number | null;
  velocidade: number | null;
  ultimo: string | null;
  motorista: string | null;
  m: number | null;
  pct: number | null;
  fora_rota: boolean;
  distancia_rota_m: number | null;
  frente_m?: number | null;
  frente_min?: number | null;
  espacamento?: "colado" | "buraco" | "regular" | null;
};
type Sentido = {
  sentido: number;
  nome: string;
  regua: {
    comprimento_m: number;
    duracao_min: number;
    pontos: { nome: string; m: number }[];
    base: { viagem: number; dia: string; inicio: string; fim: string };
  } | null;
  onibus: Onibus[];
  intervalo_medio_min: number | null;
  maior_buraco_min: number | null;
  colados: number;
  cvh?: number | null;
  nivel_servico?: string | null;
};
type Resposta = { linha: string; sentidos: Sentido[] };
type Linha = { linha: string; agora: number; carros_3h: number };

const COR: Record<string, string> = { regular: "var(--leaf)", colado: "var(--gold)", buraco: "var(--coral)" };
const nf = (v: number | null | undefined, c = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const hora = (s: string | null) => (s ? new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—");

export function useLinhasUrbanas() {
  const g = grupoAtivo();
  return useQuery({
    queryKey: ["sinotico", "linhas", g ?? ""],
    queryFn: () => api.get<Linha[]>(`/api/v1/sinotico/linhas?group_id=${g}`),
    enabled: Boolean(g),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export default function SinoticoUrbano({ linhas }: { linhas: Linha[] }) {
  const g = grupoAtivo();
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const linha = escolhida ?? linhas[0]?.linha ?? "";
  const q = useQuery({
    queryKey: ["sinotico", g ?? "", linha],
    queryFn: () => api.get<Resposta>(`/api/v1/sinotico?group_id=${g}&linha=${linha}`),
    enabled: Boolean(g && linha),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
  const r = q.data;
  const todos = useMemo(() => (r?.sentidos ?? []).flatMap((s) => s.onibus), [r]);
  const gaps = (r?.sentidos ?? []).map((s) => s.intervalo_medio_min).filter((x): x is number => x != null);
  const buracos = (r?.sentidos ?? []).map((s) => s.maior_buraco_min).filter((x): x is number => x != null);

  return (
    <>
      <PageHeader
        title="Painel sinótico"
        subtitle="Operação › Linha esticada com cada ônibus onde ele está"
        actions={
          <button
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-secondary disabled:opacity-60"
          >
            <RefreshCw className={cn("h-[15px] w-[15px]", q.isFetching && "animate-spin")} />
            Atualizar
          </button>
        }
      />
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-8">
        {/* Linhas em operação */}
        <div className="rounded-2xl border border-border bg-card px-4 py-3">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Linhas em operação agora</p>
          <div className="flex flex-wrap gap-1.5">
            {linhas.map((l) => (
              <button
                key={l.linha}
                type="button"
                onClick={() => setEscolhida(l.linha)}
                aria-pressed={linha === l.linha}
                title={`${l.agora} ônibus agora · ${l.carros_3h} nas últimas 3 h`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[13px] font-semibold transition",
                  linha === l.linha ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-white hover:border-brand-sky",
                  l.agora === 0 && linha !== l.linha && "opacity-50",
                )}
              >
                {l.linha}
                <span className={cn("rounded px-1 text-[12px]", linha === l.linha ? "bg-white/20" : "bg-secondary text-muted-foreground")}>{l.agora}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Bus} label="Ônibus na linha" value={nf(todos.length)} color="var(--brand-navy)" foot={`linha ${linha}`} />
          <StatTile icon={Clock} label="Intervalo médio" value={gaps.length ? nf(gaps.reduce((a, b) => a + b, 0) / gaps.length, 0) : "—"} unit={gaps.length ? "min" : undefined} color="var(--leaf)" foot="entre carros seguidos" />
          <StatTile icon={AlertTriangle} label="Maior buraco" value={buracos.length ? nf(Math.max(...buracos), 0) : "—"} unit={buracos.length ? "min" : undefined} color="var(--coral)" foot="maior espaço sem ônibus" />
          <StatTile icon={Users} label="Carros colados" value={nf((r?.sentidos ?? []).reduce((a, s) => a + s.colados, 0))} color="var(--gold)" foot="andando junto do da frente" />
        </div>

        {q.isLoading ? (
          <p className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-8 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Montando a linha {linha}… na primeira vez leva alguns segundos.
          </p>
        ) : q.isError ? (
          <p className="rounded-2xl border border-coral-line bg-coral-tint px-5 py-4 text-[13px]">Não foi possível carregar a linha agora. Tente atualizar.</p>
        ) : (
          (r?.sentidos ?? []).map((s) => <Regua key={s.sentido} s={s} />)
        )}

        <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR.regular }} /> espaçamento regular</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR.colado }} /> colado (menos da metade do intervalo)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COR.buraco }} /> buraco (mais de 1,5× o intervalo)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" /> primeiro da fila</span>
          <span>Critério do manual TCQSM (TCRP 165). Atualiza a cada 30 s.</span>
        </div>
      </div>
    </>
  );
}

function Regua({ s }: { s: Sentido }) {
  const rg = s.regua;
  const naRota = s.onibus.filter((o) => !o.fora_rota && o.pct != null);
  const fora = s.onibus.filter((o) => o.fora_rota);
  return (
    <Card
      title={`${s.nome}${rg ? ` · ${nf(rg.comprimento_m / 1000, 1)} km · ~${rg.duracao_min} min` : ""}`}
      icon={Route}
      action={
        <div className="flex items-center gap-2">
          <Pill tone="sky">{naRota.length} na rota</Pill>
          {s.intervalo_medio_min != null && <Pill tone="green">intervalo ~{nf(s.intervalo_medio_min)} min</Pill>}
          {s.nivel_servico && (
            <Pill tone={"ABC".includes(s.nivel_servico) ? "green" : s.nivel_servico === "D" ? "gold" : "coral"}>
              regularidade {s.nivel_servico}
            </Pill>
          )}
        </div>
      }
      bodyClassName="p-5"
    >
      {!rg ? (
        <p className="text-[13px] text-muted-foreground">
          Ainda não há uma viagem completa deste sentido hoje ou ontem para desenhar a linha.
          {s.onibus.length ? ` ${s.onibus.length} ônibus estão nele agora.` : ""}
        </p>
      ) : (
        <>
          <div className="relative overflow-x-auto pb-2">
            <div className="relative mx-3 min-w-[960px]" style={{ height: 164 }}>
              {/* Pontos de referência: nome em até 3 alturas; sem espaço, só a marca (nome no mouse). */}
              {(() => {
                const ultimoPorAltura = [-100, -100, -100];
                return rg.pontos.map((p) => {
                  const pct = (100 * p.m) / rg.comprimento_m;
                  const altura = ultimoPorAltura.findIndex((u) => pct - u >= 13);
                  if (altura >= 0) ultimoPorAltura[altura] = pct;
                  return (
                    <div key={p.nome} className="group absolute top-0" style={{ left: `${pct}%` }} title={p.nome}>
                      {altura >= 0 && (
                        <span
                          className={cn(
                            "absolute whitespace-nowrap text-[12px] text-muted-foreground",
                            // Perto das pontas o nome se alinha para dentro, para não sair da régua.
                            pct < 8 ? "translate-x-0" : pct > 92 ? "-translate-x-full" : "-translate-x-1/2",
                          )}
                          style={{ top: altura * 14, maxWidth: 118, overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          {p.nome}
                        </span>
                      )}
                      <span
                        className="absolute -translate-x-1/2 border-l border-dashed border-border group-hover:border-brand-navy"
                        style={{ top: altura >= 0 ? altura * 14 + 14 : 40, height: altura >= 0 ? 86 - (altura * 14 + 14) : 46 }}
                      />
                    </div>
                  );
                });
              })()}
              {/* Linha */}
              <div className="absolute left-0 right-0 h-2 rounded-full bg-brand-navy/15" style={{ top: 86 }} />
              <span className="absolute text-[12px] font-semibold text-muted-foreground" style={{ left: 0, top: 100 }}>início</span>
              <span className="absolute -translate-x-full text-[12px] font-semibold text-muted-foreground" style={{ left: "100%", top: 100 }}>fim</span>
              {/* Ônibus */}
              {naRota.map((o) => {
                const cor = o.espacamento ? COR[o.espacamento] : "var(--muted-foreground)";
                return (
                  <div key={o.unit_id} className="group absolute" style={{ left: `${o.pct}%`, top: 70 }}>
                    <div
                      className="flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border-[2.5px] border-white text-white shadow-md"
                      style={{ background: cor }}
                    >
                      <Bus className="h-[18px] w-[18px]" strokeWidth={2.2} />
                    </div>
                    <span className="absolute left-0 top-10 -translate-x-1/2 whitespace-nowrap rounded bg-white px-1.5 font-mono text-[12px] font-bold shadow-sm">
                      {o.prefixo}
                    </span>
                    {o.frente_min != null && (
                      <span className="absolute left-0 top-[60px] -translate-x-1/2 whitespace-nowrap text-[12px]" style={{ color: cor }}>
                        <ArrowRight className="mr-0.5 inline h-3 w-3" />
                        {nf(o.frente_min)} min
                      </span>
                    )}
                    {/* Detalhe ao passar o mouse */}
                    <div className="pointer-events-none absolute bottom-11 left-0 z-10 hidden w-56 -translate-x-1/2 rounded-xl border border-border bg-white p-3 text-[12px] shadow-elegant group-hover:block">
                      <p className="font-semibold">{o.prefixo} <span className="font-normal text-muted-foreground">· {o.placa}</span></p>
                      <p>Viagem {o.viagem ?? "—"} · {nf(o.velocidade)} km/h</p>
                      <p>{nf((o.m ?? 0) / 1000, 1)} km do início</p>
                      {o.frente_min != null && <p>Próximo à frente: {nf(o.frente_min)} min ({nf((o.frente_m ?? 0) / 1000, 1)} km)</p>}
                      {o.motorista && <p className="text-muted-foreground">{o.motorista}</p>}
                      <p className="text-muted-foreground">posição às {hora(o.ultimo)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {fora.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Fora do trajeto de referência:
              {fora.map((o) => (
                <Pill key={o.unit_id} tone="neutral">
                  {o.prefixo}
                  {o.distancia_rota_m != null ? ` · ${nf(o.distancia_rota_m / 1000, 1)} km` : ""}
                </Pill>
              ))}
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Ruler className="h-3.5 w-3.5" /> Linha desenhada pelo trajeto real da viagem {rg.base.viagem} de{" "}
            {rg.base.dia.split("-").reverse().join("/")}, das {rg.base.inicio} às {rg.base.fim}.
          </p>
        </>
      )}
    </Card>
  );
}
