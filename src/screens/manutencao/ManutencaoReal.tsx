import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Gauge,
  LayoutGrid,
  Loader2,
  Plus,
  Search,
  Siren,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InspecaoVeiculo } from "@/components/ss/frota/InspecaoVeiculo";
import { RelatorioVeiculo } from "@/screens/manutencao/RelatorioVeiculo";
import { tipoPorCategoria } from "@/components/ss/mapa/iconesVeiculo";
import { ManutencaoKanban } from "@/components/ss/frota/ManutencaoKanban";
import { MANUTENCAO_COLUNAS } from "@/lib/queries";
import type { CardManutencao } from "@/types";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { mensagemErro } from "@/lib/suporte-api";
import {
  Manut,
  ROTULO_STATUS_OS,
  historicoServicosQuery,
  modelosPlanoQuery,
  ordensQueryReal,
  painelManutQuery,
  planosQuery,
  type ItemPlano,
  type ItemSituacao,
  type OrdemServico,
  type PainelManut,
  type Plano,
  type StatusOS,
  type VeiculoManut,
} from "@/lib/manutencao-api";
import { cn } from "@/lib/utils";

/**
 * Manutenção com dados reais.
 *
 * - Preventiva: o cliente cadastra planos (por tipo de veículo, modelo ou
 *   veículo) a partir de modelos sugeridos; o vencimento é calculado pelo
 *   odômetro real e pela data do último serviço registrado.
 * - Corretiva: alertas automáticos pelos sinais do motor (últimas 24 h) que
 *   viram ordem de serviço, acompanhada até fechar.
 */

type Aba = "quadro" | "geral" | "preventiva" | "corretiva" | "planos";
const nf = (v: number | null | undefined, c = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const dataBR = (s?: string | null) => (s ? new Date(s.length <= 10 ? `${s}T12:00` : s).toLocaleDateString("pt-BR") : "—");
const hoje = () => new Date().toISOString().slice(0, 10);
/** Prefixo e placa juntos: em alguns clientes o "prefixo" do cadastro guarda o modelo, e só a placa distingue. */
const nomeVeiculo = (v: { prefixo: string | null; placa: string | null; unit_id: number }) =>
  [v.prefixo?.trim(), v.placa?.trim()].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join(" · ") || `#${v.unit_id}`;

const SIT: Record<ItemSituacao["situacao"], { rotulo: string; tom: PillTone }> = {
  vencido: { rotulo: "Vencido", tom: "coral" },
  vence_em_breve: { rotulo: "Vence em breve", tom: "gold" },
  sem_registro: { rotulo: "Sem registro", tom: "neutral" },
  em_dia: { rotulo: "Em dia", tom: "green" },
};
const PRIOR: Record<OrdemServico["prioridade"], PillTone> = { critica: "coral", alta: "gold", media: "sky", baixa: "neutral" };
const COLUNAS: StatusOS[] = ["aberta", "em_andamento", "aguardando_peca", "concluida"];

function falta(i: ItemSituacao) {
  const partes: string[] = [];
  if (i.falta_km != null) partes.push(i.falta_km <= 0 ? `${nf(-i.falta_km)} km atrasado` : `faltam ${nf(i.falta_km)} km`);
  if (i.falta_dias != null) partes.push(i.falta_dias <= 0 ? `${nf(-i.falta_dias)} dias atrasado` : `faltam ${nf(i.falta_dias)} dias`);
  if (i.falta_horas != null) partes.push(i.falta_horas <= 0 ? `${nf(-i.falta_horas)} h de motor atrasado` : `faltam ${nf(i.falta_horas)} h de motor`);
  return partes.join(" · ") || "registre a última vez que foi feito";
}

export default function ManutencaoReal({ abaInicial = "quadro" }: { abaInicial?: Aba }) {
  const g = grupoAtivo();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [veiculoId, setVeiculoId] = useState<number | null>(null);
  const [ordemId, setOrdemId] = useState<number | null>(null);
  const q = useQuery(painelManutQuery(g));
  const ordens = useQuery(ordensQueryReal(g));
  const r = q.data;
  const veiculo = r?.veiculos.find((v) => v.unit_id === veiculoId) ?? null;

  if (!g) {
    return (
      <>
        <PageHeader title="Manutenção" subtitle="Preventiva e corretiva da frota" />
        <p className="px-8 py-6 text-[13px] text-muted-foreground">Escolha uma empresa no topo do menu para ver a manutenção da frota.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Manutenção" subtitle="Preventiva pelo odômetro real · corretiva pelos sinais do motor" />
      <main className="space-y-5 px-4 py-6 sm:px-8">
        <nav className="flex gap-1 rounded-2xl border border-border bg-card p-1" aria-label="Seções da manutenção">
          {(
            [
              ["quadro", "Quadro", LayoutGrid],
              ["geral", "Sinais do motor", Gauge],
              ["preventiva", "Preventiva", CalendarClock],
              ["corretiva", "Corretiva e ordens", Siren],
              ["planos", "Planos", ClipboardList],
            ] as const
          ).map(([id, rotulo, Icone]) => (
            <button
              key={id}
              type="button"
              onClick={() => setAba(id)}
              aria-current={aba === id ? "page" : undefined}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium transition",
                aba === id ? "bg-brand-navy text-white" : "text-muted-foreground hover:bg-secondary",
              )}
            >
              <Icone className="h-4 w-4" /> {rotulo}
            </button>
          ))}
        </nav>

        {q.isLoading ? (
          <p className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-8 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lendo odômetros e sinais da frota…
          </p>
        ) : q.isError || !r ? (
          <p className="rounded-2xl border border-coral-line bg-coral-tint px-5 py-4 text-[13px]">{mensagemErro(q.error)}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile icon={AlertTriangle} label="Serviços vencidos" value={nf(r.totais.itens_vencidos)} color="var(--coral)" foot={`${nf(r.totais.veiculos_com_vencido)} veículos`} />
              <StatTile icon={CalendarClock} label="Vencem em breve" value={nf(r.totais.itens_vencendo)} color="var(--gold)" foot="até 1.000 km ou 15 dias" />
              <StatTile icon={Siren} label="Alertas do motor" value={nf(r.totais.alertas)} color="var(--coral)" foot={`${nf(r.totais.alertas_criticos)} críticos`} />
              <StatTile icon={Wrench} label="Ordens abertas" value={nf(r.totais.ordens_abertas)} color="var(--brand-navy)" foot="corretivas e preventivas" />
              <StatTile icon={ClipboardList} label="Veículos com plano" value={`${nf(r.totais.com_plano)}/${nf(r.totais.veiculos)}`} color="var(--leaf)" foot={r.totais.com_plano ? "plano preventivo" : "cadastre em Planos"} />
            </div>

            {aba === "quadro" && <Quadro veiculos={r.veiculos} ordens={ordens.data ?? []} onVeiculo={setVeiculoId} />}
            {aba === "geral" && <VisaoGeral r={r} onVeiculo={setVeiculoId} irPlanos={() => setAba("planos")} />}
            {aba === "preventiva" && <Preventiva veiculos={r.veiculos} onVeiculo={setVeiculoId} irPlanos={() => setAba("planos")} />}
            {aba === "corretiva" && <Corretiva g={g} veiculos={r.veiculos} ordens={ordens.data ?? []} onVeiculo={setVeiculoId} onOrdem={setOrdemId} />}
            {aba === "planos" && <Planos g={g} veiculos={r.veiculos} />}
          </>
        )}
      </main>

      <DetalheVeiculo g={g} v={veiculo} limites={r?.limites ?? {}} ordens={ordens.data ?? []} onClose={() => setVeiculoId(null)} />
      <DetalheOrdem g={g} o={(ordens.data ?? []).find((o) => o.id === ordemId) ?? null} veiculos={r?.veiculos ?? []} onClose={() => setOrdemId(null)} />
    </>
  );
}

