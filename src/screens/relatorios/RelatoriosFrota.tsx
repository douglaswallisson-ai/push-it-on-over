import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, BarChart3, Download, Loader2 } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, type Column } from "@/components/ss/ui/data";
import { api } from "@/lib/api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Relatórios de frota do sistema atual que faltavam na plataforma nova:
 * Paradas e Deslocamentos (e o Consolidado), Paradas em POI, Passagem por POI,
 * Cercas, Distância e Horímetro por período (dia ou semana).
 * Regras e correções do vault documentadas no backend (relatorios_frota.py).
 */

export type AbaFrota =
  | "paradas"
  | "consolidado"
  | "paradas-poi"
  | "passagem-poi"
  | "cercas"
  | "distancia"
  | "sla"
  | "configuracoes"
  | "odometro"
  | "velocidade-limite";

/** maxDias 0 = relatório sem período (fotografia de agora). */
const ABAS: { id: AbaFrota; rotulo: string; maxDias: number; dica: string }[] = [
  {
    id: "paradas",
    rotulo: "Paradas e deslocamentos",
    maxDias: 31,
    dica: "Cada parada e cada deslocamento do veículo, com duração, distância, local e motorista.",
  },
  {
    id: "consolidado",
    rotulo: "Consolidado por veículo",
    maxDias: 31,
    dica: "Total de paradas, tempo parado (e parado ligado), tempo em movimento e km de cada veículo.",
  },
  {
    id: "paradas-poi",
    rotulo: "Paradas em pontos",
    maxDias: 31,
    dica: "Paradas que terminaram num ponto de interesse: quanto tempo cada veículo ficou em cada ponto.",
  },
  {
    id: "passagem-poi",
    rotulo: "Passagem por pontos",
    maxDias: 7,
    dica: "Veículos que passaram perto de um ponto de interesse, parando ou não.",
  },
  {
    id: "cercas",
    rotulo: "Cercas",
    maxDias: 31,
    dica: "Entrada e saída de cercas eletrônicas, com o tempo que o veículo ficou dentro.",
  },
  {
    id: "distancia",
    rotulo: "Distância e horímetro",
    maxDias: 31,
    dica: "Km rodados e horas de motor por veículo, dia a dia ou por semana.",
  },
  {
    id: "sla",
    rotulo: "SLA de paradas",
    maxDias: 31,
    dica: "Horário programado contra o realizado em cada ponto das viagens de fretamento.",
  },
  {
    id: "velocidade-limite",
    rotulo: "Velocidade limite",
    maxDias: 31,
    dica: "Limite cadastrado no veículo, no grupo e no equipamento, ao lado dos excessos do período. Para revisar o cadastro.",
  },
  {
    id: "configuracoes",
    rotulo: "Configurações do veículo",
    maxDias: 0,
    dica: "Como o equipamento principal de cada veículo está configurado: firmware, script, faixas de RPM, fator de consumo.",
  },
  {
    id: "odometro",
    rotulo: "Odômetro travado",
    maxDias: 0,
    dica: "Veículos que andaram nas últimas 24 h com o odômetro parado (regra do Painel de Calibração).",
  },
];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nf = (v: unknown, c = 0) =>
  v == null || v === ""
    ? "—"
    : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: c, minimumFractionDigits: 0 });
const dmh = (s: unknown) =>
  s ? `${String(s).slice(8, 10)}/${String(s).slice(5, 7)} ${String(s).slice(11, 16)}` : "—";
const dur = (s: unknown) => {
  if (s == null) return "—";
  const n = Number(s);
  const h = Math.floor(n / 3600),
    m = Math.floor((n % 3600) / 60);
  return h ? `${h}h${String(m).padStart(2, "0")}` : m ? `${m} min` : `${Math.round(n)} s`;
};
const placa = (r: Record<string, unknown>) => (
  <span className="leading-tight">
    <span className="font-mono font-semibold text-foreground">{String(r.placa ?? "—")}</span>
    {r.prefixo ? (
      <span className="block text-[12px] text-muted-foreground">{String(r.prefixo)}</span>
    ) : null}
  </span>
);

