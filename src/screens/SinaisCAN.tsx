import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Battery,
  Database,
  Droplets,
  Gauge,
  Info,
  Loader2,
  Thermometer,
  Timer,
  Wind,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { useRelatorioCursor, type HistoricoDetalhadoApi } from "@/lib/relatorios-api";
import { veiculosApiQuery, nf } from "@/lib/queries";
import { usandoMock } from "@/lib/modo";
import { cn } from "@/lib/utils";

/** Leitura com o motor funcionando (girando ou andando). O resto é o sinal periódico do veículo parado. */
const motorLigado = (r: HistoricoDetalhadoApi) => (r.can_rpm ?? 0) > 0 || (r.speed ?? 0) > 0 || (r.can_speed ?? 0) > 0;
/** Marchas reais vão de ré (-5) a 20; códigos acima disso (ex.: 130) são "sem informação" do equipamento. */
const marchaValida = (g?: number | null) => g != null && g >= -5 && g <= 20;

/**
 * Sinais do barramento CAN.
 *
 * O endpoint `/reports/history/detailed` devolve 22 leituras por posição e
 * nenhuma tela consumia. São os sinais que respondem perguntas hoje sem
 * resposta: quanto ARLA resta, qual a pressão pneumática, quantas horas o motor
 * acumulou, qual marcha estava engatada.
 *
 * A leitura é por veículo e período curto de propósito: cada posição gera uma
 * linha, e um dia de operação passa de dez mil registros.
 */

const hoje = () => new Date().toISOString().slice(0, 10);

/** Limites que definem alerta. Vêm da prática de manutenção pesada. */
const LIMITES = {
  arlaBaixo: 15,
  combustivelBaixo: 15,
  tempAlta: 100,
  pressaoPneumaticaBaixa: 6,
  /** Carregando: acima disso com o motor ligado (sistemas de 12 V e 24 V). */
  carga12: 13,
  carga24: 26,
};

/**
 * Códigos de "sem informação" que o equipamento grava no lugar do valor
 * (conferido no TDP-2E24 da CECOTI, 05/10/2026): ARLA/combustível acima de
 * 100%, horímetro 4294967293 (0xFFFFFFFD). Sinal que vem 0 em todas as
 * leituras do dia é sensor ausente (ex.: VW Express 4x2 tem freio hidráulico,
 * sem circuito de ar; nível de combustível não vem pelo CAN) — não é alerta.
 */
const HORIMETRO_INVALIDO = 4_000_000_000;
type Situacao = "ok" | "sem_sensor" | "sem_dado";
function lerSinal(regs: HistoricoDetalhadoApi[], campo: keyof HistoricoDetalhadoApi, valido: (v: number) => boolean) {
  const vals = regs.map((r) => r[campo]).filter((v): v is number => typeof v === "number");
  if (!vals.length) return { valor: null as number | null, situacao: "sem_dado" as Situacao };
  if (vals.every((v) => v === 0)) return { valor: null, situacao: "sem_sensor" as Situacao };
  const bons = vals.filter(valido);
  // Maioria das leituras com código de "sem informação": a exceção não é estado
  // (TDP-2E24: ARLA 102% quase o dia todo e um 5% solto).
  if (bons.length < vals.length / 2) return { valor: null, situacao: "sem_dado" as Situacao };
  // `regs` vem do mais antigo para o mais novo: o último válido é o estado atual.
  return bons.length ?{ valor: bons[bons.length - 1], situacao: "ok" as Situacao } : { valor: null, situacao: "sem_dado" as Situacao };
}
const textoSituacao = (s: Situacao) => (s === "sem_sensor" ? "sem sensor" : "sem leitura válida");

/** Sobe para o primeiro nível os campos dos objetos aninhados (um nível). */
function achatar(r: unknown): Record<string, unknown> {
  const fora: Record<string, unknown> = {};
  for (const [k, v] of Object.entries((r ?? {}) as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) if (!(k2 in fora)) fora[k2] = v2;
    } else {
      fora[k] = v;
    }
  }
  return fora;
}

