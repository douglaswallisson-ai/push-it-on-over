import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { Building2, Download, RefreshCw, Search, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote } from "@/components/ss/ui/QueryState";
import { lerAuditoria, type RegistroAuditoria } from "@/lib/session";
import { useSessao } from "@/hooks/use-sessao";
import { ehSuperAdmin, pode } from "@/lib/permissoes";
import { exportarCSV } from "@/lib/export";
import { desde, nf } from "@/lib/queries";
import { dataHora } from "@/lib/queries";

/**
 * Auditoria — quem fez o quê, quando e em qual organização.
 *
 * Existe porque o super admin tem acesso irrestrito a todas as bases. Poder
 * total sem registro é o que se torna indefensável numa disputa com cliente
 * ("alguém da SS mexeu no meu cadastro"). Aqui a resposta é verificável.
 *
 * Visível para super admin e para o administrador da própria organização, que
 * tem direito de saber o que foi feito na base dele — inclusive pela SS.
 */

const ACAO_TONE: Record<string, PillTone> = {
  login: "sky",
  logout: "neutral",
  troca_organizacao: "gold",
  criacao: "green",
  edicao: "sky",
  exclusao: "coral",
};

const ACAO_LABEL: Record<string, string> = {
  login: "Entrada",
  logout: "Saída",
  troca_organizacao: "Troca de organização",
  criacao: "Criação",
  edicao: "Edição",
  exclusao: "Exclusão",
};

export default function Auditoria() {
  const navigate = useNavigate();
  const { sessao, carregando } = useSessao();
  const [registros, setRegistros] = useState<RegistroAuditoria[]>([]);

  // A trilha vive no cliente; carregar no efeito evita divergência de hidratação.
  useEffect(() => setRegistros(lerAuditoria()), [sessao]);
  const [busca, setBusca] = useState("");

  const autorizado = pode(sessao?.perfil, "ver_auditoria");

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    const base = registros;
    if (!t) return base;
    return base.filter(
      (r) =>
        r.usuario.toLowerCase().includes(t) ||
        r.organizacao.toLowerCase().includes(t) ||
        r.detalhe.toLowerCase().includes(t) ||
        (ACAO_LABEL[r.acao] ?? r.acao).toLowerCase().includes(t),
    );
  }, [registros, busca]);

  // Enquanto a sessão não foi lida no cliente não dá para decidir bloqueio.
  if (carregando) {
    return (
      <>
        <PageHeader title="Auditoria" subtitle="Registro de ações do sistema" />
        <div className="mx-auto max-w-[1360px] px-6 py-10">
          <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      </>
    );
  }

  if (!autorizado) {
    return (
      <>
        <PageHeader title="Auditoria" subtitle="Acesso restrito" />
        <div className="mx-auto max-w-[720px] px-6 py-16 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-[16px] font-semibold text-foreground">Sem permissão</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-muted-foreground">
            A trilha de auditoria é visível para administradores. Fale com o administrador da sua organização se
            precisar consultá-la.
          </p>
          <button
            onClick={() => navigate("/app")}
            className="mt-6 rounded-full bg-brand-navy px-5 py-2 text-sm font-semibold text-white"
          >
            Voltar ao início
          </button>
        </div>
      </>
    );
  }

  const COLS: Column<RegistroAuditoria & Record<string, unknown>>[] = [
    {
      key: "em",
      header: "Quando",
      render: (r) => (
        <span className="whitespace-nowrap font-mono text-[13px] text-ink-soft" title={dataHora(r.em)}>
          {desde(r.em)}
        </span>
      ),
    },
    {
      key: "usuario",
      header: "Usuário",
      render: (r) => (
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-foreground">{r.usuario}</div>
            <div className="text-[12px] text-muted-foreground">{r.perfil}</div>
          </div>
        </div>
      ),
    },
    {
      key: "organizacao",
      header: "Organização",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          {r.organizacao}
        </span>
      ),
    },
    {
      key: "acao",
      header: "Ação",
      render: (r) => <Pill tone={ACAO_TONE[r.acao] ?? "neutral"}>{ACAO_LABEL[r.acao] ?? r.acao}</Pill>,
    },
    { key: "detalhe", header: "Detalhe" },
  ];

  const porSuperAdmin = registros.filter((r) => r.perfil === "super_admin").length;
  const organizacoes = new Set(registros.map((r) => r.organizacao)).size;

  return (
    <>
      <PageHeader
        title="Auditoria"
        subtitle="Registro de ações do sistema"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setRegistros(lerAuditoria());
                toast.success("Trilha atualizada.");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-secondary"
            >
              <RefreshCw className="h-[15px] w-[15px]" />
              Atualizar
            </button>
            <button
              onClick={() => {
                const n = exportarCSV(
                  lista,
                  [
                    { cabecalho: "Data e hora", valor: (r) => dataHora(r.em) },
                    { cabecalho: "Usuário", valor: (r) => r.usuario },
                    { cabecalho: "Perfil", valor: (r) => r.perfil },
                    { cabecalho: "Organização", valor: (r) => r.organizacao },
                    { cabecalho: "Ação", valor: (r) => ACAO_LABEL[r.acao] ?? r.acao },
                    { cabecalho: "Detalhe", valor: (r) => r.detalhe },
                  ],
                  "auditoria",
                );
                toast.success(`${n} registros exportados.`);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              <Download className="h-[15px] w-[15px]" />
              Exportar
            </button>
          </div>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatTile icon={ShieldCheck} label="Registros" value={nf(registros.length)} color="var(--brand-navy)" />
          <StatTile
            icon={ShieldCheck}
            label="Ações do super admin"
            value={nf(porSuperAdmin)}
            color="var(--gold)"
            foot="acesso irrestrito a todas as bases"
          />
          <StatTile icon={Building2} label="Organizações tocadas" value={nf(organizacoes)} color="var(--brand-sky)" />
        </div>

        <Card
          title="Trilha de auditoria"
          icon={ShieldCheck}
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Usuário, organização ou ação…"
                className="h-9 w-60 rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
              />
            </div>
          }
          bodyClassName="p-4"
        >
          {lista.length ? (
            <DataTable columns={COLS} rows={lista as (RegistroAuditoria & Record<string, unknown>)[]} />
          ) : (
            <EmptyNote>
              {busca
                ? "Nenhum registro com esse filtro."
                : "Nenhuma ação registrada nesta sessão ainda. A trilha começa a partir da entrada no sistema."}
            </EmptyNote>
          )}
          <p className="mt-3 text-[12px] text-muted-foreground">
            {ehSuperAdmin(sessao?.perfil)
              ? "Como super admin, você vê a trilha de todas as organizações."
              : "Você vê as ações realizadas na sua organização, inclusive as feitas pela equipe da SS."}{" "}
            A trilha atual é da sessão; com o back-end ela passa a ser permanente.
          </p>
        </Card>
      </div>
    </>
  );
}
