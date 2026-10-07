import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Clock,
  Coffee,
  FileText,
  Fuel,
  Loader2,
  MapPin,
  Moon,
  Plus,
  Route,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { api } from "@/lib/api";
import {
  Escala,
  escalaPoisQuery,
  escalaRotasQuery,
  type PontoPlano,
  type RotaPadrao,
} from "@/lib/escala-api";
import { rotaOtimizada, type Parada } from "@/lib/roteirizacao";
import { veiculosApiQuery } from "@/lib/queries";
import { mensagemErro } from "@/lib/suporte-api";
import { CadastrosApi, type Registro } from "@/lib/cadastros-api";
import { cn } from "@/lib/utils";
import { CHAVE_ROTOGRAMA, COR_NIVEL, ROTULO_NIVEL, type NivelRisco } from "@/lib/rotas-seguras-api";
import { AreasRisco } from "@/screens/roteirizacao/AreasRisco";
import { ListaProgramacao, ProgramarViagem } from "@/screens/roteirizacao/Programacao";

/**
 * Roteirização com dado real. Recebe os pontos de uma viagem da Escala de
 * Viagem (?viagem=ID), de uma rota padrão ou montados aqui, e estima km, tempo
 * com as pausas da Lei do Motorista, combustível pelo km/L real do veículo,
 * custo pelo preço ANP e pedágio. As duas ferramentas são separadas e
 * conversam: daqui se salva a rota para a escala usar (decisão do PM, 04/10/2026).
 *
 * É também o lugar das rotas do cliente (fretamento): as rotas cadastradas no
 * sistema atual abrem aqui com o traçado gravado, e nome, cor, velocidade e
 * centro de custo se editam no painel da rota. A página Rotas foi retirada
 * para não haver dois lugares de rota (decisão do PM, 04/10/2026).
 */

type Ponto = {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  parada_min: number;
  tipo?: string;
};
type Resultado = {
  operacao: "carga" | "passageiros";
  fonte_rota: string;
  trechos: { de: string; para: string; km: number; conducao_min: number }[];
  km_total: number;
  conducao_min: number;
  pausas: {
    tipo: "pausa" | "descanso";
    min: number;
    quando: string;
    trecho: string;
    regra: string;
  }[];
  pausas_min: number;
  paradas_min: number;
  saida: string;
  chegada: string;
  duracao_total_min: number;
  agenda: { ponto: string; chegada: string | null; saida: string | null }[];
  combustivel: {
    kml: number;
    fonte_kml: string;
    litros: number | null;
    preco_litro: number | null;
    fonte_preco: string | null;
    custo: number | null;
  };
  pedagio: {
    pracas: { nome: string; rodovia: string; uf: string }[];
    base_disponivel: boolean;
    eixos: number;
    tarifa_eixo: number | null;
    tarifa_estimada?: boolean;
    valor: number | null;
    observacao: string | null;
  };
  geometria: [number, number][] | null;
  motor?: {
    nome: string | null;
    configurado: string | null;
    desvia_areas: boolean;
    erro: string | null;
  };
  areas_risco?: {
    nome: string;
    nivel: NivelRisco;
    origem: string;
    motivo: string | null;
    dist_m: number;
    na_rota: boolean;
    poligonos: [number, number][][];
  }[];
  areas_na_rota?: { nome: string; motivo: string | null }[];
  aviso_risco?: string | null;
};

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const nf = (v: number | null | undefined, c = 0) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const hhmm = (min: number) =>
  `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;
const quando = (s: string | null) =>
  s
    ? new Date(s).toLocaleString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
const agoraLocal = () => {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:00`;
};
let seq = 0;
const novoId = () => `p${++seq}`;

