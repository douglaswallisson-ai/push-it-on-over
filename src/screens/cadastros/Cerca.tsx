import { ModuloSemFonte } from "@/components/ss/ui/SeloDadosExemplo";
import { CircleDot, Hexagon, MapPin } from "lucide-react";
import { CadastroScaffold } from "@/components/ss/layout/CadastroScaffold";
import type { Campo } from "@/components/ss/cadastro/CrudSheet";
import { HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Dot, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";

/** Cadastro de cercas eletrônicas (geofences). Dados de exemplo. */

type Cerca = {
  nome: string;
  tipo: "Circular" | "Polígono";
  abrangencia: string;
  veiculos: number;
  status: "Ativa" | "Inativa";
};

const DADOS: Cerca[] = [
  { nome: "Pátio Matriz — SP", tipo: "Circular", abrangencia: "raio 300 m", veiculos: 48, status: "Ativa" },
  { nome: "Zona de risco — BR-116 Sul", tipo: "Polígono", abrangencia: "2,4 km²", veiculos: 22, status: "Ativa" },
  { nome: "Cliente ACME — Guarulhos", tipo: "Circular", abrangencia: "raio 150 m", veiculos: 6, status: "Ativa" },
  { nome: "Rota proibida — Centro", tipo: "Polígono", abrangencia: "0,8 km²", veiculos: 48, status: "Ativa" },
  { nome: "Filial RJ", tipo: "Circular", abrangencia: "raio 250 m", veiculos: 14, status: "Inativa" },
];

const COLS: Column<Cerca>[] = [
  {
    key: "nome",
    header: "Cerca",
    render: (c) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-tint">
          {c.tipo === "Circular" ? <CircleDot className="h-4 w-4 text-brand-navy" /> : <Hexagon className="h-4 w-4 text-brand-navy" />}
        </div>
        <span className="font-semibold text-foreground">{c.nome}</span>
      </div>
    ),
  },
  { key: "tipo", header: "Tipo", render: (c) => <Pill tone="sky">{c.tipo}</Pill> },
  { key: "abrangencia", header: "Abrangência", render: (c) => <span className="font-mono text-[12.5px]">{c.abrangencia}</span> },
  { key: "veiculos", header: "Veículos", align: "right" },
  {
    key: "status",
    header: "Status",
    align: "center",
    render: (c) => (
      <span className="inline-flex items-center gap-2 text-[13px]">
        <Dot tone={(c.status === "Ativa" ? "green" : "neutral") as PillTone} />
        {c.status}
      </span>
    ),
  },
];

const CAMPOS: Campo<Cerca>[] = [
  { nome: "nome", label: "Nome da cerca", tipo: "texto", obrigatorio: true, full: true, placeholder: "Ex.: Pátio Matriz — SP" },
  { nome: "tipo", label: "Tipo", tipo: "select", obrigatorio: true, opcoes: ["Circular", "Polígono"] },
  { nome: "abrangencia", label: "Abrangência", tipo: "texto", placeholder: "raio 300 m", hint: "Raio para circular, área para polígono." },
  { nome: "veiculos", label: "Veículos abrangidos", tipo: "numero" },
  { nome: "status", label: "Status", tipo: "select", obrigatorio: true, opcoes: ["Ativa", "Inativa"] },
];

const NOVO: Partial<Cerca> = { tipo: "Circular", status: "Ativa", veiculos: 0, abrangencia: "" };

function CercaExemplo() {
  return (
    <CadastroScaffold<Cerca>
      title="Cercas eletrônicas"
      subtitle="Cadastros › Cerca"
      newLabel="Nova cerca"
      eyebrow="Cadastros · Cerca eletrônica"
      heroTitle="12 cercas monitorando a operação"
      heroSubtitle="Perímetros que disparam alerta na entrada, saída ou permanência indevida."
      heroMetrics={
        <>
          <HeroMetric value="10" label="Cercas ativas" />
          <div className="h-10 w-px bg-white/15" />
          <HeroMetric value="48" label="Veículos vinculados" />
        </>
      }
      stats={
        <>
          <StatTile icon={MapPin} label="Total de cercas" value="12" color="var(--brand-navy)" />
          <StatTile icon={CircleDot} label="Ativas" value="10" color="var(--leaf)" />
          <StatTile icon={CircleDot} label="Circulares" value="7" color="var(--brand-sky)" />
          <StatTile icon={Hexagon} label="Polígonos" value="5" color="var(--gold)" />
        </>
      }
      cardTitle="Cercas cadastradas"
      cardIcon={MapPin}
      columns={COLS}
      rows={DADOS}
      campos={CAMPOS}
      novoPadrao={NOVO}
      rotulo="Cerca"
    />
  );
}

/** Protótipo: com API ligada, aviso no lugar dos números escritos no código. */
export default function Cerca() {
  return (
    <ModuloSemFonte titulo="Cercas" motivo="O backend novo não tem rota de cercas. O cadastro continua no sistema atual.">
      <CercaExemplo />
    </ModuloSemFonte>
  );
}
