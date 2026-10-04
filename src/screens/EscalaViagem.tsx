import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, MapPin, Plus, Printer, Route, ShieldCheck, Trash2, Users, X,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, Pill, type PillTone } from "@/components/ss/ui/data";
import { MapaCliente } from "@/components/ss/mapa/MapaCliente";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { usandoMock } from "@/lib/modo";
import { veiculosApiQuery } from "@/lib/queries";
import {
  Escala, escalaDiaQuery, escalaIndicadoresQuery, escalaPoisQuery, escalaRotasQuery, ROTULO_TIPO,
  type Destinatario, type PontoPlano, type TipoPonto, type Viagem,
} from "@/lib/escala-api";
import { cn } from "@/lib/utils";

/**
 * Escala de Viagem — o plano de viagem declarado à gerenciadora de risco (GR)
 * e o relatório de conformidade por viagem (previsto × realizado pelo
 * rastreador). A SS é a fonte de evidência, não a gerenciadora.
 */

const nf = (v: number | null | undefined, c = 0) => (v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c }));
const brl = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }));
const hora = (s: string | null | undefined) => (s ? new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—");
const dataHora = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const haMin = (s: string | null) => (s ? Math.round((Date.now() - new Date(s).getTime()) / 60000) : null);

type Filtro = "todas" | "aguardando" | "em_rota" | "desvio" | "concluida";

function statusDe(v: Viagem): { rotulo: string; tom: PillTone } {
  if (v.cancelada) return { rotulo: "Cancelada", tom: "neutral" };
  if (v.realizado.com_desvio) return { rotulo: "Desvio", tom: "coral" };
  if (v.status_gr === "aguardando") return { rotulo: "Aguardando GR", tom: "gold" };
  if (v.status_gr === "reprovada") return { rotulo: "Reprovada pela GR", tom: "coral" };
  if (v.realizado.situacao === "em_rota") return { rotulo: "Em rota", tom: "sky" };
  if (v.realizado.situacao === "concluida") return { rotulo: "Concluída", tom: "green" };
  return { rotulo: "Aprovada", tom: "green" };
}

export default function EscalaViagem() {
  const grupo = grupoAtivo();
  const [dia, setDia] = useState(isoLocal(new Date()));
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [sel, setSel] = useState<number | null>(null);
  const [nova, setNova] = useState(false);
  const [relatorio, setRelatorio] = useState<Viagem | null>(null);
  const q = useQuery(escalaDiaQuery(grupo, dia));
  const ind = useQuery(escalaIndicadoresQuery(grupo));
  const viagens = q.data?.viagens ?? [];
  const atual = viagens.find((v) => v.id === sel) ?? viagens[0] ?? null;

  const conta = {
    aguardando: viagens.filter((v) => v.status_gr === "aguardando" && !v.cancelada).length,
    em_rota: viagens.filter((v) => v.realizado.situacao === "em_rota").length,
    desvio: viagens.filter((v) => v.realizado.com_desvio).length,
    concluida: viagens.filter((v) => v.realizado.situacao === "concluida").length,
  };
  const desviosAbertos = viagens.reduce((a, v) => a + v.realizado.ocorrencias.filter((o) => o.em_andamento || v.realizado.situacao === "em_rota").length, 0);
  const lista = viagens.filter((v) =>
    filtro === "todas" ? true : filtro === "aguardando" ? v.status_gr === "aguardando" : filtro === "desvio" ? v.realizado.com_desvio : v.realizado.situacao === filtro,
  );

  if (usandoMock())
    return (
      <>
        <PageHeader title="Escala de Viagem" subtitle="Plano de viagem enviado à gerenciadora de risco" />
        <p className="py-16 text-center text-sm text-muted-foreground">Esta tela lê o rastreador: ligue a API real para usá-la.</p>
      </>
    );

  return (
    <>
      <PageHeader
        title="Escala de Viagem"
        subtitle="Plano de viagem enviado à gerenciadora de risco · previsto × realizado pelo rastreador"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} className="h-9 rounded-lg border border-border bg-white px-2.5 text-[13px]" />
            <button
              disabled
              title="Integração com a gerenciadora a definir (qual GR e em que formato ela recebe)."
              className="rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-muted-foreground opacity-60"
            >
              Exportar para GR
            </button>
            <button onClick={() => setNova(true)} disabled={!grupo} className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              <Plus className="h-4 w-4" /> Nova escala
            </button>
          </div>
        }
      />
      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        {!grupo ? (
          <Card bodyClassName="p-8 text-center text-sm text-muted-foreground">Escolha a empresa no seletor de organização para ver e montar a escala.</Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {[
                { r: "Viagens do dia", v: nf(viagens.length), s: `${conta.aguardando} aguardando aprovação da GR`, cor: "text-foreground" },
                { r: "Em rota", v: nf(conta.em_rota), s: `${conta.concluida} concluídas`, cor: "text-leaf" },
                { r: "Desvios abertos", v: nf(desviosAbertos), s: "parada fora de ponto autorizado ou atraso", cor: desviosAbertos ? "text-coral" : "text-foreground" },
                {
                  r: "Conformidade do mês",
                  v: ind.data?.conformidade_pct == null ? "—" : `${nf(ind.data.conformidade_pct, 1)}%`,
                  s: `meta do seguro: ${nf(ind.data?.meta_pct, 0)}% (a confirmar) · ${nf(ind.data?.concluidas)} concluídas`,
                  cor: ind.data?.conformidade_pct != null && ind.data.conformidade_pct >= (ind.data.meta_pct ?? 95) ? "text-leaf" : "text-coral",
                },
              ].map((k) => (
                <div key={k.r} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground">{k.r}</p>
                  <p className={cn("mt-1 font-display text-3xl font-bold tabular-nums", k.cor)}>{k.v}</p>
                  <p className="text-[12px] text-muted-foreground">{k.s}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Card
                title={`Escala de ${new Date(dia + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })} — ${viagens.length} viagens`}
                icon={ClipboardCheck}
                bodyClassName="p-4"
              >
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {([["todas", "Todas", viagens.length], ["aguardando", "Aguardando GR", conta.aguardando], ["em_rota", "Em rota", conta.em_rota], ["desvio", "Desvio", conta.desvio], ["concluida", "Concluídas", conta.concluida]] as const).map(([id, r, n]) => (
                    <button key={id} onClick={() => setFiltro(id)} className={cn("rounded-full px-3 py-1 text-[12px] font-medium", filtro === id ? "bg-foreground text-white" : "border border-border bg-white text-muted-foreground hover:bg-secondary")}>
                      {r} <span className="ml-1 font-mono opacity-70">{n}</span>
                    </button>
                  ))}
                </div>
                {q.isPending ? (
                  <div className="h-40 animate-pulse rounded-xl bg-secondary" />
                ) : q.error ? (
                  <p className="py-8 text-center text-sm text-coral">{(q.error as Error).message}</p>
                ) : !lista.length ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma viagem na escala deste dia.
                    <button onClick={() => setNova(true)} className="ml-2 font-semibold text-brand-navy hover:underline">Montar a primeira</button>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full min-w-[820px] text-[13px]">
                      <thead className="bg-secondary">
                        <tr>
                          {["Viagem", "Veículo / motorista", "Rota", "Carga", "Paradas", "Status"].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left font-mono text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((v) => {
                          const st = statusDe(v);
                          const origem = v.pontos.find((p) => p.tipo === "origem")?.nome;
                          const destino = v.pontos.find((p) => p.tipo === "destino")?.nome;
                          return (
                            <tr key={v.id} onClick={() => setSel(v.id)} className={cn("cursor-pointer border-t border-border hover:bg-secondary/60", atual?.id === v.id && "bg-navy-tint/40", v.realizado.com_desvio && "bg-coral-tint/30")}>
                              <td className="px-4 py-3"><div className="font-semibold">{v.codigo}</div><div className="text-[12px] text-muted-foreground">{hora(v.saida_prevista)} saída</div></td>
                              <td className="px-4 py-3"><div className="font-medium">{v.veiculo?.label ?? v.unit_id}{v.veiculo?.label2 ? ` · ${v.veiculo.label2}` : ""}</div><div className="text-[12px] text-muted-foreground">{v.motorista ?? "motorista não informado"}</div></td>
                              <td className="px-4 py-3"><div className="font-medium">{origem ?? "—"} → {destino ?? "—"}</div><div className="text-[12px] text-muted-foreground">{v.rodovia ?? v.rota_nome ?? ""}{v.realizado.km ? ` · ${nf(v.realizado.km)} km rodados` : ""}</div></td>
                              <td className="px-4 py-3"><div>{v.carga_cliente ?? "—"}{v.carga_descricao ? ` · ${v.carga_descricao}` : ""}</div><div className="text-[12px] text-muted-foreground">{brl(v.carga_valor)}</div></td>
                              <td className="px-4 py-3 font-mono">{v.realizado.paradas_cumpridas} de {v.realizado.paradas_previstas}</td>
                              <td className="px-4 py-3"><Pill tone={st.tom}>{st.rotulo}</Pill></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {atual && <Detalhe v={atual} onRelatorio={() => setRelatorio(atual)} dia={dia} />}
            </div>
          </>
        )}
      </div>
      {nova && grupo && <NovaEscala grupo={grupo} dia={dia} onClose={() => setNova(false)} />}
      {relatorio && <RelatorioConformidade v={relatorio} onClose={() => setRelatorio(null)} />}
    </>
  );
}

/* ------------------------------ Painel lateral ----------------------------- */

function Detalhe({ v, onRelatorio, dia }: { v: Viagem; onRelatorio: () => void; dia: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const r = v.realizado;
  const st = statusDe(v);
  const origem = v.pontos.find((p) => p.tipo === "origem");
  const destino = v.pontos.find((p) => p.tipo === "destino");
  const aberta = r.ocorrencias.find((o) => o.tipo === "parada_fora_de_ponto" && (o.em_andamento || r.situacao === "em_rota")) ?? null;
  const salvar = async (dados: Record<string, unknown>, msg: string) => {
    try {
      await Escala.alterar(v.id, dados);
      await qc.invalidateQueries({ queryKey: ["escala", "dia"] });
      toast.success(msg);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  // Linha do tempo: origem, pontos do plano e paradas reais, em ordem.
  const linha = useMemo(() => {
    const itens: { quando: string | null; titulo: string; detalhe: string; tom: "ok" | "desvio" | "previsto" }[] = [];
    itens.push({ quando: v.saida_prevista, titulo: `Saída — ${origem?.nome ?? "origem"}`, detalhe: `${hora(v.saida_prevista)} · ${r.saida_real ? `realizado ${hora(r.saida_real)}` : "não saiu"}`, tom: r.saida_real ? "ok" : "previsto" });
    for (const p of r.paradas) {
      // Origem e destino já aparecem como saída e chegada.
      if ((origem && p.ponto === origem.nome) || (destino && p.ponto === destino.nome)) continue;
      itens.push({
        quando: p.inicio,
        titulo: p.conforme ? `Parada — ${p.ponto} (${ROTULO_TIPO[p.tipo ?? "posto"] ?? ""})` : `Parada não prevista${p.poi_proximo ? ` — perto de ${p.poi_proximo}` : ""}`,
        detalhe: `${hora(p.inicio)} · ${p.em_andamento ? "em andamento · " : ""}${p.minutos} min${p.conforme ? "" : ` · ponto autorizado mais próximo: ${p.ponto_mais_proximo ?? "—"} a ${nf((p.distancia_ponto_m ?? 0) / 1000, 1)} km`}`,
        tom: p.conforme ? "ok" : "desvio",
      });
    }
    for (const p of v.pontos.filter((x) => !["origem", "destino"].includes(x.tipo) && !r.paradas.some((y) => y.ponto === x.nome))) {
      itens.push({ quando: p.previsto ?? null, titulo: `${ROTULO_TIPO[p.tipo]} — ${p.nome}`, detalhe: p.previsto ? `previsto ${hora(p.previsto)}` : "previsto", tom: "previsto" });
    }
    itens.push({ quando: v.chegada_prevista, titulo: `Chegada — ${destino?.nome ?? "destino"}`, detalhe: `previsto ${dataHora(v.chegada_prevista)}${r.chegada_real ? ` · realizado ${dataHora(r.chegada_real)}` : ""}`, tom: r.chegada_real ? "ok" : "previsto" });
    return itens.sort((a, b) => (a.quando ?? "9").localeCompare(b.quando ?? "9"));
  }, [v, r, origem, destino]);

  const sinalMin = haMin(r.ultimo_sinal.hora);
  const porTipo = useMemo(() => {
    const m = new Map<TipoPonto, string[]>();
    for (const p of v.pontos.filter((x) => !["origem", "destino"].includes(x.tipo))) m.set(p.tipo, [...(m.get(p.tipo) ?? []), p.nome]);
    return [...m.entries()];
  }, [v]);

  return (
    <div className="space-y-4">
      <Card bodyClassName="p-0">
        <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
          <div>
            <p className="text-[16px] font-bold">{v.codigo}</p>
            <p className="text-[12px] text-muted-foreground">{origem?.nome} → {destino?.nome}{v.rodovia ? ` · ${v.rodovia}` : ""}</p>
          </div>
          <Pill tone={st.tom}>{st.rotulo}</Pill>
        </div>
        <div className="space-y-4 p-5">
          {aberta && (
            <div className="rounded-xl border border-coral-line bg-coral-tint/40 p-3 text-[13px]">
              <p className="flex items-center gap-1.5 font-semibold text-coral"><AlertTriangle className="h-4 w-4" /> Parada fora de ponto autorizado</p>
              <p className="mt-1 text-ink-soft">
                Veículo parado há {aberta.minutos} min{aberta.endereco ? ` em ${aberta.endereco}` : ""}. Ponto autorizado mais próximo: {aberta.ponto_mais_proximo ?? "—"} a {nf((aberta.distancia_ponto_m ?? 0) / 1000, 1)} km.
              </p>
              <p className="mt-1.5 text-[12px] text-muted-foreground">Ocorrência {aberta.id} aberta automaticamente · aviso aos destinatários: {aberta.notificacao}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-muted-foreground">Status na GR:</span>
            {(["aguardando", "aprovada", "reprovada"] as const).map((s) => (
              <button key={s} onClick={() => salvar({ status_gr: s }, "Status da GR atualizado.")} className={cn("rounded-full px-2.5 py-0.5", v.status_gr === s ? "bg-brand-navy text-white" : "border border-border hover:bg-secondary")}>
                {s === "aguardando" ? "Aguardando" : s === "aprovada" ? "Aprovada" : "Reprovada"}
              </button>
            ))}
          </div>
          <div>
            <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Plano de viagem</p>
            <ol className="relative space-y-3 border-l border-border pl-4">
              {linha.map((i, k) => (
                <li key={k} className="relative">
                  <span className={cn("absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white", i.tom === "ok" ? "bg-leaf" : i.tom === "desvio" ? "bg-coral" : "bg-muted-foreground/40")} />
                  <p className={cn("text-[13px] font-semibold", i.tom === "desvio" && "text-coral")}>{i.titulo}</p>
                  <p className="text-[12px] text-muted-foreground">{i.detalhe}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Card>

      <Card title="Trajeto" icon={MapPin} bodyClassName="p-3">
        <MapaCliente
          veiculos={r.ultimo_sinal.latitude != null ? [{ placa: v.veiculo?.label ?? String(v.unit_id), rotulo: v.veiculo?.label ?? String(v.unit_id), veiculoId: String(v.unit_id), lat: r.ultimo_sinal.latitude, lng: r.ultimo_sinal.longitude ?? 0, situacao: (r.ultimo_sinal.velocidade ?? 0) > 3 ? "em_viagem" : "ligado_parado", velocidade: r.ultimo_sinal.velocidade ?? 0, endereco: r.ultimo_sinal.endereco ?? undefined, atualizado: hora(r.ultimo_sinal.hora) }] : []}
          selecionado={null}
          onSelect={() => {}}
          altura="h-[260px]"
          eventos={[
            ...v.pontos.map((p) => ({ lat: p.latitude, lng: p.longitude, cor: p.tipo === "origem" || p.tipo === "destino" ? "#1B3A6B" : "#2E9E4F", titulo: `${ROTULO_TIPO[p.tipo]}: ${p.nome}`, hora: p.previsto ? hora(p.previsto) : "plano" })),
            ...r.paradas.filter((p) => !p.conforme).map((p) => ({ lat: p.latitude, lng: p.longitude, cor: "#D2352A", titulo: "Parada não autorizada", hora: hora(p.inicio), detalhe: `${p.minutos} min` })),
          ]}
        />
        <p className="mt-1.5 text-[12px] text-muted-foreground">Azul: origem/destino · verde: pontos autorizados · vermelho: paradas fora do plano.</p>
      </Card>

      <Card title="Evidência para a gerenciadora" icon={ShieldCheck} bodyClassName="p-5 text-[13px]">
        <p className="text-muted-foreground">A posição vem do rastreador SS. O relatório de conformidade reúne previsto × realizado da viagem.</p>
        <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-1.5">
          <dt className="text-muted-foreground">Gerenciadora</dt><dd className="font-medium">integração a definir</dd>
          <dt className="text-muted-foreground">Último sinal</dt><dd className="font-medium">{sinalMin == null ? "—" : sinalMin < 60 ? `há ${sinalMin} min` : dataHora(r.ultimo_sinal.hora)}{r.ultimo_sinal.velocidade != null ? ` · ${r.ultimo_sinal.velocidade} km/h` : ""}</dd>
          <dt className="text-muted-foreground">Motorista</dt><dd className="font-medium">{r.motoristas_identificados.length ? r.motoristas_identificados.join(", ") : <span className="text-gold">não identificado no veículo</span>}</dd>
        </dl>
        <button onClick={onRelatorio} className="mt-4 w-full rounded-xl bg-brand-navy py-2.5 text-[13px] font-semibold text-white">Gerar relatório de conformidade</button>
      </Card>

      <Card title="Pontos autorizados da rota" icon={CheckCircle2} bodyClassName="p-5">
        <p className="mb-3 text-[12px] text-muted-foreground">O motorista só pode parar nestes pontos (raio de {nf(v.pontos[0]?.raio_m ?? 300)} m). Parada fora da lista abre ocorrência.</p>
        {porTipo.length ? (
          <ul className="space-y-2">
            {porTipo.map(([tipo, nomes]) => (
              <li key={tipo} className="rounded-lg border border-border px-3 py-2">
                <p className="text-[13px] font-semibold">{ROTULO_TIPO[tipo]}</p>
                <p className="text-[12px] text-muted-foreground">{nomes.length} ponto(s) · {nomes.join(", ")}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-muted-foreground">Só origem e destino. Qualquer parada no caminho conta como fora do plano.</p>
        )}
      </Card>

      <Card title="Quem é comunicado" icon={Users} action={<Pill tone="gold">canal a definir</Pill>} bodyClassName="p-5">
        <p className="mb-3 text-[12px] text-muted-foreground">Recebem o alerta de parada não autorizada e atraso. O envio automático depende do canal que o cliente escolher (e-mail, WhatsApp, SMS).</p>
        <ul className="space-y-2">
          {v.destinatarios.map((d, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-[13px]">
              <span><b>{d.nome}</b>{d.papel ? ` · ${d.papel}` : ""}<br /><span className="text-muted-foreground">{d.email}</span></span>
              <button onClick={() => salvar({ destinatarios: v.destinatarios.filter((_, k) => k !== i) }, "Destinatário removido desta viagem.")} className="text-[12px] text-muted-foreground hover:text-coral">Remover</button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="adicionar e-mail…" className="h-9 flex-1 rounded-lg border border-border px-3 text-[13px]" />
          <button
            onClick={() => {
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error("E-mail inválido."); return; }
              salvar({ destinatarios: [...v.destinatarios, { nome: email.trim(), email: email.trim() }] }, "Destinatário adicionado a esta viagem.");
              setEmail("");
            }}
            className="rounded-lg bg-foreground px-3 text-[13px] font-semibold text-white"
          >
            Adicionar
          </button>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">{v.rota_nome ? `Lista padrão herdada da rota ${v.rota_nome}. ` : ""}Alterações valem só para esta viagem.</p>
      </Card>
      <p className="text-center text-[12px] text-muted-foreground">Dia {new Date(dia + "T12:00").toLocaleDateString("pt-BR")}</p>
    </div>
  );
}

/* -------------------------------- Nova escala ------------------------------ */

function NovaEscala({ grupo, dia, onClose }: { grupo: string; dia: string; onClose: () => void }) {
  const qc = useQueryClient();
  const veicQ = useQuery(veiculosApiQuery());
  const poisQ = useQuery(escalaPoisQuery(grupo));
  const rotasQ = useQuery(escalaRotasQuery(grupo));
  const pois = poisQ.data ?? [];
  const [f, setF] = useState({
    unit_id: "", motorista: "", rota_nome: "", rodovia: "", carga_cliente: "", carga_descricao: "", carga_valor: "",
    saida: `${dia}T06:00`, chegada: `${dia}T12:00`,
  });
  const [pontos, setPontos] = useState<PontoPlano[]>([]);
  const [dest, setDest] = useState<Destinatario[]>([]);
  const [novoTipo, setNovoTipo] = useState<TipoPonto>("origem");
  const [novoPoi, setNovoPoi] = useState("");
  const [salvarComoRota, setSalvarComoRota] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const aplicarRota = (id: string) => {
    const r = (rotasQ.data ?? []).find((x) => String(x.id) === id);
    if (!r) return;
    setPontos(r.pontos);
    setDest(r.destinatarios);
    setF((x) => ({ ...x, rota_nome: r.nome }));
  };
  const addPonto = () => {
    const p = pois.find((x) => String(x.id) === novoPoi);
    if (!p) { toast.error("Escolha um ponto de interesse."); return; }
    setPontos((x) => [...x.filter((y) => !(novoTipo === "origem" && y.tipo === "origem") && !(novoTipo === "destino" && y.tipo === "destino")), { tipo: novoTipo, nome: p.nome, poi_id: p.id, latitude: p.latitude, longitude: p.longitude, raio_m: Math.max(300, p.raio_m || 300) }]);
    setNovoPoi("");
  };
  const enviar = async () => {
    if (!f.unit_id) { toast.error("Escolha o veículo."); return; }
    if (!pontos.some((p) => p.tipo === "origem") || !pontos.some((p) => p.tipo === "destino")) { toast.error("Informe origem e destino."); return; }
    setEnviando(true);
    try {
      const corpo = {
        group_id: Number(grupo), unit_id: Number(f.unit_id), motorista: f.motorista || null, rota_nome: f.rota_nome || null, rodovia: f.rodovia || null,
        carga_cliente: f.carga_cliente || null, carga_descricao: f.carga_descricao || null, carga_valor: f.carga_valor ? Number(f.carga_valor) : null,
        saida_prevista: f.saida, chegada_prevista: f.chegada, pontos, destinatarios: dest, status_gr: "aguardando",
      };
      const r = await Escala.criar(corpo);
      if (salvarComoRota && f.rota_nome) await Escala.salvarRota({ group_id: Number(grupo), nome: f.rota_nome, pontos, destinatarios: dest });
      await qc.invalidateQueries({ queryKey: ["escala"] });
      toast.success(`Escala ${r.codigo} criada — aguardando aprovação da GR.`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };
  const inp = "h-9 w-full rounded-lg border border-border bg-white px-2.5 text-[13px]";
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-[rgba(10,16,28,0.5)] p-4 md:p-10" onClick={onClose}>
      <div className="w-full max-w-[860px] rounded-2xl bg-canvas shadow-elegant" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between rounded-t-2xl border-b border-border bg-card px-5 py-4">
          <h2 className="flex items-center gap-2 text-[16px] font-bold"><Route className="h-5 w-5 text-brand-navy" /> Nova escala de viagem</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-5 p-5">
          {(rotasQ.data?.length ?? 0) > 0 && (
            <label className="block text-[12px] text-muted-foreground">Partir de uma rota padrão
              <select onChange={(e) => aplicarRota(e.target.value)} defaultValue="" className={cn(inp, "mt-1")}>
                <option value="">—</option>
                {rotasQ.data!.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </label>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-[12px] text-muted-foreground">Veículo
              <select value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })} className={cn(inp, "mt-1")}>
                <option value="">Escolha…</option>
                {[...(veicQ.data?.items ?? [])].sort((a, b) => a.placa.localeCompare(b.placa)).map((v) => <option key={v.id} value={v.id}>{v.placa}{v.prefixo ? ` · ${v.prefixo}` : ""}</option>)}
              </select>
            </label>
            <label className="text-[12px] text-muted-foreground">Motorista<input value={f.motorista} onChange={(e) => setF({ ...f, motorista: e.target.value })} className={cn(inp, "mt-1")} /></label>
            <label className="text-[12px] text-muted-foreground">Nome da rota<input value={f.rota_nome} onChange={(e) => setF({ ...f, rota_nome: e.target.value })} placeholder="ex.: Betim → Juiz de Fora" className={cn(inp, "mt-1")} /></label>
            <label className="text-[12px] text-muted-foreground">Saída prevista<input type="datetime-local" value={f.saida} onChange={(e) => setF({ ...f, saida: e.target.value })} className={cn(inp, "mt-1")} /></label>
            <label className="text-[12px] text-muted-foreground">Chegada prevista<input type="datetime-local" value={f.chegada} onChange={(e) => setF({ ...f, chegada: e.target.value })} className={cn(inp, "mt-1")} /></label>
            <label className="text-[12px] text-muted-foreground">Rodovia<input value={f.rodovia} onChange={(e) => setF({ ...f, rodovia: e.target.value })} placeholder="ex.: BR-040" className={cn(inp, "mt-1")} /></label>
            <label className="text-[12px] text-muted-foreground">Cliente da carga<input value={f.carga_cliente} onChange={(e) => setF({ ...f, carga_cliente: e.target.value })} placeholder="ex.: Gerdau" className={cn(inp, "mt-1")} /></label>
            <label className="text-[12px] text-muted-foreground">Carga<input value={f.carga_descricao} onChange={(e) => setF({ ...f, carga_descricao: e.target.value })} placeholder="ex.: Bobina" className={cn(inp, "mt-1")} /></label>
            <label className="text-[12px] text-muted-foreground">Valor da carga (R$)<input type="number" value={f.carga_valor} onChange={(e) => setF({ ...f, carga_valor: e.target.value })} className={cn(inp, "mt-1")} /></label>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-[13px] font-semibold">Pontos da viagem (origem, destino e onde pode parar)</p>
            <div className="flex flex-wrap gap-2">
              <select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as TipoPonto)} className={cn(inp, "w-auto")}>
                {(Object.keys(ROTULO_TIPO) as TipoPonto[]).map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]}</option>)}
              </select>
              <select value={novoPoi} onChange={(e) => setNovoPoi(e.target.value)} className={cn(inp, "min-w-[260px] flex-1")}>
                <option value="">{poisQ.isPending ? "Carregando pontos…" : `Escolha um dos ${pois.length} pontos cadastrados…`}</option>
                {pois.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
              <button onClick={addPonto} className="rounded-lg bg-brand-navy px-3 text-[13px] font-semibold text-white">Adicionar</button>
            </div>
            <ul className="mt-3 space-y-1.5">
              {pontos.map((p, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-[13px]">
                  <span><Pill tone={p.tipo === "origem" || p.tipo === "destino" ? "sky" : "green"}>{ROTULO_TIPO[p.tipo]}</Pill> <b className="ml-1">{p.nome}</b> <span className="text-muted-foreground">raio {p.raio_m} m</span></span>
                  <button onClick={() => setPontos((x) => x.filter((_, k) => k !== i))} aria-label="Remover" className="text-muted-foreground hover:text-coral"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
              {!pontos.length && <li className="text-[12px] text-muted-foreground">Nenhum ponto ainda. Comece pela origem e pelo destino.</li>}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-[13px] font-semibold">Quem recebe os alertas</p>
            <DestinatariosEditor lista={dest} onChange={setDest} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={salvarComoRota} onChange={(e) => setSalvarComoRota(e.target.checked)} /> Salvar pontos e destinatários como rota padrão “{f.rota_nome || "sem nome"}”</label>
            <button onClick={enviar} disabled={enviando} className="rounded-full bg-brand-navy px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{enviando ? "Salvando…" : "Criar escala"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DestinatariosEditor({ lista, onChange }: { lista: Destinatario[]; onChange: (l: Destinatario[]) => void }) {
  const [d, setD] = useState({ nome: "", papel: "", email: "" });
  const inp = "h-9 rounded-lg border border-border bg-white px-2.5 text-[13px]";
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder="Nome" className={cn(inp, "w-40")} />
        <input value={d.papel} onChange={(e) => setD({ ...d, papel: e.target.value })} placeholder="Papel (ex.: torre de controle)" className={cn(inp, "w-52")} />
        <input value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} placeholder="e-mail" className={cn(inp, "min-w-[180px] flex-1")} />
        <button
          onClick={() => {
            if (!d.nome && !d.email) return;
            onChange([...lista, { nome: d.nome || d.email, papel: d.papel || null, email: d.email || null }]);
            setD({ nome: "", papel: "", email: "" });
          }}
          className="rounded-lg bg-foreground px-3 text-[13px] font-semibold text-white"
        >
          Adicionar
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {lista.map((x, i) => (
          <li key={i} className="flex items-center justify-between text-[13px]">
            <span><b>{x.nome}</b>{x.papel ? ` · ${x.papel}` : ""}{x.email ? ` · ${x.email}` : ""}</span>
            <button onClick={() => onChange(lista.filter((_, k) => k !== i))} className="text-[12px] text-muted-foreground hover:text-coral">Remover</button>
          </li>
        ))}
      </ul>
    </>
  );
}

/* ------------------------- Relatório de conformidade ----------------------- */

function RelatorioConformidade({ v, onClose }: { v: Viagem; onClose: () => void }) {
  const r = v.realizado;
  const origem = v.pontos.find((p) => p.tipo === "origem");
  const destino = v.pontos.find((p) => p.tipo === "destino");
  const conforme = !r.com_desvio && r.ocorrencias.length === 0;
  const geradoEm = new Date().toLocaleString("pt-BR");
  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto bg-[rgba(10,16,28,0.6)] p-4 md:p-10">
      <style>{`@media print { @page { size: A4; margin: 12mm; } body * { visibility: hidden !important; } .rel-conf, .rel-conf * { visibility: visible !important; } .rel-conf { position: absolute; inset: 0; box-shadow: none !important; } .rel-nao-imprimir { display: none !important; } }`}</style>
      <div className="rel-nao-imprimir mx-auto mb-3 flex max-w-[860px] justify-end gap-2">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow"><Printer className="h-4 w-4" /> Imprimir / salvar em PDF</button>
        <button onClick={onClose} className="inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm shadow"><X className="h-4 w-4" /> Fechar</button>
      </div>
      <div className="rel-conf mx-auto max-w-[860px] rounded-2xl bg-white p-10 text-[13px] text-foreground shadow-elegant">
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div>
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-brand-navy">SS Telemática · evidência de rastreamento</p>
            <h1 className="mt-1 font-display text-[20px] font-bold">Relatório de conformidade da viagem {v.codigo}</h1>
            <p className="text-muted-foreground">{origem?.nome} → {destino?.nome}{v.rodovia ? ` · ${v.rodovia}` : ""}</p>
          </div>
          <div className={cn("rounded-xl px-4 py-2 text-center font-bold", conforme ? "bg-leaf-tint text-leaf" : "bg-coral-tint text-coral")}>
            {conforme ? "CONFORME" : `${r.ocorrencias.length} DESVIO(S)`}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5">
          {[
            ["Veículo", `${v.veiculo?.label ?? v.unit_id}${v.veiculo?.label2 ? ` · ${v.veiculo.label2}` : ""}`],
            ["Motorista declarado", v.motorista ?? "—"],
            ["Motorista identificado no veículo", r.motoristas_identificados.join(", ") || "não identificado"],
            ["Carga", `${v.carga_cliente ?? "—"}${v.carga_descricao ? ` · ${v.carga_descricao}` : ""} · ${brl(v.carga_valor)}`],
            ["Status na GR", v.status_gr === "aprovada" ? "aprovada" : v.status_gr === "reprovada" ? "reprovada" : "aguardando aprovação"],
            ["Saída prevista / realizada", `${dataHora(v.saida_prevista)} / ${dataHora(r.saida_real)}`],
            ["Chegada prevista / realizada", `${dataHora(v.chegada_prevista)} / ${dataHora(r.chegada_real)}`],
            ["Distância rodada", `${nf(r.km)} km · velocidade máxima ${nf(r.vel_max)} km/h`],
            ["Paradas previstas cumpridas", `${r.paradas_cumpridas} de ${r.paradas_previstas}`],
          ].map(([a, b]) => (
            <div key={a} className="flex justify-between gap-3 border-b border-dashed border-border py-1"><span className="text-muted-foreground">{a}</span><span className="text-right font-medium">{b}</span></div>
          ))}
        </div>
        <h2 className="mt-6 text-[14px] font-bold">Paradas registradas pelo rastreador (≥ 10 min)</h2>
        <table className="mt-2 w-full border-collapse text-[12px]">
          <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="py-1.5">Início</th><th>Duração</th><th>Local</th><th>Ponto autorizado</th><th>Situação</th></tr></thead>
          <tbody>
            {r.paradas.map((p, i) => (
              <tr key={i} className="border-b border-border/60">
                <td className="py-1.5">{dataHora(p.inicio)}</td>
                <td>{p.minutos} min</td>
                <td className="max-w-[260px]">{p.endereco ?? `${nf(p.latitude, 5)}, ${nf(p.longitude, 5)}`}</td>
                <td>{p.ponto ?? `fora · mais próximo ${p.ponto_mais_proximo ?? "—"} (${nf((p.distancia_ponto_m ?? 0) / 1000, 1)} km)`}</td>
                <td className={p.conforme ? "text-leaf" : "font-semibold text-coral"}>{p.conforme ? "conforme" : "desvio"}</td>
              </tr>
            ))}
            {!r.paradas.length && <tr><td colSpan={5} className="py-3 text-muted-foreground">Nenhuma parada de 10 min ou mais.</td></tr>}
          </tbody>
        </table>
        {r.ocorrencias.length > 0 && (
          <>
            <h2 className="mt-6 text-[14px] font-bold">Ocorrências</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {r.ocorrencias.map((o) => <li key={o.id}><b>{o.id}</b> — {o.titulo} · {dataHora(o.inicio)} · {o.minutos} min{o.endereco ? ` · ${o.endereco}` : ""}</li>)}
            </ul>
          </>
        )}
        <h2 className="mt-6 text-[14px] font-bold">Pontos autorizados declarados</h2>
        <p className="mt-1 text-ink-soft">{v.pontos.map((p) => `${ROTULO_TIPO[p.tipo]}: ${p.nome}`).join(" · ")}</p>
        <p className="mt-6 border-t border-border pt-3 text-[12px] text-muted-foreground">
          Posições e paradas medidas pelo rastreador SS embarcado no veículo. Parada conta a partir de 10 min parado; conforme quando dentro do raio de um ponto autorizado declarado. Relatório gerado em {geradoEm}.
        </p>
      </div>
    </div>
  );
}


