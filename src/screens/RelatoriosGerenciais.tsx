import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, BarChart3, CalendarRange, ClipboardList, Clock, Fuel, Gauge, IdCard, LineChart, ListOrdered, Mountain, Scale, ShieldAlert, Siren, Trophy,
  User, Warehouse, Wrench, X, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import DashboardOperacional from "./DashboardOperacional";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Link } from "@/lib/router-compat";
import { garagensBIQuery, rankingBIQuery, type FiltrosBI } from "@/lib/bi-api";
import { veiculosApiQuery } from "@/lib/queries";
import { datasDoPeriodo, periodoAnterior, periodoPadrao, PRECO_DIESEL_PADRAO, ROTULO_PERIODO, type Periodo } from "@/lib/gerencial-api";
import { cn } from "@/lib/utils";
import { Info, dataBR } from "./gerencial/pecas";
import { PaginaAnalise, PaginaEvolucao, PaginaPontuacao, PaginaRanking, type Ctx } from "./gerencial/Conducao";
import { PaginaEventos, PaginaSeguranca } from "./gerencial/Seguranca";
import { PaginaCombustivel, PaginaGeral, PaginaParado } from "./gerencial/Operacao";
import { PaginaNaoIdentificado, PaginaTecnica } from "./gerencial/Qualidade";
import { PaginaRelevo } from "./gerencial/Relevo";

/**
 * Gerencial — as páginas do Power BI "Indicadores de Condução" e
 * do Dashboard Start, navegáveis por cabeçalho, com os mesmos filtros em
 * todas: período, garagem, placa e condutor.
 *
 * Instrutor e função (filtros do Power BI) ficam de fora: o sistema novo ainda
 * não tem o vínculo motorista ↔ instrutor nem a função do motorista.
 */

type PaginaId =
  | "geral" | "operacao" | "ranking" | "analise" | "pontuacao" | "evolucao" | "eventos" | "seguranca" | "parado" | "combustivel" | "relevo" | "nao-identificado" | "tecnica";

const GRUPOS: { titulo: string; paginas: { id: PaginaId; label: string; icon: LucideIcon; dica: string }[] }[] = [
  {
    titulo: "Visão geral",
    paginas: [
      { id: "geral", label: "Visão geral", icon: BarChart3, dica: "Os indicadores do Dashboard Start: consumo, km, eficiência, faixas e economia potencial." },
      { id: "operacao", label: "Painel da operação", icon: Activity, dica: "A frota agora (em rota, parado ligado, sem sinal), pendências e o período contra o anterior." },
    ],
  },
  {
    titulo: "Condução",
    paginas: [
      { id: "ranking", label: "Ranking de condução", icon: Trophy, dica: "Velocímetros das faixas contra as metas, pódio e ranking de motoristas e placas." },
      { id: "analise", label: "Análise de condução", icon: ListOrdered, dica: "Quantidade de cada evento por condutor e por placa." },
      { id: "pontuacao", label: "Gestão da pontuação", icon: Scale, dica: "De onde vêm os pontos: ganhos, descontos e saldo, por mês e por dia." },
      { id: "evolucao", label: "Evolução", icon: LineChart, dica: "Como os principais indicadores mudaram ao longo do período." },
    ],
  },
  {
    titulo: "Segurança",
    paginas: [
      { id: "eventos", label: "Gestão de eventos", icon: Siren, dica: "Todos os eventos: mapa de calor dia × hora, evolução, placas e condutores." },
      { id: "seguranca", label: "Central de segurança", icon: ShieldAlert, dica: "Velocidade, freadas e acelerações: totais diários, motoristas de risco e lista do dia." },
    ],
  },
  {
    titulo: "Operação",
    paginas: [
      { id: "parado", label: "Parado ligado", icon: Clock, dica: "Paradas com motor ligado por local, placa, condutor, hora e dia." },
      { id: "combustivel", label: "Combustível", icon: Fuel, dica: "Consumo, média, CO₂ e as melhores e piores médias." },
      { id: "relevo", label: "Relevo", icon: Mountain, dica: "Subida e descida das rotas pelo mapa de elevação, por veículo e motorista, e quanto o relevo explica o consumo." },
    ],
  },
  {
    titulo: "Qualidade",
    paginas: [
      { id: "nao-identificado", label: "Não identificado", icon: IdCard, dica: "Horas rodadas sem motorista identificado, por dia e placa." },
      { id: "tecnica", label: "Área técnica", icon: Wrench, dica: "Saúde da frota, veículos sem transmissão e faixas para recalibrar." },
    ],
  },
];

