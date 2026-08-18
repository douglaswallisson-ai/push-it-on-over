import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate, NavLink } from "@/lib/router-compat";
import {
  Award,
  Bus,
  ChevronRight,
  ClipboardList,
  Factory,
  FileText,
  Gauge,
  Home,
  Leaf,
  LogOut,
  MapPin,
  Route,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Siren,
  UsersRound,
  Wrench,
  Sparkles,
  Truck,
  Users,
  type LucideIcon,
  ArrowLeftRight,
} from "lucide-react";
import { SSOrb } from "@/components/ss/brand/SSOrb";
import { OrgSwitcher } from "@/components/ss/layout/OrgSwitcher";
import { cn } from "@/lib/utils";
import { sair } from "@/lib/session";
import { useSessao } from "@/hooks/use-sessao";
import { pode } from "@/lib/permissoes";

/**
 * Menu lateral em trilho de ícones.
 *
 * Comportamento: coluna estreita só de ícones; ao entrar com o mouse expande e
 * revela rótulos e submenus; ao sair, retrai. O conteúdo não é empurrado — o
 * menu flutua por cima. No mobile vira gaveta cheia acionada pelo botão.
 *
 * A árvore reflete os módulos reais do produto (mapa, CO₂, motoristas, frota,
 * cadastros, painel estratégico), interpretados a partir das telas de
 * referência.
 */

const RAIL = 68;
const PANEL = 256;

type SubItem = { label: string; to: string
  /**
   * Marca a tela como beta no menu.
   *
   * São as que ainda usam dados de exemplo por não terem origem no backend.
   * Sinalizar aqui evita o usuário navegar até lá esperando dado real.
   */
  beta?: boolean;
};
type Leaf = { label: string; icon: LucideIcon; to: string; badge?: string };
type Group = { label: string; icon: LucideIcon; items: SubItem[] };
type Entry = Leaf | Group;

const isGroup = (e: Entry): e is Group => "items" in e;

/**
 * A navegação é dividida em dois blocos: as funcionalidades do dia a dia em
 * cima e, abaixo de um divisor, os itens de apoio (análise, ESG, config).
 */
const NAV_PRIMARY: Entry[] = [
  { label: "Início", icon: Home, to: "/app" },
  {
    label: "Cadastros",
    icon: ClipboardList,
    items: [
      { label: "Alarme", to: "/app/cadastros/alarme" },
      { label: "Cerca", to: "/app/cadastros/cerca" },
      { label: "Combustível", to: "/app/cadastros/combustivel" },
      { label: "Dispositivos", to: "/app/cadastros/dispositivos" },
      { label: "Equipamentos por veículo", to: "/app/cadastros/equipamentos" },
      { label: "Garagens", to: "/app/cadastros/garagens" },
      { label: "Grupos", to: "/app/cadastros/grupos" },
      { label: "Linhas", to: "/app/cadastros/linhas" },
      { label: "Pontos de parada", to: "/app/cadastros/pontos" },
      { label: "Pontos e cercas", to: "/app/cadastros/pontos-interesse" },
      { label: "Unidades", to: "/app/cadastros/unidades" },
      { label: "Usuários", to: "/app/cadastros/usuarios" },
    ],
  },
  { label: "Mapa ao vivo", icon: MapPin, to: "/app/mapa" },
  {
    label: "Frota",
    icon: Truck,
    items: [
      { label: "Veículos", to: "/app/veiculos" },
      { label: "Acompanhamento do veículo", to: "/app/frota/analise" },
      { label: "Desempenho da frota", to: "/app/frota/desempenho" },
      { label: "Videotelemetria", to: "/app/seguranca/video" },
      { label: "Percurso do dia", to: "/app/frota/tracking" },
      { label: "Sinais do motor", to: "/app/frota/sinais" },
      { label: "Telemetria", to: "/app/frota/telemetria" },
    ],
  },
  {
    label: "Pessoas",
    icon: Users,
    items: [
      { label: "Motoristas", to: "/app/motoristas" },
      { label: "Jornada de trabalho", to: "/app/pessoas/jornada" },
      { label: "Controle de escala", to: "/app/fretamento/escala" },
      { label: "Ponto", to: "/app/fretamento/ponto" },
      { label: "Multas", to: "/app/pessoas/multas", beta: true },
    ],
  },
  {
    label: "Transporte urbano",
    icon: Route,
    items: [
      { label: "Painel sinótico", to: "/app/operacao/sinotico" },
      { label: "Gestão de viagens", to: "/app/operacao/viagens" },
      { label: "Padrão por linha", to: "/app/urbano/padrao", beta: true },
    ],
  },
  {
    label: "Fretamento",
    icon: Bus,
    items: [
      { label: "Viagens", to: "/app/fretamento/viagens" },
      { label: "Nova viagem", to: "/app/fretamento/viagens/nova" },
      { label: "Roteirização", to: "/app/fretamento/roteirizacao" },
      { label: "Layout de assentos", to: "/app/fretamento/assentos" },
    ],
  },
  // Serve às duas modalidades, por isso não fica dentro de nenhuma.
  { label: "Contagem de passageiros", icon: UsersRound, to: "/app/fretamento/passageiros" },
  { label: "Eventos", icon: Siren, to: "/app/eventos" },
  {
    label: "Manutenção",
    icon: Wrench,
    items: [
      { label: "Manutenção", to: "/app/manutencao", beta: true },
      { label: "Ordens de serviço", to: "/app/manutencao/ordens", beta: true },
      { label: "Pneus", to: "/app/manutencao/pneus", beta: true },
      { label: "Diagnóstico (DTC)", to: "/app/manutencao/diagnostico", beta: true },
      { label: "Regeneração (DPF)", to: "/app/manutencao/regeneracao", beta: true },
    ],
  },
  {
    label: "Gerencial",
    icon: Gauge,
    items: [{ label: "Indicadores", to: "/app/gerencial/indicadores" }],
  },
  { label: "IA Fleet Manager", icon: Sparkles, to: "/app/estrategico" },
  {
    label: "Relatórios",
    icon: FileText,
    items: [
      { label: "Visão geral", to: "/app/relatorios" },
      { label: "Telemetria por viagem", to: "/app/relatorios/telemetria" },
      { label: "Operacionais", to: "/app/relatorios/operacionais" },
    ],
  },
  { label: "Auditoria", icon: ShieldCheck, to: "/app/auditoria" },
];

