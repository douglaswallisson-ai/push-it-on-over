import { usandoMock } from "@/lib/modo";
import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  Cable,
  ClipboardCheck,
  Flame,
  Target,
  Wrench,
  BarChart3,
  Bus,
  Clock,
  Download,
  FileText,
  Fuel,
  Gauge,
  Leaf,
  MapPin,
  Route,
  ShieldAlert,
  Star,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { useNavigate } from "@/lib/router-compat";
import TelemetriaViagens from "@/screens/TelemetriaViagens";
import RelatoriosOperacionais, { type AbaOperacional } from "@/screens/RelatoriosOperacionais";
import { exportarCSV } from "@/lib/export";
import { toast } from "sonner";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, Pill, type Column, type PillTone } from "@/components/ss/ui/data";

/**
 * Relatórios — catálogo de relatórios do sistema por categoria e um histórico
 * dos últimos gerados. Cada cartão dispararia a geração (protótipo).
 */

type Report = { icon: LucideIcon; title: string; desc: string; color: string
  /**
   * Tela que já entrega este relatório. Sem rota, o item consta do catálogo
   * mas ainda não tem destino — e o cartão diz isso, em vez de abrir vazio.
   */
  rota?: string;
  /** Relatório que abre dentro desta própria tela. */
  embutido?: "telemetria" | "operacionais";
  /** Aba em que o relatório operacional abre. */
  aba?: AbaOperacional;
};
type Categoria = { grupo: string; itens: Report[] };

