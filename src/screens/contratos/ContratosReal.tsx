import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  FilePlus2,
  FileText,
  Loader2,
  Search,
  Truck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import {
  Card,
  DataTable,
  Pill,
  StatTile,
  type Column,
  type PillTone,
} from "@/components/ss/ui/data";
import { ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ApiError } from "@/lib/api";
import {
  Contratos,
  contratosQuery,
  type Contrato,
  type DadosContrato,
  type StatusContrato,
} from "@/lib/contratos-api";
import { exportarCSV } from "@/lib/export";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Contratos — todo cliente da plataforma tem um (regra do PM, 06/10/2026).
 *
 * - "Novo contrato" é o único jeito de criar um grupo: o formulário exige os
 *   dados principais e o grupo fica "a criar" até a gravação no sistema atual.
 * - Os clientes que já existiam vêm pré-preenchidos (cadastro do grupo,
 *   vigência real da planilha, frota) e não têm campo obrigatório — o time
 *   completa à mão. "A completar" só lista o que falta, não trava nada.
 * - Nada encerra sozinho: depois do fim aparece "Vencido", e encerrar é um
 *   botão com motivo.
 */

type Campo = {
  nome: keyof DadosContrato;
  rotulo: string;
  tipo?: "texto" | "numero" | "moeda" | "data" | "area" | "sim_nao" | "lista" | "multi" | "email";
  opcoes?: "segmentos" | "reajustes" | "pagamentos" | "produtos" | string[];
  cheio?: boolean;
  ajuda?: string;
};

const SECOES: { titulo: string; campos: Campo[] }[] = [
  {
    titulo: "Cliente",
    campos: [
      { nome: "nome_grupo", rotulo: "Nome do grupo (como aparece na plataforma)", cheio: true },
      { nome: "razao_social", rotulo: "Razão social", cheio: true },
      { nome: "nome_fantasia", rotulo: "Nome fantasia" },
      { nome: "cnpj", rotulo: "CNPJ", ajuda: "99.999.999/9999-99" },
      { nome: "inscricao_estadual", rotulo: "Inscrição estadual" },
      { nome: "segmento", rotulo: "Segmento", tipo: "lista", opcoes: "segmentos" },
      { nome: "endereco", rotulo: "Endereço", cheio: true },
      { nome: "cidade", rotulo: "Cidade" },
      { nome: "uf", rotulo: "UF" },
      { nome: "cep", rotulo: "CEP" },
      { nome: "codigo_cliente", rotulo: "Código do cliente" },
    ],
  },
  {
    titulo: "Contatos",
    campos: [
      { nome: "contato_nome", rotulo: "Contato principal" },
      { nome: "contato_email", rotulo: "E-mail do contato", tipo: "email" },
      { nome: "contato_telefone", rotulo: "Telefone do contato" },
      { nome: "financeiro_nome", rotulo: "Responsável financeiro" },
      { nome: "financeiro_email", rotulo: "E-mail do financeiro", tipo: "email" },
      { nome: "financeiro_telefone", rotulo: "Telefone do financeiro" },
    ],
  },
  {
    titulo: "Vigência",
    campos: [
      { nome: "numero_contrato", rotulo: "Número do contrato" },
      { nome: "data_assinatura", rotulo: "Data de assinatura", tipo: "data" },
      { nome: "data_inicio", rotulo: "Início da vigência", tipo: "data" },
      { nome: "data_fim", rotulo: "Fim da vigência", tipo: "data" },
      {
        nome: "tempo_meses",
        rotulo: "Tempo de contrato (meses)",
        tipo: "numero",
        ajuda: "Vazio = calculado pelas datas",
      },
      { nome: "renovacao_automatica", rotulo: "Renovação automática", tipo: "sim_nao" },
      { nome: "aviso_previo_dias", rotulo: "Aviso prévio (dias)", tipo: "numero" },
      { nome: "indice_reajuste", rotulo: "Índice de reajuste", tipo: "lista", opcoes: "reajustes" },
      { nome: "mes_reajuste", rotulo: "Mês do reajuste" },
    ],
  },
  {
    titulo: "Frota e serviços",
    campos: [
      { nome: "qtd_veiculos", rotulo: "Veículos contratados", tipo: "numero" },
      { nome: "equipamento_comodato", rotulo: "Equipamento em comodato", tipo: "sim_nao" },
      {
        nome: "produtos",
        rotulo: "Produtos contratados",
        tipo: "multi",
        opcoes: "produtos",
        cheio: true,
      },
    ],
  },
  {
    titulo: "Financeiro",
    campos: [
      { nome: "valor_parcela", rotulo: "Valor da parcela mensal (R$)", tipo: "moeda" },
      { nome: "valor_implantacao", rotulo: "Valor de implantação (R$)", tipo: "moeda" },
      {
        nome: "valor_total",
        rotulo: "Valor total do contrato (R$)",
        tipo: "moeda",
        ajuda: "Vazio = parcela × meses + implantação",
      },
      {
        nome: "forma_pagamento",
        rotulo: "Forma de pagamento",
        tipo: "lista",
        opcoes: "pagamentos",
      },
      { nome: "dia_vencimento", rotulo: "Dia do vencimento", tipo: "numero" },
      { nome: "pro_rata", rotulo: "Pró-rata", tipo: "sim_nao" },
    ],
  },
  {
    titulo: "Base do ROI (aparece na Início do cliente)",
    campos: [
      {
        nome: "gasto_medio_combustivel_mes",
        rotulo: "Gasto médio com combustível por mês (R$)",
        tipo: "moeda",
      },
      { nome: "custo_medio_combustivel_l", rotulo: "Custo médio do litro (R$)", tipo: "moeda" },
      { nome: "reducao_estimada_pct", rotulo: "Redução estimada de consumo (%)", tipo: "numero" },
    ],
  },
  {
    titulo: "Comercial",
    campos: [
      { nome: "vendedor", rotulo: "Vendedor" },
      { nome: "observacoes", rotulo: "Observações", tipo: "area", cheio: true },
    ],
  },
];