// ------------------------------------------------------------------ Quadro

/**
 * Quadro (kanban) com uma placa por cartão, na coluna da pendência mais grave:
 * corretiva (alerta do motor ou OS corretiva aberta) > preventiva (serviço
 * vencido ou OS preventiva aberta) > preditiva (vence em breve) > liberado
 * (OS concluída nos últimos 7 dias) > em dia.
 */
function cartoes(veiculos: VeiculoManut[], ordens: OrdemServico[]): CardManutencao[] {
  const abertas = new Map<number, OrdemServico[]>();
  const liberadas = new Set<number>();
  const semana = Date.now() - 7 * 86_400_000;
  for (const o of ordens) {
    if (o.status === "concluida" && o.concluida_em && new Date(o.concluida_em).getTime() > semana) liberadas.add(o.unit_id);
    if (o.status !== "concluida" && o.status !== "cancelada") abertas.set(o.unit_id, [...(abertas.get(o.unit_id) ?? []), o]);
  }
  return veiculos.map((v) => {
    const os = abertas.get(v.unit_id) ?? [];
    const venc = v.itens.filter((i) => i.situacao === "vencido");
    const breve = v.itens.filter((i) => i.situacao === "vence_em_breve");
    const osCorr = os.filter((o) => o.tipo === "corretiva");
    const osPrev = os.filter((o) => o.tipo === "preventiva");
    let status: CardManutencao["status"] = "em_dia";
    let servico = v.plano ? "Plano em dia, sem alerta do motor." : "Sem plano preventivo · sem alerta do motor.";
    let prazo: number | null = null;
    if (v.alertas.length || osCorr.length) {
      status = "corretiva";
      servico = osCorr[0] ? `OS ${osCorr[0].id} · ${osCorr[0].titulo} (${ROTULO_STATUS_OS[osCorr[0].status].toLowerCase()})` : `${v.alertas[0].titulo} · ${v.alertas[0].valor}`;
    } else if (venc.length || osPrev.length) {
      status = "preventiva";
      servico = osPrev[0] ? `OS ${osPrev[0].id} · ${osPrev[0].titulo}` : `${venc[0].servico} · ${falta(venc[0])}`;
      prazo = venc[0]?.falta_dias ?? null;
    } else if (breve.length) {
      status = "preditiva";
      servico = `${breve[0].servico} · ${falta(breve[0])}`;
      prazo = breve[0].falta_dias;
    } else if (liberadas.has(v.unit_id)) {
      status = "liberado";
      servico = "Ordem de serviço concluída nesta semana.";
    }
    const tipo = tipoPorCategoria(v.categoria_id);
    return {
      veiculoId: String(v.unit_id),
      placa: nomeVeiculo(v),
      // A silhueta do cartão é escolhida pelo texto: o tipo do cadastro garante o desenho certo.
      marca: tipo === "onibus" ? "Ônibus" : tipo === "caminhao" ? "Caminhão" : tipo === "carro" ? "Van" : "",
      modelo: v.modelo ?? v.categoria ?? "",
      status,
      servico,
      prazoDias: prazo,
      indiceSaude: null,
      custoEstimado: null,
      pendencias: v.alertas.length + venc.length + breve.length + os.length,
    };
  });
}

function Quadro({ veiculos, ordens, onVeiculo }: { veiculos: VeiculoManut[]; ordens: OrdemServico[]; onVeiculo: (id: number) => void }) {
  const [busca, setBusca] = useState("");
  const todos = useMemo(() => cartoes(veiculos, ordens), [veiculos, ordens]);
  const cards = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return todos.filter((c) => !b || `${c.placa} ${c.modelo}`.toLowerCase().includes(b));
  }, [todos, busca]);
  const conta = (s: CardManutencao["status"]) => todos.filter((c) => c.status === s).length;
  return (
    <Card
      title="Quadro da frota"
      icon={LayoutGrid}
      action={
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar veículo" aria-label="Buscar veículo" className="h-8 w-48 rounded-lg border border-border bg-white pl-8 pr-3 text-[13px]" />
        </label>
      }
      bodyClassName="p-4"
    >
      <div className="mb-3 flex flex-wrap gap-3 text-[12px] text-muted-foreground">
        {MANUTENCAO_COLUNAS.map((c) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.cor }} />
            {c.label}: <b className="text-foreground">{conta(c.id)}</b>
          </span>
        ))}
      </div>
      <ManutencaoKanban cards={cards} onSelect={(c) => onVeiculo(Number(c.veiculoId))} />
      <p className="mt-2 text-[12px] text-muted-foreground">
        Um cartão por veículo, na coluna da pendência mais grave: corretiva (alerta do motor ou ordem corretiva aberta), preventiva (serviço vencido),
        preditiva (vence em breve), liberado (ordem concluída nesta semana). Clique no cartão para abrir o veículo.
      </p>
    </Card>
  );
}

