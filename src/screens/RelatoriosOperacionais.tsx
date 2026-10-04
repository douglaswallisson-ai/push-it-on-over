import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Flame, Fuel, Gauge, History, Info, Loader2, Target, TrendingUp, Truck, User } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import {
  baixarCsv,
  useRelatorioCursor,
  type PosicaoHistoricoApi,
  type FaixaRpmApi,
  type MetaPesoApi,
  type MotoristaKmApi,
  type PontoCalorApi,
} from "@/lib/relatorios-api";
import { MatrizCalor } from "@/screens/gerencial/pecas";
import { usandoMock } from "@/lib/modo";
import { nf, veiculosApiQuery } from "@/lib/queries";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { cn } from "@/lib/utils";

/**
 * Relatórios operacionais.
 *
 * Reúne quatro relatórios que existiam no backend e nenhuma tela consumia:
 * consumo por motorista, faixa de RPM, mapa de calor e metas e pesos.
 *
 * Ficam juntos numa tela com abas porque compartilham o mesmo filtro de
 * período e são consultados na mesma sessão de trabalho — separá-los em quatro
 * telas obrigaria a repetir a seleção de datas em cada uma.
 */

export type AbaOperacional = "motoristas" | "rpm" | "calor" | "metas" | "historico";
type Aba = AbaOperacional;

const ABAS: { id: Aba; rotulo: string; icone: typeof User; relatorio: Parameters<typeof useRelatorioCursor>[0] }[] = [
  { id: "motoristas", rotulo: "Consumo por motorista", icone: User, relatorio: "driver-km-fuel-hours" },
  { id: "rpm", rotulo: "Faixas de RPM", icone: Gauge, relatorio: "rpm-band-time" },
  { id: "calor", rotulo: "Mapa de calor", icone: Flame, relatorio: "heatmap" },
  { id: "metas", rotulo: "Metas e pesos", icone: Target, relatorio: "weight-range" },
  { id: "historico", rotulo: "Histórico de posições", icone: History, relatorio: "history/detailed" },
];

const hhmm = (s?: number | null) => (s == null ? "—" : `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`);

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function janelaPadrao(dias = 30) {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - (dias - 1) * 86_400_000);
  return { i: isoLocal(inicio), f: isoLocal(fim) };
}

/**
 * Veículos da empresa ativa. Os relatórios por cursor só filtram por lista de
 * veículos: sem mandar a lista, a consulta trazia todas as empresas do acesso,
 * qualquer que fosse a escolhida no seletor.
 */
export function useVeiculosDoRelatorio(placa: string) {
  const q = useQuery(veiculosApiQuery());
  const empresa = grupoAtivo();
  const lista = q.data?.items ?? [];
  const ids = placa ? [placa] : empresa ? lista.map((v) => v.id) : undefined;
  // Com empresa escolhida, espera a lista para não consultar tudo antes.
  const pronto = Boolean(placa) || !empresa || q.isSuccess;
  return { lista, ids, pronto, carregando: q.isPending && Boolean(empresa) };
}

