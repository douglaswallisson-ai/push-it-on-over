import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Crown, Mail, Plus, ShieldCheck, UserMinus, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, Pill, StatTile } from "@/components/ss/ui/data";
import { EmptyNote, SkeletonRows } from "@/components/ss/ui/QueryState";
import { adminsQuery, desde, nf } from "@/lib/queries";
import { registrarAuditoria } from "@/lib/session";
import { useSessao } from "@/hooks/use-sessao";
import type { AdministradorPlataforma } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Administradores da plataforma.
 *
 * Qualquer administrador pode adicionar outro — não há hierarquia entre eles.
 * A única assimetria é o fundador, que não pode ser desativado: sem isso, dois
 * administradores poderiam se desativar mutuamente e ninguém mais entraria no
 * console.
 */
export default function Administradores() {
  const { data, isPending } = useQuery(adminsQuery());
  const { sessao } = useSessao();

  const [locais, setLocais] = useState<AdministradorPlataforma[] | null>(null);
  const [convidando, setConvidando] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");

  const admins = useMemo(() => locais ?? data ?? [], [locais, data]);
  const ativos = admins.filter((a) => a.ativo);

  const convidar = () => {
    const n = nome.trim();
    const e = email.trim().toLowerCase();
    if (!n || !e) {
      toast.error("Informe nome e e-mail.");
      return;
    }
    if (admins.some((a) => a.email.toLowerCase() === e)) {
      toast.error("Já existe um administrador com este e-mail.");
      return;
    }

    const novo: AdministradorPlataforma = {
      id: `adm${Date.now()}`,
      nome: n,
      email: e,
      ativo: true,
      criadoEm: new Date().toISOString(),
      criadoPor: sessao?.nome ?? "Administrador",
    };
    setLocais([...admins, novo]);
    registrarAuditoria("plataforma", `Administrador adicionado: ${n} (${e}).`);
    toast.success("Administrador adicionado.", { description: `Convite enviado para ${e}.` });
    setNome("");
    setEmail("");
    setConvidando(false);
  };

  const alternar = (a: AdministradorPlataforma) => {
    if (a.fundador && a.ativo) {
      toast.error("Fundador não pode ser desativado.", {
        description: "É a salvaguarda que impede o console ficar sem nenhum acesso.",
      });
      return;
    }
    if (a.ativo && ativos.length === 1) {
      toast.error("Este é o último administrador ativo.", {
        description: "Desativá-lo deixaria o console sem acesso.",
      });
      return;
    }
    setLocais(admins.map((x) => (x.id === a.id ? { ...x, ativo: !x.ativo } : x)));
    registrarAuditoria("plataforma", `Administrador ${a.ativo ? "desativado" : "reativado"}: ${a.nome}.`);
    toast.success(a.ativo ? "Acesso removido." : "Acesso restabelecido.", { description: a.nome });
  };

  return (
    <>
      <PageHeader
        title="Administradores"
        subtitle="Console › Quem acessa este ambiente"
        actions={
          <button
            onClick={() => setConvidando((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <UserPlus className="h-[15px] w-[15px]" />
            Adicionar administrador
          </button>
        }
      />

      <div className="mx-auto max-w-[1000px] space-y-5 px-6 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatTile icon={Users} label="Com acesso" value={nf(ativos.length)} color="var(--leaf)" />
          <StatTile icon={Crown} label="Fundadores" value={nf(admins.filter((a) => a.fundador).length)} color="var(--gold)" />
          <StatTile icon={UserMinus} label="Sem acesso" value={nf(admins.length - ativos.length)} color="var(--muted-foreground)" />
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Administrador do console enxerga <strong className="text-foreground">todas as organizações</strong> e
            configura a plataforma inteira. Não confunda com o administrador da empresa cliente, que só administra a
            própria organização — esse é criado no contrato.
          </p>
        </div>

        {convidando && (
          <Card title="Novo administrador" icon={UserPlus} bodyClassName="p-4">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[12px] text-muted-foreground">Nome</span>
                <input
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome completo"
                  className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[12px] text-muted-foreground">E-mail corporativo</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && convidar()}
                  placeholder="nome@sstelematica.com.br"
                  className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
                />
              </label>
              <button onClick={convidar} className="h-9 rounded-lg bg-brand-navy px-4 text-[13px] font-semibold text-white">
                <Check className="mr-1 inline h-3.5 w-3.5" />
                Adicionar
              </button>
              <button
                onClick={() => setConvidando(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Card>
        )}

        <Card title="Administradores" icon={Users} action={<Pill tone="sky">{admins.length}</Pill>} bodyClassName="p-4">
          {isPending ? (
            <SkeletonRows rows={4} />
          ) : admins.length === 0 ? (
            <EmptyNote>Nenhum administrador cadastrado.</EmptyNote>
          ) : (
            <ul className="space-y-2">
              {admins.map((a) => (
                <li
                  key={a.id}
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border p-3",
                    !a.ativo && "opacity-60",
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-tint font-mono text-[12px] font-bold text-brand-navy">
                    {a.nome.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[14px] font-semibold text-foreground">{a.nome}</span>
                      {a.fundador && (
                        <Pill tone="gold">
                          <Crown className="h-3 w-3" />
                          Fundador
                        </Pill>
                      )}
                      {a.email === sessao?.email && <Pill tone="sky">você</Pill>}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 text-[12px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {a.email}
                      </span>
                      <span>adicionado por {a.criadoPor}</span>
                      {a.ultimoAcesso && <span>último acesso {desde(a.ultimoAcesso)}</span>}
                    </span>
                  </span>

                  <button
                    onClick={() => alternar(a)}
                    disabled={a.fundador && a.ativo}
                    title={a.fundador && a.ativo ? "Fundador não pode ser desativado" : undefined}
                    className={cn(
                      "shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      a.ativo
                        ? "border-border text-muted-foreground hover:bg-secondary"
                        : "border-leaf-line bg-leaf-tint text-leaf",
                    )}
                  >
                    {a.ativo ? "Remover acesso" : "Restabelecer"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[12px] text-muted-foreground">
            Qualquer administrador pode adicionar outro — não há hierarquia entre eles. O fundador não pode ser
            desativado, para que o console nunca fique sem acesso.
          </p>
        </Card>
      </div>
    </>
  );
}
