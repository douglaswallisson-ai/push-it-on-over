import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BedDouble,
  Info,
  Check,
  ChevronRight,
  Clock,
  Coffee,
  Eye,
  EyeOff,
  Gauge,
  MapPin,
  Navigation,
  Octagon,
  Play,
  ShieldAlert,
  Siren,
  Smartphone,
  Truck,
  User,
  Video,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/lib/router-compat";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { alarmesListaQuery } from "@/lib/queries";
import { listaEventosBIQuery, ROTULO_EVENTO, serieBIQuery, type TipoEvento } from "@/lib/bi-api";
import { iso } from "@/lib/gerencial-api";
import { usandoMock } from "@/lib/modo";
import { toast } from "sonner";
import { HeroBanner, HeroMetric } from "@/components/ss/ui/HeroBanner";
import { StatTile, Pill, type PillTone } from "@/components/ss/ui/data";
import { FleetFilters, type FleetFilterValue } from "@/components/ss/ui/FleetFilters";
import { cn } from "@/lib/utils";

/**
 * Eventos do dia — feed dinâmico. Cada evento abre um painel de detalhe com
 * tudo dentro: vídeo (quando houver), telemetria do momento, localização e a
 * validação da IA (correto / falso positivo). Filtros por veículo, motorista,
 * data e gravidade. Dados de exemplo.
 */

type Gravidade = "critica" | "alta" | "media" | "baixa";
const GRAV: Record<Gravidade, { label: string; tone: PillTone }> = {
  critica: { label: "Crítica", tone: "coral" },
  alta: { label: "Alta", tone: "gold" },
  media: { label: "Média", tone: "sky" },
  baixa: { label: "Baixa", tone: "neutral" },
};

type Leitura = { label: string; value: string; forte?: boolean };

type Evento = {
  id: string;
  hora: string;
  motorista: string;
  veiculo: string;
  tipo: string;
  icon: LucideIcon;
  video: boolean;
  gravidade: Gravidade;
  visto: boolean;
  /** Nulo quando a origem não informa (eventos de condução). */
  velocidade: number | null;
  local: string;
  origem?: "alarme" | "conducao";
  dur: string;
  x: number;
  y: number;
  leituras: Leitura[];
};