export default function RelatoriosOperacionais({ abaInicial = "motoristas", onVoltar }: { abaInicial?: Aba; onVoltar?: () => void } = {}) {
  const [aba, setAbaBruta] = useState<Aba>(abaInicial);
  const p = janelaPadrao(abaInicial === "historico" ? 1 : 30);
  const [inicio, setInicio] = useState(p.i);
  const [fim, setFim] = useState(p.f);
  const [placa, setPlaca] = useState("");
  const [baixando, setBaixando] = useState(false);
  const setAba = (a: Aba) => {
    setAbaBruta(a);
    // O histórico é posição a posição: um dia já são milhares de linhas.
    if (a === "historico") {
      const j = janelaPadrao(1);
      setInicio(j.i);
      setFim(j.f);
    }
  };
  const veic = useVeiculosDoRelatorio(placa);

  const atual = ABAS.find((a) => a.id === aba)!;
  const exigePlaca = aba === "historico";
  const filtro = useMemo(
    () => ({
      inicio: `${inicio} 00:00:00`,
      fim: `${fim} 23:59:59`,
      // O mapa de calor só faz sentido com o período inteiro: páginas maiores.
      limite: aba === "calor" ? 5000 : 500,
      // Metas e pesos é por grupo, não por veículo.
      veiculos: aba === "metas" ? undefined : veic.ids,
    }),
    [inicio, fim, aba, veic.ids],
  );
  const q = useRelatorioCursor<Record<string, unknown>>(atual.relatorio, filtro, veic.pronto && (!exigePlaca || Boolean(placa)));
  // Mapa de calor: busca as páginas seguintes sozinho, até o teto.
  const TETO_CALOR = 50_000;
  useEffect(() => {
    if (aba === "calor" && q.hasNextPage && !q.isFetchingNextPage && q.registros.length < TETO_CALOR) q.fetchNextPage();
  }, [aba, q.hasNextPage, q.isFetchingNextPage, q.registros.length]);
  const empresa = grupoAtivo();
  const registros = aba === "metas" && empresa ? q.registros.filter((r) => String(r.group_id) === empresa) : q.registros;

  const baixar = async () => {
    setBaixando(true);
    try {
      await baixarCsv(atual.relatorio, filtro, atual.rotulo.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
      toast.success("CSV baixado.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBaixando(false);
    }
  };

  return (
    <>
      <PageHeader
        title={onVoltar ? atual.rotulo : "Relatórios operacionais"}
        subtitle="Relatórios › Consumo, condução e cobertura"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {onVoltar && (
              <button onClick={onVoltar} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[13px] text-brand-navy hover:bg-secondary">
                <ArrowLeft className="h-4 w-4" /> Relatórios
              </button>
            )}
            <label className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-2.5">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <select value={placa} onChange={(e) => setPlaca(e.target.value)} aria-label="Placa" className="max-w-[170px] bg-transparent text-[13px] outline-none">
                <option value="">{exigePlaca ? "Escolha a placa" : "Todas as placas"}</option>
                {[...veic.lista].sort((a, b) => a.placa.localeCompare(b.placa)).map((v) => (
                  <option key={v.id} value={v.id}>{v.placa}{v.prefixo ? ` · ${v.prefixo}` : ""}</option>
                ))}
              </select>
            </label>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-2.5 text-[13px] outline-none focus:border-accent"
            />
            <span className="text-[12px] text-muted-foreground">até</span>
            <input
              type="date"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-2.5 text-[13px] outline-none focus:border-accent"
            />
            <button
              onClick={baixar}
              disabled={usandoMock() || baixando || (exigePlaca && !placa)}
              title="Exporta o período escolhido (até 31 dias)"
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {baixando ? <Loader2 className="h-[15px] w-[15px] animate-spin" /> : <Download className="h-[15px] w-[15px]" />}
              CSV
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        <div className="flex flex-wrap gap-1.5">
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                aba === a.id
                  ? "bg-brand-navy text-white"
                  : "border border-border bg-white text-muted-foreground hover:bg-secondary",
              )}
            >
              <a.icone className="h-3.5 w-3.5" />
              {a.rotulo}
            </button>
          ))}
        </div>

        {usandoMock() ? (
          <Card title={atual.rotulo} icon={atual.icone} bodyClassName="p-4">
            <EmptyNote>
              Estes relatórios leem direto da API. Alterne para modo real em Console de gestão › Configurações.
            </EmptyNote>
          </Card>
        ) : exigePlaca && !placa ? (
          <Card title={atual.rotulo} icon={atual.icone} bodyClassName="p-4">
            <EmptyNote>Escolha a placa no alto da tela. O histórico é posição a posição — um dia de um veículo já passa de mil linhas.</EmptyNote>
          </Card>
        ) : q.erroJanela ? (
          <Card title={atual.rotulo} icon={atual.icone} bodyClassName="p-4">
            <EmptyNote>{q.erroJanela}</EmptyNote>
          </Card>
        ) : (
          <Card
            title={atual.rotulo}
            icon={atual.icone}
            action={<Pill tone="sky">{nf(registros.length)} registros{q.hasNextPage && aba !== "metas" ? "+" : ""}</Pill>}
            bodyClassName="p-4"
          >
            {q.isPending || veic.carregando ? (
              <SkeletonRows rows={8} />
            ) : q.error ? (
              <ErrorBox error={q.error} onRetry={() => q.refetch()} />
            ) : registros.length === 0 ? (
              <EmptyNote>Nenhum dado no período.</EmptyNote>
            ) : (
              <>
                {aba === "motoristas" && <TabelaMotoristas dados={registros as unknown as MotoristaKmApi[]} />}
                {aba === "rpm" && <TabelaRpm dados={registros as unknown as FaixaRpmApi[]} />}
                {aba === "calor" && <MapaCalor dados={registros as unknown as PontoCalorApi[]} />}
                {aba === "metas" && <TabelaMetas dados={registros as unknown as MetaPesoApi[]} />}
                {aba === "historico" && <TabelaHistorico dados={registros as unknown as PosicaoHistoricoApi[]} />}

                {q.hasNextPage && (
                  <div className="mt-3 flex justify-center">
                    <button
                      onClick={() => q.fetchNextPage()}
                      disabled={q.isFetchingNextPage}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-2 text-[13px] font-medium text-brand-navy hover:bg-secondary disabled:opacity-60"
                    >
                      {q.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
                      Carregar mais
                    </button>
                  </div>
                )}
              </>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function TabelaMotoristas({ dados }: { dados: MotoristaKmApi[] }) {
  const totalKm = dados.reduce((a, d) => a + (d.total_km ?? 0), 0);
  const totalL = dados.reduce((a, d) => a + (d.total_fuel ?? 0), 0);

  const COLS: Column<MotoristaKmApi & Record<string, unknown>>[] = [
    { key: "driver_name", header: "Motorista", render: (d) => <span className="text-[13px] font-medium">{d.driver_name ?? `#${d.driver_id}`}</span> },
    { key: "trips", header: "Viagens", align: "right", render: (d) => <span className="font-mono text-[13px]">{nf(d.trips ?? 0)}</span> },
    { key: "total_km", header: "Distância", align: "right", render: (d) => <span className="font-mono text-[13px]">{nf(Math.round(d.total_km ?? 0))} km</span> },
    { key: "total_fuel", header: "Combustível", align: "right", render: (d) => <span className="font-mono text-[13px]">{nf(Math.round(d.total_fuel ?? 0))} L</span> },
    { key: "total_hours", header: "Horas", align: "right", render: (d) => <span className="font-mono text-[13px]">{hhmm((d.total_hours ?? 0) * 3600)}</span> },
    {
      key: "efficiency_kml",
      header: "Consumo",
      align: "right",
      render: (d) => {
        const v = d.efficiency_kml ?? 0;
        const media = totalL ? totalKm / totalL : 0;
        return (
          <span className={cn("font-mono text-[13px] font-semibold", v > media ? "text-leaf" : v ? "text-coral" : "")}>
            {v ? `${v.toFixed(2)} km/l` : "—"}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile icon={User} label="Motoristas" value={nf(dados.length)} color="var(--brand-navy)" />
        <StatTile icon={TrendingUp} label="Distância total" value={nf(Math.round(totalKm))} unit="km" color="var(--brand-sky)" />
        <StatTile
          icon={Fuel}
          label="Consumo médio"
          value={totalL ? (totalKm / totalL).toFixed(2) : "—"}
          unit="km/l"
          color="var(--leaf)"
        />
      </div>
      <DataTable columns={COLS} rows={dados as (MotoristaKmApi & Record<string, unknown>)[]} />
      <p className="mt-3 text-[12px] text-muted-foreground">
        O consumo é comparado com a média do período, não com uma meta fixa. Meta única para frota inteira ignora que
        um carro urbano e um rodoviário nunca terão o mesmo número.
      </p>
    </>
  );
}

function TabelaRpm({ dados }: { dados: FaixaRpmApi[] }) {
  const COLS: Column<FaixaRpmApi & Record<string, unknown>>[] = [
    { key: "unit_label", header: "Veículo", render: (d) => <span className="font-mono text-[13px] font-bold">{d.unit_label ?? `#${d.unit_id}`}</span> },
    { key: "driver_name", header: "Motorista", render: (d) => <span className="text-[13px]">{d.driver_name ?? "—"}</span> },
    {
      key: "faixas",
      header: "Distribuição por faixa",
      render: (d) => {
        const faixas = [
          { cor: "#2E86C1", v: d.time_blue ?? 0, n: "Azul" },
          { cor: "#2f9e44", v: d.time_green ?? 0, n: "Verde" },
          { cor: "#d6a419", v: d.time_yellow ?? 0, n: "Amarela" },
          { cor: "#c0392b", v: d.time_red ?? 0, n: "Vermelha" },
        ];
        const total = faixas.reduce((a, f) => a + f.v, 0) || 1;
        return (
          <div className="w-full min-w-[220px]">
            <div className="flex h-3 overflow-hidden rounded-full">
              {faixas.map((f) => (
                <div
                  key={f.n}
                  title={`${f.n}: ${Math.round((f.v / total) * 100)}%`}
                  style={{ width: `${(f.v / total) * 100}%`, background: f.cor }}
                />
              ))}
            </div>
            <div className="mt-1 flex gap-3 text-[12px] text-muted-foreground">
              {faixas.map((f) => (
                <span key={f.n}>
                  {f.n} {Math.round((f.v / total) * 100)}%
                </span>
              ))}
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable columns={COLS} rows={dados as (FaixaRpmApi & Record<string, unknown>)[]} />
      <p className="mt-3 flex items-start gap-1.5 text-[12px] text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Este relatório traz quatro faixas. A telemetria por viagem guarda catorze, incluindo extra econômica,
        inércia, eco-roll e retarder — use aquela tela para a análise completa.
      </p>
    </>
  );
}

const TIPOS_CALOR = [
  { k: "excesso_velocidade", n: "Excesso de velocidade" },
  { k: "faixa_vermelha", n: "Faixa vermelha" },
  { k: "faixa_amarela", n: "Faixa amarela" },
  { k: "batendo_transmissao", n: "Batendo transmissão" },
  { k: "parado_acelerando", n: "Parado acelerando" },
] as const;

/**
 * "Mapa de calor" do backend: eventos por veículo e por hora — não é mapa
 * geográfico (não há coordenadas). Antes a tela tentava plotar no mapa e não
 * mostrava nada. Aqui vira a matriz dia da semana × hora e o total por veículo.
 */
function MapaCalor({ dados }: { dados: PontoCalorApi[] }) {
  const total = (d: PontoCalorApi) => TIPOS_CALOR.reduce((a, t) => a + (d[t.k] ?? 0), 0);
  const celulas = useMemo(() => {
    const m = new Map<string, { dow: number; hora: number; n: number }>();
    for (const d of dados) {
      const dt = new Date(d.data_hora.replace(" ", "T"));
      if (Number.isNaN(dt.getTime())) continue;
      const k = `${dt.getDay()}-${dt.getHours()}`;
      const c = m.get(k) ?? { dow: dt.getDay(), hora: dt.getHours(), n: 0 };
      c.n += total(d);
      m.set(k, c);
    }
    return [...m.values()];
  }, [dados]);
  const porVeiculo = useMemo(() => {
    const m = new Map<number, Record<string, number | string>>();
    for (const d of dados) {
      const v = m.get(d.unit_id) ?? { placa: d.label, total: 0, ...Object.fromEntries(TIPOS_CALOR.map((t) => [t.k, 0])) };
      for (const t of TIPOS_CALOR) v[t.k] = (v[t.k] as number) + (d[t.k] ?? 0);
      v.total = (v.total as number) + total(d);
      m.set(d.unit_id, v);
    }
    return [...m.values()].sort((a, b) => (b.total as number) - (a.total as number));
  }, [dados]);
  type L = Record<string, number | string>;
  const COLS: Column<L>[] = [
    { key: "placa", header: "Veículo", render: (d) => <span className="font-mono text-[13px] font-bold">{d.placa}</span> },
    ...TIPOS_CALOR.map((t) => ({ key: t.k, header: t.n, align: "right" as const, render: (d: L) => <span className="font-mono text-[13px]">{nf(d[t.k] as number)}</span> })),
    { key: "total", header: "Total", align: "right", render: (d) => <span className="font-mono text-[13px] font-semibold">{nf(d.total as number)}</span> },
  ];
  return (
    <>
      <p className="mb-2 text-[13px] font-semibold">Eventos por dia da semana × hora</p>
      <MatrizCalor celulas={celulas} />
      <p className="mb-2 mt-5 text-[13px] font-semibold">Por veículo</p>
      <DataTable columns={COLS} rows={porVeiculo} />
      <p className="mt-3 flex items-start gap-1.5 text-[12px] text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Contagem de eventos de condução por hora, das linhas carregadas. Use "Carregar mais" para incluir o período inteiro. A análise completa está em Gerencial › Gestão de eventos.
      </p>
    </>
  );
}

function TabelaMetas({ dados }: { dados: MetaPesoApi[] }) {
  const COLS: Column<MetaPesoApi & Record<string, unknown>>[] = [
    { key: "range_id", header: "Faixa", render: (d) => <span className="font-mono text-[13px] font-bold">#{d.range_id}</span> },
    { key: "group_id", header: "Grupo", align: "center", render: (d) => <span className="font-mono text-[12px]">{d.group_id ?? "—"}</span> },
    { key: "subgroup_id", header: "Subgrupo", align: "center", render: (d) => <span className="font-mono text-[12px]">{d.subgroup_id ?? "—"}</span> },
    {
      key: "goal",
      header: "Meta",
      align: "right",
      render: (d) => <span className="font-mono text-[13px] font-semibold">{d.goal != null ? d.goal.toFixed(2) : "—"}</span>,
    },
    {
      key: "weight",
      header: "Peso",
      align: "right",
      render: (d) => <span className="font-mono text-[13px]">{d.weight != null ? d.weight.toFixed(2) : "—"}</span>,
    },
  ];

  return (
    <>
      <DataTable columns={COLS} rows={dados as (MetaPesoApi & Record<string, unknown>)[]} />
      <p className="mt-3 flex items-start gap-1.5 text-[12px] text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Estes são os valores gravados em <span className="font-mono">mova.weight_range</span>, por grupo e subgrupo.
        A tela de Metas e Pesos configura os critérios localmente — enquanto as duas não escreverem no mesmo lugar,
        elas podem divergir.
      </p>
    </>
  );
}

function TabelaHistorico({ dados }: { dados: PosicaoHistoricoApi[] }) {
  const COLS: Column<PosicaoHistoricoApi & Record<string, unknown>>[] = [
    { key: "local_time", header: "Hora", render: (d) => <span className="whitespace-nowrap font-mono text-[12px]">{d.local_time?.slice(0, 16)}</span> },
    { key: "speed", header: "Vel.", align: "right", render: (d) => <span className={cn("font-mono text-[13px]", (d.speed ?? 0) > 80 && "font-semibold text-coral")}>{d.speed ?? "—"}</span> },
    { key: "ign", header: "Ignição", align: "center", render: (d) => (d.ign == null ? "—" : <Pill tone={d.ign ? "green" : "neutral"}>{d.ign ? "ligada" : "desligada"}</Pill>) },
    { key: "event", header: "Evento", render: (d) => <span className="text-[13px]">{d.event?.name ?? "—"}</span> },
    { key: "driver", header: "Motorista", render: (d) => <span className="text-[13px]">{d.driver?.name ?? "—"}</span> },
    {
      key: "address",
      header: "Local",
      render: (d) => (
        <span className="line-clamp-1 max-w-[340px] text-[12px] text-muted-foreground" title={d.address ?? ""}>
          {d.cerca?.name ? `[${d.cerca.name}] ` : ""}
          {d.address ?? (d.latitude != null ? `${d.latitude}, ${d.longitude}` : "—")}
        </span>
      ),
    },
    { key: "odom", header: "Odômetro", align: "right", render: (d) => <span className="font-mono text-[12px]">{d.odom != null ? `${nf(Math.round(d.odom / 1000))} km` : "—"}</span> },
  ];
  return (
    <>
      <DataTable columns={COLS} rows={dados as (PosicaoHistoricoApi & Record<string, unknown>)[]} />
      <p className="mt-3 flex items-start gap-1.5 text-[12px] text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Cada linha é uma posição enviada pelo equipamento. O CSV traz todos os campos, inclusive os sinais do motor (CAN). Até 31 dias por consulta.
      </p>
    </>
  );
}
