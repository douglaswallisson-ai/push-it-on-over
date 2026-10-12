import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCheck,
  Columns2,
  ExternalLink,
  Eye,
  Fuel,
  Gauge,
  Grid2x2,
  ListFilter,
  Loader2,
  Maximize,
  Minimize,
  Mountain,
  Search,
  Square,
  Thermometer,
  User,
  Wifi,
  WifiOff,
  Wrench,
  X,
  Plus,
  Crosshair,
  Expand,
  MonitorUp,
  MapPinned,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { SSOrb } from "@/components/ss/brand/SSOrb";
import { NOME_TIPO, svgVeiculo } from "@/components/ss/mapa/iconesVeiculo";
import {
  AREAS,
  avancar,
  avisosExemplo,
  CATALOGO,
  COR_HEX,
  corDoCarro,
  frotaExemplo,
  LIMITE_SEM_COMUNICACAO_MS,
  ROTULO_COR,
  ROTULO_FONTE,
  type Aviso,
  type VeiculoCCO,
} from "@/lib/cco";
import {
  CCO,
  consumoQuery,
  posicaoQuery,
  turnoQuery,
  painelCCOQuery,
  contornoQuery,
  type ContornoCidade,
  type AvisoPainel,
  type CorCarro,
  type FonteAviso,
  type VeiculoPainel,
} from "@/lib/cco-api";
import { lerEmbutido } from "@/lib/embutido";
import { areasRiscoQuery, type AreaRisco } from "@/lib/rotas-seguras-api";
import { PlayerAoVivo } from "@/components/ss/video/PlayerAoVivo";
import { Cameras, type Transmissao } from "@/lib/cameras-api";
import { empresasQuery } from "@/lib/queries";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { usandoMock } from "@/lib/modo";
import { lerSessao, registrarAuditoria } from "@/lib/session";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Painel CCO — a operação em tempo real numa tela própria (aberta em outra aba
 * para o segundo monitor ou o telão). Especificação combinada com o PM em
 * 06/10/2026 (ver lib/cco.ts e ss-fleet-core endpoints/cco.py):
 * - até 4 mapas, cada um com o seu zoom e a SUA seleção de veículos (urbano
 *   concentrado: cada mapa mostra só as placas escolhidas) e os avisos podem
 *   ser vistos por mapa;
 * - a última visualização (layout, áreas, seleções, empresa, janela e filtros)
 *   fica salva no navegador, por usuário, e volta ao abrir;
 * - carro desenhado pelo tipo (caminhão, ônibus, van…) na cor da situação, sem piscar;
 * - wifi vermelho só sem comunicação há mais de 2 h;
 * - avisos sem som, agrupados por veículo e tipo, saem só com Visto ou Tratado;
 * - o card abre o sistema em OUTRA aba (rel="opener" leva o login, que fica no
 *   sessionStorage). Embutido em outro sistema (iframe) a aba nova não teria o
 *   login — o armazenamento do iframe é separado —, então abre por cima do painel.
 * Em modo de demonstração usa os dados de exemplo de lib/cco.ts.
 */

type Layout = 1 | 2 | 4;
type Vista = { centro: [number, number]; zoom: number; area: string };
type Estado = {
  layout: Layout;
  vistas: Vista[];
  /** Seleção de veículos de cada mapa, por empresa ("" = todas). Lista vazia = todos. */
  selecoes: Record<string, string[][]>;
  grupo?: string;
  fonte: "" | FonteAviso;
  abaAvisos: number;
  /** Mapas fechados pelo operador (tela cinza com + para reabrir). */
  fechados?: boolean[];
  /** Aba de avisos aberta (retrátil). */
  painelAvisos: boolean;
  /** Pintar o carro pelo alerta. Desligado = mapa só com a situação (andando/parado), sem poluir. */
  alertasNoMapa: boolean;
  /** Cidade escolhida (urbano é por cidade — PM, 10/10/2026). Vazio = todas. */
  cidade?: string;
  /** O que cada quadro mostra: mapa ou os grandes números. */
  tipos?: TipoQuadro[];
  /** Com cidade escolhida: só a cidade no mapa, o resto escurecido (PM, 12/10/2026). */
  soCidade?: boolean;
  /** Visual de telão: mapa escuro, veículos em destaque. */
  escuro?: boolean;
  /** Janela aberta para uma TV ("Espalhar nas TVs"): área a enquadrar ao abrir. */
  caixaInicial?: [number, number, number, number] | null;
  janelaTV?: boolean;
};
type TipoQuadro = "mapa" | "numeros";
/** O CCO é ao vivo: avisos das últimas 2 h ainda não tratados, sem seletor de janela. */
const JANELA_AO_VIVO_H = 2;
const VAZIO: string[][] = [[], [], [], []];

/** Visualização desta aba do navegador (cada monitor com a sua empresa). */
const CHAVE_ABA = "ss:cco:aba";

function chaveEstado() {
  const s = lerSessao();
  return `ss:cco:v2:${s?.email || s?.nome || "anon"}`;
}

function lerEstado(): Estado {
  const padrao: Estado = {
    layout: 1,
    vistas: [AREAS[0], AREAS[1], AREAS[5], AREAS[4]].map((a) => ({
      centro: a.centro,
      zoom: a.zoom,
      area: a.id,
    })),
    selecoes: {},
    // Abre na empresa escolhida na plataforma, nunca na base inteira da SS.
    grupo: grupoAtivo(),
    fonte: "",
    abaAvisos: -1,
    fechados: [false, false, false, false],
    painelAvisos: true,
    alertasNoMapa: false,
    cidade: "",
    tipos: ["mapa", "mapa", "mapa", "mapa"],
  };
  try {
    // Janela aberta para uma TV: o quadro vem no endereço (empresa, cidade, área, seleção).
    const q = new URLSearchParams(window.location.search).get("quadro");
    if (q) {
      const d = JSON.parse(q);
      const g = typeof d.g === "string" && d.g ? d.g : padrao.grupo;
      return {
        ...padrao,
        layout: 1,
        grupo: g,
        cidade: d.c ?? "",
        selecoes: Array.isArray(d.s) ? { [g ?? ""]: [d.s.map(String), [], [], []] } : {},
        tipos: [d.t === "numeros" ? "numeros" : "mapa", "mapa", "mapa", "mapa"],
        alertasNoMapa: Boolean(d.a),
        escuro: Boolean(d.e),
        soCidade: d.o !== false,
        painelAvisos: false,
        caixaInicial: Array.isArray(d.b) && d.b.length === 4 ? d.b : null,
        janelaTV: true,
      };
    }
    const daAba = JSON.parse(sessionStorage.getItem(CHAVE_ABA) ?? "null");
    if (daAba && [1, 2, 4].includes(daAba.layout) && daAba.vistas?.length === 4)
      return { ...padrao, ...daAba };
    const v = JSON.parse(localStorage.getItem(chaveEstado()) ?? "null");
    if (v && [1, 2, 4].includes(v.layout) && Array.isArray(v.vistas) && v.vistas.length === 4)
      return { ...padrao, ...v, grupo: padrao.grupo, cidade: "" };
    // Layout salvo pela versão anterior.
    const antigo = JSON.parse(localStorage.getItem("ss:cco:layout") ?? "null");
    if (antigo?.vistas?.length === 4)
      return { ...padrao, layout: antigo.layout, vistas: antigo.vistas };
  } catch {
    /* navegador sem armazenamento */
  }
  return padrao;
}

/**
 * Só o desenho do veículo, sem a placa ao lado (PM, 10/10/2026); a placa aparece ao passar o mouse.
 * Alerta crítico em aberto pisca em vermelho, mesmo com "Marcar alertas no mapa" desligado (PM, 10/10/2026).
 */
function icone(v: VeiculoPainel, selecionado: boolean, critico: boolean) {
  const hex = critico ? COR_HEX.vermelho : COR_HEX[v.cor];
  const d = selecionado ? 34 : 28;
  return L.divIcon({
    className: "",
    html: `<span class="${critico ? "cco-pisca" : ""}" style="display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%);width:${d}px;height:${d}px;border-radius:50%;background:${hex};color:#fff;border:2px solid #fff;box-shadow:0 1px 5px rgba(15,25,40,.45)${selecionado ? ",0 0 0 4px rgba(46,134,193,.5)" : ""};${v.comunicando ? "" : "opacity:.55;"}">${svgVeiculo(v.tipo, selecionado ? 19 : 16)}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/** Piscar do alerta crítico: anel vermelho que se expande (não some o carro do mapa). */
const CSS_PISCA = `@keyframes cco-pisca{0%{box-shadow:0 0 0 0 rgba(216,74,58,.95),0 1px 5px rgba(15,25,40,.45)}70%{box-shadow:0 0 0 14px rgba(216,74,58,0),0 1px 5px rgba(15,25,40,.45)}100%{box-shadow:0 0 0 0 rgba(216,74,58,0),0 1px 5px rgba(15,25,40,.45)}}
.cco-pisca{animation:cco-pisca 1.1s ease-out infinite}
@media (prefers-reduced-motion: reduce){.cco-pisca{animation-duration:2.5s}}`;

/** Telão escuro: o mapa de ruas invertido (fundo escuro, ruas claras); os ícones dos veículos não mudam. */
const CSS_ESCURO = `.cco-escuro .leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(1.08) contrast(1.08) saturate(.45)}
.cco-escuro .leaflet-container{background:#0b0f14}`;

const ESCALA: Record<CorCarro, number> = { vermelho: 3000, amarelo: 2000, verde: 1000, cinza: 0 };

// ----------------------------------------------------- dados de exemplo (demonstração)

function exemploParaPainel(
  frota: VeiculoCCO[],
  avisos: Aviso[],
  agora: number,
): { veiculos: VeiculoPainel[]; avisos: AvisoPainel[] } {
  const abertos = avisos.filter((a) => a.situacao === "aberto");
  return {
    veiculos: frota.map((v, i) => ({
      id: v.id,
      placa: v.placa,
      prefixo: v.prefixo,
      empresa: v.empresa,
      tipo: v.empresa.includes("Viação") ? "onibus" : i % 9 === 0 ? "van" : "caminhao",
      lat: v.lat,
      lng: v.lng,
      ignicao: v.ignicao,
      velocidade: v.velocidade,
      rpm: v.rpm,
      faixa: v.faixa,
      altitude: v.altitude,
      temperatura: v.temperatura,
      combustivel: v.combustivelPct,
      motorista: v.motorista,
      ultima_comunicacao: new Date(v.ultimaComunicacao).toISOString(),
      comunicando: agora - v.ultimaComunicacao <= LIMITE_SEM_COMUNICACAO_MS,
      tem_camera: v.temCamera,
      cor: corDoCarro(v, abertos),
    })),
    avisos: abertos.map((a) => ({
      id: a.id,
      unit_id: a.veiculoId,
      nome: CATALOGO[a.tipo].nome,
      fonte: CATALOGO[a.tipo].fonte,
      gravidade: CATALOGO[a.tipo].gravidade,
      quantidade: 1,
      ultimo: new Date(a.em).toISOString(),
      detalhe: a.detalhe,
    })),
  };
}

function useExemplo(ativo: boolean) {
  const [frota, setFrota] = useState<VeiculoCCO[]>(() => frotaExemplo());
  const [avisos, setAvisos] = useState<Aviso[]>(() => avisosExemplo(frotaExemplo()));
  const [agora, setAgora] = useState(() => Date.now());
  const n = useRef(0);
  useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => {
      const ag = Date.now();
      n.current += 1;
      setAgora(ag);
      setFrota((f) => {
        const r = avancar(f, ag, n.current);
        if (r.novo) setAvisos((a) => [r.novo!, ...a]);
        return r.frota;
      });
    }, 30_000);
    return () => clearInterval(t);
  }, [ativo]);
  const dados = useMemo(() => exemploParaPainel(frota, avisos, agora), [frota, avisos, agora]);
  const marcar = (id: string, situacao: "visto" | "tratado") =>
    setAvisos((l) => l.map((a) => (a.id === id ? { ...a, situacao } : a)));
  const consumo = (id: string | number) => frota.find((v) => v.id === id)?.consumoLh ?? null;
  return { dados, marcar, consumo };
}

