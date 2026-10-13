import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, Loader2, Scale } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card } from "@/components/ss/ui/data";
import {
  comparativoExemplo,
  comparativoQuery,
  type IndicadorComparativo,
  type SituacaoComparativo,
} from "@/lib/comparativo-api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { usandoMock } from "@/lib/modo";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Comparativo com iguais (PM, 10/10/2026): o cliente contra os outros clientes
 * do mesmo segmento, sem o nome deles. Regras em ss-fleet-core endpoints/comparativo.py.
 */

const nf = (v: number | null | undefined, c = 1) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: c });
const dataBR = (s: string) => new Date(s + "T12:00").toLocaleDateString("pt-BR");

const SITUACAO: Record<SituacaoComparativo, { rotulo: string; classe: string }> = {
  melhor: { rotulo: "Entre os melhores", classe: "bg-leaf/15 text-leaf" },
  media: { rotulo: "Na média dos iguais", classe: "bg-navy-tint text-brand-navy" },
  pior: { rotulo: "Abaixo dos iguais", classe: "bg-coral/15 text-coral" },
  sem_dado: { rotulo: "Sem dado", classe: "bg-secondary text-muted-foreground" },
  poucos_iguais: {
    rotulo: "Poucos iguais para comparar",
    classe: "bg-secondary text-muted-foreground",
  },
  nao_comparavel: { rotulo: "Só da sua frota", classe: "bg-secondary text-muted-foreground" },
};

export default function ComparativoIguais() {
  const grupo = grupoAtivo();
  const mock = usandoMock();
  const [dias, setDias] = useState(30);
  const q = useQuery(comparativoQuery(grupo, dias));
  const d = mock ? comparativoExemplo() : q.data;

  return (
    <>
      <PageHeader
        title="Benchmark com o mercado"
        subtitle="Frota › A sua operação contra o mercado do mesmo segmento"
        actions={
          <div className="flex gap-1" role="group" aria-label="Período">
            {[30, 60, 90].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setDias(n)}
                aria-pressed={dias === n}
                className={cn(
                  "h-9 rounded-lg border px-3 text-[13px] font-medium",
                  dias === n
                    ? "border-brand-navy bg-brand-navy text-white"
                    : "border-border bg-white hover:bg-secondary",
                )}
              >
                {n} dias
              </button>
            ))}
          </div>
        }
      />

      {!mock && !grupo ? (
        <p className="rounded-xl border border-border bg-card p-6 text-[14px] text-muted-foreground">
          Escolha uma empresa no topo para ver o comparativo.
        </p>
      ) : !mock && q.isPending ? (
        <p className="flex items-center gap-2 p-6 text-[14px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Somando os últimos {dias} dias de todos os
          clientes…
        </p>
      ) : !mock && q.error ? (
        <p className="rounded-xl border border-border bg-card p-6 text-[14px] text-coral">
          {mensagemErro(q.error)}
        </p>
      ) : d ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-[13px]">
            <span className="inline-flex items-center gap-2 font-semibold text-foreground">
              <Scale className="h-4 w-4 text-brand-navy" /> {d.segmento_nome}
            </span>
            <span>
              Base interna: <b>{d.iguais}</b> empresa{d.iguais === 1 ? "" : "s"} do mesmo segmento
              atendida
              {d.iguais === 1 ? "" : "s"} pela SS (sem nome)
            </span>
            <span className="text-muted-foreground">
              Base externa: estimativa de mercado no consumo por porte (carga); NTU em estudo
              (urbano)
            </span>
            <span className="text-muted-foreground">
              {dataBR(d.inicio)} a {dataBR(d.fim)} · {nf(d.base.veiculos, 0)} veículos ·{" "}
              {nf(d.base.km, 0)} km
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {d.indicadores.map((i) => (
              <CartaoIndicador key={i.chave} i={i} />
            ))}
          </div>

          <Card title="Como a comparação é feita" icon={Info}>
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
              <li>
                Entram como iguais os clientes do mesmo segmento que rodaram pelo menos{" "}
                {nf(d.regras.km_min, 0)} km com {d.regras.veiculos_min} veículos ou mais no período.
              </li>
              <li>
                Cada indicador só compara quem mede aquele dado. Consumo, por exemplo, só entra
                quando o combustível medido cobre pelo menos metade dos km.
              </li>
              <li>
                Acelerações, freadas e excesso de velocidade não são comparados entre clientes: cada
                um tem o equipamento configurado com limites próprios.
              </li>
              <li>
                <b className="text-foreground">Base interna:</b> as empresas da base da SS no mesmo
                segmento. Nenhuma aparece pelo nome (“Empresa A”, “Empresa B”…), para ninguém.
              </li>
              <li>
                <b className="text-foreground">Base externa:</b> o Anuário NTU 2024-2025 acompanha
                13 indicadores do ônibus urbano (viagens, passageiros, quilometragem total,
                passageiros por km e por veículo, frota, idade média, salários, preço do diesel,
                custo por km e tarifa), mas não traz consumo em km/l nem eventos de condução. A
                comparação com a NTU está em estudo e entra aqui só com o racional e a quantidade de
                dados de cada base.
              </li>
            </ul>
          </Card>
        </div>
      ) : null}
    </>
  );
}

