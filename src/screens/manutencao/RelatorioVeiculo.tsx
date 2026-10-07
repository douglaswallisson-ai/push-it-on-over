import { useState } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import { InspecaoVeiculo, avaliarSinal } from "@/components/ss/frota/InspecaoVeiculo";
import { tipoPorCategoria } from "@/components/ss/mapa/iconesVeiculo";
import { lerSessao } from "@/lib/session";
import type { OrdemServico, Sinais, VeiculoManut } from "@/lib/manutencao-api";
import { ROTULO_STATUS_OS } from "@/lib/manutencao-api";
import { cn } from "@/lib/utils";

/**
 * Relatório técnico do veículo para enviar ao cliente: todos os sinais da
 * última leitura com a referência usada, alertas, plano preventivo, ordens
 * abertas, histórico de serviços e uma observação escrita na hora.
 * "Imprimir / salvar em PDF" usa a impressão do navegador.
 */

const nf = (v: number | null | undefined, c = 0) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });
const dataBR = (s?: string | null) =>
  s ? new Date(s.length <= 10 ? `${s}T12:00` : s).toLocaleDateString("pt-BR") : "—";

const SINAIS: { id: keyof Sinais; rotulo: string }[] = [
  { id: "temp", rotulo: "Temperatura do motor (arrefecimento)" },
  { id: "oleo", rotulo: "Pressão do óleo" },
  { id: "voltage", rotulo: "Tensão elétrica (bateria/alternador)" },
  { id: "combustivel", rotulo: "Nível de combustível" },
  { id: "arla", rotulo: "Nível de ARLA 32" },
  { id: "ar_freio", rotulo: "Pressão do ar dos freios" },
  { id: "rpm", rotulo: "Rotação do motor (RPM)" },
];
const SITUACAO = {
  ok: ["Normal", "text-leaf"],
  atencao: ["Atenção", "text-gold"],
  critico: ["Crítico", "text-coral"],
  sem: ["Sem sensor", "text-muted-foreground"],
} as const;

