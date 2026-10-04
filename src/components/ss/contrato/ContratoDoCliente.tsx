import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Check, FileText, Mail, Pencil, Phone, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { Card, Pill } from "@/components/ss/ui/data";
import { EmptyNote, SkeletonRows } from "@/components/ss/ui/QueryState";
import { contratosOrgQuery, nf } from "@/lib/queries";
import { registrarAuditoria } from "@/lib/session";
import { useSessao } from "@/hooks/use-sessao";
import {
  MODALIDADE_CONTRATO_LABEL,
  STATUS_CONTRATO_LABEL,
  type ContratoOrganizacao,
  type ModalidadeContrato,
} from "@/types";
import { cn } from "@/lib/utils";

/**
 * Contrato da própria organização, visto pelo cliente.
 *
 * Ele enxerga o que contratou — vigência, veículos por modalidade, aditivos —
 * mas edita apenas contato: telefone e e-mail. Prazo, volume e valor mudam por
 * aditivo assinado, não por edição na tela, senão o registro deixa de
 * corresponder ao que foi acordado.
 *
 * Deixar o contrato visível resolve uma pergunta recorrente do suporte ("até
 * quando vai meu contrato?", "quantos veículos eu tenho direito?") sem abrir
 * chamado.
 */

const total = (c: ContratoOrganizacao) => Object.values(c.veiculosPorModalidade).reduce((a, v) => a + (v ?? 0), 0);
const termino = (c: ContratoOrganizacao) => c.terminoVigente ?? c.termino;
const dataBR = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString("pt-BR");
const diasPara = (iso: string) => Math.round((new Date(`${iso}T12:00`).getTime() - Date.now()) / 86_400_000);

export function ContratoDoCliente() {
  const { sessao } = useSessao();
  const { data, isPending } = useQuery(contratosOrgQuery());

  const [edicoes, setEdicoes] = useState<{ telefone?: string; email?: string } | null>(null);
  const [editando, setEditando] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  /**
   * O contrato da organização ativa. Super admin visualizando um cliente vê o
   * contrato daquele cliente, coerente com o resto do sistema.
   */
  const contrato = useMemo(() => {
    const alvo = sessao?.organizacaoAtivaId ?? sessao?.organizacaoId;
    const lista = data ?? [];
    return lista.find((c) => c.organizacaoId === alvo) ?? lista.find((c) => c.status === "ativo") ?? null;
  }, [data, sessao]);

  if (isPending) {
    return (
      <Card title="Seu contrato" icon={FileText}>
        <SkeletonRows rows={3} />
      </Card>
    );
  }

  if (!contrato) {
    return (
      <Card title="Seu contrato" icon={FileText} bodyClassName="p-4">
        <EmptyNote>Nenhum contrato vinculado a esta organização.</EmptyNote>
      </Card>
    );
  }

  const telefoneAtual = edicoes?.telefone ?? contrato.telefone;
  const emailAtual = edicoes?.email ?? contrato.email;
  const dias = diasPara(termino(contrato));
  const vencendo = contrato.status === "ativo" && dias <= 90;

  const abrirEdicao = () => {
    setTelefone(telefoneAtual);
    setEmail(emailAtual);
    setEditando(true);
  };

  const salvar = () => {
    const t = telefone.trim();
    const e = email.trim();
    if (!t || !e) {
      toast.error("Telefone e e-mail não podem ficar vazios.");
      return;
    }
    if (!e.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setEdicoes({ telefone: t, email: e });
    registrarAuditoria("contrato", `Contato do contrato ${contrato.numero} atualizado pelo cliente.`);
    toast.success("Contato atualizado.", { description: "A SS Telemática foi notificada da alteração." });
    setEditando(false);
  };

  return (
    <Card
      title="Seu contrato"
      icon={FileText}
      action={
        <span className="flex items-center gap-2">
          <span className="font-mono text-[12px] text-muted-foreground">{contrato.numero}</span>
          <Pill tone={contrato.status === "ativo" ? "green" : contrato.status === "suspenso" ? "gold" : "neutral"}>
            {STATUS_CONTRATO_LABEL[contrato.status]}
          </Pill>
        </span>
      }
      bodyClassName="p-4"
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Vigência. */}
        <div>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <CalendarClock className="h-3 w-3" />
            Vigência
          </h4>
          <p className="text-[13px] text-ink-soft">
            Desde <strong className="text-foreground">{dataBR(contrato.ativacao)}</strong>
          </p>
          <p className={cn("text-[13px]", vencendo ? "font-semibold text-coral" : "text-ink-soft")}>
            Até <strong className={vencendo ? "" : "text-foreground"}>{dataBR(termino(contrato))}</strong>
            {contrato.status === "ativo" && (
              <span className="ml-1.5 text-[12px]">
                ({dias > 0 ? `faltam ${dias} dias` : `vencido há ${Math.abs(dias)} dias`})
              </span>
            )}
          </p>
          {contrato.aditivos.length > 0 && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              {contrato.aditivos.length} aditivo{contrato.aditivos.length > 1 ? "s" : ""} — prazo já prorrogado
            </p>
          )}
        </div>

        {/* Veículos contratados. */}
        <div>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <Truck className="h-3 w-3" />
            Veículos contratados
          </h4>
          <p className="font-display text-[20px] font-bold leading-none text-foreground">{nf(total(contrato))}</p>
          <ul className="mt-1.5 space-y-0.5">
            {(Object.entries(contrato.veiculosPorModalidade) as [ModalidadeContrato, number][])
              .filter(([, v]) => v > 0)
              .map(([mod, v]) => (
                <li key={mod} className="text-[12px] text-muted-foreground">
                  {MODALIDADE_CONTRATO_LABEL[mod]}: <strong className="text-ink-soft">{v}</strong>
                </li>
              ))}
          </ul>
        </div>

        {/* Contato — a única parte editável. */}
        <div>
          <h4 className="mb-1.5 flex items-center justify-between gap-1.5 font-mono text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Mail className="h-3 w-3" />
              Contato da empresa
            </span>
            {!editando && (
              <button
                onClick={abrirEdicao}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-medium normal-case tracking-normal text-brand-navy hover:bg-secondary"
              >
                <Pencil className="h-3 w-3" />
                editar
              </button>
            )}
          </h4>

          {editando ? (
            <div className="space-y-2">
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="Telefone"
                className="h-8 w-full rounded-lg border border-border bg-white px-2.5 text-[13px] outline-none focus:border-accent"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && salvar()}
                placeholder="E-mail"
                className="h-8 w-full rounded-lg border border-border bg-white px-2.5 text-[13px] outline-none focus:border-accent"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={salvar}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-brand-navy text-[12px] font-semibold text-white"
                >
                  <Check className="h-3.5 w-3.5" />
                  Salvar
                </button>
                <button
                  onClick={() => setEditando(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-0.5 text-[13px]">
              <p className="flex items-center gap-1.5 text-ink-soft">
                <Phone className="h-3 w-3 text-muted-foreground" />
                {telefoneAtual}
              </p>
              <p className="flex items-center gap-1.5 truncate text-ink-soft" title={emailAtual}>
                <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                {emailAtual}
              </p>
              <p className="pt-1 text-[12px] text-muted-foreground">
                Responsável: {contrato.responsavelNome}
              </p>
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 border-t border-border pt-2.5 text-[12px] text-muted-foreground">
        Telefone e e-mail podem ser atualizados por aqui. Prazo, volume de veículos e escopo mudam por aditivo
        assinado — fale com seu contato comercial.
      </p>
    </Card>
  );
}