// ------------------------------------------------------------- Visão geral

function VisaoGeral({ r, onVeiculo, irPlanos }: { r: PainelManut; onVeiculo: (id: number) => void; irPlanos: () => void }) {
  const atencao = r.veiculos.filter((v) => v.alertas.length || v.vencidos || v.vencendo).slice(0, 12);
  const [sel, setSel] = useState<number | null>(atencao[0]?.unit_id ?? r.veiculos[0]?.unit_id ?? null);
  const v = r.veiculos.find((x) => x.unit_id === sel) ?? null;
  const [ponto, setPonto] = useState<{ rotulo: string; valor: string; detalhe: string } | null>(null);
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.15fr]">
      <Card title="Precisa de atenção" icon={AlertTriangle} bodyClassName="p-2">
        {!atencao.length ? (
          <div className="space-y-2 px-3 py-4 text-[13px] text-muted-foreground">
            <p>Nenhum veículo com alerta do motor ou serviço vencido agora.</p>
            {!r.totais.com_plano && (
              <button type="button" onClick={irPlanos} className="font-medium text-brand-navy hover:underline">
                Cadastre um plano preventivo para acompanhar os vencimentos →
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {atencao.map((x) => (
              <li key={x.unit_id}>
                <button
                  type="button"
                  onClick={() => setSel(x.unit_id)}
                  className={cn("flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-secondary/50", sel === x.unit_id && "bg-navy-tint")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[13px] font-semibold">{nomeVeiculo(x)}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">{x.modelo ?? x.categoria ?? "—"}</span>
                  </span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {x.alertas.map((a) => (
                      <Pill key={a.chave} tone={a.nivel === "critico" ? "coral" : "gold"}>{a.titulo}</Pill>
                    ))}
                    {x.vencidos > 0 && <Pill tone="coral">{x.vencidos} vencido{x.vencidos > 1 ? "s" : ""}</Pill>}
                    {x.vencendo > 0 && <Pill tone="gold">{x.vencendo} vencendo</Pill>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={v ? `Sinais do motor · ${nomeVeiculo(v)}` : "Sinais do motor"}
        icon={Gauge}
        action={v && <button type="button" onClick={() => onVeiculo(v.unit_id)} className="text-[13px] font-medium text-brand-navy hover:underline">Abrir veículo</button>}
        bodyClassName="p-4"
      >
        {v ? (
          <>
            <InspecaoVeiculo
              tipo={tipoPorCategoria(v.categoria_id) === "onibus" ? "onibus" : "caminhao"}
              sinais={v.sinais}
              limites={r.limites}
              onSelect={(_, info) => setPonto(info)}
            />
            <p className="mt-3 min-h-[36px] rounded-lg bg-secondary/50 px-3 py-2 text-[13px]">
              {ponto ? (
                <>
                  <b>{ponto.rotulo}:</b> {ponto.detalhe}
                </>
              ) : (
                "Clique num ponto para ver o detalhe. Cinza = o veículo não envia esse sinal."
              )}
            </p>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Última leitura: {v.ultimo_sinal ? new Date(v.ultimo_sinal).toLocaleString("pt-BR") : "—"} · odômetro {nf(v.odometro_km)} km
              {v.odometro_travado && " (travado)"}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">Sem veículos.</p>
        )}
      </Card>
    </div>
  );
}

// -------------------------------------------------------------- Preventiva

function Preventiva({ veiculos, onVeiculo, irPlanos }: { veiculos: VeiculoManut[]; onVeiculo: (id: number) => void; irPlanos: () => void }) {
  const [busca, setBusca] = useState("");
  const [so, setSo] = useState<"todos" | "atencao" | "sem_plano">("atencao");
  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return veiculos
      .filter((v) => !b || `${v.prefixo} ${v.placa} ${v.modelo}`.toLowerCase().includes(b))
      .filter((v) => (so === "atencao" ? v.vencidos || v.vencendo || v.sem_registro : so === "sem_plano" ? !v.plano : true));
  }, [veiculos, busca, so]);
  const semPlano = veiculos.filter((v) => !v.plano).length;

  return (
    <Card
      title="Plano preventivo por veículo"
      icon={CalendarClock}
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-secondary p-0.5">
            {(
              [
                ["atencao", "Precisa agir"],
                ["todos", "Todos"],
                ["sem_plano", `Sem plano (${semPlano})`],
              ] as const
            ).map(([id, rot]) => (
              <button key={id} type="button" onClick={() => setSo(id)} className={cn("rounded-md px-3 py-1 text-[12px] font-medium", so === id ? "bg-white shadow-sm" : "text-muted-foreground")}>
                {rot}
              </button>
            ))}
          </div>
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar veículo" aria-label="Buscar veículo" className="h-8 w-44 rounded-lg border border-border bg-white pl-8 pr-3 text-[13px]" />
          </label>
        </div>
      }
      bodyClassName="p-4"
    >
      {!veiculos.some((v) => v.plano) ? (
        <div className="space-y-2 py-4 text-center text-[13px] text-muted-foreground">
          <p>Nenhum veículo tem plano preventivo ainda.</p>
          <button type="button" onClick={irPlanos} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 font-medium text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> Criar o primeiro plano
          </button>
        </div>
      ) : !lista.length ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">Nada para mostrar com esse filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="bg-secondary/60 text-[12px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Veículo</th>
                <th className="px-3 py-2.5 text-right font-semibold">Odômetro</th>
                <th className="px-3 py-2.5 text-left font-semibold">Próximo serviço</th>
                <th className="px-3 py-2.5 text-left font-semibold">Situação</th>
                <th className="px-4 py-2.5 text-left font-semibold">Plano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lista.slice(0, 300).map((v) => {
                const i = v.itens[0];
                return (
                  <tr key={v.unit_id} className="cursor-pointer hover:bg-secondary/40" onClick={() => onVeiculo(v.unit_id)}>
                    <td className="px-4 py-2.5">
                      <span className="block font-mono font-semibold">{nomeVeiculo(v)}</span>
                      <span className="block text-[12px] text-muted-foreground">{v.modelo ?? v.categoria ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {nf(v.odometro_km)} km{v.odometro_travado && <span className="block text-[12px] text-gold">travado</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      {i ? (
                        <>
                          <span className="block">{i.servico}</span>
                          <span className="block text-[12px] text-muted-foreground">{falta(i)}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{i ? <Pill tone={SIT[i.situacao].tom}>{SIT[i.situacao].rotulo}</Pill> : <Pill tone="neutral">Sem plano</Pill>}</td>
                    <td className="px-4 py-2.5 text-[13px] text-muted-foreground">{v.plano?.nome ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// -------------------------------------------------------------- Corretiva

function Corretiva({
  g,
  veiculos,
  ordens,
  onVeiculo,
  onOrdem,
}: {
  g: string;
  veiculos: VeiculoManut[];
  ordens: OrdemServico[];
  onVeiculo: (id: number) => void;
  onOrdem: (id: number) => void;
}) {
  const qc = useQueryClient();
  const [nova, setNova] = useState(false);
  const alertas = veiculos.flatMap((v) => v.alertas.map((a) => ({ v, a })));
  const suspeitos = veiculos.flatMap((v) => (v.sinais_suspeitos ?? []).map((s) => ({ v, s })));
  const [verSuspeitos, setVerSuspeitos] = useState(false);
  const nome = (id: number) => {
    const v = veiculos.find((x) => x.unit_id === id);
    return v ? nomeVeiculo(v) : `#${id}`;
  };
  const abrir = useMutation({
    mutationFn: ({ v, a }: { v: VeiculoManut; a: VeiculoManut["alertas"][number] }) =>
      Manut.abrirOrdem({
        group_id: Number(g),
        unit_id: v.unit_id,
        tipo: "corretiva",
        titulo: `${a.titulo} — ${nomeVeiculo(v)}`,
        descricao: a.detalhe,
        prioridade: a.nivel === "critico" ? "critica" : "alta",
        origem: `alerta:${a.chave}`,
      }),
    onSuccess: (res) => {
      toast.success(res.ja_existia ? "Já havia uma ordem aberta para este alerta." : `Ordem de serviço nº ${res.id} aberta.`);
      qc.invalidateQueries({ queryKey: ["manut"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  return (
    <div className="space-y-5">
      <Card title="Alertas do motor (últimas 24 h)" icon={Siren} action={<Pill tone={alertas.length ? "coral" : "green"}>{alertas.length}</Pill>} bodyClassName="p-2">
        {!alertas.length ? (
          <p className="px-3 py-4 text-[13px] text-muted-foreground">Nenhum sinal fora do normal agora.</p>
        ) : (
          <ul className="divide-y divide-border">
            {alertas.map(({ v, a }) => {
              const temOS = v.alertas_com_os.includes(a.chave);
              return (
                <li key={`${v.unit_id}-${a.chave}`} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <AlertTriangle className={cn("h-4 w-4 shrink-0", a.nivel === "critico" ? "text-coral" : "text-gold")} />
                  <button type="button" onClick={() => onVeiculo(v.unit_id)} className="min-w-0 flex-1 text-left">
                    <span className="block text-[13px] font-medium">
                      {a.titulo} · <span className="font-mono">{nomeVeiculo(v)}</span>
                    </span>
                    <span className="block text-[12px] text-muted-foreground">{a.detalhe}</span>
                  </button>
                  <span className="font-mono text-[13px] font-semibold">{a.valor}</span>
                  {temOS ? (
                    <Pill tone="sky">OS aberta</Pill>
                  ) : (
                    <button
                      type="button"
                      disabled={abrir.isPending}
                      onClick={() => abrir.mutate({ v, a })}
                      className="rounded-lg bg-brand-navy px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      Abrir ordem de serviço
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {suspeitos.length > 0 && (
        <Card
          title="Sinais suspeitos (sensor, não motor)"
          icon={AlertTriangle}
          action={<button type="button" onClick={() => setVerSuspeitos((x) => !x)} className="text-[12px] text-brand-navy hover:underline">{verSuspeitos ? "Esconder" : `Ver os ${suspeitos.length}`}</button>}
          bodyClassName="p-2"
        >
          <p className="px-3 py-2 text-[12px] text-muted-foreground">
            Leituras que não podem ser reais (valor travado, escala estourando, nível pulando). Não abrem alerta para não mandar o veículo à oficina por engano; o que precisa de conferência é o sensor ou a configuração do equipamento.
          </p>
          {verSuspeitos && (
            <ul className="divide-y divide-border">
              {suspeitos.map(({ v, s }) => (
                <li key={`${v.unit_id}-${s.sinal}`} className="px-3 py-2">
                  <button type="button" onClick={() => onVeiculo(v.unit_id)} className="text-left">
                    <span className="block text-[13px] font-medium">{s.titulo} · <span className="font-mono">{nomeVeiculo(v)}</span></span>
                    <span className="block text-[12px] text-muted-foreground">{s.detalhe}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card
        title="Ordens de serviço"
        icon={Wrench}
        action={
          <button type="button" onClick={() => setNova(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90">
            <Plus className="h-3.5 w-3.5" /> Nova ordem
          </button>
        }
        bodyClassName="p-4"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUNAS.map((col) => {
            const doStatus = ordens.filter((o) => o.status === col).slice(0, 30);
            return (
              <div key={col} className="rounded-xl bg-secondary/50 p-2">
                <p className="mb-2 flex items-center justify-between px-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {ROTULO_STATUS_OS[col]} <span className="font-mono">{doStatus.length}</span>
                </p>
                <div className="space-y-2">
                  {doStatus.map((o) => (
                    <button key={o.id} type="button" onClick={() => onOrdem(o.id)} className="block w-full rounded-lg border border-border bg-white p-3 text-left shadow-sm hover:border-brand-sky">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[12px] text-muted-foreground">OS {o.id} · {nome(o.unit_id)}</span>
                        <Pill tone={PRIOR[o.prioridade]}>{o.prioridade}</Pill>
                      </span>
                      <span className="mt-1 block text-[13px] font-medium leading-snug">{o.titulo}</span>
                      <span className="mt-1 block text-[12px] text-muted-foreground">
                        {o.tipo} · aberta em {dataBR(o.aberta_em)}
                        {o.responsavel && ` · ${o.responsavel}`}
                      </span>
                    </button>
                  ))}
                  {!doStatus.length && <p className="px-1 py-2 text-[12px] text-muted-foreground">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <NovaOrdem g={g} aberto={nova} veiculos={veiculos} onClose={() => setNova(false)} />
    </div>
  );
}

function NovaOrdem({ g, aberto, veiculos, onClose }: { g: string; aberto: boolean; veiculos: VeiculoManut[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [unit, setUnit] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<"corretiva" | "preventiva">("corretiva");
  const [prioridade, setPrioridade] = useState<OrdemServico["prioridade"]>("media");
  const salvar = useMutation({
    mutationFn: () => Manut.abrirOrdem({ group_id: Number(g), unit_id: Number(unit), tipo, titulo, descricao, prioridade, origem: "manual" }),
    onSuccess: (r) => {
      toast.success(`Ordem de serviço nº ${r.id} aberta.`);
      qc.invalidateQueries({ queryKey: ["manut"] });
      setUnit("");
      setTitulo("");
      setDescricao("");
      onClose();
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });
  const ok = unit && titulo.trim().length >= 3;
  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>Nova ordem de serviço</SheetTitle>
        </SheetHeader>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) salvar.mutate();
          }}
        >
          <Campo rotulo="Veículo">
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="h-10 w-full rounded-lg border border-border bg-white px-3 text-[13px]">
              <option value="">Escolha o veículo</option>
              {veiculos.map((v) => (
                <option key={v.unit_id} value={v.unit_id}>{nomeVeiculo(v)}{v.modelo ? ` · ${v.modelo}` : ""}</option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Tipo">
            <div className="flex gap-2">
              {(["corretiva", "preventiva"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTipo(t)} className={cn("flex-1 rounded-lg border px-3 py-2 text-[13px] capitalize", tipo === t ? "border-brand-navy bg-navy-tint font-medium" : "border-border")}>
                  {t}
                </button>
              ))}
            </div>
          </Campo>
          <Campo rotulo="O que precisa ser feito">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Vazamento de óleo no cárter" className="h-10 w-full rounded-lg border border-border px-3 text-[13px]" />
          </Campo>
          <Campo rotulo="Detalhes (opcional)">
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} className="w-full rounded-lg border border-border px-3 py-2 text-[13px]" />
          </Campo>
          <Campo rotulo="Prioridade">
            <div className="grid grid-cols-4 gap-2">
              {(["baixa", "media", "alta", "critica"] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPrioridade(p)} className={cn("rounded-lg border px-2 py-2 text-[13px] capitalize", prioridade === p ? "border-brand-navy bg-navy-tint font-medium" : "border-border")}>
                  {p === "media" ? "média" : p === "critica" ? "crítica" : p}
                </button>
              ))}
            </div>
          </Campo>
          <button type="submit" disabled={!ok || salvar.isPending} className="w-full rounded-lg bg-brand-navy px-4 py-2.5 text-[14px] font-medium text-white disabled:opacity-40">
            {salvar.isPending ? "Abrindo…" : "Abrir ordem de serviço"}
          </button>
          {!ok && <p className="text-center text-[12px] text-muted-foreground">Escolha o veículo e descreva o serviço.</p>}
        </form>
      </SheetContent>
    </Sheet>
  );
}

function DetalheOrdem({ g, o, veiculos, onClose }: { g: string; o: OrdemServico | null; veiculos: VeiculoManut[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [nota, setNota] = useState("");
  const [custo, setCusto] = useState("");
  const [resp, setResp] = useState("");
  const mudar = useMutation({
    mutationFn: (status?: StatusOS) =>
      Manut.mudarOrdem(o!.id, {
        group_id: Number(g),
        status,
        nota: nota.trim() || undefined,
        custo: custo ? Number(custo.replace(",", ".")) : undefined,
        responsavel: resp.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Ordem atualizada.");
      setNota("");
      qc.invalidateQueries({ queryKey: ["manut"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });
  const v = o ? veiculos.find((x) => x.unit_id === o.unit_id) : null;
  return (
    <Sheet open={o != null} onOpenChange={(x) => !x && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[560px]">
        {o && (
          <>
            <SheetHeader>
              <SheetTitle>OS {o.id} · {o.titulo}</SheetTitle>
              <p className="text-[13px] text-muted-foreground">
                {v ? nomeVeiculo(v) : `#${o.unit_id}`} · {o.tipo} · prioridade {o.prioridade} · {ROTULO_STATUS_OS[o.status]}
              </p>
            </SheetHeader>
            <div className="mt-5 space-y-4">
              {o.descricao && <p className="rounded-lg bg-secondary/50 px-3 py-2 text-[13px]">{o.descricao}</p>}
              {o.status !== "concluida" && o.status !== "cancelada" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo rotulo="Responsável / oficina">
                      <input value={resp} onChange={(e) => setResp(e.target.value)} placeholder={o.responsavel ?? "Quem vai fazer"} className="h-9 w-full rounded-lg border border-border px-3 text-[13px]" />
                    </Campo>
                    <Campo rotulo="Custo (R$)">
                      <input value={custo} onChange={(e) => setCusto(e.target.value)} inputMode="decimal" placeholder={o.custo != null ? nf(o.custo, 2) : "0,00"} className="h-9 w-full rounded-lg border border-border px-3 text-[13px]" />
                    </Campo>
                  </div>
                  <Campo rotulo="Anotação (opcional)">
                    <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={3} className="w-full rounded-lg border border-border px-3 py-2 text-[13px]" />
                  </Campo>
                  <div className="flex flex-wrap gap-2">
                    {o.status === "aberta" && <BotaoStatus onClick={() => mudar.mutate("em_andamento")}>Iniciar</BotaoStatus>}
                    {o.status !== "aguardando_peca" && <BotaoStatus onClick={() => mudar.mutate("aguardando_peca")}>Aguardando peça</BotaoStatus>}
                    {o.status === "aguardando_peca" && <BotaoStatus onClick={() => mudar.mutate("em_andamento")}>Peça chegou</BotaoStatus>}
                    <BotaoStatus principal onClick={() => mudar.mutate("concluida")}>
                      <CheckCircle2 className="h-4 w-4" /> Concluir
                    </BotaoStatus>
                    <BotaoStatus onClick={() => mudar.mutate(undefined)}>Só salvar anotação</BotaoStatus>
                    <BotaoStatus perigo onClick={() => mudar.mutate("cancelada")}>Cancelar ordem</BotaoStatus>
                  </div>
                </>
              )}
              <div>
                <p className="mb-2 text-[13px] font-semibold">Histórico</p>
                <ul className="space-y-2 border-l-2 border-border pl-4">
                  {[...o.historico].reverse().map((h, i) => (
                    <li key={i} className="text-[13px]">
                      <span className="font-medium">{ROTULO_STATUS_OS[h.status as StatusOS] ?? h.status}</span>
                      <span className="text-muted-foreground"> · {new Date(h.em).toLocaleString("pt-BR")}</span>
                      {h.nota && <span className="block text-muted-foreground">{h.nota}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function BotaoStatus({ children, onClick, principal, perigo }: { children: React.ReactNode; onClick: () => void; principal?: boolean; perigo?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[13px] font-medium",
        principal ? "border-leaf bg-leaf text-white" : perigo ? "border-coral-line text-coral hover:bg-coral-tint" : "border-border hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-foreground">{rotulo}</span>
      {children}
    </label>
  );
}

// ------------------------------------------------------- Detalhe do veículo

function DetalheVeiculo({ g, v, limites, ordens, onClose }: { g: string; v: VeiculoManut | null; limites: Record<string, number>; ordens: OrdemServico[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [relatorio, setRelatorio] = useState(false);
  const hist = useQuery(historicoServicosQuery(g, v?.unit_id));
  const [servico, setServico] = useState("");
  const [data, setData] = useState(hoje());
  const [odo, setOdo] = useState("");
  const [custo, setCusto] = useState("");
  const [oficina, setOficina] = useState("");
  const registrar = useMutation({
    mutationFn: () =>
      Manut.registrarServico({
        group_id: Number(g),
        unit_id: v!.unit_id,
        servico,
        data,
        odometro_km: odo ? Number(odo.replace(/\./g, "")) : v!.odometro_km,
        horimetro_h: v!.horimetro_h ?? null,
        custo: custo ? Number(custo.replace(",", ".")) : null,
        oficina: oficina || null,
      }),
    onSuccess: () => {
      toast.success("Serviço registrado. O próximo vencimento foi recalculado.");
      setServico("");
      setCusto("");
      qc.invalidateQueries({ queryKey: ["manut"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });

  return (
    <Sheet open={v != null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[720px]">
        {v && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between gap-3 pr-8">
                {nomeVeiculo(v)}
                <button type="button" onClick={() => setRelatorio(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-[13px] font-medium text-white hover:opacity-90">
                  <ClipboardList className="h-3.5 w-3.5" /> Relatório para o cliente
                </button>
              </SheetTitle>
              <p className="text-[13px] text-muted-foreground">
                {[v.placa, v.modelo, v.ano].filter(Boolean).join(" · ")} · odômetro {nf(v.odometro_km)} km{v.odometro_travado && " (travado)"}{v.horimetro_h != null && ` · ${nf(v.horimetro_h)} h de motor`}
              </p>
            </SheetHeader>
            <div className="mt-5 space-y-5">
              <InspecaoVeiculo tipo={tipoPorCategoria(v.categoria_id) === "onibus" ? "onibus" : "caminhao"} sinais={v.sinais} limites={limites} />
              {v.alertas.length > 0 && (
                <div className="space-y-1.5">
                  {v.alertas.map((a) => (
                    <p key={a.chave} className={cn("rounded-lg px-3 py-2 text-[13px]", a.nivel === "critico" ? "bg-coral-tint" : "bg-gold-tint")}>
                      <b>{a.titulo}:</b> {a.detalhe}
                    </p>
                  ))}
                </div>
              )}
              <div>
                <p className="mb-2 text-[13px] font-semibold">Plano preventivo {v.plano ? `· ${v.plano.nome}` : ""}</p>
                {v.itens.length ? (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {v.itens.map((i) => (
                      <li key={i.servico} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium">{i.servico}</span>
                          <span className="block text-[12px] text-muted-foreground">
                            a cada {[i.intervalo_km && `${nf(i.intervalo_km)} km`, i.intervalo_dias && `${i.intervalo_dias} dias`, i.intervalo_horas && `${nf(i.intervalo_horas)} h de motor`].filter(Boolean).join(" ou ")}
                            {i.ultimo ? ` · último em ${dataBR(i.ultimo.data)}${i.ultimo.odometro_km != null ? ` com ${nf(i.ultimo.odometro_km)} km` : ""}` : ""} · {falta(i)}
                          </span>
                        </span>
                        <Pill tone={SIT[i.situacao].tom}>{SIT[i.situacao].rotulo}</Pill>
                        <button type="button" onClick={() => setServico(i.servico)} className="text-[12px] font-medium text-brand-navy hover:underline">
                          Registrar
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted-foreground">Este veículo ainda não está em nenhum plano. Cadastre na aba Planos.</p>
                )}
              </div>

              <form
                className="space-y-3 rounded-xl border border-border p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (servico.trim().length >= 2) registrar.mutate();
                }}
              >
                <p className="text-[13px] font-semibold">Registrar serviço feito</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Serviço">
                    <input list="servicos-plano" value={servico} onChange={(e) => setServico(e.target.value)} placeholder="Ex.: Troca de óleo do motor e filtro" className="h-9 w-full rounded-lg border border-border px-3 text-[13px]" />
                    <datalist id="servicos-plano">
                      {v.itens.map((i) => (
                        <option key={i.servico} value={i.servico} />
                      ))}
                    </datalist>
                  </Campo>
                  <Campo rotulo="Data">
                    <input type="date" value={data} max={hoje()} onChange={(e) => setData(e.target.value)} className="h-9 w-full rounded-lg border border-border px-3 text-[13px]" />
                  </Campo>
                  <Campo rotulo="Odômetro no serviço (km)">
                    <input value={odo} onChange={(e) => setOdo(e.target.value)} inputMode="numeric" placeholder={v.odometro_km != null ? `${nf(v.odometro_km)} (atual)` : "km"} className="h-9 w-full rounded-lg border border-border px-3 text-[13px]" />
                  </Campo>
                  <Campo rotulo="Custo (R$, opcional)">
                    <input value={custo} onChange={(e) => setCusto(e.target.value)} inputMode="decimal" className="h-9 w-full rounded-lg border border-border px-3 text-[13px]" />
                  </Campo>
                  <Campo rotulo="Oficina (opcional)">
                    <input value={oficina} onChange={(e) => setOficina(e.target.value)} className="h-9 w-full rounded-lg border border-border px-3 text-[13px]" />
                  </Campo>
                </div>
                <button type="submit" disabled={servico.trim().length < 2 || registrar.isPending} className="rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40">
                  {registrar.isPending ? "Registrando…" : "Registrar serviço"}
                </button>
                <p className="text-[12px] text-muted-foreground">Sem odômetro informado, vale o atual do veículo. Para um serviço antigo, informe o km da época.</p>
              </form>

              <div>
                <p className="mb-2 text-[13px] font-semibold">Histórico de serviços</p>
                {hist.data?.length ? (
                  <ul className="divide-y divide-border rounded-xl border border-border">
                    {hist.data.map((h) => (
                      <li key={h.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                        <span className="w-24 text-muted-foreground">{dataBR(h.data)}</span>
                        <span className="min-w-0 flex-1">{h.servico}{h.oficina && <span className="text-muted-foreground"> · {h.oficina}</span>}</span>
                        <span className="font-mono text-[12px]">{nf(h.odometro_km)} km</span>
                        {h.custo != null && <span className="font-mono text-[12px]">R$ {nf(h.custo, 2)}</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted-foreground">Nenhum serviço registrado ainda.</p>
                )}
              </div>
            </div>
          </>
        )}
        {v && relatorio && <RelatorioVeiculo v={v} limites={limites} ordens={ordens} historico={hist.data ?? []} onClose={() => setRelatorio(false)} />}
      </SheetContent>
    </Sheet>
  );
}

// ------------------------------------------------------------------ Planos

function Planos({ g, veiculos }: { g: string; veiculos: VeiculoManut[] }) {
  const qc = useQueryClient();
  const planos = useQuery(planosQuery(g));
  const modelos = useQuery(modelosPlanoQuery());
  const [edicao, setEdicao] = useState<(Omit<Plano, "id" | "group_id"> & { id?: number }) | null>(null);

  const categorias = useMemo(() => {
    const m = new Map<number, { nome: string; n: number }>();
    for (const v of veiculos) if (v.categoria_id) m.set(v.categoria_id, { nome: v.categoria ?? `Tipo ${v.categoria_id}`, n: (m.get(v.categoria_id)?.n ?? 0) + 1 });
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [veiculos]);
  const modelosFrota = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of veiculos) if (v.modelo?.trim()) m.set(v.modelo.trim(), (m.get(v.modelo.trim()) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [veiculos]);

  const cobertos = (p: Pick<Plano, "escopo" | "alvo">) =>
    veiculos.filter((v) =>
      p.escopo === "veiculo" ? String(v.unit_id) === p.alvo : p.escopo === "modelo" ? (v.modelo ?? "").trim().toLowerCase() === p.alvo.trim().toLowerCase() : String(v.categoria_id) === p.alvo,
    ).length;
  const rotuloAlvo = (p: Pick<Plano, "escopo" | "alvo">) =>
    p.escopo === "categoria"
      ? `Tipo: ${categorias.find(([id]) => String(id) === p.alvo)?.[1].nome ?? p.alvo}`
      : p.escopo === "modelo"
        ? `Modelo: ${p.alvo}`
        : `Veículo: ${nomeVeiculo(veiculos.find((v) => String(v.unit_id) === p.alvo) ?? { prefixo: null, placa: null, unit_id: Number(p.alvo) })}`;

  const salvar = useMutation({
    mutationFn: () => Manut.salvarPlano({ ...edicao!, group_id: Number(g) }),
    onSuccess: () => {
      toast.success("Plano salvo. Os vencimentos já foram recalculados.");
      setEdicao(null);
      qc.invalidateQueries({ queryKey: ["manut"] });
    },
    onError: (e) => toast.error(mensagemErro(e)),
  });
  const apagar = useMutation({
    mutationFn: (id: number) => Manut.apagarPlano(id, g),
    onSuccess: () => {
      toast.success("Plano removido.");
      qc.invalidateQueries({ queryKey: ["manut"] });
    },
  });

  const novoDoModelo = (id: string) => {
    const m = modelos.data?.find((x) => x.id === id);
    if (!m) return;
    const cat = categorias.find(([c]) => m.categorias.includes(c));
    setEdicao({ nome: m.nome.replace(" (sugestão)", ""), escopo: "categoria", alvo: cat ? String(cat[0]) : String(m.categorias[0]), itens: m.itens.map((i) => ({ ...i })) });
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.2fr]">
      <Card title="Planos cadastrados" icon={ClipboardList} bodyClassName="p-4">
        {(planos.data ?? []).length ? (
          <ul className="space-y-2">
            {planos.data!.map((p) => (
              <li key={p.id} className="flex items-start gap-3 rounded-xl border border-border px-4 py-3">
                <button type="button" onClick={() => setEdicao({ id: p.id, nome: p.nome, escopo: p.escopo, alvo: p.alvo, itens: p.itens })} className="min-w-0 flex-1 text-left">
                  <span className="block text-[14px] font-semibold">{p.nome}</span>
                  <span className="block text-[12px] text-muted-foreground">{rotuloAlvo(p)} · {cobertos(p)} veículos · {p.itens.length} serviços</span>
                </button>
                <button type="button" aria-label="Remover plano" onClick={() => apagar.mutate(p.id)} className="rounded p-1 text-muted-foreground hover:bg-coral-tint hover:text-coral">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted-foreground">Nenhum plano ainda. Comece por um dos modelos ao lado e ajuste ao manual do fabricante.</p>
        )}
        <div className="mt-4 space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">Começar por um modelo</p>
          <div className="flex flex-wrap gap-2">
            {(modelos.data ?? []).map((m) => (
              <button key={m.id} type="button" onClick={() => novoDoModelo(m.id)} className="rounded-lg border border-border bg-white px-3 py-2 text-[13px] hover:border-brand-sky">
                {m.nome}
              </button>
            ))}
            <button type="button" onClick={() => setEdicao({ nome: "", escopo: "categoria", alvo: String(categorias[0]?.[0] ?? ""), itens: [{ servico: "", km: null, dias: null }] })} className="rounded-lg border border-dashed border-border px-3 py-2 text-[13px] hover:border-brand-sky">
              <Plus className="mr-1 inline h-3.5 w-3.5" /> Em branco
            </button>
          </div>
        </div>
      </Card>

      <Card title={edicao ? (edicao.id ? "Editar plano" : "Novo plano") : "Plano"} icon={Wrench} bodyClassName="p-4">
        {!edicao ? (
          <p className="text-[13px] text-muted-foreground">Escolha um plano para editar ou comece por um modelo.</p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              salvar.mutate();
            }}
          >
            <Campo rotulo="Nome do plano">
              <input value={edicao.nome} onChange={(e) => setEdicao({ ...edicao, nome: e.target.value })} className="h-9 w-full rounded-lg border border-border px-3 text-[13px]" />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <Campo rotulo="Vale para">
                <select value={edicao.escopo} onChange={(e) => setEdicao({ ...edicao, escopo: e.target.value as Plano["escopo"], alvo: "" })} className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]">
                  <option value="categoria">Tipo de veículo</option>
                  <option value="modelo">Modelo</option>
                  <option value="veiculo">Um veículo</option>
                </select>
              </Campo>
              <Campo rotulo={edicao.escopo === "categoria" ? "Tipo" : edicao.escopo === "modelo" ? "Modelo" : "Veículo"}>
                <select value={edicao.alvo} onChange={(e) => setEdicao({ ...edicao, alvo: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]">
                  <option value="">Escolha</option>
                  {edicao.escopo === "categoria" &&
                    categorias.map(([id, c]) => (
                      <option key={id} value={String(id)}>{c.nome} ({c.n})</option>
                    ))}
                  {edicao.escopo === "modelo" &&
                    modelosFrota.map(([m, n]) => (
                      <option key={m} value={m}>{m} ({n})</option>
                    ))}
                  {edicao.escopo === "veiculo" &&
                    veiculos.map((v) => (
                      <option key={v.unit_id} value={String(v.unit_id)}>{nomeVeiculo(v)}</option>
                    ))}
                </select>
              </Campo>
            </div>
            {edicao.alvo && <p className="text-[12px] text-muted-foreground">Vale para {cobertos(edicao)} veículos. Um plano por veículo vale mais que o do modelo, e o do modelo mais que o do tipo.</p>}

            <div>
              <p className="mb-2 text-[13px] font-medium">Serviços e intervalos (vence o que chegar primeiro)</p>
              <div className="space-y-2">
                {edicao.itens.map((it, i) => (
                  <div key={i} className="grid grid-cols-[1fr_100px_80px_90px_32px] items-center gap-2">
                    <input value={it.servico} onChange={(e) => setEdicao({ ...edicao, itens: edicao.itens.map((x, j) => (j === i ? { ...x, servico: e.target.value } : x)) })} placeholder="Serviço" className="h-9 rounded-lg border border-border px-3 text-[13px]" />
                    <input value={it.km ?? ""} onChange={(e) => setEdicao({ ...edicao, itens: edicao.itens.map((x, j) => (j === i ? { ...x, km: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null } : x)) })} inputMode="numeric" placeholder="km" className="h-9 rounded-lg border border-border px-3 text-right text-[13px]" />
                    <input value={it.dias ?? ""} onChange={(e) => setEdicao({ ...edicao, itens: edicao.itens.map((x, j) => (j === i ? { ...x, dias: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null } : x)) })} inputMode="numeric" placeholder="dias" className="h-9 rounded-lg border border-border px-3 text-right text-[13px]" />
                    <input value={it.horas ?? ""} title="Horas de motor (horímetro)" onChange={(e) => setEdicao({ ...edicao, itens: edicao.itens.map((x, j) => (j === i ? { ...x, horas: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null } : x)) })} inputMode="numeric" placeholder="horas" className="h-9 rounded-lg border border-border px-3 text-right text-[13px]" />
                    <button type="button" aria-label="Remover serviço" onClick={() => setEdicao({ ...edicao, itens: edicao.itens.filter((_, j) => j !== i) })} className="rounded p-1 text-muted-foreground hover:text-coral">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setEdicao({ ...edicao, itens: [...edicao.itens, { servico: "", km: null, dias: null, horas: null } as ItemPlano] })} className="mt-2 text-[13px] font-medium text-brand-navy hover:underline">
                + Adicionar serviço
              </button>
            </div>
            <p className="rounded-lg bg-gold-tint px-3 py-2 text-[12px]">Os intervalos dos modelos são sugestões gerais. Ajuste ao manual do fabricante de cada veículo.</p>
            <div className="flex gap-2">
              <button type="submit" disabled={!edicao.nome.trim() || !edicao.alvo || !edicao.itens.some((i) => i.servico.trim() && (i.km || i.dias || i.horas)) || salvar.isPending} className="rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-medium text-white disabled:opacity-40">
                {salvar.isPending ? "Salvando…" : "Salvar plano"}
              </button>
              <button type="button" onClick={() => setEdicao(null)} className="rounded-lg border border-border px-4 py-2 text-[13px]">Cancelar</button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
