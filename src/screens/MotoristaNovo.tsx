import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { ArrowLeft, Check } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner } from "@/components/ss/ui/HeroBanner";
import { Field, FormActions, FormSection, Input, Select, Toggle } from "@/components/ss/ui/form";
import { BulkImport, ModoTabs, OcrPanel, type OcrField } from "@/components/ss/cadastro/importers";
import { acrescentar, registrarAuditoria } from "@/lib/session";
import { toast } from "sonner";

/**
 * Cadastro de motorista em três modos: manual, OCR da CNH (preenche o form) e
 * importação em massa por planilha. Protótipo: sem persistência.
 */

const CNH_OCR: OcrField[] = [
  { key: "nome", label: "Nome", value: "João Pereira da Silva" },
  { key: "cpf", label: "CPF", value: "123.456.789-00" },
  { key: "nascimento", label: "Nascimento", value: "1985-03-22" },
  { key: "cnh", label: "Nº da CNH", value: "04567890123" },
  { key: "categoria", label: "Categoria", value: "E" },
  { key: "validade", label: "Validade da CNH", value: "2028-05-14" },
];

const BULK_COLUMNS = ["Nome", "CPF", "CNH", "Categoria", "Validade", "Filial", "Grupo"];
const BULK_SAMPLE = [
  ["Marco Taborda", "111.222.333-44", "04567890123", "E", "2028-05-14", "Matriz SP", "Refrigerado"],
  ["Rosemeri Tuono", "222.333.444-55", "05678901234", "D", "2027-11-02", "Filial RJ", "Seco"],
  ["Vitor Duarte", "333.444.555-66", "06789012345", "E", "2029-03-20", "Matriz SP", "Frigorífico"],
];

const empty = {
  nome: "",
  cpf: "",
  nascimento: "",
  telefone: "",
  email: "",
  cnh: "",
  categoria: "E",
  validade: "",
  rg: "",
  filial: "Matriz SP",
  grupo: "Refrigerado",
  ibutton: "",
  admissao: "",
};