/** Obrigatórios só no contrato novo (o mesmo que o backend confere). */
const OBRIG_NOVO = new Set<keyof DadosContrato>([
  "nome_grupo",
  "razao_social",
  "cnpj",
  "segmento",
  "data_inicio",
  "data_fim",
  "qtd_veiculos",
  "valor_parcela",
  "contato_nome",
  "contato_email",
]);

const SEGMENTO_LABEL: Record<string, string> = {
  carga: "Carga",
  urbano: "Urbano",
  fretamento: "Fretamento",
  misto: "Misto",
  outro: "Outro",
};
const STATUS_TONE: Record<StatusContrato, PillTone> = {
  ativo: "green",
  suspenso: "gold",
  encerrado: "neutral",
};
const STATUS_LABEL: Record<StatusContrato, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

const brl = (v: unknown) =>
  v == null || v === ""
    ? "—"
    : Number(v).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
      });
const dataBR = (s?: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "—");
const nf = (v: unknown) => (v == null ? "—" : Number(v).toLocaleString("pt-BR"));

type Filtro = "todos" | "a_completar" | "vencidos" | "sem_veiculos" | "novos" | "encerrados";

function campoDoErro(e: unknown): string | null {
  if (!(e instanceof ApiError)) return null;
  try {
    const d = JSON.parse(e.message)?.detail;
    return typeof d?.field === "string" ? d.field : null;
  } catch {
    return null;
  }
}

