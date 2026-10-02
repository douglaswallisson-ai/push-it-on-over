import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Award, CalendarDays, Fuel, Gauge, Info, Leaf, Printer, Route, ShieldCheck, Wind, X } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { SSGreenSeal } from "@/components/ss/brand/SSGreenSeal";
import { Card, StatTile } from "@/components/ss/ui/data";
import { co2Query, iso, ontem, type Co2Resultado } from "@/lib/gerencial-api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { cn } from "@/lib/utils";

/**
 * Emissão de CO₂ e certificado "CO₂ Reduzido", com dados reais.
 *
 * Regra do Power BI (vault): CO₂ = litros evitados × 3,21 kg; litros evitados
 * = melhora do km/l × consumo do período. O km/l é o da telemetria. A SS
 * certifica REDUÇÃO medida — nunca neutralidade.
 */

const nf = (v: number | null | undefined, c = 0) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const dataBR = (s: string) => new Date(s + "T12:00").toLocaleDateString("pt-BR");
const mesRot = (m: string) => `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

function menosAno(s: string) {
  const [a, m, d] = s.split("-").map(Number);
  const x = new Date(a - 1, m - 1, d);
  return iso(x);
}

/** Código de verificação: resumo dos números do certificado (FNV-1a). */
function codigo(r: Co2Resultado, grupo: string) {
  const base = [grupo, r.periodo.inicio, r.periodo.fim, r.referencia.inicio, r.referencia.fim, r.litros, r.litros_evitados, r.co2_evitado_t].join("|");
  let h = 0x811c9dc5;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `SSG-${r.periodo.fim.slice(0, 4)}-${h.toString(16).toUpperCase().padStart(8, "0")}`;
}

type Preset = "12m" | "ano" | "6m" | "livre";

export default function CO2Real() {
  const grupo = grupoAtivo();
  const fimPadrao = iso(ontem());
  const [preset, setPreset] = useState<Preset>("12m");
  const [livre, setLivre] = useState({ inicio: menosAno(fimPadrao), fim: fimPadrao });
  const [refModo, setRefModo] = useState<"ano_anterior" | "livre">("ano_anterior");
  const [ref, setRef] = useState({ inicio: "", fim: "" });
  const [certificado, setCertificado] = useState(false);

  const periodo = useMemo(() => {
    const f = new Date(fimPadrao + "T12:00");
    if (preset === "ano") return { inicio: `${f.getFullYear()}-01-01`, fim: fimPadrao };
    if (preset === "6m") { const i = new Date(f); i.setMonth(i.getMonth() - 6); i.setDate(i.getDate() + 1); return { inicio: iso(i), fim: fimPadrao }; }
    if (preset === "livre") return livre;
    const i = new Date(f); i.setFullYear(i.getFullYear() - 1); i.setDate(i.getDate() + 1);
    return { inicio: iso(i), fim: fimPadrao };
  }, [preset, livre, fimPadrao]);

  const q = useQuery(
    co2Query({
      inicio: periodo.inicio,
      fim: periodo.fim,
      refInicio: refModo === "livre" && ref.inicio ? ref.inicio : undefined,
      refFim: refModo === "livre" && ref.fim ? ref.fim : undefined,
    }),
  );
  const r = q.data;
  const serie = (r?.serie ?? []).map((m) => ({ rotulo: mesRot(m.mes), "CO₂ emitido (t)": m.co2_emitido_t, "CO₂ evitado (t)": m.co2_evitado_t, "Km/l": m.kml, "Km/l referência": m.kml_referencia }));
  const sel = "h-9 rounded-lg border border-border bg-white px-2.5 text-[13px]";

  return (
    <>
      <PageHeader
        title="Emissão de CO₂"
        subtitle="Frota › Emissões e certificado CO₂ Reduzido"
        actions={
          <button
            onClick={() => setCertificado(true)}
            disabled={!r?.certificavel || !grupo}
            title={!grupo ? "Escolha uma empresa no seletor" : r && !r.certificavel ? (r.motivo ?? "") : "Emitir o certificado do período"}
            className="inline-flex items-center gap-2 rounded-full bg-leaf px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            <Award className="h-4 w-4" />
            Emitir certificado
          </button>
        }
      />
      <div className="mx-auto max-w-[1360px] space-y-5 px-6 py-6 md:px-8">
        {!grupo && (
          <div className="flex items-start gap-2 rounded-xl border border-gold-line bg-gold-tint px-4 py-3 text-[12.5px]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            Os números abaixo somam todas as empresas do seu acesso. O certificado é por empresa: escolha uma no seletor de organização.
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-card">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className={sel} aria-label="Período">
            <option value="12m">Últimos 12 meses</option>
            <option value="6m">Últimos 6 meses</option>
            <option value="ano">Ano atual</option>
            <option value="livre">Escolher datas…</option>
          </select>
          {preset === "livre" && (
            <>
              <input type="date" value={livre.inicio} onChange={(e) => e.target.value && setLivre((x) => ({ ...x, inicio: e.target.value }))} className={sel} />
              <span className="text-[12px] text-muted-foreground">a</span>
              <input type="date" value={livre.fim} max={fimPadrao} onChange={(e) => e.target.value && setLivre((x) => ({ ...x, fim: e.target.value }))} className={sel} />
            </>
          )}
          <span className="ml-2 text-[12.5px] text-muted-foreground">comparado com</span>
          <select value={refModo} onChange={(e) => setRefModo(e.target.value as "ano_anterior" | "livre")} className={sel} aria-label="Referência">
            <option value="ano_anterior">o mesmo período do ano anterior</option>
            <option value="livre">outro período (ex.: início da operação)…</option>
          </select>
          {refModo === "livre" && (
            <>
              <input type="date" value={ref.inicio} onChange={(e) => setRef((x) => ({ ...x, inicio: e.target.value }))} className={sel} />
              <span className="text-[12px] text-muted-foreground">a</span>
              <input type="date" value={ref.fim} onChange={(e) => setRef((x) => ({ ...x, fim: e.target.value }))} className={sel} />
            </>
          )}
        </div>

        {q.error ? (
          <p className="py-10 text-center text-sm text-coral">Não foi possível calcular: {(q.error as Error).message}</p>
        ) : q.isPending || !r ? (
          <div className="h-48 animate-pulse rounded-2xl bg-secondary" />
        ) : (
          <>
            <section className="overflow-hidden rounded-2xl border border-leaf-line bg-gradient-to-br from-leaf-tint via-white to-navy-tint shadow-card">
              <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[auto_1fr] lg:items-center">
                <div className="flex justify-center"><SSGreenSeal size={190} /></div>
                <div>
                  <div className="mb-1 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-leaf">
                    <Leaf className="h-3.5 w-3.5" /> Redução medida por telemetria
                  </div>
                  {r.certificavel ? (
                    <h2 className="text-2xl font-bold leading-tight md:text-[30px]">
                      A frota deixou de emitir <span className="text-leaf">{nf(r.co2_evitado_t, 1)} t de CO₂</span> no período.
                    </h2>
                  ) : (
                    <h2 className="text-2xl font-bold leading-tight md:text-[28px]">Sem redução de CO₂ a certificar neste período.</h2>
                  )}
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
                    {r.certificavel ? (
                      <>
                        O km/l passou de <b>{nf(r.kml_referencia, 2)}</b> para <b>{nf(r.kml, 2)}</b> (+{nf(r.melhora_pct, 1)}%). Rodando os mesmos{" "}
                        {nf(r.km)} km com a média antiga, a frota gastaria mais <b>{nf(r.litros_evitados)} litros</b> de diesel.
                      </>
                    ) : (
                      r.motivo
                    )}
                  </p>
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Período {dataBR(r.periodo.inicio)} a {dataBR(r.periodo.fim)} · referência {dataBR(r.referencia.inicio)} a {dataBR(r.referencia.fim)} · fator {nf(r.fator_kg_l, 2)} kg de CO₂ por litro
                  </p>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile icon={Leaf} label="CO₂ evitado" value={nf(r.co2_evitado_t, 1)} unit="t" color="var(--leaf)" foot={`${nf(r.litros_evitados)} L evitados`} />
              <StatTile icon={Wind} label="CO₂ emitido" value={nf(r.co2_emitido_t, 1)} unit="t" color="var(--brand-sky)" foot={`${nf(r.co2_por_km_kg, 2)} kg por km`} />
              <StatTile icon={Fuel} label="Diesel consumido" value={nf(r.litros)} unit="L" color="var(--gold)" />
              <StatTile icon={Gauge} label="Km/l" value={nf(r.kml, 2)} color="var(--brand-navy)" foot={`referência ${nf(r.kml_referencia, 2)}`} />
              <StatTile icon={Route} label="Km rodados" value={nf(r.km)} unit="km" color="var(--brand-navy)" foot={`${nf(r.veiculos)} veículos`} />
            </div>

            <Card title="Emitido e evitado por mês" icon={Leaf} bodyClassName="p-4">
              <div className="h-[300px]">
                <ResponsiveContainer>
                  <ComposedChart data={serie}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="t" tick={{ fontSize: 11 }} unit=" t" width={70} />
                    <YAxis yAxisId="k" orientation="right" tick={{ fontSize: 11 }} domain={["auto", "auto"]} width={45} />
                    <Tooltip formatter={(v: number, n: string) => (n.startsWith("Km") ? nf(v, 2) : `${nf(v, 1)} t`)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar yAxisId="t" dataKey="CO₂ emitido (t)" fill="var(--brand-sky)" radius={[4, 4, 0, 0]} animationDuration={900} />
                    <Bar yAxisId="t" dataKey="CO₂ evitado (t)" fill="var(--leaf)" radius={[4, 4, 0, 0]} animationDuration={900} />
                    <Line yAxisId="k" dataKey="Km/l" stroke="var(--brand-navy)" strokeWidth={2} dot={{ r: 2 }} connectNulls animationDuration={900} />
                    <Line yAxisId="k" dataKey="Km/l referência" stroke="var(--muted-foreground)" strokeDasharray="4 3" strokeWidth={1.5} dot={false} connectNulls animationDuration={900} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11.5px] text-muted-foreground">Cada mês é comparado com o mesmo mês da referência. O total do período usa o km/l do período inteiro.</p>
            </Card>

            <Card title="Metodologia" icon={ShieldCheck} bodyClassName="p-5 text-[13px] leading-relaxed text-ink-soft">
              <ul className="list-disc space-y-1.5 pl-5">
                <li><b>CO₂ emitido</b> = diesel consumido × {nf(r.fator_kg_l, 2)} kg/L (regra usada nos indicadores de condução da SS).</li>
                <li><b>Combustível evitado</b> = consumo do período × (km/l do período ÷ km/l da referência − 1) — o diesel a mais que a frota gastaria nos mesmos km com a média da referência.</li>
                <li><b>CO₂ evitado</b> = combustível evitado × {nf(r.fator_kg_l, 2)} kg/L.</li>
                <li>Km/l pela telemetria: km dos registros com combustível medido ÷ litros. Combustível negativo é descartado.</li>
                <li>Sem melhora do km/l, não há redução a certificar. Com menos de 80% dos dias da referência com dado, a comparação não é certificada.</li>
                <li>A SS certifica <b>redução medida</b>, não neutralidade de carbono. Mudanças grandes na frota entre os períodos (veículos novos, outro tipo de operação) afetam o km/l e devem ser consideradas.</li>
              </ul>
            </Card>
          </>
        )}
      </div>
      {certificado && r && grupo && <Certificado r={r} grupo={grupo} onClose={() => setCertificado(false)} />}
    </>
  );
}

function Certificado({ r, grupo, onClose }: { r: Co2Resultado; grupo: string; onClose: () => void }) {
  const cod = codigo(r, grupo);
  const emitidoEm = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const nome = r.empresa?.corporate_name || r.empresa?.name || `Empresa ${grupo}`;
  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto bg-[rgba(10,16,28,0.6)] p-4 md:p-10">
      {/* Na impressão só o certificado aparece, numa página A4 deitada. */}
      <style>{`@media print { @page { size: A4 landscape; margin: 10mm; } body * { visibility: hidden !important; } .cert-co2, .cert-co2 * { visibility: visible !important; } .cert-co2 { position: absolute; inset: 0; margin: 0 !important; box-shadow: none !important; } .cert-nao-imprimir { display: none !important; } }`}</style>
      <div className="cert-nao-imprimir mx-auto mb-3 flex max-w-[1050px] justify-end gap-2">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow">
          <Printer className="h-4 w-4" /> Imprimir / salvar em PDF
        </button>
        <button onClick={onClose} className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-ink-soft shadow">
          <X className="h-4 w-4" /> Fechar
        </button>
      </div>
      <div className="cert-co2 relative mx-auto max-w-[1050px] overflow-hidden rounded-2xl bg-white shadow-elegant" style={{ aspectRatio: "1.414 / 1" }}>
        <div className="absolute inset-3 rounded-xl border-[3px] border-double" style={{ borderColor: "#7FBF50" }} />
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-[0.07]" style={{ background: "radial-gradient(circle, #2E86C8, transparent 70%)" }} />
        <div className="relative flex h-full flex-col px-14 py-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#2E86C8" }}>SS Telemática · SS Green</p>
              <h1 className="mt-2 font-display text-[34px] font-bold leading-tight" style={{ color: "#1B3A6B" }}>Certificado de Redução<br />de Emissões de CO₂</h1>
            </div>
            <SSGreenSeal size={150} />
          </div>

          <p className="mt-5 text-[14px] text-ink-soft">Certificamos que a frota de</p>
          <p className="font-display text-[26px] font-bold" style={{ color: "#1B3A6B" }}>{nome}</p>
          {r.empresa?.cnpj && <p className="text-[12.5px] text-muted-foreground">CNPJ {r.empresa.cnpj}</p>}
          <p className="mt-3 max-w-[760px] text-[14px] leading-relaxed text-ink-soft">
            deixou de emitir, entre <b>{dataBR(r.periodo.inicio)}</b> e <b>{dataBR(r.periodo.fim)}</b>, em comparação com o período de{" "}
            {dataBR(r.referencia.inicio)} a {dataBR(r.referencia.fim)}, a quantidade de
          </p>

          <div className="mt-3 flex items-end gap-10">
            <div>
              <p className="font-display text-[56px] font-bold leading-none" style={{ color: "#4E9A2C" }}>{nf(r.co2_evitado_t, 1)} t</p>
              <p className="mt-1 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">de CO₂ evitadas</p>
            </div>
            <div className="grid grid-cols-3 gap-6 pb-1 text-[12.5px]">
              {[
                ["Diesel evitado", `${nf(r.litros_evitados)} L`],
                ["Km/l", `${nf(r.kml_referencia, 2)} → ${nf(r.kml, 2)} (+${nf(r.melhora_pct, 1)}%)`],
                ["Distância medida", `${nf(r.km)} km · ${nf(r.veiculos)} veículos`],
              ].map(([a, b]) => (
                <div key={a}>
                  <p className="text-muted-foreground">{a}</p>
                  <p className="font-semibold text-foreground">{b}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-5 max-w-[860px] text-[11px] leading-relaxed text-muted-foreground">
            Metodologia: combustível evitado = consumo do período × (km/l do período ÷ km/l da referência − 1), com km e litros medidos pela telemetria embarcada
            (km dos registros com combustível medido ÷ litros). CO₂ = litros × {nf(r.fator_kg_l, 2)} kg/L. Certifica redução medida, não neutralidade de carbono.
          </p>

          <div className="mt-auto flex items-end justify-between pt-4">
            <div className="text-[12px] text-ink-soft">
              <p>Emitido em {emitidoEm}</p>
              <p className="font-mono text-[11px] text-muted-foreground">Código de verificação: {cod}</p>
            </div>
            <div className="text-center">
              <div className="mb-1 h-px w-56 bg-ink-soft/40" />
              <p className="text-[12px] font-semibold text-foreground">SS Telemática</p>
              <p className="text-[11px] text-muted-foreground">Telemetria verificada</p>
            </div>
          </div>
        </div>
        <span className={cn("sr-only")}>{cod}</span>
      </div>
    </div>
  );
}