const EVENTOS: Evento[] = [
  { id: "e1", hora: "07:12", motorista: "Marco Taborda", veiculo: "BCA7A56", tipo: "Fadiga detectada", icon: BedDouble, video: true, gravidade: "critica", visto: false, velocidade: 84, local: "BR-116, km 214 — SP", dur: "12s", x: 58, y: 60, leituras: [{ label: "Confiança da IA", value: "87%", forte: true }, { label: "Olhos fechados", value: "2,4s" }, { label: "Velocidade", value: "84 km/h" }] },
  { id: "e2", hora: "07:40", motorista: "Najla Maltaca", veiculo: "SXD1J61", tipo: "Uso de celular", icon: Smartphone, video: true, gravidade: "critica", visto: false, velocidade: 72, local: "Av. Goiás, 1200 — Goiânia/GO", dur: "9s", x: 45, y: 48, leituras: [{ label: "Confiança da IA", value: "91%", forte: true }, { label: "Mão fora do volante", value: "sim" }, { label: "Velocidade", value: "72 km/h" }] },
  { id: "e3", hora: "08:05", motorista: "Rosemeri Tuono", veiculo: "TPA1106", tipo: "Excesso de velocidade", icon: Gauge, video: false, gravidade: "alta", visto: false, velocidade: 98, local: "Rod. Anhanguera, km 60", dur: "40s", x: 55, y: 55, leituras: [{ label: "Velocidade", value: "98 km/h", forte: true }, { label: "Limite da via", value: "80 km/h" }, { label: "Excesso", value: "+18 km/h" }] },
  { id: "e4", hora: "08:22", motorista: "Vitor Duarte", veiculo: "GAP4C73", tipo: "Distração", icon: Eye, video: true, gravidade: "alta", visto: false, velocidade: 66, local: "Marginal Tietê — SP", dur: "7s", x: 57, y: 62, leituras: [{ label: "Confiança da IA", value: "78%", forte: true }, { label: "Olhar fora da via", value: "3,1s" }, { label: "Velocidade", value: "66 km/h" }] },
  { id: "e5", hora: "08:47", motorista: "Marco Taborda", veiculo: "BCA7A56", tipo: "Sem cinto de segurança", icon: ShieldAlert, video: true, gravidade: "alta", visto: true, velocidade: 60, local: "BR-116, km 230 — SP", dur: "contínuo", x: 59, y: 58, leituras: [{ label: "Confiança da IA", value: "95%", forte: true }, { label: "Duração sem cinto", value: "4 min" }, { label: "Velocidade", value: "60 km/h" }] },
  { id: "e6", hora: "09:15", motorista: "Guilherme Souza", veiculo: "LUO5I08", tipo: "Freada brusca", icon: Octagon, video: false, gravidade: "media", visto: false, velocidade: 54, local: "Curitiba/PR — Centro", dur: "2s", x: 50, y: 74, leituras: [{ label: "Força-g", value: "0,62 g", forte: true }, { label: "Velocidade antes", value: "54 km/h" }, { label: "Velocidade depois", value: "12 km/h" }] },
  { id: "e7", hora: "09:33", motorista: "Najla Maltaca", veiculo: "SXD1J61", tipo: "Sonolência", icon: EyeOff, video: true, gravidade: "critica", visto: false, velocidade: 79, local: "GO-060, km 30", dur: "15s", x: 44, y: 50, leituras: [{ label: "Confiança da IA", value: "83%", forte: true }, { label: "Micro-sono", value: "1,8s" }, { label: "Velocidade", value: "79 km/h" }] },
  { id: "e8", hora: "10:02", motorista: "—", veiculo: "EBZ3590", tipo: "Cerca violada", icon: MapPin, video: false, gravidade: "alta", visto: true, velocidade: 22, local: "Recife/PE — Pátio", dur: "—", x: 78, y: 34, leituras: [{ label: "Cerca", value: "Pátio Matriz", forte: true }, { label: "Ação", value: "Saída não autorizada" }, { label: "Horário fora da janela", value: "sim" }] },
  { id: "e9", hora: "10:28", motorista: "Vitor Duarte", veiculo: "GAP4C73", tipo: "Bocejo recorrente", icon: Coffee, video: true, gravidade: "media", visto: false, velocidade: 70, local: "Rod. Régis Bittencourt", dur: "20s", x: 56, y: 64, leituras: [{ label: "Confiança da IA", value: "72%", forte: true }, { label: "Bocejos em 10 min", value: "4" }, { label: "Velocidade", value: "70 km/h" }] },
  { id: "e10", hora: "11:05", motorista: "Rosemeri Tuono", veiculo: "TPA1106", tipo: "Aceleração brusca", icon: Zap, video: false, gravidade: "baixa", visto: true, velocidade: 48, local: "Jundiaí/SP", dur: "3s", x: 52, y: 52, leituras: [{ label: "Força-g", value: "0,41 g", forte: true }, { label: "Velocidade", value: "48 km/h" }, { label: "RPM", value: "2.100" }] },
  { id: "e11", hora: "11:41", motorista: "Guilherme Souza", veiculo: "LUO5I08", tipo: "Motor ligado parado", icon: Clock, video: false, gravidade: "baixa", visto: false, velocidade: 0, local: "Terminal — Curitiba/PR", dur: "18 min", x: 50, y: 73, leituras: [{ label: "Tempo parado", value: "18 min", forte: true }, { label: "Combustível gasto", value: "3,2 L" }, { label: "Ignição", value: "ligada" }] },
  { id: "e12", hora: "12:10", motorista: "Marco Taborda", veiculo: "BCA7A56", tipo: "Pânico acionado", icon: Siren, video: false, gravidade: "critica", visto: false, velocidade: 0, local: "BR-116, km 245 — SP", dur: "—", x: 60, y: 57, leituras: [{ label: "Acionado por", value: "Motorista", forte: true }, { label: "Central notificada", value: "sim" }, { label: "Velocidade", value: "0 km/h" }] },
];

