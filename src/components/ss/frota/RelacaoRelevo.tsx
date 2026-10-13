import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { classeRelevo } from "@/lib/relevo-api";
import { useState } from "react";
import { centrarPorGrupo, forca, regressao, regressao2, type Reta } from "@/lib/regressao";

/**
 * Relação condução × relevo × consumo (PM, 13/10/2026): três dispersões com a reta de tendência
 * (regressão linear ponderada pelos km) e, em cima, a leitura do efeito de cada um descontando o outro
 * (regressão múltipla km/l = a + b·subida + c·faixa econômica). Usado na janela de Relevo do
 * motorista/veículo (um ponto por dia) e na aba Altitude do Gerencial (um ponto por motorista,
 * veículo ou dia). Tooltip em todos os pontos.
 */

export type PontoRelacao = {
  nome: string;
  /** Metros subidos a cada 100 km. */
  subida: number | null;
  /** % do tempo andando na faixa econômica (verde, extra-econômica, inércia, eco-roll). */
  eco: number | null;
  kml: number | null;
  km: number;
  /** Veículo do ponto (comparação "o mesmo veículo, dia a dia"). */
  grupo?: string | number;
};

const nf = (v: number | null | undefined, c = 0) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

/** Pontos usáveis: km/l plausível e um mínimo de km para o número significar algo. */
export function pontosValidos(p: PontoRelacao[], kmMin: number) {
  return p.filter((x) => x.km >= kmMin && x.kml != null && x.kml > 0.3 && x.kml < 10);
}

function linhaDe(r: Reta | null, xs: number[]) {
  if (!r || !xs.length) return [];
  const a = Math.min(...xs);
  const b = Math.max(...xs);
  return [
    { x: a, y: r.a + r.b * a, tendencia: true },
    { x: b, y: r.a + r.b * b, tendencia: true },
  ];
}

type Eixo = "subida" | "eco" | "kml";
const ROT: Record<Eixo, string> = {
  subida: "Subida por 100 km (m)",
  eco: "Faixa econômica (% do tempo andando)",
  kml: "Consumo (km/l)",
};
const FMT: Record<Eixo, (v: number) => string> = {
  subida: (v) => `${nf(v)} m`,
  eco: (v) => `${nf(v, 1)}%`,
  kml: (v) => `${nf(v, 2)} km/l`,
};