export default function SinaisCAN() {
  const veiculosQ = useQuery(veiculosApiQuery(1, 200));
  const qs = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const [veiculoId, setVeiculoId] = useState(qs.get("veiculo") ?? "");
  const [data, setData] = useState(/^\d{4}-\d{2}-\d{2}$/.test(qs.get("dia") ?? "") ? qs.get("dia")! : hoje());

  const filtro = useMemo(
    () => ({
      inicio: `${data} 00:00:00`,
      fim: `${data} 23:59:59`,
      veiculos: veiculoId ? [veiculoId] : undefined,
      limite: 500,
    }),
    [data, veiculoId],
  );

  const q = useRelatorioCursor<HistoricoDetalhadoApi>("history/detailed", filtro, Boolean(veiculoId));
  // O backend agrupa os sinais (`fuel.can_fuel_level_percent`,
  // `temperature.can_engine_coolant_temp`, `electrical_data.…`); a tela lê os
  // campos soltos. Sem abrir os grupos, todo sinal chegava vazio — o banco
  // tem as leituras (898 de 898 posições de um veículo num dia).
  const registros = useMemo(() => q.registros.map(achatar) as HistoricoDetalhadoApi[], [q.registros]);

  // Parado e desligado, o equipamento manda um sinal de "estou vivo" a cada
  // ~2 h repetindo os últimos valores do CAN (velocidade 0, RPM 0, a última
  // temperatura). Não é leitura do motor: fica escondido por padrão.
  const [verParado, setVerParado] = useState(false);
  const ligados = useMemo(() => registros.filter(motorLigado), [registros]);
  const parados = registros.length - ligados.length;
  const visiveis = verParado ? registros : ligados;

  /**
   * Estado atual = a leitura MAIS NOVA válida de cada sinal com o motor ligado.
   * A lista vem do mais novo para o mais antigo; antes o laço guardava o
   * último visto e os cartões mostravam a leitura mais ANTIGA do dia (20 °C da
   * partida a frio no TDP-2E24, com o motor a 86 °C).
   */
  const atual = useMemo(() => {
    const base = [...(ligados.length ? ligados : registros)].sort((a, b) => String(a.local_time ?? "").localeCompare(String(b.local_time ?? "")));
    const pct = (v: number) => v >= 0 && v <= 100;
    const horas = (v: number) => v > 0 && v < HORIMETRO_INVALIDO;
    const hCan = lerSinal(base, "can_engine_hourmeter", horas);
    const hEq = lerSinal(base, "hourmeter" as keyof HistoricoDetalhadoApi, horas);
    const minutos = hCan.valor ?? hEq.valor;
    return {
      arla: lerSinal(base, "can_def_level_percent", pct),
      combustivel: lerSinal(base, "can_fuel_level_percent", pct),
      temp: lerSinal(base, "can_engine_coolant_temp", (v) => v > -40 && v < 150),
      // Horímetro do equipamento vem em MINUTOS (decisão do PM, 02/10/2026).
      horimetroH: minutos != null ? minutos / 60 : null,
      pneu1: lerSinal(base, "can_pneumatic_system1_pressure", (v) => v >= 0 && v < 20),
      pneu2: lerSinal(base, "can_pneumatic_system2_pressure", (v) => v >= 0 && v < 20),
      tensao: lerSinal(base, "can_control_module_voltage", (v) => v >= 5 && v < 40),
      ligado: ligados.length > 0,
    };
  }, [ligados, registros]);

  const alertas = useMemo(() => {
    const lista: string[] = [];
    const { arla, combustivel, temp, pneu1, tensao } = atual;
    if (arla.valor != null && arla.valor < LIMITES.arlaBaixo)
      lista.push(`ARLA em ${arla.valor}% — motor entra em derate quando acaba`);
    if (combustivel.valor != null && combustivel.valor < LIMITES.combustivelBaixo)
      lista.push(`Combustível em ${combustivel.valor}%`);
    if (temp.valor != null && temp.valor > LIMITES.tempAlta)
      lista.push(`Temperatura do líquido em ${temp.valor}°C`);
    if (pneu1.valor != null && pneu1.valor < LIMITES.pressaoPneumaticaBaixa)
      lista.push(`Pressão pneumática do circuito 1 baixa — afeta o freio`);
    // Alternador só se avalia com o motor ligado: parado, 12,3 V num sistema de 12 V é normal.
    if (atual.ligado && tensao.valor != null) {
      const carga = tensao.valor > 18 ? LIMITES.carga24 : LIMITES.carga12;
      if (tensao.valor < carga) lista.push(`Tensão em ${tensao.valor} V com o motor ligado — o alternador deveria passar de ${carga} V`);
    }
    return lista;
  }, [atual]);

  const COLS: Column<HistoricoDetalhadoApi & Record<string, unknown>>[] = [
    {
      key: "local_time",
      header: "Hora",
      render: (r) => (
        <span className="whitespace-nowrap font-mono text-[12px]">{r.local_time?.slice(11, 19)}</span>
      ),
    },
    { key: "speed", header: "Velocidade", align: "right", render: (r) => <span className="font-mono text-[13px]">{r.speed ?? "—"}</span> },
    { key: "can_rpm", header: "RPM", align: "right", render: (r) => <span className="font-mono text-[13px]">{r.can_rpm ?? "—"}</span> },
    { key: "can_gear", header: "Marcha", align: "center", render: (r) => (
      <span className="font-mono text-[13px]" title={marchaValida(r.can_gear) ? undefined : r.can_gear != null ? `Código ${r.can_gear}: o equipamento não informou a marcha` : undefined}>
        {marchaValida(r.can_gear) ? r.can_gear : "—"}
      </span>
    ) },
    {
      key: "can_accel_pedal_percent",
      header: "Acelerador",
      align: "right",
      render: (r) => <span className="font-mono text-[13px]">{r.can_accel_pedal_percent != null ? `${r.can_accel_pedal_percent}%` : "—"}</span>,
    },
    {
      key: "can_engine_torque_percent",
      header: "Torque",
      align: "right",
      render: (r) => <span className="font-mono text-[13px]">{r.can_engine_torque_percent != null ? `${r.can_engine_torque_percent}%` : "—"}</span>,
    },
    {
      key: "can_engine_coolant_temp",
      header: "Temp. líquido",
      align: "right",
      render: (r) => (
        <span className={cn("font-mono text-[13px]", (r.can_engine_coolant_temp ?? 0) > LIMITES.tempAlta ? "font-semibold text-coral" : "")}>
          {r.can_engine_coolant_temp != null ? `${r.can_engine_coolant_temp}°` : "—"}
        </span>
      ),
    },
    {
      key: "can_turbo_charger_pressure",
      header: "Turbo",
      align: "right",
      render: (r) => <span className="font-mono text-[13px]">{r.can_turbo_charger_pressure ?? "—"}</span>,
    },
    {
      key: "can_engine_oil_pressure",
      header: "Óleo",
      align: "right",
      render: (r) => <span className="font-mono text-[13px]">{r.can_engine_oil_pressure ?? "—"}</span>,
    },
    {
      key: "estados",
      header: "Estados",
      render: (r) => {
        // Os estados chegam como 0/1. Com `0 && <Pill />` o React imprime o
        // zero — a coluna mostrava "0000" e "0 freio 00".
        const ligado = (x: unknown) => Number(x) > 0 || x === true;
        const pills = [
          ligado(r.can_cruise_control_state) && <Pill key="p" tone="sky">piloto</Pill>,
          ligado(r.can_break_pedal_state) && <Pill key="f" tone="gold">freio</Pill>,
          ligado(r.can_parking_brake_state) && <Pill key="e" tone="neutral">estacion.</Pill>,
          ligado(r.can_retarder_in_use) && <Pill key="r" tone="green">retarder</Pill>,
        ].filter(Boolean);
        return pills.length ? <span className="flex flex-wrap gap-1">{pills}</span> : <span className="text-muted-foreground">—</span>;
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="Sinais do motor"
        subtitle="Frota › Leituras do barramento CAN"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={veiculoId}
              onChange={(e) => setVeiculoId(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
            >
              <option value="">Selecione o veículo…</option>
              {(veiculosQ.data?.items ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.prefixo ?? v.placa}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-2.5 text-[13px] outline-none focus:border-accent"
            />
          </div>
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        {usandoMock() ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
            <p className="text-[13px] text-muted-foreground">
              Esta tela lê direto do barramento CAN — não tem versão de exemplo. Alterne para{" "}
              <strong>API real</strong> em Console de gestão › Configurações.
            </p>
          </div>
        ) : !veiculoId ? (
          <Card title="Sinais do motor" icon={Activity} bodyClassName="p-4">
            <EmptyNote>Escolha um veículo para ler os sinais do barramento.</EmptyNote>
          </Card>
        ) : (
          <>
            {/* Estado atual, a partir da última leitura de cada sinal. */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile
                icon={Droplets}
                label="ARLA"
                value={atual.arla.valor != null ? `${atual.arla.valor}%` : "—"}
                color={atual.arla.valor != null && atual.arla.valor < LIMITES.arlaBaixo ? "var(--coral)" : "var(--leaf)"}
                foot={atual.arla.valor != null ? "derate quando acaba" : textoSituacao(atual.arla.situacao)}
              />
              <StatTile
                icon={Gauge}
                label="Combustível"
                value={atual.combustivel.valor != null ? `${atual.combustivel.valor}%` : "—"}
                color={atual.combustivel.valor != null && atual.combustivel.valor < LIMITES.combustivelBaixo ? "var(--coral)" : "var(--brand-navy)"}
                foot={atual.combustivel.valor != null ? "nível do tanque" : textoSituacao(atual.combustivel.situacao)}
              />
              <StatTile
                icon={Timer}
                label="Horímetro"
                value={atual.horimetroH != null ? nf(Math.round(atual.horimetroH)) : "—"}
                unit="h"
                color="var(--brand-sky)"
                foot={atual.horimetroH != null ? "horas de motor · gatilho da preventiva" : "sem leitura válida"}
              />
              <StatTile
                icon={Thermometer}
                label="Temp. líquido"
                value={atual.temp.valor != null ? `${atual.temp.valor}°` : "—"}
                color={atual.temp.valor != null && atual.temp.valor > LIMITES.tempAlta ? "var(--coral)" : "var(--leaf)"}
                foot={atual.temp.valor != null ? "leitura mais recente" : textoSituacao(atual.temp.situacao)}
              />
              <StatTile
                icon={Battery}
                label="Voltagem"
                value={atual.tensao.valor != null ? `${atual.tensao.valor} V` : "—"}
                color={alertas.some((a) => a.startsWith("Tensão")) ? "var(--coral)" : "var(--leaf)"}
                foot={atual.tensao.valor != null ? (atual.tensao.valor > 18 ? "sistema de 24 V" : "sistema de 12 V") + (atual.ligado ? " · motor ligado" : "") : textoSituacao(atual.tensao.situacao)}
              />
            </div>

            {alertas.length > 0 && (
              <div className="rounded-xl border border-coral-line bg-coral-tint/40 px-4 py-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-coral">
                  <AlertTriangle className="h-4 w-4" />
                  {alertas.length} sinal{alertas.length > 1 ? "is" : ""} fora do esperado
                </p>
                <ul className="space-y-0.5">
                  {alertas.map((a, i) => (
                    <li key={i} className="text-[13px] text-coral">
                      · {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Pressão pneumática, que só faz sentido em par. */}
            <Card title="Sistema pneumático" icon={Wind} bodyClassName="p-4">
              <div className="grid grid-cols-2 gap-4">
                {[1, 2].map((n) => {
                  const s = n === 1 ? atual.pneu1 : atual.pneu2;
                  const v = s.valor;
                  const baixa = v != null && v < LIMITES.pressaoPneumaticaBaixa;
                  return (
                    <div key={n} className="rounded-xl border border-border p-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[13px] text-muted-foreground">Circuito {n}</span>
                        <span className={cn("font-mono text-[16px] font-bold", baixa ? "text-coral" : "text-foreground")}>
                          {v != null ? `${v} bar` : textoSituacao(s.situacao)}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn("h-2 rounded-full", baixa ? "bg-coral" : "bg-leaf")}
                          style={{ width: `${Math.min(100, ((v ?? 0) / 10) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-[12px] text-muted-foreground">
                {atual.pneu1.situacao === "sem_sensor" && atual.pneu2.situacao === "sem_sensor" && "Este veículo não envia pressão de ar (freio hidráulico ou sensor ausente). "}
                Os dois circuitos são independentes por segurança: se um falha, o outro mantém o freio. Queda em
                apenas um indica vazamento localizado; nos dois, problema no compressor.
              </p>
            </Card>

            <Card
              title="Leituras do período"
              icon={Activity}
              action={
                <div className="flex items-center gap-2">
                  {parados > 0 && (
                    <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground">
                      <input type="checkbox" checked={verParado} onChange={(e) => setVerParado(e.target.checked)} />
                      Mostrar sinais com o veículo desligado ({nf(parados)})
                    </label>
                  )}
                  <Pill tone="sky">{nf(ligados.length)} com motor ligado</Pill>
                </div>
              }
              bodyClassName="p-4"
            >
              {q.isPending ? (
                <SkeletonRows rows={8} />
              ) : q.error ? (
                <ErrorBox error={q.error} onRetry={() => q.refetch()} />
              ) : registros.length === 0 ? (
                <EmptyNote>Nenhuma leitura neste dia.</EmptyNote>
              ) : visiveis.length === 0 ? (
                <EmptyNote>
                  O veículo ficou desligado neste período. Só chegaram os sinais de "estou vivo" que o equipamento manda a cada 2 horas, com os
                  últimos valores de antes de desligar ({nf(parados)}). Marque "Mostrar sinais com o veículo desligado" para vê-los.
                </EmptyNote>
              ) : (
                <>
                  <DataTable columns={COLS} rows={visiveis as (HistoricoDetalhadoApi & Record<string, unknown>)[]} />
                  {q.hasNextPage && (
                    <div className="mt-3 flex justify-center">
                      <button
                        onClick={() => q.fetchNextPage()}
                        disabled={q.isFetchingNextPage}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-2 text-[13px] font-medium text-brand-navy hover:bg-secondary disabled:opacity-60"
                      >
                        {q.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Carregar mais
                      </button>
                    </div>
                  )}
                </>
              )}

              <p className="mt-3 flex items-start gap-1.5 text-[12px] text-muted-foreground">
                <Info className="mt-0.5 h-3 w-3 shrink-0" />
                São 22 sinais por posição, lidos do barramento CAN. Nem todo veículo publica todos — depende da
                geração do motor e do que o fabricante expõe. Campo vazio significa sinal ausente, não valor zero.
              </p>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