const CATALOGO: Categoria[] = [
  {
    grupo: "Operação",
    itens: [
      { icon: Route, title: "Telemetria por viagem", desc: "Viagem a viagem, com 113 campos: consumo, faixas, chuva, linha.", color: "var(--brand-navy)", embutido: "telemetria" },
      { icon: MapPin, title: "Histórico de posições", desc: "Todas as posições registradas, com endereço e velocidade.", color: "var(--brand-sky)", embutido: "operacionais", aba: "historico" },
      { icon: Activity, title: "Sinais do motor", desc: "22 leituras do barramento CAN: ARLA, turbo, pressão, marcha.", color: "var(--brand-sky)", rota: "/app/frota/sinais" },
      { icon: ShieldAlert, title: "Eventos e alarmes", desc: "Alarmes por severidade, com fila de tratativa.", color: "var(--gold)", rota: "/app/eventos" },
      { icon: Gauge, title: "Excesso de velocidade", desc: "Por tipo de via e condição de pista — urbano, rodoviário, chuva.", color: "var(--coral)", rota: "/app/gerencial#seguranca" },
      { icon: Clock, title: "Percurso do dia", desc: "Ignição, paradas e retomadas de um veículo, com traçado.", color: "var(--brand-navy)", rota: "/app/frota/tracking" },
      { icon: Flame, title: "Mapa de calor", desc: "Onde a frota mais circula, por concentração de passagens.", color: "var(--coral)", embutido: "operacionais", aba: "calor" },
      { icon: MapPin, title: "Pontos e cercas", desc: "Passagens por ponto de interesse, com entrada e saída.", color: "var(--leaf)", rota: "/app/cadastros/pontos-interesse" },
    ],
  },
  {
    grupo: "Frota",
    itens: [
      { icon: Fuel, title: "Consumo de combustível", desc: "Litros, km/l e desvio contra a média, por veículo.", color: "var(--gold)", embutido: "operacionais", aba: "motoristas" },
      { icon: Truck, title: "Utilização da frota", desc: "Disponibilidade, ociosidade e horas de motor.", color: "var(--brand-navy)", rota: "/app/gerencial" },
      { icon: Wrench, title: "Manutenção preventiva", desc: "O que vence, quando e por qual gatilho — km, horas ou prazo.", color: "var(--coral)", rota: "/app/manutencao" },
      { icon: ClipboardCheck, title: "Checklist de inspeção", desc: "Modelos, itens e respostas, com reprovações destacadas.", color: "var(--leaf)", rota: "/app/frota/checklist" },
      { icon: Cable, title: "Equipamentos por veículo", desc: "Rastreador e câmera instalados, e quem está sem.", color: "var(--brand-sky)", rota: "/app/cadastros/equipamentos" },
      { icon: Leaf, title: "Emissão de CO₂", desc: "Pegada de carbono estimada a partir do consumo real.", color: "var(--leaf)", rota: "/app/co2" },
      { icon: Wrench, title: "Ordens de serviço", desc: "Abertas, em execução e concluídas, com custo.", color: "var(--gold)", rota: "/app/manutencao/ordens" },
      { icon: Gauge, title: "Diagnóstico DTC", desc: "Códigos de falha ativos e recomendação de ação.", color: "var(--coral)", rota: "/app/manutencao/diagnostico" },
    ],
  },
  {
    grupo: "Motoristas",
    itens: [
      { icon: Star, title: "Desempenho de condução", desc: "Nota contextual por linha e faixa horária.", color: "var(--brand-sky)", rota: "/app/frota/analise" },
      { icon: Fuel, title: "Km e combustível", desc: "Distância, litros e horas por motorista, com consumo.", color: "var(--gold)", embutido: "operacionais", aba: "motoristas" },
      { icon: Gauge, title: "Faixas de RPM", desc: "Distribuição do tempo entre azul, verde, amarela e vermelha.", color: "var(--leaf)", embutido: "operacionais", aba: "rpm" },
      { icon: Users, title: "Premiação", desc: "Apuração de bônus por meta e peso configurados.", color: "var(--leaf)", rota: "/app/premiacao" },
      { icon: Clock, title: "Espelho de ponto", desc: "Jornada, intervalos e horas extras — Lei 13.103.", color: "var(--brand-navy)", rota: "/app/pessoas/jornada" },
      { icon: ShieldAlert, title: "Multas por motorista", desc: "Infrações, pontos e prazo de indicação do condutor.", color: "var(--coral)", rota: "/app/pessoas/multas" },
      { icon: Target, title: "Metas e pesos", desc: "Critérios de avaliação por grupo e subgrupo.", color: "var(--brand-sky)", embutido: "operacionais", aba: "metas" },
    ],
  },
  {
    grupo: "Transporte urbano",
    itens: [
      { icon: Route, title: "Cumprimento de programação", desc: "Programado contra realizado, com desvio por viagem.", color: "var(--brand-navy)", rota: "/app/operacao/viagens" },
      { icon: Bus, title: "Escala por linha", desc: "Turnos, dias de operação e motorista fixo.", color: "var(--brand-sky)", rota: "/app/fretamento/escala" },
      { icon: Users, title: "Contagem de passageiros", desc: "Embarques por linha, viagem e faixa horária.", color: "var(--leaf)", rota: "/app/urbano/passageiros" },
      { icon: Activity, title: "Intervalo entre carros", desc: "Headway realizado e formação de comboio.", color: "var(--gold)", rota: "/app/operacao/sinotico" },
    ],
  },
  {
    grupo: "Fretamento",
    itens: [
      { icon: Bus, title: "Ocupação de viagens", desc: "Assentos ocupados contra capacidade, por viagem.", color: "var(--brand-navy)" },
      { icon: BarChart3, title: "Faturamento por rota", desc: "Receita, custo e margem por trajeto.", color: "var(--leaf)" },
      { icon: Route, title: "Economia de roteirização", desc: "Quilômetros poupados pela otimização de rota.", color: "var(--leaf)", rota: "/app/fretamento/roteirizacao" },
    ],
  },
  {
    grupo: "Gestão",
    itens: [
      { icon: BarChart3, title: "Painel operacional", desc: "Consolidado do período com comparação contra o anterior.", color: "var(--brand-navy)", rota: "/app/gerencial" },
      { icon: ShieldAlert, title: "Auditoria", desc: "Quem alterou o quê e quando, por organização.", color: "var(--muted-foreground)", rota: "/app/auditoria" },
      { icon: BarChart3, title: "Contratos", desc: "Vigência, veículos por modalidade e aditivos.", color: "var(--gold)", rota: "/console/contratos" },
    ],
  },
];


