import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpDown,
  CircleDot,
  Package,
  Plus,
  Recycle,
  Search,
  Settings,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Pill, StatTile, type PillTone } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { grupoAtivo } from "@/lib/escopo-ativo";
import {
  acaoPneu,
  cadastrarPneus,
  configPneuQuery,
  desmontarTodos,
  detalhePneuQuery,
  gravarConfigPneu,
  kmDoVeiculo,
  lerRecusa,
  pneusDoVeiculoQuery,
  pneusQuery,
  veiculosPneuQuery,
  type EventoPneu,
  type LinhaPneu,
  type ListaPneus,
  type StatusPneu,
} from "@/lib/pneus-api";
import { cn } from "@/lib/utils";

/**
 * Gestão de pneus sem sensores: MVP do documento do PM (01/11/2026). Onde está cada pneu,
 * quanto rodou e o que aconteceu com ele. O km vem do veículo; o resto, de quem registra.
 */

const TOM: Record<StatusPneu, PillTone> = {
  estoque: "sky",
  montado: "green",
  recapagem: "gold",
  reparo: "gold",
  descartado: "neutral",
};
const hojeISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const nf = (v: number | null | undefined) =>
  v == null ? "—" : Math.round(v).toLocaleString("pt-BR");
const brl = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string | null | undefined) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const campo = "h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]";
const botao =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60";
const primario = cn(botao, "bg-brand-navy text-white");
const secundario = cn(botao, "border border-border bg-white");

