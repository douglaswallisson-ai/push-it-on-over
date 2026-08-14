import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import { AlertTriangle, Building2, CalendarClock, FileText, Truck, UserCog, Users } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, Pill, StatTile } from "@/components/ss/ui/data";
import { SkeletonRows } from "@/components/ss/ui/QueryState";
import { adminsQuery, contratosOrgQuery, nf } from "@/lib/queries";
import { STATUS_CONTRATO_LABEL, type ContratoOrganizacao, type ModalidadeContrato, MODALIDADE_CONTRATO_LABEL } from "@/types";

/**
 * Abertura do console: a saúde da base de clientes.
 *
 * Foi montado em torno do que exige ação — contrato vencendo, rascunho parado,
 * cliente sem usuário liberado — e não de um resumo bonito. O console é usado
 * com pouca frequência, então precisa dizer logo o que está pendente.
 */

const total = (c: ContratoOrganizacao) => Object.values(c.veiculosPorModalidade).reduce((a, v) => a + (v ?? 0), 0);
const termino = (c: ContratoOrganizacao) => c.terminoVigente ?? c.termino;
const dias = (iso: string) => Math.round((new Date(`${iso}T12:00`).getTime() - Date.now()) / 86_400_000);

export default function PainelConsole() {
  const contratosQ = useQuery(contratosOrgQuery());
  const adminsQ = useQuery(adminsQuery());
  const navigate = useNavigate();

  const contratos = contratosQ.data ?? [];
  const ativos = contratos.filter((c) => c.status === "ativo");
  const rascunhos = contratos.filter((c) => c.status === "rascunho");
  const vencendo = ativos.filter((c) => dias(termino(c)) <= 90);
  const semUsuario = ativos.filter((c) => c.usuarios.filter((u) => u.ativo).length === 0);
  const veiculos = ativos.reduce((a, c) => a + total(c), 0);

  /** Distribuição por modalidade — mostra em que mercado a base está. */
  const porModalidade = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of ativos) {
      for (const [mod, v] of Object.entries(c.veiculosPorModalidade)) m[mod] = (m[mod] ?? 0) + (v ?? 0);
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]) as [ModalidadeContrato, number][];
  }, [ativos]);

  const pendencias = [
    ...vencendo.map((c) => ({
      texto: `${c.nomeFantasia ?? c.razaoSocial} vence em ${dias(termino(c))} dias`,
      acao: "Entrar em renovação",
      destino: "/console/contratos",
    })),
    ...rascunhos.map((c) => ({
      texto: `${c.nomeFantasia ?? c.razaoSocial} está em rascunho`,
      acao: "Organização não liberada",
      destino: "/console/contratos",
    })),
    ...semUsuario.map((c) => ({
      texto: `${c.nomeFantasia ?? c.razaoSocial} sem usuário ativo`,
      acao: "Ninguém consegue entrar",
      destino: "/console/contratos",
    })),
  ];

  return (
    <>
      <PageHeader title="Painel" subtitle="Console › Visão geral da base" />

      <div className="mx-auto max-w-[1200px] space-y-5 px-6 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Building2} label="Clientes ativos" value={nf(ativos.length)} color="var(--leaf)" />
          <StatTile icon={Truck} label="Veículos contratados" value={nf(veiculos)} color="var(--brand-navy)" />
          <StatTile
            icon={CalendarClock}
            label="Vencem em 90 dias"
            value={nf(vencendo.length)}
            color={vencendo.length ? "var(--coral)" : "var(--leaf)"}
          />
          <StatTile icon={Users} label="Administradores" value={nf((adminsQ.data ?? []).filter((a) => a.ativo).length)} color="var(--brand-sky)" />
        </div>

        {pendencias.length > 0 && (
          <Card title="Precisa de atenção" icon={AlertTriangle} action={<Pill tone="gold">{pendencias.length}</Pill>} bodyClassName="p-4">
            <ul className="space-y-1.5">
              {pendencias.map((p, i) => (
                <li key={i}>
                  <button
                    onClick={() => navigate(p.destino)}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{p.texto}</span>
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">{p.acao}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Base por modalidade" icon={Truck} bodyClassName="p-4">
            {contratosQ.isPending ? (
              <SkeletonRows rows={3} />
            ) : (
              <ul className="space-y-2">
                {porModalidade.map(([mod, v]) => {
                  const pct = veiculos ? (v / veiculos) * 100 : 0;
                  return (
                    <li key={mod} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-[12.5px] text-ink-soft">{MODALIDADE_CONTRATO_LABEL[mod]}</span>
                      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <span className="block h-2.5 rounded-full bg-brand-navy" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-20 shrink-0 text-right font-mono text-[12.5px] font-semibold text-foreground">
                        {nf(v)} ({pct.toFixed(0)}%)
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Clientes" icon={FileText} bodyClassName="p-4">
            <ul className="space-y-1.5">
              {contratos.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => navigate("/console/contratos")}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">
                        {c.nomeFantasia ?? c.razaoSocial}
                      </span>
                      <span className="block font-mono text-[11px] text-muted-foreground">{c.numero}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{nf(total(c))} veículos</span>
                    <Pill tone={c.status === "ativo" ? "green" : c.status === "rascunho" ? "gold" : "neutral"}>
                      {STATUS_CONTRATO_LABEL[c.status]}
                    </Pill>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="Atalhos" icon={UserCog} bodyClassName="p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: "Cadastrar contrato", destino: "/console/contratos" },
              { label: "Perfis de acesso", destino: "/console/perfis" },
              { label: "Adicionar administrador", destino: "/console/administradores" },
            ].map((a) => (
              <button
                key={a.destino}
                onClick={() => navigate(a.destino)}
                className="rounded-xl border border-border px-4 py-3 text-left text-[13px] font-medium text-brand-navy transition-colors hover:bg-secondary"
              >
                {a.label}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
