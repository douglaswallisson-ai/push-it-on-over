import { ShieldCheck, UserCog, UserX, Users } from "lucide-react";
import { CadastroScaffold } from "@/components/ss/layout/CadastroScaffold";
import { HeroMetric } from "@/components/ss/ui/HeroBanner";
import { Dot, Pill, StatTile, type Column, type PillTone } from "@/components/ss/ui/data";

/** Cadastro de usuários do sistema. Dados de exemplo. */

type Usuario = {
  nome: string;
  email: string;
  perfil: "Administrador" | "Gestor" | "Operador" | "Consulta";
  acesso: string;
  ativo: boolean;
};

const perfilTone: Record<Usuario["perfil"], PillTone> = {
  Administrador: "coral",
  Gestor: "sky",
  Operador: "gold",
  Consulta: "neutral",
};

const DADOS: Usuario[] = [
  { nome: "Douglas Morais", email: "douglas.morais@sstelematica.com.br", perfil: "Administrador", acesso: "agora", ativo: true },
  { nome: "Marco Taborda", email: "marco.taborda@empresa.com.br", perfil: "Gestor", acesso: "há 2 h", ativo: true },
  { nome: "Rosemeri Tuono", email: "rosemeri.t@empresa.com.br", perfil: "Operador", acesso: "há 1 dia", ativo: true },
  { nome: "Vitor Duarte", email: "vitor.duarte@empresa.com.br", perfil: "Operador", acesso: "há 3 dias", ativo: true },
  { nome: "Najla Maltaca", email: "najla.m@empresa.com.br", perfil: "Consulta", acesso: "há 12 dias", ativo: false },
];

const COLS: Column<Usuario>[] = [
  {
    key: "nome",
    header: "Usuário",
    render: (u) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-tint text-[11px] font-semibold text-brand-navy">
          {u.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </div>
        <div>
          <div className="font-semibold text-foreground">{u.nome}</div>
          <div className="text-[11.5px] text-muted-foreground">{u.email}</div>
        </div>
      </div>
    ),
  },
  { key: "perfil", header: "Perfil", render: (u) => <Pill tone={perfilTone[u.perfil]}>{u.perfil}</Pill> },
  { key: "acesso", header: "Último acesso", align: "right", render: (u) => <span className="text-muted-foreground">{u.acesso}</span> },
  {
    key: "ativo",
    header: "Status",
    align: "center",
    render: (u) => (
      <span className="inline-flex items-center gap-2 text-[13px]">
        <Dot tone={u.ativo ? "green" : "neutral"} />
        {u.ativo ? "Ativo" : "Inativo"}
      </span>
    ),
  },
];

export default function Usuarios() {
  return (
    <CadastroScaffold<Usuario>
      title="Usuários"
      subtitle="Cadastros › Usuários"
      newLabel="Novo usuário"
      eyebrow="Cadastros · Usuários"
      heroTitle="Usuários do sistema"
      heroSubtitle="Quem acessa a plataforma e com qual perfil de permissão."
      heroMetrics={
        <>
          <HeroMetric value="23" label="Usuários ativos" />
          <div className="h-10 w-px bg-white/15" />
          <HeroMetric value="4" label="Perfis de acesso" />
        </>
      }
      stats={
        <>
          <StatTile icon={Users} label="Usuários" value="25" color="var(--brand-navy)" />
          <StatTile icon={ShieldCheck} label="Ativos" value="23" color="var(--leaf)" />
          <StatTile icon={UserCog} label="Administradores" value="3" color="var(--coral)" />
          <StatTile icon={UserX} label="Bloqueados" value="2" color="var(--gold)" />
        </>
      }
      cardTitle="Usuários cadastrados"
      cardIcon={Users}
      columns={COLS}
      rows={DADOS}
      searchPlaceholder="Buscar nome ou e-mail…"
    />
  );
}
