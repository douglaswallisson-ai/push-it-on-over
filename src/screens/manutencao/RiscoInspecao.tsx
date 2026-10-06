import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Battery,
  Camera,
  Fuel,
  Gauge,
  Loader2,
  Search,
  ShieldAlert,
  Thermometer,
  Wrench,
  X,
} from "lucide-react";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import {
  SilhuetaVeiculo,
  TIPO_VEICULO_LABEL,
  tipoDoVeiculo,
  type TipoVeiculo,
} from "@/components/ss/frota/SilhuetaVeiculo";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { causaRaizQuery, riscoQuery, type VeiculoRisco } from "@/lib/manutencao-risco-api";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Prioridade de inspeção — "inspecione estes primeiro", pela nota de risco
 * (ver endpoints/manutencao_risco.py). Cada ponto da nota tem o motivo à vista:
 * a oficina precisa saber POR QUE o veículo está no topo, não só a nota.
 *
 * Não há previsão de quebra: não chega código de falha (DTC) e o banco não tem
 * histórico de corretivas. Quando as corretivas forem registradas na
 * plataforma, dá para comparar a nota com as quebras reais e calibrar os pesos.
 */

const TOM: Record<VeiculoRisco["classe"], PillTone> = {
  alto: "coral",
  medio: "gold",
  baixo: "green",
};
const ROTULO: Record<VeiculoRisco["classe"], string> = {
  alto: "Risco alto",
  medio: "Risco médio",
  baixo: "Risco baixo",
};
const ICONE_TENDENCIA = { bateria: Battery, temperatura: Thermometer, consumo: Fuel };

/** Silhueta: a categoria do cadastro manda (ônibus no urbano e no fretamento, van é van); a descrição só refina. */
export function silhuetaDe(categoriaId: number | null, descricao: string): TipoVeiculo {
  const peloTexto = tipoDoVeiculo("", descricao);
  if (categoriaId === 22) return "micro";
  if (categoriaId === 15) return "van";
  if (categoriaId === 12)
    return peloTexto === "rodoviario" || peloTexto === "micro" ? peloTexto : "urbano";
  if (categoriaId === 20 || categoriaId === 21 || categoriaId === 7) return "carreta";
  if (categoriaId === 1 || categoriaId === 2 || categoriaId === 10 || categoriaId === 14)
    return "utilitario";
  if (categoriaId === 3) return peloTexto === "carreta" ? "carreta" : "caminhao";
  return peloTexto;
}

