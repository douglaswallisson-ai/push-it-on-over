import { ModuloSemFonte } from "@/components/ss/ui/SeloDadosExemplo";
import { Building2, MapPin, Truck, Users } from "lucide-react";
import { CadastroScaffold } from "@/components/ss/layout/CadastroScaffold";
import type { Campo } from "@/components/ss/cadastro/CrudSheet";
import { HeroMetric } from "@/components/ss/ui/HeroBanner";
import { StatTile, type Column } from "@/components/ss/ui/data";

/** Cadastro de unidades (filiais). Dados de exemplo. */

type Unidade = {
  nome: string;
  cidade: string;
  veiculos: number;
  motoristas: number;
  responsavel: string;
};

const DADOS: Unidade[] = [
  { nome: "Matriz São Paulo", cidade: "São Paulo / SP", veiculos: 120, motoristas: 54, responsavel: "Marco Taborda" },
  { nome: "Filial Rio de Janeiro", cidade: "Rio de Janeiro / RJ", veiculos: 46, motoristas: 22, responsavel: "Rosemeri Tuono" },
  { nome: "Filial Paraná", cidade: "Curitiba / PR", veiculos: 38, motoristas: 18, responsavel: "Vitor Duarte" },
  { nome: "Filial Bahia", cidade: "Salvador / BA", veiculos: 12, motoristas: 4, responsavel: "Najla Maltaca" },
];

const COLS: Column<Unidade>[] = [
  {
    key: "nome",
    header: "Unidade",
    render: (u) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-tint">
          <Building2 className="h-4 w-4 text-brand-navy" />
        </div>
        <span className="font-semibold text-foreground">{u.nome}</span>
      </div>
    ),
  },
  { key: "cidade", header: "Cidade / UF", render: (u) => <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{u.cidade}</span> },
  { key: "veiculos", header: "Veículos", align: "right", render: (u) => <span className="font-mono font-semibold">{u.veiculos}</span> },
  { key: "motoristas", header: "Motoristas", align: "right", render: (u) => <span className="font-mono">{u.motoristas}</span> },
  { key: "responsavel", header: "Responsável" },
];

const CAMPOS: Campo<Unidade>[] = [
  { nome: "nome", label: "Nome da unidade", tipo: "texto", obrigatorio: true, full: true, placeholder: "Ex.: Filial Paraná" },
  { nome: "cidade", label: "Cidade / UF", tipo: "texto", obrigatorio: true, placeholder: "Curitiba / PR" },
  { nome: "responsavel", label: "Responsável", tipo: "texto" },
  { nome: "veiculos", label: "Veículos", tipo: "numero" },
  { nome: "motoristas", label: "Motoristas", tipo: "numero" },
];

const NOVO: Partial<Unidade> = { veiculos: 0, motoristas: 0, responsavel: "" };

function UnidadesExemplo() {
  return (
    <CadastroScaffold<Unidade>
      title="Unidades"
      subtitle="Cadastros › Unidades"
      newLabel="Nova unidade"
      eyebrow="Cadastros · Unidades"
      heroTitle="4 filiais na operação"
      heroSubtitle="Estrutura da empresa por localidade — base de veículos, equipe e responsáveis."
      heroMetrics={
        <>
          <HeroMetric value="216" label="Veículos na rede" />
          <div className="h-10 w-px bg-white/15" />
          <HeroMetric value="98" label="Motoristas" />
        </>
      }
      stats={
        <>
          <StatTile icon={Building2} label="Filiais" value="4" color="var(--brand-navy)" />
          <StatTile icon={Truck} label="Veículos" value="216" color="var(--brand-sky)" to="/app/veiculos" />
          <StatTile icon={MapPin} label="Estados" value="3" color="var(--gold)" />
          <StatTile icon={Users} label="Motoristas" value="98" color="var(--leaf)" to="/app/motoristas" />
        </>
      }
      cardTitle="Unidades cadastradas"
      cardIcon={Building2}
      columns={COLS}
      rows={DADOS}
      campos={CAMPOS}
      novoPadrao={NOVO}
      rotulo="Unidade"
      recurso="subgroups"
    />
  );
}

/** Protótipo: com API ligada, aviso no lugar dos números escritos no código. */
export default function Unidades() {
  return (
    <ModuloSemFonte titulo="Unidades" motivo="A lista era de exemplo. Vai ser ligada aos subgrupos reais (mova.subgroup).">
      <UnidadesExemplo />
    </ModuloSemFonte>
  );
}
