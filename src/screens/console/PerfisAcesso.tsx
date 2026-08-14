import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Lock, Plus, ShieldCheck, UserCog, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, Pill, StatTile } from "@/components/ss/ui/data";
import { SkeletonRows } from "@/components/ss/ui/QueryState";
import { nf, perfisAcessoQuery } from "@/lib/queries";
import { registrarAuditoria } from "@/lib/session";
import type { PerfilAcesso } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Perfis de acesso aplicados às organizações clientes.
 *
 * Os quatro perfis de sistema não podem ser excluídos nem renomeados: eles são
 * referenciados por usuários em toda a base, e apagar um deixaria gente sem
 * permissão nenhuma sem aviso. Perfis sob medida, criados aqui, podem ser
 * alterados livremente.
 */

const ACOES: { chave: string; label: string; descricao: string; grupo: string }[] = [
  { chave: "ver_dados_operacionais", label: "Ver dados operacionais", descricao: "Mapa, frota, viagens e relatórios de leitura", grupo: "Leitura" },
  { chave: "exportar_dados", label: "Exportar dados", descricao: "Baixar CSV e imprimir relatórios", grupo: "Leitura" },
  { chave: "tratar_eventos", label: "Tratar eventos", descricao: "Dar tratativa a ocorrências e alarmes", grupo: "Operação" },
  { chave: "agendar_manutencao", label: "Agendar manutenção", descricao: "Abrir ordem de serviço e mover o quadro", grupo: "Operação" },
  { chave: "editar_cadastros", label: "Editar cadastros", descricao: "Veículos, motoristas, linhas e pontos", grupo: "Configuração" },
  { chave: "configurar_alarmes", label: "Configurar alarmes", descricao: "Criar e alterar regras de alarme", grupo: "Configuração" },
  { chave: "configurar_metas", label: "Configurar metas e pesos", descricao: "Definir critérios de premiação", grupo: "Configuração" },
  { chave: "excluir_registros", label: "Excluir registros", descricao: "Remover cadastros em definitivo", grupo: "Configuração" },
  { chave: "gerenciar_usuarios", label: "Gerenciar usuários", descricao: "Criar, editar e desativar usuários da organização", grupo: "Administração" },
  { chave: "redefinir_senha_de_terceiro", label: "Redefinir senha de terceiro", descricao: "Forçar nova senha para outro usuário", grupo: "Administração" },
  { chave: "ver_auditoria", label: "Ver auditoria", descricao: "Consultar o log de ações da organização", grupo: "Administração" },
];

const GRUPOS = ["Leitura", "Operação", "Configuração", "Administração"];

export default function PerfisAcesso() {
  const { data, isPending } = useQuery(perfisAcessoQuery());
  const [locais, setLocais] = useState<PerfilAcesso[] | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const perfis = useMemo(() => locais ?? data ?? [], [locais, data]);
  const perfil = perfis.find((p) => p.id === selecionado) ?? perfis[0];

  const alternarAcao = (chave: string) => {
    if (!perfil) return;
    if (perfil.sistema) {
      toast.error("Perfil de sistema não pode ser alterado.", {
        description: "Crie um perfil sob medida para ajustar permissões.",
      });
      return;
    }
    const tem = perfil.acoes.includes(chave);
    const novas = tem ? perfil.acoes.filter((a) => a !== chave) : [...perfil.acoes, chave];
    setLocais(perfis.map((p) => (p.id === perfil.id ? { ...p, acoes: novas } : p)));
    registrarAuditoria("plataforma", `Perfil ${perfil.nome}: ação ${chave} ${tem ? "removida" : "adicionada"}.`);
  };

  const criar = () => {
    const novo: PerfilAcesso = {
      id: `pa${Date.now()}`,
      nome: "Novo perfil",
      descricao: "Descreva para que serve este perfil.",
      acoes: ["ver_dados_operacionais"],
      usuariosVinculados: 0,
    };
    setLocais([...perfis, novo]);
    setSelecionado(novo.id);
    registrarAuditoria("plataforma", "Perfil de acesso criado.");
    toast.success("Perfil criado.", { description: "Marque as ações que ele pode executar." });
  };

  return (
    <>
      <PageHeader
        title="Perfis de acesso"
        subtitle="Console › O que cada perfil pode fazer"
        actions={
          <button
            onClick={criar}
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <Plus className="h-[15px] w-[15px]" />
            Novo perfil
          </button>
        }
      />

      <div className="mx-auto max-w-[1200px] space-y-5 px-6 py-6 md:px-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatTile icon={UserCog} label="Perfis" value={nf(perfis.length)} color="var(--brand-navy)" />
          <StatTile icon={Lock} label="De sistema" value={nf(perfis.filter((p) => p.sistema).length)} color="var(--muted-foreground)" foot="não editáveis" />
          <StatTile icon={Users} label="Usuários vinculados" value={nf(perfis.reduce((a, p) => a + p.usuariosVinculados, 0))} color="var(--brand-sky)" />
        </div>

        {isPending ? (
          <Card title="Carregando" icon={UserCog}>
            <SkeletonRows rows={4} />
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
            <Card title="Perfis" icon={UserCog} bodyClassName="p-2">
              <ul className="space-y-1">
                {perfis.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setSelecionado(p.id)}
                      className={cn(
                        "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                        perfil?.id === p.id ? "bg-navy-tint" : "hover:bg-secondary",
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="text-[13.5px] font-medium text-foreground">{p.nome}</span>
                        {p.sistema && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Perfil de sistema" />}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {p.acoes.length} ações · {p.usuariosVinculados} usuários
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            {perfil && (
              <Card
                title={perfil.nome}
                icon={ShieldCheck}
                action={
                  perfil.sistema ? (
                    <Pill tone="neutral">
                      <Lock className="h-3 w-3" />
                      Perfil de sistema
                    </Pill>
                  ) : (
                    <Pill tone="sky">{perfil.usuariosVinculados} usuários</Pill>
                  )
                }
                bodyClassName="p-4"
              >
                <p className="mb-3 text-[12.5px] text-muted-foreground">{perfil.descricao}</p>

                {perfil.sistema && (
                  <p className="mb-3 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-[12px] text-muted-foreground">
                    Perfis de sistema são referenciados por usuários em toda a base. Alterar um mudaria a permissão de
                    quem já está usando, sem aviso — por isso são fixos. Para ajustar, crie um perfil sob medida.
                  </p>
                )}

                <div className="space-y-4">
                  {GRUPOS.map((g) => (
                    <div key={g}>
                      <h4 className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        {g}
                      </h4>
                      <ul className="space-y-1">
                        {ACOES.filter((a) => a.grupo === g).map((a) => {
                          const marcada = perfil.acoes.includes(a.chave);
                          return (
                            <li key={a.chave}>
                              <button
                                onClick={() => alternarAcao(a.chave)}
                                disabled={perfil.sistema}
                                className={cn(
                                  "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                                  marcada ? "border-leaf-line bg-leaf-tint/40" : "border-border",
                                  !perfil.sistema && "hover:bg-secondary",
                                  perfil.sistema && "cursor-not-allowed",
                                )}
                              >
                                <span
                                  className={cn(
                                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                    marcada ? "border-leaf bg-leaf text-white" : "border-border bg-white",
                                  )}
                                >
                                  {marcada && <Check className="h-3 w-3" />}
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-[13px] font-medium text-foreground">{a.label}</span>
                                  <span className="block text-[11.5px] text-muted-foreground">{a.descricao}</span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
}