// ------------------------------------------------------------------ painel

export default function PainelCCO() {
  const qc = useQueryClient();
  const mock = usandoMock();
  const sessao = lerSessao();
  const ehSS = sessao?.perfil === "super_admin";
  const embutido = Boolean(lerEmbutido());
  const [est, setEst] = useState<Estado>(lerEstado);
  const { layout, vistas, fonte, abaAvisos } = est;
  const grupo = ehSS ? est.grupo : grupoAtivo();
  const chaveGrupo = grupo ?? "";
  const selecoes = est.selecoes[chaveGrupo] ?? VAZIO;
  const q = useQuery(painelCCOQuery(grupo, JANELA_AO_VIVO_H));
  const ex = useExemplo(mock);
  const [selId, setSelId] = useState<string | number | null>(null);
  const [foco, setFoco] = useState<{ id: string | number; n: number; mapa: number } | null>(null);
  const contem = useRef<((lat: number, lng: number) => boolean)[]>([]);
  const [cheia, setCheia] = useState(false);
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const empresasQ = useQuery({ ...empresasQuery(), enabled: ehSS && !mock });
  // Áreas de risco do cliente desenhadas nos mapas (só com uma empresa escolhida).
  const areasQ = useQuery(areasRiscoQuery(grupo));
  const areasRisco = areasQ.data?.data ?? [];
  const empresas = empresasQ.data ?? [];
  const [relogio, setRelogio] = useState(() => Date.now());
  const [sobreposicao, setSobreposicao] = useState<{ titulo: string; url: string } | null>(null);

  const mudar = (p: Partial<Estado>) => setEst((e) => ({ ...e, ...p }));
  const setSelecao = (i: number, ids: string[]) =>
    setEst((e) => {
      const atual = [...(e.selecoes[chaveGrupo] ?? VAZIO)];
      atual[i] = ids;
      return { ...e, selecoes: { ...e.selecoes, [chaveGrupo]: atual } };
    });

  // Salva a última visualização (por usuário) a cada mudança.
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE_ABA, JSON.stringify(est));
      // Janela de TV não troca a visualização salva da tela principal.
      if (!est.janelaTV) localStorage.setItem(chaveEstado(), JSON.stringify(est));
    } catch {
      /* sem armazenamento */
    }
  }, [est]);

  const dados = mock ? ex.dados : q.data;
  // Seguir veículo: o mapa mostra só ele e vai atrás, com a posição a cada 10 s.
  const [seguindo, setSeguindo] = useState<{ id: string; mapa: number; rotulo: string } | null>(
    null,
  );
  const posQ = useQuery(posicaoQuery(seguindo ? Number(seguindo.id) || seguindo.id : null));
  const veiculos = useMemo(() => {
    const base = dados?.veiculos ?? [];
    const p = posQ.data;
    if (!seguindo || !p || p.lat == null || p.lng == null) return base;
    return base.map((v) =>
      String(v.id) === seguindo.id
        ? {
            ...v,
            lat: p.lat!,
            lng: p.lng!,
            velocidade: p.velocidade ?? v.velocidade,
            ignicao: p.ignicao ?? v.ignicao,
          }
        : v,
    );
  }, [dados, posQ.data, seguindo]);
  const avisos = useMemo(
    () => (dados?.avisos ?? []).filter((a) => !ocultos.has(a.id)),
    [dados, ocultos],
  );
  // Cidades da frota (do endereço do rastreador), da que tem mais veículos para a que tem menos.
  const cidades = useMemo(() => {
    const n = new Map<string, number>();
    for (const v of veiculos) if (v.cidade) n.set(v.cidade, (n.get(v.cidade) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  }, [veiculos]);
  const cidade = est.cidade && cidades.some(([c]) => c === est.cidade) ? est.cidade : "";
  const naCidade = useMemo(
    () => (cidade ? veiculos.filter((v) => v.cidade === cidade) : veiculos),
    [veiculos, cidade],
  );
  // Só a cidade: contorno oficial (IBGE) da cidade escolhida; o estado vem do endereço do rastreador.
  const ufCidade = cidade ? (naCidade.find((v) => v.uf)?.uf ?? null) : null;
  const contornoQ = useQuery(contornoQuery(cidade, ufCidade));
  const contorno = cidade && est.soCidade !== false ? (contornoQ.data ?? null) : null;
  useEffect(() => {
    if (contorno) setSinalEnquadrar((n) => n + 1);
  }, [contorno?.ibge_id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Área na tela de cada mapa, para abrir o mesmo enquadramento numa janela/TV.
  const limites = useRef<(() => L.LatLngBounds | null)[]>([]);
  const criticosIds = useMemo(
    () => new Set(avisos.filter((a) => a.gravidade === "critico").map((a) => String(a.unit_id))),
    [avisos],
  );
  // Enquadrar os mapas na frota: ao trocar de empresa ou de cidade (e ao abrir, se o mapa ainda
  // está numa área pronta como "Brasil"). A Fênix abria no Brasil inteiro (PM, 10/10/2026).
  const [sinalEnquadrar, setSinalEnquadrar] = useState(0);
  const enquadradoPara = useRef<string | null>(null);
  useEffect(() => {
    if (!naCidade.length) return;
    const k = `${chaveGrupo}|${cidade}`;
    if (enquadradoPara.current === k) return;
    const primeira = enquadradoPara.current === null;
    enquadradoPara.current = k;
    if (primeira && vistas.every((v) => v.area === "livre")) return; // o operador já enquadrou
    setSinalEnquadrar((n) => n + 1);
  }, [chaveGrupo, cidade, naCidade.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => setOcultos(new Set()), [q.dataUpdatedAt]);
  useEffect(() => {
    const t = setInterval(() => setRelogio(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const f = () => setCheia(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  // A cor vem do servidor, mas um aviso marcado agora já tira a cor do carro.
  const alertasNoMapa = est.alertasNoMapa;
  const comCor = useMemo(() => {
    const porUnidade = new Map<string, AvisoPainel[]>();
    for (const a of avisos)
      porUnidade.set(String(a.unit_id), [...(porUnidade.get(String(a.unit_id)) ?? []), a]);
    return naCidade.map((v) => {
      const meus = porUnidade.get(String(v.id)) ?? [];
      const cor: CorCarro = !alertasNoMapa
        ? v.ignicao && v.velocidade > 3
          ? "verde"
          : "cinza"
        : meus.some((a) => a.gravidade === "critico")
          ? "vermelho"
          : meus.length
            ? "amarelo"
            : v.ignicao && v.velocidade > 3
              ? "verde"
              : "cinza";
      return { ...v, cor };
    });
  }, [naCidade, avisos, alertasNoMapa]);

  // Veículos de cada mapa (seleção vazia = todos). Seleção com placa que saiu da frota é ignorada.
  const doMapa = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => {
        const s = new Set(selecoes[i] ?? []);
        return s.size ? comCor.filter((v) => s.has(String(v.id))) : comCor;
      }),
    [comCor, selecoes],
  );
  // Clique num contador do topo filtra os mapas por aquela situação (os contadores seguem com o total).
  const [filtroSituacao, setFiltroSituacao] = useState<CorCarro | "sem_sinal" | null>(null);
  const naSituacao = (v: VeiculoPainel, f: CorCarro | "sem_sinal") =>
    f === "sem_sinal" ? !v.comunicando : v.cor === f;
  const doMapaFiltrado = useMemo(
    () =>
      filtroSituacao ? doMapa.map((l) => l.filter((v) => naSituacao(v, filtroSituacao))) : doMapa,
    [doMapa, filtroSituacao],
  );
  const fechados = est.fechados ?? [false, false, false, false];
  // Com cidade escolhida e 2 ou 4 mapas, cada mapa enquadra uma região da cidade (faixas de norte a
  // sul ou de oeste a leste, pelo lado mais comprido), para chegar perto das ruas (PM, 11/10/2026).
  const regioes = useMemo(() => {
    const abertos = Array.from({ length: layout }, (_, i) => i).filter(
      (i) => !fechados[i] && (est.tipos?.[i] ?? "mapa") === "mapa",
    );
    if (!cidade || abertos.length < 2 || !comCor.length) return null;
    const lats = comCor.map((v) => v.lat);
    const lngs = comCor.map((v) => v.lng);
    const altura = Math.max(...lats) - Math.min(...lats);
    const largura = (Math.max(...lngs) - Math.min(...lngs)) * Math.cos((lats[0] * Math.PI) / 180);
    // Faixas pelos LUGARES com carro (quadrados de ~1 km), não pela quantidade de carros: a garagem
    // concentra metade da frota num ponto só; e faixas de tamanho igual caíam em mata sem ônibus.
    const nortesul = altura >= largura;
    const eixo = (v: VeiculoPainel) => (nortesul ? -v.lat : v.lng);
    const lugares = [
      ...new Map(
        comCor.map((v) => [`${Math.round(v.lat * 100)}|${Math.round(v.lng * 100)}`, eixo(v)]),
      ).values(),
    ].sort((a, b) => a - b);
    const cortes = abertos
      .slice(1)
      .map((_, n) => lugares[Math.floor(((n + 1) * lugares.length) / abertos.length)]);
    const out: (VeiculoPainel[] | null)[] = [null, null, null, null];
    abertos.forEach((m, n) => {
      const a = n === 0 ? -Infinity : cortes[n - 1];
      const b = n === abertos.length - 1 ? Infinity : cortes[n];
      const faixa = comCor.filter((v) => eixo(v) >= a && eixo(v) < b);
      out[m] = faixa.length ? faixa : null;
    });
    return out;
  }, [cidade, layout, comCor, fechados.join(), (est.tipos ?? []).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const chaveRegioes = regioes ? `${layout}|${regioes.map((r) => r?.length ?? 0).join()}` : "";
  useEffect(() => {
    if (chaveRegioes) setSinalEnquadrar((n) => n + 1);
  }, [chaveRegioes.split("|")[0], Boolean(chaveRegioes)]); // eslint-disable-line react-hooks/exhaustive-deps
  const tipos: TipoQuadro[] = est.tipos ?? ["mapa", "mapa", "mapa", "mapa"];
  const setTipo = (i: number, t: TipoQuadro) =>
    mudar({
      tipos: tipos.map((x, j) => (j === i ? t : x)),
      fechados: fechados.map((x, j) => (j === i ? false : x)),
    });
  const fecharMapa = (i: number, f: boolean) => {
    if (f) contem.current[i] = () => false;
    mudar({ fechados: fechados.map((x, j) => (j === i ? f : x)) });
  };
  const idsVisiveis = useMemo(() => {
    const s = new Set<string>();
    const abas =
      abaAvisos >= 0 && abaAvisos < layout
        ? [abaAvisos]
        : Array.from({ length: layout }, (_, i) => i);
    // Mapa fechado não mostra carro nem traz aviso.
    for (const i of abas) if (!fechados[i]) for (const v of doMapa[i]) s.add(String(v.id));
    return s;
  }, [doMapa, layout, abaAvisos, fechados.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const visiveis = comCor.filter((v) => idsVisiveis.has(String(v.id)));
  const avisosVisiveis = avisos.filter((a) => idsVisiveis.has(String(a.unit_id)));

  const contagem = (c: CorCarro) => visiveis.filter((v) => v.cor === c).length;
  const semSinal = visiveis.filter((v) => !v.comunicando).length;
  const sel = comCor.find((v) => String(v.id) === String(selId)) ?? null;
  const lista = avisosVisiveis
    .filter((a) => !fonte || a.fonte === fonte)
    .sort((a, b) =>
      a.gravidade === b.gravidade
        ? String(b.ultimo).localeCompare(String(a.ultimo))
        : a.gravidade === "critico"
          ? -1
          : 1,
    );

  const marcar = async (a: AvisoPainel, situacao: "visto" | "tratado") => {
    setOcultos((s) => new Set(s).add(a.id));
    if (mock) return ex.marcar(a.id, situacao);
    try {
      await CCO.marcar(a, situacao);
      await qc.invalidateQueries({ queryKey: ["cco"] });
    } catch (e) {
      setOcultos((s) => {
        const n = new Set(s);
        n.delete(a.id);
        return n;
      });
      toast.error(mensagemErro(e));
    }
  };

  const focar = (id: string | number) => {
    setSelId(id);
    const v = comCor.find((x) => String(x.id) === String(id));
    const noMapa = (i: number) => doMapa[i].some((x) => String(x.id) === String(id));
    const mapas = Array.from({ length: layout }, (_, i) => i).filter(noMapa);
    const mapa = v ? (mapas.find((i) => contem.current[i]?.(v.lat, v.lng)) ?? mapas[0]) : undefined;
    setFoco((f) => ({ id, n: (f?.n ?? 0) + 1, mapa: mapa ?? 0 }));
  };

  // Busca por placa no topo: o carro escolhido vira o filtro do primeiro mapa aberto e é centralizado.
  const [busca, setBusca] = useState("");
  const [filtrado, setFiltrado] = useState<{ id: string; mapa: number; rotulo: string } | null>(
    null,
  );
  const rotuloBusca = (v: VeiculoPainel) =>
    v.placa && v.placa !== v.prefixo ? `${v.prefixo} · ${v.placa}` : String(v.prefixo);
  const buscar = (texto: string) => {
    setBusca(texto);
    const t = texto.trim().toLowerCase();
    const v = t ? comCor.find((x) => rotuloBusca(x).toLowerCase() === t) : undefined;
    if (!v) return;
    const mapa = Array.from({ length: layout }, (_, i) => i).find((i) => !fechados[i]) ?? 0;
    if (filtrado && filtrado.mapa !== mapa) setSelecao(filtrado.mapa, []);
    setSelecao(mapa, [String(v.id)]);
    setFiltrado({ id: String(v.id), mapa, rotulo: rotuloBusca(v) });
    setSelId(v.id);
    setFoco((f) => ({ id: v.id, n: (f?.n ?? 0) + 1, mapa }));
    setBusca("");
  };
  const seguir = (v: VeiculoPainel) => {
    const mapa =
      filtrado?.mapa ?? Array.from({ length: layout }, (_, i) => i).find((i) => !fechados[i]) ?? 0;
    if (filtrado && filtrado.mapa !== mapa) setSelecao(filtrado.mapa, []);
    setFiltrado(null);
    setSelecao(mapa, [String(v.id)]);
    setSeguindo({ id: String(v.id), mapa, rotulo: rotuloBusca(v) });
  };
  const pararDeSeguir = () => {
    if (seguindo) setSelecao(seguindo.mapa, []);
    setSeguindo(null);
  };
  const limparBusca = () => {
    if (filtrado) setSelecao(filtrado.mapa, []);
    setFiltrado(null);
    setSelId(null);
  };

  // Painel lateral: avisos em aberto ou ocorrências do turno.
  const [abaLateral, setAbaLateral] = useState<"avisos" | "turno">("avisos");
  // Faixa de críticos: os mais recentes, um de cada vez, trocando a cada 6 s.
  const criticos = useMemo(
    () =>
      avisosVisiveis
        .filter((a) => a.gravidade === "critico" && a.ultimo)
        .sort((a, b) => String(b.ultimo).localeCompare(String(a.ultimo)))
        .slice(0, 10),
    [avisosVisiveis],
  );
  const [iCritico, setICritico] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setICritico((i) => i + 1), 6000);
    return () => clearInterval(t);
  }, []);
  const critico = criticos.length ? criticos[iCritico % criticos.length] : null;
  // Câmera do último aviso crítico de câmera (fadiga, celular…), com vídeo ao vivo.
  const [cameraDispensada, setCameraDispensada] = useState<string | null>(null);
  const avisoCamera = useMemo(
    () =>
      avisosVisiveis
        .filter((a) => a.fonte === "camera" && a.gravidade === "critico" && a.ultimo)
        .filter((a) => comCor.find((v) => String(v.id) === String(a.unit_id))?.tem_camera)
        .sort((a, b) => String(b.ultimo).localeCompare(String(a.ultimo)))[0] ?? null,
    [avisosVisiveis, comCor],
  );
  const camera =
    avisoCamera && avisoCamera.id + avisoCamera.ultimo !== cameraDispensada ? avisoCamera : null;

  const abrir = (titulo: string, url: string) =>
    embutido ? setSobreposicao({ titulo, url }) : undefined;

  /** Endereço de um quadro para abrir noutra janela: mesma empresa, cidade, área, seleção e visual. */
  const urlQuadro = (i: number) => {
    const b = limites.current[i]?.();
    const sel = selecoes[i] ?? [];
    const d = {
      g: grupo,
      c: cidade || undefined,
      s: sel.length && sel.length <= 300 ? sel : undefined,
      t: tipos[i],
      a: alertasNoMapa || undefined,
      e: est.escuro || undefined,
      o: est.soCidade === false ? false : undefined,
      b:
        tipos[i] === "mapa" && b
          ? [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()].map((x) => Number(x.toFixed(5)))
          : undefined,
    };
    return `/cco?quadro=${encodeURIComponent(JSON.stringify(d))}`;
  };
  const abrirQuadro = (i: number, lugar?: string) => {
    const w = window.open(urlQuadro(i), `cco-tv-${i}`, lugar ?? "popup,width=1280,height=760");
    if (!w)
      toast.error(
        "O navegador bloqueou a janela. Libere os pop-ups deste endereço (ícone na barra de endereço).",
      );
    return w;
  };
  /**
   * Uma janela por quadro aberto. No Chrome/Edge, com a permissão "Gerenciamento de janelas", cada janela já
   * abre numa TV (as telas que não são a principal); sem ela, abrem em cascata para arrastar até cada TV.
   * Em cada janela, um clique em "Tela cheia nesta TV" (o navegador exige o clique na própria janela).
   */
  const espalharNasTVs = async () => {
    const quadros = Array.from({ length: layout }, (_, i) => i).filter((i) => !fechados[i]);
    type Tela = {
      availLeft: number;
      availTop: number;
      availWidth: number;
      availHeight: number;
      isPrimary: boolean;
    };
    let telas: Tela[] = [];
    const w = window as unknown as { getScreenDetails?: () => Promise<{ screens: Tela[] }> };
    if (w.getScreenDetails) {
      try {
        telas = (await w.getScreenDetails()).screens;
      } catch {
        /* sem permissão: cascata */
      }
    }
    const tvs = telas.length > 1 ? telas.filter((t) => !t.isPrimary) : [];
    quadros.forEach((i, k) => {
      const t = tvs.length ? tvs[k % tvs.length] : null;
      abrirQuadro(
        i,
        t
          ? `popup,left=${t.availLeft},top=${t.availTop},width=${t.availWidth},height=${t.availHeight}`
          : `popup,left=${60 + k * 50},top=${60 + k * 50},width=1280,height=760`,
      );
    });
    toast.success(
      tvs.length
        ? `${quadros.length} janela(s) abertas nas TVs. Em cada uma, clique em "Tela cheia nesta TV".`
        : `${quadros.length} janela(s) abertas. Arraste cada uma para uma TV e clique em "Tela cheia nesta TV".`,
    );
  };

  const telaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  const setVista = (i: number, v: Vista) =>
    setEst((e) => ({ ...e, vistas: e.vistas.map((x, k) => (k === i ? v : x)) }));

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <style>{CSS_PISCA + CSS_ESCURO}</style>
      {est.janelaTV && !cheia && (
        <button
          type="button"
          onClick={telaCheia}
          className="fixed left-1/2 top-14 z-[1600] -translate-x-1/2 rounded-full bg-brand-navy px-5 py-2.5 text-[15px] font-semibold text-white shadow-2xl"
        >
          <Maximize className="mr-2 inline h-4 w-4" /> Tela cheia nesta TV
        </button>
      )}
      <header className="flex h-11 shrink-0 items-center gap-3 overflow-x-auto whitespace-nowrap border-b border-border bg-card px-3 text-[12px]">
        <SSOrb size={20} />
        <span className="text-[14px] font-semibold text-foreground">Painel CCO</span>
        {mock && (
          <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[11px] font-semibold text-foreground">
            exemplo
          </span>
        )}
        {ehSS && !mock && (
          <select
            id="cco-empresa"
            value={grupo ?? ""}
            aria-label="Empresa"
            onChange={(e) => {
              mudar({ grupo: e.target.value || undefined, cidade: "" });
              setSelId(null);
            }}
            className="h-7 max-w-[240px] rounded-md border border-border bg-white px-2 text-[12px]"
          >
            <option value="">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        )}
        {cidades.length > 0 && (
          <select
            id="cco-cidade"
            value={cidade}
            aria-label="Cidade"
            title="Cidade (pelo endereço do rastreador)"
            onChange={(e) => {
              mudar({ cidade: e.target.value });
              setSelId(null);
            }}
            className={cn(
              "h-7 max-w-[220px] rounded-md border bg-white px-2 text-[12px]",
              cidade ? "border-brand-navy font-semibold text-brand-navy" : "border-border",
            )}
          >
            <option value="">Todas as cidades · {veiculos.length}</option>
            {cidades.map(([c, n]) => (
              <option key={c} value={c}>
                {c} · {n}
              </option>
            ))}
          </select>
        )}
        {seguindo ? (
          <span className="inline-flex h-7 items-center gap-1 rounded-md bg-brand-navy px-2 font-semibold text-white">
            <Crosshair className="h-3.5 w-3.5" /> Seguindo {seguindo.rotulo}
            <button
              type="button"
              onClick={pararDeSeguir}
              aria-label="Parar de seguir"
              title="Parar de seguir"
              className="ml-0.5 rounded p-0.5 hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : filtrado ? (
          <span className="inline-flex h-7 items-center gap-1 rounded-md border border-brand-navy bg-navy-tint px-2 font-semibold text-brand-navy">
            <Search className="h-3.5 w-3.5" /> {filtrado.rotulo}
            <button
              type="button"
              onClick={limparBusca}
              aria-label="Limpar busca"
              title="Voltar a todos os veículos"
              className="ml-0.5 rounded p-0.5 hover:bg-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : (
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              id="cco-busca-placa"
              list="cco-placas"
              value={busca}
              onChange={(e) => buscar(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const t = busca.trim().toLowerCase();
                const v = comCor.find((x) => rotuloBusca(x).toLowerCase().includes(t));
                if (t && v) buscar(rotuloBusca(v));
              }}
              placeholder="Buscar placa ou prefixo"
              aria-label="Buscar placa ou prefixo"
              className="h-7 w-[200px] rounded-md border border-border bg-white pl-7 pr-2 text-[12px]"
            />
            <datalist id="cco-placas">
              {comCor.map((v) => (
                <option key={v.id} value={rotuloBusca(v)} />
              ))}
            </datalist>
          </label>
        )}
        <span className="hidden items-center gap-2.5 text-muted-foreground md:flex">
          {[
            ...(alertasNoMapa
              ? (["vermelho", "amarelo", "verde", "cinza"] as CorCarro[])
              : (["verde", "cinza"] as CorCarro[])),
            "sem_sinal" as const,
          ].map((c) => {
            const deles = visiveis.filter((v) => naSituacao(v, c));
            const ativo = filtroSituacao === c;
            const rotulo = c === "sem_sinal" ? "Sem comunicação há mais de 2 h" : ROTULO_COR[c];
            return (
              <span key={c} className="group relative">
                <button
                  type="button"
                  onClick={() => setFiltroSituacao(ativo ? null : c)}
                  aria-pressed={ativo}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded-md px-1.5",
                    ativo
                      ? "bg-navy-tint text-brand-navy ring-1 ring-brand-navy"
                      : "hover:bg-secondary",
                  )}
                >
                  {c === "sem_sinal" ? (
                    <WifiOff className="h-3.5 w-3.5 text-coral" />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_HEX[c] }} />
                  )}
                  {c !== "sem_sinal" && ROTULO_COR[c]}{" "}
                  <b className="font-mono text-foreground">{deles.length}</b>
                </button>
                {/* Lista ao passar o mouse; clicar filtra os mapas. */}
                <span className="pointer-events-none absolute left-0 top-full z-[1500] mt-1 hidden w-[260px] rounded-lg border border-border bg-card p-2 text-[12px] text-foreground shadow-xl group-hover:block">
                  <b className="block">
                    {rotulo} · {deles.length}
                  </b>
                  <span className="mt-1 block font-mono text-[11px] leading-5 text-muted-foreground">
                    {deles.length
                      ? deles
                          .slice(0, 60)
                          .map((v) => rotuloBusca(v))
                          .join(" · ") + (deles.length > 60 ? ` · +${deles.length - 60}` : "")
                      : "Nenhum veículo"}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {ativo ? "Clique para mostrar todos" : "Clique para mostrar só estes no mapa"}
                  </span>
                </span>
              </span>
            );
          })}
          {q.isFetching && !mock && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {([1, 2, 4] as Layout[]).map((n) => {
            const Ic = n === 1 ? Square : n === 2 ? Columns2 : Grid2x2;
            return (
              <button
                key={n}
                type="button"
                onClick={() => mudar({ layout: n, abaAvisos: abaAvisos >= n ? -1 : abaAvisos })}
                aria-pressed={layout === n}
                aria-label={`${n} mapa${n > 1 ? "s" : ""}`}
                title={`${n} mapa${n > 1 ? "s" : ""}`}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-md border",
                  layout === n
                    ? "border-brand-navy bg-navy-tint text-brand-navy"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                <Ic className="h-3.5 w-3.5" />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => mudar({ painelAvisos: !est.painelAvisos })}
            aria-pressed={est.painelAvisos}
            className={cn(
              "ml-1 inline-flex h-7 items-center gap-1 rounded-md border px-2",
              est.painelAvisos
                ? "border-brand-navy bg-navy-tint text-brand-navy"
                : "border-border hover:bg-secondary",
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Avisos{" "}
            <b className="font-mono">{avisosVisiveis.length}</b>
          </button>
          {cidade && (
            <label
              className="ml-1 flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border px-2"
              title="Mostra só a cidade; o que está fora fica escuro"
            >
              <input
                id="cco-so-cidade"
                type="checkbox"
                checked={est.soCidade !== false}
                onChange={(e) => mudar({ soCidade: e.target.checked })}
              />
              Só a cidade
            </label>
          )}
          <label
            className="flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border px-2"
            title="Mapa escuro, com os veículos em destaque (para telão)"
          >
            <input
              id="cco-escuro"
              type="checkbox"
              checked={Boolean(est.escuro)}
              onChange={(e) => mudar({ escuro: e.target.checked })}
            />
            Telão escuro
          </label>
          {!est.janelaTV && !embutido && (
            <button
              type="button"
              onClick={() => void espalharNasTVs()}
              title="Abre cada mapa numa janela própria, uma por TV"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 hover:bg-secondary"
            >
              <MonitorUp className="h-3.5 w-3.5" /> Espalhar nas TVs
            </button>
          )}
          <button
            type="button"
            onClick={telaCheia}
            title={cheia ? "Sair da tela cheia" : "Tela cheia"}
            aria-label="Tela cheia"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border hover:bg-secondary"
          >
            {cheia ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </button>
          <span className="ml-1 font-mono text-muted-foreground">
            {new Date(relogio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </header>

      {critico && (
        <button
          type="button"
          onClick={() => focar(critico.unit_id)}
          title="Mostrar no mapa"
          className="flex h-9 shrink-0 items-center gap-3 bg-coral px-3 text-left text-[14px] text-white hover:brightness-95"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <b className="uppercase tracking-wide">Crítico</b>
          <span className="font-mono font-bold">
            {comCor.find((v) => String(v.id) === String(critico.unit_id))?.prefixo ??
              critico.unit_id}
          </span>
          <span className="min-w-0 truncate">
            {critico.nome}
            {critico.detalhe ? ` · ${critico.detalhe}` : ""}
          </span>
          <span className="ml-auto shrink-0 font-mono text-[12px] opacity-90">
            {critico.ultimo
              ? `há ${Math.max(0, Math.round((relogio - new Date(critico.ultimo).getTime()) / 60000))} min`
              : ""}
            {criticos.length > 1 ? ` · ${(iCritico % criticos.length) + 1}/${criticos.length}` : ""}
          </span>
        </button>
      )}

      {!mock && q.error ? (
        <div className="flex flex-1 items-center justify-center p-8 text-center text-[14px] text-coral">
          {mensagemErro(q.error)}
        </div>
      ) : !mock && q.isPending ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-[14px] text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando a operação…
        </div>
      ) : (
        <div
          className={cn(
            "grid min-h-0 flex-1",
            est.painelAvisos ? "grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1",
          )}
        >
          <div
            className={cn(
              "grid min-h-0 gap-1 bg-border p-1",
              layout === 1
                ? "grid-cols-1"
                : layout === 2
                  ? "grid-cols-2"
                  : "grid-cols-2 grid-rows-2",
            )}
          >
            {Array.from({ length: layout }, (_, i) =>
              fechados[i] ? (
                <div
                  key={i}
                  className="flex min-h-0 items-center justify-center gap-3 bg-secondary"
                >
                  {(
                    [
                      ["mapa", "Abrir mapa", Plus],
                      ["numeros", "Grandes números", Hash],
                    ] as const
                  ).map(([t, rot, Ic]) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipo(i, t)}
                      title={rot}
                      className="inline-flex flex-col items-center gap-1 rounded-xl border border-border bg-white px-4 py-3 text-[12px] font-medium text-muted-foreground shadow hover:text-brand-navy"
                    >
                      <Ic className="h-6 w-6" /> {rot}
                    </button>
                  ))}
                </div>
              ) : tipos[i] === "numeros" ? (
                <NumerosCCO
                  key={i}
                  veiculos={doMapa[i]}
                  avisos={avisos}
                  grupo={grupo}
                  rotulo={cidade || (selecoes[i]?.length ? "Veículos escolhidos" : "Toda a frota")}
                  onMapa={() => setTipo(i, "mapa")}
                  onFechar={() => fecharMapa(i, true)}
                />
              ) : (
                <MapaCCO
                  key={i}
                  onFechar={() => fecharMapa(i, true)}
                  onNumeros={() => setTipo(i, "numeros")}
                  criticos={criticosIds}
                  sinalEnquadrar={sinalEnquadrar}
                  enquadrarEm={regioes?.[i] ?? null}
                  contorno={contorno}
                  escuro={Boolean(est.escuro)}
                  caixaInicial={i === 0 ? (est.caixaInicial ?? null) : null}
                  registrarLimites={(fn) => (limites.current[i] = fn)}
                  onJanela={() => abrirQuadro(i)}
                  seguindoId={seguindo && seguindo.mapa === i ? seguindo.id : null}
                  areas={areasRisco}
                  indice={i}
                  vista={vistas[i]}
                  onVista={(v) => setVista(i, v)}
                  veiculos={doMapaFiltrado[i]}
                  todos={comCor}
                  selecao={selecoes[i] ?? []}
                  onSelecao={(ids) => setSelecao(i, ids)}
                  selId={selId}
                  onSelecionar={setSelId}
                  foco={foco && foco.mapa === i ? foco : null}
                  registrar={(fn) => (contem.current[i] = fn)}
                />
              ),
            )}
          </div>

          {est.painelAvisos && (
            <aside className="flex min-h-0 flex-col border-l border-border bg-card">
              <div className="border-b border-border px-3 py-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[12px]">
                    <input
                      id="cco-alertas-mapa"
                      type="checkbox"
                      checked={alertasNoMapa}
                      onChange={(e) => mudar({ alertasNoMapa: e.target.checked })}
                    />
                    Marcar alertas no mapa
                  </label>
                  <button
                    type="button"
                    onClick={() => mudar({ painelAvisos: false })}
                    aria-label="Fechar avisos"
                    title="Fechar avisos"
                    className="rounded p-1 text-muted-foreground hover:bg-secondary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex gap-1" role="tablist" aria-label="Painel lateral">
                  {(
                    [
                      ["avisos", `Avisos em aberto · ${avisosVisiveis.length}`],
                      ["turno", "Ocorrências do turno"],
                    ] as const
                  ).map(([k, rot]) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={abaLateral === k}
                      onClick={() => setAbaLateral(k)}
                      className={cn(
                        "h-8 flex-1 rounded-md text-[12px] font-semibold",
                        abaLateral === k
                          ? "bg-brand-navy text-white"
                          : "text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {rot}
                    </button>
                  ))}
                </div>
                {abaLateral === "avisos" && layout > 1 && (
                  <div className="mt-2 flex gap-1" role="tablist" aria-label="Avisos de qual mapa">
                    {[-1, ...Array.from({ length: layout }, (_, i) => i)].map((i) => (
                      <button
                        key={i}
                        type="button"
                        role="tab"
                        aria-selected={abaAvisos === i}
                        onClick={() => mudar({ abaAvisos: i })}
                        className={cn(
                          "h-7 flex-1 rounded-md border text-[11px] font-medium",
                          abaAvisos === i
                            ? "border-brand-navy bg-navy-tint text-foreground"
                            : "border-border text-muted-foreground hover:bg-secondary",
                        )}
                      >
                        {i < 0 ? "Todos os mapas" : `Mapa ${i + 1}`}
                      </button>
                    ))}
                  </div>
                )}
                <div
                  className={cn("mt-2 flex flex-wrap gap-1", abaLateral === "turno" && "hidden")}
                >
                  {(
                    [
                      ["", "Todos"],
                      ["seguranca", "Segurança"],
                      ["camera", "Câmera"],
                      ["manutencao", "Manutenção"],
                      ["equipamento", "Equipamento"],
                      ["operacao", "Operação"],
                    ] as [string, string][]
                  ).map(([k, r]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => mudar({ fonte: k as "" | FonteAviso })}
                      aria-pressed={fonte === k}
                      className={cn(
                        "h-7 rounded-full border px-2.5 text-[11px] font-medium",
                        fonte === k
                          ? "border-brand-navy bg-brand-navy text-white"
                          : "border-border hover:bg-secondary",
                      )}
                    >
                      {r} {k ? `· ${avisosVisiveis.filter((a) => a.fonte === k).length}` : ""}
                    </button>
                  ))}
                </div>
                {!mock && !q.data?.manutencao_disponivel && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Avisos de manutenção aparecem ao escolher uma empresa.
                  </p>
                )}
              </div>
              {abaLateral === "turno" && <OcorrenciasTurno grupo={grupo} onFocar={focar} />}
              <ul
                className={cn(
                  "min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2",
                  abaLateral === "turno" && "hidden",
                )}
              >
                {lista.length === 0 && (
                  <li className="p-6 text-center text-[13px] text-muted-foreground">
                    Nenhum aviso em aberto.
                  </li>
                )}
                {lista.slice(0, 300).map((a) => {
                  const v = comCor.find((x) => String(x.id) === String(a.unit_id));
                  if (!v) return null;
                  return (
                    <li
                      key={a.id}
                      className="overflow-hidden rounded-lg border border-border bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => focar(v.id)}
                        className="flex w-full gap-2 p-2 text-left hover:bg-secondary/50"
                      >
                        <span
                          className="w-1 shrink-0 rounded"
                          style={{
                            background:
                              a.gravidade === "critico" ? COR_HEX.vermelho : COR_HEX.amarelo,
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold">
                              {a.nome}
                              {a.quantidade > 1 ? ` ×${a.quantidade}` : ""}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                              {a.ultimo
                                ? new Date(a.ultimo).toLocaleTimeString("pt-BR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </span>
                          </span>
                          <span className="block truncate text-[12px] text-muted-foreground">
                            <b className="font-mono text-foreground">{v.prefixo}</b> {v.placa} ·{" "}
                            {ROTULO_FONTE[a.fonte]}
                            {a.detalhe ? ` · ${a.detalhe}` : ""}
                            {a.reaberto ? " · voltou a ocorrer" : ""}
                          </span>
                        </span>
                      </button>
                      <div className="flex border-t border-border text-[12px]">
                        {(a.fonte === "camera" || a.fonte === "equipamento") && (
                          <Atalho
                            href="/app/seguranca/video"
                            titulo="Videotelemetria"
                            abrir={abrir}
                            className="flex flex-1 items-center justify-center gap-1 py-1.5 text-brand-navy hover:bg-secondary"
                          >
                            <Camera className="h-3.5 w-3.5" /> Vídeo
                          </Atalho>
                        )}
                        <button
                          type="button"
                          onClick={() => marcar(a, "visto")}
                          className="flex flex-1 items-center justify-center gap-1 border-l border-border py-1.5 hover:bg-secondary first:border-l-0"
                        >
                          <Eye className="h-3.5 w-3.5" /> Visto
                        </button>
                        <button
                          type="button"
                          onClick={() => marcar(a, "tratado")}
                          className="flex flex-1 items-center justify-center gap-1 border-l border-border py-1.5 font-medium text-leaf hover:bg-secondary"
                        >
                          <CheckCheck className="h-3.5 w-3.5" /> Tratado
                        </button>
                      </div>
                    </li>
                  );
                })}
                {lista.length > 300 && (
                  <li className="p-2 text-center text-[12px] text-muted-foreground">
                    Mostrando os 300 primeiros de {lista.length}. Escolha uma empresa, um mapa ou um
                    tipo para ver o resto.
                  </li>
                )}
              </ul>
              <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                Sem som. Um aviso junta as ocorrências do mesmo tipo no veículo e só sai com Visto
                ou Tratado; se voltar a ocorrer depois, reaparece.
              </p>
            </aside>
          )}
        </div>
      )}

      {sel && (
        <CardVeiculo
          v={sel}
          avisos={avisos.filter((a) => String(a.unit_id) === String(sel.id))}
          onFechar={() => setSelId(null)}
          seguindo={seguindo?.id === String(sel.id)}
          onSeguir={() => (seguindo?.id === String(sel.id) ? pararDeSeguir() : seguir(sel))}
          onMarcar={marcar}
          consumoExemplo={mock ? ex.consumo(sel.id) : undefined}
          agora={relogio}
          abrir={abrir}
        />
      )}

      {camera && !mock && (
        <CameraDoAviso
          key={camera.id + camera.ultimo}
          aviso={camera}
          veiculo={comCor.find((v) => String(v.id) === String(camera.unit_id)) ?? null}
          agora={relogio}
          onFechar={() => setCameraDispensada(camera.id + camera.ultimo)}
        />
      )}

      {sobreposicao && (
        <div
          className="fixed inset-0 z-[2000] flex flex-col bg-black/40 p-4"
          role="dialog"
          aria-label={sobreposicao.titulo}
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-[14px] font-semibold">{sobreposicao.titulo}</span>
              <button
                type="button"
                onClick={() => setSobreposicao(null)}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[12px] hover:bg-secondary"
              >
                <X className="h-3.5 w-3.5" /> Voltar ao painel
              </button>
            </div>
            <iframe
              title={sobreposicao.titulo}
              src={sobreposicao.url}
              className="min-h-0 flex-1 border-0"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Link que abre em outra aba; embutido em outro sistema, abre por cima do painel. */
function Atalho({
  href,
  titulo,
  abrir,
  className,
  children,
}: {
  href: string;
  titulo: string;
  abrir: (titulo: string, url: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const embutido = Boolean(lerEmbutido());
  return (
    <a
      href={href}
      target="_blank"
      rel="opener"
      title={embutido ? "Abre por cima do painel" : "Abre em outra aba (o painel continua aqui)"}
      className={className}
      onClick={(e) => {
        if (!embutido) return;
        e.preventDefault();
        abrir(titulo, href);
      }}
    >
      {children}
    </a>
  );
}

function MapaCCO({
  indice,
  vista,
  onVista,
  veiculos,
  todos,
  selecao,
  onSelecao,
  selId,
  onSelecionar,
  foco,
  registrar,
  onFechar,
  onNumeros,
  criticos,
  sinalEnquadrar,
  enquadrarEm,
  contorno,
  escuro,
  caixaInicial,
  registrarLimites,
  onJanela,
  seguindoId,
  areas,
}: {
  /** Contorno oficial da cidade (IBGE): fora dele o mapa fica escuro e não deixa sair da área. */
  contorno: ContornoCidade | null;
  escuro: boolean;
  /** Janela aberta numa TV: enquadra esta área ao abrir. */
  caixaInicial: [number, number, number, number] | null;
  registrarLimites: (fn: () => L.LatLngBounds | null) => void;
  onJanela: () => void;
  onFechar: () => void;
  onNumeros: () => void;
  criticos: Set<string>;
  sinalEnquadrar: number;
  /** Região da cidade que este mapa enquadra (null = os veículos do mapa). */
  enquadrarEm: VeiculoPainel[] | null;
  seguindoId: string | null;
  areas: AreaRisco[];
  indice: number;
  vista: Vista;
  onVista: (v: Vista) => void;
  veiculos: VeiculoPainel[];
  todos: VeiculoPainel[];
  selecao: string[];
  onSelecao: (ids: string[]) => void;
  selId: string | number | null;
  onSelecionar: (id: string | number) => void;
  foco: { id: string | number; n: number } | null;
  registrar: (fn: (lat: number, lng: number) => boolean) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [local, setLocal] = useState(0);
  return (
    <div
      className={cn(
        "relative min-h-0 overflow-hidden",
        escuro ? "cco-escuro bg-[#0b0f14]" : "bg-white",
      )}
    >
      <MapContainer
        center={vista.centro}
        zoom={vista.zoom}
        className="h-full w-full"
        style={{ zIndex: 0 }}
        preferCanvas
        // Zoom fracionado: com nível inteiro o enquadramento recuava até 2× para caber a frota
        // (Fênix em Florianópolis ficava "muito de cima" — PM, 11/10/2026).
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={120}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Guardar vista={vista} onVista={onVista} />
        <Limites contorno={contorno} registrar={registrarLimites} caixaInicial={caixaInicial} />
        {contorno && (
          <>
            {/* Tudo fora da cidade escurecido, como o mapa da planta de uma mineração (PM, 12/10/2026). */}
            <Polygon
              positions={[MUNDO, ...contorno.poligonos]}
              interactive={false}
              pathOptions={{
                stroke: false,
                fillColor: escuro ? "#05070a" : "#1d2633",
                fillOpacity: escuro ? 0.94 : 0.82,
              }}
            />
            <Polygon
              positions={contorno.poligonos}
              interactive={false}
              pathOptions={{ color: escuro ? "#5dade2" : "#1f5f99", weight: 2, fill: false }}
            />
          </>
        )}
        {areas.map((a) =>
          a.poligonos.map((pol, j) => (
            <Polygon
              key={`${a.chave}-${j}`}
              positions={pol}
              interactive={false}
              pathOptions={{
                color: a.nivel === "evitar" ? "#d84a3a" : "#d4a017",
                weight: 1.5,
                fillOpacity: 0.15,
              }}
            />
          )),
        )}
        <Focar foco={foco} veiculos={veiculos} registrar={registrar} />
        <Enquadrar
          sinal={sinalEnquadrar + local}
          veiculos={enquadrarEm ?? veiculos}
          caixa={!enquadrarEm && contorno ? contorno.caixa : null}
        />
        {seguindoId && <Seguir alvo={veiculos.find((v) => String(v.id) === seguindoId)} />}
        {veiculos.map((v) => (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={icone(v, String(selId) === String(v.id), criticos.has(String(v.id)))}
            zIndexOffset={
              (criticos.has(String(v.id)) ? 4000 : ESCALA[v.cor]) +
              (String(selId) === String(v.id) ? 5000 : 0)
            }
            eventHandlers={{ click: () => onSelecionar(v.id) }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              {NOME_TIPO[v.tipo]} {v.prefixo} · {v.placa} · {ROTULO_COR[v.cor]}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
      <div className="absolute right-2 top-2 z-[400] flex items-center gap-1 rounded-md bg-white/95 px-1.5 py-1 text-[12px] shadow">
        <button
          type="button"
          onClick={() => setAberto((x) => !x)}
          aria-expanded={aberto}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded border px-2 text-[12px]",
            selecao.length
              ? "border-brand-navy bg-navy-tint font-semibold"
              : "border-border bg-white",
          )}
        >
          <ListFilter className="h-3.5 w-3.5" />{" "}
          {selecao.length
            ? `${veiculos.length} veículo${veiculos.length === 1 ? "" : "s"}`
            : "Todos os veículos"}
        </button>
        <button
          type="button"
          onClick={() => setLocal((n) => n + 1)}
          title="Enquadrar os veículos deste mapa"
          aria-label="Enquadrar os veículos deste mapa"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-white hover:bg-secondary"
        >
          <Expand className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onJanela}
          title="Abrir este mapa numa janela própria (para pôr numa TV)"
          aria-label="Abrir este mapa numa janela"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-white hover:bg-secondary"
        >
          <MonitorUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onNumeros}
          title="Trocar este mapa pelos grandes números"
          aria-label="Grandes números"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-white hover:bg-secondary"
        >
          <Hash className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onFechar}
          title="Fechar este mapa"
          aria-label="Fechar este mapa"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-white hover:bg-secondary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {aberto && (
        <SeletorVeiculos
          todos={todos}
          selecao={selecao}
          onSelecao={onSelecao}
          onFechar={() => setAberto(false)}
        />
      )}
    </div>
  );
}

/** Escolha das placas do mapa (vazio = todas). */
function SeletorVeiculos({
  todos,
  selecao,
  onSelecao,
  onFechar,
}: {
  todos: VeiculoPainel[];
  selecao: string[];
  onSelecao: (ids: string[]) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const marcados = new Set(selecao);
  const t = busca.trim().toLowerCase();
  const lista = todos
    .filter(
      (v) =>
        !t ||
        [v.prefixo, v.placa, v.motorista, v.empresa].some((x) =>
          (x ?? "").toLowerCase().includes(t),
        ),
    )
    .sort((a, b) => String(a.prefixo).localeCompare(String(b.prefixo), "pt-BR", { numeric: true }));
  const alternar = (id: string) => {
    const n = new Set(marcados);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    onSelecao([...n]);
  };
  return (
    <div className="absolute right-2 top-12 z-[500] flex max-h-[70%] w-[280px] flex-col rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center gap-1 border-b border-border p-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          autoFocus
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Prefixo, placa ou motorista…"
          className="h-7 min-w-0 flex-1 bg-transparent text-[12px] outline-none"
        />
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="rounded p-1 hover:bg-secondary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-border p-2 text-[11px]">
        <button
          type="button"
          onClick={() => onSelecao([])}
          className="rounded border border-border px-2 py-0.5 hover:bg-secondary"
        >
          Todos (sem filtro)
        </button>
        {t && (
          <button
            type="button"
            onClick={() => onSelecao([...new Set([...selecao, ...lista.map((v) => String(v.id))])])}
            className="rounded border border-border px-2 py-0.5 hover:bg-secondary"
          >
            Marcar os {lista.length} da busca
          </button>
        )}
        <span className="ml-auto self-center text-muted-foreground">
          {selecao.length ? `${selecao.length} escolhidos` : "mostrando todos"}
        </span>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1">
        {lista.slice(0, 500).map((v) => (
          <li key={v.id}>
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-[12px] hover:bg-secondary">
              <input
                type="checkbox"
                checked={marcados.has(String(v.id))}
                onChange={() => alternar(String(v.id))}
              />
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: COR_HEX[v.cor] }}
              />
              <b className="font-mono">{v.prefixo}</b>
              <span className="truncate text-muted-foreground">
                {v.placa !== v.prefixo ? v.placa : (v.motorista ?? "")}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Aplica a área escolhida e guarda o enquadramento quando o operador arrasta. */
function Guardar({ vista, onVista }: { vista: Vista; onVista: (v: Vista) => void }) {
  const map = useMap();
  const ultimo = useRef(vista.area + vista.zoom + vista.centro.join());
  // Movimento feito pelo próprio painel (troca de área) não vira "Área livre".
  const programatico = useRef(false);
  useEffect(() => {
    const k = vista.area + vista.zoom + vista.centro.join();
    if (k !== ultimo.current && vista.area !== "livre") {
      programatico.current = true;
      map.setView(vista.centro, vista.zoom, { animate: false });
    }
    ultimo.current = k;
  }, [vista, map]);
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map]);
  useMapEvents({
    moveend: (e) => {
      if (programatico.current) {
        programatico.current = false;
        return;
      }
      const m = e.target as L.Map;
      const c = m.getCenter();
      const nova = {
        centro: [Number(c.lat.toFixed(4)), Number(c.lng.toFixed(4))] as [number, number],
        zoom: m.getZoom(),
        area: "livre",
      };
      ultimo.current = nova.area + nova.zoom + nova.centro.join();
      onVista(nova);
    },
  });
  return null;
}

function Focar({
  foco,
  veiculos,
  registrar,
}: {
  foco: { id: string | number; n: number } | null;
  veiculos: VeiculoPainel[];
  registrar: (fn: (lat: number, lng: number) => boolean) => void;
}) {
  const map = useMap();
  useEffect(() => {
    // Bloco (sem retorno): o que a função devolvesse viraria a limpeza do efeito.
    registrar((lat, lng) => {
      try {
        return map.getBounds().contains([lat, lng]);
      } catch {
        return false; // mapa ainda montando ou já desmontado
      }
    });
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!foco) return;
    const v = veiculos.find((x) => String(x.id) === String(foco.id));
    // Sem animação: aba em segundo plano não anima e o voo calculava posição inválida.
    if (v && map.getBounds().contains([v.lat, v.lng]))
      map.panTo([v.lat, v.lng], { animate: false });
    else if (v) map.setView([v.lat, v.lng], Math.max(map.getZoom(), 12), { animate: false });
  }, [foco]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Retângulo do mundo inteiro: com os contornos da cidade como furos, vira a máscara de fora da cidade. */
const MUNDO: [number, number][] = [
  [-85, -180],
  [-85, 180],
  [85, 180],
  [85, -180],
];

/**
 * Com o contorno da cidade, o mapa não deixa arrastar para longe (folga de 15%). Também informa a área
 * que está na tela (para abrir o mapa numa janela) e, numa janela de TV, enquadra a área recebida.
 */
function Limites({
  contorno,
  registrar,
  caixaInicial,
}: {
  contorno: ContornoCidade | null;
  registrar: (fn: () => L.LatLngBounds | null) => void;
  caixaInicial: [number, number, number, number] | null;
}) {
  const map = useMap();
  useEffect(() => {
    registrar(() => {
      try {
        return map.getBounds();
      } catch {
        return null;
      }
    });
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!contorno?.caixa) {
      map.setMaxBounds(undefined as unknown as L.LatLngBounds);
      return;
    }
    const [a, b, c, d] = contorno.caixa;
    map.setMaxBounds(L.latLngBounds([a, b], [c, d]).pad(0.15));
  }, [contorno, map]);
  useEffect(() => {
    if (!caixaInicial) return;
    const t = setTimeout(() => {
      try {
        map.invalidateSize();
        const [a, b, c, d] = caixaInicial;
        map.fitBounds(
          [
            [a, b],
            [c, d],
          ],
          { animate: false },
        );
      } catch {
        /* mapa montando */
      }
    }, 300);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Enquadra o mapa nos veículos dele quando o sinal muda (troca de empresa/cidade ou botão). */
function Enquadrar({
  sinal,
  veiculos,
  caixa,
}: {
  sinal: number;
  veiculos: VeiculoPainel[];
  /** Quando há contorno da cidade, enquadra a cidade inteira (não só onde estão os carros). */
  caixa?: [number, number, number, number] | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!sinal || (!veiculos.length && !caixa)) return;
    if (caixa) {
      const t = setTimeout(() => {
        try {
          map.invalidateSize();
          map.fitBounds(
            [
              [caixa[0], caixa[1]],
              [caixa[2], caixa[3]],
            ],
            { padding: [8, 8], animate: false },
          );
        } catch {
          /* mapa montando */
        }
      }, 120);
      return () => clearTimeout(t);
    }
    // Fica de fora só quem está muito longe do resto (um carro em viagem não tira o foco da cidade):
    // mais de 3 vezes a largura do miolo (10% a 90%, no mínimo 0,1°) a partir da mediana. Antes cortava 2% de cada
    // ponta e escondia os ônibus do sul da ilha (Fênix, 11/10/2026).
    const longe = (xs: number[]) => {
      const o = [...xs].sort((a, b) => a - b);
      const q = (k: number) => o[Math.min(o.length - 1, Math.floor(k * (o.length - 1)))];
      // Mínimo de 0,1° (≈ 11 km): com a frota parada na garagem o miolo é um ponto só, e todo o
      // resto da cidade virava "longe" (o mapa enquadrava só a garagem).
      const larg = Math.max(q(0.9) - q(0.1), 0.1);
      return (x: number) => Math.abs(x - q(0.5)) > 3 * larg;
    };
    const fLat = longe(veiculos.map((v) => v.lat));
    const fLng = longe(veiculos.map((v) => v.lng));
    const perto = veiculos.filter((v) => !fLat(v.lat) && !fLng(v.lng));
    const base = perto.length ? perto : veiculos;
    const b = L.latLngBounds(base.map((v) => [v.lat, v.lng] as [number, number]));
    // Espera o mapa saber o próprio tamanho (quadro recém-aberto ao trocar para 2 ou 4 mapas).
    const t = setTimeout(() => {
      try {
        map.invalidateSize();
        map.fitBounds(b, { padding: [12, 12], maxZoom: 16, animate: false });
      } catch {
        /* mapa montando */
      }
    }, 120);
    return () => clearTimeout(t);
  }, [sinal]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * Grandes números da operação, no lugar de um mapa (PM, 10/10/2026). Contam os veículos deste
 * quadro (cidade e seleção) e se atualizam junto com o painel, a cada 30 s.
 */
function NumerosCCO({
  veiculos,
  avisos,
  grupo,
  rotulo,
  onMapa,
  onFechar,
}: {
  veiculos: VeiculoPainel[];
  avisos: AvisoPainel[];
  grupo?: string;
  rotulo: string;
  onMapa: () => void;
  onFechar: () => void;
}) {
  const ids = new Set(veiculos.map((v) => String(v.id)));
  const meus = avisos.filter((a) => ids.has(String(a.unit_id)));
  const criticos = meus.filter((a) => a.gravidade === "critico");
  const rodando = veiculos.filter((v) => v.comunicando && v.ignicao && v.velocidade > 3);
  const paradoLigado = veiculos.filter((v) => v.comunicando && v.ignicao && v.velocidade <= 3);
  const desligado = veiculos.filter((v) => v.comunicando && !v.ignicao);
  const semSinal = veiculos.filter((v) => !v.comunicando);
  const semMotorista = rodando.filter((v) => !v.motorista);
  const velMedia = rodando.length
    ? Math.round(rodando.reduce((s, v) => s + v.velocidade, 0) / rodando.length)
    : null;
  const tq = useQuery(turnoQuery(grupo, inicioDoTurno(), !usandoMock()));
  const tratados = (tq.data?.data ?? []).filter(
    (x) => x.situacao === "tratado" && ids.has(String(x.unit_id)),
  ).length;
  const pct = (n: number) =>
    veiculos.length ? `${Math.round((n / veiculos.length) * 100)}% da frota` : "";
  const cartoes: { rot: string; valor: string; pe: string; cor?: string }[] = [
    {
      rot: "Rodando agora",
      valor: String(rodando.length),
      pe: `de ${veiculos.length} · ${pct(rodando.length)}`,
      cor: "var(--leaf)",
    },
    {
      rot: "Parados com motor ligado",
      valor: String(paradoLigado.length),
      pe: pct(paradoLigado.length),
      cor: paradoLigado.length ? "var(--gold)" : undefined,
    },
    { rot: "Desligados", valor: String(desligado.length), pe: pct(desligado.length) },
    {
      rot: "Sem comunicação há mais de 2 h",
      valor: String(semSinal.length),
      pe: pct(semSinal.length),
      cor: semSinal.length ? "var(--coral)" : undefined,
    },
    {
      rot: "Alertas críticos em aberto",
      valor: String(criticos.length),
      pe: `em ${new Set(criticos.map((a) => a.unit_id)).size} veículos`,
      cor: criticos.length ? "var(--coral)" : undefined,
    },
    { rot: "Avisos em aberto", valor: String(meus.length), pe: "todos os tipos" },
    {
      rot: "Velocidade média",
      valor: velMedia == null ? "—" : String(velMedia),
      pe: "km/h de quem está rodando",
    },
    {
      rot: "Rodando sem motorista",
      valor: String(semMotorista.length),
      pe: "identificado no rastreador",
      cor: semMotorista.length ? "var(--gold)" : undefined,
    },
    {
      rot: "Tratados no turno",
      valor: usandoMock() ? "—" : String(tratados),
      pe: `desde ${inicioDoTurno().slice(11, 16)}`,
    },
  ];
  return (
    <div className="relative flex min-h-0 flex-col bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[12px]">
        <Hash className="h-3.5 w-3.5 text-brand-navy" />
        <b className="text-foreground">Grandes números</b>
        <span className="truncate text-muted-foreground">· {rotulo}</span>
        <button
          type="button"
          onClick={onMapa}
          className="ml-auto inline-flex h-7 items-center gap-1 rounded border border-border bg-white px-2 hover:bg-secondary"
        >
          <MapPinned className="h-3.5 w-3.5" /> Voltar ao mapa
        </button>
        <button
          type="button"
          onClick={onFechar}
          title="Fechar este quadro"
          aria-label="Fechar este quadro"
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-border bg-white hover:bg-secondary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-px bg-border"
        style={{ containerType: "size" }}
      >
        {cartoes.map((c) => (
          <div
            key={c.rot}
            className="flex min-h-0 min-w-0 flex-col justify-center bg-card px-[3cqw]"
          >
            <span
              className="line-clamp-2 font-medium leading-tight text-muted-foreground"
              style={{ fontSize: "clamp(11px, 2.6cqmin, 20px)" }}
            >
              {c.rot}
            </span>
            <span
              className="font-mono font-bold leading-none tabular-nums"
              style={{
                fontSize: "clamp(26px, 11cqmin, 120px)",
                color: c.cor ?? "var(--foreground)",
              }}
            >
              {c.valor}
            </span>
            <span
              className="line-clamp-2 leading-tight text-muted-foreground"
              style={{ fontSize: "clamp(10px, 2.2cqmin, 16px)" }}
            >
              {c.pe}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Início do turno atual: 06h, 14h ou 22h (o das 22h começa no dia anterior antes das 6h). */
function inicioDoTurno(agora = new Date()) {
  const d = new Date(agora);
  const h = d.getHours();
  const inicio = h >= 22 ? 22 : h >= 14 ? 14 : h >= 6 ? 6 : 22;
  if (h < 6) d.setDate(d.getDate() - 1);
  d.setHours(inicio, 0, 0, 0);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(inicio)}:00:00`;
}

/** O que foi visto ou tratado no turno, mais recente primeiro — para a passagem de turno. */
function OcorrenciasTurno({ grupo, onFocar }: { grupo?: string; onFocar: (id: number) => void }) {
  const desde = inicioDoTurno();
  const tq = useQuery(turnoQuery(grupo, desde, true));
  const itens = tq.data?.data ?? [];
  const tratados = itens.filter((x) => x.situacao === "tratado").length;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="border-b border-border px-3 py-2 text-[12px] text-muted-foreground">
        Turno desde {desde.slice(11, 16)} · <b className="text-foreground">{itens.length}</b>{" "}
        marcações · <b className="text-foreground">{tratados}</b> tratadas
      </p>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {tq.isPending && (
          <li className="p-6 text-center text-[13px] text-muted-foreground">
            <Loader2 className="mx-auto h-4 w-4 animate-spin" />
          </li>
        )}
        {tq.error && (
          <li className="p-4 text-center text-[13px] text-coral">{mensagemErro(tq.error)}</li>
        )}
        {!tq.isPending && !tq.error && itens.length === 0 && (
          <li className="p-6 text-center text-[13px] text-muted-foreground">
            Nada marcado neste turno ainda.
          </li>
        )}
        {itens.map((x, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onFocar(x.unit_id)}
              className="w-full rounded-lg border border-border px-2.5 py-1.5 text-left text-[12px] hover:bg-secondary"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {x.em.slice(11, 16)}
                </span>
                <b className="font-mono">{x.veiculo}</b>
                <span
                  className={cn(
                    "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    x.situacao === "tratado"
                      ? "bg-leaf/15 text-leaf"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {x.situacao === "tratado" ? "Tratado" : "Visto"}
                </span>
              </div>
              <div className="truncate text-muted-foreground">
                {x.aviso ?? "Aviso"} · {x.por ?? "—"}
                {x.nota ? ` · ${x.nota}` : ""}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Vídeo ao vivo do carro que gerou o último aviso crítico de câmera. */
function CameraDoAviso({
  aviso,
  veiculo,
  agora,
  onFechar,
}: {
  aviso: AvisoPainel;
  veiculo: VeiculoPainel | null;
  agora: number;
  onFechar: () => void;
}) {
  const [canal, setCanal] = useState(1);
  const [t, setT] = useState<Transmissao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const unitId = Number(aviso.unit_id);
  useEffect(() => {
    let vivo = true;
    setT(null);
    setErro(null);
    registrarAuditoria(
      "video_ao_vivo",
      `CCO: canal ${canal} aberto — veículo ${veiculo?.placa ?? unitId} (${aviso.nome}).`,
    );
    Cameras.abrir(unitId, canal)
      .then((x) => vivo && setT(x))
      .catch((e) => vivo && setErro(mensagemErro(e)));
    return () => {
      vivo = false;
    };
  }, [unitId, canal]); // eslint-disable-line react-hooks/exhaustive-deps
  const min = aviso.ultimo
    ? Math.max(0, Math.round((agora - new Date(aviso.ultimo).getTime()) / 60000))
    : null;
  return (
    <div className="fixed bottom-4 right-4 z-[950] w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[12px]">
        <Camera className="h-4 w-4 text-coral" />
        <b className="font-mono">{veiculo?.prefixo ?? unitId}</b>
        <span className="min-w-0 truncate">
          {aviso.nome}
          {min != null ? ` · há ${min} min` : ""}
        </span>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar câmera"
          className="ml-auto rounded p-1 hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="aspect-video bg-black">
        {t ? (
          <PlayerAoVivo url={t.url} formato={t.formato} onErro={(e) => setErro(e.motivo)} />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-[12px] text-white/80">
            {erro ? erro : <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 px-3 py-2 text-[11px]">
        <span className="text-muted-foreground">Canal</span>
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCanal(n)}
            aria-pressed={canal === n}
            className={cn(
              "h-6 w-6 rounded border",
              canal === n
                ? "border-brand-navy bg-navy-tint font-semibold"
                : "border-border hover:bg-secondary",
            )}
          >
            {n}
          </button>
        ))}
        {erro && t && <span className="ml-2 truncate text-coral">{erro}</span>}
      </div>
    </div>
  );
}

/** Mantém o carro seguido no centro do mapa a cada nova posição. */
function Seguir({ alvo }: { alvo?: VeiculoPainel }) {
  const map = useMap();
  const primeira = useRef(true);
  useEffect(() => {
    if (!alvo) return;
    try {
      if (primeira.current)
        map.setView([alvo.lat, alvo.lng], Math.max(map.getZoom(), 15), { animate: false });
      else map.panTo([alvo.lat, alvo.lng], { animate: false });
      primeira.current = false;
    } catch {
      /* mapa montando */
    }
  }, [alvo?.lat, alvo?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function CardVeiculo({
  v,
  avisos,
  onFechar,
  seguindo,
  onSeguir,
  onMarcar,
  consumoExemplo,
  agora,
  abrir,
}: {
  v: VeiculoPainel;
  avisos: AvisoPainel[];
  onFechar: () => void;
  seguindo: boolean;
  onSeguir: () => void;
  onMarcar: (a: AvisoPainel, s: "visto" | "tratado") => void;
  consumoExemplo?: number | null;
  agora: number;
  abrir: (titulo: string, url: string) => void;
}) {
  const cq = useQuery(consumoQuery(typeof v.id === "number" ? v.id : null));
  const desligado = !v.ignicao;
  const consumo = consumoExemplo !== undefined ? consumoExemplo : (cq.data?.consumo_lh ?? null);
  const minCom = v.ultima_comunicacao
    ? Math.round((agora - new Date(v.ultima_comunicacao).getTime()) / 60000)
    : null;
  const metr = (rot: string, valor: string, Ic: typeof Gauge, dica?: string) => (
    <div className="rounded-lg border border-border bg-secondary/40 px-2.5 py-2" title={dica}>
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Ic className="h-3.5 w-3.5" /> {rot}
      </div>
      <div className="mt-0.5 font-mono text-[15px] font-semibold text-foreground">{valor}</div>
    </div>
  );
  const id = encodeURIComponent(String(v.id));
  const atalhos: [string, string, typeof Gauge][] = [
    ["Sinais do motor", `/app/frota/sinais?veiculo=${id}`, Activity],
    ["Tracking do dia", `/app/frota/tracking?veiculo=${encodeURIComponent(v.prefixo)}`, Gauge],
    ["Eventos", "/app/eventos", AlertTriangle],
    ...(v.tem_camera
      ? ([["Câmera ao vivo", "/app/seguranca/video", Camera]] as [string, string, typeof Gauge][])
      : []),
    ["Manutenção", "/app/manutencao/", Wrench],
    ["Ficha do veículo", "/app/veiculos/", ExternalLink],
  ];
  return (
    <div className="fixed bottom-4 left-4 z-[1000] w-[430px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card shadow-2xl">
      <div
        className="flex items-start gap-3 border-b border-border p-3"
        style={{
          borderTop: `4px solid ${COR_HEX[v.cor]}`,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
          style={{ background: COR_HEX[v.cor] }}
          dangerouslySetInnerHTML={{ __html: svgVeiculo(v.tipo, 22) }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[16px] font-bold">{v.prefixo}</span>
            <span className="font-mono text-[13px] text-muted-foreground">{v.placa}</span>
            <span title={v.comunicando ? "Comunicando" : "Sem comunicação há mais de 2 h"}>
              {v.comunicando ? (
                <Wifi className="h-4 w-4 text-leaf" />
              ) : (
                <WifiOff className="h-4 w-4 text-coral" />
              )}
            </span>
          </div>
          <div className="truncate text-[12px] text-muted-foreground">
            {NOME_TIPO[v.tipo]}
            {v.descricao ? ` ${v.descricao}` : ""} · {v.empresa} ·{" "}
            <span style={{ color: COR_HEX[v.cor] }} className="font-semibold">
              {ROTULO_COR[v.cor]}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {v.motorista ?? "Motorista não identificado"} · ignição{" "}
              {v.ignicao ? "ligada" : "desligada"} ·{" "}
              {minCom == null
                ? "sem registro"
                : minCom < 120
                  ? `há ${Math.max(0, minCom)} min`
                  : `sem sinal há ${Math.round(minCom / 60)} h`}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onSeguir}
          aria-pressed={seguindo}
          title={seguindo ? "Parar de seguir" : "O mapa mostra só este veículo e vai atrás dele"}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-[12px] font-semibold",
            seguindo
              ? "border-brand-navy bg-brand-navy text-white"
              : "border-border hover:bg-secondary",
          )}
        >
          <Crosshair className="h-3.5 w-3.5" /> {seguindo ? "Seguindo" : "Seguir veículo"}
        </button>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          className="rounded-md p-1 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 p-3">
        {metr("Velocidade", desligado ? "—" : `${v.velocidade} km/h`, Gauge)}
        {metr("Rotação", desligado || v.rpm == null ? "—" : `${v.rpm} rpm`, Activity)}
        {metr("Faixa agora", desligado || !v.faixa ? "—" : v.faixa, Gauge)}
        {metr(
          "Consumo agora",
          desligado || consumo == null ? "—" : `${consumo.toLocaleString("pt-BR")} L/h`,
          Fuel,
          cq.data?.consumo_minutos
            ? `Média dos últimos ${cq.data.consumo_minutos} min, pelo totalizador de combustível`
            : undefined,
        )}
        {metr("Altitude", v.altitude == null ? "—" : `${v.altitude} m`, Mountain)}
        {metr(
          "Temperatura",
          desligado || v.temperatura == null ? "—" : `${v.temperatura} °C`,
          Thermometer,
        )}
      </div>

      {avisos.length > 0 && (
        <div className="max-h-[140px] space-y-1 overflow-y-auto px-3 pb-2">
          {avisos.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-[12px]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  background: a.gravidade === "critico" ? COR_HEX.vermelho : COR_HEX.amarelo,
                }}
              />
              <span className="min-w-0 flex-1 truncate">
                <b>{a.nome}</b>
                {a.quantidade > 1 ? ` ×${a.quantidade}` : ""} ·{" "}
                {a.ultimo
                  ? new Date(a.ultimo).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : ""}
              </span>
              <button
                type="button"
                onClick={() => onMarcar(a, "visto")}
                className="rounded px-1.5 py-0.5 hover:bg-secondary"
              >
                Visto
              </button>
              <button
                type="button"
                onClick={() => onMarcar(a, "tratado")}
                className="rounded px-1.5 py-0.5 font-medium text-leaf hover:bg-secondary"
              >
                Tratado
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 border-t border-border p-3">
        {atalhos.map(([rot, href, Ic]) => (
          <Atalho
            key={rot}
            href={href}
            titulo={rot}
            abrir={abrir}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[12px] font-medium text-brand-navy hover:bg-navy-tint"
          >
            <Ic className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{rot}</span>
          </Atalho>
        ))}
      </div>
    </div>
  );
}