export default function RiscoInspecao({ g }: { g: string }) {
  const q = useQuery(riscoQuery(g));
  const [busca, setBusca] = useState("");
  const [classe, setClasse] = useState<"" | VeiculoRisco["classe"]>("");
  const [sel, setSel] = useState<VeiculoRisco | null>(null);
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (q.data?.veiculos ?? []).filter(
      (v) =>
        (!classe || v.classe === classe) &&
        (!t || [v.placa, v.prefixo, v.modelo].some((x) => (x ?? "").toLowerCase().includes(t))),
    );
  }, [q.data, busca, classe]);

  if (q.isPending)
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-border bg-card px-5 py-8 text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Calculando o risco da frota (sinais de 14 dias
        e condução de 30 dias)…
      </p>
    );
  if (q.error)
    return (
      <p className="rounded-2xl border border-coral-line bg-coral-tint px-5 py-4 text-[13px]">
        {mensagemErro(q.error)}
      </p>
    );
  const r = q.data!;
  const comTendencia = r.veiculos.filter((v) => v.tendencias.length).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={ShieldAlert}
          label="Risco alto"
          value={String(r.resumo.alto)}
          color="var(--coral)"
          foot="nota 60 ou mais"
        />
        <StatTile
          icon={AlertTriangle}
          label="Risco médio"
          value={String(r.resumo.medio)}
          color="var(--gold)"
          foot="nota de 30 a 59"
        />
        <StatTile
          icon={Gauge}
          label="Com tendência ruim"
          value={String(comTendencia)}
          color="var(--brand-navy)"
          foot="bateria, temperatura ou consumo"
        />
        <StatTile
          icon={Wrench}
          label="Risco baixo"
          value={String(r.resumo.baixo)}
          color="var(--leaf)"
        />
      </div>

      <Card title="Inspecione primeiro" icon={ShieldAlert} bodyClassName="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id="risco-busca"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Placa, prefixo ou modelo…"
              className="h-9 w-full rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
            />
          </div>
          {(["", "alto", "medio", "baixo"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setClasse(c)}
              aria-pressed={classe === c}
              className={cn(
                "h-8 rounded-full border px-3 text-[12px] font-medium",
                classe === c
                  ? "border-brand-navy bg-brand-navy text-white"
                  : "border-border bg-white hover:bg-secondary",
              )}
            >
              {c ? ROTULO[c] : "Todos"}
            </button>
          ))}
        </div>

        <ol className="space-y-2">
          {lista.slice(0, 120).map((v, i) => {
            const tipo = silhuetaDe(v.categoria_id, `${v.prefixo ?? ""} ${v.modelo ?? ""}`);
            return (
              <li key={v.unit_id}>
                <button
                  type="button"
                  onClick={() => setSel(v)}
                  className="flex w-full items-start gap-3 rounded-xl border border-border bg-white p-3 text-left hover:bg-secondary/40"
                >
                  <span className="w-6 pt-1 text-right font-mono text-[12px] text-muted-foreground">
                    {i + 1}
                  </span>
                  <span
                    className="flex w-16 shrink-0 flex-col items-center text-muted-foreground"
                    title={TIPO_VEICULO_LABEL[tipo]}
                  >
                    <SilhuetaVeiculo tipo={tipo} className="h-8 w-16" />
                    <span className="text-[10px]">{TIPO_VEICULO_LABEL[tipo]}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[14px] font-bold text-foreground">
                        {v.placa}
                      </span>
                      {v.prefixo && v.prefixo !== v.placa && (
                        <span className="truncate text-[12px] text-muted-foreground">
                          {v.prefixo}
                        </span>
                      )}
                      <Pill tone={TOM[v.classe]}>
                        {ROTULO[v.classe]} · {v.risco}
                      </Pill>
                    </span>
                    <span className="mt-1 block text-[12px] text-muted-foreground">
                      {v.motivos.length
                        ? v.motivos
                            .slice(0, 3)
                            .map((m) => `${m.texto} (+${m.pontos})`)
                            .join(" · ")
                        : "Nenhum ponto de atenção."}
                    </span>
                  </span>
                  <span className="hidden w-32 shrink-0 sm:block" aria-hidden>
                    <span className="block h-2 overflow-hidden rounded-full bg-secondary">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${v.risco}%`,
                          background:
                            v.classe === "alto"
                              ? "var(--coral)"
                              : v.classe === "medio"
                                ? "var(--gold)"
                                : "var(--leaf)",
                        }}
                      />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        {lista.length > 120 && (
          <p className="text-[12px] text-muted-foreground">
            Mostrando os 120 de maior risco de {lista.length}.
          </p>
        )}
        <p className="text-[12px] text-muted-foreground">
          Nota de 0 a 100: alerta crítico +{r.pesos.critico}, de atenção +{r.pesos.atencao}, item
          vencido +{r.pesos.vencido}, tendência ruim +{r.pesos.tendencia}, condução até +
          {r.pesos.conducao_max}. Tendência compara o início e o fim de {r.dias_tendencia} dias. Não
          é previsão de quebra: o equipamento não envia código de falha e ainda não há histórico de
          corretivas para comparar.
        </p>
      </Card>

      <Sheet open={sel !== null} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[720px]">
          {sel && <Detalhe v={sel} onFechar={() => setSel(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Detalhe({ v, onFechar }: { v: VeiculoRisco; onFechar: () => void }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [ate, setAte] = useState(hoje);
  const [dias, setDias] = useState(7);
  const cr = useQuery(causaRaizQuery(v.unit_id, ate, dias));
  const tipo = silhuetaDe(v.categoria_id, `${v.prefixo ?? ""} ${v.modelo ?? ""}`);
  return (
    <div className="space-y-5 pb-8">
      <SheetHeader>
        <SheetTitle className="flex items-center gap-3">
          <SilhuetaVeiculo tipo={tipo} className="h-8 w-16 text-muted-foreground" />
          <span className="font-mono">{v.placa}</span>
          <Pill tone={TOM[v.classe]}>
            {ROTULO[v.classe]} · {v.risco}
          </Pill>
        </SheetTitle>
        <SheetDescription>
          {[TIPO_VEICULO_LABEL[tipo], v.prefixo, v.modelo].filter(Boolean).join(" · ")}
        </SheetDescription>
      </SheetHeader>
      <button type="button" onClick={onFechar} className="sr-only">
        Fechar
      </button>

      <section className="space-y-2">
        <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
          Por que está nesta posição
        </h4>
        {v.motivos.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">Nenhum ponto de atenção.</p>
        ) : (
          <ul className="space-y-1">
            {v.motivos.map((m, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px]"
              >
                <span>{m.texto}</span>
                <span className="font-mono text-[12px] font-semibold">+{m.pontos}</span>
              </li>
            ))}
          </ul>
        )}
        {v.tendencias.map((t) => {
          const Ic = ICONE_TENDENCIA[t.chave];
          return (
            <p
              key={t.chave}
              className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-[12px]"
            >
              <Ic className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span>
                <b>{t.titulo}.</b> {t.detalhe}
              </span>
            </p>
          );
        })}
        {v.conducao && (
          <p className="text-[12px] text-muted-foreground">
            Condução em 30 dias ({v.conducao.km_30d.toLocaleString("pt-BR")} km):{" "}
            {v.conducao.eventos_100km.toLocaleString("pt-BR")} eventos a cada 100 km
            {v.conducao.percentil != null
              ? ` — mais que ${Math.round(v.conducao.percentil * 100)}% da frota`
              : ""}
            . Freadas {v.conducao.freadas}, acelerações {v.conducao.aceleracoes}, embreagem{" "}
            {v.conducao.embreagem}.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h4 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Linha do tempo para causa raiz
          </h4>
          <div className="flex items-center gap-2 text-[12px]">
            <label htmlFor="cr-ate" className="text-muted-foreground">
              até
            </label>
            <input
              id="cr-ate"
              type="date"
              value={ate}
              max={hoje}
              onChange={(e) => setAte(e.target.value || hoje)}
              className="h-8 rounded-lg border border-border bg-white px-2"
            />
            <select
              id="cr-dias"
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              className="h-8 rounded-lg border border-border bg-white px-2"
            >
              {[7, 14, 30].map((d) => (
                <option key={d} value={d}>
                  {d} dias
                </option>
              ))}
            </select>
          </div>
        </div>
        {cr.isPending ? (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Montando a linha do tempo…
          </p>
        ) : cr.error ? (
          <p className="text-[13px] text-coral">{mensagemErro(cr.error)}</p>
        ) : (
          <>
            {cr.data!.pontos_de_atencao.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-coral/30 bg-coral/5 p-3 text-[13px]">
                {cr.data!.pontos_de_atencao.map((p) => (
                  <li key={p} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-coral" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
            <ol className="space-y-2 border-l-2 border-border pl-4">
              {[...cr.data!.dias].reverse().map((d) => {
                const parado = !d.km;
                return (
                  <li key={d.dia} className="relative">
                    <span
                      className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full border-2 border-white"
                      style={{
                        background: parado ? "var(--muted-foreground)" : "var(--brand-navy)",
                      }}
                    />
                    <div className="flex flex-wrap items-baseline gap-x-3 text-[13px]">
                      <b className="font-mono">
                        {d.dia.slice(8, 10)}/{d.dia.slice(5, 7)}
                      </b>
                      <span className="text-muted-foreground">
                        {parado && d.em_andamento
                          ? "Dia em andamento (km e consumo saem amanhã)"
                          : parado
                            ? "Não rodou"
                            : `${d.km?.toLocaleString("pt-BR")} km${d.km_l ? ` · ${d.km_l.toLocaleString("pt-BR")} km/l` : ""}${d.horas ? ` · ${d.horas} h` : ""}`}
                        {d.motoristas ? ` · ${d.motoristas}` : ""}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-muted-foreground">
                      {d.temp_max != null && (
                        <span className={cn(d.temp_max >= 100 && "font-semibold text-coral")}>
                          temp. máx. {d.temp_max} °C
                        </span>
                      )}
                      {d.v_repouso != null && <span>bateria em repouso {d.v_repouso} V</span>}
                      {d.v_carga != null && <span>carregando {d.v_carga} V</span>}
                      {d.rpm_max != null && <span>rpm máx. {d.rpm_max}</span>}
                      {d.arla_min != null && <span>ARLA mín. {d.arla_min}%</span>}
                    </div>
                    {[...d.eventos, ...d.alarmes].length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {[...d.eventos, ...d.alarmes].slice(0, 8).map((e) => (
                          <span
                            key={e.evento}
                            className="rounded bg-secondary px-1.5 py-0.5 text-[11px]"
                          >
                            {e.evento} ×{e.n}
                          </span>
                        ))}
                      </div>
                    )}
                    {d.camera.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {d.camera.slice(0, 6).map((e) => (
                          <span
                            key={e.evento}
                            className="inline-flex items-center gap-1 rounded bg-navy-tint px-1.5 py-0.5 text-[11px]"
                          >
                            <Camera className="h-3 w-3" />
                            {e.evento} ×{e.n}
                          </span>
                        ))}
                      </div>
                    )}
                    {d.servicos.map((s) => (
                      <p key={s.servico} className="mt-1 text-[12px] font-medium text-leaf">
                        Serviço: {s.servico}
                        {s.oficina ? ` (${s.oficina})` : ""}
                      </p>
                    ))}
                  </li>
                );
              })}
            </ol>
            <p className="text-[12px] text-muted-foreground">{cr.data!.aviso}</p>
          </>
        )}
      </section>
      <button
        type="button"
        onClick={onFechar}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px]"
      >
        <X className="h-4 w-4" /> Fechar
      </button>
    </div>
  );
}
