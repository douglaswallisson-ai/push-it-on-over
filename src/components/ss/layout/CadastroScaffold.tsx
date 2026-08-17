import { useMemo, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Pencil, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { HeroBanner } from "@/components/ss/ui/HeroBanner";
import { Card, DataTable, Pill, type Column } from "@/components/ss/ui/data";
import { CrudSheet, type Campo } from "@/components/ss/cadastro/CrudSheet";
import { registrarAuditoria } from "@/lib/session";
import { useCrud } from "@/hooks/use-crud";

/** Recursos com endpoint disponível na API. */
type RecursoCrud = "vehicles" | "drivers" | "devices" | "groups" | "subgroups" | "bus-lines";

/**
 * Esqueleto comum das telas de cadastro: cabeçalho, faixa hero, KPIs e tabela
 * com busca — agora com criação, edição e exclusão.
 *
 * O botão "Novo" antes não tinha handler e clicar numa linha não fazia nada, o
 * que valia para os sete cadastros que usam este scaffold. Concentrando o CRUD
 * aqui, cada tela só declara `campos` e todas passam a se comportar igual.
 *
 * A persistência é local (estado do React) enquanto a API não existe: as
 * alterações valem para a sessão e somem no reload. É proposital — melhor do
 * que um botão morto, e sem fingir que gravou no servidor.
 */
export function CadastroScaffold<T extends Record<string, unknown>>({
  title,
  subtitle,
  newLabel,
  eyebrow,
  heroTitle,
  heroSubtitle,
  heroMetrics,
  stats,
  cardTitle,
  cardIcon,
  columns,
  rows,
  searchPlaceholder = "Buscar…",
  campos,
  novoPadrao,
  rotulo,
  buscarEm,
  recurso,
}: {
  title: string;
  subtitle: string;
  newLabel: string;
  eyebrow: string;
  heroTitle: ReactNode;
  heroSubtitle: string;
  heroMetrics: ReactNode;
  stats?: ReactNode;
  cardTitle: string;
  cardIcon: LucideIcon;
  columns: Column<T>[];
  rows: T[];
  searchPlaceholder?: string;
  /** Campos do formulário de criação/edição. Sem isso o cadastro fica só leitura. */
  campos?: Campo<T>[];
  /** Valores iniciais de um registro novo. */
  novoPadrao?: Partial<T>;
  /** Nome no singular, usado nos títulos do painel. */
  rotulo?: string;
  /** Campos considerados na busca. Por padrão, todos os valores de texto. */
  buscarEm?: (keyof T & string)[];
  /**
   * Recurso correspondente na API. Informado, o cadastro grava de verdade;
   * omitido, continua só na memória da tela — é o caso dos cadastros que ainda
   * não têm endpoint.
   */
  recurso?: RecursoCrud;
}) {
  const [lista, setLista] = useState<T[]>(rows);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<T | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const crud = useCrud<T>(recurso ?? "vehicles");

  const singular = rotulo ?? title.replace(/s$/, "");

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return lista;
    return lista.filter((r) => {
      const chaves = buscarEm ?? (Object.keys(r) as (keyof T & string)[]);
      return chaves.some((k) => String(r[k] ?? "").toLowerCase().includes(t));
    });
  }, [lista, busca, buscarEm]);

  const notificar = (msg: string) => {
    setAviso(msg);
    setTimeout(() => setAviso(null), 3500);
  };

  const abrirNovo = () => {
    setEditando(null);
    setAberto(true);
  };

  const abrirEdicao = (r: T) => {
    setEditando(r);
    setAberto(true);
  };

  const salvar = async (v: Partial<T>) => {
    const rotuloRegistro = String((v as Record<string, unknown>).nome ?? (v as Record<string, unknown>).serial ?? "");

    // A lista da tela é atualizada de imediato, antes da resposta: o formulário
    // fecha e o registro aparece na hora. Se a gravação falhar, o hook mostra o
    // erro e a próxima recarga traz o estado real do servidor.
    if (editando) {
      setLista((l) => l.map((r) => (r === editando ? ({ ...r, ...v } as T) : r)));
    } else {
      setLista((l) => [{ ...(novoPadrao ?? {}), ...v } as T, ...l]);
    }
    setAberto(false);

    if (recurso) {
      const id = (editando as Record<string, unknown> | null)?.id;
      if (editando && id != null) {
        await crud.editar.mutateAsync({ id: id as string | number, dados: v });
      } else {
        await crud.criar.mutateAsync(v);
      }
      return;
    }

    // Sem recurso mapeado, o comportamento antigo: só memória da tela.
    registrarAuditoria(
      editando ? "edicao" : "criacao",
      `${singular} ${editando ? "alterado" : "criado"}: ${rotuloRegistro || "registro"}.`,
    );
    notificar(`${singular} ${editando ? "atualizado" : "criado"}.`);
  };

  const excluir = async (r: T) => {
    const rotuloRegistro = String((r as Record<string, unknown>).nome ?? (r as Record<string, unknown>).serial ?? "");
    setLista((l) => l.filter((x) => x !== r));
    setAberto(false);

    const id = (r as Record<string, unknown>).id;
    if (recurso && id != null) {
      await crud.excluir.mutateAsync(id as string | number);
      return;
    }

    registrarAuditoria("exclusao", `${singular} excluído: ${rotuloRegistro || "registro"}.`);
    notificar(`${singular} excluído.`);
  };

  // Coluna de ação, para deixar a edição visível — clicar na linha também abre,
  // mas isso não é descobrível sozinho.
  const colunas: Column<T>[] = campos
    ? [
        ...columns,
        {
          key: "__acoes",
          header: "",
          align: "center",
          render: () => (
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground">
              <Pencil className="h-3.5 w-3.5" />
            </span>
          ),
        },
      ]
    : columns;

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          campos && (
            <button
              onClick={abrirNovo}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-[15px] w-[15px]" />
              {newLabel}
            </button>
          )
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-6 px-6 py-6 md:px-8">
        <HeroBanner orb eyebrow={eyebrow} title={heroTitle} subtitle={heroSubtitle}>
          <div className="flex items-center gap-6">{heroMetrics}</div>
        </HeroBanner>

        {aviso && (
          <div className="rounded-lg border border-leaf-line bg-leaf-tint/50 px-4 py-2.5 text-[13px] font-medium text-leaf">
            {aviso}
          </div>
        )}

        {stats && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{stats}</div>}

        <Card
          title={cardTitle}
          icon={cardIcon}
          action={
            <div className="flex items-center gap-3">
              <Pill tone="sky">{filtradas.length} registros</Pill>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 w-52 rounded-lg border border-border bg-secondary/60 pl-8 pr-3 text-[13px] outline-none focus:border-accent focus:bg-white"
                />
              </div>
            </div>
          }
          bodyClassName="p-4"
        >
          <DataTable
            columns={colunas}
            rows={filtradas}
            onRowClick={campos ? abrirEdicao : undefined}
            empty={busca ? "Nenhum registro com esse filtro." : "Nada cadastrado ainda."}
          />
          {campos && (
            <p className="mt-3 text-[11.5px] text-muted-foreground">
              Clique em qualquer linha para ver e editar. Alterações valem para esta sessão enquanto a API de
              gravação não está ligada.
            </p>
          )}
        </Card>
      </div>

      {campos && (
        <CrudSheet<T>
          aberto={aberto}
          onFechar={() => setAberto(false)}
          titulo={editando ? `Editar ${singular.toLowerCase()}` : `Novo ${singular.toLowerCase()}`}
          campos={campos}
          valor={editando ?? novoPadrao ?? {}}
          editando={editando}
          onSalvar={salvar}
          onExcluir={excluir}
        />
      )}
    </>
  );
}
