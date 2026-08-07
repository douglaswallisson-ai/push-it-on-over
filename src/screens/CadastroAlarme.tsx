import { useState } from "react";
import {
  AlertTriangle,
  Bell,
  Gauge,
  MapPin,
  Plus,
  ShieldAlert,
  Truck,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, type Column, type PillTone } from "@/components/ss/ui/data";
import { Field, FormActions, FormSection, Input, Select, Toggle } from "@/components/ss/ui/form";
import { cn } from "@/lib/utils";

/**
 * Cadastro de alarme — regra de disparo + canais de notificação, com a lista
 * dos alarmes já configurados. Protótipo: sem persistência. Dados de exemplo.
 */

type Alarme = {
  nome: string;
  tipo: string;
  condicao: string;
  severidade: PillTone;
  severidadeLabel: string;
  canais: string;
  ativo: boolean;
};

const ALARMES: Alarme[] = [
  { nome: "Excesso de velocidade", tipo: "Velocidade", condicao: "> 90 km/h por 30s", severidade: "coral", severidadeLabel: "Crítico", canais: "App, E-mail", ativo: true },
  { nome: "Cerca violada — Pátio", tipo: "Cerca", condicao: "Saída fora de janela", severidade: "coral", severidadeLabel: "Crítico", canais: "App, SMS", ativo: true },
  { nome: "Motor ligado parado", tipo: "Ociosidade", condicao: "> 15 min parado", severidade: "gold", severidadeLabel: "Atenção", canais: "App", ativo: true },
  { nome: "Pane seca iminente", tipo: "Combustível", condicao: "Nível < 8%", severidade: "gold", severidadeLabel: "Atenção", canais: "App, E-mail", ativo: false },
];

const TIPOS = [
  { icon: Gauge, label: "Velocidade" },
  { icon: MapPin, label: "Cerca eletrônica" },
  { icon: Zap, label: "Ociosidade" },
  { icon: ShieldAlert, label: "Pânico" },
];

const COLS: Column<Alarme>[] = [
  { key: "nome", header: "Alarme", render: (a) => <span className="font-semibold text-foreground">{a.nome}</span> },
  { key: "tipo", header: "Tipo", render: (a) => <Pill tone="sky">{a.tipo}</Pill> },
  { key: "condicao", header: "Condição", render: (a) => <span className="font-mono text-[12.5px]">{a.condicao}</span> },
  { key: "severidade", header: "Severidade", align: "center", render: (a) => <Pill tone={a.severidade}>{a.severidadeLabel}</Pill> },
  { key: "canais", header: "Canais" },
  {
    key: "ativo",
    header: "Status",
    align: "center",
    render: (a) => <Pill tone={a.ativo ? "green" : "neutral"}>{a.ativo ? "Ativo" : "Inativo"}</Pill>,
  },
];

export default function CadastroAlarme() {
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
                <Select>
                  <option>Toda a frota</option>
                  <option>Grupo: Refrigerado</option>
                  <option>Grupo: Seco</option>
                  <option>Veículo específico</option>
                </Select>
              </Field>
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

        <Card title="Alarmes configurados" icon={AlertTriangle} action={<Pill tone="sky">{ALARMES.length} regras</Pill>} bodyClassName="p-4">
          <DataTable columns={COLS} rows={ALARMES} />
        </Card>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Dados de exemplo — protótipo de interface, sem dados reais.
        </p>
      </div>
    </>
  );
}