export default function ContratosReal() {
  const qc = useQueryClient();
  const q = useQuery(contratosQuery());
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aberto, setAberto] = useState<Contrato | "novo" | null>(null);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const digitos = t.replace(/\D/g, "");
    return (q.data?.contratos ?? []).filter((c) => {
      if (filtro === "a_completar" && !c.pendencias.length) return false;
      if (filtro === "vencidos" && !(c.vencido && c.status === "ativo")) return false;
      if (filtro === "sem_veiculos" && !c.sem_veiculos) return false;
      if (filtro === "novos" && c.origem !== "novo") return false;
      if (filtro === "encerrados" && c.status !== "encerrado") return false;
      if (!t) return true;
      const d = c.dados;
      return (
        [d.nome_grupo, d.razao_social, d.nome_fantasia, d.numero_contrato].some((x) =>
          (x ?? "").toLowerCase().includes(t),
        ) ||
        (digitos.length >= 4 && (d.cnpj ?? "").replace(/\D/g, "").includes(digitos))
      );
    });
  }, [q.data, busca, filtro]);

  const r = q.data?.resumo;
  const colunas: Column<Contrato & Record<string, unknown>>[] = [
    {
      key: "cliente",
      header: "Cliente",
      render: (c) => (
        <span className="leading-tight">
          <span className="block font-semibold text-foreground">
            {c.dados.nome_grupo || "Sem nome"}
          </span>
          <span className="block max-w-[320px] truncate text-[12px] text-muted-foreground">
            {c.dados.razao_social || "Razão social não informada"}
          </span>
        </span>
      ),
    },
    {
      key: "cnpj",
      header: "CNPJ",
      render: (c) => <span className="font-mono text-[12px]">{c.dados.cnpj || "—"}</span>,
    },
    {
      key: "vigencia",
      header: "Vigência",
      render: (c) =>
        c.dados.data_fim ? (
          <span className="leading-tight">
            <span className="block text-[13px]">
              {dataBR(c.dados.data_inicio)} a {dataBR(c.dados.data_fim)}
            </span>
            {c.status === "ativo" && c.vencido ? (
              <span className="text-[12px] font-medium text-coral">
                Vencido há {nf(-(c.dias_para_vencer ?? 0))} dias
              </span>
            ) : c.dias_para_vencer != null && c.dias_para_vencer <= 90 && c.status === "ativo" ? (
              <span className="text-[12px] font-medium text-gold">
                Vence em {nf(c.dias_para_vencer)} dias
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-muted-foreground">Não informada</span>
        ),
    },
    {
      key: "veiculos",
      header: "Veículos",
      align: "right",
      render: (c) => (
        <span title="Contratados / ativos hoje na plataforma">
          {nf(c.dados.qtd_veiculos)}{" "}
          <span className="text-muted-foreground">
            / {c.grupo_a_criar ? "—" : nf(c.veiculos_hoje)}
          </span>
        </span>
      ),
    },
    {
      key: "parcela",
      header: "Parcela",
      align: "right",
      render: (c) => brl(c.dados.valor_parcela),
    },
    {
      key: "total",
      header: "Total do contrato",
      align: "right",
      render: (c) => brl(c.valor_total_calc),
    },
    {
      key: "situacao",
      header: "Situação",
      render: (c) => (
        <span className="flex flex-wrap gap-1">
          <Pill tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Pill>
          {c.grupo_a_criar && <Pill tone="sky">Grupo a criar</Pill>}
          {c.pendencias.length > 0 && (
            <span title={`Falta: ${c.pendencias.join(", ")}`}>
              <Pill tone="gold">{c.pendencias.length} a completar</Pill>
            </span>
          )}
        </span>
      ),
    },
  ];

  const exportar = () =>
    exportarCSV(
      lista,
      [
        { cabecalho: "Grupo", valor: (c) => c.dados.nome_grupo },
        { cabecalho: "Razão social", valor: (c) => c.dados.razao_social },
        { cabecalho: "CNPJ", valor: (c) => c.dados.cnpj },
        {
          cabecalho: "Segmento",
          valor: (c) => SEGMENTO_LABEL[c.dados.segmento ?? ""] ?? c.dados.segmento,
        },
        { cabecalho: "Início", valor: (c) => c.dados.data_inicio },
        { cabecalho: "Fim", valor: (c) => c.dados.data_fim },
        { cabecalho: "Meses", valor: (c) => c.tempo_meses_calc },
        { cabecalho: "Veículos contratados", valor: (c) => c.dados.qtd_veiculos },
        { cabecalho: "Veículos hoje", valor: (c) => c.veiculos_hoje },
        { cabecalho: "Parcela", valor: (c) => c.dados.valor_parcela },
        { cabecalho: "Implantação", valor: (c) => c.dados.valor_implantacao },
        { cabecalho: "Total", valor: (c) => c.valor_total_calc },
        {
          cabecalho: "Situação",
          valor: (c) => STATUS_LABEL[c.status] + (c.vencido ? " (vencido)" : ""),
        },
        { cabecalho: "Contato", valor: (c) => c.dados.contato_nome },
        { cabecalho: "E-mail", valor: (c) => c.dados.contato_email },
        { cabecalho: "A completar", valor: (c) => c.pendencias.join(", ") },
      ],
      "contratos",
    );

  const FILTROS: { id: Filtro; rotulo: string; n?: number }[] = [
    { id: "todos", rotulo: "Todos", n: r?.total },
    { id: "a_completar", rotulo: "A completar", n: r?.a_completar },
    { id: "vencidos", rotulo: "Vencidos", n: r?.vencidos },
    { id: "sem_veiculos", rotulo: "Sem veículos ativos", n: r?.sem_veiculos },
    { id: "novos", rotulo: "Clientes novos", n: r?.grupos_a_criar },
    { id: "encerrados", rotulo: "Encerrados", n: r?.encerrados },
  ];

  return (
    <>
      <PageHeader
        title="Contratos"
        subtitle="Todo cliente tem um contrato. Cliente novo só entra pelo Novo contrato."
      />
      <main className="space-y-5 px-4 py-6 sm:px-8">
        {q.error ? (
          <ErrorBox error={q.error} onRetry={() => q.refetch()} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile
                icon={FileText}
                label="Contratos ativos"
                value={nf(r?.ativos)}
                foot={`de ${nf(r?.total)} clientes`}
              />
              <StatTile
                icon={Wallet}
                label="Parcelas mensais (ativos)"
                value={brl(r?.receita_mensal)}
                color="var(--leaf)"
                foot="só os contratos com parcela informada"
              />
              <StatTile
                icon={AlertTriangle}
                label="A completar"
                value={nf(r?.a_completar)}
                color="var(--gold)"
                foot="dados principais em branco"
              />
              <StatTile
                icon={CalendarClock}
                label="Vencidos e ainda ativos"
                value={nf(r?.vencidos)}
                color="var(--coral)"
                foot="o sistema não encerra sozinho"
              />
            </div>

            <Card
              title="Contratos"
              icon={Building2}
              action={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportar}
                    className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-[12px] font-medium hover:bg-secondary"
                  >
                    Exportar CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setAberto("novo")}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-navy px-3 text-[12px] font-semibold text-white hover:opacity-90"
                  >
                    <FilePlus2 className="h-3.5 w-3.5" /> Novo contrato
                  </button>
                </div>
              }
              bodyClassName="p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="busca-contrato"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Cliente, razão social, CNPJ ou nº do contrato…"
                    className="h-9 w-full rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
                  />
                </div>
                {FILTROS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltro(f.id)}
                    aria-pressed={filtro === f.id}
                    className={cn(
                      "h-8 rounded-full border px-3 text-[12px] font-medium",
                      filtro === f.id
                        ? "border-brand-navy bg-brand-navy text-white"
                        : "border-border bg-white text-foreground hover:bg-secondary",
                    )}
                  >
                    {f.rotulo}
                    {f.n != null ? ` · ${nf(f.n)}` : ""}
                  </button>
                ))}
              </div>
              {q.isPending ? (
                <SkeletonRows rows={8} />
              ) : (
                <DataTable
                  columns={colunas}
                  rows={lista as (Contrato & Record<string, unknown>)[]}
                  onRowClick={(c) => setAberto(c)}
                  empty="Nenhum contrato com este filtro."
                />
              )}
              <p className="mt-3 text-[12px] text-muted-foreground">
                Os contratos dos clientes que já existiam foram criados a partir do cadastro do
                grupo e da vigência registrada no banco, e podem ser completados sem campo
                obrigatório. Os valores ficam no armazenamento provisório até a gravação no sistema
                atual ser liberada.
              </p>
            </Card>
          </>
        )}
      </main>

      <Sheet open={aberto !== null} onOpenChange={(v) => !v && setAberto(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[760px]">
          {aberto !== null && (
            <FormContrato
              key={aberto === "novo" ? "novo" : aberto.id}
              contrato={aberto === "novo" ? null : aberto}
              opcoes={q.data?.opcoes}
              onSalvo={async () => {
                await qc.invalidateQueries({ queryKey: ["contratos"] });
                setAberto(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function FormContrato({
  contrato,
  opcoes,
  onSalvo,
}: {
  contrato: Contrato | null;
  opcoes?: { segmentos: string[]; produtos: string[]; reajustes: string[]; pagamentos: string[] };
  onSalvo: () => void;
}) {
  const novo = contrato === null;
  const [d, setD] = useState<DadosContrato>(() => ({ ...(contrato?.dados ?? {}) }));
  const [salvando, setSalvando] = useState(false);
  const [erroCampo, setErroCampo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const set = (k: keyof DadosContrato, v: unknown) => setD((x) => ({ ...x, [k]: v }));

  const salvar = async () => {
    setSalvando(true);
    setErroCampo(null);
    try {
      if (novo) {
        const r = await Contratos.criar(d);
        toast.success("Contrato criado.", { description: r.aviso });
      } else {
        await Contratos.editar(contrato.id, d);
        toast.success("Contrato salvo.");
      }
      onSalvo();
    } catch (e) {
      setErroCampo(campoDoErro(e));
      toast.error(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  const mudarStatus = async (s: StatusContrato) => {
    if (!contrato) return;
    if (s !== "ativo" && !motivo.trim()) {
      setErroCampo("motivo");
      toast.error("Informe o motivo.");
      return;
    }
    try {
      await Contratos.status(contrato.id, s, motivo);
      toast.success(
        s === "ativo"
          ? "Contrato reativado."
          : s === "encerrado"
            ? "Contrato encerrado."
            : "Contrato suspenso.",
      );
      onSalvo();
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  };

  const listaDe = (o: Campo["opcoes"]) => (Array.isArray(o) ? o : o ? (opcoes?.[o] ?? []) : []);
  const css =
    "h-9 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-accent";

  return (
    <div className="space-y-5 pb-8">
      <SheetHeader>
        <SheetTitle>{novo ? "Novo contrato" : d.nome_grupo || "Contrato"}</SheetTitle>
        <SheetDescription>
          {novo
            ? "Cadastrar o contrato é o que cria o cliente (grupo) na plataforma. Os campos com * são obrigatórios."
            : contrato.origem === "existente"
              ? "Cliente que já existia: nenhum campo é obrigatório. Complete o que tiver."
              : "Cliente cadastrado pela plataforma."}
        </SheetDescription>
      </SheetHeader>

      {!novo && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-[12px]">
          <Pill tone={STATUS_TONE[contrato.status]}>{STATUS_LABEL[contrato.status]}</Pill>
          {contrato.vencido && contrato.status === "ativo" && <Pill tone="coral">Vencido</Pill>}
          {contrato.grupo_a_criar && <Pill tone="sky">Grupo a criar no sistema atual</Pill>}
          <span className="text-muted-foreground">
            <Truck className="mr-1 inline h-3.5 w-3.5" />
            {contrato.grupo_a_criar
              ? "Ainda sem veículos"
              : `${nf(contrato.veiculos_hoje)} veículos ativos hoje`}
          </span>
          {contrato.valor_por_veiculo != null && (
            <span className="text-muted-foreground">
              · {brl(contrato.valor_por_veiculo)} por veículo
            </span>
          )}
          {contrato.valor_total_calc != null && (
            <span className="text-muted-foreground">· total {brl(contrato.valor_total_calc)}</span>
          )}
          {contrato.motivo_status && (
            <span className="w-full text-muted-foreground">Motivo: {contrato.motivo_status}</span>
          )}
        </div>
      )}

      {SECOES.map((s) => (
        <fieldset key={s.titulo} className="space-y-3">
          <legend className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            {s.titulo}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {s.campos.map((c) => {
              const obrig = novo && OBRIG_NOVO.has(c.nome);
              const id = `ct-${c.nome}`;
              const v = d[c.nome];
              const erro = erroCampo === c.nome;
              return (
                <label
                  key={c.nome}
                  htmlFor={id}
                  className={cn(
                    "min-w-0 text-[12px] text-muted-foreground",
                    c.cheio && "sm:col-span-2",
                  )}
                >
                  <span className={cn(erro && "font-semibold text-coral")}>
                    {c.rotulo}
                    {obrig ? " *" : ""}
                  </span>
                  {c.tipo === "area" ? (
                    <textarea
                      id={id}
                      value={String(v ?? "")}
                      onChange={(e) => set(c.nome, e.target.value)}
                      rows={3}
                      className={cn(
                        css,
                        "mt-1 h-auto py-2",
                        erro ? "border-coral" : "border-border",
                      )}
                    />
                  ) : c.tipo === "lista" ? (
                    <select
                      id={id}
                      value={String(v ?? "")}
                      onChange={(e) => set(c.nome, e.target.value)}
                      className={cn(css, "mt-1", erro ? "border-coral" : "border-border")}
                    >
                      <option value="">—</option>
                      {listaDe(c.opcoes).map((o) => (
                        <option key={o} value={o}>
                          {SEGMENTO_LABEL[o] ?? o}
                        </option>
                      ))}
                    </select>
                  ) : c.tipo === "sim_nao" ? (
                    <select
                      id={id}
                      value={v == null ? "" : v ? "1" : "0"}
                      onChange={(e) =>
                        set(c.nome, e.target.value === "" ? null : e.target.value === "1")
                      }
                      className={cn(css, "mt-1 border-border")}
                    >
                      <option value="">—</option>
                      <option value="1">Sim</option>
                      <option value="0">Não</option>
                    </select>
                  ) : c.tipo === "multi" ? (
                    <span id={id} className="mt-1 flex flex-wrap gap-1.5">
                      {listaDe(c.opcoes).map((o) => {
                        const sel = ((v as string[]) ?? []).includes(o);
                        return (
                          <button
                            key={o}
                            type="button"
                            aria-pressed={sel}
                            onClick={() =>
                              set(
                                c.nome,
                                sel
                                  ? ((v as string[]) ?? []).filter((x) => x !== o)
                                  : [...((v as string[]) ?? []), o],
                              )
                            }
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[12px]",
                              sel
                                ? "border-brand-navy bg-navy-tint font-medium text-foreground"
                                : "border-border bg-white text-muted-foreground",
                            )}
                          >
                            {o}
                          </button>
                        );
                      })}
                    </span>
                  ) : (
                    <input
                      id={id}
                      type={
                        c.tipo === "data"
                          ? "date"
                          : c.tipo === "numero" || c.tipo === "moeda"
                            ? "number"
                            : c.tipo === "email"
                              ? "email"
                              : "text"
                      }
                      step={c.tipo === "moeda" ? "0.01" : undefined}
                      value={v == null ? "" : String(v)}
                      placeholder={c.ajuda}
                      onChange={(e) =>
                        set(
                          c.nome,
                          c.tipo === "numero" || c.tipo === "moeda"
                            ? e.target.value === ""
                              ? null
                              : Number(e.target.value)
                            : e.target.value,
                        )
                      }
                      className={cn(css, "mt-1", erro ? "border-coral" : "border-border")}
                    />
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-border bg-card pt-3">
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-navy px-4 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
          {novo ? "Criar contrato e cliente" : "Salvar"}
        </button>
        {!novo && (
          <>
            <input
              id="ct-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo (para suspender ou encerrar)"
              className={cn(
                "h-9 min-w-[220px] flex-1 rounded-lg border bg-white px-3 text-[13px]",
                erroCampo === "motivo" ? "border-coral" : "border-border",
              )}
            />
            {contrato.status !== "ativo" ? (
              <button
                type="button"
                onClick={() => mudarStatus("ativo")}
                className="h-9 rounded-lg border border-border px-3 text-[13px] hover:bg-secondary"
              >
                Reativar
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => mudarStatus("suspenso")}
                  className="h-9 rounded-lg border border-border px-3 text-[13px] hover:bg-secondary"
                >
                  Suspender
                </button>
                <button
                  type="button"
                  onClick={() => mudarStatus("encerrado")}
                  className="h-9 rounded-lg border border-coral/50 px-3 text-[13px] text-coral hover:bg-coral/10"
                >
                  Encerrar
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
