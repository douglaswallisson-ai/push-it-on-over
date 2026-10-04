import { useState, type ReactNode } from "react";
import { Outlet, useLocation, useNavigate, NavLink } from "@/lib/router-compat";
import {
  ArrowLeftRight,
  FileText,
  Gauge,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Wrench,
  X,
  Activity,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { SSLogo } from "@/components/ss/brand/SSLogo";
import { useSessao } from "@/hooks/use-sessao";
import { sair } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * Console de gestão da plataforma.
 *
 * Ambiente separado do app de telemetria porque atende gente diferente com
 * objetivo diferente: aqui se configura o produto, lá se opera uma frota.
 * Misturar os dois na mesma barra lateral obrigava o cliente a conviver com
 * itens que não são dele, e o dono do software a caçar configuração no meio de
 * telas operacionais.
 *
 * A troca entre os dois ambientes fica explícita no topo — sem isso o usuário
 * se perde e não sabe em qual está.
 */

type Item = { label: string; to: string; icon: typeof LayoutGrid; descricao: string };

const NAV: Item[] = [
  { label: "Painel", to: "/console", icon: LayoutGrid, descricao: "Visão geral da base de clientes" },
  { label: "Contratos", to: "/console/contratos", icon: FileText, descricao: "Todos os contratos de todos os clientes" },
  { label: "Perfis de acesso", to: "/console/perfis", icon: UserCog, descricao: "O que cada perfil pode fazer" },
  { label: "Administradores", to: "/console/administradores", icon: Users, descricao: "Quem acessa este console" },
  { label: "Catálogo de manutenção", to: "/console/catalogo", icon: Wrench, descricao: "Parâmetros do fabricante" },
  { label: "Indicadores gerais", to: "/console/indicadores", icon: Gauge, descricao: "Consolidado de toda a base" },
  { label: "Acessos", to: "/console/acessos", icon: Activity, descricao: "Quem usa a plataforma e quando" },
  { label: "Auditoria", to: "/console/auditoria", icon: ShieldCheck, descricao: "Log de todas as organizações" },
  { label: "Configurações", to: "/console/configuracoes", icon: Settings, descricao: "Origem dos dados e sistema" },
];

export function ConsoleShell({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { sessao } = useSessao();
  const [aberto, setAberto] = useState(false);

  const iniciais = (sessao?.nome ?? "SS")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-canvas">
      {/* Faixa de identificação do ambiente. Cor diferente do app de propósito:
          é a pista mais rápida de "onde eu estou". */}
      <header className="sticky top-0 z-[160] border-b border-white/10 bg-[#1a2436] text-white">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 md:px-6">
          <button
            onClick={() => setAberto((a) => !a)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 lg:hidden"
            aria-label="Menu"
          >
            {aberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <NavLink to="/console" className="flex items-center gap-2.5">
            <SSLogo className="h-7 w-7" />
            <span className="leading-tight">
              <span className="block text-[14px] font-semibold">SS Telemática</span>
              <span className="block font-mono text-[12px] uppercase tracking-[0.14em] text-white/50">
                Console de gestão
              </span>
            </span>
          </NavLink>

          <div className="ml-auto flex items-center gap-2">
            {/* Troca de ambiente. */}
            <button
              onClick={() => navigate("/app")}
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3.5 py-1.5 text-[13px] font-medium text-white/85 transition-colors hover:bg-white/10"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Ir para Telemetria
            </button>

            <span className="hidden items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 sm:flex">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-[12px] font-semibold">
                {iniciais}
              </span>
              <span className="text-[13px]">{sessao?.nome ?? "Administrador"}</span>
            </span>

            <button
              onClick={() => {
                sair();
                navigate("/login");
              }}
              aria-label="Sair"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        {/* Navegação. Descrição em cada item porque o console é usado com pouca
            frequência — o rótulo sozinho não basta para lembrar o que faz. */}
        <nav
          className={cn(
            "w-[260px] shrink-0 border-r border-border bg-card p-3",
            aberto ? "fixed inset-y-14 left-0 z-[155] overflow-y-auto shadow-elegant" : "hidden lg:block",
          )}
        >
          <ul className="space-y-1">
            {NAV.map((i) => {
              const ativo = i.to === "/console" ? pathname === "/console" : pathname.startsWith(i.to);
              return (
                <li key={i.to}>
                  <NavLink
                    to={i.to}
                    onClick={() => setAberto(false)}
                    className={cn(
                      "flex gap-2.5 rounded-lg px-3 py-2.5 transition-colors",
                      ativo ? "bg-navy-tint text-brand-navy" : "text-ink-soft hover:bg-secondary",
                    )}
                  >
                    <i.icon className={cn("mt-0.5 h-4 w-4 shrink-0", ativo ? "text-brand-navy" : "text-muted-foreground")} />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium">{i.label}</span>
                      <span className="block text-[12px] leading-tight text-muted-foreground">{i.descricao}</span>
                    </span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">{children ?? <Outlet />}</main>
      </div>

      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
