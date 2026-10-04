import { Activity, ArrowDownRight, ArrowUpRight, Award, Fuel, Gauge, Route, Siren, Truck, UserX, Users } from "lucide-react";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import type { KpiAi, PainelAi } from "@/lib/ai-fleet-api";
import { cn } from "@/lib/utils";

/**
 * Painel do IA Ops Advisor com os dados reais (funções fleet_mvp.*).
 * Nada é calculado aqui: valores, metas, vereditos e listas vêm do worker
 * de insights (vault: indicadores-ai-ops-advisor, A1 e A4–A12).
 */

const nf = (v: number | null | undefined, c = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

const ROTULO_EVENTO: Record<string, string> = {
  count_excesso_velocidade: "Excesso de velocidade",
  count_freada_brusca: "Freada brusca",
  count_aceleracao_brusca: "Aceleração brusca",
  count_embreagem: "Embreagem",
};
const ROTULO_FAIXA: Record<string, string> = {
  pct_amarela: "Faixa amarela", pct_vermelha: "Faixa vermelha", pct_marcha_lenta: "Parado com motor ligado",
  pct_parado_ligado_produtivo: "Parado ligado produtivo", pct_batendo_transmissao: "Batendo transmissão",
  pct_banguela: "Movimento sem tração", pct_tolerancia: "Tolerância", pct_parado_acelerando: "Parado acelerando",
  pct_verde: "Faixa verde", pct_inercia: "Inércia", pct_extra_eco: "Extra econômica", pct_ecoroll: "Eco-roll",
  pct_baixa_velocidade: "Baixa velocidade",
};

/** Veredito do worker em palavras (A6). */
function veredito(k: KpiAi & { suprimido_por?: string | null }): { rotulo: string; tom: PillTone } {
  if (k.suprimido_por === "meta_nao_validada") return { rotulo: "meta a validar", tom: "neutral" };
  if (k.suprimido_por === "periodo_parcial") return { rotulo: "mês incompleto", tom: "neutral" };
  if (k.veredito === "atingiu") return { rotulo: "na meta", tom: "green" };
  if (k.veredito === "nao_atingiu") return { rotulo: "fora da meta", tom: "coral" };
  if (k.veredito === "sem_meta") return { rotulo: "sem meta", tom: "neutral" };
  return { rotulo: "sem dado", tom: "neutral" };
}

function valorKpi(k: KpiAi) {
  const u = k.unidade ?? "";
  if (u === "%") return `${nf(k.valor, 1)}%`;
  if (u === "km/l") return `${nf(k.valor, 2)} km/l`;
  if (u.includes("/h") || k.chave.startsWith("count_")) {
    // Taxas por hora costumam ser pequenas: 0,004 viraria "0,00".
    const v = k.valor ?? null;
    return `${v != null && v > 0 && v < 0.1 ? nf(v, 3) : nf(v, 2)} por hora`;
  }
  return `${nf(k.valor, 1)} ${u}`;
}

function CartaoKpi({ k }: { k: KpiAi & { suprimido_por?: string | null } }) {
  const v = veredito(k);
  const c = k.comparacao;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{k.rotulo ?? k.chave}</span>
        <Pill tone={v.tom}>{v.rotulo}</Pill>
      </div>
      <span className="font-mono text-[20px] font-semibold text-foreground">{valorKpi(k)}</span>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
        {k.meta && (
          <span>
            Meta {k.meta.tipo === "maximo" ? "até" : k.meta.tipo === "minimo" ? "a partir de" : ""} {nf(k.meta.valor, k.unidade === "%" ? 1 : 2)}
            {k.unidade === "%" ? "%" : ""}
          </span>
        )}
        {c?.comparavel && c.variacao != null && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", c.variacao >= 0 ? "text-foreground" : "text-foreground")}>
            {c.variacao >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {nf(Math.abs(c.variacao), 1)}% vs 3 meses antes
          </span>
        )}
      </div>
    </div>
  );
}

type LinhaCondutor = { driver_id: number; driver_nome?: string | null; pct_ideal?: number | null; km_por_litro?: number | null; desvio_pp?: number | null };
type LinhaEvento = { evento: string; posicao: number; driver_nome?: string | null; nao_identificado?: boolean; total: number; pct_do_total?: number };
type LinhaFaixa = { faixa: string; posicao: number; driver_nome?: string | null; pct: number; meta_valor?: number | null; desvio_pp?: number | null };

