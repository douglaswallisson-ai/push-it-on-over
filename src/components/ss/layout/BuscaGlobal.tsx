import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router-compat";
import { CornerDownLeft, LayoutGrid, MapPin, Route, Search, Truck, User } from "lucide-react";
import { linhasQuery, motoristasListQuery, pontosQuery, veiculosQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Busca global.
 *
 * Aberta por ⌘K ou Ctrl+K. Procura em veículos (prefixo e placa), motoristas,
 * linhas, pontos e nas próprias telas do sistema.
 *
 * Existe porque a navegação por menu não escala: com quase quarenta telas e
 * centenas de veículos, encontrar o carro 11596 pelo menu leva quatro cliques
 * e saber de antemão em qual módulo ele está.
 */

type Resultado = {
  id: string;
  titulo: string;
  subtitulo: string;
  grupo: "Veículos" | "Motoristas" | "Linhas" | "Pontos" | "Telas";
  destino: string;
  icone: typeof Truck;
};

const TELAS: { nome: string; caminho: string; grupo: string }[] = [
  { nome: "Indicadores gerenciais", caminho: "/app/gerencial/indicadores", grupo: "Gerencial" },
  { nome: "Gestão de viagens", caminho: "/app/operacao/viagens", grupo: "Operação" },
  { nome: "Alarmes", caminho: "/app/cadastros/alarme", grupo: "Cadastros" },
  { nome: "Videotelemetria", caminho: "/app/seguranca/video", grupo: "Segurança" },
  { nome: "Ordens de serviço", caminho: "/app/frota/ordens", grupo: "Frota" },
  { nome: "Pneus", caminho: "/app/frota/pneus", grupo: "Frota" },
  { nome: "Manutenção", caminho: "/app/frota/manutencao", grupo: "Frota" },
  { nome: "Telemetria de equipamentos", caminho: "/app/frota/telemetria", grupo: "Frota" },
  { nome: "Jornada de trabalho", caminho: "/app/pessoas/jornada", grupo: "Pessoas" },
  { nome: "Multas", caminho: "/app/pessoas/multas", grupo: "Pessoas" },
  { nome: "Painel sinótico", caminho: "/app/operacao/sinotico", grupo: "Fretamento" },
  { nome: "Metas e pesos", caminho: "/app/premiacao/metas", grupo: "Premiação" },
  { nome: "Auditoria", caminho: "/app/auditoria", grupo: "Sistema" },
  { nome: "Linhas", caminho: "/app/cadastros/linhas", grupo: "Cadastros" },
  { nome: "Pontos de parada", caminho: "/app/cadastros/pontos", grupo: "Cadastros" },
  { nome: "Garagens", caminho: "/app/cadastros/garagens", grupo: "Cadastros" },
  { nome: "Usuários", caminho: "/app/cadastros/usuarios", grupo: "Cadastros" },
];

export function BuscaGlobal() {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Só busca dados quando o painel abre — não custa nada no carregamento.
  const veiculosQ = useQuery({ ...veiculosQuery(1, 200), enabled: aberto });
  const motoristasQ = useQuery({ ...motoristasListQuery(), enabled: aberto });
  const linhasQ = useQuery({ ...linhasQuery(), enabled: aberto });
  const pontosQ = useQuery({ ...pontosQuery(), enabled: aberto });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((a) => !a);
      }
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 40);
    else {
      setTermo("");
      setCursor(0);
    }
  }, [aberto]);

  const resultados = useMemo<Resultado[]>(() => {
    const t = termo.trim().toLowerCase();
    if (!t) return [];
    const out: Resultado[] = [];

    for (const v of veiculosQ.data?.items ?? []) {
      if ((v.prefixo ?? "").toLowerCase().includes(t) || v.placa.toLowerCase().includes(t) || `${v.marca} ${v.modelo}`.toLowerCase().includes(t)) {
        out.push({
          id: `v-${v.id}`,
          titulo: `${v.prefixo ?? v.placa}`,
          subtitulo: `${v.placa} · ${v.marca} ${v.modelo}`,
          grupo: "Veículos",
          destino: `/app/frota/manutencao?placa=${v.placa}`,
          icone: Truck,
        });
      }
    }
    for (const m of motoristasQ.data?.items ?? []) {
      if (m.nome.toLowerCase().includes(t)) {
        out.push({
          id: `m-${m.id}`,
          titulo: m.nome,
          subtitulo: `${m.filial} · nota ${m.notaGeral}`,
          grupo: "Motoristas",
          destino: `/app/motoristas/perfil/${encodeURIComponent(m.nome)}`,
          icone: User,
        });
      }
    }
    for (const l of linhasQ.data ?? []) {
      if (l.codigo.toLowerCase().includes(t) || l.nome.toLowerCase().includes(t)) {
        out.push({ id: `l-${l.id}`, titulo: l.codigo, subtitulo: l.nome, grupo: "Linhas", destino: `/app/cadastros/linhas`, icone: Route });
      }
    }
    for (const p of pontosQ.data ?? []) {
      if (p.codigo.toLowerCase().includes(t) || p.nome.toLowerCase().includes(t)) {
        out.push({ id: `p-${p.id}`, titulo: p.codigo, subtitulo: p.nome, grupo: "Pontos", destino: `/app/cadastros/pontos`, icone: MapPin });
      }
    }
    for (const tela of TELAS) {
      if (tela.nome.toLowerCase().includes(t) || tela.grupo.toLowerCase().includes(t)) {
        out.push({ id: `t-${tela.caminho}`, titulo: tela.nome, subtitulo: tela.grupo, grupo: "Telas", destino: tela.caminho, icone: LayoutGrid });
      }
    }
    return out.slice(0, 24);
  }, [termo, veiculosQ.data, motoristasQ.data, linhasQ.data, pontosQ.data]);

  const abrir = (r: Resultado) => {
    setAberto(false);
    navigate(r.destino);
  };

  useEffect(() => {
    if (!aberto) return;
    const onNav = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(resultados.length - 1, c + 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      }
      if (e.key === "Enter" && resultados[cursor]) {
        e.preventDefault();
        abrir(resultados[cursor]);
      }
    };
    document.addEventListener("keydown", onNav);
    return () => document.removeEventListener("keydown", onNav);
  });

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        title="Buscar (Ctrl+K)"
        className="fixed bottom-[88px] right-6 z-[150] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-brand-navy shadow-elegant transition-transform hover:-translate-y-0.5 lg:h-auto lg:w-auto lg:gap-2 lg:px-4"
      >
        <Search className="h-4 w-4" />
        <span className="hidden text-[13px] font-medium lg:inline">Buscar</span>
        <kbd className="hidden rounded border border-border bg-secondary px-1.5 font-mono text-[10.5px] text-muted-foreground lg:inline">
          ⌘K
        </kbd>
      </button>
    );
  }

  let grupoAtual = "";

  return (
    <div className="fixed inset-0 z-[400] flex items-start justify-center pt-[12vh]">
      <button aria-label="Fechar" onClick={() => setAberto(false)} className="absolute inset-0 bg-[oklch(0.15_0.03_260)]/45 backdrop-blur-[2px]" />

      <div role="dialog" aria-label="Busca global" className="relative w-full max-w-[620px] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-12px_rgba(0,0,0,0.4)]">
        <div className="relative border-b border-border">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setCursor(0);
            }}
            placeholder="Prefixo, placa, motorista, linha, ponto ou tela…"
            className="h-14 w-full bg-transparent pl-11 pr-4 text-[15px] outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-1.5">
          {!termo.trim() ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              Digite para buscar em veículos, motoristas, linhas, pontos e telas.
            </p>
          ) : resultados.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
              Nada encontrado para <strong>{termo}</strong>.
            </p>
          ) : (
            resultados.map((r, i) => {
              const novoGrupo = r.grupo !== grupoAtual;
              grupoAtual = r.grupo;
              return (
                <div key={r.id}>
                  {novoGrupo && (
                    <div className="px-4 pb-1 pt-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {r.grupo}
                    </div>
                  )}
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => abrir(r)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                      cursor === i ? "bg-navy-tint" : "hover:bg-secondary",
                    )}
                  >
                    <r.icone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-foreground">{r.titulo}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">{r.subtitulo}</span>
                    </span>
                    {cursor === i && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑ ↓ navegar · Enter abrir · Esc fechar</span>
          <span>{resultados.length} resultados</span>
        </div>
      </div>
    </div>
  );
}
