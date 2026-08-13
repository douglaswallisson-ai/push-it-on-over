import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Gauge,
  MapPin,
  Plus,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, type Column, type PillTone } from "@/components/ss/ui/data";
import { Field, FormActions, FormSection, Input, Select, Toggle } from "@/components/ss/ui/form";
import { VeiculoPicker } from "@/components/ss/cadastro/VeiculoPicker";
import { CrudSheet, type Campo } from "@/components/ss/cadastro/CrudSheet";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { alarmesQuery, nf } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { Alarme, Severidade } from "@/types";

/**
 * Cadastro de alarme — regra de disparo + canais de notificação. A lista de
 * alarmes configurados vem da API (`GET /api/alarmes`). O formulário ainda é
 * protótipo (sem persistência).
 */

const SEV_TONE: Record<Severidade, PillTone> = {
  critico: "coral",
  atencao: "gold",
  operacional: "sky",
  ok: "green",
};

const SEV_LABEL: Record<Severidade, string> = {
  critico: "Crítico",
  atencao: "Atenção",
  operacional: "Operacional",
  ok: "Normal",
};

const TIPO_LABEL: Record<string, string> = {
  velocidade: "Velocidade",
  cerca: "Cerca",
  ociosidade: "Ociosidade",
  panico: "Pânico",
  combustivel: "Combustível",
};

const TIPOS = [
  { icon: Gauge, label: "Velocidade" },
  { icon: MapPin, label: "Cerca eletrônica" },
  { icon: Zap, label: "Ociosidade" },
  { icon: ShieldAlert, label: "Pânico" },
];

const COLS: Column<Alarme>[] = [
  { key: "nome", header: "Alarme", render: (a) => <span className="font-semibold text-foreground">{a.nome}</span> },
  { key: "tipo", header: "Tipo", render: (a) => <Pill tone="sky">{TIPO_LABEL[a.tipo] ?? a.tipo}</Pill> },
  { key: "condicao", header: "Condição", render: (a) => <span className="font-mono text-[12.5px]">{a.condicao}</span> },
  {
    key: "severidade",
    header: "Severidade",
    align: "center",
    render: (a) => <Pill tone={SEV_TONE[a.severidade] ?? "neutral"}>{SEV_LABEL[a.severidade] ?? a.severidade}</Pill>,
  },
  { key: "canais", header: "Canais", render: (a) => <span>{a.canais?.length ? a.canais.join(", ") : "—"}</span> },
  {
    key: "ativo",
    header: "Status",
    align: "center",
    render: (a) => <Pill tone={a.ativo ? "green" : "neutral"}>{a.ativo ? "Ativo" : "Inativo"}</Pill>,
  },
  {
    key: "veiculos",
    header: "Abrangência",
    render: (a) =>
      a.veiculos?.length ? (
        <span className="whitespace-nowrap font-mono text-[12px] text-ink-soft" title={a.veiculos.join(", ")}>
          {a.veiculos.length} veículo{a.veiculos.length > 1 ? "s" : ""}
        </span>
      ) : (
        <span className="text-[12.5px] text-muted-foreground">Toda a frota</span>
      ),
  },
];

