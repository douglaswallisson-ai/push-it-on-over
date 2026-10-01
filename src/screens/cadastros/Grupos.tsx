import { ModuloSemFonte } from "@/components/ss/ui/SeloDadosExemplo";
import { Layers, Truck, Users } from "lucide-react";
import { CadastroScaffold } from "@/components/ss/layout/CadastroScaffold";
import type { Campo } from "@/components/ss/cadastro/CrudSheet";
import { HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Pill, StatTile, type Column } from "@/components/ss/ui/data";

/** Cadastro de grupos de veículos. Dados de exemplo. */

type Grupo = {
  nome: string;
  cor: string;
  veiculos: number;
  responsavel: string;
  operacao: string;
};

const DADOS: Grupo[] = [
  { nome: "Refrigerado", cor: "var(--brand-sky)", veiculos: 18, responsavel: "Marco Taborda", operacao: "Longa distância" },
  { nome: "Seco", cor: "var(--gold)", veiculos: 12, responsavel: "Rosemeri Tuono", operacao: "Regional" },
  { nome: "Frigorífico", cor: "var(--brand-navy)", veiculos: 6, responsavel: "Vitor Duarte", operacao: "Longa distância" },
  { nome: "Urbano", cor: "var(--leaf)", veiculos: 8, responsavel: "Najla Maltaca", operacao: "Cidade" },
  { nome: "Fretamento", cor: "var(--coral)", veiculos: 3, responsavel: "Juliana Dubiela", operacao: "Passageiros" },
  { nome: "Reserva", cor: "var(--muted-foreground)", veiculos: 1, responsavel: "—", operacao: "Backup" },
];

const COLS: Column<Grupo>[] = [
  {
    key: "nome",
    header: "Grupo",
    render: (g) => (
      <div className="flex items-center gap-3">
        <span className="inline-block h-3 w-3 rounded-full" style={{ background: g.cor }} />
        <span className="font-semibold text-foreground">{g.nome}</span>
      </div>
    ),
  },
  { key: "veiculos", header: "Veículos", align: "right", render: (g) => <span className="font-mono font-semibold">{g.veiculos}</span> },
  { key: "operacao", header: "Operação", render: (g) => <Pill tone="sky">{g.operacao}</Pill> },
  { key: "responsavel", header: "Responsável" },
];

const CAMPOS: Campo<Grupo>[] = [
  { nome: "nome", label: "Nome do grupo", tipo: "texto", obrigatorio: true, full: true, placeholder: "Ex.: Refrigerado" },
  { nome: "operacao", label: "Operação", tipo: "select", obrigatorio: true, opcoes: ["Longa distância", "Regional", "Cidade", "Passageiros", "Backup"] },
  { nome: "responsavel", label: "Responsável", tipo: "texto" },
  { nome: "veiculos", label: "Veículos no grupo", tipo: "numero" },
  { nome: "cor", label: "Cor de identificação", tipo: "cor", hint: "Usada nos gráficos e no mapa." },
];

const NOVO: Partial<Grupo> = { cor: "#1B3A6B", veiculos: 0, operacao: "Regional", responsavel: "" };

function GruposExemplo() {
  return (
    <CadastroScaffold<Grupo>
      title="Grupos"
      subtitle="Cadastros › Grupos"
      newLabel="Novo grupo"
      eyebrow="Cadastros · Grupos"
      heroTitle="Grupos de veículos"
      heroSubtitle="Organize a frota por operação — os grupos alimentam filtros, metas e relatórios."
      heroMetrics={
        <>
          <HeroMetric value="6" label="Grupos" />
          <div className="h-10 w-px bg-white/15" />
          <HeroMetric value="48" label="Veículos organizados" />
        </>
      }
      stats={
        <>
          <StatTile icon={Layers} label="Grupos" value="6" color="var(--brand-navy)" />
          <StatTile icon={Truck} label="Maior grupo" value="18" color="var(--brand-sky)" />
          <StatTile icon={Truck} label="Média por grupo" value="8" color="var(--gold)" />
          <StatTile icon={Users} label="Responsáveis" value="5" color="var(--leaf)" />
        </>
      }
      cardTitle="Grupos cadastrados"
      cardIcon={Layers}
      columns={COLS}
      rows={DADOS}
      campos={CAMPOS}
      novoPadrao={NOVO}
      rotulo="Grupo"
      recurso="groups"
    />
  );
}

/** Protótipo: com API ligada, aviso no lugar dos números escritos no código. */
export default function Grupos() {
  return (
    <ModuloSemFonte titulo="Grupos" motivo="A lista era de exemplo. Vai ser ligada aos grupos reais (rota /groups).">
      <GruposExemplo />
    </ModuloSemFonte>
  );
}
