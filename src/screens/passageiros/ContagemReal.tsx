import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownLeft, Bus, CreditCard, Download, Loader2, MapPin, UserCheck, UserX, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { api } from "@/lib/api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Contagem de passageiros com dado real: embarques por cartão (RFID) lidos no
 * validador, por viagem, ponto e passageiro, e a taxa de frequência de quem
 * está na lista de cada viagem. Regras do sistema atual (Embarque e
 * Desembarque, Taxa de Frequência) — backend endpoints/passageiros.py.
 */

type Resumo = {
  embarques: number; passageiros: number; sem_cadastro: number; fora_da_lista: number; dias: number;
  desembarques: number; viagens: number; media_por_viagem: number | null; na_lista_sem_embarque: number;
};
type Viagem = {
  id: number; inicio: string; fim: string | null; veiculo: string; linha: string; tabela: string; centro_custo: string | null;
  motorista: string | null; sentido: string; embarques: number; capacidade: number | null; na_lista: number; ocupacao: number | null;
};
type Freq = { passageiro_id: number; passageiro: string; matricula: string | null; centro_custo: string | null; linha: string; tabela: string; viagens: number; embarques: number; taxa: number | null };
type Resposta = {
  resumo: Resumo;
  por_dia: { dia: string; embarques: number; passageiros: number }[];
  por_hora: { hora: number; embarques: number }[];
  por_ponto: { poi_id: number | null; ponto: string; embarques: number; passageiros: number }[];
  viagens: Viagem[]; viagens_total: number;
  frequencia: Freq[]; frequencia_total: number;
  cartoes_sem_cadastro: { cartao: string; leituras: number; ultima: string; veiculo: string }[];
};

const nf = (v: number | null | undefined, c = 0) => (v == null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: c }));
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dm = (s: string) => s.slice(0, 10).split("-").reverse().slice(0, 2).join("/");
const dmh = (s: string) => `${dm(s)} ${s.slice(11, 16)}`;
const tomTaxa = (t: number | null): PillTone => (t == null ? "neutral" : t >= 80 ? "green" : t >= 50 ? "gold" : "coral");