/** Eventos de condução (tabela de eventos com localização) no formato do feed. */
const GRAV_CONDUCAO: Record<TipoEvento, Gravidade> = {
  freada: "alta", aceleracao: "alta", velocidade_chuva: "alta", faixa_vermelha: "alta",
  velocidade_seco: "media", parado_acelerando: "media", embreagem: "baixa", faixa_amarela: "baixa",
  batendo_transmissao: "baixa", sem_tracao: "baixa",
};
const ICONE_CONDUCAO: Record<TipoEvento, LucideIcon> = {
  freada: Octagon, aceleracao: Zap, velocidade_seco: Gauge, velocidade_chuva: Gauge, faixa_vermelha: AlertTriangle,
  faixa_amarela: AlertTriangle, parado_acelerando: Clock, embreagem: Navigation, batendo_transmissao: Truck, sem_tracao: Navigation,
};

const uniq = (arr: string[]) => [...new Set(arr)].filter((v) => v && v !== "—");
const tone = (g: Gravidade) => GRAV[g].tone;
const iconBox = (t: PillTone) =>
  t === "coral" ? "bg-coral-tint text-coral" : t === "gold" ? "bg-gold-tint text-gold" : t === "sky" ? "bg-navy-tint text-brand-blue" : "bg-secondary text-muted-foreground";

