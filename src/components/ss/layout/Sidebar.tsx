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
  ClipboardCheck,
  LifeBuoy,
  MonitorUp,
} from "lucide-react";
import { SSOrb } from "@/components/ss/brand/SSOrb";
import { OrgSwitcher } from "@/components/ss/layout/OrgSwitcher";
import { cn } from "@/lib/utils";
import { sair } from "@/lib/session";
import { lerEmbutido } from "@/lib/embutido";
import { useSessao } from "@/hooks/use-sessao";
import { pode } from "@/lib/permissoes";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { usandoMock } from "@/lib/modo";

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

type SubItem = {
  label: string;
  to: string;
  /**
   * Marca a tela como beta no menu.
   *
   * São as que ainda usam dados de exemplo por não terem origem no backend.
   * Sinalizar aqui evita o usuário navegar até lá esperando dado real.
   */
  beta?: boolean;
};
/** `novaAba`: tela própria fora do sistema (telão), abre em outra aba com a sessão (rel=opener). */
type Leaf = { label: string; icon: LucideIcon; to: string; badge?: string; novaAba?: boolean };
/** `modulo`: só aparece para o cliente desse segmento (ver /cliente/modulos). */
type Group = {
  label: string;
  icon: LucideIcon;
  items: SubItem[];
  modulo?: "urbano" | "fretamento";
};
type Entry = Leaf | Group;

const isGroup = (e: Entry): e is Group => "items" in e;

/**
 * A navegação é dividida em dois blocos: as funcionalidades do dia a dia em
 * cima e, abaixo de um divisor, os itens de apoio (análise, ESG, config).
 */
