import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bus, Check, RefreshCw, Siren, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { alarmesOperacionaisQuery, desde, linhasQuery, nf, veiculosQuery } from "@/lib/queries";
import { registrarAuditoria } from "@/lib/session";
import { ALARME_OPERACIONAL_LABEL, type AlarmeOperacional, type TipoAlarmeOperacional } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Alarmes operacionais — os desvios que só existem quando há programação.
 *
 * Diferente do módulo de Eventos (comportamento de condução e vídeo), aqui o
 * disparo vem do confronto com a linha e o ponto de controle: abrir viagem fora
 * do PC, ficar parado com viagem aberta, furar o headway.
 *
 * A pontuação é somada por tipo. Em contrato de concessão ela costuma virar
 * desconto em medição, então o total é tão relevante quanto a contagem.
 */

const TIPO_TONE: Record<TipoAlarmeOperacional, PillTone> = {
  abertura_fora_pc: "coral",
  parado_com_viagem_aberta: "gold",
  velocidade_maxima: "coral",
  viagem_nao_iniciada: "coral",
  fora_itinerario: "gold",
  headway_irregular: "sky",
};

/**
 * Ocorrências operacionais.
 *
 * Vive dentro da tela de Alarmes porque a regra e o que ela dispara são a mesma
 * coisa vista de dois lados. Ter a configuração num módulo e as ocorrências em
 * outro obrigava o usuário a lembrar em qual dos dois estava o que procurava.
 */