const NAV_SECONDARY: Entry[] = [
  {
    label: "Premiação",
    icon: Award,
    items: [
      { label: "Acompanhamento", to: "/app/premiacao", beta: true },
      { label: "Metas e pesos", to: "/app/premiacao/metas" },
    ],
  },
  { label: "Emissão de CO₂", icon: Leaf, to: "/app/co2" },
];

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  // Identidade do usuário logado — antes estava fixa no código como "Douglas Morais".
  const { sessao } = useSessao();
  const nomeUsuario = sessao?.nome ?? "Visitante";
  const orgUsuario = sessao?.organizacao ?? "SS Telemática";
  const iniciais = nomeUsuario
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const [hovered, setHovered] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const expanded = isDesktop ? hovered : true;
  const width = isDesktop ? (expanded ? PANEL : RAIL) : PANEL;
  const transform = isDesktop ? "none" : open ? "translateX(0)" : "translateX(-100%)";

  useEffect(() => {
    if (!expanded) setOpenGroup(null);
  }, [expanded]);

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-140 bg-[rgba(10,16,28,.5)] transition-opacity lg:hidden",
          open ? "block" : "hidden",
        )}
      />

      <aside
        data-tour="sidebar"
        onMouseEnter={() => isDesktop && setHovered(true)}
        onMouseLeave={() => isDesktop && setHovered(false)}
        style={{ width, transform, transition: "width .22s ease, transform .3s ease" }}
        className={cn(
          "fixed inset-y-0 left-0 z-150 flex flex-col bg-sidebar text-white",
          expanded && isDesktop && "shadow-[8px_0_32px_-12px_rgba(18,42,82,.45)]",
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-2.5 overflow-hidden border-b border-white/10 px-[18px]">
          <SSOrb size={30} />
          <span
            className={cn(
              "whitespace-nowrap text-[16px] font-bold tracking-tight transition-opacity duration-200",
              expanded ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="text-brand-sky">SS</span>
            <span className="text-white">Telemática</span>
          </span>
        </div>

        {/* Itens sensíveis só aparecem para quem tem permissão. */}
        <nav className="rolagem-escura flex-1 overflow-y-auto overflow-x-hidden py-3">
          {NAV_PRIMARY.filter(
            (entry) => !("to" in entry && entry.to === "/app/auditoria") || pode(sessao?.perfil, "ver_auditoria"),
          ).map((entry) => (
            <NavEntry
              key={entry.label}
              entry={entry}
              expanded={expanded}
              openGroup={openGroup}
              setOpenGroup={setOpenGroup}
              onNavigate={onClose}
            />
          ))}

          {/* Divisor entre o dia a dia e os itens de apoio. */}
          <div className="my-2.5 px-4">
            {expanded ? (
              <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/35">
                Gestão e configuração
              </span>
            ) : (
              <div className="h-px bg-white/12" />
            )}
          </div>

          {NAV_SECONDARY.map((entry) => (
            <NavEntry
              key={entry.label}
              entry={entry}
              expanded={expanded}
              openGroup={openGroup}
              setOpenGroup={setOpenGroup}
              onNavigate={onClose}
            />
          ))}
        </nav>

        <div className="shrink-0 border-t border-white/10 px-[14px] py-3">
          <OrgSwitcher expanded={expanded} />

          {/* Atalho para o console de gestão. Só o dono do software o enxerga —
              para o cliente ele não existe. */}
          {sessao?.perfil === "super_admin" && (
            <NavLink
              to="/console"
              title="Console de gestão"
              className={cn(
                "mt-2 flex items-center gap-2.5 overflow-hidden rounded-lg border border-white/15 px-2 py-2 text-white/80 transition-colors hover:bg-white/10",
                !expanded && "justify-center px-0",
              )}
            >
              <ArrowLeftRight className="h-4 w-4 shrink-0" />
              {expanded && (
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[12.5px] font-medium">Console de gestão</span>
                  <span className="block truncate text-[10.5px] text-white/45">contratos, perfis e plataforma</span>
                </span>
              )}
            </NavLink>
          )}

          <div className="my-2 border-t border-white/10" />

          <div className="flex items-center gap-2.5 overflow-hidden rounded-lg px-2 py-1.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue text-[12px] font-semibold text-white">
              {iniciais}
            </div>
            {expanded && (
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[13px] font-semibold text-white">{nomeUsuario}</div>
                <div className="truncate text-[11px] text-white/55">{orgUsuario}</div>
              </div>
            )}
            {expanded && (
              <button
                onClick={() => {
                  sair();
                  navigate("/login");
                }}
                aria-label="Sair"
                title="Sair"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/60 transition-all hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

/** Despacha uma entrada de menu entre item simples e grupo colapsável. */
function NavEntry({
  entry,
  expanded,
  openGroup,
  setOpenGroup,
  onNavigate,
}: {
  entry: Entry;
  expanded: boolean;
  openGroup: string | null;
  setOpenGroup: Dispatch<SetStateAction<string | null>>;
  onNavigate: () => void;
}) {
  return isGroup(entry) ? (
    <GroupRow
      entry={entry}
      expanded={expanded}
      open={openGroup === entry.label}
      onToggle={() => setOpenGroup((g) => (g === entry.label ? null : entry.label))}
      onNavigate={onNavigate}
    />
  ) : (
    <LeafRow entry={entry} expanded={expanded} onNavigate={onNavigate} />
  );
}

function LeafRow({
  entry,
  expanded,
  onNavigate,
}: {
  entry: Leaf;
  expanded: boolean;
  onNavigate: () => void;
}) {
  const Icon = entry.icon;
  return (
    <NavLink
      to={entry.to}
      end={entry.to === "/app"}
      onClick={onNavigate}
      title={entry.label}
      className={({ isActive }) =>
        cn(
          "relative mx-2 flex h-11 w-[calc(100%-1rem)] items-center gap-3 rounded-lg transition-[padding] duration-200",
          expanded ? "px-[14px]" : "justify-center px-0",
          isActive
            ? "bg-brand-green text-white"
            : "text-white/85 hover:bg-white/[0.08] hover:text-white",
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {expanded && (
        <span className="whitespace-nowrap text-[13.5px] font-medium">{entry.label}</span>
      )}
      {expanded && entry.badge && (
        <span className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 text-[10.5px] font-semibold">
          {entry.badge}
        </span>
      )}
    </NavLink>
  );
}

function GroupRow({
  entry,
  expanded,
  open,
  onToggle,
  onNavigate,
}: {
  entry: Group;
  expanded: boolean;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const Icon = entry.icon;
  return (
    <div>
      <button
        onClick={onToggle}
        title={entry.label}
        className={cn(
          "relative mx-2 flex h-11 w-[calc(100%-1rem)] items-center gap-3 rounded-lg text-white/85 transition-[padding] duration-200 hover:bg-white/[0.08] hover:text-white",
          expanded ? "px-[14px]" : "justify-center px-0",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {expanded && (
          <>
            <span className="whitespace-nowrap text-[13.5px] font-medium">{entry.label}</span>
            <ChevronRight
              className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-90")}
            />
          </>
        )}
      </button>

      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-300",
          expanded && open ? "max-h-96" : "max-h-0",
        )}
      >
        <div className="ml-[30px] mr-3 mt-0.5 space-y-0.5 border-l border-white/10 pb-1 pl-3">
          {entry.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "block whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors",
                  isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/[0.06] hover:text-white",
                )
              }
            >
              <span className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.beta && (
                  <span
                    title="Ainda usa dados de exemplo — sem origem no backend"
                    className="shrink-0 rounded bg-gold/25 px-1 py-px font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-gold"
                  >
                    beta
                  </span>
                )}
              </span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}
