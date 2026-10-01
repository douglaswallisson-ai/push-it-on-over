import { ModuloSemFonte } from "@/components/ss/ui/SeloDadosExemplo";
import { Cpu, Radio, Wifi, WifiOff } from "lucide-react";
import { CadastroScaffold } from "@/components/ss/layout/CadastroScaffold";
import type { Campo } from "@/components/ss/cadastro/CrudSheet";
import { HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Dot, Pill, StatTile, type Column } from "@/components/ss/ui/data";

/** Cadastro de dispositivos (rastreadores). Dados de exemplo. */

type Dispositivo = {
  serial: string;
  modelo: string;
  veiculo: string;
  operadora: string;
  ultima: string;
  online: boolean;
};

const DADOS: Dispositivo[] = [
  { serial: "864329051", modelo: "GT06N", veiculo: "BCA7A56", operadora: "Vivo", ultima: "há 30s", online: true },
  { serial: "864329088", modelo: "GT06N", veiculo: "TPA1106", operadora: "Claro", ultima: "há 45s", online: true },
  { serial: "864329142", modelo: "Suntech ST310", veiculo: "SXD1J61", operadora: "TIM", ultima: "há 1 min", online: true },
  { serial: "864329177", modelo: "GT06N", veiculo: "EBZ3590", operadora: "Vivo", ultima: "há 22 min", online: false },
  { serial: "864329203", modelo: "Suntech ST310", veiculo: "LUO5I08", operadora: "Claro", ultima: "há 3 min", online: true },
  { serial: "864329251", modelo: "GT06N", veiculo: "— (estoque)", operadora: "Vivo", ultima: "há 2 dias", online: false },
];

const COLS: Column<Dispositivo>[] = [
  {
    key: "serial",
    header: "Dispositivo",
    render: (d) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-tint">
          <Cpu className="h-4 w-4 text-brand-navy" />
        </div>
        <div>
          <div className="font-mono font-semibold text-foreground">{d.serial}</div>
          <div className="text-[11.5px] text-muted-foreground">{d.modelo}</div>
        </div>
      </div>
    ),
  },
  { key: "veiculo", header: "Veículo", render: (d) => <span className="font-mono">{d.veiculo}</span> },
  { key: "operadora", header: "Operadora", render: (d) => <Pill tone="sky">{d.operadora}</Pill> },
  { key: "ultima", header: "Última comunicação", align: "right", render: (d) => <span className="text-muted-foreground">{d.ultima}</span> },
  {
    key: "online",
    header: "Status",
    align: "center",
    render: (d) => (
      <span className="inline-flex items-center gap-2 text-[13px]">
        <Dot tone={d.online ? "green" : "coral"} />
        {d.online ? "Online" : "Offline"}
      </span>
    ),
  },
];

const CAMPOS: Campo<Dispositivo>[] = [
  { nome: "serial", label: "Serial do dispositivo", tipo: "texto", obrigatorio: true, placeholder: "864329051" },
  { nome: "modelo", label: "Modelo", tipo: "select", obrigatorio: true, opcoes: ["GT06N", "Suntech ST310", "SS Track 4G", "SS Vision DMS"] },
  { nome: "veiculo", label: "Veículo vinculado", tipo: "texto", placeholder: "Placa ou vazio para estoque", hint: "Deixe em branco se o equipamento está em estoque." },
  { nome: "operadora", label: "Operadora do chip", tipo: "select", opcoes: ["Vivo", "Claro", "TIM", "Algar"] },
  { nome: "ultima", label: "Última comunicação", tipo: "texto", placeholder: "há 30s" },
  { nome: "online", label: "Comunicando agora", tipo: "toggle" },
];

const NOVO: Partial<Dispositivo> = { modelo: "SS Track 4G", operadora: "Vivo", online: false, veiculo: "", ultima: "—" };

function DispositivosExemplo() {
  return (
    <CadastroScaffold<Dispositivo>
      title="Dispositivos"
      subtitle="Cadastros › Dispositivos"
      newLabel="Novo dispositivo"
      eyebrow="Cadastros · Dispositivos"
      heroTitle="48 rastreadores na frota"
      heroSubtitle="Rastreadores instalados e em estoque, com status de comunicação em tempo real."
      heroMetrics={
        <>
          <HeroMetric value="45" label="Online agora" />
          <div className="h-10 w-px bg-white/15" />
          <HeroMetric value="3" label="Offline" />
        </>
      }
      stats={
        <>
          <StatTile icon={Radio} label="Total" value="48" color="var(--brand-navy)" />
          <StatTile icon={Wifi} label="Online" value="45" color="var(--leaf)" />
          <StatTile icon={WifiOff} label="Offline" value="3" color="var(--coral)" />
          <StatTile icon={Cpu} label="Em estoque" value="4" color="var(--gold)" />
        </>
      }
      cardTitle="Dispositivos cadastrados"
      cardIcon={Cpu}
      columns={COLS}
      rows={DADOS}
      campos={CAMPOS}
      novoPadrao={NOVO}
      rotulo="Dispositivo"
      recurso="devices"
      searchPlaceholder="Buscar serial ou placa…"
    />
  );
}

/** Protótipo: com API ligada, aviso no lugar dos números escritos no código. */
export default function Dispositivos() {
  return (
    <ModuloSemFonte titulo="Dispositivos" motivo="A lista era de exemplo. Vai ser ligada aos dispositivos reais (rota /devices).">
      <DispositivosExemplo />
    </ModuloSemFonte>
  );
}