function ListaCondutores({ itens, tom }: { itens: LinhaCondutor[]; tom: "coral" | "leaf" }) {
  if (!itens.length) return <p className="text-[13px] text-muted-foreground">Ninguém nesta lista no período.</p>;
  return (
    <ul className="divide-y divide-border">
      {itens.map((c) => (
        <li key={c.driver_id} className="flex items-center gap-3 py-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{c.driver_nome ?? `Condutor ${c.driver_id}`}</span>
          <span className="font-mono text-[13px]">{nf(c.pct_ideal, 1)}% ideal</span>
          <span className={cn("w-16 text-right font-mono text-[13px] font-semibold", tom === "coral" ? "text-coral" : "text-leaf")}>
            {c.desvio_pp != null ? `${c.desvio_pp > 0 ? "+" : ""}${nf(c.desvio_pp, 1)} pp` : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PainelReal({ painel }: { painel: PainelAi }) {
  const f = painel.frota as PainelAi["frota"] & { km_por_litro?: number | null; pct_ideal?: number | null };
  const eco = painel.economia_combustivel as (PainelAi["economia_combustivel"] & { motivo?: string | null; confiavel?: boolean }) | null;
  const kpis = painel.kpis as (KpiAi & { suprimido_por?: string | null })[];
  const frota = kpis.filter((k) => !k.chave.startsWith("pct_") || k.chave === "pct_ideal" || k.chave === "pct_irregular" || k.chave === "pct_horas_nao_identificadas");
  const faixas = kpis.filter((k) => k.chave.startsWith("pct_") && !frota.includes(k));
  const abaixo = painel.condutores_abaixo_benchmark as LinhaCondutor[];
  const acima = painel.condutores_acima_benchmark as unknown as LinhaCondutor[];
  const eventos = painel.ranking_eventos as unknown as LinhaEvento[];
  const rankFaixas = painel.ranking_faixas as unknown as LinhaFaixa[];

  const porEvento = eventos.reduce<Record<string, LinhaEvento[]>>((a, e) => ((a[e.evento] ??= []).push(e), a), {});
  const porFaixa = rankFaixas.reduce<Record<string, LinhaFaixa[]>>((a, e) => ((a[e.faixa] ??= []).push(e), a), {});

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={Gauge} label="Condução ideal" value={nf(f.pct_ideal, 1)} unit="%" color="var(--leaf)" foot={`média da frota · benchmark ${nf(f.benchmark_pct_ideal, 1)}%`} />
        <StatTile icon={Fuel} label="Consumo médio" value={nf(f.km_por_litro, 2)} unit="km/l" color="var(--brand-navy)" foot={`${nf(f.distancia_km)} km rodados`} />
        <StatTile
          icon={Fuel}
          label="Economia de combustível"
          value={eco?.litros != null ? nf(eco.litros) : "—"}
          unit={eco?.litros != null ? "L" : undefined}
          color="var(--leaf)"
          foot={eco?.litros != null ? `vs ${eco.inicio.slice(5, 7)}/${eco.inicio.slice(0, 4)}` : eco?.motivo ? `sem cálculo: ${eco.motivo}` : "sem comparação"}
        />
        <StatTile icon={Users} label="Condutores para retreinar" value={String(abaixo.length)} color="var(--coral)" foot="abaixo de 90% da média de condução ideal" to="/app/motoristas" />
      </div>

      <div className="grid grid-cols-2 gap-3 text-[13px] text-muted-foreground sm:grid-cols-4">
        <span className="flex items-center gap-2"><Truck className="h-4 w-4" /> {nf(f.veiculos)} veículos com telemetria</span>
        <span className="flex items-center gap-2"><Route className="h-4 w-4" /> {nf(f.viagens)} viagens</span>
        <span className="flex items-center gap-2"><Activity className="h-4 w-4" /> {nf(f.tempo_horas)} h rodadas</span>
        <span className="flex items-center gap-2"><Users className="h-4 w-4" /> {nf(f.condutores_identificados)} condutores identificados</span>
      </div>

      <Card title="Indicadores da frota" icon={Gauge} bodyClassName="p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {frota.map((k) => <CartaoKpi key={k.chave} k={k} />)}
        </div>
      </Card>

      <Card title="Faixas de condução" icon={Activity} bodyClassName="p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {faixas.map((k) => <CartaoKpi key={k.chave} k={k} />)}
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Condutores abaixo do benchmark" icon={UserX} action={<Pill tone="coral">{abaixo.length}</Pill>} bodyClassName="px-4 py-2">
          <ListaCondutores itens={abaixo} tom="coral" />
        </Card>
        <Card title="Destaques da frota" icon={Award} action={<Pill tone="green">top {acima.length}</Pill>} bodyClassName="px-4 py-2">
          <ListaCondutores itens={acima} tom="leaf" />
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Quem mais gera eventos" icon={Siren} bodyClassName="p-4">
          <div className="space-y-4">
            {Object.entries(porEvento).map(([ev, lista]) => (
              <div key={ev}>
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">{ROTULO_EVENTO[ev] ?? ev}</p>
                <ul className="space-y-1">
                  {lista.map((e) => (
                    <li key={e.posicao} className="flex items-center gap-3 text-[13px]">
                      <span className="w-5 font-mono text-muted-foreground">{e.posicao}</span>
                      <span className="min-w-0 flex-1 truncate">{e.nao_identificado ? "Sem condutor identificado" : e.driver_nome}</span>
                      <span className="font-mono">{nf(e.total)}</span>
                      <span className="w-14 text-right font-mono text-muted-foreground">{nf(e.pct_do_total, 1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!eventos.length && <p className="text-[13px] text-muted-foreground">Sem eventos no período.</p>}
          </div>
        </Card>
        <Card title="Plano de reciclagem por faixa" icon={Activity} bodyClassName="p-4">
          <div className="space-y-4">
            {Object.entries(porFaixa).slice(0, 6).map(([fx, lista]) => (
              <div key={fx}>
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {ROTULO_FAIXA[fx] ?? fx}
                  {lista[0]?.meta_valor != null && <span className="ml-1 font-normal normal-case">· meta {nf(lista[0].meta_valor, 1)}%</span>}
                </p>
                <ul className="space-y-1">
                  {lista.slice(0, 5).map((e) => (
                    <li key={e.posicao} className="flex items-center gap-3 text-[13px]">
                      <span className="w-5 font-mono text-muted-foreground">{e.posicao}</span>
                      <span className="min-w-0 flex-1 truncate">{e.driver_nome}</span>
                      <span className="font-mono">{nf(e.pct, 1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {!rankFaixas.length && <p className="text-[13px] text-muted-foreground">Sem desvios de faixa no período.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