type Recente = { nome: string; categoria: string; periodo: string; gerado: string; formato: string; status: "Pronto" | "Processando" };
const statusTone: Record<Recente["status"], PillTone> = { Pronto: "green", Processando: "gold" };

const RECENTES: Recente[] = [
  { nome: "Consumo de combustível", categoria: "Frota", periodo: "Jul 2026", gerado: "há 12 min", formato: "PDF", status: "Pronto" },
  { nome: "Emissão de CO₂", categoria: "Frota", periodo: "1º sem 2026", gerado: "há 1 h", formato: "CSV", status: "Pronto" },
  { nome: "Espelho de ponto", categoria: "Motoristas", periodo: "24/07", gerado: "há 3 h", formato: "PDF", status: "Pronto" },
  { nome: "Faturamento por rota", categoria: "Fretamento", periodo: "Jul 2026", gerado: "agora", formato: "XLSX", status: "Processando" },
];

/**
 * Gera e baixa o relatório. Enquanto a API de relatórios não existe, monta um
 * CSV com os metadados da solicitação — o botão deixa de ser decorativo e o
 * fluxo de download já fica pronto para receber o arquivo real do servidor.
 */
/** Solicita a geração de um relatório do catálogo e entrega o arquivo. */
function gerarRelatorio(titulo: string, categoria: string) {
  exportarCSV(
    [{ titulo, categoria, solicitadoEm: new Date().toLocaleString("pt-BR") }],
    [
      { cabecalho: "Relatório", valor: (x) => x.titulo },
      { cabecalho: "Categoria", valor: (x) => x.categoria },
      { cabecalho: "Solicitado em", valor: (x) => x.solicitadoEm },
    ],
    titulo.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  );
  toast.success(`"${titulo}" gerado.`);
}

function baixarRelatorio(r: Recente) {
  exportarCSV(
    [r],
    [
      { cabecalho: "Relatório", valor: (x) => x.nome },
      { cabecalho: "Categoria", valor: (x) => x.categoria },
      { cabecalho: "Período", valor: (x) => x.periodo },
      { cabecalho: "Gerado", valor: (x) => x.gerado },
      { cabecalho: "Formato", valor: (x) => x.formato },
    ],
    r.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  );
  toast.success(`"${r.nome}" baixado.`);
}

const COLS: Column<Recente>[] = [
  { key: "nome", header: "Relatório", render: (r) => <span className="font-semibold text-foreground">{r.nome}</span> },
  { key: "categoria", header: "Categoria", render: (r) => <Pill tone="sky">{r.categoria}</Pill> },
  { key: "periodo", header: "Período" },
  { key: "gerado", header: "Gerado", render: (r) => <span className="text-muted-foreground">{r.gerado}</span> },
  { key: "formato", header: "Formato", align: "center", render: (r) => <span className="font-mono text-[12px]">{r.formato}</span> },
  { key: "status", header: "Status", align: "center", render: (r) => <Pill tone={statusTone[r.status]}>{r.status}</Pill> },
  {
    key: "acao",
    header: "",
    align: "right",
    render: (r) =>
      r.status === "Pronto" ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            baixarRelatorio(r);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1.5 text-[12px] font-medium text-brand-navy hover:bg-secondary"
        >
          <Download className="h-3.5 w-3.5" />
          Baixar
        </button>
      ) : (
        <span className="text-[12px] text-muted-foreground">aguarde…</span>
      ),
  },
];