// Ordem definida pelo PM em 04/10/2026 (Relatórios por último, depois de Cadastros).
const NAV_PRIMARY: Entry[] = [
  { label: "Início", icon: Home, to: "/app" },
  { label: "Painel CCO", icon: MonitorUp, to: "/cco", novaAba: true },
  { label: "Mapa ao vivo", icon: MapPin, to: "/app/mapa" },
  {
    label: "Pessoas",
    icon: Users,
    items: [
      { label: "Motoristas", to: "/app/motoristas" },
      // Jornada, escala e ponto são abas da mesma tela: uma entrada só.
      { label: "Jornada, escala e ponto", to: "/app/pessoas/jornada" },
      { label: "Premiação", to: "/app/premiacao" },
      { label: "Metas e pesos da premiação", to: "/app/premiacao/metas" },
    ],
  },
  {
    label: "Frota",
    icon: Truck,
    items: [
      { label: "Veículos", to: "/app/veiculos" },
      { label: "Tracking", to: "/app/frota/tracking" },
      { label: "Desempenho", to: "/app/frota/desempenho" },
      { label: "Hardware", to: "/app/frota/telemetria" },
      { label: "Combustível", to: "/app/frota/combustivel" },
      // Frota aparece para todo cliente (carga, urbano e fretamento): o que está aqui
      // não se repete nos módulos Urbano e Fretamento (decisão do PM, 07/10/2026).
      { label: "Escala de viagem", to: "/app/escala-viagem" },
      { label: "Roteirização", to: "/app/fretamento/roteirizacao" },
      { label: "Rotograma", to: "/app/fretamento/roteirizacao?rotograma=1" },
      { label: "Checklist", to: "/app/frota/checklist", beta: true },
      { label: "Multas", to: "/app/pessoas/multas", beta: true },
    ],
  },
  {
    label: "Urbano",
    icon: Route,
    modulo: "urbano",
    items: [
      { label: "Painel sinótico", to: "/app/operacao/sinotico" },
      { label: "Gestão de viagens", to: "/app/operacao/viagens" },
      { label: "Padrão por linha", to: "/app/urbano/padrao", beta: true },
      { label: "Contagem de passageiros", to: "/app/urbano/passageiros" },
      { label: "Grupos de linhas", to: "/app/cadastros/grupos-linhas" },
    ],
  },
  {
    label: "Fretamento",
    icon: Bus,
    modulo: "fretamento",
    items: [
      // "Nova viagem" é botão dentro de Viagens, não item de menu.
      { label: "Viagens", to: "/app/fretamento/viagens" },
      { label: "Layout de assentos", to: "/app/fretamento/assentos" },
      { label: "Contagem de passageiros", to: "/app/fretamento/passageiros" },
      { label: "Cadastro de passageiros", to: "/app/fretamento/cadastro-passageiros" },
      { label: "Centros de custo", to: "/app/fretamento/centros-custo" },
      { label: "Turnos", to: "/app/fretamento/turnos" },
      { label: "Grupos de linhas", to: "/app/cadastros/grupos-linhas" },
    ],
  },
  {
    label: "Segurança",
    icon: Siren,
    items: [
      { label: "Eventos", to: "/app/eventos" },
      { label: "Videotelemetria", to: "/app/seguranca/video" },
    ],
  },
  {
    label: "Manutenção",
    icon: Wrench,
    items: [
      // As ordens de serviço ficam dentro do painel (aba "Corretiva e ordens").
      { label: "Painel de manutenção", to: "/app/manutencao" },
      { label: "Sinais do motor", to: "/app/frota/sinais" },
      { label: "Pneus", to: "/app/manutencao/pneus", beta: true },
      { label: "Diagnóstico (DTC)", to: "/app/manutencao/diagnostico", beta: true },
      { label: "Regeneração (DPF)", to: "/app/manutencao/regeneracao", beta: true },
    ],
  },
  { label: "Gerencial", icon: Gauge, to: "/app/gerencial" },
  { label: "IA Ops Advisor", icon: Sparkles, to: "/app/estrategico" },
  {
    label: "Cadastros",
    icon: ClipboardList,
    items: [
      { label: "Alarme", to: "/app/cadastros/alarme" },
      { label: "Combustível", to: "/app/cadastros/combustivel" },
      { label: "Dispositivos", to: "/app/cadastros/dispositivos" },
      { label: "Equipamentos por veículo", to: "/app/cadastros/equipamentos" },
      { label: "Garagens", to: "/app/cadastros/garagens" },
      { label: "Grupos", to: "/app/cadastros/grupos" },
      { label: "Linhas", to: "/app/cadastros/linhas" },
      { label: "Pontos de parada", to: "/app/cadastros/pontos" },
      { label: "Pontos e cercas", to: "/app/cadastros/pontos-interesse" },
      { label: "Cercas com alerta", to: "/app/cadastros/cerca" },
      { label: "Unidades", to: "/app/cadastros/unidades" },
      { label: "Usuários", to: "/app/cadastros/usuarios" },
      { label: "Veículos", to: "/app/cadastros/veiculos" },
    ],
  },
  { label: "Relatórios", icon: FileText, to: "/app/relatorios" },
];