export function RelatorioVeiculo({
  v,
  limites,
  ordens,
  historico,
  onClose,
}: {
  v: VeiculoManut;
  limites: Record<string, number>;
  ordens: OrdemServico[];
  historico: {
    id: number;
    servico: string;
    data: string;
    odometro_km: number | null;
    custo: number | null;
    oficina: string | null;
  }[];
  onClose: () => void;
}) {
  const [obs, setObs] = useState("");
  const [responsavel, setResponsavel] = useState(lerSessao()?.nome ?? "");
  const cliente = lerSessao()?.organizacaoAtiva ?? "";
  const geradoEm = new Date().toLocaleString("pt-BR");
  const tipo = tipoPorCategoria(v.categoria_id) === "onibus" ? "onibus" : "caminhao";
  const abertas = ordens.filter(
    (o) => o.unit_id === v.unit_id && o.status !== "concluida" && o.status !== "cancelada",
  );
  const nome = [v.prefixo, v.placa].filter(Boolean).join(" · ") || `#${v.unit_id}`;

  // Fora da gaveta: dentro dela, "fixed" fica preso ao painel e a impressão sai cortada.
  return createPortal(
    <div className="fixed inset-0 z-[300] overflow-y-auto bg-[rgba(10,16,28,0.6)] p-4 md:p-10">
      <style>{`@media print { @page { size: A4; margin: 12mm; } body * { visibility: hidden !important; } .rel-veic, .rel-veic * { visibility: visible !important; } .rel-veic { position: absolute; inset: 0; box-shadow: none !important; padding: 0 !important; } .rel-nao-imprimir { display: none !important; } .rel-so-impressao { display: block !important; } }`}</style>
      <div className="rel-nao-imprimir mx-auto mb-3 flex max-w-[860px] justify-end gap-2">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow"
        >
          <Printer className="h-4 w-4" /> Imprimir / salvar em PDF
        </button>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm shadow"
        >
          <X className="h-4 w-4" /> Fechar
        </button>
      </div>

      <div className="rel-veic mx-auto max-w-[860px] space-y-5 rounded-2xl bg-white p-10 text-[13px] text-foreground shadow-elegant">
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-brand-navy">
              SS Telemática · relatório técnico do veículo
            </p>
            <h1 className="mt-1 text-[20px] font-bold">{nome}</h1>
            <p className="text-muted-foreground">
              {[v.modelo, v.ano, v.categoria].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-right text-[12px]">
            {cliente && <p className="font-semibold">{cliente}</p>}
            <p className="text-muted-foreground">Gerado em {geradoEm}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            [
              "Odômetro",
              v.odometro_km != null
                ? `${nf(v.odometro_km)} km${v.odometro_travado ? " (travado)" : ""}`
                : "—",
            ],
            [
              "Última leitura",
              v.ultimo_sinal ? new Date(v.ultimo_sinal).toLocaleString("pt-BR") : "—",
            ],
            ["Plano preventivo", v.plano?.nome ?? "sem plano"],
          ].map(([a, b]) => (
            <div key={a} className="rounded-lg border border-border px-3 py-2">
              <p className="text-[12px] uppercase tracking-wide text-muted-foreground">{a}</p>
              <p className="font-semibold">{b}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-[520px]">
          <InspecaoVeiculo tipo={tipo} sinais={v.sinais} limites={limites} />
        </div>

        <section>
          <h2 className="mb-2 text-[14px] font-bold">Sinais do veículo</h2>
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5">Sinal</th>
                <th className="py-1.5">Valor</th>
                <th className="py-1.5">Situação</th>
                <th className="py-1.5">Referência usada</th>
              </tr>
            </thead>
            <tbody>
              {SINAIS.map((s) => {
                const a =
                  s.id === "rpm"
                    ? {
                        tom: v.sinais.rpm == null ? "sem" : "ok",
                        valor: v.sinais.rpm == null ? "—" : nf(v.sinais.rpm),
                        detalhe: "Rotação no momento da leitura.",
                      }
                    : avaliarSinal(s.id, v.sinais, limites);
                const [rot, cor] = SITUACAO[a.tom as keyof typeof SITUACAO];
                return (
                  <tr key={s.id} className="border-b border-border/60 align-top">
                    <td className="py-1.5 pr-3">{s.rotulo}</td>
                    <td className="py-1.5 pr-3 font-mono font-semibold">{a.valor}</td>
                    <td className={cn("py-1.5 pr-3 font-semibold", cor)}>{rot}</td>
                    <td className="py-1.5 text-muted-foreground">{a.detalhe}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-2 text-[14px] font-bold">Alertas</h2>
          {v.alertas.length ? (
            <ul className="list-disc space-y-1 pl-5">
              {v.alertas.map((a) => (
                <li key={a.chave}>
                  <b>{a.titulo}</b> ({a.nivel === "critico" ? "crítico" : "atenção"}): {a.detalhe}
                  {a.acao ? ` O que fazer: ${a.acao}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Nenhum sinal fora do normal na última leitura.</p>
          )}
        </section>

        {v.itens.length > 0 && (
          <section>
            <h2 className="mb-2 text-[14px] font-bold">Manutenção preventiva</h2>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5">Serviço</th>
                  <th className="py-1.5">Último</th>
                  <th className="py-1.5">Próximo</th>
                  <th className="py-1.5">Situação</th>
                </tr>
              </thead>
              <tbody>
                {v.itens.map((i) => (
                  <tr key={i.servico} className="border-b border-border/60">
                    <td className="py-1.5 pr-3">{i.servico}</td>
                    <td className="py-1.5 pr-3">
                      {i.ultimo
                        ? `${dataBR(i.ultimo.data)}${i.ultimo.odometro_km != null ? ` · ${nf(i.ultimo.odometro_km)} km` : ""}`
                        : "sem registro"}
                    </td>
                    <td className="py-1.5 pr-3">
                      {[
                        i.proximo_km != null && `${nf(i.proximo_km)} km`,
                        i.proxima_data && dataBR(i.proxima_data),
                      ]
                        .filter(Boolean)
                        .join(" ou ") || "—"}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 font-semibold",
                        i.situacao === "vencido"
                          ? "text-coral"
                          : i.situacao === "vence_em_breve"
                            ? "text-gold"
                            : i.situacao === "em_dia"
                              ? "text-leaf"
                              : "text-muted-foreground",
                      )}
                    >
                      {
                        {
                          vencido: "Vencido",
                          vence_em_breve: "Vence em breve",
                          em_dia: "Em dia",
                          sem_registro: "Sem registro",
                        }[i.situacao]
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {abertas.length > 0 && (
          <section>
            <h2 className="mb-2 text-[14px] font-bold">Ordens de serviço abertas</h2>
            <ul className="space-y-1">
              {abertas.map((o) => (
                <li key={o.id}>
                  <b>OS {o.id}</b> · {o.titulo} · {ROTULO_STATUS_OS[o.status]} · aberta em{" "}
                  {dataBR(o.aberta_em)}
                  {o.responsavel ? ` · ${o.responsavel}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        {historico.length > 0 && (
          <section>
            <h2 className="mb-2 text-[14px] font-bold">Últimos serviços realizados</h2>
            <ul className="space-y-1">
              {historico.slice(0, 10).map((h) => (
                <li key={h.id}>
                  {dataBR(h.data)} · {h.servico}
                  {h.odometro_km != null ? ` · ${nf(h.odometro_km)} km` : ""}
                  {h.oficina ? ` · ${h.oficina}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-[14px] font-bold">Observações</h2>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={5}
            placeholder="Escreva a análise e as recomendações para o cliente. Este texto sai no relatório."
            className="rel-nao-imprimir w-full rounded-lg border border-border px-3 py-2 text-[13px]"
          />
          <p className="rel-so-impressao hidden whitespace-pre-wrap">{obs || "—"}</p>
        </section>

        <div className="grid grid-cols-2 gap-8 border-t border-border pt-4">
          <div>
            <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
              Responsável técnico
            </p>
            <input
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              className="rel-nao-imprimir mt-1 h-9 w-full rounded-lg border border-border px-3 text-[13px]"
            />
            <p className="rel-so-impressao hidden font-semibold">{responsavel || "—"}</p>
          </div>
          <div className="text-right text-[12px] text-muted-foreground">
            Sinais da última leitura do equipamento embarcado. As faixas de referência são as usadas
            pela plataforma e podem ser ajustadas por cliente.
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
