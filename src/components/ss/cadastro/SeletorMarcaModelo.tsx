import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Factory, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { modelosQuery, montadorasQuery, parametrosCatalogoQuery } from "@/lib/queries";
import { acrescentar, registrarAuditoria } from "@/lib/session";
import type { ModeloVeiculo, Montadora } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Seleção de marca do chassi e modelo, no cadastro de veículo.
 *
 * São dois campos obrigatórios e encadeados: a lista de modelos só mostra os da
 * marca escolhida. Isso existe porque o veículo precisa estar amarrado a um
 * modelo do catálogo — sem isso o sistema não sabe quais parâmetros de
 * manutenção preventiva aplicar, e digitação livre produziria "Mercedes",
 * "Mercedez", "MB" e "Mercedes-Benz" como quatro marcas distintas.
 *
 * Quando o modelo não existe, ele é criado na hora — travar o cadastro seria
 * pior, porque o veículo precisa entrar em operação hoje. Mas o modelo nasce
 * marcado como pendente e gera alerta para o administrador configurar os
 * parâmetros, senão o veículo silenciosamente nunca geraria preventiva.
 */

export type SelecaoVeiculo = {
  montadoraId: string;
  montadoraNome: string;
  modeloId: string;
  modeloNome: string;
};

export function SeletorMarcaModelo({
  valor,
  onChange,
}: {
  valor: Partial<SelecaoVeiculo>;
  onChange: (v: SelecaoVeiculo) => void;
}) {
  const montadorasQ = useQuery(montadorasQuery());
  const modelosQ = useQuery(modelosQuery());
  const parametrosQ = useQuery(parametrosCatalogoQuery());

  const [novasMarcas, setNovasMarcas] = useState<Montadora[]>([]);
  const [novosModelos, setNovosModelos] = useState<ModeloVeiculo[]>([]);
  const [buscaModelo, setBuscaModelo] = useState("");
  const [criandoMarca, setCriandoMarca] = useState(false);
  const [nomeNovaMarca, setNomeNovaMarca] = useState("");

  const montadoras = [...(montadorasQ.data ?? []), ...novasMarcas];
  const modelos = [...(modelosQ.data ?? []), ...novosModelos];
  const parametros = parametrosQ.data ?? [];

  const daMarca = useMemo(
    () => modelos.filter((m) => m.montadoraId === valor.montadoraId),
    [modelos, valor.montadoraId],
  );

  const filtrados = useMemo(() => {
    const t = buscaModelo.trim().toLowerCase();
    if (!t) return daMarca;
    return daMarca.filter((m) => m.nome.toLowerCase().includes(t) || (m.motor ?? "").toLowerCase().includes(t));
  }, [daMarca, buscaModelo]);

  /** Modelo sem parâmetro utilizável não gera preventiva — o cadastro avisa. */
  const semParametros = (modeloId: string) => {
    const ps = parametros.filter((p) => p.modeloId === modeloId);
    if (!ps.length) return true;
    return ps.every((p) => !p.intervaloKm && !p.intervaloMeses && !p.intervaloHoras);
  };

  const escolherMarca = (m: Montadora) => {
    onChange({ montadoraId: m.id, montadoraNome: m.nome, modeloId: "", modeloNome: "" });
    setBuscaModelo("");
  };

  const escolherModelo = (m: ModeloVeiculo) => {
    onChange({
      montadoraId: valor.montadoraId!,
      montadoraNome: valor.montadoraNome!,
      modeloId: m.id,
      modeloNome: m.nome,
    });
  };

  const criarMarca = () => {
    const nome = nomeNovaMarca.trim();
    if (!nome) return;
    const nova: Montadora = { id: `mt-${Date.now()}`, nome, tipo: "chassi", criadaAutomaticamente: true };
    setNovasMarcas((l) => [...l, nova]);
    acrescentar("montadoras-pendentes", nova);
    registrarAuditoria("catalogo_manutencao", `Marca criada no cadastro de veículo: ${nome}.`);
    escolherMarca(nova);
    setCriandoMarca(false);
    setNomeNovaMarca("");
    toast.warning(`Marca "${nome}" criada.`, {
      description: "Sem parâmetros de manutenção. O administrador precisa configurá-los.",
    });
  };

  const criarModelo = () => {
    const nome = buscaModelo.trim();
    if (!nome || !valor.montadoraId) return;
    const novo: ModeloVeiculo = {
      id: `md-${Date.now()}`,
      montadoraId: valor.montadoraId,
      nome,
      pendenteConfiguracao: true,
      criadoEm: new Date().toISOString(),
    };
    setNovosModelos((l) => [...l, novo]);
    acrescentar("modelos-pendentes", novo);
    registrarAuditoria(
      "catalogo_manutencao",
      `Modelo criado no cadastro de veículo: ${valor.montadoraNome} · ${nome}. Pendente de parâmetros.`,
    );
    escolherModelo(novo);
    setBuscaModelo("");
    toast.warning(`Modelo "${nome}" criado.`, {
      description: "Ainda sem parâmetros de manutenção — o administrador foi notificado.",
    });
  };

  const modeloSelecionado = modelos.find((m) => m.id === valor.modeloId);

  return (
    <div className="space-y-4">
      {/* Marca do chassi. */}
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
          Marca do chassi <span className="text-coral">*</span>
        </label>

        {criandoMarca ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={nomeNovaMarca}
              onChange={(e) => setNomeNovaMarca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && criarMarca()}
              placeholder="Nome da nova marca"
              className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-[14px] outline-none focus:border-accent"
            />
            <button
              onClick={criarMarca}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-brand-navy px-3 text-[13px] font-semibold text-white"
            >
              <Check className="h-4 w-4" />
              Criar
            </button>
            <button
              onClick={() => setCriandoMarca(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={valor.montadoraId ?? ""}
              onChange={(e) => {
                const m = montadoras.find((x) => x.id === e.target.value);
                if (m) escolherMarca(m);
              }}
              className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-[14px] outline-none focus:border-accent"
            >
              <option value="">Selecione a marca…</option>
              {montadoras.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                  {m.criadaAutomaticamente ? "  (nova)" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => setCriandoMarca(true)}
              title="Cadastrar marca que não está na lista"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-brand-navy hover:bg-secondary"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Modelo — só depois da marca. */}
      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-ink-soft">
          Modelo <span className="text-coral">*</span>
        </label>

        {!valor.montadoraId ? (
          <p className="rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2.5 text-[13px] text-muted-foreground">
            Escolha a marca do chassi para listar os modelos.
          </p>
        ) : (
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={valor.modeloId ? (modeloSelecionado?.nome ?? "") : buscaModelo}
                onChange={(e) => {
                  setBuscaModelo(e.target.value);
                  if (valor.modeloId) {
                    onChange({
                      montadoraId: valor.montadoraId!,
                      montadoraNome: valor.montadoraNome!,
                      modeloId: "",
                      modeloNome: "",
                    });
                  }
                }}
                placeholder="Buscar ou digitar o modelo…"
                className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-3 text-[14px] outline-none focus:border-accent"
              />
            </div>

            {!valor.modeloId && (
              <div className="mt-1.5 max-h-52 overflow-y-auto rounded-lg border border-border bg-card">
                {filtrados.length === 0 ? (
                  <div className="p-3">
                    <p className="text-[13px] text-muted-foreground">
                      Nenhum modelo desta marca com esse nome.
                    </p>
                    {buscaModelo.trim() && (
                      <button
                        onClick={criarModelo}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-navy px-3 py-1.5 text-[13px] font-semibold text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Criar modelo &quot;{buscaModelo.trim()}&quot;
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="py-1">
                    {filtrados.map((m) => (
                      <li key={m.id}>
                        <button
                          onClick={() => escolherModelo(m)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-secondary"
                        >
                          <Factory className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-foreground">{m.nome}</span>
                            {m.motor && (
                              <span className="block truncate text-[12px] text-muted-foreground">{m.motor}</span>
                            )}
                          </span>
                          {semParametros(m.id) && (
                            <span className="shrink-0 rounded bg-gold-tint px-1.5 py-0.5 text-[12px] font-semibold text-gold">
                              sem parâmetros
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                    {buscaModelo.trim() && !filtrados.some((m) => m.nome.toLowerCase() === buscaModelo.trim().toLowerCase()) && (
                      <li className="border-t border-border">
                        <button
                          onClick={criarModelo}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-brand-navy transition-colors hover:bg-secondary"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Criar modelo &quot;{buscaModelo.trim()}&quot;
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Aviso quando o modelo escolhido não gera preventiva. */}
      {valor.modeloId && semParametros(valor.modeloId) && (
        <div className="flex items-start gap-2.5 rounded-lg border border-gold-line bg-gold-tint/40 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <p className="text-[13px] text-gold">
            <strong>Este modelo ainda não tem parâmetros de manutenção.</strong> O veículo será cadastrado
            normalmente, mas não vai gerar alerta de preventiva até que o administrador configure os intervalos no
            catálogo. Ele já foi notificado.
          </p>
        </div>
      )}
    </div>
  );
}