export default function CadastroAlarme() {
  const [escopo, setEscopo] = useState("Toda a frota");
  const [placas, setPlacas] = useState<string[]>([]);
  const [editando, setEditando] = useState<Alarme | null>(null);
  const [locais, setLocais] = useState<Alarme[] | null>(null);
  const { data, isPending, error, refetch } = useQuery(alarmesQuery());
  const alarmes = locais ?? data ?? [];
  const [tipo, setTipo] = useState("Velocidade");
  const [notifApp, setNotifApp] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSms, setNotifSms] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Protótipo: sem persistência.
  }

  return (
    <>
      <PageHeader title="Cadastro de alarme" subtitle="Cadastros › Alarme" />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="border-b border-border bg-secondary/40 px-6 py-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <Bell className="h-4 w-4 text-brand-navy" />
              Nova regra de alarme
            </h2>
          </div>

          <div className="px-6">
            <FormSection title="Tipo de alarme" description="O que dispara o alerta. Cada tipo abre condições diferentes.">
              <div className="sm:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TIPOS.map((t) => {
                  const on = tipo === t.label;
                  return (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setTipo(t.label)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                        on
                          ? "border-brand-navy bg-navy-tint text-brand-navy shadow-card"
                          : "border-border bg-white text-muted-foreground hover:border-[#c7d2df]",
                      )}
                    >
                      <t.icon className="h-5 w-5" />
                      <span className="text-[12.5px] font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </FormSection>

            <FormSection title="Regra" description="Nome, condição de disparo e a que veículos se aplica.">
              <Field label="Nome do alarme" full>
                <Input placeholder="Ex.: Excesso de velocidade em rodovia" required />
              </Field>
              <Field label="Condição">
                <Select defaultValue="maior">
                  <option value="maior">Velocidade acima de</option>
                  <option value="menor">Velocidade abaixo de</option>
                </Select>
              </Field>
              <Field label="Limite (km/h)">
                <Input type="number" placeholder="90" inputMode="numeric" />
              </Field>
              <Field label="Persistência" hint="Tempo mínimo na condição antes de disparar.">
                <Select defaultValue="30">
                  <option value="0">Imediato</option>
                  <option value="30">30 segundos</option>
                  <option value="60">1 minuto</option>
                  <option value="300">5 minutos</option>
                </Select>
              </Field>
              <Field label="Aplicar a">
                <Select value={escopo} onChange={(e) => setEscopo(e.target.value)}>
                  <option>Toda a frota</option>
                  <option>Grupo: Refrigerado</option>
                  <option>Grupo: Seco</option>
                  <option>Grupo: Urbano</option>
                  <option>Veículos específicos</option>
                </Select>
              </Field>

              {/* A opção "veículos específicos" abre a busca de placas: antes ela
                  existia no select e não levava a lugar nenhum. */}
              {escopo === "Veículos específicos" && (
                <Field
                  label="Veículos do alarme"
                  full
                  hint="Busque por placa ou modelo. Um alarme pode cobrir quantos veículos forem necessários."
                >
                  <VeiculoPicker selecionadas={placas} onChange={setPlacas} />
                </Field>
              )}
            </FormSection>

            <FormSection title="Severidade e notificação" description="Peso do alarme e por onde a equipe é avisada.">
              <Field label="Severidade">
                <Select defaultValue="critico">
                  <option value="critico">Crítico</option>
                  <option value="atencao">Atenção</option>
                  <option value="info">Informativo</option>
                </Select>
              </Field>
              <Field label="Reincidência" hint="Reenvia se o evento se repetir na janela.">
                <Select defaultValue="15">
                  <option value="0">Não reenviar</option>
                  <option value="15">A cada 15 min</option>
                  <option value="60">A cada 1 h</option>
                </Select>
              </Field>
              <div className="sm:col-span-2 space-y-3.5 pt-1">
                <Toggle checked={notifApp} onChange={setNotifApp} label="Notificar no app / painel" />
                <Toggle checked={notifEmail} onChange={setNotifEmail} label="Enviar por e-mail" />
                <Toggle checked={notifSms} onChange={setNotifSms} label="Enviar por SMS" />
              </div>
            </FormSection>
          </div>

          <FormActions>
            <button
              type="button"
              className="rounded-full border border-border bg-white px-5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              Criar alarme
            </button>
          </FormActions>
        </form>

        {error ? (
          <ErrorBox error={error} onRetry={() => refetch()} />
        ) : (
          <Card
            title="Alarmes configurados"
            icon={AlertTriangle}
            action={<Pill tone="sky">{isPending ? "carregando…" : `${nf(alarmes.length)} regras`}</Pill>}
            bodyClassName="p-4"
          >
            {isPending ? (
              <SkeletonRows rows={5} />
            ) : alarmes.length ? (
              <DataTable
                columns={COLS}
                rows={alarmes}
                onRowClick={(a) => setEditando(a as Alarme)}
              />
            ) : (
              <EmptyNote>Nenhum alarme configurado retornado pela API.</EmptyNote>
            )}
          </Card>
        )}

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Clique em qualquer alarme da lista para editar, inclusive os veículos aos quais ele se aplica.
        </p>
      </div>

      <CrudSheet<Alarme>
        aberto={Boolean(editando)}
        onFechar={() => setEditando(null)}
        titulo="Editar alarme"
        campos={CAMPOS_ALARME}
        valor={editando ?? {}}
        editando={editando}
        onSalvar={(v) => {
          setLocais(alarmes.map((a) => (a === editando ? ({ ...a, ...v } as Alarme) : a)));
          setEditando(null);
        }}
        onExcluir={(a) => {
          setLocais(alarmes.filter((x) => x !== a));
          setEditando(null);
        }}
      />
    </>
  );
}

/**
 * Campos do alarme já cadastrado. "Veículos" usa o mesmo seletor com busca do
 * formulário de criação — editar a abrangência era impossível antes.
 */
const CAMPOS_ALARME: Campo<Alarme>[] = [
  { nome: "nome", label: "Nome do alarme", tipo: "texto", obrigatorio: true, full: true },
  { nome: "tipo", label: "Tipo", tipo: "select", obrigatorio: true, opcoes: ["velocidade", "cerca", "ociosidade", "panico", "combustivel"] },
  { nome: "severidade", label: "Severidade", tipo: "select", obrigatorio: true, opcoes: ["critico", "atencao", "operacional", "ok"] },
  { nome: "condicao", label: "Condição de disparo", tipo: "texto", full: true, placeholder: "> 90 km/h por 30s" },
  { nome: "veiculos", label: "Aplicar aos veículos", tipo: "veiculos", hint: "Vazio significa toda a frota." },
  { nome: "ativo", label: "Alarme ativo", tipo: "toggle" },
];