function baixarCsv(nome: string, cab: string[], linhas: unknown[][]) {
  const csv = [cab, ...linhas]
    .map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

type R = Record<string, unknown>;
const segundaDaSemana = (dia: string) => {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};

export default function RelatoriosFrota({
  abaInicial = "paradas",
  onVoltar,
}: {
  abaInicial?: AbaFrota;
  onVoltar?: () => void;
}) {
  const g = grupoAtivo();
  const [aba, setAba] = useState<AbaFrota>(abaInicial);
  const cfg = ABAS.find((a) => a.id === aba)!;
  const [fim, setFim] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return iso(d);
  });
  const [inicio, setInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return iso(d);
  });
  const [veiculo, setVeiculo] = useState("");
  const [tipo, setTipo] = useState("");
  const [minMin, setMinMin] = useState(0);
  const [distancia, setDistancia] = useState(100);
  const [porSemana, setPorSemana] = useState(false);

  const dias = Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 86_400_000) + 1;
  const semPeriodo = cfg.maxDias === 0;
  const periodoOk = semPeriodo || (dias >= 1 && dias <= cfg.maxDias);

  const veiculos = useQuery({
    queryKey: ["rel-frota", "veiculos", g],
    queryFn: () =>
      api.get<{ data: { id: number; placa: string; prefixo: string | null }[] }>(
        `/api/v1/relatorios-frota/veiculos?group_id=${g}`,
      ),
    enabled: Boolean(g),
    staleTime: 600_000,
  });

  const endpoint =
    {
      consolidado: "paradas-deslocamentos",
      paradas: "paradas-deslocamentos",
      distancia: "distancia-horimetro",
      sla: "sla-paradas",
      odometro: "odometro-travado",
    }[aba as string] ?? aba;
  const params = new URLSearchParams(
    semPeriodo ? { group_id: String(g ?? "") } : { group_id: String(g ?? ""), inicio, fim },
  );
  if (veiculo && !semPeriodo && aba !== "sla") params.set("unit_id", veiculo);
  if (aba === "paradas" && tipo) params.set("tipo", tipo);
  if (["paradas", "consolidado", "paradas-poi"].includes(aba) && minMin)
    params.set("min_minutos", String(minMin));
  if (aba === "passagem-poi") params.set("distancia_m", String(distancia));
  const q = useQuery({
    queryKey: ["rel-frota", endpoint, params.toString()],
    queryFn: () => api.get<R>(`/api/v1/relatorios-frota/${endpoint}?${params}`),
    enabled: Boolean(g) && periodoOk,
    staleTime: 300_000,
  });
  const d = q.data as R | undefined;

  const trocarAba = (a: AbaFrota) => {
    setAba(a);
    const m = ABAS.find((x) => x.id === a)!.maxDias;
    if (m && dias > m) {
      const ini = new Date(`${fim}T12:00:00`);
      ini.setDate(ini.getDate() - (m - 1));
      setInicio(iso(ini));
    }
  };

  // Distância e horímetro: dia a dia ou somado por semana (seg a dom).
  const linhasDist = useMemo(() => {
    const ds = (d?.dias as R[]) ?? [];
    if (!porSemana) return ds;
    const m = new Map<string, R>();
    for (const x of ds) {
      const k = `${x.unit_id}|${segundaDaSemana(String(x.dia))}`;
      const a = m.get(k) ?? {
        ...x,
        dia: segundaDaSemana(String(x.dia)),
        km: 0,
        horas: 0,
        litros: 0,
        km_comb: 0,
        dias_com_dado: 0,
      };
      a.km = Number(a.km) + Number(x.km ?? 0);
      a.horas = Number(a.horas) + Number(x.horas ?? 0);
      a.litros = Number(a.litros) + Number(x.litros ?? 0);
      a.km_comb = Number(a.km_comb) + Number(x.km_comb ?? 0);
      a.km_l =
        Number(a.litros) > 0 && Number(a.km_comb) > 0 ? Number(a.km_comb) / Number(a.litros) : null;
      a.dias_com_dado = Number(a.dias_com_dado) + (x.km != null || x.horas != null ? 1 : 0);
      m.set(k, a);
    }
    return [...m.values()];
  }, [d, porSemana]);

  // Gráfico da frota: km (barras) e litros (linha) por dia ou semana.
  // Pedido da CECOTI: "Distância por Semana" com o consumo junto.
  const serieDist = useMemo(() => {
    const m = new Map<string, { dia: string; km: number; litros: number }>();
    for (const x of linhasDist) {
      const k = String(x.dia).slice(0, 10);
      const a = m.get(k) ?? { dia: k, km: 0, litros: 0 };
      a.km += Number(x.km ?? 0);
      a.litros += Number(x.litros ?? 0);
      m.set(k, a);
    }
    return [...m.values()]
      .sort((a, b) => a.dia.localeCompare(b.dia))
      .map((p) => ({
        ...p,
        rotulo: `${p.dia.slice(8, 10)}/${p.dia.slice(5, 7)}`,
        km: Math.round(p.km),
        litros: Math.round(p.litros),
      }));
  }, [linhasDist]);

  let colunas: Column<R>[] = [];
  let linhas: R[] = [];
  let csv: { cab: string[]; lin: (r: R) => unknown[] } | null = null;
  if (aba === "paradas") {
    linhas = (d?.linhas as R[]) ?? [];
    colunas = [
      { key: "placa", header: "Veículo", render: placa },
      {
        key: "tipo",
        header: "Tipo",
        render: (r) => (
          <Pill tone={r.tipo === "parada" ? "gold" : "sky"}>
            {r.tipo === "parada" ? "Parada" : "Deslocamento"}
          </Pill>
        ),
      },
      {
        key: "inicio",
        header: "Início",
        render: (r) => <span className="font-mono">{dmh(r.inicio)}</span>,
      },
      { key: "fim", header: "Fim", render: (r) => <span className="font-mono">{dmh(r.fim)}</span> },
      { key: "duracao_s", header: "Duração", align: "right", render: (r) => dur(r.duracao_s) },
      {
        key: "km",
        header: "Distância",
        align: "right",
        render: (r) =>
          r.salto_odometro ? (
            <span
              className="text-coral"
              title="Média acima de 200 km/h: salto do odômetro. Fica fora das somas."
            >
              {nf(r.km, 1)} km ⚠
            </span>
          ) : r.tipo === "parada" ? (
            "—"
          ) : (
            `${nf(r.km, 2)} km`
          ),
      },
      {
        key: "vel_max",
        header: "Vel. máx.",
        align: "right",
        render: (r) => (r.tipo === "parada" ? "—" : `${nf(r.vel_max)} km/h`),
      },
      {
        key: "local_inicio",
        header: "Local",
        render: (r) => (
          <span className="line-clamp-2 max-w-[320px] text-[12px]">
            {String(r.local_inicio || r.endereco_inicio || "—")}
          </span>
        ),
      },
      {
        key: "motorista",
        header: "Motorista",
        render: (r) => <span className="text-[12px]">{String(r.motorista || "—")}</span>,
      },
    ];
    csv = {
      cab: [
        "Placa",
        "Prefixo",
        "Tipo",
        "Início",
        "Fim",
        "Duração (min)",
        "Parado ligado (min)",
        "Distância (km)",
        "Vel. média",
        "Vel. máx.",
        "Local início",
        "Endereço início",
        "Local fim",
        "Endereço fim",
        "Motorista",
        "Salto de odômetro",
      ],
      lin: (r) => [
        r.placa,
        r.prefixo,
        r.tipo,
        r.inicio,
        r.fim,
        Math.round(Number(r.duracao_s ?? 0) / 60),
        r.ligado_s == null ? "" : Math.round(Number(r.ligado_s) / 60),
        r.km,
        r.vel_media,
        r.vel_max,
        r.local_inicio,
        r.endereco_inicio,
        r.local_fim,
        r.endereco_fim,
        r.motorista,
        r.salto_odometro ? "sim" : "",
      ],
    };
  } else if (aba === "consolidado") {
    linhas = (d?.consolidado as R[]) ?? [];
    colunas = [
      { key: "placa", header: "Veículo", render: placa },
      { key: "paradas", header: "Paradas", align: "right", render: (r) => nf(r.paradas) },
      { key: "parado_s", header: "Tempo parado", align: "right", render: (r) => dur(r.parado_s) },
      {
        key: "parado_ligado_s",
        header: "Parado ligado",
        align: "right",
        render: (r) => dur(r.parado_ligado_s),
      },
      {
        key: "deslocamentos",
        header: "Deslocamentos",
        align: "right",
        render: (r) => nf(r.deslocamentos),
      },
      {
        key: "movimento_s",
        header: "Em movimento",
        align: "right",
        render: (r) => dur(r.movimento_s),
      },
      { key: "km", header: "Distância", align: "right", render: (r) => `${nf(r.km, 1)} km` },
      {
        key: "vel_max",
        header: "Vel. máx.",
        align: "right",
        render: (r) => (r.vel_max == null ? "—" : `${nf(r.vel_max)} km/h`),
      },
      {
        key: "saltos",
        header: "Saltos descartados",
        align: "right",
        render: (r) =>
          Number(r.saltos) ? (
            <span className="text-coral" title="Deslocamentos com média acima de 200 km/h">
              {nf(r.saltos)} ({nf(r.km_descartado, 0)} km)
            </span>
          ) : (
            "—"
          ),
      },
    ];
    csv = {
      cab: [
        "Placa",
        "Prefixo",
        "Paradas",
        "Tempo parado (min)",
        "Parado ligado (min)",
        "Deslocamentos",
        "Em movimento (min)",
        "Distância (km)",
        "Vel. máx.",
        "Saltos descartados",
        "Km descartado",
      ],
      lin: (r) => [
        r.placa,
        r.prefixo,
        r.paradas,
        Math.round(Number(r.parado_s) / 60),
        Math.round(Number(r.parado_ligado_s) / 60),
        r.deslocamentos,
        Math.round(Number(r.movimento_s) / 60),
        r.km,
        r.vel_max,
        r.saltos,
        r.km_descartado,
      ],
    };
  } else if (aba === "paradas-poi") {
    linhas = (d?.linhas as R[]) ?? [];
    colunas = [
      { key: "placa", header: "Veículo", render: placa },
      {
        key: "ponto",
        header: "Ponto",
        render: (r) => <span className="line-clamp-2 max-w-[360px]">{String(r.ponto)}</span>,
      },
      {
        key: "inicio",
        header: "Chegou",
        render: (r) => <span className="font-mono">{dmh(r.inicio)}</span>,
      },
      {
        key: "fim",
        header: "Saiu",
        render: (r) => <span className="font-mono">{dmh(r.fim)}</span>,
      },
      {
        key: "duracao_s",
        header: "Tempo no ponto",
        align: "right",
        render: (r) => dur(r.duracao_s),
      },
      { key: "ligado_s", header: "Ligado", align: "right", render: (r) => dur(r.ligado_s) },
      {
        key: "distancia_m",
        header: "Distância do ponto",
        align: "right",
        render: (r) => (r.distancia_m == null ? "—" : `${nf(r.distancia_m)} m`),
      },
      {
        key: "motorista",
        header: "Motorista",
        render: (r) => <span className="text-[12px]">{String(r.motorista || "—")}</span>,
      },
    ];
    csv = {
      cab: [
        "Placa",
        "Prefixo",
        "Ponto",
        "Chegou",
        "Saiu",
        "Tempo no ponto (min)",
        "Ligado (min)",
        "Distância do ponto (m)",
        "Motorista",
        "Endereço",
      ],
      lin: (r) => [
        r.placa,
        r.prefixo,
        r.ponto,
        r.inicio,
        r.fim,
        Math.round(Number(r.duracao_s ?? 0) / 60),
        r.ligado_s == null ? "" : Math.round(Number(r.ligado_s) / 60),
        r.distancia_m,
        r.motorista,
        r.endereco,
      ],
    };
  } else if (aba === "passagem-poi") {
    linhas = (d?.linhas as R[]) ?? [];
    colunas = [
      { key: "placa", header: "Veículo", render: placa },
      {
        key: "ponto",
        header: "Ponto",
        render: (r) => <span className="line-clamp-2 max-w-[360px]">{String(r.ponto ?? "—")}</span>,
      },
      {
        key: "entrada",
        header: "Chegou",
        render: (r) => <span className="font-mono">{dmh(r.entrada)}</span>,
      },
      {
        key: "saida",
        header: "Saiu",
        render: (r) => <span className="font-mono">{dmh(r.saida)}</span>,
      },
      {
        key: "permanencia_s",
        header: "Permanência",
        align: "right",
        render: (r) => (Number(r.permanencia_s) ? dur(r.permanencia_s) : "passou direto"),
      },
      {
        key: "menor_distancia_m",
        header: "Mais perto",
        align: "right",
        render: (r) => `${nf(r.menor_distancia_m)} m`,
      },
      {
        key: "vel_max",
        header: "Vel. máx.",
        align: "right",
        render: (r) => `${nf(r.vel_max)} km/h`,
      },
      {
        key: "motorista",
        header: "Motorista",
        render: (r) => <span className="text-[12px]">{String(r.motorista || "—")}</span>,
      },
    ];
    csv = {
      cab: [
        "Placa",
        "Prefixo",
        "Ponto",
        "Chegou",
        "Saiu",
        "Permanência (min)",
        "Mais perto (m)",
        "Vel. máx.",
        "Motorista",
      ],
      lin: (r) => [
        r.placa,
        r.prefixo,
        r.ponto,
        r.entrada,
        r.saida,
        Math.round(Number(r.permanencia_s ?? 0) / 60),
        r.menor_distancia_m,
        r.vel_max,
        r.motorista,
      ],
    };
  } else if (aba === "cercas") {
    linhas = (d?.linhas as R[]) ?? [];
    colunas = [
      { key: "placa", header: "Veículo", render: placa },
      { key: "cerca", header: "Cerca", render: (r) => String(r.cerca ?? "Cerca sem nome") },
      {
        key: "entrada",
        header: "Entrou",
        render: (r) => <span className="font-mono">{dmh(r.entrada)}</span>,
      },
      {
        key: "saida",
        header: "Saiu",
        render: (r) =>
          r.saida ? (
            <span className="font-mono">{dmh(r.saida)}</span>
          ) : (
            <span className="text-muted-foreground">sem saída no período</span>
          ),
      },
      {
        key: "permanencia_s",
        header: "Tempo dentro",
        align: "right",
        render: (r) => dur(r.permanencia_s),
      },
      {
        key: "motorista",
        header: "Motorista",
        render: (r) => <span className="text-[12px]">{String(r.motorista || "—")}</span>,
      },
    ];
    csv = {
      cab: ["Placa", "Prefixo", "Cerca", "Entrou", "Saiu", "Tempo dentro (min)", "Motorista"],
      lin: (r) => [
        r.placa,
        r.prefixo,
        r.cerca,
        r.entrada,
        r.saida,
        r.permanencia_s == null ? "" : Math.round(Number(r.permanencia_s) / 60),
        r.motorista,
      ],
    };
  } else if (aba === "sla") {
    linhas = (d?.linhas as R[]) ?? [];
    const tom: Record<string, "green" | "coral" | "gold" | "neutral"> = {
      no_horario: "green",
      atrasado: "coral",
      adiantado: "gold",
      nao_passou: "neutral",
    };
    const rot: Record<string, string> = {
      no_horario: "No horário",
      atrasado: "Atrasado",
      adiantado: "Adiantado",
      nao_passou: "Não passou",
    };
    colunas = [
      {
        key: "dia",
        header: "Dia",
        render: (r) => (
          <span className="font-mono">
            {String(r.dia).slice(8, 10)}/{String(r.dia).slice(5, 7)}
          </span>
        ),
      },
      {
        key: "linha",
        header: "Linha",
        render: (r) => (
          <span className="font-medium text-foreground">{String(r.linha ?? "—")}</span>
        ),
      },
      { key: "tabela", header: "Viagem", render: (r) => String(r.tabela ?? "—") },
      {
        key: "veiculo",
        header: "Veículo",
        render: (r) => <span className="font-mono">{String(r.veiculo ?? "—")}</span>,
      },
      { key: "ordem", header: "Ordem", align: "right", render: (r) => nf(r.ordem) },
      {
        key: "ponto",
        header: "Ponto",
        render: (r) => <span className="line-clamp-1 max-w-[280px]">{String(r.ponto ?? "—")}</span>,
      },
      {
        key: "programado",
        header: "Programado",
        render: (r) => <span className="font-mono">{String(r.programado ?? "").slice(0, 5)}</span>,
      },
      {
        key: "realizado",
        header: "Realizado",
        render: (r) => (
          <span className="font-mono">{r.realizado ? String(r.realizado).slice(11, 16) : "—"}</span>
        ),
      },
      {
        key: "atraso_min",
        header: "Diferença",
        align: "right",
        render: (r) =>
          r.atraso_min == null
            ? "—"
            : `${Number(r.atraso_min) > 0 ? "+" : ""}${nf(r.atraso_min)} min`,
      },
      {
        key: "situacao",
        header: "Situação",
        align: "center",
        render: (r) => <Pill tone={tom[String(r.situacao)]}>{rot[String(r.situacao)]}</Pill>,
      },
    ];
    csv = {
      cab: [
        "Dia",
        "Linha",
        "Viagem",
        "Centro de custo",
        "Veículo",
        "Ordem",
        "Ponto",
        "Programado",
        "Realizado",
        "Diferença (min)",
        "Situação",
      ],
      lin: (r) => [
        r.dia,
        r.linha,
        r.tabela,
        r.centro_custo,
        r.veiculo,
        r.ordem,
        r.ponto,
        r.programado,
        r.realizado,
        r.atraso_min,
        rot[String(r.situacao)],
      ],
    };
  } else if (aba === "configuracoes") {
    linhas = ((d?.veiculos as R[]) ?? []).filter((v) => !veiculo || String(v.unit_id) === veiculo);
    const c = (k: string) => (r: R) => (
      <span className="font-mono text-[12px]">{String((r.config as R)?.[k] ?? "—")}</span>
    );
    colunas = [
      { key: "placa", header: "Veículo", render: placa },
      {
        key: "modelo",
        header: "Equipamento",
        render: (r) => (
          <span className="leading-tight">
            {String(r.modelo ?? "—")}
            <span className="block text-[12px] text-muted-foreground">
              {String(r.equipamento ?? "")}
            </span>
          </span>
        ),
      },
      {
        key: "FW",
        header: "Firmware",
        render: (r) => (
          <span className="line-clamp-2 max-w-[200px] font-mono text-[12px]">
            {String((r.config as R)?.FW ?? "—")}
          </span>
        ),
      },
      { key: "script", header: "Script", render: c("script") },
      {
        key: "calibration_factor",
        header: "Fator de consumo",
        align: "right",
        render: c("calibration_factor"),
      },
      {
        key: "rpm",
        header: "RPM verde / amarela / vermelha",
        render: (r) => {
          const x = (r.config as R) ?? {};
          return x.rpm_verde1 || x.rpm_amarela ? (
            <span className="font-mono text-[12px]">
              {String(x.rpm_verde1 ?? "?")}–{String(x.rpm_verde2 ?? "?")} /{" "}
              {String(x.rpm_amarela ?? "?")} / {String(x.rpm_vermelha ?? "?")}
            </span>
          ) : (
            "—"
          );
        },
      },
      { key: "vel_verdes", header: "Vel. faixa verde", align: "right", render: c("vel_verdes") },
      {
        key: "alterado_em",
        header: "Última alteração",
        render: (r) => (
          <span className="font-mono text-[12px]">
            {r.alterado_em
              ? `${String(r.alterado_em).slice(8, 10)}/${String(r.alterado_em).slice(5, 7)}/${String(r.alterado_em).slice(0, 4)}`
              : "—"}
          </span>
        ),
      },
    ];
    const chaves = (d?.chaves as string[]) ?? [];
    csv = {
      cab: ["Placa", "Prefixo", "Unidade", "Modelo", "Equipamento", ...chaves],
      lin: (r) => [
        r.placa,
        r.prefixo,
        r.unidade,
        r.modelo,
        r.equipamento,
        ...chaves.map((k) => (r.config as R)?.[k] ?? ""),
      ],
    };
  } else if (aba === "velocidade-limite") {
    linhas = (d?.veiculos as R[]) ?? [];
    const kmh = (v: unknown) =>
      v == null || v === "" ? "—" : `${String(v).replace(",", ".")} km/h`;
    colunas = [
      { key: "placa", header: "Veículo", render: placa },
      { key: "subgrupo", header: "Subgrupo", render: (r) => String(r.subgrupo ?? "—") },
      {
        key: "limite_veiculo",
        header: "Limite no veículo",
        align: "right",
        render: (r) => kmh(r.limite_veiculo),
      },
      {
        key: "limite_grupo",
        header: "Limite no grupo",
        align: "right",
        render: (r) => kmh(r.limite_grupo),
      },
      {
        key: "limite_equipamento",
        header: "Limite no equipamento",
        align: "right",
        render: (r) => kmh(r.limite_equipamento),
      },
      { key: "excessos", header: "Excessos", align: "right", render: (r) => nf(r.excessos) },
      { key: "km", header: "Km", align: "right", render: (r) => nf(r.km) },
      {
        key: "excessos_por_100km",
        header: "Excessos a cada 100 km",
        align: "right",
        render: (r) =>
          r.excessos_por_100km == null ? (
            "—"
          ) : Number(r.excessos_por_100km) > 100 ? (
            <span title="Mais de um excesso por quilômetro: provável contagem errada do equipamento. Conferir antes de cobrar o motorista.">
              <Pill tone="gold">{nf(r.excessos_por_100km, 1)} · conferir</Pill>
            </span>
          ) : (
            nf(r.excessos_por_100km, 1)
          ),
      },
      {
        key: "situacao",
        header: "Cadastro",
        align: "center",
        render: (r) =>
          r.situacao === "ok" ? (
            <Pill tone="green">Coerente</Pill>
          ) : r.situacao === "divergente" ? (
            <Pill tone="gold">Limites diferentes</Pill>
          ) : (
            <Pill tone="coral">Sem limite</Pill>
          ),
      },
    ];
    csv = {
      cab: [
        "Placa",
        "Prefixo",
        "Subgrupo",
        "Limite no veículo",
        "Limite no grupo",
        "Limite no equipamento",
        "Limite rodovia (equipamento)",
        "Excessos",
        "Excessos no seco",
        "Excessos na chuva",
        "Km",
        "Excessos a cada 100 km",
        "Cadastro",
      ],
      lin: (r) => [
        r.placa,
        r.prefixo,
        r.subgrupo,
        r.limite_veiculo,
        r.limite_grupo,
        r.limite_equipamento,
        r.limite_rodovia_equipamento,
        r.excessos,
        r.excessos_seco,
        r.excessos_chuva,
        r.km,
        r.excessos_por_100km,
        r.situacao,
      ],
    };
  } else if (aba === "odometro") {
    linhas = (d?.veiculos as R[]) ?? [];
    colunas = [
      { key: "placa", header: "Veículo", render: placa },
      {
        key: "odometro_travado_km",
        header: "Odômetro parado em",
        align: "right",
        render: (r) => `${nf(r.odometro_travado_km, 1)} km`,
      },
      {
        key: "odometro_bruto_km",
        header: "Equipamento está mandando",
        align: "right",
        render: (r) => (r.odometro_bruto_km == null ? "—" : `${nf(r.odometro_bruto_km, 1)} km`),
      },
      {
        key: "leituras",
        header: "Leituras em 24 h",
        align: "right",
        render: (r) => nf(r.leituras),
      },
      {
        key: "vel_max",
        header: "Vel. máx.",
        align: "right",
        render: (r) => `${nf(r.vel_max)} km/h`,
      },
      {
        key: "marcacao",
        header: "Marcação de qualidade",
        render: (r) => <span className="font-mono text-[12px]">{String(r.marcacao ?? "—")}</span>,
      },
      {
        key: "situacao",
        header: "Situação",
        align: "center",
        render: (r) =>
          r.situacao === "corrigivel" ? (
            <Pill tone="gold">Pode ser corrigido</Pill>
          ) : (
            <Pill tone="coral">Não corrigível agora</Pill>
          ),
      },
      {
        key: "ultima_correcao",
        header: "Última correção",
        render: (r) => {
          const u = r.ultima_correcao as R | null;
          return u ? `${String(u.status)} em ${dmh(u.applied_at)}` : "—";
        },
      },
    ];
    csv = {
      cab: [
        "Placa",
        "Prefixo",
        "Odômetro parado (km)",
        "Odômetro do equipamento (km)",
        "Leituras 24h",
        "Vel. máx.",
        "Marcação",
        "Situação",
      ],
      lin: (r) => [
        r.placa,
        r.prefixo,
        r.odometro_travado_km,
        r.odometro_bruto_km,
        r.leituras,
        r.vel_max,
        r.marcacao,
        r.situacao === "corrigivel" ? "pode ser corrigido" : "não corrigível agora",
      ],
    };
  } else {
    linhas = linhasDist;
    colunas = [
      { key: "placa", header: "Veículo", render: placa },
      {
        key: "dia",
        header: porSemana ? "Semana de" : "Dia",
        render: (r) => (
          <span className="font-mono">
            {String(r.dia).slice(8, 10)}/{String(r.dia).slice(5, 7)}
          </span>
        ),
      },
      {
        key: "km",
        header: "Distância",
        align: "right",
        render: (r) => (r.km == null ? "—" : `${nf(r.km, 1)} km`),
      },
      {
        key: "horas",
        header: "Horas de motor",
        align: "right",
        render: (r) =>
          r.horas == null || (porSemana && !Number(r.horas)) ? "—" : `${nf(r.horas, 1)} h`,
      },
      {
        key: "litros",
        header: "Combustível",
        align: "right",
        render: (r) => (Number(r.litros) > 0 ? `${nf(r.litros, 0)} L` : "—"),
      },
      {
        key: "km_l",
        header: "Km/l",
        align: "right",
        render: (r) => (r.km_l != null ? nf(Number(r.km_l), 2) : "—"),
      },
      {
        key: "kmh",
        header: "Km por hora de motor",
        align: "right",
        render: (r) =>
          Number(r.horas) > 0 && r.km != null ? nf(Number(r.km) / Number(r.horas), 1) : "—",
      },
      ...(porSemana
        ? [
            {
              key: "dias_com_dado",
              header: "Dias com dado",
              align: "right" as const,
              render: (r: R) => nf(r.dias_com_dado),
            },
          ]
        : [
            {
              key: "leituras_corrigidas",
              header: "Leituras corrigidas",
              align: "right" as const,
              render: (r: R) =>
                Number(r.leituras_corrigidas) ? (
                  <span title="Leituras de odômetro marcadas como erradas pela regra de qualidade; ficam fora do cálculo.">
                    {nf(r.leituras_corrigidas)}
                  </span>
                ) : (
                  "—"
                ),
            },
          ]),
    ];
    csv = {
      cab: [
        "Placa",
        "Prefixo",
        porSemana ? "Semana de" : "Dia",
        "Distância (km)",
        "Horas de motor",
        "Combustível (L)",
        "Km/l",
      ],
      lin: (r) => [
        r.placa,
        r.prefixo,
        r.dia,
        r.km,
        r.horas,
        r.litros,
        r.km_l == null ? "" : Number(r.km_l).toFixed(2),
      ],
    };
  }

  const totais = (() => {
    if (aba === "distancia")
      return `${nf(
        linhas.reduce((a, r) => a + Number(r.km ?? 0), 0),
        0,
      )} km · ${nf(
        linhas.reduce((a, r) => a + Number(r.horas ?? 0), 0),
        0,
      )} h de motor · ${nf(
        linhas.reduce((a, r) => a + Number(r.litros ?? 0), 0),
        0,
      )} L`;
    if (aba === "sla") {
      const ps = (d?.por_linha as R[]) ?? [];
      const tot = ps.reduce((a, s) => a + Number(s.pontos), 0),
        ok = ps.reduce((a, s) => a + Number(s.no_horario), 0),
        np = ps.reduce((a, s) => a + Number(s.nao_passou), 0);
      return `${nf(tot)} pontos · ${nf(tot ? (100 * ok) / tot : 0)}% no horário · ${nf(tot - np ? (100 * ok) / (tot - np) : 0)}% dos que passaram`;
    }
    if (aba === "configuracoes")
      return `${nf(linhas.length)} veículos · ${nf(((d?.chaves as string[]) ?? []).length)} configurações (todas no CSV)`;
    if (aba === "odometro") return `${nf(linhas.length)} veículo(s) com odômetro travado`;
    if (aba === "velocidade-limite") {
      const rs = (d?.resumo as R) ?? {};
      return `${nf(d?.excessos)} excessos · ${nf(rs.divergente)} com limites diferentes · ${nf(rs.sem_limite)} sem limite`;
    }
    if (aba === "consolidado")
      return `${nf(
        linhas.reduce((a, r) => a + Number(r.km ?? 0), 0),
        0,
      )} km em ${nf(linhas.length)} veículos`;
    return `${nf(linhas.length)} registros${d?.cortado ? " (os 5.000 mais recentes — filtre um veículo ou encurte o período)" : ""}`;
  })();

  const css = "h-9 rounded-lg border border-border bg-white px-3 text-[13px] text-foreground";
  return (
    <>
      <PageHeader title="Relatórios de frota" subtitle={cfg.dica} />
      <div className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
        {onVoltar && (
          <button
            type="button"
            onClick={onVoltar}
            className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-brand-navy hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para a central de relatórios
          </button>
        )}
        <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => trocarAba(a.id)}
              title={a.dica}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-[13px]",
                aba === a.id
                  ? "border-brand-blue font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {a.rotulo}
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          {!semPeriodo && (
            <>
              <label className="text-[12px] text-muted-foreground">
                De{" "}
                <input
                  type="date"
                  value={inicio}
                  max={fim}
                  onChange={(e) => setInicio(e.target.value)}
                  className={cn(css, "ml-1")}
                />
              </label>
              <label className="text-[12px] text-muted-foreground">
                até{" "}
                <input
                  type="date"
                  value={fim}
                  min={inicio}
                  max={iso(new Date())}
                  onChange={(e) => setFim(e.target.value)}
                  className={cn(css, "ml-1")}
                />
              </label>
            </>
          )}
          {aba !== "sla" && aba !== "odometro" && (
            <select
              value={veiculo}
              onChange={(e) => setVeiculo(e.target.value)}
              className={cn(css, "max-w-[260px]")}
              aria-label="Veículo"
            >
              <option value="">Todos os veículos</option>
              {(veiculos.data?.data ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.placa}
                  {v.prefixo ? ` · ${v.prefixo}` : ""}
                </option>
              ))}
            </select>
          )}
          {aba === "paradas" && (
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={css}
              aria-label="Tipo"
            >
              <option value="">Paradas e deslocamentos</option>
              <option value="parada">Só paradas</option>
              <option value="deslocamento">Só deslocamentos</option>
            </select>
          )}
          {["paradas", "consolidado", "paradas-poi"].includes(aba) && (
            <label className="text-[12px] text-muted-foreground">
              Duração mínima
              <select
                value={minMin}
                onChange={(e) => setMinMin(Number(e.target.value))}
                className={cn(css, "ml-1")}
              >
                {[0, 2, 5, 10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {m ? `${m} min` : "qualquer"}
                  </option>
                ))}
              </select>
            </label>
          )}
          {aba === "passagem-poi" && (
            <label className="text-[12px] text-muted-foreground">
              Distância do ponto
              <select
                value={distancia}
                onChange={(e) => setDistancia(Number(e.target.value))}
                className={cn(css, "ml-1")}
              >
                {[50, 100, 200, 500, 1000].map((m) => (
                  <option key={m} value={m}>
                    até {m} m
                  </option>
                ))}
              </select>
            </label>
          )}
          {aba === "distancia" && (
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={porSemana}
                onChange={(e) => setPorSemana(e.target.checked)}
              />{" "}
              Somar por semana
            </label>
          )}
          <span className="text-[12px] text-muted-foreground">
            {semPeriodo
              ? aba === "odometro"
                ? "Últimas 24 horas."
                : "Situação atual."
              : `Até ${cfg.maxDias} dias.`}
          </span>
          {q.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {!periodoOk && (
          <Card>
            <p className="p-4 text-[13px] text-coral">
              Escolha um período de 1 a {cfg.maxDias} dias.
            </p>
          </Card>
        )}
        {q.isError && (
          <Card>
            <p className="p-4 text-[13px] text-coral">{mensagemErro(q.error)}</p>
          </Card>
        )}
        {q.isLoading && periodoOk && (
          <Card>
            <p className="flex items-center gap-2 p-6 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando o relatório…
            </p>
          </Card>
        )}

        {d && (
          <>
            {aba === "sla" && ((d.por_linha as R[]) ?? []).length > 0 && (
              <Card title="SLA por linha" className="mb-4" bodyClassName="p-4">
                <DataTable
                  porPagina={10}
                  rows={d.por_linha as R[]}
                  columns={[
                    {
                      key: "linha",
                      header: "Linha",
                      render: (r) => (
                        <span className="font-medium text-foreground">{String(r.linha)}</span>
                      ),
                    },
                    {
                      key: "pontos",
                      header: "Pontos",
                      align: "right",
                      render: (r) => nf(r.pontos),
                    },
                    {
                      key: "no_horario",
                      header: "No horário",
                      align: "right",
                      render: (r) => nf(r.no_horario),
                    },
                    {
                      key: "atrasado",
                      header: "Atrasados",
                      align: "right",
                      render: (r) => nf(r.atrasado),
                    },
                    {
                      key: "adiantado",
                      header: "Adiantados",
                      align: "right",
                      render: (r) => nf(r.adiantado),
                    },
                    {
                      key: "nao_passou",
                      header: "Não passou",
                      align: "right",
                      render: (r) => nf(r.nao_passou),
                    },
                    {
                      key: "sla",
                      header: "SLA",
                      align: "center",
                      render: (r) => (
                        <Pill
                          tone={
                            Number(r.sla) >= 80 ? "green" : Number(r.sla) >= 50 ? "gold" : "coral"
                          }
                        >
                          {nf(r.sla)}%
                        </Pill>
                      ),
                    },
                    {
                      key: "sla_passou",
                      header: "SLA dos que passaram",
                      align: "center",
                      render: (r) => {
                        const p = Number(r.pontos) - Number(r.nao_passou);
                        return p ? `${nf((100 * Number(r.no_horario)) / p)}%` : "—";
                      },
                    },
                  ]}
                />
              </Card>
            )}
            {(aba === "paradas-poi" || aba === "passagem-poi") &&
              ((d.por_ponto as R[]) ?? []).length > 0 && (
                <Card title="Pontos com mais visitas" className="mb-4" bodyClassName="p-4">
                  <DataTable
                    porPagina={10}
                    rows={d.por_ponto as R[]}
                    columns={[
                      {
                        key: "ponto",
                        header: "Ponto",
                        render: (r) => (
                          <span className="line-clamp-1 max-w-[520px]">
                            {String(r.ponto ?? "—")}
                          </span>
                        ),
                      },
                      {
                        key: aba === "paradas-poi" ? "paradas" : "passagens",
                        header: aba === "paradas-poi" ? "Paradas" : "Passagens",
                        align: "right",
                        render: (r) => nf(r.paradas ?? r.passagens),
                      },
                      {
                        key: "veiculos",
                        header: "Veículos",
                        align: "right",
                        render: (r) => nf(r.veiculos),
                      },
                      ...(aba === "paradas-poi"
                        ? [
                            {
                              key: "media_s",
                              header: "Tempo médio",
                              align: "right" as const,
                              render: (r: R) => dur(r.media_s),
                            },
                            {
                              key: "total_s",
                              header: "Tempo total",
                              align: "right" as const,
                              render: (r: R) => dur(r.total_s),
                            },
                          ]
                        : []),
                    ]}
                  />
                </Card>
              )}
            {aba === "distancia" && ((d.descartes as R[]) ?? []).length > 0 && (
              <p className="mb-3 flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[12px] text-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                {nf((d.descartes as R[]).length)} dia(s) descartado(s) por valor impossível (ex.:{" "}
                {String((d.descartes as R[])[0].placa)} em{" "}
                {String((d.descartes as R[])[0].dia).slice(8, 10)}/
                {String((d.descartes as R[])[0].dia).slice(5, 7)}:{" "}
                {String((d.descartes as R[])[0].motivo)}).
              </p>
            )}
            {aba === "distancia" && serieDist.length > 1 && (
              <Card
                title={
                  porSemana
                    ? "Distância e combustível por semana"
                    : "Distância e combustível por dia"
                }
                icon={BarChart3}
                className="mb-4"
                bodyClassName="p-4"
              >
                <div style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <ComposedChart
                      data={serieDist}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="rotulo"
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        yAxisId="km"
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        tickFormatter={(v) => nf(v)}
                        width={56}
                      />
                      <YAxis
                        yAxisId="l"
                        orientation="right"
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        tickFormatter={(v) => nf(v)}
                        width={56}
                      />
                      <Tooltip
                        formatter={(v: number, n: string) =>
                          n === "Distância" ? `${nf(v)} km` : `${nf(v)} L`
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar
                        yAxisId="km"
                        dataKey="km"
                        name="Distância"
                        fill="var(--brand-navy)"
                        radius={[3, 3, 0, 0]}
                      />
                      <Line
                        yAxisId="l"
                        dataKey="litros"
                        name="Combustível"
                        stroke="var(--gold)"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Soma da frota{veiculo ? " (veículo escolhido)" : ""}. Combustível só com os dias
                  de leitura possível (mesma regra do Controle de combustível).
                </p>
              </Card>
            )}
            {aba === "cercas" && Number(d.saidas_sem_entrada) > 0 && (
              <p className="mb-3 text-[12px] text-muted-foreground">
                {nf(d.saidas_sem_entrada)} saída(s) sem a entrada no período (o veículo já estava
                dentro quando o período começou) não aparecem na lista.
              </p>
            )}
            <Card
              title={cfg.rotulo}
              bodyClassName="p-4"
              action={
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-muted-foreground">{totais}</span>
                  {csv && linhas.length > 0 && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px]"
                      onClick={() =>
                        baixarCsv(`${aba}-${inicio}-a-${fim}.csv`, csv!.cab, linhas.map(csv!.lin))
                      }
                    >
                      <Download className="h-3.5 w-3.5" /> Exportar CSV
                    </button>
                  )}
                </div>
              }
            >
              <DataTable columns={colunas} rows={linhas} empty="Nada encontrado no período." />
            </Card>
            {aba === "velocidade-limite" && (
              <p className="mt-3 text-[12px] text-muted-foreground">
                Há três lugares onde a velocidade máxima é cadastrada: no veículo, no grupo e no
                equipamento. Ainda não está definido qual deles vale para o excesso, por isso os
                três aparecem aqui. Excessos = soma das contagens de excesso no seco e na chuva do
                consolidado diário (a mesma fonte do Power BI). Veículo com mais de um excesso por
                quilômetro provavelmente tem contagem errada no equipamento.
              </p>
            )}
            {aba === "odometro" && (
              <p className="mt-3 text-[12px] text-muted-foreground">
                O veículo andou (velocidade acima de 20 km/h) e o odômetro ficou no mesmo valor em
                pelo menos 30 leituras. "Pode ser corrigido": as 5 leituras mais recentes do
                equipamento sobem normalmente — a correção continua sendo aplicada no Painel de
                Calibração do sistema atual.
              </p>
            )}
            {aba === "sla" && (
              <p className="mt-3 text-[12px] text-muted-foreground">
                No horário = até {nf(d.tolerancia_min)} min antes ou depois do programado. "Não
                passou" = a viagem não registrou passagem pelo ponto.
              </p>
            )}
            {aba === "distancia" && (
              <p className="mt-3 text-[12px] text-muted-foreground">
                Distância = maior − menor odômetro com ignição ligada, só com as leituras que a
                regra de qualidade aprovou. Horas de motor = soma do avanço do horímetro entre
                leituras seguidas; saltos do contador ficam fora.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