/**
 * Relatórios que abrem dentro desta tela.
 *
 * Cada um destes tem visualizador próprio; os demais itens do catálogo levam
 * para a tela onde o assunto vive, ou avisam que ainda não têm destino.
 *
 * Abrir aqui em vez de navegar mantém o usuário na central: ele compara dois
 * relatórios sem perder o caminho de volta.
 */
type Embutido = { tipo: "telemetria" | "operacionais"; aba?: AbaOperacional };

function CentralRelatorios() {
  const navigate = useNavigate();
  const [embutido, setEmbutido] = useState<Embutido | null>(null);
  const real = !usandoMock();
  const disponiveis = CATALOGO.reduce((a, c) => a + c.itens.filter((r) => r.rota || r.embutido).length, 0);

  // O relatório escolhido abre aqui mesmo, com o caminho de volta.
  if (embutido?.tipo === "telemetria") return <TelemetriaViagens onVoltar={() => setEmbutido(null)} />;
  if (embutido?.tipo === "operacionais") return <RelatoriosOperacionais abaInicial={embutido.aba} onVoltar={() => setEmbutido(null)} />;

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Central de relatórios do sistema" />

      <div className="mx-auto max-w-[1360px] space-y-8 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Central de relatórios"
          title="Relatórios do sistema"
          subtitle="Gere qualquer recorte da operação — operação, frota, motoristas e fretamento."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value={String(disponiveis)} label="Relatórios disponíveis" />
            {!real && (
              <>
                <div className="h-10 w-px bg-white/15" />
                <HeroMetric value="4" label="Gerados hoje" />
              </>
            )}
          </div>
        </HeroBanner>

        {CATALOGO.map((cat) => (
          <section key={cat.grupo}>
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="inline-block h-px w-4 bg-current opacity-50" />
              {cat.grupo}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cat.itens.map((r) => {
                const semDestino = !r.embutido && !r.rota;
                return (
                <button
                  key={r.title}
                  disabled={real && semDestino}
                  onClick={() =>
                    r.embutido
                      ? setEmbutido({ tipo: r.embutido, aba: r.aba })
                      : r.rota
                        ? navigate(r.rota)
                        : gerarRelatorio(r.title, cat.grupo)
                  }
                  title={semDestino ? "Ainda sem tela no sistema novo" : "Abrir relatório"}
                  className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-[#cdd7e2] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0"
                >
                  <div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ background: `color-mix(in oklab, ${r.color} 14%, white)` }}
                  >
                    <r.icon className="h-5 w-5" style={{ color: r.color }} />
                  </div>
                  <h3 className="text-[14.5px] font-semibold text-foreground">{r.title}</h3>
                  <p className="mt-1 flex-1 text-[12.5px] leading-relaxed text-muted-foreground">{r.desc}</p>
                  {semDestino && (
                    <span className="mt-1.5 inline-block w-fit rounded bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      em breve
                    </span>
                  )}
                  {!(real && semDestino) && (
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand-navy">
                      <FileText className="h-3.5 w-3.5" />
                      {r.embutido ? "Abrir relatório" : r.rota ? "Ir para a tela" : "Gerar relatório"}
                    </span>
                  )}
                </button>
                );
              })}
            </div>
          </section>
        ))}

        {!real && (
          <Card title="Gerados recentemente" icon={FileText} bodyClassName="p-4">
            <DataTable columns={COLS} rows={RECENTES} />
          </Card>
        )}

        <p className="pb-4 text-center text-xs text-muted-foreground">
          {real
            ? "Relatórios com dados reais. Os indicadores do BI (ranking, eventos, parado ligado, relevo…) estão no Gerencial."
            : "Dados de exemplo — protótipo de interface, sem dados reais."}
        </p>
      </div>
    </>
  );
}

/** Central de relatórios: o catálogo, com os relatórios reais abrindo aqui mesmo. */
export default function Relatorios() {
  return <CentralRelatorios />;
}
