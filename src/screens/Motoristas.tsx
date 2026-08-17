import { useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { AlertTriangle, Award, LineChart, Star, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { StarRating } from "@/components/ss/ui/gauges";
import { FleetFilters, type FleetFilterValue } from "@/components/ss/ui/FleetFilters";
import { TelemetryModal } from "@/components/ss/frota/TelemetryModal";
import { MOCK_CNH, MOCK_DESEMPENHO_VIAGENS, motoristaIdPorNome } from "@/lib/mock-data";
import { motoristasApiQuery, padroesLinhaQuery } from "@/lib/queries";
import { usandoMock } from "@/lib/modo";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { avaliarMotorista, avaliarSemContexto } from "@/lib/scoring";
import type { PadraoLinha } from "@/types";
import { CNH_TONE, exigeAtencao, prazoCNH, statusCNH } from "@/lib/cnh";

/**
 * Acompanhamento dos motoristas — nota geral + os indicadores de condução em
 * estrelas (início da faixa verde, aproveitamento de embalo, motor ligado
 * parado, acelerando acima do verde, piloto automático, excesso de velocidade,
 * freio motor e pressão do acelerador). Dados de exemplo.
 */

type Motorista = {
  nome: string;
  filial: string;
  km: string;
  consumo: string;
  mediaBordo: string;
  nota: number;
  iv: number | null; // início da faixa verde
  ae: number | null; // aproveitamento de embalo
  mp: number | null; // motor ligado parado
  av: number | null; // acelerando acima do verde
  pa: number | null; // piloto automático
  ev: number | null; // excesso de velocidade
  fm: number | null; // freio motor
  pac: number | null; // pressão do acelerador
};

const DADOS: Motorista[] = [
  { nome: "Alessandra Oliveira", filial: "Matriz SP", km: "10,76", consumo: "9,50", mediaBordo: "1,13", nota: 85, iv: 0, ae: 0, mp: 0, av: 0, pa: 0, ev: 0, fm: null, pac: null },
  { nome: "Crísala Boni", filial: "Filial RJ", km: "7.215,55", consumo: "3.421,70", mediaBordo: "2,11", nota: 71, iv: 4.5, ae: 4.5, mp: 0, av: 4.5, pa: 5, ev: 5, fm: null, pac: 1.5 },
  { nome: "Davi Nadalin", filial: "Filial PR", km: "4.821,98", consumo: "2.490,38", mediaBordo: "1,94", nota: 13, iv: 0.5, ae: 2, mp: 1, av: 0, pa: 5, ev: 0, fm: null, pac: 1 },
  { nome: "Marco Taborda", filial: "Matriz SP", km: "1.464,86", consumo: "456,07", mediaBordo: "3,21", nota: 53, iv: 2, ae: 5, mp: 4.5, av: 1, pa: 5, ev: 0, fm: null, pac: 1 },
  { nome: "Rahuany Costa", filial: "Filial RJ", km: "6.722,07", consumo: "3.657,30", mediaBordo: "1,84", nota: 15, iv: 0, ae: 0, mp: 0, av: 0, pa: 0, ev: 0, fm: null, pac: null },
  { nome: "Najla Maltaca", filial: "Filial PR", km: "20.373,11", consumo: "6.940,20", mediaBordo: "2,93", nota: 65, iv: 3, ae: 3.5, mp: 2, av: 4, pa: 4.5, ev: 3.5, fm: 2, pac: 2.5 },
  { nome: "Guilherme Souza", filial: "Filial RJ", km: "10.056,40", consumo: "5.120,80", mediaBordo: "1,96", nota: 41, iv: 1.5, ae: 2, mp: 1.5, av: 2, pa: 3, ev: 1, fm: null, pac: 1.5 },
];

const notaTone = (n: number): PillTone => (n >= 65 ? "green" : n >= 45 ? "gold" : "coral");
const stars = (key: keyof Motorista): Column<Motorista> => ({
  key: key as string,
  header: HEADERS[key as string],
  align: "center",
  render: (m) => <StarRating value={m[key] as number | null} />,
});

const HEADERS: Record<string, string> = {
  iv: "Início faixa verde",
  ae: "Aproveitamento de embalo",
  mp: "Motor ligado parado",
  av: "Acelerando acima do verde",
  pa: "Piloto automático",
  ev: "Excesso de velocidade",
  fm: "Freio motor",
  pac: "Pressão do acelerador",
};

const colunas = (PADROES_ATUAIS: PadraoLinha[]): Column<Motorista>[] => [
  {
    key: "nome",
    header: "Motorista",
    render: (m) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-tint text-[11px] font-semibold text-brand-navy">
          {m.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div>
          <div className="whitespace-nowrap font-semibold text-foreground">{m.nome}</div>
          <div className="text-[11.5px] text-muted-foreground">{m.filial}</div>
        </div>
      </div>
    ),
  },
  { key: "km", header: "Km rodado", align: "right", render: (m) => <span className="font-mono">{m.km}</span> },
  { key: "consumo", header: "Consumo (L)", align: "right", render: (m) => <span className="font-mono">{m.consumo}</span> },
  { key: "mediaBordo", header: "Média do bordo", align: "right", render: (m) => <span className="font-mono">{m.mediaBordo}</span> },
  { key: "nota", header: "Nota geral", align: "center", render: (m) => <Pill tone={notaTone(m.nota)}>{m.nota}</Pill> },
  stars("iv"),
  stars("ae"),
  stars("mp"),
  stars("av"),
  stars("pa"),
  stars("ev"),
  stars("fm"),
  stars("pac"),
  {
    key: "notaContexto",
    header: "Nota por linha",
    align: "center",
    render: (m) => {
      // A lista local identifica o motorista pelo nome; o desempenho, por id.
      const id = motoristaIdPorNome(m.nome);
      const viagens = id ? MOCK_DESEMPENHO_VIAGENS.filter((v) => v.motoristaId === id) : [];
      if (!viagens.length) return <span className="text-[12px] text-muted-foreground">—</span>;
      const comCtx = avaliarMotorista(viagens, PADROES_ATUAIS).nota;
      const semCtx = avaliarSemContexto(viagens);
      const dif = comCtx - semCtx;
      return (
        <span
          className="inline-flex items-baseline gap-1.5 whitespace-nowrap"
          title={`Contra o padrão de cada linha: ${comCtx}. Contra a média geral: ${semCtx}.`}
        >
          <span className="font-mono text-[13px] font-bold text-foreground">{comCtx}</span>
          {dif !== 0 && (
            <span className={cn("font-mono text-[11px] font-semibold", dif > 0 ? "text-leaf" : "text-coral")}>
              {dif > 0 ? "+" : ""}
              {dif}
            </span>
          )}
        </span>
      );
    },
  },
  {
    key: "cnh",
    header: "CNH",
    align: "center",
    render: (m) => {
      const validade = MOCK_CNH[m.nome]?.validade;
      const st = statusCNH(validade);
      if (st === "sem_informacao")
        return <span className="whitespace-nowrap text-[12px] text-muted-foreground">não informada</span>;
      return (
        <Pill tone={CNH_TONE[st]}>
          {exigeAtencao(st) && <AlertTriangle className="h-3 w-3" />}
          {prazoCNH(validade)}
        </Pill>
      );
    },
  },
];

export default function Motoristas() {
  const navigate = useNavigate();
  const padroesQ = useQuery(padroesLinhaQuery());
  const apiQ = useQuery(motoristasApiQuery(1, 200));

  /**
   * Ligado à API, a lista vem de mova.driver. Os indicadores de condução
   * continuam do exemplo — eles saem do relatório de telemetria, que é outra
   * consulta e ainda não está cruzada aqui.
   */
  const daApi = !usandoMock() && apiQ.data?.items.length ? apiQ.data.items : null;
  const [filtros, setFiltros] = useState<FleetFilterValue>({ veiculo: "Todos", motorista: "Todos", data: "2026-07-24" });
  const [grafico, setGrafico] = useState<string | null>(null);
  const base = useMemo(() => {
    if (!daApi) return DADOS;
    // Os indicadores de condução (estrelas) vêm do relatório de telemetria e
    // ainda não estão cruzados; ficam nulos em vez de mostrar valor inventado.
    return daApi.map((m) => ({
      nome: m.nome,
      filial: m.filial,
      km: "—",
      consumo: "—",
      mediaBordo: "—",
      nota: 0,
      iv: null, ae: null, mp: null, av: null,
      pa: null, ev: null, fm: null, pac: null,
    })) as typeof DADOS;
  }, [daApi]);

  const lista = useMemo(
    () => base.filter((m) => filtros.motorista === "Todos" || m.nome === filtros.motorista),
    [base, filtros],
  );

  const acoesCol: Column<Motorista> = {
    key: "acoes",
    header: "",
    align: "center",
    render: (m) => (
      <button
        title="Gráfico de telemetria"
        onClick={(e) => {
          e.stopPropagation();
          setGrafico(m.nome);
        }}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-gold-tint hover:text-gold"
      >
        <LineChart className="h-4 w-4" />
      </button>
    ),
  };

  return (
    <>
      <PageHeader
        title="Motoristas"
        subtitle="Acompanhamento dos motoristas · set/2026"
        actions={
          <button
            onClick={() => navigate("/app/motoristas/novo")}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Users className="h-[15px] w-[15px]" />
            Novo motorista
          </button>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Equipe · Motoristas"
          title="98 motoristas movem a operação"
          subtitle="Nota geral e cada indicador de condução em estrelas — do início da faixa verde à pressão do acelerador."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value="392.944" unit="km" label="Rodados no mês" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value="68" label="Nota média" />
          </div>
        </HeroBanner>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Users} label="Ativos" value="91" color="var(--brand-navy)" />
          <StatTile icon={Star} label="Nota média" value="68" color="var(--gold)" />
          <StatTile icon={AlertTriangle} label="Em atenção" value="3" color="var(--coral)" />
          <StatTile icon={TrendingUp} label="Km total" value="392.944" color="var(--brand-sky)" />
        </div>

        <FleetFilters
          veiculos={[]}
          motoristas={DADOS.map((m) => m.nome)}
          value={filtros}
          onChange={setFiltros}
          show={["motorista", "data"]}
        />

        <Card
          title="Acompanhamento dos motoristas"
          icon={Award}
          action={<Pill tone="sky">{lista.length} motoristas</Pill>}
          bodyClassName="p-4"
        >
          <DataTable
            columns={[...colunas(padroesQ.data ?? []), acoesCol]}
            rows={lista}
            onRowClick={(m) => navigate(`/app/motoristas/perfil/${encodeURIComponent(m.nome)}`)}
          />
        </Card>

        <p className="py-6 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>

      {grafico && (
        <TelemetryModal titulo={grafico} periodo="01–30 set 2026" onClose={() => setGrafico(null)} />
      )}
    </>
  );
}