export function AlarmesOperacionaisPainel() {
  const [linhaId, setLinhaId] = useState("");
  const [tratados, setTratados] = useState<Record<string, boolean>>({});
  const [mostrarTratados, setMostrarTratados] = useState(false);

  const linhasQ = useQuery(linhasQuery());
  const veiculosQ = useQuery(veiculosQuery(1, 200));
  const alarmesQ = useQuery(alarmesOperacionaisQuery(linhaId || undefined));

  const prefixoPorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of veiculosQ.data?.items ?? []) m.set(v.id, v.prefixo ?? v.placa);
    return m;
  }, [veiculosQ.data]);

  const codigoLinha = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of linhasQ.data ?? []) m.set(l.id, l.codigo);
    return m;
  }, [linhasQ.data]);

  const todos = useMemo(
    () => (alarmesQ.data ?? []).map((a) => ({ ...a, tratado: tratados[a.id] ?? a.tratado })),
    [alarmesQ.data, tratados],
  );

  const abertos = todos.filter((a) => !a.tratado);
  const lista = mostrarTratados ? todos : abertos;

  const pontuacaoTotal = abertos.reduce((s, a) => s + a.pontuacao, 0);
  const veiculosEnvolvidos = new Set(abertos.map((a) => a.veiculoId)).size;

  /** Agrupamento por tipo — é assim que o CCO lê o painel. */
  const porTipo = useMemo(() => {
    const m = new Map<TipoAlarmeOperacional, AlarmeOperacional[]>();
    for (const a of lista) {
      if (!m.has(a.tipo)) m.set(a.tipo, []);
      m.get(a.tipo)!.push(a);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [lista]);

  const tratar = (a: AlarmeOperacional) => {
    setTratados((t) => ({ ...t, [a.id]: true }));
    registrarAuditoria("tratativa_alarme", `Alarme tratado: ${ALARME_OPERACIONAL_LABEL[a.tipo]} · linha ${codigoLinha.get(a.linhaId) ?? a.linhaId}.`);
    toast.success("Alarme tratado.", { description: ALARME_OPERACIONAL_LABEL[a.tipo] });
  };

  const colunas = (grupo: AlarmeOperacional[]): Column<AlarmeOperacional & Record<string, unknown>>[] => [
    {
      key: "linhaId",
      header: "Linha",
      render: (a) => (
        <span className="whitespace-nowrap font-mono text-[13px] font-semibold text-foreground">
          {codigoLinha.get(a.linhaId) ?? "—"}
        </span>
      ),
    },
    {
      key: "sentido",
      header: "Sentido",
      align: "center",
      render: (a) => <span className="text-[12.5px] text-ink-soft">{a.sentido === "ida" ? "Ida" : a.sentido === "volta" ? "Volta" : "—"}</span>,
    },
    {
      key: "veiculoId",
      header: "Veículo",
      render: (a) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <Bus className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-mono text-[13px] font-semibold text-foreground">
            {prefixoPorId.get(a.veiculoId) ?? "—"}
          </span>
        </span>
      ),
    },
    {
      key: "em",
      header: "Hora",
      render: (a) => (
        <span className="whitespace-nowrap font-mono text-[12.5px] text-ink-soft" title={new Date(a.em).toLocaleString("pt-BR")}>
          {new Date(a.em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          <span className="ml-1.5 text-muted-foreground">({desde(a.em)})</span>
        </span>
      ),
    },
    {
      key: "matricula",
      header: "Matrícula",
      render: (a) => <span className="font-mono text-[12px] text-muted-foreground">{a.matricula ?? "—"}</span>,
    },
    { key: "observacao", header: "Observação", render: (a) => <span className="text-[12.5px]">{a.observacao ?? "—"}</span> },
    {
      key: "pontuacao",
      header: "Pontos",
      align: "center",
      render: (a) => (
        <span className="font-mono text-[13px] font-bold text-coral" title="Pontuação de gravidade">
          {a.pontuacao}
        </span>
      ),
    },
    {
      key: "acao",
      header: "",
      align: "center",
      render: (a) =>
        a.tratado ? (
          <Pill tone="green">
            <Check className="h-3 w-3" />
            Tratado
          </Pill>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              tratar(a);
            }}
            className="rounded-lg border border-border bg-white px-2.5 py-1 text-[12px] font-medium text-brand-navy transition-colors hover:bg-secondary"
          >
            Tratar
          </button>
        ),
    },
  ];

  return (

    <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-foreground">Ocorrências operacionais</h2>
          <div className="flex items-center gap-2">
            <select
              value={linhaId}
              onChange={(e) => setLinhaId(e.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
            >
              <option value="">Todas as linhas</option>
              {(linhasQ.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.codigo}
                </option>
              ))}
            </select>
            <button
              onClick={() => alarmesQ.refetch()}
              disabled={alarmesQ.isFetching}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary disabled:opacity-60"
            >
              <RefreshCw className={cn("h-[15px] w-[15px]", alarmesQ.isFetching && "animate-spin")} />
              Atualizar
            </button>
          </div>
        </div>

        {alarmesQ.error ? (
          <ErrorBox error={alarmesQ.error} onRetry={() => alarmesQ.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={Siren} label="Alarmes abertos" value={nf(abertos.length)} color="var(--coral)" />
              <StatTile icon={Bus} label="Veículos envolvidos" value={nf(veiculosEnvolvidos)} color="var(--brand-navy)" />
              <StatTile
                icon={TrendingUp}
                label="Pontuação acumulada"
                value={nf(pontuacaoTotal)}
                color="var(--gold)"
                foot="pode virar desconto em medição"
              />
              <StatTile icon={Check} label="Tratados" value={nf(todos.filter((a) => a.tratado).length)} color="var(--leaf)" />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setMostrarTratados((v) => !v)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                  mostrarTratados
                    ? "bg-brand-navy text-white"
                    : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                {mostrarTratados ? "Ocultando nada" : "Mostrar também os tratados"}
              </button>
            </div>

            {alarmesQ.isPending ? (
              <Card title="Carregando" icon={Siren}>
                <SkeletonRows rows={6} />
              </Card>
            ) : porTipo.length === 0 ? (
              <Card title="Alarmes" icon={Siren} bodyClassName="p-4">
                <EmptyNote>Nenhum alarme aberto nesta seleção. A operação está aderente à programação.</EmptyNote>
              </Card>
            ) : (
              porTipo.map(([tipo, grupo]) => {
                const pontos = grupo.reduce((s, a) => s + a.pontuacao, 0);
                return (
                  <Card
                    key={tipo}
                    title={ALARME_OPERACIONAL_LABEL[tipo]}
                    icon={AlertTriangle}
                    action={
                      <span className="flex items-center gap-2">
                        <Pill tone={TIPO_TONE[tipo]}>{grupo.length} alarme{grupo.length > 1 ? "s" : ""}</Pill>
                        <Pill tone="neutral">{new Set(grupo.map((a) => a.veiculoId)).size} veículos</Pill>
                        <Pill tone="coral">{pontos} pts</Pill>
                      </span>
                    }
                    bodyClassName="p-4"
                  >
                    <DataTable columns={colunas(grupo)} rows={grupo as (AlarmeOperacional & Record<string, unknown>)[]} />
                  </Card>
                );
              })
            )}
          </>
        )}
    </div>
  );
}