// Itens de apoio, sem título de seção. Premiação foi para Pessoas e Auditoria
// fica só no Console de gestão (pedido do PM, 04/10/2026).
const NAV_SECONDARY: Entry[] = [
  { label: "Emissão de CO₂", icon: Leaf, to: "/app/co2" },
  { label: "Suporte", icon: LifeBuoy, to: "/app/suporte" },
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
  const [menuUsuario, setMenuUsuario] = useState(false);
  // Segmentos do cliente aberto (Urbano/Fretamento). Sem cliente escolhido, mostra tudo.
  const grupo = grupoAtivo();
  const modulos = useQuery({
    queryKey: ["cliente-modulos", grupo],
    queryFn: () =>
      api.get<{ urbano: boolean; fretamento: boolean }>(
        `/api/v1/cliente/modulos?group_id=${grupo}`,
      ),
    enabled: !!grupo && !usandoMock(),
    staleTime: 3_600_000,
  });
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
          {lerEmbutido()?.marca.logo ? (
            <img
              src={lerEmbutido()!.marca.logo}
              alt={lerEmbutido()!.marca.nome ?? "Logo"}
              className="h-8 max-w-[200px] object-contain object-left"
            />
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Itens sensíveis só aparecem para quem tem permissão. */}
        <nav className="rolagem-escura flex-1 overflow-y-auto overflow-x-hidden py-3">
          {NAV_PRIMARY.filter(
            (entry) =>
              !(isGroup(entry) && entry.modulo && modulos.data && !modulos.data[entry.modulo]),
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
          <div className="mx-4 my-2.5 h-px bg-white/12" />

          {NAV_SECONDARY.filter(
            (e) => !(lerEmbutido() && !isGroup(e) && e.to === "/app/suporte"),
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
        </nav>

        <div className="shrink-0 border-t border-white/10 px-[14px] py-3">
          <OrgSwitcher expanded={expanded} />

          <div className="my-2 border-t border-white/10" />

          {/* Clicar no nome abre o menu do usuário: Console de gestão (só SS) e sair. */}
          {menuUsuario && expanded && sessao?.perfil === "super_admin" && (
            <div className="mb-2 overflow-hidden rounded-lg border border-white/15 bg-white/5">
              <NavLink
                to="/console"
                onClick={() => setMenuUsuario(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-white/85 hover:bg-white/10"
              >
                <ArrowLeftRight className="h-4 w-4 shrink-0" />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[13px] font-medium">Console de gestão</span>
                  <span className="block truncate text-[12px] text-white/45">
                    contratos, acessos, auditoria e plataforma
                  </span>
                </span>
              </NavLink>
            </div>
          )}
          <div className="flex items-center gap-2.5 overflow-hidden rounded-lg px-2 py-1.5">
            <button
              type="button"
              onClick={() => setMenuUsuario((m) => !m)}
              aria-expanded={menuUsuario}
              title="Menu do usuário"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left hover:bg-white/5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue text-[12px] font-semibold text-white">
                {iniciais}
              </span>
              {expanded && (
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[13px] font-semibold text-white">
                    {nomeUsuario}
                  </span>
                  <span className="block truncate text-[12px] text-white/55">{orgUsuario}</span>
                </span>
              )}
            </button>
            {expanded && !lerEmbutido() && (
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
  // Embutido (iframe) abre no próprio quadro; fora dele, em outra aba para o telão.
  if (entry.novaAba && !lerEmbutido())
    return (
      <a
        href={entry.to}
        target="_blank"
        rel="opener"
        onClick={onNavigate}
        title={entry.label}
        className={cn(
          "relative mx-2 flex h-11 w-[calc(100%-1rem)] items-center gap-3 rounded-lg text-white/85 transition-[padding] duration-200 hover:bg-white/[0.08] hover:text-white",
          expanded ? "px-[14px]" : "justify-center px-0",
        )}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {expanded && (
          <span className="whitespace-nowrap text-[14px] font-medium">{entry.label}</span>
        )}
      </a>
    );
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
      {expanded && <span className="whitespace-nowrap text-[14px] font-medium">{entry.label}</span>}
      {expanded && entry.badge && (
        <span className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 text-[12px] font-semibold">
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
            <span className="whitespace-nowrap text-[14px] font-medium">{entry.label}</span>
            <ChevronRight
              className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-90")}
            />
          </>
        )}
      </button>

      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-300",
          expanded && open ? "max-h-[1200px]" : "max-h-0",
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
                  "block whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/[0.06] hover:text-white",
                )
              }
            >
              <span className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.beta && (
                  <span
                    title="Ainda usa dados de exemplo — sem origem no backend"
                    className="shrink-0 rounded bg-gold/25 px-1 py-px font-mono text-[12px] font-bold uppercase tracking-[0.06em] text-gold"
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