function CartaoIndicador({ i }: { i: IndicadorComparativo }) {
  const s = SITUACAO[i.situacao];
  const tem = i.situacao === "melhor" || i.situacao === "media" || i.situacao === "pior";
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-foreground">{i.nome}</h3>
          <p className="text-[12px] text-muted-foreground">{i.explicacao}</p>
        </div>
        <span
          className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", s.classe)}
        >
          {s.rotulo}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-[28px] font-bold tabular-nums text-foreground">
          {nf(i.valor, 2)}
        </span>
        <span className="text-[12px] text-muted-foreground">{i.unidade}</span>
      </div>
      {i.referencia_mercado && i.valor != null && (
        <p
          className="mt-1 rounded-lg bg-secondary px-2 py-1 text-[12px]"
          title={i.referencia_mercado.fonte}
        >
          <b>Mercado (estimado):</b> {nf(i.referencia_mercado.min, 1)} a{" "}
          {nf(i.referencia_mercado.max, 1)} km/l ·{" "}
          <b
            style={{
              color:
                i.valor > i.referencia_mercado.max
                  ? "var(--leaf)"
                  : i.valor < i.referencia_mercado.min
                    ? "var(--coral)"
                    : "var(--foreground)",
            }}
          >
            {i.valor > i.referencia_mercado.max
              ? "acima da faixa"
              : i.valor < i.referencia_mercado.min
                ? "abaixo da faixa"
                : "dentro da faixa"}
          </b>
          <span className="block text-[11px] text-muted-foreground">
            {i.referencia_mercado.base} · estimativa, não estudo oficial
          </span>
        </p>
      )}
      {tem ? (
        <>
          <Faixa i={i} />
          <p className="mt-1 text-[12px] text-muted-foreground">
            Melhor que <b className="text-foreground">{i.melhor_que_pct}%</b> dos iguais ·{" "}
            {i.posicao}º de {i.de} · mediana {nf(i.mediana, 2)} · o melhor fez {nf(i.melhor, 2)}
          </p>
        </>
      ) : (
        <p className="mt-2 text-[12px] text-muted-foreground">{i.motivo}</p>
      )}
    </section>
  );
}

/** Régua com os iguais (pontos), a faixa do meio (25% a 75%), a mediana e o cliente. */
function Faixa({ i }: { i: IndicadorComparativo }) {
  const vals = [...i.iguais.map((x) => x.valor), i.valor ?? 0];
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (max === min) {
    min -= 1;
    max += 1;
  }
  const L = 16;
  const W = 600 - 2 * L;
  // "Melhor" sempre à direita.
  const x = (v: number) => {
    const t = (v - min) / (max - min);
    return L + (i.menor_melhor ? 1 - t : t) * W;
  };
  const xa = x(i.p25 ?? min);
  const xb = x(i.p75 ?? max);
  return (
    <div className="mt-2" data-grafico>
      <svg
        viewBox="0 0 600 64"
        className="h-16 w-full"
        role="img"
        aria-label={`${i.nome}: você e os iguais`}
      >
        <line x1={L} x2={600 - L} y1={30} y2={30} stroke="var(--border)" strokeWidth={2} />
        <rect
          x={Math.min(xa, xb)}
          width={Math.max(2, Math.abs(xb - xa))}
          y={22}
          height={16}
          rx={4}
          fill="var(--navy-tint)"
        />
        {i.mediana != null && (
          <line
            x1={x(i.mediana)}
            x2={x(i.mediana)}
            y1={18}
            y2={42}
            stroke="var(--foreground)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
        )}
        {i.iguais.map((g) => (
          <circle
            key={g.nome}
            cx={x(g.valor)}
            cy={30}
            r={5}
            fill="var(--muted-foreground)"
            opacity={0.55}
          >
            <title>
              {g.nome}: {nf(g.valor, 2)} {i.unidade}
            </title>
          </circle>
        ))}
        {i.valor != null && (
          <g>
            <circle
              cx={x(i.valor)}
              cy={30}
              r={9}
              fill="var(--brand-navy)"
              stroke="#fff"
              strokeWidth={2.5}
            >
              <title>
                Você: {nf(i.valor, 2)} {i.unidade}
              </title>
            </circle>
            <text
              x={Math.min(Math.max(x(i.valor), 30), 570)}
              y={60}
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              fill="var(--foreground)"
            >
              você
            </text>
          </g>
        )}
        <text x={L} y={12} fontSize={11} fill="var(--muted-foreground)">
          pior
        </text>
        <text x={600 - L} y={12} fontSize={11} textAnchor="end" fill="var(--muted-foreground)">
          melhor
        </text>
      </svg>
    </div>
  );
}