function baixarCsv(nome: string, cab: string[], linhas: (string | number | null)[][]) {
  const csv = [cab, ...linhas].map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

const ABAS = [
  { id: "resumo", rotulo: "Resumo" },
  { id: "viagens", rotulo: "Por viagem" },
  { id: "frequencia", rotulo: "Taxa de frequência" },
  { id: "cartoes", rotulo: "Cartões sem cadastro" },
] as const;

export default function ContagemReal() {
  const g = grupoAtivo();
  const [fim, setFim] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 1); return iso(d); });
  const [inicio, setInicio] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return iso(d); });
  const [aba, setAba] = useState<(typeof ABAS)[number]["id"]>("resumo");
  const [busca, setBusca] = useState("");
  const [soAusentes, setSoAusentes] = useState(false);

  const q = useQuery({
    queryKey: ["passageiros", "contagem", g, inicio, fim],
    queryFn: () => api.get<Resposta>(`/api/v1/passageiros/contagem?group_id=${g}&inicio=${inicio}&fim=${fim}`),
    enabled: Boolean(g && inicio && fim),
    staleTime: 300_000,
  });
  const d = q.data;
  const r = d?.resumo;

  const freq = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (d?.frequencia ?? []).filter((f) => (!soAusentes || f.embarques === 0)
      && (!b || `${f.passageiro} ${f.matricula ?? ""} ${f.linha} ${f.tabela} ${f.centro_custo ?? ""}`.toLowerCase().includes(b)));
  }, [d, busca, soAusentes]);

  const colViagens: Column<Viagem>[] = [
    { key: "inicio", header: "Início", render: (v) => <span className="font-mono">{dmh(v.inicio)}</span> },
    { key: "linha", header: "Linha", render: (v) => <span className="font-medium text-foreground">{v.linha}</span> },
    { key: "tabela", header: "Viagem (tabela)", render: (v) => `${v.tabela} · ${v.sentido}` },
    { key: "veiculo", header: "Veículo", render: (v) => <span className="font-mono">{v.veiculo}</span> },
    { key: "motorista", header: "Motorista", render: (v) => v.motorista || "—" },
    { key: "embarques", header: "Embarques", align: "right", render: (v) => <span className="font-semibold">{nf(v.embarques)}</span> },
    { key: "na_lista", header: "Na lista", align: "right", render: (v) => nf(v.na_lista) },
    { key: "ocupacao", header: "Ocupação", align: "center", render: (v) => (v.ocupacao == null ? <span className="text-muted-foreground" title="Veículo sem capacidade cadastrada">—</span> : <Pill tone={v.ocupacao >= 90 ? "coral" : v.ocupacao >= 70 ? "gold" : "green"}>{v.ocupacao}%</Pill>) },
  ];
  const colFreq: Column<Freq>[] = [
    { key: "passageiro", header: "Passageiro", render: (f) => <span className="font-medium text-foreground">{f.passageiro}</span> },
    { key: "matricula", header: "Matrícula", render: (f) => f.matricula || "—" },
    { key: "centro_custo", header: "Centro de custo", render: (f) => f.centro_custo || "—" },
    { key: "linha", header: "Linha", render: (f) => f.linha },
    { key: "tabela", header: "Viagem", render: (f) => f.tabela },
    { key: "embarques", header: "Embarques", align: "right", render: (f) => nf(f.embarques) },
    { key: "viagens", header: "Viagens feitas", align: "right", render: (f) => nf(f.viagens) },
    { key: "taxa", header: "Frequência", align: "center", render: (f) => <Pill tone={tomTaxa(f.taxa)}>{f.taxa == null ? "—" : `${f.taxa}%`}</Pill> },
  ];
  type Cartao = Resposta["cartoes_sem_cadastro"][number];
  const colCartoes: Column<Cartao>[] = [
    { key: "cartao", header: "Cartão (RFID)", render: (c) => <span className="font-mono font-semibold">{c.cartao || "—"}</span> },
    { key: "leituras", header: "Leituras", align: "right", render: (c) => nf(c.leituras) },
    { key: "veiculo", header: "Último veículo", render: (c) => <span className="font-mono">{c.veiculo}</span> },
    { key: "ultima", header: "Última leitura", render: (c) => dmh(c.ultima) },
  ];

  return (
    <>
      <PageHeader title="Contagem de passageiros" subtitle="Embarques por cartão no validador · por viagem, ponto e passageiro" />
      <div className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-[12px] text-muted-foreground">De
            <input type="date" value={inicio} max={fim} onChange={(e) => setInicio(e.target.value)} className="ml-2 h-9 rounded-lg border border-border bg-white px-3 text-[13px] text-foreground" />
          </label>
          <label className="text-[12px] text-muted-foreground">até
            <input type="date" value={fim} min={inicio} max={iso(new Date())} onChange={(e) => setFim(e.target.value)} className="ml-2 h-9 rounded-lg border border-border bg-white px-3 text-[13px] text-foreground" />
          </label>
          <span className="text-[12px] text-muted-foreground">Até 31 dias.</span>
          {q.isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {q.isError && <Card><p className="p-4 text-[13px] text-coral">{mensagemErro(q.error)}</p></Card>}
        {q.isLoading && <Card><p className="flex items-center gap-2 p-6 text-[13px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo os embarques do período…</p></Card>}

        {r && r.embarques === 0 && (
          <Card>
            <div className="p-6 text-[13px] text-muted-foreground">
              <p className="font-medium text-foreground">Nenhum embarque por cartão neste cliente no período.</p>
              <p className="mt-1">A contagem vem da leitura do cartão (RFID) no validador do veículo. Clientes sem validador, ou com o leitor desligado, não têm esse dado.</p>
            </div>
          </Card>
        )}

        {r && r.embarques > 0 && d && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <StatTile icon={Users} label="Embarques" value={nf(r.embarques)} foot={`${nf(r.embarques / Math.max(r.dias, 1))} por dia`} />
              <StatTile icon={UserCheck} label="Passageiros diferentes" value={nf(r.passageiros)} color="var(--leaf)" />
              <StatTile icon={Bus} label="Viagens feitas" value={nf(r.viagens)} foot={`média de ${nf(r.media_por_viagem, 1)} por viagem`} color="var(--brand-sky)" />
              <StatTile icon={AlertTriangle} label="Fora da lista da viagem" value={nf(r.fora_da_lista)} foot="cadastrados, mas em outra viagem" color="var(--gold)" />
              <StatTile icon={CreditCard} label="Cartão sem cadastro" value={nf(r.sem_cadastro)} foot={`${nf((100 * r.sem_cadastro) / r.embarques)}% das leituras`} color="var(--coral)" />
              <StatTile icon={UserX} label="Na lista e não embarcou" value={nf(r.na_lista_sem_embarque)} foot="passageiro × viagem no período" color="var(--coral)" />
            </div>

            <div className="mb-4 flex gap-1 border-b border-border">
              {ABAS.map((a) => (
                <button key={a.id} type="button" onClick={() => setAba(a.id)}
                  className={cn("-mb-px border-b-2 px-3 py-2 text-[13px]", aba === a.id ? "border-brand-blue font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
                  {a.rotulo}
                </button>
              ))}
            </div>

            {aba === "resumo" && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Embarques por dia" icon={Users} bodyClassName="p-4">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={d.por_dia.map((x) => ({ ...x, rot: dm(x.dia) }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="rot" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} width={40} />
                        <Tooltip formatter={(v: number) => nf(v)} />
                        <Bar dataKey="embarques" name="Embarques" fill="var(--brand-blue)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="Embarques por hora do dia" icon={ArrowDownLeft} bodyClassName="p-4">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Array.from({ length: 24 }, (_, h) => ({ rot: `${h}h`, embarques: d.por_hora.find((x) => x.hora === h)?.embarques ?? 0 }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="rot" tick={{ fontSize: 12 }} interval={2} />
                        <YAxis tick={{ fontSize: 12 }} width={40} />
                        <Tooltip formatter={(v: number) => nf(v)} />
                        <Bar dataKey="embarques" name="Embarques" fill="var(--brand-sky)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="Pontos com mais embarques" icon={MapPin} className="lg:col-span-2" bodyClassName="p-4">
                  <DataTable porPagina={15} rows={d.por_ponto as unknown as Record<string, unknown>[]} columns={[
                    { key: "ponto", header: "Ponto", render: (p) => <span className={cn(p.poi_id ? "text-foreground" : "italic text-muted-foreground")}>{String(p.ponto)}</span> },
                    { key: "embarques", header: "Embarques", align: "right", render: (p) => nf(p.embarques as number) },
                    { key: "passageiros", header: "Passageiros", align: "right", render: (p) => nf(p.passageiros as number) },
                  ]} />
                  <p className="mt-2 text-[12px] text-muted-foreground">"Fora de ponto cadastrado": o embarque foi lido longe de qualquer ponto de interesse cadastrado.</p>
                </Card>
                {r.desembarques > 0 && (
                  <p className="text-[12px] text-muted-foreground lg:col-span-2">
                    Desembarques lidos: {nf(r.desembarques)}. Poucos validadores registram a saída, por isso a tela não calcula quantos estão a bordo.
                  </p>
                )}
              </div>
            )}

            {aba === "viagens" && (
              <Card title={`Viagens (${nf(d.viagens_total)})`} icon={Bus} bodyClassName="p-4"
                action={<button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px]"
                  onClick={() => baixarCsv(`embarques-por-viagem-${inicio}-a-${fim}.csv`, ["Início", "Fim", "Linha", "Viagem", "Sentido", "Veículo", "Motorista", "Centro de custo", "Embarques", "Na lista", "Ocupação %"],
                    d.viagens.map((v) => [v.inicio.replace("T", " "), v.fim?.replace("T", " ") ?? "", v.linha, v.tabela, v.sentido, v.veiculo, v.motorista, v.centro_custo, v.embarques, v.na_lista, v.ocupacao]))}>
                  <Download className="h-3.5 w-3.5" /> Exportar CSV</button>}>
                <DataTable columns={colViagens} rows={d.viagens} />
                {d.viagens_total > d.viagens.length && <p className="mt-2 text-[12px] text-muted-foreground">Mostrando as {nf(d.viagens.length)} mais recentes. Encurte o período para ver todas.</p>}
                {d.viagens.every((v) => v.ocupacao == null) && <p className="mt-2 text-[12px] text-muted-foreground">Ocupação aparece quando o veículo tem a quantidade de passageiros preenchida em Cadastros › Veículos.</p>}
              </Card>
            )}

            {aba === "frequencia" && (
              <Card title="Taxa de frequência" icon={UserCheck} bodyClassName="p-4"
                action={<button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[12px]"
                  onClick={() => baixarCsv(`taxa-de-frequencia-${inicio}-a-${fim}.csv`, ["Passageiro", "Matrícula", "Centro de custo", "Linha", "Viagem", "Embarques", "Viagens feitas", "Frequência %"],
                    freq.map((f) => [f.passageiro, f.matricula, f.centro_custo, f.linha, f.tabela, f.embarques, f.viagens, f.taxa]))}>
                  <Download className="h-3.5 w-3.5" /> Exportar CSV</button>}>
                <p className="mb-3 text-[12px] text-muted-foreground">
                  Para cada passageiro na lista de uma viagem: embarques dele ÷ viagens feitas no período. Mostra quem tem lugar reservado e não está usando.
                </p>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar passageiro, linha ou centro de custo" className="h-9 w-80 max-w-full rounded-lg border border-border bg-white px-3 text-[13px]" />
                  <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={soAusentes} onChange={(e) => setSoAusentes(e.target.checked)} /> Só quem não embarcou nenhuma vez</label>
                  <span className="text-[12px] text-muted-foreground">{nf(freq.length)} de {nf(d.frequencia_total)}</span>
                </div>
                <DataTable columns={colFreq} rows={freq} />
              </Card>
            )}

            {aba === "cartoes" && (
              <Card title="Cartões lidos sem passageiro cadastrado" icon={CreditCard} bodyClassName="p-4">
                <p className="mb-3 text-[12px] text-muted-foreground">
                  O validador leu o cartão, mas nenhum passageiro ativo deste cliente tem esse código. Cadastre o cartão em Fretamento › Cadastro de passageiros.
                </p>
                <DataTable columns={colCartoes} rows={d.cartoes_sem_cadastro} empty="Todos os cartões lidos estão cadastrados." />
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