export default function MotoristaNovo() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("manual");
  const [form, setForm] = useState({ ...empty });
  const [prefilled, setPrefilled] = useState(false);
  const [appAccess, setAppAccess] = useState(true);
  const [premiacao, setPremiacao] = useState(true);

  const upd =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  /**
   * Grava o motorista antes de navegar. Antes o submit só trocava de tela e
   * tudo que foi digitado era perdido sem aviso.
   */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.error("Informe o nome do motorista.");
      return;
    }
    acrescentar("motoristas", { ...form, id: `m${Date.now()}`, criadoEm: new Date().toISOString() });
    registrarAuditoria("criacao", `Motorista cadastrado: ${form.nome}.`);
    toast.success(`Motorista ${form.nome} cadastrado.`, {
      description: form.validade ? undefined : "CNH sem validade informada — não haverá alerta de vencimento.",
    });
    navigate("/app/motoristas");
  }

  return (
    <>
      <PageHeader
        title="Novo motorista"
        subtitle="Cadastros › Motoristas › Novo"
        actions={
          <button
            onClick={() => navigate("/app/motoristas")}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-[15px] w-[15px]" />
            Voltar
          </button>
        }
      />

      <div className="mx-auto max-w-[1100px] space-y-5 px-6 py-6 md:px-8">
        <HeroBanner
          orb
          eyebrow="Cadastros · Motorista"
          title="Cadastrar motorista"
          subtitle="Preencha à mão, envie a CNH para leitura automática ou importe vários de uma vez."
        />

        <ModoTabs value={mode} onChange={setMode} />

        {mode === "ocr" && (
          <OcrPanel
            docLabel="CNH"
            hint="Foto ou PDF da CNH (frente)"
            sample={CNH_OCR}
            onUse={(data) => {
              setForm((f) => ({ ...f, ...data }));
              setPrefilled(true);
              setMode("manual");
            }}
          />
        )}

        {mode === "bulk" && (
          <BulkImport
            entityPlural="motoristas"
            columns={BULK_COLUMNS}
            sampleRows={BULK_SAMPLE}
            onImport={() => navigate("/app/motoristas")}
          />
        )}

        {mode === "manual" && (
          <form onSubmit={handleSubmit}>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              {prefilled && (
                <div className="flex items-center gap-2 border-b border-leaf-line bg-leaf-tint/50 px-6 py-3 text-[13px] font-medium text-leaf">
                  <Check className="h-4 w-4" />
                  Campos preenchidos pela CNH — confira e complete o que faltar.
                </div>
              )}
              <div className="px-6">
                <FormSection title="Identificação" description="Dados pessoais básicos do motorista.">
                  <Field label="Nome completo" full>
                    <Input placeholder="Ex.: Marco Taborda" value={form.nome} onChange={upd("nome")} required />
                  </Field>
                  <Field label="CPF">
                    <Input placeholder="000.000.000-00" inputMode="numeric" value={form.cpf} onChange={upd("cpf")} />
                  </Field>
                  <Field label="Data de nascimento">
                    <Input type="date" value={form.nascimento} onChange={upd("nascimento")} />
                  </Field>
                  <Field label="Telefone">
                    <Input placeholder="(00) 00000-0000" inputMode="tel" value={form.telefone} onChange={upd("telefone")} />
                  </Field>
                  <Field label="E-mail">
                    <Input type="email" placeholder="motorista@empresa.com.br" value={form.email} onChange={upd("email")} />
                  </Field>
                </FormSection>

                <FormSection title="Habilitação" description="Categoria e validade da CNH — usados nos alertas de vencimento.">
                  <Field label="Nº da CNH">
                    <Input placeholder="00000000000" inputMode="numeric" value={form.cnh} onChange={upd("cnh")} />
                  </Field>
                  <Field label="Categoria">
                    <Select value={form.categoria} onChange={upd("categoria")}>
                      <option>A</option>
                      <option>B</option>
                      <option>C</option>
                      <option>D</option>
                      <option>E</option>
                    </Select>
                  </Field>
                  <Field label="Validade da CNH">
                    <Input type="date" value={form.validade} onChange={upd("validade")} />
                  </Field>
                  <Field label="Nº do RG / registro">
                    <Input placeholder="Opcional" value={form.rg} onChange={upd("rg")} />
                  </Field>
                </FormSection>

                <FormSection title="Vínculo operacional" description="Onde o motorista atua e como é identificado na frota.">
                  <Field label="Filial">
                    <Select value={form.filial} onChange={upd("filial")}>
                      <option>Matriz SP</option>
                      <option>Filial RJ</option>
                      <option>Filial PR</option>
                    </Select>
                  </Field>
                  <Field label="Grupo / operação">
                    <Select value={form.grupo} onChange={upd("grupo")}>
                      <option>Refrigerado</option>
                      <option>Seco</option>
                      <option>Frigorífico</option>
                    </Select>
                  </Field>
                  <Field label="Código iButton / identificador" hint="Chave física usada para login no veículo.">
                    <Input placeholder="Ex.: 1A2B3C4D" value={form.ibutton} onChange={upd("ibutton")} />
                  </Field>
                  <Field label="Data de admissão">
                    <Input type="date" value={form.admissao} onChange={upd("admissao")} />
                  </Field>
                </FormSection>

                <FormSection title="Telemetria e premiação" description="Recursos que o motorista terá acesso na plataforma.">
                  <div className="space-y-3.5 pt-1 sm:col-span-2">
                    <Toggle checked={appAccess} onChange={setAppAccess} label="Acesso ao app do motorista (copiloto)" />
                    <Toggle checked={premiacao} onChange={setPremiacao} label="Participa do programa de premiação" />
                  </div>
                </FormSection>
              </div>

              <FormActions>
                <button
                  type="button"
                  onClick={() => navigate("/app/motoristas")}
                  className="rounded-full border border-border bg-white px-5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-brand-navy px-6 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
                >
                  Salvar motorista
                </button>
              </FormActions>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
