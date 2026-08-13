import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { ArrowLeft, ArrowRight, Bus, MapPin } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { acrescentar } from "@/lib/session";
import { toast } from "sonner";
import { Card, Pill } from "@/components/ss/ui/data";
import { Field, FormActions, Input, Select, Textarea } from "@/components/ss/ui/form";
import { SeatMap, SeatLegend } from "@/components/ss/fretamento/SeatMap";

/**
 * Cadastro de viagem de fretamento — rota, agenda, recurso (veículo + motorista)
 * e reserva de assentos. Protótipo sem persistência; ao salvar volta à lista.
 */

const OCUPADOS = new Set([3, 4, 7, 12]);

export default function CadastroViagem() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<number>>(new Set([9, 10]));

  const toggle = (n: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  /** Grava a viagem com os assentos escolhidos antes de navegar. */
  const [servico, setServico] = useState("Fretamento contínuo");
  const [veiculo, setVeiculo] = useState("Ônibus Executivo — PLA-1A23 (44 lug.)");
  const [motorista, setMotorista] = useState("Marco Taborda");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) {
      toast.error("Selecione ao menos um assento para a viagem.");
      return;
    }
    acrescentar("viagens", {
      id: `t${Date.now()}`,
      servico,
      veiculo,
      motorista,
      assentos: [...selected],
      criadoEm: new Date().toISOString(),
    });
    toast.success(`Viagem criada com ${selected.size} assento${selected.size > 1 ? "s" : ""}.`);
    navigate("/app/fretamento/viagens");
  }

  return (
    <>
      <PageHeader
        title="Nova viagem"
        subtitle="Fretamento › Viagens › Nova"
        actions={
          <button
            onClick={() => navigate("/app/fretamento/viagens")}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-[15px] w-[15px]" />
            Voltar
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="mx-auto max-w-[1360px] px-6 py-6 md:px-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <Card title="Rota" icon={MapPin}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Origem" full>
                  <Input placeholder="Ex.: São Paulo — Terminal Tietê" required />
                </Field>
                <Field label="Destino" full>
                  <Input placeholder="Ex.: Curitiba — Rodoferroviária" required />
                </Field>
                <Field label="Tipo de serviço">
                  <Select value={servico} onChange={(e) => setServico(e.target.value)}>
                    <option>Fretamento contínuo</option>
                    <option>Fretamento eventual</option>
                    <option>Turismo</option>
                  </Select>
                </Field>
                <Field label="Cliente / contratante">
                  <Input placeholder="Empresa ou grupo" />
                </Field>
                <Field label="Observações" full>
                  <Textarea placeholder="Paradas, restrições, contato no destino…" />
                </Field>
              </div>
            </Card>

            <Card title="Agenda e recurso" icon={Bus}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data de saída">
                  <Input type="date" required />
                </Field>
                <Field label="Horário de saída">
                  <Input type="time" required />
                </Field>
                <Field label="Data de retorno">
                  <Input type="date" />
                </Field>
                <Field label="Horário de retorno">
                  <Input type="time" />
                </Field>
                <Field label="Veículo">
                  <Select value={veiculo} onChange={(e) => setVeiculo(e.target.value)}>
                    <option>Ônibus Executivo — PLA-1A23 (44 lug.)</option>
                    <option>Ônibus Leito — PLA-2B45 (36 lug.)</option>
                    <option>Micro-ônibus — PLA-3C67 (24 lug.)</option>
                  </Select>
                </Field>
                <Field label="Motorista">
                  <Select value={motorista} onChange={(e) => setMotorista(e.target.value)}>
                    <option>Marco Taborda</option>
                    <option>Rosemeri Tuono</option>
                    <option>Vitor Duarte</option>
                  </Select>
                </Field>
              </div>
            </Card>
          </div>

          {/* Reserva de assentos. */}
          <Card
            title="Reserva de assentos"
            icon={Bus}
            action={<Pill tone="sky">{selected.size} reservados</Pill>}
          >
            <div className="flex flex-col items-center gap-5">
              <SeatMap rows={11} occupied={OCUPADOS} selected={selected} onToggle={toggle} />
              <SeatLegend />
              {selected.size > 0 && (
                <div className="w-full rounded-lg bg-navy-tint p-3 text-center text-[13px] text-brand-navy">
                  Assentos: <span className="font-mono">{[...selected].sort((a, b) => a - b).join(", ")}</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        <FormActions>
          <button
            type="button"
            onClick={() => navigate("/app/fretamento/viagens")}
            className="rounded-full border border-border bg-white px-5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            Salvar viagem
            <ArrowRight className="h-4 w-4" />
          </button>
        </FormActions>
      </form>
    </>
  );
}