export default function Eventos() {
  const [filtros, setFiltros] = useState<FleetFilterValue>({ veiculo: "Todos", motorista: "Todos", data: usandoMock() ? "2026-07-24" : iso(new Date()) });
  const [origem, setOrigem] = useState<"todas" | "alarme" | "conducao">("todas");
  const [mostrar, setMostrar] = useState(200);
  const [gravFiltro, setGravFiltro] = useState<Gravidade | "todas">("todas");
  const [vistos, setVistos] = useState<Set<string>>(() => new Set(EVENTOS.filter((e) => e.visto).map((e) => e.id)));
  const [validacao, setValidacao] = useState<Record<string, "correto" | "falso">>({});
  const [aberto, setAberto] = useState<string | null>(null);
  const [notificados, setNotificados] = useState<Record<string, boolean>>({});
  const [ocorrencias, setOcorrencias] = useState<Record<string, string>>({});

  /**
   * Eventos da API quando conectada. O backend já devolve o resumo por
   * severidade junto, então os contadores do topo não precisam de outra
   * consulta.
   */
  /**
   * Disparos reais do Monitor de Alarmes (`alarm_violation`), últimas 24 h.
   *
   * `/events` lê `fleet_events`, que está vazia em produção — a tela abria sem
   * nada. O nível do alarme vira gravidade: 3 (o que toca o som no monitor
   * antigo) é crítica, 2 alta, 1 média.
   */
  // A rota de alarmes recebe uma janela em horas até agora: cobre do início
  // do dia escolhido (até 30 dias atrás) e a tela recorta o dia.
  const inicioDia = new Date(filtros.data + "T00:00");
  const horasJanela = Math.min(720, Math.max(24, Math.ceil((Date.now() - inicioDia.getTime()) / 3600_000)));
  const alarmesQ = useQuery(alarmesListaQuery(horasJanela));
  // Eventos de condução do dia (freada, aceleração, velocidade, faixas…) e os
  // totais consolidados, que chegam antes do detalhe.
  const conducaoQ = useQuery(listaEventosBIQuery(filtros.data, {}, 5000));
  const totaisQ = useQuery(serieBIQuery({ inicio: filtros.data, fim: filtros.data }));
  const totDia = totaisQ.data?.dias[0];
  const carga = conducaoQ.data?.ultimo_carregado ?? null;
  const detalheNaoCarregado = !usandoMock() && !!carga && carga.slice(0, 10) < filtros.data;

  const eventosApi = useMemo(() => {
    if (usandoMock() || !alarmesQ.data) return null;
    const grav = (n: number | null): Gravidade => (n === 3 ? "critica" : n === 2 ? "alta" : n === 1 ? "media" : "baixa");
    const icone = (nome: string): LucideIcon =>
      /velocidade/i.test(nome) ? Gauge : /cerca|area|área/i.test(nome) ? MapPin : /igni/i.test(nome) ? Zap : /parad|ocios/i.test(nome) ? Clock : AlertTriangle;
    const hoje = new Date().toDateString();
    return alarmesQ.data.itens.filter((e) => e.inicio && iso(new Date(e.inicio)) === filtros.data).map((e) => {
      const d = e.inicio ? new Date(e.inicio) : null;
      const hora = d
        ? d.toDateString() === hoje
          ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
        : "—";
      const leituras: Leitura[] = [
        { label: "Velocidade", value: e.velocidade != null ? `${e.velocidade} km/h` : "—", forte: true },
        { label: "Motorista", value: e.motorista ?? "não identificado" },
      ];
      if (e.latitude != null && e.longitude != null) leituras.push({ label: "Coordenadas", value: `${e.latitude.toFixed(5)}, ${e.longitude.toFixed(5)}` });
      if (e.observacao) leituras.push({ label: "Observação", value: e.observacao });
      return {
        id: String(e.id),
        hora,
        motorista: e.motorista ?? "—",
        veiculo: e.prefixo ? `${e.prefixo} · ${e.placa}` : e.placa,
        tipo: e.alarme,
        icon: icone(e.alarme),
        // Clipe de vídeo por disparo não está ligado a este alarme no banco.
        video: false,
        gravidade: grav(e.nivel),
        visto: e.visualizado,
        velocidade: e.velocidade ?? 0,
        local: e.endereco ?? "endereço não informado",
        dur: "—",
        x: 0,
        y: 0,
        leituras,
        origem: "alarme",
      } as Evento;
    });
  }, [alarmesQ.data, filtros.data]);

  const eventosConducao = useMemo(() => {
    if (usandoMock() || !conducaoQ.data) return [];
    return conducaoQ.data.itens.map(
      (e): Evento => ({
        id: `c${e.id}`,
        hora: e.hora ? e.hora.slice(11, 16) : "—",
        motorista: e.condutor ?? "Não identificado",
        veiculo: e.placa,
        tipo: ROTULO_EVENTO[e.tipo] ?? e.evento ?? "Evento",
        icon: ICONE_CONDUCAO[e.tipo] ?? AlertTriangle,
        video: false,
        gravidade: GRAV_CONDUCAO[e.tipo] ?? "baixa",
        // Evento de condução não tem "visualizado" no banco; só os alarmes têm.
        visto: true,
        velocidade: null,
        local: e.cerca ? `${e.cerca} · ${e.endereco ?? ""}` : e.endereco ?? (e.latitude != null ? `${e.latitude.toFixed(5)}, ${e.longitude?.toFixed(5)}` : "local não informado"),
        dur: "—",
        x: 50,
        y: 50,
        leituras: [
          { label: "Evento registrado", value: e.evento ?? ROTULO_EVENTO[e.tipo], forte: true },
          { label: "Motorista", value: e.condutor ?? "não identificado" },
          ...(e.latitude != null ? [{ label: "Coordenadas", value: `${e.latitude.toFixed(5)}, ${e.longitude?.toFixed(5)}` }] : []),
        ],
        origem: "conducao",
      }),
    );
  }, [conducaoQ.data]);

  // Ligado à API, nunca o exemplo — nem quando a consulta falha.
  const base = useMemo(
    () => (usandoMock() ? EVENTOS : [...(eventosApi ?? []), ...eventosConducao].sort((a, b) => b.hora.localeCompare(a.hora))),
    [eventosApi, eventosConducao],
  );
  const veiculos = uniq(base.map((e) => e.veiculo));
  const motoristas = uniq(base.map((e) => e.motorista));

  const lista = useMemo(
    () =>
      base.filter(
        (e) =>
          (filtros.veiculo === "Todos" || e.veiculo === filtros.veiculo) &&
          (filtros.motorista === "Todos" || e.motorista === filtros.motorista) &&
          (gravFiltro === "todas" || e.gravidade === gravFiltro) &&
          (origem === "todas" || e.origem === origem),
      ),
    [base, filtros, gravFiltro, origem],
  );

  const naoVistos = lista.filter((e) => !e.visto && !vistos.has(e.id)).length;
  const criticos = lista.filter((e) => e.gravidade === "critica").length;
  const videos = lista.filter((e) => e.video).length;

  const marcarVisto = (id: string) => setVistos((s) => new Set(s).add(id));
  const abrir = (id: string) => {
    setAberto(id);
    marcarVisto(id);
  };
  const validar = (id: string, v: "correto" | "falso") => setValidacao((m) => ({ ...m, [id]: v }));

  const eventoAberto = base.find((e) => e.id === aberto) ?? null;

  return (
    <>
      <PageHeader
        title="Eventos de condução"
        subtitle="Segurança › Eventos de telemetria (CAN)"
        actions={
          <button
            onClick={() => setVistos(new Set(base.map((e) => e.id)))}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary"
          >
            <Check className="h-[15px] w-[15px]" />
            Marcar tudo como visto
          </button>
        }
      />

      <div className="mx-auto max-w-[1100px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Operação · Eventos"
          title="O dia da frota, em tempo real"
          subtitle="Tudo o que aconteceu hoje — condução, segurança e vídeo-telemetria. Clique num evento para ver o detalhe."
        >
          <div className="flex items-center gap-6">
            <HeroMetric value={String(criticos)} label="Eventos críticos" />
            <div className="h-10 w-px bg-white/15" />
            <HeroMetric value={String(naoVistos)} label="Não visualizados" />
          </div>
        </HeroBanner>

        {/* A sobreposição com Videotelemetria confundia. A separação é pela
            origem do dado, não pelo tipo de risco. */}
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
          <p className="text-[12.5px] text-muted-foreground">
            Esta tela mostra os <strong className="text-foreground">alarmes da telemetria</strong> (Monitor de Alarmes) —
            freada, curva, aceleração, excesso de velocidade — que existem em toda a frota, com ou sem câmera. O que a
            <strong className="text-foreground"> câmera</strong> detecta (distração, fadiga, celular, risco de colisão),
            junto da transmissão ao vivo e das gravações, está em{" "}
            <Link to="/app/seguranca/video" className="font-medium text-brand-navy underline">
              Videotelemetria
            </Link>
            .
          </p>
        </div>

        {usandoMock() ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile icon={Siren} label="Eventos hoje" value={String(lista.length)} color="var(--brand-navy)" />
            <StatTile icon={ShieldAlert} label="Críticos" value={String(criticos)} color="var(--coral)" />
            <StatTile icon={Video} label="Vídeo-telemetria" value={String(videos)} color="var(--brand-sky)" />
            <StatTile icon={Eye} label="Não visualizados" value={String(naoVistos)} color="var(--gold)" />
          </div>
        ) : (
          <>
            {/* Totais do dia pela consolidação diária, que chega antes do detalhe. */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile icon={Gauge} label="Excessos de velocidade" value={totDia ? totDia.velocidade.toLocaleString("pt-BR") : "—"} color="var(--brand-navy)" />
              <StatTile icon={Octagon} label="Freadas bruscas" value={totDia ? totDia.freada.toLocaleString("pt-BR") : "—"} color="var(--coral)" />
              <StatTile icon={Zap} label="Acelerações bruscas" value={totDia ? totDia.aceleracao.toLocaleString("pt-BR") : "—"} color="var(--gold)" />
              <StatTile icon={Siren} label="Alarmes disparados" value={String((eventosApi ?? []).length)} color="var(--brand-sky)" />
              <StatTile icon={Eye} label="Alarmes não vistos" value={String(naoVistos)} color="var(--gold)" />
            </div>
            {!totDia?.horas && !totaisQ.isPending && filtros.data >= iso(new Date()) && (
              <p className="rounded-xl border border-border bg-card px-4 py-2.5 text-[12.5px] text-muted-foreground">
                Os totais de condução de hoje são consolidados durante a madrugada; amanhã eles aparecem aqui.
              </p>
            )}
            {detalheNaoCarregado && (
              <div className="flex items-start gap-2.5 rounded-xl border border-gold-line bg-gold-tint px-4 py-3 text-[12.5px]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>
                  O detalhe dos eventos de condução deste dia (hora, placa e local de cada um) ainda não foi carregado — a
                  última carga vai até <b>{new Date(carga!).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</b>.
                  Os totais acima já são do dia. Os alarmes do Monitor aparecem na lista assim que disparam.
                </span>
              </div>
            )}
          </>
        )}

        <FleetFilters
          veiculos={veiculos}
          motoristas={motoristas}
          value={filtros}
          onChange={setFiltros}
          extra={
            <div className="flex flex-wrap items-center gap-1.5">
              {!usandoMock() && (
                <div className="mr-2 flex items-center gap-1 rounded-lg bg-secondary p-0.5">
                  {([["todas", "Tudo"], ["alarme", "Alarmes"], ["conducao", "Condução"]] as const).map(([v, r]) => (
                    <button
                      key={v}
                      onClick={() => setOrigem(v)}
                      className={cn("rounded-md px-2.5 py-1.5 text-[12.5px] font-medium", origem === v ? "bg-white shadow-sm" : "text-muted-foreground")}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
              {(["todas", "critica", "alta", "media", "baixa"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGravFiltro(g)}
                  className={cn(
                    "rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors",
                    gravFiltro === g ? "bg-brand-navy text-white" : "text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {g === "todas" ? "Todas" : GRAV[g].label}
                </button>
              ))}
            </div>
          }
        />

        {/* Feed. */}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
          {(alarmesQ.isPending || conducaoQ.isPending) && !usandoMock() ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Carregando os eventos do dia…</p>
          ) : lista.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {detalheNaoCarregado ? "Nenhum alarme neste dia e o detalhe da condução ainda não foi carregado." : "Nenhum evento com esses filtros."}
            </p>
          ) : (
            lista.slice(0, mostrar).map((e, i, arr) => (
              <EventoRow
                key={e.id}
                evento={e}
                last={i === arr.length - 1}
                visto={vistos.has(e.id)}
                validacao={validacao[e.id]}
                onOpen={() => abrir(e.id)}
              />
            ))
          )}
          {lista.length > mostrar && (
            <button onClick={() => setMostrar((m) => m + 300)} className="mt-2 w-full rounded-xl border border-border py-2 text-[13px] font-medium text-brand-navy hover:bg-secondary">
              Mostrar mais ({(lista.length - mostrar).toLocaleString("pt-BR")} restantes)
            </button>
          )}
        </div>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          {usandoMock()
            ? "Dados de exemplo — protótipo de interface, sem dados reais."
            : `Alarmes do Monitor e eventos de condução de ${new Date(filtros.data + "T12:00").toLocaleDateString("pt-BR")}, mais recentes primeiro.${(conducaoQ.data?.itens.length ?? 0) >= 5000 ? " Mostrando os 5.000 eventos de condução mais recentes — filtre por veículo para ver o restante." : ""} Análise completa em Gerencial › Gestão de eventos.`}
        </p>
      </div>

      {eventoAberto && (
        <EventoDrawer
          evento={eventoAberto}
          validacao={validacao[eventoAberto.id]}
          onValidar={(v) => validar(eventoAberto.id, v)}
          onClose={() => setAberto(null)}
          notificado={Boolean(notificados[eventoAberto.id])}
          onNotificar={() => setNotificados((n) => ({ ...n, [eventoAberto.id]: true }))}
          ocorrencia={ocorrencias[eventoAberto.id]}
          onGerarOcorrencia={(numero) => setOcorrencias((o) => ({ ...o, [eventoAberto.id]: numero }))}
        />
      )}
    </>
  );
}

/** Linha do feed: resumo clicável que abre o detalhe. */
function EventoRow({
  evento,
  last,
  visto,
  validacao,
  onOpen,
}: {
  evento: Evento;
  last: boolean;
  visto: boolean;
  validacao?: "correto" | "falso";
  onOpen: () => void;
}) {
  const t = tone(evento.gravidade);
  const accent = t === "coral" ? "border-l-coral" : t === "gold" ? "border-l-gold" : t === "sky" ? "border-l-brand-sky" : "border-l-border";

  return (
    <div className="flex gap-3 sm:gap-4">
      <div className="w-12 shrink-0 pt-4 text-right font-mono text-[12px] text-muted-foreground sm:w-14">{evento.hora}</div>
      <div className="flex flex-col items-center pt-4">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white", visto ? "bg-muted-foreground/40" : t === "coral" ? "bg-coral" : t === "gold" ? "bg-gold" : "bg-brand-sky")} />
        {!last && <span className="w-px flex-1 bg-border" />}
      </div>

      <button
        onClick={onOpen}
        className={cn(
          "group mb-3 flex flex-1 items-center gap-3 rounded-xl border border-l-[3px] border-border bg-white p-3.5 text-left transition-all hover:-translate-y-0.5 hover:shadow-card",
          accent,
          !visto && "ring-1 ring-brand-sky/15",
        )}
      >
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconBox(t))}>
          <evento.icon className="h-[18px] w-[18px]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-foreground">{evento.tipo}</span>
            {evento.video && (
              <span className="inline-flex items-center gap-1 rounded-full bg-navy-tint px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
                <Video className="h-3 w-3" />
                Vídeo
              </span>
            )}
            <Pill tone={t}>{GRAV[evento.gravidade].label}</Pill>
            {validacao && (
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", validacao === "correto" ? "bg-leaf-tint text-leaf" : "bg-secondary text-muted-foreground")}>
                {validacao === "correto" ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                {validacao === "correto" ? "Correto" : "Falso positivo"}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
            {evento.motorista} · <span className="font-mono">{evento.veiculo}</span> · {evento.local}
          </p>
        </div>

        {!visto && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-sky" />}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}

/** Painel de detalhe do evento — tudo dentro. */
function EventoDrawer({
  evento,
  validacao,
  onValidar,
  onClose,
  notificado,
  onNotificar,
  ocorrencia,
  onGerarOcorrencia,
}: {
  evento: Evento;
  validacao?: "correto" | "falso";
  onValidar: (v: "correto" | "falso") => void;
  onClose: () => void;
  /** Já foi enviado aviso ao motorista sobre este evento. */
  notificado: boolean;
  onNotificar: () => void;
  /** Número da ocorrência aberta, se houver. */
  ocorrencia?: string;
  onGerarOcorrencia: (numero: string) => void;
}) {
  const t = tone(evento.gravidade);
  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-[rgba(10,16,28,0.5)]" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col bg-canvas shadow-elegant">
        {/* Cabeçalho. */}
        <div className="flex items-start justify-between gap-3 border-b border-border bg-card px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", iconBox(t))}>
              <evento.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-foreground">{evento.tipo}</h2>
                <Pill tone={t}>{GRAV[evento.gravidade].label}</Pill>
              </div>
              <p className="text-[12.5px] text-muted-foreground">{evento.hora} · {evento.dur}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Vídeo. */}
          {evento.video && (
            <div>
              <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-[#122a52]">
                <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 50% 40%, #2651A6, transparent 70%)" }} />
                <button
                  onClick={() =>
                    toast.info("Reprodução de vídeo", {
                      description: `Clipe ${evento.dur} · CAM 1 frontal · aguardando o serviço de mídia.`,
                    })
                  }
                  aria-label="Reproduzir gravação do evento"
                  className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-brand-navy shadow-lg transition-transform hover:scale-105"
                >
                  <Play className="h-6 w-6" fill="currentColor" />
                </button>
                <span className="absolute bottom-2 left-3 font-mono text-[11px] text-white/70">Gravação · {evento.dur}</span>
                <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 font-mono text-[10px] text-white">CAM 1 · frontal</span>
              </div>

              {/* Validação da IA. */}
              <div className="mt-3 rounded-xl border border-border bg-card p-3.5">
                <p className="mb-2 text-[12.5px] text-ink-soft">
                  A IA classificou como <strong className="text-foreground">{evento.tipo.toLowerCase()}</strong>. A IA pode se enganar — confirme ou marque como falso positivo.
                </p>
                {validacao ? (
                  <div className="flex items-center justify-between">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold", validacao === "correto" ? "bg-leaf-tint text-leaf" : "bg-secondary text-muted-foreground")}>
                      {validacao === "correto" ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      {validacao === "correto" ? "Confirmado como correto" : "Marcado como falso positivo"}
                    </span>
                    <button onClick={() => onValidar(validacao === "correto" ? "falso" : "correto")} className="text-[12px] font-medium text-muted-foreground underline hover:text-foreground">
                      alterar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => onValidar("correto")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-green px-3.5 py-2 text-[13px] font-semibold text-[oklch(0.15_0.03_260)] transition-transform hover:-translate-y-0.5">
                      <Check className="h-4 w-4" />
                      Correto
                    </button>
                    <button onClick={() => onValidar("falso")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-secondary">
                      <X className="h-4 w-4" />
                      Falso positivo
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quem e onde. */}
          <div className="grid grid-cols-2 gap-3">
            <InfoBox icon={User} label="Motorista" value={evento.motorista} />
            <InfoBox icon={Truck} label="Veículo" value={evento.veiculo} mono />
            <InfoBox icon={Navigation} label="Velocidade" value={evento.velocidade == null ? "—" : `${evento.velocidade} km/h`} />
            <InfoBox icon={Clock} label="Duração" value={evento.dur} />
          </div>

          {/* Telemetria do momento. */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" />
              Telemetria no momento
            </p>
            <div className="space-y-2">
              {evento.leituras.map((l) => (
                <div key={l.label} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                  <span className="text-[13px] text-muted-foreground">{l.label}</span>
                  <span className={cn("font-mono text-[13px]", l.forte ? "font-bold text-foreground" : "text-ink-soft")}>{l.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Localização. */}
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[13px] text-ink-soft">
              <MapPin className="h-4 w-4 text-brand-navy" />
              {evento.local}
            </div>
            <div className="relative h-40 w-full" style={{ background: "radial-gradient(circle at 55% 45%, #EAF3EC 0%, #E3EDF3 50%, #DCE6EC 100%)" }}>
              <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                <path d="M-20 90 Q 160 60 340 120 T 700 140" fill="none" stroke="white" strokeWidth="5" opacity="0.7" />
                <path d="M-20 200 Q 200 240 380 180 T 720 220" fill="none" stroke="white" strokeWidth="5" opacity="0.7" />
              </svg>
              <div style={{ left: `${evento.x}%`, top: `${evento.y}%` }} className="absolute -translate-x-1/2 -translate-y-full">
                <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-white px-2.5 py-1 text-[11px] font-semibold shadow-card">
                  <span className={cn("h-2 w-2 rounded-full", t === "coral" ? "bg-coral" : t === "gold" ? "bg-gold" : "bg-brand-sky")} />
                  {evento.veiculo}
                </div>
                <div className="mx-auto h-2.5 w-2.5 -translate-y-1 rotate-45 border-b border-r border-border bg-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Ações. */}
        <div className="flex items-center gap-2 border-t border-border bg-card px-5 py-3">
          <button
            onClick={() => {
              onNotificar();
              toast.success(`Motorista ${evento.motorista} notificado.`, {
                description: `Evento: ${evento.tipo} · ${evento.veiculo}`,
              });
            }}
            disabled={notificado}
            className="flex-1 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {notificado ? "Motorista notificado" : "Notificar motorista"}
          </button>
          <button
            onClick={() => {
              const numero = `OC-${String(Date.now()).slice(-6)}`;
              onGerarOcorrencia(numero);
              toast.success(`Ocorrência ${numero} aberta.`, {
                description: `${evento.tipo} · ${evento.veiculo} · ${evento.motorista}`,
              });
            }}
            className="flex-1 rounded-full bg-brand-navy px-4 py-2 text-[13px] font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            {ocorrencia ? `Ocorrência ${ocorrencia}` : "Gerar ocorrência"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function InfoBox({ icon: Icon, label, value, mono }: { icon: LucideIcon; label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className={cn("mt-1 text-[14px] font-semibold text-foreground", mono && "font-mono")}>{value}</p>
    </div>
  );
}