function Janela({
  titulo,
  aoFechar,
  children,
  largura = "max-w-[560px]",
}: {
  titulo: ReactNode;
  aoFechar: () => void;
  children: ReactNode;
  largura?: string;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[210] flex justify-center overflow-y-auto bg-[rgba(10,16,28,0.5)] p-4"
      onClick={aoFechar}
    >
      <div
        className={cn("my-auto w-full space-y-4 rounded-xl bg-white p-5 shadow-xl", largura)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[18px] font-bold">{titulo}</h2>
          <button onClick={aoFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function Campo({
  rotulo,
  children,
  obrigatorio,
}: {
  rotulo: string;
  children: ReactNode;
  obrigatorio?: boolean;
}) {
  return (
    <label className="block space-y-1 text-[12px] font-semibold text-muted-foreground">
      <span>
        {rotulo}
        {obrigatorio && <span className="text-coral"> *</span>}
      </span>
      {children}
    </label>
  );
}

const numero = (s: string) =>
  s.trim() === "" ? null : Number(s.replace(/\./g, "").replace(",", "."));

/* ------------------------------ Cadastro ------------------------------ */

function FormCadastro({
  grupo,
  lista,
  aoFechar,
  aoCriar,
}: {
  grupo: string;
  lista: ListaPneus;
  aoFechar: () => void;
  aoCriar: (id: number, montar: boolean) => void;
}) {
  const qc = useQueryClient();
  const [carga, setCarga] = useState(false);
  const [f, setF] = useState({
    fogos: "",
    marca: "",
    modelo: "",
    medida: "",
    compra_em: hojeISO(),
    preco: "",
    fornecedor: "",
    nota_fiscal: "",
    dot: "",
    tipo_uso: "",
    vida: "1",
    km_anterior: "0",
    situacao: "estoque",
  });
  const m = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  const fogos = f.fogos
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const salvar = useMutation({
    mutationFn: () =>
      cadastrarPneus({
        group_id: Number(grupo),
        fogos,
        marca: f.marca,
        modelo: f.modelo,
        medida: f.medida,
        compra_em: f.compra_em || null,
        preco: numero(f.preco),
        fornecedor: f.fornecedor || null,
        nota_fiscal: f.nota_fiscal || null,
        dot: f.dot || null,
        tipo_uso: f.tipo_uso || null,
        carga_inicial: carga,
        vida: Number(f.vida),
        km_anterior: numero(f.km_anterior) ?? 0,
      }),
    onSuccess: (r) => {
      toast.success(r.ids.length > 1 ? `${r.ids.length} pneus cadastrados.` : "Pneu cadastrado.");
      if (r.aviso) toast.warning(r.aviso);
      qc.invalidateQueries({ queryKey: ["pneus"] });
      aoCriar(r.ids[0], carga && f.situacao === "montado" && r.ids.length === 1);
    },
    onError: (e: Error) => toast.error(lerRecusa(e).mensagem),
  });
  return (
    <Janela titulo="Cadastrar pneu" aoFechar={aoFechar}>
      <div className="flex gap-2">
        <button onClick={() => setCarga(false)} className={!carga ? primario : secundario}>
          Pneu novo
        </button>
        <button onClick={() => setCarga(true)} className={carga ? primario : secundario}>
          Pneu já em uso
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo
            rotulo={`Número de fogo${fogos.length > 1 ? ` (${fogos.length} pneus)` : ""}, um por linha para cadastrar vários`}
            obrigatorio
          >
            <textarea
              value={f.fogos}
              onChange={m("fogos")}
              rows={2}
              className={cn(campo, "h-auto py-2")}
            />
          </Campo>
        </div>
        <Campo rotulo="Marca" obrigatorio>
          <input list="pneu-marcas" value={f.marca} onChange={m("marca")} className={campo} />
        </Campo>
        <Campo rotulo="Modelo" obrigatorio>
          <input value={f.modelo} onChange={m("modelo")} className={campo} />
        </Campo>
        <Campo rotulo="Medida" obrigatorio>
          <input
            list="pneu-medidas"
            value={f.medida}
            onChange={m("medida")}
            placeholder="295/80 R22.5"
            className={campo}
          />
        </Campo>
        <Campo rotulo="Data da compra" obrigatorio={!carga}>
          <input
            type="date"
            max={hojeISO()}
            value={f.compra_em}
            onChange={m("compra_em")}
            className={campo}
          />
        </Campo>
        <Campo rotulo="Preço pago (R$)" obrigatorio={!carga}>
          <input inputMode="decimal" value={f.preco} onChange={m("preco")} className={campo} />
        </Campo>
        <Campo rotulo="Fornecedor">
          <input
            list="pneu-fornecedores"
            value={f.fornecedor}
            onChange={m("fornecedor")}
            className={campo}
          />
        </Campo>
        <Campo rotulo="Nota fiscal">
          <input value={f.nota_fiscal} onChange={m("nota_fiscal")} className={campo} />
        </Campo>
        <Campo rotulo="DOT (semana e ano)">
          <input value={f.dot} onChange={m("dot")} placeholder="2524" className={campo} />
        </Campo>
        <Campo rotulo="Tipo de uso">
          <select value={f.tipo_uso} onChange={m("tipo_uso")} className={campo}>
            <option value="">—</option>
            <option>Liso</option>
            <option>Borrachudo</option>
            <option>Misto</option>
          </select>
        </Campo>
        {carga && (
          <>
            <Campo
              rotulo={`Vida atual (${Math.max(Number(f.vida) - 1, 0)} recapagens já feitas)`}
              obrigatorio
            >
              <input type="number" min={1} value={f.vida} onChange={m("vida")} className={campo} />
            </Campo>
            <Campo rotulo="Km rodado antes da SS (informado)">
              <input
                inputMode="numeric"
                value={f.km_anterior}
                onChange={m("km_anterior")}
                className={campo}
              />
            </Campo>
            <Campo rotulo="Situação inicial" obrigatorio>
              <select value={f.situacao} onChange={m("situacao")} className={campo}>
                <option value="estoque">Em estoque</option>
                <option value="montado">Montado</option>
              </select>
            </Campo>
          </>
        )}
      </div>
      <datalist id="pneu-marcas">
        {[
          ...new Set([
            ...lista.sugestoes.marca,
            "Michelin",
            "Pirelli",
            "Goodyear",
            "Bridgestone",
            "Continental",
          ]),
        ].map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>
      <datalist id="pneu-medidas">
        {[
          ...new Set([
            ...lista.sugestoes.medida,
            "295/80 R22.5",
            "275/80 R22.5",
            "215/75 R17.5",
            "225/75 R16",
          ]),
        ].map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>
      <datalist id="pneu-fornecedores">
        {lista.sugestoes.fornecedor.map((x) => (
          <option key={x} value={x} />
        ))}
      </datalist>
      <button
        onClick={() => salvar.mutate()}
        disabled={salvar.isPending || !fogos.length || !f.marca || !f.modelo || !f.medida}
        className={primario}
      >
        Salvar
      </button>
    </Janela>
  );
}

/* ------------------------------- Ações ------------------------------- */

type Acao =
  "montar" | "desmontar" | "rodizio" | "mover" | "ocorrencia" | "recapagem" | "reparo" | "retorno";
const TITULO: Record<Acao, string> = {
  montar: "Montar",
  desmontar: "Desmontar",
  rodizio: "Rodízio",
  mover: "Mover para outro veículo",
  ocorrencia: "Registrar ocorrência",
  recapagem: "Enviar para recapagem",
  reparo: "Enviar para reparo",
  retorno: "Registrar retorno",
};

function FormAcao({
  p,
  acao,
  lista,
  inicial,
  aoFechar,
  aoAbrirPneu,
}: {
  p: LinhaPneu;
  acao: Acao;
  lista: ListaPneus;
  inicial?: { unit_id: number; posicao?: string; modelo_eixos?: string };
  aoFechar: () => void;
  aoAbrirPneu: (id: number) => void;
}) {
  const qc = useQueryClient();
  const veiculos = useQuery(veiculosPneuQuery(p.group_id));
  const [f, setF] = useState({
    data: hojeISO(),
    km: "",
    km_entrada: "",
    unit: inicial ? String(inicial.unit_id) : "",
    posicao: inicial?.posicao ?? "",
    modelo_eixos: inicial?.modelo_eixos ?? "",
    motivo: acao === "rodizio" ? "Rodízio" : "",
    destino: "estoque",
    fornecedor: "",
    prazo: "",
    banda: "",
    custo: "",
    tipo: lista.tipos_ocorrencia[0],
    gravidade: "media",
    local: "",
    resultado: lista.resultados_ocorrencia[0],
    obs: "",
    aprovado: "sim",
    garantia: "",
  });
  const [recusa, setRecusa] = useState<ReturnType<typeof lerRecusa> | null>(null);
  const m = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  const lista_v = useMemo(() => veiculos.data?.veiculos ?? [], [veiculos.data]);
  const destino =
    acao === "montar" || acao === "mover"
      ? lista_v.find((v) => String(v.unit_id) === f.unit)
      : undefined;
  const modeloDestino = f.modelo_eixos || destino?.modelo_eixos || "";
  const qVeiculo = useQuery(
    pneusDoVeiculoQuery(p.group_id, acao === "rodizio" ? p.unit_id : (destino?.unit_id ?? null)),
  );
  const posicoes =
    acao === "rodizio"
      ? (qVeiculo.data?.posicoes ?? [])
      : (lista.modelos_eixos.find((x) => x.chave === modeloDestino)?.posicoes ?? []);
  const ocupada = (chave: string) =>
    qVeiculo.data?.posicoes.find((x) => x.chave === chave)?.pneu?.fogo;

  // Km automático: atual para hoje; histórico para data passada, se houver. O usuário confirma ou corrige.
  const unitDoKm = acao === "montar" ? destino?.unit_id : p.unit_id;
  useEffect(() => {
    if (!unitDoKm || !["montar", "desmontar", "rodizio", "mover", "ocorrencia"].includes(acao))
      return;
    kmDoVeiculo(p.group_id, unitDoKm, f.data)
      .then((r) => setF((x) => ({ ...x, km: r.km != null ? String(r.km) : "" })))
      .catch(() => undefined);
  }, [unitDoKm, f.data, acao, p.group_id]);
  useEffect(() => {
    if (acao !== "mover" || !destino) return;
    kmDoVeiculo(p.group_id, destino.unit_id, f.data)
      .then((r) => setF((x) => ({ ...x, km_entrada: r.km != null ? String(r.km) : "" })))
      .catch(() => undefined);
  }, [destino, f.data, acao, p.group_id]);

  const enviar = useMutation({
    mutationFn: (confirmar: boolean) => {
      const km = numero(f.km);
      if (acao === "montar")
        return acaoPneu(p.id, "montar", {
          unit_id: Number(f.unit),
          posicao: f.posicao,
          modelo_eixos: modeloDestino || null,
          data: f.data,
          km,
          confirmar,
        });
      if (acao === "desmontar")
        return acaoPneu(p.id, "desmontar", {
          data: f.data,
          km,
          motivo: f.motivo,
          destino: f.destino,
          fornecedor: f.fornecedor || null,
          prazo_dias: numero(f.prazo),
          confirmar,
        });
      if (acao === "rodizio")
        return acaoPneu(p.id, "rodizio", {
          posicao: f.posicao,
          data: f.data,
          km,
          motivo: f.motivo,
          confirmar,
        });
      if (acao === "mover")
        return acaoPneu(p.id, "mover", {
          unit_id: Number(f.unit),
          posicao: f.posicao,
          modelo_eixos: modeloDestino || null,
          data: f.data,
          km_saida: km,
          km_entrada: numero(f.km_entrada),
          motivo: f.motivo,
          confirmar,
        });
      if (acao === "ocorrencia")
        return acaoPneu(p.id, "ocorrencia", {
          tipo: f.tipo,
          data: f.data,
          km,
          gravidade: f.gravidade,
          custo: numero(f.custo),
          local: f.local || null,
          resultado: f.resultado,
          observacao: f.obs || null,
        });
      if (acao === "retorno")
        return acaoPneu(p.id, "servico/retorno", {
          data: f.data,
          custo: numero(f.custo),
          aprovado: f.aprovado === "sim",
          garantia: f.garantia || null,
        });
      return acaoPneu(p.id, "servico/enviar", {
        tipo: acao,
        fornecedor: f.fornecedor || null,
        data: f.data,
        prazo_dias: numero(f.prazo),
        banda: f.banda || null,
        custo_previsto: numero(f.custo),
      });
    },
    onSuccess: () => {
      toast.success("Registrado.");
      qc.invalidateQueries({ queryKey: ["pneus"] });
      aoFechar();
    },
    onError: (e: Error) => setRecusa(lerRecusa(e)),
  });

  const pedeVeiculo = acao === "montar" || acao === "mover";
  const pedeKm =
    acao === "montar" || acao === "desmontar" || acao === "rodizio" || acao === "mover";
  const pedeMotivo = acao === "desmontar" || acao === "rodizio" || acao === "mover";
  const pronto =
    Boolean(f.data) &&
    (!pedeVeiculo || Boolean(f.unit && modeloDestino && f.posicao)) &&
    (acao !== "rodizio" || Boolean(f.posicao)) &&
    (!pedeKm || f.km !== "") &&
    (acao !== "mover" || f.km_entrada !== "") &&
    (!pedeMotivo || Boolean(f.motivo));

  return (
    <Janela titulo={`${TITULO[acao]} · ${p.fogo}`} aoFechar={aoFechar}>
      <div className="grid gap-3 sm:grid-cols-2">
        {pedeVeiculo && (
          <>
            <Campo rotulo={acao === "mover" ? "Nova placa" : "Placa"} obrigatorio>
              <select
                value={f.unit}
                onChange={(e) =>
                  setF((x) => ({ ...x, unit: e.target.value, posicao: "", modelo_eixos: "" }))
                }
                className={campo}
              >
                <option value="">{veiculos.isPending ? "Carregando…" : "Escolha"}</option>
                {lista_v
                  .filter((v) => acao !== "mover" || v.unit_id !== p.unit_id)
                  .map((v) => (
                    <option key={v.unit_id} value={v.unit_id}>
                      {v.placa}
                      {v.prefixo ? ` · ${v.prefixo}` : ""}
                    </option>
                  ))}
              </select>
            </Campo>
            <Campo rotulo="Modelo de eixos do veículo" obrigatorio>
              <select
                value={modeloDestino}
                onChange={(e) => setF((x) => ({ ...x, modelo_eixos: e.target.value, posicao: "" }))}
                className={campo}
              >
                <option value="">Escolha</option>
                {lista.modelos_eixos.map((x) => (
                  <option key={x.chave} value={x.chave}>
                    {x.rotulo}
                  </option>
                ))}
              </select>
            </Campo>
          </>
        )}
        {(pedeVeiculo || acao === "rodizio") && (
          <Campo rotulo={acao === "rodizio" ? "Nova posição" : "Posição"} obrigatorio>
            <select value={f.posicao} onChange={m("posicao")} className={campo}>
              <option value="">Escolha</option>
              {posicoes
                .filter((x) => acao !== "rodizio" || x.chave !== p.posicao)
                .map((x) => (
                  <option key={x.chave} value={x.chave}>
                    {x.rotulo}
                    {ocupada(x.chave) ? ` (${ocupada(x.chave)})` : ""}
                  </option>
                ))}
            </select>
          </Campo>
        )}
        <Campo
          rotulo={
            acao === "retorno"
              ? "Data do retorno"
              : acao === "recapagem" || acao === "reparo"
                ? "Data do envio"
                : "Data"
          }
          obrigatorio
        >
          <input
            type="date"
            max={hojeISO()}
            value={f.data}
            onChange={m("data")}
            className={campo}
          />
        </Campo>
        {(pedeKm || acao === "ocorrencia") && (
          <Campo
            rotulo={acao === "mover" ? `Km de saída (${p.placa})` : "Km do veículo"}
            obrigatorio={pedeKm}
          >
            <input inputMode="numeric" value={f.km} onChange={m("km")} className={campo} />
          </Campo>
        )}
        {acao === "mover" && (
          <Campo rotulo="Km de entrada (nova placa)" obrigatorio>
            <input
              inputMode="numeric"
              value={f.km_entrada}
              onChange={m("km_entrada")}
              className={campo}
            />
          </Campo>
        )}
        {pedeMotivo && (
          <Campo rotulo="Motivo" obrigatorio>
            <select value={f.motivo} onChange={m("motivo")} className={campo}>
              <option value="">Escolha</option>
              {lista.motivos_saida.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Campo>
        )}
        {acao === "desmontar" && (
          <Campo rotulo="Destino do pneu" obrigatorio>
            <select value={f.destino} onChange={m("destino")} className={campo}>
              <option value="estoque">Em estoque</option>
              <option value="recapagem">Em recapagem</option>
              <option value="reparo">Em reparo</option>
              <option value="descartado">Descartado</option>
            </select>
          </Campo>
        )}
        {(acao === "recapagem" ||
          acao === "reparo" ||
          (acao === "desmontar" && (f.destino === "recapagem" || f.destino === "reparo"))) && (
          <>
            <Campo rotulo="Fornecedor">
              <input
                list="pneu-forn-acao"
                value={f.fornecedor}
                onChange={m("fornecedor")}
                className={campo}
              />
              <datalist id="pneu-forn-acao">
                {lista.sugestoes.fornecedor.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
            </Campo>
            <Campo rotulo="Prazo informado (dias)">
              <input inputMode="numeric" value={f.prazo} onChange={m("prazo")} className={campo} />
            </Campo>
          </>
        )}
        {acao === "recapagem" && (
          <Campo rotulo="Tipo ou marca da banda">
            <input value={f.banda} onChange={m("banda")} className={campo} />
          </Campo>
        )}
        {acao === "ocorrencia" && (
          <>
            <Campo rotulo="Tipo" obrigatorio>
              <select value={f.tipo} onChange={m("tipo")} className={campo}>
                {lista.tipos_ocorrencia.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Gravidade">
              <select value={f.gravidade} onChange={m("gravidade")} className={campo}>
                <option value="leve">Leve</option>
                <option value="media">Média</option>
                <option value="grave">Grave</option>
              </select>
            </Campo>
            <Campo rotulo="Local">
              <select value={f.local} onChange={m("local")} className={campo}>
                <option value="">—</option>
                <option>Estrada</option>
                <option>Oficina</option>
              </select>
            </Campo>
            <Campo rotulo="Resultado" obrigatorio>
              <select value={f.resultado} onChange={m("resultado")} className={campo}>
                {lista.resultados_ocorrencia.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Campo>
            <div className="sm:col-span-2">
              <Campo rotulo="Observação" obrigatorio={f.tipo === "Outro"}>
                <textarea
                  value={f.obs}
                  onChange={m("obs")}
                  rows={2}
                  className={cn(campo, "h-auto py-2")}
                />
              </Campo>
            </div>
          </>
        )}
        {(acao === "ocorrencia" || acao === "retorno" || acao === "recapagem") && (
          <Campo
            rotulo={
              acao === "recapagem"
                ? "Custo previsto (R$)"
                : acao === "retorno"
                  ? "Custo final (R$)"
                  : "Custo (R$)"
            }
          >
            <input inputMode="decimal" value={f.custo} onChange={m("custo")} className={campo} />
          </Campo>
        )}
        {acao === "retorno" && (
          <>
            <Campo rotulo="Resultado" obrigatorio>
              <select value={f.aprovado} onChange={m("aprovado")} className={campo}>
                <option value="sim">Aprovado</option>
                <option value="nao">
                  {p.status === "recapagem"
                    ? "Reprovado (vai para descarte)"
                    : "Reparo inviável (vai para descarte)"}
                </option>
              </select>
            </Campo>
            <Campo rotulo="Garantia (km ou dias)">
              <input value={f.garantia} onChange={m("garantia")} className={campo} />
            </Campo>
          </>
        )}
      </div>
      {recusa && (
        <div className="space-y-2 rounded-xl border border-coral-line bg-coral-tint/50 px-4 py-3 text-[13px] text-coral">
          <p>{recusa.mensagem}</p>
          {recusa.codigo === "km_inconsistente" && (
            <button onClick={() => enviar.mutate(true)} className="font-semibold underline">
              Confirmar mesmo assim
            </button>
          )}
          {recusa.codigo === "posicao_ocupada" && recusa.pneu_id && (
            <button
              onClick={() => aoAbrirPneu(recusa.pneu_id!)}
              className="font-semibold underline"
            >
              Abrir o pneu que está lá
            </button>
          )}
        </div>
      )}
      <button
        onClick={() => {
          setRecusa(null);
          enviar.mutate(false);
        }}
        disabled={enviar.isPending || !pronto}
        className={primario}
      >
        Salvar
      </button>
    </Janela>
  );
}

/* ------------------------------ Detalhe ------------------------------ */

const ROTULO_EVENTO: Record<string, string> = {
  compra: "Compra",
  carga_inicial: "Carga inicial",
  montagem: "Montagem",
  rodizio: "Rodízio",
  mudanca_veiculo: "Mudança de veículo",
  desmontagem: "Desmontagem",
  ocorrencia: "Ocorrência",
  envio_recapagem: "Envio para recapagem",
  retorno_recapagem: "Retorno da recapagem",
  envio_reparo: "Envio para reparo",
  retorno_reparo: "Retorno do reparo",
  descarte: "Descarte",
};

const posicaoTexto = (k: unknown) => {
  const c = String(k ?? "");
  if (c === "ESTEPE") return "Estepe";
  if (!c) return "";
  return `${c[0]}º eixo ${c[1] === "E" ? "esquerdo" : "direito"}${c[2] === "I" ? " interno" : c[2] === "X" ? " externo" : ""}`;
};

function textoEvento(e: EventoPneu): string {
  const d = e.dados;
  const lista = (...x: (string | number | false | null | undefined)[]) =>
    x.filter(Boolean).join(" · ");
  const km = (v: unknown) => (v == null ? null : `${nf(Number(v))} km`);
  switch (e.tipo) {
    case "compra":
      return lista(
        brl(Number(d.preco)),
        d.fornecedor && String(d.fornecedor),
        d.nota_fiscal && `NF ${d.nota_fiscal}`,
      );
    case "carga_inicial":
      return lista(
        `${d.vida_informada}ª vida`,
        `${d.recapagens} recapagens`,
        `${nf(Number(d.km_informado))} km informados pelo usuário`,
        d.preco != null ? brl(Number(d.preco)) : "Preço não informado",
      );
    case "montagem":
      return lista(posicaoTexto(d.posicao), km(d.km));
    case "rodizio":
      return `${posicaoTexto(d.de)} → ${posicaoTexto(d.para)} · ${km(d.km)}`;
    case "mudanca_veiculo":
      return lista(`${d.de_placa} → ${d.para_placa}`, posicaoTexto(d.posicao), String(d.motivo));
    case "desmontagem":
      return lista(
        `${nf(Number(d.km_rodado))} km rodados`,
        posicaoTexto(d.posicao),
        String(d.motivo),
      );
    case "ocorrencia":
      return lista(
        String(d.tipo),
        `gravidade ${d.gravidade === "media" ? "média" : d.gravidade}`,
        e.custo != null && brl(e.custo),
        km(d.km),
        d.placa && String(d.placa),
        posicaoTexto(d.posicao),
        String(d.resultado),
        d.observacao && String(d.observacao),
      );
    case "envio_recapagem":
    case "envio_reparo":
      return lista(d.numero && `${d.numero}ª recapagem`, d.fornecedor && String(d.fornecedor));
    case "retorno_recapagem":
    case "retorno_reparo":
      return lista(
        String(d.resultado),
        e.custo != null && brl(e.custo),
        d.fornecedor && String(d.fornecedor),
      );
    case "descarte":
      return String(d.motivo ?? "");
    default:
      return "";
  }
}

function DetalhePneuLateral({
  id,
  lista,
  aoFechar,
  aoAbrirPneu,
  aoAbrirVeiculo,
}: {
  id: number;
  lista: ListaPneus;
  aoFechar: () => void;
  aoAbrirPneu: (id: number) => void;
  aoAbrirVeiculo: (unit: number) => void;
}) {
  const q = useQuery(detalhePneuQuery(id));
  const [acao, setAcao] = useState<Acao | null>(null);
  const [fTipo, setFTipo] = useState("");
  const [fVida, setFVida] = useState("");
  const [fOcorrencia, setFOcorrencia] = useState("");
  const [antigos, setAntigos] = useState(false);
  const [servicoAberto, setServicoAberto] = useState<number | null>(null);
  const d = q.data;
  const eventos = useMemo(() => {
    const x = (d?.eventos ?? []).filter(
      (e) =>
        (!fTipo || e.tipo === fTipo) &&
        (!fVida || e.vida === Number(fVida)) &&
        (!fOcorrencia || e.dados.tipo === fOcorrencia),
    );
    return antigos ? [...x].reverse() : x;
  }, [d, fTipo, fVida, fOcorrencia, antigos]);
  const p = d?.pneu;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex justify-end bg-[rgba(10,16,28,0.4)]"
      onClick={aoFechar}
    >
      <aside
        className="h-full w-full max-w-[600px] space-y-5 overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[20px] font-bold">{p ? `Pneu ${p.fogo}` : "Pneu"}</h2>
          <button onClick={aoFechar} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>
        {q.error ? (
          <ErrorBox error={q.error} onRetry={() => q.refetch()} />
        ) : !d || !p ? (
          <SkeletonRows rows={8} />
        ) : (
          <>
            <section className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold">
                  {p.marca} {p.modelo} · {p.medida}
                </span>
                <Pill tone={TOM[p.status]}>{p.status_rotulo}</Pill>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-3">
                <Info
                  rotulo="Onde está"
                  valor={
                    p.placa
                      ? `${p.placa}, ${p.posicao_rotulo}`
                      : p.servico
                        ? `${p.servico.fornecedor ?? "Fornecedor"}, desde ${dataBR(p.servico.enviado_em)}`
                        : "—"
                  }
                />
                <Info rotulo="Vida atual" valor={`${p.vida}ª`} />
                <Info rotulo="Recapagens" valor={`${p.recapagens} de ${d.limite_recapagens}`} />
                <Info rotulo="Km total" valor={`${nf(p.km_total)} km`} />
                <Info rotulo="Km medido" valor={`${nf(p.km_medido)} km`} />
                {p.km_informado > 0 && (
                  <Info rotulo="Informado pelo usuário" valor={`${nf(p.km_informado)} km`} />
                )}
                <Info
                  rotulo="Custo acumulado"
                  valor={p.preco_informado ? brl(p.custo_acumulado) : "Preço não informado"}
                />
                <Info rotulo="Km médio por vida" valor={`${nf(d.km_medio_por_vida)} km`} />
              </div>
              {p.fonte_km && (
                <p className="text-[12px] text-muted-foreground">
                  Km do veículo vem de: {p.fonte_km}.
                </p>
              )}
              {p.km_desatualizado && (
                <Alerta>Dado desatualizado: o veículo não atualiza o km há mais de 7 dias.</Alerta>
              )}
              {p.km_inconsistente && (
                <Alerta>
                  Km inconsistente: o km atual do veículo é menor que o km da montagem. Essa
                  montagem conta como 0 km.
                </Alerta>
              )}
              {d.limite_atingido && p.status !== "descartado" && (
                <Alerta>
                  Limite de recapagens atingido: novo envio bloqueado. Avalie o descarte.
                </Alerta>
              )}
              {p.servico?.atrasado && (
                <Alerta>
                  Atrasado: há {p.servico.dias_fora} dias no fornecedor, com prazo de{" "}
                  {p.servico.prazo_dias}.
                </Alerta>
              )}
            </section>

            <div className="flex flex-wrap gap-2">
              {p.status === "estoque" && (
                <>
                  <button className={primario} onClick={() => setAcao("montar")}>
                    Montar
                  </button>
                  <button
                    className={secundario}
                    disabled={d.limite_atingido}
                    onClick={() => setAcao("recapagem")}
                  >
                    Enviar para recapagem
                  </button>
                  <button className={secundario} onClick={() => setAcao("reparo")}>
                    Enviar para reparo
                  </button>
                </>
              )}
              {p.status === "montado" && (
                <>
                  <button className={primario} onClick={() => setAcao("desmontar")}>
                    Desmontar
                  </button>
                  <button className={secundario} onClick={() => setAcao("rodizio")}>
                    Rodízio
                  </button>
                  <button className={secundario} onClick={() => setAcao("mover")}>
                    Mover de veículo
                  </button>
                </>
              )}
              {(p.status === "recapagem" || p.status === "reparo") && (
                <button className={primario} onClick={() => setAcao("retorno")}>
                  Registrar retorno
                </button>
              )}
              {p.status !== "descartado" && (
                <button className={secundario} onClick={() => setAcao("ocorrencia")}>
                  Registrar ocorrência
                </button>
              )}
            </div>

            <section>
              <h3 className="mb-2 text-[14px] font-bold">Km por vida</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="text-left text-[12px] text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3 font-semibold">Vida</th>
                      <th className="py-1 pr-3 text-right font-semibold">Km rodado</th>
                      <th className="py-1 pr-3 text-right font-semibold">Montagens</th>
                      <th className="py-1 pr-3 text-right font-semibold">Ocorrências</th>
                      <th className="py-1 text-right font-semibold">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.vidas.map((v) => (
                      <tr key={v.vida} className="border-t border-border/60">
                        <td className="py-1.5 pr-3">
                          {v.rotulo}
                          {v.atual && p.status !== "descartado" ? " · atual" : ""}
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono">{nf(v.km)}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">{v.montagens}</td>
                        <td className="py-1.5 pr-3 text-right font-mono">{v.ocorrencias}</td>
                        <td className="py-1.5 text-right font-mono">{brl(v.custo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-[14px] font-bold">Linha do tempo</h3>
              <div className="flex flex-wrap gap-2">
                <select
                  value={fTipo}
                  onChange={(e) => setFTipo(e.target.value)}
                  className={cn(campo, "w-auto")}
                  aria-label="Tipo de evento"
                >
                  <option value="">Todos os eventos</option>
                  {[...new Set(d.eventos.map((e) => e.tipo))].map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_EVENTO[t] ?? t}
                    </option>
                  ))}
                </select>
                <select
                  value={fVida}
                  onChange={(e) => setFVida(e.target.value)}
                  className={cn(campo, "w-auto")}
                  aria-label="Vida"
                >
                  <option value="">Todas as vidas</option>
                  {d.vidas.map((v) => (
                    <option key={v.vida} value={v.vida}>
                      {v.vida}ª vida
                    </option>
                  ))}
                </select>
                <select
                  value={fOcorrencia}
                  onChange={(e) => setFOcorrencia(e.target.value)}
                  className={cn(campo, "w-auto")}
                  aria-label="Tipo de ocorrência"
                >
                  <option value="">Toda ocorrência</option>
                  {[
                    ...new Set(
                      d.eventos
                        .filter((e) => e.tipo === "ocorrencia")
                        .map((e) => String(e.dados.tipo)),
                    ),
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <button onClick={() => setAntigos((x) => !x)} className={secundario}>
                  <ArrowUpDown className="h-3.5 w-3.5" />{" "}
                  {antigos ? "Mais antigos primeiro" : "Mais recentes primeiro"}
                </button>
              </div>
              {eventos.map((e) => {
                const placa = e.dados.placa ?? e.dados.para_placa;
                const unit = e.dados.unit_id ?? e.dados.para_unit_id;
                const servico =
                  e.tipo.startsWith("envio_") || e.tipo.startsWith("retorno_")
                    ? d.servicos.find(
                        (s) =>
                          s.tipo === e.tipo.split("_")[1] &&
                          (s.enviado_em === e.em || s.retorno_em === e.em),
                      )
                    : undefined;
                return (
                  <div key={e.id} className="border-l-2 border-border py-1 pl-3 text-[13px]">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="font-mono text-[12px] text-muted-foreground">
                        {dataBR(e.em)}
                      </span>
                      {servico ? (
                        <button
                          className="font-semibold underline"
                          onClick={() => setServicoAberto(servicoAberto === e.id ? null : e.id)}
                        >
                          {ROTULO_EVENTO[e.tipo]}
                        </button>
                      ) : (
                        <span className="font-semibold">{ROTULO_EVENTO[e.tipo] ?? e.tipo}</span>
                      )}
                      {placa && unit ? (
                        <button
                          className="font-mono text-[12px] font-semibold text-brand-navy underline"
                          onClick={() => aoAbrirVeiculo(Number(unit))}
                        >
                          {String(placa)}
                        </button>
                      ) : null}
                    </div>
                    <div className="text-ink-soft">{textoEvento(e)}</div>
                    {servico && servicoAberto === e.id && (
                      <div className="mt-1 rounded-lg bg-secondary/60 px-3 py-2 text-[12px]">
                        Fornecedor: {servico.fornecedor ?? "—"} · Enviado:{" "}
                        {dataBR(servico.enviado_em)} · Retorno: {dataBR(servico.retorno_em)} ·
                        Custo: {brl(servico.custo)} · Banda: {servico.banda ?? "—"} · Garantia:{" "}
                        {servico.garantia ?? "—"}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground">
                      Registrado por {e.registrado_por} em{" "}
                      {new Date(e.registrado_em).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                );
              })}
              {!eventos.length && <EmptyNote>Nenhum evento com esse filtro.</EmptyNote>}
            </section>
          </>
        )}
        {acao && p && (
          <FormAcao
            p={p}
            acao={acao}
            lista={lista}
            aoFechar={() => setAcao(null)}
            aoAbrirPneu={(x) => {
              setAcao(null);
              aoAbrirPneu(x);
            }}
          />
        )}
      </aside>
    </div>,
    document.body,
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{rotulo}</div>
      <div className="font-semibold">{valor}</div>
    </div>
  );
}

function Alerta({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-coral-tint/50 px-3 py-2 text-[12px] text-coral">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{children}</span>
    </p>
  );
}

/* ------------------------------ Veículo ------------------------------ */

function AbaVeiculo({
  grupo,
  lista,
  unit,
  setUnit,
  aoAbrir,
  pneusEstoque,
}: {
  grupo: string;
  lista: ListaPneus;
  unit: number | null;
  setUnit: (u: number | null) => void;
  aoAbrir: (id: number) => void;
  pneusEstoque: LinhaPneu[];
}) {
  const qc = useQueryClient();
  const veiculos = useQuery(veiculosPneuQuery(grupo));
  const q = useQuery(pneusDoVeiculoQuery(grupo, unit));
  const [montarEm, setMontarEm] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState("");
  const [baixa, setBaixa] = useState(false);
  const [motivo, setMotivo] = useState("Venda ou baixa do veículo");
  const [modeloLocal, setModeloLocal] = useState("");
  useEffect(() => setModeloLocal(""), [unit]);
  const todos = useMutation({
    mutationFn: () =>
      desmontarTodos(unit!, {
        group_id: Number(grupo),
        data: hojeISO(),
        km: q.data?.veiculo.km ?? 0,
        motivo,
        destino: "estoque",
        confirmar: true,
      }),
    onSuccess: (r) => {
      toast.success(`${r.desmontados} pneus desmontados.`);
      setBaixa(false);
      qc.invalidateQueries({ queryKey: ["pneus"] });
    },
    onError: (e: Error) => toast.error(lerRecusa(e).mensagem),
  });
  if (!grupo)
    return (
      <EmptyNote>Escolha uma empresa no topo do menu para ver os pneus por veículo.</EmptyNote>
    );
  const v = q.data?.veiculo;
  const modelo = v?.modelo_eixos || modeloLocal;
  const linhas = v?.modelo_eixos
    ? (q.data?.posicoes ?? [])
    : (lista.modelos_eixos.find((x) => x.chave === modeloLocal)?.posicoes ?? []).map((x) => ({
        ...x,
        pneu: null,
      }));
  const estoque = pneusEstoque.filter((p) => String(p.group_id) === grupo);
  const pEscolhido = estoque.find((p) => String(p.id) === escolhido);
  const montados = q.data?.posicoes.filter((x) => x.pneu).length ?? 0;
  return (
    <div className="space-y-3">
      <select
        value={unit ?? ""}
        onChange={(e) => setUnit(e.target.value ? Number(e.target.value) : null)}
        className={cn(campo, "max-w-[320px]")}
        aria-label="Veículo"
      >
        <option value="">{veiculos.isPending ? "Carregando…" : "Escolha o veículo"}</option>
        {(veiculos.data?.veiculos ?? []).map((x) => (
          <option key={x.unit_id} value={x.unit_id}>
            {x.placa}
            {x.prefixo ? ` · ${x.prefixo}` : ""}
          </option>
        ))}
      </select>
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {v && (
        <>
          <p className="text-[13px] text-muted-foreground">
            Km atual: <strong className="text-foreground">{nf(v.km)} km</strong> · {v.fonte_km}
          </p>
          {!v.modelo_eixos && (
            <div className="max-w-[320px]">
              <Campo rotulo="Este veículo ainda não tem modelo de eixos">
                <select
                  value={modeloLocal}
                  onChange={(e) => setModeloLocal(e.target.value)}
                  className={campo}
                >
                  <option value="">Escolha</option>
                  {lista.modelos_eixos.map((x) => (
                    <option key={x.chave} value={x.chave}>
                      {x.rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {linhas.map((x) => (
              <div
                key={x.chave}
                className="rounded-xl border border-border bg-white p-3 text-[13px]"
              >
                <div className="text-[12px] text-muted-foreground">{x.rotulo}</div>
                {x.pneu ? (
                  <button
                    onClick={() => aoAbrir(x.pneu!.id)}
                    className="mt-1 block w-full text-left"
                  >
                    <span className="font-mono font-bold underline">{x.pneu.fogo}</span>
                    <span className="block text-ink-soft">
                      {x.pneu.marca} · {x.pneu.vida}ª vida · {nf(x.pneu.km_total)} km
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEscolhido("");
                      setMontarEm(x.chave);
                    }}
                    className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-navy"
                  >
                    <Plus className="h-3.5 w-3.5" /> Montar
                  </button>
                )}
              </div>
            ))}
          </div>
          {montados > 0 && (
            <button onClick={() => setBaixa(true)} className={secundario}>
              Desmontar todos os pneus
            </button>
          )}
        </>
      )}
      {montarEm && !pEscolhido && v && (
        <Janela titulo={`Qual pneu montar em ${v.placa}?`} aoFechar={() => setMontarEm(null)}>
          {estoque.length ? (
            <select
              value={escolhido}
              onChange={(e) => setEscolhido(e.target.value)}
              className={campo}
            >
              <option value="">Escolha um pneu em estoque</option>
              {estoque.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fogo} · {p.marca} {p.medida} · {p.vida}ª vida
                </option>
              ))}
            </select>
          ) : (
            <EmptyNote>Nenhum pneu em estoque nesta empresa.</EmptyNote>
          )}
        </Janela>
      )}
      {montarEm && pEscolhido && v && (
        <FormAcao
          p={pEscolhido}
          acao="montar"
          lista={lista}
          inicial={{ unit_id: v.unit_id, posicao: montarEm, modelo_eixos: modelo }}
          aoFechar={() => {
            setMontarEm(null);
            setEscolhido("");
          }}
          aoAbrirPneu={aoAbrir}
        />
      )}
      {baixa && v && (
        <Janela titulo={`Desmontar todos os pneus de ${v.placa}`} aoFechar={() => setBaixa(false)}>
          <p className="text-[13px]">
            {montados} pneus vão para o estoque, com o km atual do veículo ({nf(v.km)} km).
          </p>
          <Campo rotulo="Motivo" obrigatorio>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={campo}>
              {lista.motivos_saida.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Campo>
          <button
            onClick={() => todos.mutate()}
            disabled={todos.isPending || v.km == null}
            className={primario}
          >
            Confirmar
          </button>
        </Janela>
      )}
    </div>
  );
}

/* ------------------------------- Tela -------------------------------- */

type Aba = "lista" | "veiculo" | "recapagem";

export default function Pneus() {
  // A empresa vem do menu lateral, como nas outras telas. Sem nenhuma escolhida, mostra tudo a que o usuário tem acesso.
  const grupo = grupoAtivo() ?? "";
  const q = useQuery(pneusQuery(grupo));
  const config = useQuery(configPneuQuery(grupo));
  const qc = useQueryClient();
  const [aba, setAba] = useState<Aba>("lista");
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("ativos");
  const [fMarca, setFMarca] = useState("");
  const [fMedida, setFMedida] = useState("");
  const [fVida, setFVida] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);
  const [cadastro, setCadastro] = useState(false);
  const [montarNovo, setMontarNovo] = useState<number | null>(null);
  const [retorno, setRetorno] = useState<number | null>(null);
  const [unit, setUnit] = useState<number | null>(null);
  useEffect(() => setUnit(null), [grupo]);
  const [limiteAberto, setLimiteAberto] = useState(false);
  const [limite, setLimite] = useState("");

  const salvarLimite = useMutation({
    mutationFn: () => gravarConfigPneu(Number(grupo), Number(limite)),
    onSuccess: () => {
      toast.success("Limite salvo.");
      setLimiteAberto(false);
      qc.invalidateQueries({ queryKey: ["pneus"] });
    },
    onError: (e: Error) => toast.error(lerRecusa(e).mensagem),
  });

  const pneus = useMemo(() => q.data?.pneus ?? [], [q.data]);
  const lista = useMemo(() => {
    const t = busca.trim().toUpperCase();
    return pneus.filter(
      (p) =>
        (!t || p.fogo.includes(t) || (p.placa ?? "").toUpperCase().includes(t)) &&
        (fStatus === "ativos" ? p.status !== "descartado" : !fStatus || p.status === fStatus) &&
        (!fMarca || p.marca === fMarca) &&
        (!fMedida || p.medida === fMedida) &&
        (!fVida || p.vida === Number(fVida)),
    );
  }, [pneus, busca, fStatus, fMarca, fMedida, fVida]);
  const fila = pneus.filter((p) => p.servico?.tipo === "recapagem");
  const conta = (s: StatusPneu) => pneus.filter((p) => p.status === s).length;
  const novoPneu = pneus.find((p) => p.id === montarNovo);
  const retornoPneu = pneus.find((p) => p.id === retorno);
  const opcoes = (k: "marca" | "medida") => [...new Set(pneus.map((p) => p[k]))].sort();

  return (
    <>
      <PageHeader
        title="Pneus"
        subtitle="Manutenção › Vida de cada pneu"
        actions={
          <button
            onClick={() =>
              grupo
                ? setCadastro(true)
                : toast.warning("Escolha a empresa no topo do menu para cadastrar.")
            }
            className={primario}
          >
            <Plus className="h-4 w-4" /> Cadastrar pneu
          </button>
        }
      />
      <div className="mx-auto max-w-[1600px] space-y-4 px-6 py-6 md:px-8">
        <div className="flex flex-wrap items-center gap-2">
          {grupo && (
            <button
              onClick={() => {
                setLimite(String(config.data?.limite_recapagens ?? ""));
                setLimiteAberto(true);
              }}
              className={secundario}
            >
              <Settings className="h-3.5 w-3.5" /> Limite de recapagens:{" "}
              {config.data?.limite_recapagens ?? "—"}
            </button>
          )}
        </div>

        {q.error ? (
          <ErrorBox error={q.error} onRetry={() => q.refetch()} />
        ) : q.isPending || !q.data ? (
          <SkeletonRows rows={6} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile
                icon={CircleDot}
                label="Pneus ativos"
                value={String(pneus.length - conta("descartado"))}
                color="var(--brand-navy)"
              />
              <StatTile
                icon={Truck}
                label="Montados"
                value={String(conta("montado"))}
                color="var(--leaf)"
              />
              <StatTile
                icon={Package}
                label="Em estoque"
                value={String(conta("estoque"))}
                color="var(--sky)"
              />
              <StatTile
                icon={Recycle}
                label="Fora (recapagem ou reparo)"
                value={String(conta("recapagem") + conta("reparo"))}
                color="var(--gold)"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["lista", "Lista de pneus"],
                  ["veiculo", "Pneus no veículo"],
                  ["recapagem", `Fila de recapagem (${fila.length})`],
                ] as const
              ).map(([k, r]) => (
                <button
                  key={k}
                  onClick={() => setAba(k)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[13px] font-medium",
                    aba === k
                      ? "bg-brand-navy text-white"
                      : "border border-border bg-white text-muted-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>

            {aba === "lista" && (
              <>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Número de fogo ou placa"
                      className={cn(campo, "w-[230px] pl-8")}
                    />
                  </div>
                  <select
                    value={fStatus}
                    onChange={(e) => setFStatus(e.target.value)}
                    className={cn(campo, "w-auto")}
                    aria-label="Status"
                  >
                    <option value="ativos">Ativos</option>
                    <option value="">Todos, com descartados</option>
                    <option value="estoque">Em estoque</option>
                    <option value="montado">Montado</option>
                    <option value="recapagem">Em recapagem</option>
                    <option value="reparo">Em reparo</option>
                    <option value="descartado">Descartado</option>
                  </select>
                  <select
                    value={fMarca}
                    onChange={(e) => setFMarca(e.target.value)}
                    className={cn(campo, "w-auto")}
                    aria-label="Marca"
                  >
                    <option value="">Todas as marcas</option>
                    {opcoes("marca").map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                  <select
                    value={fMedida}
                    onChange={(e) => setFMedida(e.target.value)}
                    className={cn(campo, "w-auto")}
                    aria-label="Medida"
                  >
                    <option value="">Todas as medidas</option>
                    {opcoes("medida").map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                  <select
                    value={fVida}
                    onChange={(e) => setFVida(e.target.value)}
                    className={cn(campo, "w-auto")}
                    aria-label="Vida"
                  >
                    <option value="">Todas as vidas</option>
                    {[...new Set(pneus.map((p) => p.vida))].sort().map((x) => (
                      <option key={x} value={x}>
                        {x}ª vida
                      </option>
                    ))}
                  </select>
                </div>
                {!pneus.length ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
                    <CircleDot className="h-7 w-7 text-muted-foreground" />
                    <p className="text-[14px] font-semibold">Nenhum pneu cadastrado</p>
                    <p className="text-[13px] text-muted-foreground">
                      Comece por um pneu novo ou por um que já está rodando.
                    </p>
                  </div>
                ) : lista.length ? (
                  <div className="overflow-x-auto rounded-xl border border-border bg-white">
                    <table className="w-full min-w-[860px] text-[13px]">
                      <thead className="text-left text-[12px] text-muted-foreground">
                        <tr>
                          {[
                            "Fogo",
                            "Marca",
                            "Medida",
                            "Status",
                            "Placa e posição",
                            "Vida",
                            "Km total",
                          ].map((c, i) => (
                            <th
                              key={c}
                              className={cn("px-3 py-2 font-semibold", i >= 5 && "text-right")}
                            >
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((p) => (
                          <tr
                            key={p.id}
                            onClick={() => setAberto(p.id)}
                            className="cursor-pointer border-t border-border/60 hover:bg-secondary/50"
                          >
                            <td className="px-3 py-2 font-mono font-bold">{p.fogo}</td>
                            <td className="px-3 py-2">{p.marca}</td>
                            <td className="px-3 py-2">{p.medida}</td>
                            <td className="px-3 py-2">
                              <Pill tone={TOM[p.status]}>{p.status_rotulo}</Pill>
                            </td>
                            <td className="px-3 py-2">
                              {p.placa ? `${p.placa}, ${p.posicao_rotulo}` : "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{p.vida}ª</td>
                            <td className="px-3 py-2 text-right font-mono">
                              {nf(p.km_total)}
                              {(p.km_desatualizado || p.km_inconsistente) && (
                                <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-coral" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyNote>Nenhum pneu com esse filtro.</EmptyNote>
                )}
              </>
            )}

            {aba === "veiculo" && (
              <AbaVeiculo
                grupo={grupo}
                lista={q.data}
                unit={unit}
                setUnit={setUnit}
                aoAbrir={setAberto}
                pneusEstoque={pneus.filter((p) => p.status === "estoque")}
              />
            )}

            {aba === "recapagem" &&
              (fila.length ? (
                <div className="overflow-x-auto rounded-xl border border-border bg-white">
                  <table className="w-full min-w-[640px] text-[13px]">
                    <thead className="text-left text-[12px] text-muted-foreground">
                      <tr>
                        {["Fogo", "Fornecedor", "Enviado em", "Dias fora", ""].map((c) => (
                          <th key={c} className="px-3 py-2 font-semibold">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {fila.map((p) => (
                        <tr
                          key={p.id}
                          className={cn(
                            "border-t border-border/60",
                            p.servico?.atrasado && "bg-coral-tint/40",
                          )}
                        >
                          <td className="px-3 py-2">
                            <button
                              className="font-mono font-bold underline"
                              onClick={() => setAberto(p.id)}
                            >
                              {p.fogo}
                            </button>
                          </td>
                          <td className="px-3 py-2">{p.servico?.fornecedor ?? "—"}</td>
                          <td className="px-3 py-2">{dataBR(p.servico?.enviado_em)}</td>
                          <td className="px-3 py-2 font-mono">
                            {p.servico?.dias_fora}
                            {p.servico?.atrasado ? " · atrasado" : ""}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button className={secundario} onClick={() => setRetorno(p.id)}>
                              Registrar retorno
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyNote>Nenhum pneu em recapagem.</EmptyNote>
              ))}
          </>
        )}
      </div>

      {cadastro && q.data && (
        <FormCadastro
          grupo={grupo}
          lista={q.data}
          aoFechar={() => setCadastro(false)}
          aoCriar={(id, montar) => {
            setCadastro(false);
            if (montar) setMontarNovo(id);
            else setAberto(id);
          }}
        />
      )}
      {novoPneu && q.data && (
        <FormAcao
          p={novoPneu}
          acao="montar"
          lista={q.data}
          aoFechar={() => setMontarNovo(null)}
          aoAbrirPneu={setAberto}
        />
      )}
      {retornoPneu && q.data && (
        <FormAcao
          p={retornoPneu}
          acao="retorno"
          lista={q.data}
          aoFechar={() => setRetorno(null)}
          aoAbrirPneu={setAberto}
        />
      )}
      {aberto != null && q.data && (
        <DetalhePneuLateral
          id={aberto}
          lista={q.data}
          aoFechar={() => setAberto(null)}
          aoAbrirPneu={setAberto}
          aoAbrirVeiculo={(u) => {
            setAberto(null);
            setUnit(u);
            setAba("veiculo");
          }}
        />
      )}
      {limiteAberto && (
        <Janela
          titulo="Limite de recapagens por pneu"
          aoFechar={() => setLimiteAberto(false)}
          largura="max-w-[380px]"
        >
          <input
            type="number"
            min={0}
            value={limite}
            onChange={(e) => setLimite(e.target.value)}
            className={campo}
          />
          <button
            onClick={() => salvarLimite.mutate()}
            disabled={salvarLimite.isPending || limite === ""}
            className={primario}
          >
            Salvar
          </button>
        </Janela>
      )}
    </>
  );
}