function Dispersao({
  titulo,
  pontos,
  x,
  y,
  leitura,
  dentro = false,
}: {
  titulo: string;
  pontos: PontoRelacao[];
  x: Eixo;
  y: Eixo;
  leitura: (r: Reta) => string;
  /** Inclinação de dentro do mesmo veículo (cada um comparado com ele mesmo). */
  dentro?: boolean;
}) {
  const dados = pontos
    .filter((p) => p[x] != null && p[y] != null)
    .map((p) => ({ x: p[x] as number, y: p[y] as number, z: p.km, nome: p.nome, p }));
  let r = regressao(dados.map((d) => ({ x: d.x, y: d.y, w: d.z })));
  if (dentro) {
    const c = centrarPorGrupo(
      dados
        .filter((d) => d.p.grupo != null)
        .map((d) => ({ grupo: d.p.grupo as string | number, x: d.x, y: d.y, w: d.z })),
      ["x", "y"],
    );
    const rw = regressao(c);
    const sw = dados.reduce((t, d) => t + d.z, 0) || 1;
    const mx = dados.reduce((t, d) => t + d.z * d.x, 0) / sw;
    const my = dados.reduce((t, d) => t + d.z * d.y, 0) / sw;
    // Reta com a inclinação de dentro do veículo, passando pela média geral.
    r = rw ? { a: my - rw.b * mx, b: rw.b, r2: rw.r2, n: rw.n } : null;
  }
  const reta = linhaDe(
    r,
    dados.map((d) => d.x),
  );
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-3">
      <p className="text-[13px] font-semibold">{titulo}</p>
      <p className="min-h-[32px] text-[12px] text-muted-foreground">
        {r ? (
          <>
            {leitura(r)} · relação <b className="text-foreground">{forca(r.r2)}</b> (R²{" "}
            {nf(r.r2, 2)}, {r.n} pontos)
          </>
        ) : (
          "Poucos pontos para traçar a tendência (mínimo 3)."
        )}
      </p>
      <div className="h-[230px]">
        <ResponsiveContainer>
          <ScatterChart margin={{ left: 0, right: 12, top: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="x"
              name={ROT[x]}
              tick={{ fontSize: 11 }}
              domain={["auto", "auto"]}
              tickFormatter={(v) => nf(v)}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={ROT[y]}
              tick={{ fontSize: 11 }}
              domain={["auto", "auto"]}
              width={42}
              tickFormatter={(v) => nf(v, y === "kml" ? 1 : 0)}
            />
            <ZAxis type="number" dataKey="z" range={[28, 220]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const d = active
                  ? (payload?.[0]?.payload as
                      | {
                          nome?: string;
                          p?: PontoRelacao;
                          tendencia?: boolean;
                          x: number;
                          y: number;
                        }
                      | undefined)
                  : undefined;
                if (!d) return null;
                if (d.tendencia)
                  return (
                    <div className="rounded-xl border border-border bg-white/95 px-3 py-2 text-[12px] shadow-elegant">
                      <p className="font-semibold">Linha de tendência</p>
                      <p>
                        Com {FMT[x](d.x)}, o esperado é {FMT[y](d.y)}
                      </p>
                    </div>
                  );
                const p = d.p!;
                const esperado = r ? r.a + r.b * d.x : null;
                return (
                  <div className="rounded-xl border border-border bg-white/95 px-3 py-2 text-[12px] shadow-elegant">
                    <p className="font-semibold">{p.nome}</p>
                    <p>
                      Subida: <b>{nf(p.subida)} m</b> /100 km{" "}
                      <span className="text-muted-foreground">
                        ({classeRelevo(p.subida).rotulo})
                      </span>
                    </p>
                    <p>
                      Faixa econômica: <b>{nf(p.eco, 1)}%</b>
                    </p>
                    <p>
                      Consumo: <b>{nf(p.kml, 2)} km/l</b>
                    </p>
                    <p className="text-muted-foreground">{nf(p.km)} km rodados</p>
                    {esperado != null && (
                      <p className="mt-1 border-t border-border pt-1">
                        Pela tendência: {FMT[y](esperado)} ·{" "}
                        <b
                          style={{
                            color: (y === "kml" ? d.y >= esperado : true)
                              ? "var(--leaf)"
                              : "var(--coral)",
                          }}
                        >
                          {d.y >= esperado ? "acima" : "abaixo"}
                        </b>
                      </p>
                    )}
                  </div>
                );
              }}
            />
            <Scatter
              data={dados}
              fill="var(--brand-navy)"
              fillOpacity={0.6}
              isAnimationActive={false}
            />
            {reta.length > 0 && (
              <Scatter
                data={reta}
                line={{ stroke: "var(--coral)", strokeWidth: 2 }}
                shape={() => <g />}
                legendType="none"
                isAnimationActive={false}
              />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        horizontal: {ROT[x].toLowerCase()} · vertical: {ROT[y].toLowerCase()}
      </p>
    </div>
  );
}

/** Os três gráficos de relação e a leitura combinada. `unidade`: o que é cada ponto (dia, motorista…). */
export function RelacaoRelevo({
  pontos,
  unidade,
  kmMin,
  porVeiculoDia,
}: {
  pontos: PontoRelacao[];
  unidade: string;
  kmMin: number;
  /** Um ponto por veículo e dia: permite comparar cada veículo com ele mesmo. */
  porVeiculoDia?: PontoRelacao[];
}) {
  // Padrão: o mesmo veículo, dia a dia (comparar veículos diferentes mistura modelo, carga e rota).
  const vd = pontosValidos(porVeiculoDia ?? [], 20);
  const repetidos = new Map<string | number, number>();
  for (const p of vd)
    if (p.grupo != null) repetidos.set(p.grupo, (repetidos.get(p.grupo) ?? 0) + 1);
  const temDentro = [...repetidos.values()].filter((n) => n >= 2).length >= 1 && vd.length >= 5;
  const [modo, setModo] = useState<"mesmo" | "entre">("mesmo");
  const dentro = temDentro && modo === "mesmo";
  const seletor = temDentro && (
    <div className="flex gap-1 rounded-lg bg-secondary p-0.5 text-[12px]">
      {(
        [
          ["mesmo", "Mesmo veículo, dia a dia"],
          ["entre", `Entre ${unidade}`],
        ] as const
      ).map(([k, rot]) => (
        <button
          key={k}
          type="button"
          onClick={() => setModo(k)}
          className={
            modo === k
              ? "rounded-md bg-white px-3 py-1 font-medium shadow-sm"
              : "rounded-md px-3 py-1 text-muted-foreground"
          }
        >
          {rot}
        </button>
      ))}
    </div>
  );
  if (dentro) unidade = "dias de veículo";
  const v = dentro ? vd : pontosValidos(pontos, kmMin);
  if (v.length < 3) {
    const km = pontos.reduce((t, p) => t + (p.km || 0), 0);
    return (
      <div className="rounded-2xl border border-border bg-card px-4 py-4 text-[13px]">
        <p className="font-semibold">Condução × relevo × consumo</p>
        <p className="mt-1 text-muted-foreground">
          {v.length === 0 ? "Nenhum" : `Só ${v.length}`}{" "}
          {v.length === 1 ? unidade.replace(/s$/, "") : unidade} com consumo, relevo e faixa medidos
          neste período ({nf(km)} km rodados ao todo). Para mostrar a relação são precisos pelo
          menos 3, cada um com {kmMin} km ou mais.
        </p>
      </div>
    );
  }
  const base = v
    .filter((p) => p.subida != null && p.eco != null)
    .map((p) => ({
      grupo: p.grupo ?? p.nome,
      x1: p.subida as number,
      x2: p.eco as number,
      y: p.kml as number,
      w: p.km,
    }));
  const m = regressao2(dentro ? centrarPorGrupo(base, ["x1", "x2", "y"]) : base);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-[13px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold">Condução × relevo × consumo</p>
          {seletor}
        </div>
        {dentro && (
          <p className="text-[12px] text-muted-foreground">
            Cada veículo comparado com ele mesmo de um dia para o outro: tira o efeito do modelo, da
            carga habitual e da rota.
          </p>
        )}
        {m ? (
          <p className="text-muted-foreground">
            Descontando um do outro ({m.n} {unidade}, com {dentro ? 20 : kmMin}+ km): cada{" "}
            <b className="text-foreground">+100 m de subida por 100 km</b> muda o consumo em{" "}
            <b className="text-foreground">{nf(m.b1 * 100, 2)} km/l</b>, e cada{" "}
            <b className="text-foreground">+10 pontos na faixa econômica</b> muda em{" "}
            <b className="text-foreground">{nf(m.b2 * 10, 2)} km/l</b>. Juntos explicam{" "}
            {nf(m.r2 * 100)}% da diferença de consumo (R² {nf(m.r2, 2)})
            {m.r2 < 0.1
              ? " — é pouco: o consumo depende mais de carga, rota e velocidade do que destes dois."
              : "."}
          </p>
        ) : (
          <p className="text-muted-foreground">
            Poucos {unidade} com km/l, relevo e faixa medidos para a leitura combinada (mínimo 5).
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          Regressão linear ponderada pelos km rodados. Relação não é causa: rota, carga e veículo
          também pesam. Passe o mouse nos pontos.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Dispersao
          titulo="Altitude × consumo"
          pontos={v}
          x="subida"
          y="kml"
          leitura={(r) => `cada +100 m de subida: ${nf(r.b * 100, 2)} km/l`}
          dentro={dentro}
        />
        <Dispersao
          titulo="Faixa de condução × consumo"
          pontos={v}
          x="eco"
          y="kml"
          leitura={(r) => `cada +10 pontos na faixa econômica: ${nf(r.b * 10, 2)} km/l`}
          dentro={dentro}
        />
        <Dispersao
          titulo="Altitude × faixa de condução"
          pontos={v}
          x="subida"
          y="eco"
          leitura={(r) => `cada +100 m de subida: ${nf(r.b * 100, 1)} pontos na faixa econômica`}
          dentro={dentro}
        />
      </div>
    </div>
  );
}

export type DiaRelevo = {
  dia: string;
  subida_por_100km: number | null;
  km: number;
  pct_aclive?: number | null;
  kml?: number | null;
  pct_faixa_eco?: number | null;
};

/** "Relevo por dia" — o mesmo gráfico na janela do motorista/veículo e na aba Altitude do Gerencial. */
export function GraficoRelevoDia({
  dias,
  onDia,
  altura = 220,
  inicio,
  fim,
}: {
  dias: DiaRelevo[];
  onDia?: (dia: string) => void;
  altura?: number;
  /** Período inteiro no eixo (dias sem rodar aparecem vazios): com só os dias rodados, um motorista
   * que rodou um dia virava uma barra só ocupando o gráfico (PM, 13/10/2026). */
  inicio?: string;
  fim?: string;
}) {
  const todos: DiaRelevo[] = [];
  if (inicio && fim) {
    const porDia = new Map(dias.map((x) => [x.dia, x]));
    for (
      let d = new Date(inicio + "T12:00");
      d <= new Date(fim + "T12:00");
      d.setDate(d.getDate() + 1)
    ) {
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      todos.push(porDia.get(k) ?? { dia: k, subida_por_100km: null, km: 0 });
    }
  } else todos.push(...dias);
  const dados = todos.map((x) => ({
    dia: x.dia,
    rotulo: `${x.dia.slice(8, 10)}/${x.dia.slice(5, 7)}`,
    "Subida por 100 km": x.subida_por_100km ?? 0,
    Km: x.km,
    x,
  }));
  return (
    <div style={{ height: altura }}>
      <ResponsiveContainer>
        <ComposedChart
          data={dados}
          onClick={(e) => {
            const p = (e as { activePayload?: { payload: { dia: string } }[] })?.activePayload?.[0]
              ?.payload;
            if (p && onDia) onDia(p.dia);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="rotulo"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={14}
          />
          <YAxis yAxisId="s" tick={{ fontSize: 11 }} unit=" m" width={60} />
          <YAxis yAxisId="k" orientation="right" tick={{ fontSize: 11 }} width={50} />
          <Tooltip
            content={({ active, payload }) => {
              const d = active
                ? (payload?.[0]?.payload as (typeof dados)[number] | undefined)
                : undefined;
              if (!d) return null;
              const c = classeRelevo(d.x.subida_por_100km);
              if (!d.x.km)
                return (
                  <div className="rounded-xl border border-border bg-white/95 px-3 py-2 text-[12px] shadow-elegant">
                    <p className="font-semibold">{d.dia.split("-").reverse().join("/")}</p>
                    <p className="text-muted-foreground">Não rodou neste dia</p>
                  </div>
                );
              return (
                <div className="rounded-xl border border-border bg-white/95 px-3 py-2 text-[12px] shadow-elegant">
                  <p className="font-semibold">{d.dia.split("-").reverse().join("/")}</p>
                  <p>
                    Subida: <b>{nf(d.x.subida_por_100km)} m</b> /100 km{" "}
                    <span style={{ color: c.cor }}>({c.rotulo})</span>
                  </p>
                  {d.x.pct_aclive != null && <p>Em aclive: {nf(d.x.pct_aclive, 1)}% do caminho</p>}
                  <p>Km: {nf(d.x.km)}</p>
                  {d.x.kml != null && <p>Consumo: {nf(d.x.kml, 2)} km/l</p>}
                  {d.x.pct_faixa_eco != null && <p>Faixa econômica: {nf(d.x.pct_faixa_eco, 1)}%</p>}
                  {onDia && (
                    <p className="mt-1 text-muted-foreground">Clique para ver o perfil do dia</p>
                  )}
                </div>
              );
            }}
          />
          <Bar
            yAxisId="s"
            dataKey="Subida por 100 km"
            fill="#8A6A3A"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            animationDuration={900}
          />
          <Line
            yAxisId="k"
            dataKey="Km"
            stroke="var(--brand-navy)"
            strokeWidth={2}
            dot={{ r: 2 }}
            animationDuration={900}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
