import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  Building2,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  FileText,
  Mail,
  Phone,
  Plus,
  Search,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { SeloDadosExemplo } from "@/components/ss/ui/SeloDadosExemplo";
import { Card, Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { contratosOrgQuery, nf } from "@/lib/queries";
import { registrarAuditoria } from "@/lib/session";
import {
  MODALIDADE_CONTRATO_LABEL,
  STATUS_CONTRATO_LABEL,
  type ContratoOrganizacao,
  type ModalidadeContrato,
  type StatusContrato,
} from "@/types";
import { cn } from "@/lib/utils";

/**
 * Contratos comerciais.
 *
 * É o cadastro que libera uma organização no sistema: sem contrato ativo, a
 * empresa não existe operacionalmente. Isso evita o cenário em que alguém cria
 * uma organização "para testar", ela fica esquecida ligada, e ninguém sabe se
 * está sendo faturada nem quem responde por ela.
 *
 * A quantidade de veículos é declarada **por modalidade**, não em um número só.
 * Uma empresa que opera urbano e fretamento na mesma frota precisa da divisão —
 * ela define o faturamento e quais módulos o cliente enxerga.
 */

const STATUS_TONE: Record<StatusContrato, PillTone> = {
  rascunho: "neutral",
  ativo: "green",
  suspenso: "gold",
  encerrado: "neutral",
  cancelado: "coral",
};

const MODALIDADE_COR: Record<ModalidadeContrato, string> = {
  urbano: "var(--brand-sky)",
  fretamento: "var(--leaf)",
  carga: "var(--gold)",
};

const dataBR = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString("pt-BR");
const diasPara = (iso: string) => Math.round((new Date(`${iso}T12:00`).getTime() - Date.now()) / 86_400_000);

const totalVeiculos = (c: ContratoOrganizacao) =>
  Object.values(c.veiculosPorModalidade).reduce((a, v) => a + (v ?? 0), 0);

/** Término efetivo: o do último aditivo de prorrogação, se houver. */
const terminoEfetivo = (c: ContratoOrganizacao) => c.terminoVigente ?? c.termino;

export default function ContratosOrganizacao() {
  const { data, isPending, error, refetch } = useQuery(contratosOrgQuery());
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<StatusContrato | "todos">("todos");
  const [aberto, setAberto] = useState<string | null>(null);
  const [locais, setLocais] = useState<ContratoOrganizacao[] | null>(null);
  const [aditivando, setAditivando] = useState<ContratoOrganizacao | null>(null);
  const [novoTermino, setNovoTermino] = useState("");
  const [descAditivo, setDescAditivo] = useState("");

  const contratos = useMemo(() => locais ?? data ?? [], [locais, data]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return contratos.filter((c) => {
      if (filtro !== "todos" && c.status !== filtro) return false;
      if (!t) return true;
      return (
        c.razaoSocial.toLowerCase().includes(t) ||
        (c.nomeFantasia ?? "").toLowerCase().includes(t) ||
        c.cnpj.includes(t) ||
        c.numero.toLowerCase().includes(t)
      );
    });
  }, [contratos, busca, filtro]);

  const ativos = contratos.filter((c) => c.status === "ativo");
  const vencendo = ativos.filter((c) => diasPara(terminoEfetivo(c)) <= 90);
  const veiculosTotais = ativos.reduce((a, c) => a + totalVeiculos(c), 0);
  const rascunhos = contratos.filter((c) => c.status === "rascunho").length;

  const aplicarAditivo = () => {
    if (!aditivando || !novoTermino) return;
    const numero = `${aditivando.aditivos.length + 1}º aditivo`;
    const atualizado: ContratoOrganizacao = {
      ...aditivando,
      terminoVigente: novoTermino,
      aditivos: [
        ...aditivando.aditivos,
        {
          id: `ad${Date.now()}`,
          numero,
          tipo: "prorrogacao",
          assinadoEm: new Date().toISOString().slice(0, 10),
          novoTermino,
          descricao: descAditivo || `Prorrogação até ${dataBR(novoTermino)}.`,
          registradoPor: "Administrador",
        },
      ],
    };
    setLocais(contratos.map((c) => (c.id === aditivando.id ? atualizado : c)));
    registrarAuditoria(
      "contrato",
      `${numero} registrado no contrato ${aditivando.numero} — ${aditivando.razaoSocial}. Novo término: ${dataBR(novoTermino)}.`,
    );
    toast.success(`${numero} registrado.`, { description: `Vigência prorrogada até ${dataBR(novoTermino)}.` });
    setAditivando(null);
    setNovoTermino("");
    setDescAditivo("");
  };

  const mudarStatus = (c: ContratoOrganizacao, status: StatusContrato, aviso: string) => {
    setLocais(
      contratos.map((x) =>
        x.id === c.id
          ? { ...x, status, canceladoEm: status === "cancelado" ? new Date().toISOString() : x.canceladoEm }
          : x,
      ),
    );
    registrarAuditoria("contrato", `Contrato ${c.numero} (${c.razaoSocial}) passou para ${STATUS_CONTRATO_LABEL[status]}.`);
    toast.success(aviso, { description: `${c.numero} · ${c.razaoSocial}` });
  };

  if (error) {
    return (
      <>
        <PageHeader title="Contratos" subtitle="Administração" />
        <div className="mx-auto max-w-[1360px] px-6 py-6">
          <ErrorBox error={error} onRetry={() => refetch()} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Contratos"
        subtitle="Administração › Contratos comerciais"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Razão social, CNPJ ou número…"
                className="h-9 w-60 rounded-lg border border-border bg-white pl-8 pr-3 text-[13px] outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={() => toast.info("Novo contrato", { description: "O formulário completo entra com a API de gravação." })}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-[15px] w-[15px]" />
              Novo contrato
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-5 px-6 py-6 md:px-8">
        <SeloDadosExemplo motivo="Contratos comerciais são módulo novo, sem correspondência no backend." />

        <div data-tour="stat" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={FileText} label="Contratos ativos" value={nf(ativos.length)} color="var(--leaf)" />
          <StatTile icon={Truck} label="Veículos contratados" value={nf(veiculosTotais)} color="var(--brand-navy)" />
          <StatTile
            icon={CalendarClock}
            label="Vencem em 90 dias"
            value={nf(vencendo.length)}
            color={vencendo.length ? "var(--coral)" : "var(--leaf)"}
            foot="entrar em renovação"
          />
          <StatTile icon={AlertTriangle} label="Em rascunho" value={nf(rascunhos)} color="var(--gold)" foot="organização não liberada" />
        </div>

        {/* A regra que dá sentido à tela. */}
        <div data-tour="regra" className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">O contrato libera a organização.</strong> Enquanto está em rascunho, a
            empresa não opera no sistema — nenhum usuário entra e nenhum veículo é cadastrado. É o que impede
            organizações criadas para teste ficarem ligadas e esquecidas, sem ninguém saber se estão sendo faturadas.
          </p>
        </div>

        <Card
          title="Contratos"
          icon={FileText}
          action={<Pill tone="sky">{lista.length} de {contratos.length}</Pill>}
          bodyClassName="p-4"
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(["todos", "ativo", "rascunho", "suspenso", "encerrado", "cancelado"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFiltro(s)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                  filtro === s ? "bg-brand-navy text-white" : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                {s === "todos" ? "Todos" : STATUS_CONTRATO_LABEL[s]}
                <span className="ml-1.5 font-mono opacity-70">
                  {s === "todos" ? contratos.length : contratos.filter((c) => c.status === s).length}
                </span>
              </button>
            ))}
          </div>

          {isPending ? (
            <SkeletonRows rows={4} />
          ) : lista.length === 0 ? (
            <EmptyNote>Nenhum contrato com esse filtro.</EmptyNote>
          ) : (
            <div data-tour="lista" className="space-y-2.5">
              {lista.map((c) => {
                const dias = diasPara(terminoEfetivo(c));
                const alerta = c.status === "ativo" && dias <= 90;
                const abertoAqui = aberto === c.id;

                return (
                  <div key={c.id} className="overflow-hidden rounded-xl border border-border bg-card">
                    <button
                      onClick={() => setAberto(abertoAqui ? null : c.id)}
                      className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="font-mono text-[13px] font-bold text-foreground">{c.numero}</span>
                          <span className="truncate text-[13.5px] text-foreground">{c.nomeFantasia ?? c.razaoSocial}</span>
                        </span>
                        <span className="block truncate font-mono text-[11.5px] text-muted-foreground">{c.cnpj}</span>
                      </span>

                      {/* Divisão por modalidade — o dado que mais importa aqui. */}
                      <span className="flex flex-wrap items-center gap-1.5">
                        {(Object.entries(c.veiculosPorModalidade) as [ModalidadeContrato, number][])
                          .filter(([, v]) => v > 0)
                          .map(([mod, v]) => (
                            <span
                              key={mod}
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium"
                              style={{
                                background: `color-mix(in oklab, ${MODALIDADE_COR[mod]} 14%, white)`,
                                color: `color-mix(in oklab, ${MODALIDADE_COR[mod]} 82%, black)`,
                              }}
                            >
                              {MODALIDADE_CONTRATO_LABEL[mod]} {v}
                            </span>
                          ))}
                      </span>

                      <span className="flex shrink-0 items-center gap-2">
                        <span className={cn("whitespace-nowrap font-mono text-[12px]", alerta ? "font-semibold text-coral" : "text-muted-foreground")}>
                          até {dataBR(terminoEfetivo(c))}
                          {alerta && ` (${dias} d)`}
                        </span>
                        {c.aditivos.length > 0 && <Pill tone="sky">{c.aditivos.length} aditivo{c.aditivos.length > 1 ? "s" : ""}</Pill>}
                        <Pill tone={STATUS_TONE[c.status]}>{STATUS_CONTRATO_LABEL[c.status]}</Pill>
                      </span>
                    </button>

                    {abertoAqui && (
                      <div className="border-t border-border bg-secondary/20 px-4 py-4">
                        <div className="grid gap-4 lg:grid-cols-3">
                          {/* Empresa. */}
                          <div className="rounded-xl border border-border bg-card p-3">
                            <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                              Empresa
                            </h4>
                            <dl className="space-y-1 text-[12px]">
                              <Info rotulo="Razão social" valor={c.razaoSocial} />
                              <Info rotulo="CNPJ" valor={c.cnpj} mono />
                              <Info rotulo="Telefone" valor={c.telefone} icone={Phone} />
                              <Info rotulo="E-mail" valor={c.email} icone={Mail} />
                            </dl>
                          </div>

                          {/* Responsável. */}
                          <div className="rounded-xl border border-border bg-card p-3">
                            <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                              <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
                              Responsável
                            </h4>
                            <dl className="space-y-1 text-[12px]">
                              <Info rotulo="Nome" valor={c.responsavelNome} />
                              {c.responsavelCargo && <Info rotulo="Cargo" valor={c.responsavelCargo} />}
                              {c.responsavelTelefone && <Info rotulo="Telefone" valor={c.responsavelTelefone} />}
                              {c.responsavelEmail && <Info rotulo="E-mail" valor={c.responsavelEmail} />}
                            </dl>
                          </div>

                          {/* Financeiro — separado de propósito: quem opera não é
                              quem paga, e a cobrança precisa chegar no lugar certo. */}
                          <div className="rounded-xl border border-border bg-card p-3">
                            <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              Contato financeiro
                            </h4>
                            <dl className="space-y-1 text-[12px]">
                              <Info rotulo="Nome" valor={c.financeiroNome} />
                              <Info rotulo="E-mail" valor={c.financeiroEmail} />
                              {c.financeiroTelefone && <Info rotulo="Telefone" valor={c.financeiroTelefone} />}
                            </dl>
                          </div>
                        </div>

                        {/* Vigência e aditivos. */}
                        <div className="mt-4 rounded-xl border border-border bg-card p-3">
                          <h4 className="mb-2 flex items-center justify-between gap-2 text-[12px] font-semibold text-foreground">
                            <span className="flex items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                              Vigência
                            </span>
                            {c.status === "ativo" && (
                              <button
                                onClick={() => {
                                  setAditivando(c);
                                  setNovoTermino("");
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11.5px] font-medium text-brand-navy hover:bg-secondary"
                              >
                                <CalendarPlus className="h-3 w-3" />
                                Registrar aditivo
                              </button>
                            )}
                          </h4>

                          <p className="text-[12.5px] text-ink-soft">
                            Ativação em <strong>{dataBR(c.ativacao)}</strong> · término original{" "}
                            <span className={c.terminoVigente ? "line-through text-muted-foreground" : ""}>
                              {dataBR(c.termino)}
                            </span>
                            {c.terminoVigente && (
                              <>
                                {" "}
                                · vigente até <strong className="text-foreground">{dataBR(c.terminoVigente)}</strong>
                              </>
                            )}
                          </p>

                          {c.aditivos.length > 0 && (
                            <ul className="mt-2.5 space-y-1.5">
                              {c.aditivos.map((a) => (
                                <li key={a.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px]">
                                  <span className="font-semibold text-foreground">{a.numero}</span>
                                  <Pill tone="sky">{a.tipo}</Pill>
                                  <span className="text-ink-soft">{a.descricao}</span>
                                  <span className="text-[11px] text-muted-foreground">
                                    · {dataBR(a.assinadoEm)} por {a.registradoPor}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}

                          {/* Aditivo em edição. */}
                          {aditivando?.id === c.id && (
                            <div className="mt-3 rounded-lg border border-brand-sky bg-navy-tint/40 p-3">
                              <p className="mb-2 text-[12px] font-medium text-foreground">
                                Novo aditivo de prorrogação
                              </p>
                              <div className="flex flex-wrap items-end gap-2">
                                <label className="flex flex-col gap-1">
                                  <span className="text-[11px] text-muted-foreground">Novo término</span>
                                  <input
                                    type="date"
                                    value={novoTermino}
                                    onChange={(e) => setNovoTermino(e.target.value)}
                                    className="h-9 rounded-lg border border-border bg-white px-2.5 text-[13px] outline-none focus:border-accent"
                                  />
                                </label>
                                <label className="flex flex-1 flex-col gap-1">
                                  <span className="text-[11px] text-muted-foreground">Descrição</span>
                                  <input
                                    value={descAditivo}
                                    onChange={(e) => setDescAditivo(e.target.value)}
                                    placeholder="Prorrogação nas mesmas condições comerciais"
                                    className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-[13px] outline-none focus:border-accent"
                                  />
                                </label>
                                <button
                                  onClick={aplicarAditivo}
                                  disabled={!novoTermino}
                                  className="h-9 rounded-lg bg-brand-navy px-3 text-[12.5px] font-semibold text-white disabled:opacity-50"
                                >
                                  Registrar
                                </button>
                                <button
                                  onClick={() => setAditivando(null)}
                                  className="h-9 rounded-lg border border-border px-3 text-[12.5px] text-muted-foreground hover:bg-secondary"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Usuários liberados. */}
                        <div className="mt-4 rounded-xl border border-border bg-card p-3">
                          <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            Usuários liberados pelo contrato
                            <span className="font-mono text-[11px] text-muted-foreground">({c.usuarios.length})</span>
                          </h4>
                          {c.usuarios.length === 0 ? (
                            <p className="text-[12px] text-gold">
                              Nenhum usuário vinculado — ninguém consegue entrar nesta organização.
                            </p>
                          ) : (
                            <ul className="space-y-1">
                              {c.usuarios.map((u) => (
                                <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
                                  <span className="font-medium text-foreground">{u.nome}</span>
                                  <span className="text-muted-foreground">{u.email}</span>
                                  <Pill tone={u.perfil === "admin_empresa" ? "sky" : "neutral"}>{u.perfil.replace("_", " ")}</Pill>
                                  {!u.ativo && <span className="text-[11px] text-muted-foreground">inativo</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {c.observacoes && (
                          <p className="mt-3 rounded-lg bg-secondary/60 px-3 py-2 text-[12px] text-ink-soft">
                            {c.observacoes}
                          </p>
                        )}

                        {/* Ações de status. */}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {c.status === "rascunho" && (
                            <button
                              onClick={() => mudarStatus(c, "ativo", "Contrato ativado — organização liberada.")}
                              className="inline-flex items-center gap-1.5 rounded-full bg-leaf px-4 py-2 text-[13px] font-semibold text-white"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Ativar contrato e liberar organização
                            </button>
                          )}
                          {c.status === "ativo" && (
                            <>
                              <button
                                onClick={() => mudarStatus(c, "suspenso", "Contrato suspenso.")}
                                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 text-[13px] font-medium text-brand-navy hover:bg-secondary"
                              >
                                Suspender
                              </button>
                              <button
                                onClick={() => mudarStatus(c, "cancelado", "Contrato cancelado.")}
                                className="inline-flex items-center gap-1.5 rounded-full border border-coral-line bg-white px-4 py-2 text-[13px] font-medium text-coral hover:bg-coral-tint/40"
                              >
                                <Ban className="h-4 w-4" />
                                Cancelar contrato
                              </button>
                            </>
                          )}
                          {c.status === "suspenso" && (
                            <button
                              onClick={() => mudarStatus(c, "ativo", "Contrato reativado.")}
                              className="inline-flex items-center gap-1.5 rounded-full bg-leaf px-4 py-2 text-[13px] font-semibold text-white"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Reativar
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Info({
  rotulo,
  valor,
  mono,
  icone: Icone,
}: {
  rotulo: string;
  valor: string;
  mono?: boolean;
  icone?: typeof Phone;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-muted-foreground">{rotulo}</dt>
      <dd className={cn("min-w-0 flex-1 truncate text-right text-ink-soft", mono && "font-mono")} title={valor}>
        {Icone && <Icone className="mr-1 inline h-3 w-3 text-muted-foreground" />}
        {valor}
      </dd>
    </div>
  );
}