const TODAS = GRUPOS.flatMap((g) => g.paginas);
const COMPONENTE: Record<PaginaId, (c: Ctx) => ReactNode> = {
  geral: PaginaGeral,
  // Tem o próprio seletor de 7/30/90 dias; os filtros acima não se aplicam.
  operacao: () => <DashboardOperacional embutido />,
  ranking: PaginaRanking,
  analise: PaginaAnalise,
  pontuacao: PaginaPontuacao,
  evolucao: PaginaEvolucao,
  eventos: PaginaEventos,
  seguranca: PaginaSeguranca,
  parado: PaginaParado,
  combustivel: PaginaCombustivel,
  relevo: PaginaRelevo,
  "nao-identificado": PaginaNaoIdentificado,
  tecnica: PaginaTecnica,
};

const lerHash = (): PaginaId => {
  const h = (typeof window !== "undefined" ? window.location.hash.slice(1) : "") as PaginaId;
  return TODAS.some((p) => p.id === h) ? h : "geral";
};

type PeriodoTela = Periodo | "livre";

const sel = "h-9 rounded-lg border border-border bg-white px-2.5 text-[13px] outline-none focus:ring-2 focus:ring-brand-navy/20";

export default function RelatoriosGerenciais() {
  const [pagina, setPagina] = useState<PaginaId>(lerHash);
  const [periodo, setPeriodo] = useState<PeriodoTela>(periodoPadrao());
  const padrao = datasDoPeriodo(periodoPadrao());
  const [livre, setLivre] = useState(padrao);
  const [garagem, setGaragem] = useState("");
  const [placa, setPlaca] = useState("");
  const [condutor, setCondutor] = useState("");
  const [preco, setPreco] = useState(PRECO_DIESEL_PADRAO);

  useEffect(() => {
    const ouvir = () => setPagina(lerHash());
    window.addEventListener("hashchange", ouvir);
    return () => window.removeEventListener("hashchange", ouvir);
  }, []);
  const ir = (id: PaginaId) => {
    setPagina(id);
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const datas = periodo === "livre" ? livre : datasDoPeriodo(periodo);
  const f: FiltrosBI = { ...datas, garagem: garagem || undefined, placa: placa || undefined, condutor: condutor || undefined };
  const ant: FiltrosBI = { ...f, ...periodoAnterior(datas.inicio, datas.fim) };

  const garQ = useQuery(garagensBIQuery());
  const veiQ = useQuery(veiculosApiQuery());
  // Lista de condutores: os que rodaram no período (o ranking já tem nome e id).
  const motQ = useQuery(rankingBIQuery({ ...datas, garagem: garagem || undefined, placa: placa || undefined }, "motorista"));
  const placas = useMemo(
    () => (veiQ.data?.items ?? []).filter((v) => !garagem || v.unidadeId === garagem).sort((a, b) => a.placa.localeCompare(b.placa)),
    [veiQ.data, garagem],
  );
  const condutores = useMemo(() => [...(motQ.data?.motoristas ?? [])].sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "")), [motQ.data]);

  const atual = TODAS.find((p) => p.id === pagina)!;
  const Comp = COMPONENTE[pagina];
  const ativos = [
    garagem && { k: "g", r: `Garagem: ${garQ.data?.find((g) => String(g.id) === garagem)?.name ?? garagem}`, limpar: () => setGaragem("") },
    placa && { k: "p", r: `Placa: ${placas.find((v) => v.id === placa)?.placa ?? placa}`, limpar: () => setPlaca("") },
    condutor && { k: "c", r: `Condutor: ${condutor === "0" ? "Não identificado" : condutores.find((m) => String(m.driver_id) === condutor)?.nome ?? condutor}`, limpar: () => setCondutor("") },
  ].filter(Boolean) as { k: string; r: string; limpar: () => void }[];

  return (
    <TooltipProvider>
      <PageHeader title="Gerencial" subtitle={pagina === "operacao" ? atual.label : `${atual.label} · ${dataBR(f.inicio)} a ${dataBR(f.fim)}`} />
      <div className="mx-auto grid max-w-[1720px] gap-5 px-4 py-5 md:px-8 lg:grid-cols-[minmax(0,1fr)_236px]">
        {/* Menu das páginas do BI: lateral direita na tela grande (acompanha a
            rolagem); no celular fica no alto, rolando para o lado. */}
        <aside className="order-first lg:order-last">
          <nav className="rounded-2xl border border-border bg-card/95 p-1.5 shadow-card backdrop-blur lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:p-2">
            <div className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-3 lg:overflow-visible">
              {GRUPOS.map((g, gi) => (
                <div key={g.titulo} className={cn("flex shrink-0 items-center gap-1 lg:flex-col lg:items-stretch lg:gap-0.5", gi > 0 && "border-l border-border pl-1 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-2")}>
                  <span className="px-1.5 font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground lg:px-2.5 lg:pb-1 lg:pt-0.5">{g.titulo}</span>
                  {g.paginas.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => ir(p.id)}
                      title={p.dica}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-all duration-200 lg:w-full",
                        pagina === p.id ? "bg-brand-navy text-white shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      )}
                    >
                      <p.icon className="h-4 w-4 shrink-0" />
                      <span className="whitespace-nowrap lg:whitespace-normal">{p.label}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </nav>
        </aside>

        <div className="min-w-0 space-y-5">
        {/* Filtros: valem para todas as páginas, menos o painel da operação. */}
        <div className={cn("flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-card", pagina === "operacao" && "hidden")}>
          <label className="inline-flex items-center gap-1.5">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoTela)} className={sel} aria-label="Período">
              {(Object.keys(ROTULO_PERIODO) as Periodo[]).map((p) => <option key={p} value={p}>{ROTULO_PERIODO[p]}</option>)}
              <option value="livre">Escolher datas…</option>
            </select>
          </label>
          {periodo === "livre" && (
            <>
              <input type="date" value={livre.inicio} max={livre.fim} onChange={(e) => e.target.value && setLivre((x) => ({ ...x, inicio: e.target.value }))} className={sel} aria-label="Data inicial" />
              <span className="text-[12px] text-muted-foreground">a</span>
              <input type="date" value={livre.fim} min={livre.inicio} onChange={(e) => e.target.value && setLivre((x) => ({ ...x, fim: e.target.value }))} className={sel} aria-label="Data final" />
            </>
          )}
          {(garQ.data?.length ?? 0) > 1 && (
            <label className="inline-flex items-center gap-1.5">
              <Warehouse className="h-4 w-4 text-muted-foreground" />
              <select value={garagem} onChange={(e) => { setGaragem(e.target.value); setPlaca(""); }} className={cn(sel, "max-w-[200px]")} aria-label="Garagem">
                <option value="">Todas as garagens</option>
                {garQ.data!.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
          <label className="inline-flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <select value={placa} onChange={(e) => setPlaca(e.target.value)} className={cn(sel, "max-w-[180px]")} aria-label="Placa">
              <option value="">Todas as placas</option>
              {placas.map((v) => <option key={v.id} value={v.id}>{v.placa}{v.prefixo ? ` · ${v.prefixo}` : ""}</option>)}
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5">
            <User className="h-4 w-4 text-muted-foreground" />
            <select value={condutor} onChange={(e) => setCondutor(e.target.value)} className={cn(sel, "max-w-[220px]")} aria-label="Condutor">
              <option value="">Todos os condutores</option>
              <option value="0">Não identificado</option>
              {condutores.map((m) => <option key={m.driver_id} value={m.driver_id}>{m.nome ?? m.driver_id}</option>)}
            </select>
          </label>
          <label className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
            Diesel R$/L
            <input type="number" step="0.01" min="0" value={preco} onChange={(e) => setPreco(Number(e.target.value) || 0)} className={cn(sel, "w-20")} />
            <Info texto="Usado nos valores em reais (custo, economia potencial, custo evitável). O Dashboard Start usa R$ 6,00 quando não encontra o preço." />
          </label>
          <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted-foreground">
            Comparação: {dataBR(ant.inicio)} a {dataBR(ant.fim)}
            <Info texto="As setas de variação comparam com os mesmos dias do mês anterior (regra do Dashboard Start). Instrutor e função, filtros do Power BI, ainda não existem no sistema novo." />
          </span>
          {ativos.length > 0 && (
            <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-border pt-2">
              {ativos.map((a) => (
                <button key={a.k} onClick={a.limpar} className="inline-flex items-center gap-1 rounded-full bg-navy-tint px-2.5 py-0.5 text-[12px] font-medium text-brand-navy hover:bg-secondary">
                  {a.r} <X className="h-3 w-3" />
                </button>
              ))}
              <button onClick={() => { setGaragem(""); setPlaca(""); setCondutor(""); }} className="text-[12px] text-muted-foreground underline-offset-2 hover:underline">limpar filtros</button>
            </div>
          )}
        </div>

        <div key={pagina} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Comp f={f} ant={ant} preco={preco} />
        </div>

        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" />
          O Controle Diário do Power BI está em <Link to="/app/motoristas" className="font-medium text-brand-navy hover:underline">Motoristas</Link>, no acompanhamento de cada motorista.
        </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
