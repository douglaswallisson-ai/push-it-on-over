import { useMemo, useState } from "react";
import { Download, Flame, Fuel, Gauge, Info, Loader2, Target, TrendingUp, User } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import {
  urlExportCsv,
  useRelatorioCursor,
  type FaixaRpmApi,
  type MetaPesoApi,
  type MotoristaKmApi,
  type PontoCalorApi,
} from "@/lib/relatorios-api";
import { MapaCliente } from "@/components/ss/mapa/MapaCliente";
import { usandoMock } from "@/lib/modo";
import { nf } from "@/lib/queries";
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

type Aba = "motoristas" | "rpm" | "calor" | "metas";

const ABAS: { id: Aba; rotulo: string; icone: typeof User; relatorio: Parameters<typeof useRelatorioCursor>[0] }[] = [
  { id: "motoristas", rotulo: "Consumo por motorista", icone: User, relatorio: "driver-km-fuel-hours" },
  { id: "rpm", rotulo: "Faixas de RPM", icone: Gauge, relatorio: "rpm-band-time" },
  { id: "calor", rotulo: "Mapa de calor", icone: Flame, relatorio: "heatmap" },
  { id: "metas", rotulo: "Metas e pesos", icone: Target, relatorio: "weight-range" },
];

const hhmm = (s?: number | null) => (s == null ? "—" : `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`);

function janelaPadrao() {
  const fim = new Date();
  const inicio = new Date(fim.getTime() - 30 * 86_400_000);
  return { i: inicio.toISOString().slice(0, 10), f: fim.toISOString().slice(0, 10) };
}

