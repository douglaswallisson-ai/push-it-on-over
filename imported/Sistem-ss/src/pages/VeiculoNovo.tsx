import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { HeroBanner } from "@/components/ui/HeroBanner";
import { Field, FormActions, FormSection, Input, Select } from "@/components/ui/form";
import { BulkImport, ModoTabs, OcrPanel, type OcrField } from "@/components/cadastro/importers";

/**
 * Cadastro de veículo em três modos: manual, OCR do CRLV (documento do veículo)
 * e importação em massa por planilha. Protótipo: sem persistência.
 */

const CRLV_OCR: OcrField[] = [
  { key: "placa", label: "Placa", value: "RTA-4H21" },
  { key: "renavam", label: "Renavam", value: "01234567890" },
  { key: "chassi", label: "Chassi", value: "9BWHE21JX24060831" },
  { key: "marca", label: "Marca", value: "Volvo" },
  { key: "modelo", label: "Modelo", value: "FH 460" },
  { key: "ano", label: "Ano", value: "2022" },
  { key: "cor", label: "Cor", value: "Branca" },
];

const BULK_COLUMNS = ["Placa", "Renavam", "Chassi", "Marca", "Modelo", "Ano", "Operacao", "Grupo", "Unidade"];
const BULK_SAMPLE = [
  ["BCA7A56", "01234567890", "9BWHE21JX24060831", "Volvo", "FH 460", "2022", "Refrigerado", "Refrigerado", "Matriz SP"],
  ["TPA1106", "02345678901", "XLRTE47MS0E123456", "DAF", "XF 105", "2020", "Refrigerado", "Refrigerado", "Filial PR"],
  ["SXD1J61", "03456789012", "9BSR6X400M3901234", "Scania", "R 450", "2021", "Seco", "Seco", "Matriz SP"],
];

const empty = {
  placa: "",
  renavam: "",
  chassi: "",
  cor: "",
  marca: "",
  modelo: "",
  ano: "",
  operacao: "Refrigerado",
  grupo: "Refrigerado",
  unidade: "Matriz SP",
  dispositivo: "",
};

export default function VeiculoNovo() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("manual");
  const [form, setForm] = useState({ ...empty });
  const [prefilled, setPrefilled] = useState(false);

  const upd =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate("/app/veiculos");
  }

  return (
    <>
      <PageHeader
        title="Novo veículo"
        subtitle="Frota › Veículos › Novo"
        actions={
          <button
            onClick={() => navigate("/app/veiculos")}
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
          eyebrow="Cadastros · Veículo"
          title="Cadastrar veículo"
          subtitle="Preencha à mão, envie o CRLV para leitura automática ou importe vários de uma vez."
        />

        <ModoTabs value={mode} onChange={setMode} />

        {mode === "ocr" && (
          <OcrPanel
            docLabel="CRLV"
            hint="Foto ou PDF do documento do veículo (CRLV)"
            sample={CRLV_OCR}
            onUse={(data) => {
              setForm((f) => ({ ...f, ...data }));
              setPrefilled(true);
              setMode("manual");
            }}
          />
        )}

        {mode === "bulk" && (
          <BulkImport
            entityPlural="veiculos"
            columns={BULK_COLUMNS}
            sampleRows={BULK_SAMPLE}
            onImport={() => navigate("/app/veiculos")}
          />
        )}

        {mode === "manual" && (
          <form onSubmit={handleSubmit}>
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
              {prefilled && (
                <div className="flex items-center gap-2 border-b border-leaf-line bg-leaf-tint/50 px-6 py-3 text-[13px] font-medium text-leaf">
                  <Check className="h-4 w-4" />
                  Campos preenchidos pelo CRLV — confira e complete o que faltar.
                </div>
              )}
              <div className="px-6">
                <FormSection title="Identificação" description="Documento e identificação do veículo.">
                  <Field label="Placa">
                    <Input placeholder="AAA-0A00" value={form.placa} onChange={upd("placa")} required />
                  </Field>
                  <Field label="Renavam">
                    <Input placeholder="00000000000" inputMode="numeric" value={form.renavam} onChange={upd("renavam")} />
                  </Field>
                  <Field label="Chassi" full>
                    <Input placeholder="17 caracteres" value={form.chassi} onChange={upd("chassi")} />
                  </Field>
                  <Field label="Cor">
                    <Input placeholder="Ex.: Branca" value={form.cor} onChange={upd("cor")} />
                  </Field>
                </FormSection>

                <FormSection title="Modelo" description="Marca, modelo e ano — usados nos parâmetros de consumo e manutenção.">
                  <Field label="Marca">
                    <Input placeholder="Ex.: Volvo" value={form.marca} onChange={upd("marca")} />
                  </Field>
                  <Field label="Modelo">
                    <Input placeholder="Ex.: FH 460" value={form.modelo} onChange={upd("modelo")} />
                  </Field>
                  <Field label="Ano">
                    <Input placeholder="2022" inputMode="numeric" value={form.ano} onChange={upd("ano")} />
                  </Field>
                </FormSection>

                <FormSection title="Vínculo operacional" description="Como o veículo se organiza na frota e qual rastreador o equipa.">
                  <Field label="Operação">
                    <Select value={form.operacao} onChange={upd("operacao")}>
                      <option>Refrigerado</option>
                      <option>Seco</option>
                      <option>Frigorífico</option>
                      <option>Passageiros</option>
                    </Select>
                  </Field>
                  <Field label="Grupo">
                    <Select value={form.grupo} onChange={upd("grupo")}>
                      <option>Refrigerado</option>
                      <option>Seco</option>
                      <option>Frigorífico</option>
                      <option>Urbano</option>
                    </Select>
                  </Field>
                  <Field label="Unidade">
                    <Select value={form.unidade} onChange={upd("unidade")}>
                      <option>Matriz SP</option>
                      <option>Filial RJ</option>
                      <option>Filial PR</option>
                      <option>Filial BA</option>
                    </Select>
                  </Field>
                  <Field label="Dispositivo (rastreador)" hint="Serial do rastreador a vincular.">
                    <Input placeholder="Ex.: 864329051" value={form.dispositivo} onChange={upd("dispositivo")} />
                  </Field>
                </FormSection>
              </div>

              <FormActions>
                <button
                  type="button"
                  onClick={() => navigate("/app/veiculos")}
                  className="rounded-full border border-border bg-white px-5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-brand-navy px-6 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
                >
                  Salvar veículo
                </button>
              </FormActions>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