const pino = (cor: string, rotulo: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${cor};color:#fff;border:2px solid #fff;border-radius:999px;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;font:600 11px Inter,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.35);padding:0 4px">${rotulo}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

function Enquadrar({ pontos }: { pontos: [number, number][] }) {
  const map = useMap();
  const chave = pontos.map((p) => p.join(",")).join(";");
  // O mapa monta antes da grade terminar de calcular a largura: sem isso só
  // parte dos ladrilhos aparece.
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [map]);
  useEffect(() => {
    if (pontos.length) map.fitBounds(L.latLngBounds(pontos), { padding: [30, 30], maxZoom: 13 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return null;
}

type Aba = "rota" | "areas" | "programacao";

export default function RoteirizacaoReal() {
  const g = grupoAtivo();
  const [aba, setAba] = useState<Aba>("rota");
  const [programando, setProgramando] = useState(false);
  const qc = useQueryClient();
  const qs = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const viagemId = qs.get("viagem");
  // Entrada pelo menu "Rotograma": a tela orienta o caminho até o botão.
  const veioDoRotograma = qs.get("rotograma") === "1";
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const [unitId, setUnitId] = useState<string>("");
  const [saida, setSaida] = useState(agoraLocal());
  const [eixos, setEixos] = useState(3);
  const [tarifa, setTarifa] = useState("");
  const [busca, setBusca] = useState("");
  const [res, setRes] = useState<Resultado | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [origemTxt, setOrigemTxt] = useState<string | null>(null);
  // Rota cadastrada aberta: o cálculo usa o traçado gravado dela.
  const [rotaCad, setRotaCad] = useState<Registro | null>(null);
  const [buscaRota, setBuscaRota] = useState("");
  const [edicao, setEdicao] = useState<Record<string, unknown>>({});
  const [salvandoRota, setSalvandoRota] = useState(false);

  const pois = useQuery(escalaPoisQuery(g));
  const rotas = useQuery(escalaRotasQuery(g));
  const rotasCad = useQuery({
    queryKey: ["cad", "rota", g],
    queryFn: () => CadastrosApi.listar("rota", g!),
    enabled: Boolean(g),
    staleTime: 300_000,
  });
  const opcoesCad = useQuery({
    queryKey: ["cad", "opcoes", g],
    queryFn: () => CadastrosApi.opcoes(g!),
    enabled: Boolean(g),
    staleTime: 600_000,
  });
  const trajeto = useMemo(
    () =>
      ((rotaCad?.trajeto as [number, number][]) ?? []).filter(
        (x) => Array.isArray(x) && x.length === 2,
      ),
    [rotaCad],
  );

  // Rotas do cliente (cadastradas) e rotas salvas para a escala, numa lista só.
  const listaRotas = useMemo(() => {
    const b = buscaRota.trim().toLowerCase();
    const cad = (rotasCad.data?.data ?? []).map((r) => ({
      chave: `c${r.id}`,
      nome: String(r.nome ?? "Rota"),
      sub: [r.descricao, r.centro_custo, Number(r.km) ? `${nf(Number(r.km), 1)} km` : null]
        .filter(Boolean)
        .join(" · "),
      cad: r as Registro | undefined,
      pad: undefined as RotaPadrao | undefined,
    }));
    const pad = (rotas.data ?? []).map((r) => ({
      chave: `p${r.id}`,
      nome: r.nome,
      sub: `salva para a escala · ${r.pontos.length} pontos`,
      cad: undefined as Registro | undefined,
      pad: r as RotaPadrao | undefined,
    }));
    return [...cad, ...pad].filter((x) => !b || `${x.nome} ${x.sub}`.toLowerCase().includes(b));
  }, [rotasCad.data, rotas.data, buscaRota]);

  const abrirRotaCad = (r: Registro) => {
    const tr = ((r.trajeto as [number, number][]) ?? []).filter(
      (x) => Array.isArray(x) && x.length === 2,
    );
    if (tr.length < 2) {
      toast.error("Esta rota não tem traçado gravado.");
      return;
    }
    const nome = String(r.nome ?? "Rota");
    setRotaCad(r);
    setEdicao({
      nome: r.nome,
      descricao: r.descricao,
      cor: r.cor,
      velocidade: r.velocidade,
      cost_center_id: r.cost_center_id,
    });
    setPontos([
      {
        id: novoId(),
        nome: `Início · ${nome}`,
        latitude: tr[0][0],
        longitude: tr[0][1],
        parada_min: 0,
        tipo: "origem",
      },
      {
        id: novoId(),
        nome: `Fim · ${nome}`,
        latitude: tr[tr.length - 1][0],
        longitude: tr[tr.length - 1][1],
        parada_min: 0,
        tipo: "destino",
      },
    ]);
    setOrigemTxt(
      `Rota ${nome}: traçado gravado no sistema. Inclua as paradas de embarque, se quiser; pontos fora do traçado (mais de 1,5 km) são estimados em linha reta.`,
    );
    setBuscaRota("");
  };

  const fecharRotaCad = () => {
    setRotaCad(null);
    setEdicao({});
    setOrigemTxt(null);
  };

  const salvarDadosRota = async () => {
    if (!g || !rotaCad) return;
    setSalvandoRota(true);
    try {
      const r = await CadastrosApi.editar("rota", g, String(rotaCad.id), edicao);
      await qc.invalidateQueries({ queryKey: ["cad", "rota", g] });
      setRotaCad({ ...rotaCad, ...edicao, id: r.id, provisorio: true });
      toast.success("Dados da rota salvos (provisório: ainda não chegam ao sistema atual)");
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setSalvandoRota(false);
    }
  };
  const veiculos = useQuery(veiculosApiQuery());

  // Pontos de uma viagem da Escala (a conversa entre as duas ferramentas).
  useEffect(() => {
    if (!viagemId || !g) return;
    api
      .get<{ unit_id: number; saida_prevista: string; pontos: PontoPlano[]; codigo?: string }>(
        `/api/v1/escala-viagem/viagens/${viagemId}`,
      )
      .then((v) => {
        setPontos(
          v.pontos.map((p) => ({
            id: novoId(),
            nome: p.nome,
            latitude: p.latitude,
            longitude: p.longitude,
            parada_min: p.tipo === "origem" || p.tipo === "destino" ? 0 : 30,
            tipo: p.tipo,
          })),
        );
        setUnitId(String(v.unit_id));
        if (v.saida_prevista) setSaida(v.saida_prevista.slice(0, 16));
        setOrigemTxt(`Pontos da viagem ${v.codigo ?? viagemId} da Escala de Viagem.`);
      })
      .catch((e) => toast.error(mensagemErro(e)));
  }, [viagemId, g]);

  const sugestoes = useMemo(() => {
    const b = busca.trim().toLowerCase();
    if (b.length < 2) return [];
    return (pois.data ?? []).filter((p) => p.nome.toLowerCase().includes(b)).slice(0, 8);
  }, [busca, pois.data]);

  // O mesmo pedido serve para o cálculo e para o rotograma (que abre em outra aba).
  const pedido = () => ({
    group_id: Number(g),
    unit_id: unitId ? Number(unitId) : null,
    saida: saida.length === 16 ? `${saida}:00` : saida,
    eixos,
    tarifa_eixo: tarifa ? Number(tarifa.replace(",", ".")) : null,
    pontos: pontos.map(({ nome, latitude, longitude, parada_min }) => ({
      nome,
      latitude,
      longitude,
      parada_min,
    })),
    ...(rotaCad && trajeto.length > 1
      ? { trajeto, rota_id: rotaCad.origem_id ?? null, operacao: "passageiros" }
      : {}),
  });

  const abrirRotograma = () => {
    try {
      localStorage.setItem(CHAVE_ROTOGRAMA, JSON.stringify(pedido()));
    } catch {
      toast.error(
        "O navegador bloqueou o armazenamento local; não foi possível abrir o rotograma.",
      );
      return;
    }
    const a = document.createElement("a");
    a.href = "/rotograma";
    a.target = "_blank";
    a.rel = "opener";
    a.click();
  };

  const calcular = async () => {
    if (!g || pontos.length < 2) return;
    setCalculando(true);
    try {
      const r = await api.post<Resultado>("/api/v1/roteirizacao/calcular", pedido());
      setRes(r);
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setCalculando(false);
    }
  };

  // Recalcula sozinho quando os pontos mudam (com espera curta).
  const chave = JSON.stringify([pontos, unitId, saida, eixos, tarifa, rotaCad?.id ?? null]);
  useEffect(() => {
    if (pontos.length < 2) {
      setRes(null);
      return;
    }
    const t = setTimeout(calcular, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const mover = (i: number, d: -1 | 1) =>
    setPontos((ps) => {
      const n = [...ps];
      const j = i + d;
      if (j < 0 || j >= n.length) return ps;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const otimizar = () => {
    if (pontos.length < 4) return;
    const paradas: Parada[] = pontos.map((p, i) => ({
      id: p.id,
      nome: p.nome,
      lat: p.latitude,
      lng: p.longitude,
      paradaMin: p.parada_min,
      fixo: i === 0 ? "inicio" : i === pontos.length - 1 ? "fim" : undefined,
    }));
    const r = rotaOtimizada(paradas);
    const porId = new Map(pontos.map((p) => [p.id, p]));
    setPontos(r.ordem.map((p) => porId.get(p.id)!));
    toast.success("Ordem das paradas otimizada (origem e destino mantidos)");
  };

  const salvarComoRota = async () => {
    if (!g || pontos.length < 2) return;
    const nome = window.prompt(
      "Nome da rota padrão (a Escala de Viagem passa a oferecer esta rota):",
      `${pontos[0].nome} → ${pontos[pontos.length - 1].nome}`,
    );
    if (!nome) return;
    try {
      await Escala.salvarRota({
        group_id: Number(g),
        nome,
        pontos: pontos.map((p, i) => ({
          tipo:
            i === 0
              ? "origem"
              : i === pontos.length - 1
                ? "destino"
                : p.tipo && !["origem", "destino"].includes(p.tipo)
                  ? p.tipo
                  : "posto",
          nome: p.nome,
          latitude: p.latitude,
          longitude: p.longitude,
          raio_m: 300,
        })),
        destinatarios: [],
      });
      await qc.invalidateQueries({ queryKey: ["escala", "rotas"] });
      toast.success("Rota salva: já aparece na Escala de Viagem");
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  };

  if (!g) {
    return (
      <>
        <PageHeader title="Roteirização" subtitle="Rota, tempo, combustível e pedágio" />
        <p className="px-8 py-6 text-[13px] text-muted-foreground">
          Escolha uma empresa no topo do menu.
        </p>
      </>
    );
  }

  const linha: [number, number][] =
    res?.geometria ?? (trajeto.length > 1 ? trajeto : pontos.map((p) => [p.latitude, p.longitude]));
  const corLinha = rotaCad ? String(edicao.cor || rotaCad.cor || "#1d4ed8") : "#1d4ed8";
  const campo = "h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]";

  return (
    <div className="tema-denso">
      <PageHeader
        title="Roteirização"
        subtitle="Rota, tempo com as pausas da Lei do Motorista, combustível, custo, pedágio e áreas de risco"
      />
      <div
        className="mx-auto flex max-w-[1760px] gap-1 px-4 pt-3 md:px-6"
        role="tablist"
        aria-label="Roteirização"
      >
        {(
          [
            ["rota", "Rota", Route],
            ["areas", "Áreas de risco", ShieldAlert],
            ["programacao", "Programação de viagens", CalendarClock],
          ] as const
        ).map(([k, rot, I]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={aba === k}
            onClick={() => setAba(k)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold",
              aba === k ? "bg-brand-navy text-white" : "text-muted-foreground hover:bg-secondary",
            )}
          >
            <I className="h-4 w-4" /> {rot}
          </button>
        ))}
      </div>
      {aba === "areas" && <AreasRisco grupo={g} />}
      {aba === "programacao" && <ListaProgramacao grupo={g} />}
      {programando && res && (
        <ProgramarViagem
          grupo={g}
          onFechar={() => setProgramando(false)}
          base={{
            nome: `${pontos[0]?.nome ?? "Origem"} → ${pontos[pontos.length - 1]?.nome ?? "Destino"}`,
            unitId: unitId || undefined,
            pontos: pontos.map(({ nome, latitude, longitude }) => ({ nome, latitude, longitude })),
            trajeto: res.geometria ?? [],
          }}
        />
      )}
      <main
        className={cn(
          "mx-auto grid max-w-[1760px] gap-4 px-4 py-4 md:px-6 lg:grid-cols-[420px_1fr]",
          aba !== "rota" && "hidden",
        )}
      >
        <section className="space-y-3">
          {veioDoRotograma && !res && (
            <div className="rounded-xl border-2 border-brand-navy bg-navy-tint px-3 py-2 text-[13px] text-brand-navy">
              <p className="flex items-center gap-1.5 font-semibold">
                <FileText className="h-4 w-4" /> Rotograma
              </p>
              <p className="mt-1">
                1. Escolha uma rota do cliente abaixo, ou inclua a origem e o destino (busca ou
                clique no mapa).
              </p>
              <p>2. Escolha o veículo e a saída.</p>
              <p>
                3. Clique em <b>Rotograma (tela e PDF)</b>, que aparece embaixo do mapa assim que a
                rota é calculada.
              </p>
            </div>
          )}
          {origemTxt && (
            <p className="rounded-lg bg-brand-sky/10 px-3 py-2 text-[12px] text-brand-navy">
              {origemTxt}
            </p>
          )}
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-[13px] font-semibold">Rotas do cliente</p>
            <input
              value={buscaRota}
              onChange={(e) => setBuscaRota(e.target.value)}
              placeholder={`Buscar entre ${nf(listaRotas.length)} rotas (nome, centro de custo)…`}
              className={campo}
              aria-label="Buscar rota"
            />
            {buscaRota.trim().length > 0 && (
              <ul className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-white">
                {listaRotas.slice(0, 60).map((x) => (
                  <li key={x.chave}>
                    <button
                      className="w-full px-3 py-1.5 text-left hover:bg-secondary"
                      onClick={() => {
                        if (x.cad) abrirRotaCad(x.cad);
                        else if (x.pad) {
                          fecharRotaCad();
                          setPontos(
                            x.pad.pontos.map((p) => ({
                              id: novoId(),
                              nome: p.nome,
                              latitude: p.latitude,
                              longitude: p.longitude,
                              parada_min: p.tipo === "origem" || p.tipo === "destino" ? 0 : 30,
                              tipo: p.tipo,
                            })),
                          );
                          setBuscaRota("");
                        }
                      }}
                    >
                      <span className="block truncate text-[13px] text-foreground">{x.nome}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {x.sub}
                      </span>
                    </button>
                  </li>
                ))}
                {listaRotas.length === 0 && (
                  <li className="px-3 py-2 text-[12px] text-muted-foreground">
                    Nenhuma rota com esse nome.
                  </li>
                )}
              </ul>
            )}
            {!buscaRota && (rotasCad.data?.total ?? 0) === 0 && (rotas.data?.length ?? 0) === 0 && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                Este cliente ainda não tem rotas. Monte os pontos abaixo e salve.
              </p>
            )}
          </div>

          {rotaCad && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[13px] font-semibold">
                  Dados da rota
                  {rotaCad.provisorio ? (
                    <span className="ml-2 text-[12px] font-normal text-gold">provisório</span>
                  ) : null}
                </p>
                <button
                  onClick={fecharRotaCad}
                  className="text-[12px] text-muted-foreground hover:text-foreground"
                >
                  Fechar rota
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
                <label className="col-span-2 space-y-1">
                  <span>Nome</span>
                  <input
                    className={campo}
                    value={String(edicao.nome ?? "")}
                    onChange={(e) => setEdicao((d) => ({ ...d, nome: e.target.value }))}
                  />
                </label>
                <label className="col-span-2 space-y-1">
                  <span>Descrição</span>
                  <input
                    className={campo}
                    value={String(edicao.descricao ?? "")}
                    onChange={(e) => setEdicao((d) => ({ ...d, descricao: e.target.value }))}
                  />
                </label>
                <label className="col-span-2 space-y-1">
                  <span>Centro de custo</span>
                  <select
                    className={campo}
                    value={String(edicao.cost_center_id ?? "")}
                    onChange={(e) =>
                      setEdicao((d) => ({
                        ...d,
                        cost_center_id: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                  >
                    <option value="">—</option>
                    {(opcoesCad.data?.centros_custo ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span>Velocidade máxima (km/h)</span>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    className={campo}
                    value={String(edicao.velocidade ?? "")}
                    onChange={(e) =>
                      setEdicao((d) => ({
                        ...d,
                        velocidade: e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label className="space-y-1">
                  <span>Cor no mapa</span>
                  <input
                    type="color"
                    className={cn(campo, "p-1")}
                    value={String(edicao.cor || "#0000FF")}
                    onChange={(e) => setEdicao((d) => ({ ...d, cor: e.target.value }))}
                  />
                </label>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[12px] text-muted-foreground">
                  {Number(rotaCad.km) ? `${nf(Number(rotaCad.km), 1)} km de traçado gravado.` : ""}
                </p>
                <button
                  disabled={salvandoRota || !String(edicao.nome ?? "").trim()}
                  onClick={salvarDadosRota}
                  className="inline-flex items-center gap-1 rounded-md bg-brand-navy px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
                >
                  {salvandoRota ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}{" "}
                  Salvar dados da rota
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
              <label className="col-span-2 space-y-1">
                <span>Veículo (o km/L vem do histórico dele)</span>
                <select
                  className={campo}
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                >
                  <option value="">Média da frota</option>
                  {(veiculos.data?.items ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {[v.prefixo, v.placa].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span>Saída</span>
                <input
                  type="datetime-local"
                  className={campo}
                  value={saida}
                  onChange={(e) => setSaida(e.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span>Eixos</span>
                <input
                  type="number"
                  min={2}
                  max={9}
                  className={campo}
                  value={eixos}
                  onChange={(e) => setEixos(Number(e.target.value) || 2)}
                />
              </label>
              <label className="col-span-2 space-y-1">
                <span>Tarifa média de pedágio por eixo (R$, opcional)</span>
                <input
                  className={campo}
                  inputMode="decimal"
                  value={tarifa}
                  onChange={(e) => setTarifa(e.target.value)}
                  placeholder="padrão: R$ 8,00 (estimativa)"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[13px] font-semibold">Pontos da rota ({pontos.length})</p>
              <div className="flex gap-1">
                <button
                  disabled={pontos.length < 4}
                  onClick={otimizar}
                  title="Reordena as paradas do meio pelo menor caminho"
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] disabled:opacity-40"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Otimizar ordem
                </button>
                <button
                  disabled={pontos.length < 2}
                  onClick={salvarComoRota}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[12px] disabled:opacity-40"
                >
                  <Save className="h-3.5 w-3.5" /> Salvar para a escala
                </button>
              </div>
            </div>
            <ol className="space-y-1.5">
              {pontos.map((p, i) => (
                <li
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-[13px]"
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white",
                      i === 0 ? "bg-leaf" : i === pontos.length - 1 ? "bg-coral" : "bg-brand-navy",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={p.nome}>
                    {p.nome}
                  </span>
                  {i > 0 && i < pontos.length - 1 && (
                    <input
                      type="number"
                      min={0}
                      title="Minutos parado"
                      aria-label={`Minutos parado em ${p.nome}`}
                      value={p.parada_min}
                      onChange={(e) =>
                        setPontos((ps) =>
                          ps.map((x) =>
                            x.id === p.id ? { ...x, parada_min: Number(e.target.value) || 0 } : x,
                          ),
                        )
                      }
                      className="h-7 w-14 rounded border border-border px-1 text-right text-[12px]"
                    />
                  )}
                  <button
                    aria-label="Subir"
                    onClick={() => mover(i, -1)}
                    className="text-muted-foreground"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label="Descer"
                    onClick={() => mover(i, 1)}
                    className="text-muted-foreground"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label="Remover"
                    onClick={() => setPontos((ps) => ps.filter((x) => x.id !== p.id))}
                    className="text-muted-foreground hover:text-coral"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ol>
            <div className="relative mt-2">
              <Plus className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Adicionar ponto cadastrado (cliente, posto, base)…"
                className="h-9 w-full rounded-lg border border-border pl-8 pr-3 text-[13px]"
              />
              {sugestoes.length > 0 && (
                <ul className="absolute z-[500] mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
                  {sugestoes.map((s) => (
                    <li key={s.id}>
                      <button
                        className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-secondary"
                        onClick={() => {
                          setPontos((ps) => [
                            ...ps,
                            {
                              id: novoId(),
                              nome: s.nome,
                              latitude: s.latitude,
                              longitude: s.longitude,
                              parada_min: ps.length ? 30 : 0,
                            },
                          ]);
                          setBusca("");
                        }}
                      >
                        {s.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Ou clique no mapa para incluir um ponto. A primeira é a origem e a última, o destino.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <div className="h-[380px] overflow-hidden rounded-xl border border-border">
            <MapContainer
              center={[-19.92, -43.94]}
              zoom={6}
              className="h-full w-full"
              scrollWheelZoom
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <CliqueNoMapa
                onClique={(lat, lng) =>
                  setPontos((ps) => [
                    ...ps,
                    {
                      id: novoId(),
                      nome: `Ponto ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                      latitude: lat,
                      longitude: lng,
                      parada_min: ps.length ? 30 : 0,
                    },
                  ])
                }
              />
              {(res?.areas_risco ?? []).map((a, i) =>
                a.poligonos.map((pol, j) => (
                  <Polygon
                    key={`r${i}-${j}`}
                    positions={pol}
                    pathOptions={{
                      color: COR_NIVEL[a.nivel],
                      weight: a.na_rota ? 3 : 1.5,
                      fillOpacity: a.na_rota ? 0.35 : 0.2,
                    }}
                  >
                    <Tooltip>
                      {a.nome} · {ROTULO_NIVEL[a.nivel]}
                      {a.na_rota ? " · o caminho passa por aqui" : ` · a ${nf(a.dist_m)} m`}
                    </Tooltip>
                  </Polygon>
                )),
              )}
              {linha.length > 1 && (
                <Polyline
                  positions={linha}
                  pathOptions={{
                    color: corLinha,
                    weight: 4,
                    opacity: 0.8,
                    dashArray: res?.geometria || trajeto.length > 1 ? undefined : "8 6",
                  }}
                />
              )}
              {pontos.map((p, i) => (
                <Marker
                  key={p.id}
                  position={[p.latitude, p.longitude]}
                  icon={pino(
                    i === 0 ? "#2e7d32" : i === pontos.length - 1 ? "#d84a3a" : "#16325c",
                    String(i + 1),
                  )}
                >
                  <Tooltip>{p.nome}</Tooltip>
                </Marker>
              ))}
              <Enquadrar
                pontos={trajeto.length > 1 ? trajeto : pontos.map((p) => [p.latitude, p.longitude])}
              />
            </MapContainer>
          </div>

          {pontos.length < 2 ? (
            <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-[13px] text-muted-foreground">
              Inclua a origem e o destino para calcular.
            </p>
          ) : !res ? (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Calculando…
            </p>
          ) : (
            <>
              {res.aviso_risco && (
                <p className="flex items-start gap-2 rounded-xl bg-coral-tint px-3 py-2 text-[13px]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                  <span>
                    <b>{res.aviso_risco}</b> {res.areas_na_rota?.map((a) => a.nome).join(", ")}
                  </span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={abrirRotograma}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-[13px] font-semibold text-white"
                >
                  <FileText className="h-4 w-4" /> Rotograma (tela e PDF)
                </button>
                <button
                  type="button"
                  disabled={!res.geometria}
                  onClick={() => setProgramando(true)}
                  title={
                    res.geometria
                      ? "Veículo, dias e horário: o CCO passa a vigiar desvio de rota"
                      : "Precisa do caminho real: abra uma rota cadastrada (traçado gravado) ou ligue o motor de rotas"
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-semibold disabled:opacity-40"
                >
                  <CalendarClock className="h-4 w-4" /> Programar viagem
                </button>
                <span className="text-[12px] text-muted-foreground">
                  {res.motor?.nome
                    ? `Motor de rotas: ${res.motor.nome}${res.motor.desvia_areas ? ", desviando das áreas de risco" : ""}.`
                    : res.motor?.erro
                      ? `Motor de rotas com falha (${res.motor.erro}); caminho estimado.`
                      : "Motor de rotas ainda não ligado: caminho estimado, sem desvio automático das áreas de risco."}
                  {!res.geometria ? " Para programar a viagem é preciso o caminho real." : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Kpi
                  icone={Route}
                  rotulo="Distância"
                  valor={`${nf(res.km_total)} km`}
                  sub={res.fonte_rota}
                />
                <Kpi
                  icone={Clock}
                  rotulo="Tempo total"
                  valor={hhmm(res.duracao_total_min)}
                  sub={`${hhmm(res.conducao_min)} dirigindo + ${hhmm(res.pausas_min)} de pausas legais + ${hhmm(res.paradas_min)} em paradas`}
                />
                <Kpi
                  icone={MapPin}
                  rotulo="Chegada prevista"
                  valor={quando(res.chegada)}
                  sub={`saída ${quando(res.saida)}`}
                />
                <Kpi
                  icone={Fuel}
                  rotulo="Combustível"
                  valor={`${nf(res.combustivel.litros)} L`}
                  sub={`${nf(res.combustivel.kml, 2)} km/L (${res.combustivel.fonte_kml})`}
                />
                <Kpi
                  icone={Wallet}
                  rotulo="Custo estimado"
                  valor={
                    res.combustivel.custo != null
                      ? BRL.format(res.combustivel.custo + (res.pedagio.valor ?? 0))
                      : "—"
                  }
                  sub={`diesel ${res.combustivel.preco_litro != null ? BRL.format(res.combustivel.preco_litro) : "—"}/L (${res.combustivel.fonte_preco ?? "sem preço"})${res.pedagio.valor != null ? ` + pedágio ${BRL.format(res.pedagio.valor)}` : ""}`}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="mb-2 text-[13px] font-semibold">
                    Programação da viagem (
                    {res.operacao === "carga" ? "regras de carga" : "regras de passageiros"})
                  </p>
                  <ol className="space-y-1.5 text-[13px]">
                    {res.agenda.map((a, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate">
                          <b>{i + 1}.</b> {a.ponto}
                        </span>
                        <span className="shrink-0 font-mono text-[12px] text-muted-foreground">
                          {a.chegada ? `chega ${quando(a.chegada)}` : ""}
                          {a.saida ? ` · sai ${quando(a.saida)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {res.pausas.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-border pt-2 text-[12px]">
                      {res.pausas.map((p, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          {p.tipo === "descanso" ? (
                            <Moon className="mt-0.5 h-3.5 w-3.5 text-brand-navy" />
                          ) : (
                            <Coffee className="mt-0.5 h-3.5 w-3.5 text-gold" />
                          )}
                          <span>
                            {p.tipo === "descanso" ? "Descanso de 11 h" : "Pausa de 30 min"} em{" "}
                            {quando(p.quando)}, no trecho {p.trecho}.{" "}
                            <span className="text-muted-foreground">{p.regra}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="mb-2 text-[13px] font-semibold">Trechos e pedágio</p>
                  <table className="w-full text-[13px]">
                    <tbody className="divide-y divide-border">
                      {res.trechos.map((t, i) => (
                        <tr key={i}>
                          <td className="py-1 pr-2">
                            {t.de} → {t.para}
                          </td>
                          <td className="py-1 text-right tabular-nums">{nf(t.km)} km</td>
                          <td className="py-1 pl-2 text-right tabular-nums">
                            {hhmm(t.conducao_min)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 border-t border-border pt-2 text-[12px]">
                    {res.pedagio.base_disponivel ? (
                      <>
                        <p>
                          <b>{res.pedagio.pracas.length} praças</b> de rodovias federais no caminho
                          {res.pedagio.valor != null && (
                            <>
                              {" "}
                              · <b>{BRL.format(res.pedagio.valor)}</b> para {res.pedagio.eixos}{" "}
                              eixos
                            </>
                          )}
                          {res.pedagio.pracas.length
                            ? `: ${res.pedagio.pracas.map((p) => `${p.nome} (${p.rodovia}/${p.uf})`).join(", ")}`
                            : ""}
                          .
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {res.pedagio.tarifa_estimada
                            ? `Estimativa com R$ ${nf(res.pedagio.tarifa_eixo, 2)} por eixo por praça (a tarifa de cada praça não é dado aberto); informe a tarifa média acima se souber. `
                            : ""}
                          Conta só praças federais (ANTT); pedágios estaduais e o Free Flow da Dutra
                          ficam de fora.
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">
                        {res.pedagio.observacao} Para o valor exato por eixo, a recomendação é ligar
                        um serviço de rotas com pedágio (Amazon Location Service ou QualP).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          {calculando && res && <p className="text-[12px] text-muted-foreground">Recalculando…</p>}
        </section>
      </main>
    </div>
  );
}

function CliqueNoMapa({ onClique }: { onClique: (lat: number, lng: number) => void }) {
  const map = useMap();
  useEffect(() => {
    const f = (e: L.LeafletMouseEvent) => onClique(e.latlng.lat, e.latlng.lng);
    map.on("click", f);
    return () => {
      map.off("click", f);
    };
  }, [map, onClique]);
  return null;
}

function Kpi({
  icone: I,
  rotulo,
  valor,
  sub,
}: {
  icone: typeof Route;
  rotulo: string;
  valor: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <I className="h-3.5 w-3.5" /> {rotulo}
      </p>
      <p className="text-[20px] font-semibold leading-tight tabular-nums">{valor}</p>
      {sub && <p className="mt-0.5 text-[12px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