export default function RelatoriosOperacionais() {
  const p = janelaPadrao();
  const [aba, setAba] = useState<Aba>("motoristas");
  const [inicio, setInicio] = useState(p.i);
  const [fim, setFim] = useState(p.f);

  const filtro = useMemo(
    () => ({ inicio: `${inicio} 00:00:00`, fim: `${fim} 23:59:59`, limite: 500 }),
    [inicio, fim],
  );

  const atual = ABAS.find((a) => a.id === aba)!;
  const q = useRelatorioCursor<Record<string, unknown>>(atual.relatorio, filtro);

  return (
    <>
      <PageHeader
        title="Relatórios operacionais"
        subtitle="Relatórios › Consumo, condução e cobertura"
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <a
              href={urlExportCsv(atual.relatorio, filtro)}
              onClick={() => toast.success("Download iniciado.")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white",
                usandoMock() && "pointer-events-none opacity-50",
              )}
            >
              <Download className="h-[15px] w-[15px]" />
              CSV
            </a>
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
        ) : q.erroJanela ? (
          <Card title={atual.rotulo} icon={atual.icone} bodyClassName="p-4">
            <EmptyNote>{q.erroJanela}</EmptyNote>
          </Card>
        ) : (
          <Card
            title={atual.rotulo}
            icon={atual.icone}
            action={<Pill tone="sky">{nf(q.registros.length)} registros</Pill>}
            bodyClassName="p-4"
          >
            {q.isPending ? (
              <SkeletonRows rows={8} />
            ) : q.error ? (
              <ErrorBox error={q.error} onRetry={() => q.refetch()} />
            ) : q.registros.length === 0 ? (
              <EmptyNote>Nenhum dado no período.</EmptyNote>
            ) : (
              <>
                {aba === "motoristas" && <TabelaMotoristas dados={q.registros as unknown as MotoristaKmApi[]} />}
                {aba === "rpm" && <TabelaRpm dados={q.registros as unknown as FaixaRpmApi[]} />}
                {aba === "calor" && <MapaCalor dados={q.registros as unknown as PontoCalorApi[]} />}
                {aba === "metas" && <TabelaMetas dados={q.registros as unknown as MetaPesoApi[]} />}

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
    { key: "trips", header: "Viagens", align: "right", render: (d) => <span className="font-mono text-[12.5px]">{nf(d.trips ?? 0)}</span> },
    { key: "total_km", header: "Distância", align: "right", render: (d) => <span className="font-mono text-[12.5px]">{nf(Math.round(d.total_km ?? 0))} km</span> },
    { key: "total_fuel", header: "Combustível", align: "right", render: (d) => <span className="font-mono text-[12.5px]">{nf(Math.round(d.total_fuel ?? 0))} L</span> },
    { key: "total_hours", header: "Horas", align: "right", render: (d) => <span className="font-mono text-[12.5px]">{hhmm((d.total_hours ?? 0) * 3600)}</span> },
    {
      key: "efficiency_kml",
      header: "Consumo",
      align: "right",
      render: (d) => {
        const v = d.efficiency_kml ?? 0;
        const media = totalL ? totalKm / totalL : 0;
        return (
          <span className={cn("font-mono text-[12.5px] font-semibold", v > media ? "text-leaf" : v ? "text-coral" : "")}>
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
      <p className="mt-3 text-[11.5px] text-muted-foreground">
        O consumo é comparado com a média do período, não com uma meta fixa. Meta única para frota inteira ignora que
        um carro urbano e um rodoviário nunca terão o mesmo número.
      </p>
    </>
  );
}

function TabelaRpm({ dados }: { dados: FaixaRpmApi[] }) {
  const COLS: Column<FaixaRpmApi & Record<string, unknown>>[] = [
    { key: "unit_label", header: "Veículo", render: (d) => <span className="font-mono text-[12.5px] font-bold">{d.unit_label ?? `#${d.unit_id}`}</span> },
    { key: "driver_name", header: "Motorista", render: (d) => <span className="text-[12.5px]">{d.driver_name ?? "—"}</span> },
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
            <div className="mt-1 flex gap-3 text-[10.5px] text-muted-foreground">
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
      <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Este relatório traz quatro faixas. A telemetria por viagem guarda catorze, incluindo extra econômica,
        inércia, eco-roll e retarder — use aquela tela para a análise completa.
      </p>
    </>
  );
}

function MapaCalor({ dados }: { dados: PontoCalorApi[] }) {
  /**
   * O mapa de calor real exige camada própria do Leaflet. Aqui os pontos de
   * maior concentração viram marcadores, o que já responde a pergunta
   * principal — onde a frota mais circula.
   */
  const topo = [...dados].sort((a, b) => (b.count ?? b.weight ?? 0) - (a.count ?? a.weight ?? 0)).slice(0, 60);

  return (
    <>
      <MapaCliente
        veiculos={topo.map((p, i) => ({
          placa: `c${i}`,
          rotulo: String(p.count ?? Math.round(p.weight ?? 0)),
          lat: p.latitude,
          lng: p.longitude,
          situacao: "em_viagem",
          velocidade: 0,
        }))}
        selecionado={null}
        onSelect={() => {}}
        altura="h-[480px]"
      />
      <p className="mt-2 text-[11.5px] text-muted-foreground">
        Os 60 pontos de maior concentração no período, com a contagem de passagens. Cada marcador mostra quantas
        vezes a frota passou ali.
      </p>
    </>
  );
}

function TabelaMetas({ dados }: { dados: MetaPesoApi[] }) {
  const COLS: Column<MetaPesoApi & Record<string, unknown>>[] = [
    { key: "range_id", header: "Faixa", render: (d) => <span className="font-mono text-[12.5px] font-bold">#{d.range_id}</span> },
    { key: "group_id", header: "Grupo", align: "center", render: (d) => <span className="font-mono text-[12px]">{d.group_id ?? "—"}</span> },
    { key: "subgroup_id", header: "Subgrupo", align: "center", render: (d) => <span className="font-mono text-[12px]">{d.subgroup_id ?? "—"}</span> },
    {
      key: "goal",
      header: "Meta",
      align: "right",
      render: (d) => <span className="font-mono text-[12.5px] font-semibold">{d.goal != null ? d.goal.toFixed(2) : "—"}</span>,
    },
    {
      key: "weight",
      header: "Peso",
      align: "right",
      render: (d) => <span className="font-mono text-[12.5px]">{d.weight != null ? d.weight.toFixed(2) : "—"}</span>,
    },
  ];

  return (
    <>
      <DataTable columns={COLS} rows={dados as (MetaPesoApi & Record<string, unknown>)[]} />
      <p className="mt-3 flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Estes são os valores gravados em <span className="font-mono">mova.weight_range</span>, por grupo e subgrupo.
        A tela de Metas e Pesos configura os critérios localmente — enquanto as duas não escreverem no mesmo lugar,
        elas podem divergir.
      </p>
    </>
  );
}
