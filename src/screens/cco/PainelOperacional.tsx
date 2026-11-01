import { useEffect, useMemo, useState, type ReactNode } from "react";
import { grupoAtivo } from "@/lib/escopo-ativo";
import { lerSessao } from "@/lib/session";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Fuel, Loader2 } from "lucide-react";
import {
  hojeAoVivoQuery,
  painelOperacionalQuery,
  variacao,
  type CelulaConsumo,
  type ColunaConsumo,
  type HojeAoVivo,
  type PainelOperacional as DadosPainel,
  type RegraVariacao,
} from "@/lib/painel-operacional-api";
import { empresasQuery } from "@/lib/queries";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Painel Operacional (PM, 31/10/2026): km/l por modelo mês a mês, indicadores gerais e os veículos com
 * falha de dados de telemetria. Tela própria, aberta em nova aba pelo CCO, pensada também para TV.
 * A variação do mês atual é sempre contra o mesmo período do mês anterior, nunca contra o mês cheio.
 */

const nf = (v: number, c = 0) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: c, maximumFractionDigits: c });

const TOM = { bom: "text-leaf", ruim: "text-coral", neutro: "text-muted-foreground" } as const;

function Seta({
  atual,
  base,
  regra,
}: {
  atual?: number | null;
  base?: number | null;
  regra: RegraVariacao;
}) {
  const v = variacao(atual, base, regra);
  if (!v) return null;
  return (
    <span className={cn("block text-[12px] font-semibold", TOM[v.tom])}>
      {v.seta} {v.texto}
    </span>
  );
}

function Celula({
  destaque,
  dica,
  children,
}: {
  destaque: boolean;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <td
      title={dica}
      className={cn(
        "whitespace-nowrap border-b border-border px-3 py-2 text-right font-mono text-[16px] tabular-nums",
        destaque && "bg-navy-tint font-semibold",
      )}
    >
      {children}
    </td>
  );
}

function CabecalhoLinha({ children, forte }: { children: ReactNode; forte?: boolean }) {
  return (
    <th
      scope="row"
      className={cn(
        "sticky left-0 z-10 min-w-[230px] max-w-[300px] border-b border-r border-border bg-card px-3 py-2 text-left text-[14px]",
        forte ? "font-bold" : "font-medium",
      )}
    >
      {children}
    </th>
  );
}

function Bloco({
  titulo,
  n,
  alerta,
  aberto,
  onAlternar,
}: {
  titulo: string;
  n: number;
  alerta?: boolean;
  aberto: boolean;
  onAlternar: () => void;
}) {
  const Seta = aberto ? ChevronDown : ChevronRight;
  return (
    <tr>
      <th
        colSpan={n}
        scope="colgroup"
        className={cn(
          "p-0 text-left text-[14px] font-bold text-white",
          alerta ? "bg-coral" : "bg-brand-navy",
        )}
      >
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={aberto}
          className="sticky left-0 inline-flex w-max items-center gap-1.5 px-3 py-2 hover:underline"
        >
          <Seta className="h-5 w-5" />
          {alerta && <AlertTriangle className="h-4 w-4" />} {titulo}
        </button>
      </th>
    </tr>
  );
}

/** Quais blocos estão abertos; lembrado neste navegador. Fechado, o bloco mostra só a linha que o resume. */
type Grupo = "consumo" | "indicadores" | "qualidade";
const CHAVE_ABERTOS = "ss:painel-operacional:abertos";

function useBlocosAbertos() {
  const [abertos, setAbertos] = useState<Record<Grupo, boolean>>(() => {
    const padrao = { consumo: false, indicadores: false, qualidade: false };
    try {
      return { ...padrao, ...JSON.parse(localStorage.getItem(CHAVE_ABERTOS) ?? "{}") };
    } catch {
      return padrao;
    }
  });
  const alternar = (g: Grupo) =>
    setAbertos((x) => {
      const novo = { ...x, [g]: !x[g] };
      try {
        localStorage.setItem(CHAVE_ABERTOS, JSON.stringify(novo));
      } catch {
        /* só perde a lembrança */
      }
      return novo;
    });
  return { abertos, alternar };
}

function LinhaConsumo({
  nome,
  celulas,
  colunas,
  forte,
}: {
  nome: string;
  celulas: Record<string, CelulaConsumo>;
  colunas: ColunaConsumo[];
  forte?: boolean;
}) {
  return (
    <tr>
      <CabecalhoLinha forte={forte}>{nome}</CabecalhoLinha>
      {colunas.map((c) => {
        const x = celulas[c.chave];
        const b = c.base ? celulas[c.base] : undefined;
        const dica = x
          ? `${nf(x.km_comb)} km com combustível · ${nf(x.litros)} L · ${nf(x.veiculos)} veículo(s)`
          : "Sem dados no período";
        return (
          <Celula key={c.chave} destaque={c.tipo === "atual"} dica={dica}>
            {!x || x.kml == null ? (
              "—"
            ) : x.insuficiente ? (
              <span className="font-sans text-[12px] text-muted-foreground">
                dados insuficientes
              </span>
            ) : (
              <>
                {nf(x.kml, 2)}
                {c.base && !b?.insuficiente && (
                  <Seta atual={x.kml} base={b?.kml} regra="subir_bom" />
                )}
              </>
            )}
          </Celula>
        );
      })}
    </tr>
  );
}

function LinhaNumero({
  nome,
  valores,
  colunas,
  regra,
  casas = 0,
  prefixo = "",
  forte,
  calculando,
  dica,
}: {
  nome: string;
  valores: Record<string, number | null>;
  colunas: ColunaConsumo[];
  regra: RegraVariacao;
  casas?: number;
  prefixo?: string;
  forte?: boolean;
  calculando?: boolean;
  dica?: string;
}) {
  return (
    <tr>
      <CabecalhoLinha forte={forte}>{nome}</CabecalhoLinha>
      {colunas.map((c) => {
        const v = valores[c.chave];
        return (
          <Celula key={c.chave} destaque={c.tipo === "atual"} dica={dica}>
            {v == null ? (
              calculando ? (
                <span className="font-sans text-[12px] text-muted-foreground">calculando</span>
              ) : (
                "—"
              )
            ) : (
              <>
                {prefixo}
                {nf(v, casas)}
                {c.base && <Seta atual={v} base={valores[c.base]} regra={regra} />}
              </>
            )}
          </Celula>
        );
      })}
    </tr>
  );
}

function Tabela({ d }: { d: DadosPainel }) {
  const colunas = d.colunas.filter((c) => !c.oculta);
  const n = colunas.length + 1;
  const a = d.qualidade_andamento;
  const calculando = !a.erro && a.feitos < a.total;
  const { abertos, alternar } = useBlocosAbertos();
  // Modelo sem km/l em nenhuma coluna visível só teria traços: fica fora da lista (segue na média da frota).
  const modelos = d.modelos.filter((m) => colunas.some((c) => m.celulas[c.chave]?.kml != null));
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-card">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 border-b border-r border-border bg-card px-3 py-3 text-left text-[13px]">
              Modelo
            </th>
            {colunas.map((c) => (
              <th
                key={c.chave}
                scope="col"
                title={`${c.inicio.split("-").reverse().join("/")} a ${c.fim.split("-").reverse().join("/")}`}
                className={cn(
                  "sticky top-0 z-20 min-w-[104px] border-b border-border px-3 py-3 text-right text-[13px] font-bold",
                  c.tipo === "atual" ? "bg-brand-navy text-white" : "bg-card",
                  c.tipo === "anterior" && "text-muted-foreground",
                  c.tipo === "hoje" && "bg-coral text-white",
                )}
              >
                {c.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Bloco
            titulo={`Consumo por modelo (km/l): ${modelos.length} modelos`}
            n={n}
            aberto={abertos.consumo}
            onAlternar={() => alternar("consumo")}
          />
          {abertos.consumo &&
            modelos.map((m) => (
              <LinhaConsumo
                key={m.modelo}
                nome={m.modelo}
                celulas={m.celulas}
                colunas={d.colunas.filter((c) => !c.oculta)}
              />
            ))}
          <LinhaConsumo nome="Média da frota" celulas={d.frota} colunas={colunas} forte />
          {/* "Com pedal / sem pedal": significado a confirmar com o PM. Quando confirmar, as linhas entram aqui. */}

          <Bloco
            titulo="Indicadores gerais"
            n={n}
            aberto={abertos.indicadores}
            onAlternar={() => alternar("indicadores")}
          />
          {abertos.indicadores && (
            <LinhaNumero
              nome="Preço do diesel (R$/L)"
              valores={d.diesel}
              colunas={colunas}
              regra="subir_ruim"
              casas={2}
              dica="ANP, média dos estados no período"
            />
          )}
          <LinhaNumero
            forte={!abertos.indicadores}
            nome="Custo por km (R$/km)"
            valores={d.custo_km}
            colunas={colunas}
            regra="subir_ruim"
            casas={2}
            dica="Preço do diesel ÷ km/l da frota"
          />
          {abertos.indicadores && (
            <LinhaNumero
              nome="Velocidade média (km/h)"
              valores={d.velocidade}
              colunas={colunas}
              regra="neutra"
              casas={1}
              dica="Km rodados ÷ tempo em viagem"
            />
          )}
          {abertos.indicadores && (
            <LinhaNumero
              nome="Altitude média (m)"
              valores={d.altitude}
              colunas={colunas}
              regra="neutra"
              calculando={calculando}
              dica="Altitude informada pelo rastreador com o veículo andando. Só conta quem manda esse dado: sem nenhum, aparece —"
            />
          )}

          <Bloco
            titulo="Qualidade do dado: veículos com falha de dados de telemetria"
            n={n}
            alerta
            aberto={abertos.qualidade}
            onAlternar={() => alternar("qualidade")}
          />
          {abertos.qualidade && (
            <>
              <LinhaNumero
                nome="Não gera RPM"
                valores={d.qualidade.rpm}
                colunas={colunas}
                regra="subir_ruim"
                calculando={calculando}
                dica="Rodou mais de 1 km no período e nenhuma leitura com RPM (sem Passeio e Pickup)"
              />
              <LinhaNumero
                nome="Não gera pedal"
                valores={d.qualidade.pedal}
                colunas={colunas}
                regra="subir_ruim"
                calculando={calculando}
                dica="Rodou mais de 1 km no período e nenhuma leitura com pedal do acelerador (sem Passeio e Pickup)"
              />
              <LinhaNumero
                nome="Não gera velocidade"
                valores={d.qualidade.velocidade}
                colunas={colunas}
                regra="subir_ruim"
                calculando={calculando}
                dica="Rodou mais de 1 km no período e nenhuma leitura com velocidade do CAN (sem Passeio e Pickup)"
              />
              <LinhaNumero
                nome="Offline"
                valores={d.qualidade.offline}
                colunas={colunas}
                regra="subir_ruim"
                calculando={calculando}
                dica="Veículo ativo sem nenhuma leitura no último dia do período (sem Passeio e Pickup)"
              />
            </>
          )}
          <LinhaNumero
            nome="Total de veículos com falha"
            valores={d.qualidade.total}
            colunas={colunas}
            regra="subir_ruim"
            forte
            calculando={calculando}
            dica="Cada veículo conta uma vez, mesmo com mais de uma falha (sem Passeio e Pickup)"
          />
        </tbody>
      </table>
    </div>
  );
}

/** Junta a coluna de hoje (ao vivo) às colunas do painel. Hoje não tem seta: dia parcial não se compara. */
function comHoje(d: DadosPainel, h: HojeAoVivo | undefined): DadosPainel {
  if (!h) return d;
  const lido = new Date(h.lido_em).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  const k = "hoje";
  const coluna = {
    chave: k,
    rotulo: `Hoje, ao vivo (${lido})`,
    tipo: "hoje" as const,
    inicio: h.lido_em.slice(0, 10),
    fim: h.lido_em.slice(0, 10),
    oculta: false,
  };
  const nomes = new Set(d.modelos.map((m) => m.modelo));
  const modelos = [
    ...d.modelos.map((m) => ({
      modelo: m.modelo,
      celulas: h.modelos[m.modelo] ? { ...m.celulas, [k]: h.modelos[m.modelo] } : m.celulas,
    })),
    ...Object.entries(h.modelos)
      .filter(([m]) => !nomes.has(m))
      .map(([modelo, c]) => ({ modelo, celulas: { [k]: c } })),
  ];
  const q = d.qualidade;
  return {
    ...d,
    colunas: [...d.colunas, coluna],
    modelos,
    frota: { ...d.frota, [k]: h.frota },
    diesel: { ...d.diesel, [k]: h.diesel },
    custo_km: { ...d.custo_km, [k]: h.custo_km },
    velocidade: { ...d.velocidade, [k]: h.velocidade },
    altitude: { ...d.altitude, [k]: h.altitude },
    qualidade: {
      rpm: { ...q.rpm, [k]: h.qualidade.rpm },
      pedal: { ...q.pedal, [k]: h.qualidade.pedal },
      velocidade: { ...q.velocidade, [k]: h.qualidade.velocidade },
      offline: { ...q.offline, [k]: h.qualidade.offline },
      total: { ...q.total, [k]: h.qualidade.total },
    },
  };
}

/** Segundos desde a última busca, correndo na tela. */
function AoVivo({ lidoEm }: { lidoEm?: string }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!lidoEm) return null;
  const s = Math.max(0, Math.round((agora - new Date(lidoEm).getTime()) / 1000));
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-coral">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-coral" /> Ao vivo · atualizado há{" "}
      {s} s
    </span>
  );
}

export default function PainelOperacional() {
  // Abre na empresa escolhida no menu lateral. O seletor só existe quando nenhuma foi escolhida: esta aba não tem menu.
  const doMenu = grupoAtivo();
  const [escolhido, setEscolhido] = useState("");
  const grupo = doMenu ?? escolhido;
  const [meses, setMeses] = useState(6);
  const q = useQuery(painelOperacionalQuery(grupo, meses));
  const hoje = useQuery(hojeAoVivoQuery(grupo));
  const empresas = useQuery({ ...empresasQuery(), enabled: !doMenu });
  const d = useMemo(() => (q.data ? comHoje(q.data, hoje.data) : undefined), [q.data, hoje.data]);
  const quando = d ? new Date(d.atualizado_em) : null;
  const campo = "h-10 rounded-lg border border-border bg-white px-3 text-[15px]";

  return (
    <div className="flex h-screen flex-col gap-3 bg-canvas p-4">
      <header className="flex flex-wrap items-center gap-3">
        <Fuel className="h-6 w-6 text-brand-navy" />
        <h1 className="font-display text-[24px] font-bold">Painel Operacional</h1>
        <AoVivo lidoEm={hoje.data?.lido_em} />
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[14px]">
          {doMenu ? (
            <span className="font-semibold">{lerSessao()?.organizacaoAtiva}</span>
          ) : (
            <label className="flex items-center gap-1.5">
              Cliente
              <select
                value={escolhido}
                onChange={(e) => setEscolhido(e.target.value)}
                className={campo}
              >
                <option value="">Todos</option>
                {(empresas.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-1.5">
            Período
            <select
              value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
              className={campo}
            >
              {[3, 6, 12].map((m) => (
                <option key={m} value={m}>
                  Últimos {m} meses
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {q.isPending ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-[16px] text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando o painel operacional…
        </div>
      ) : q.isError ? (
        <div className="flex flex-1 items-center justify-center text-[16px] text-coral">
          Não foi possível carregar: {mensagemErro(q.error)}
        </div>
      ) : !d?.modelos.length ? (
        <div className="flex flex-1 items-center justify-center text-[16px] text-muted-foreground">
          Nenhum veículo com km rodado neste período.
        </div>
      ) : (
        <Tabela d={d} />
      )}

      {d && quando && (
        <footer className="flex flex-wrap justify-between gap-2 text-[12px] text-muted-foreground">
          <span>
            Atualizado em{" "}
            {quando.toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            })}{" "}
            · {d.fonte}
          </span>
          <span>
            ▲ ▼ variação contra o período anterior · verde bom, vermelho ruim, cinza neutro · menos
            de {nf(d.km_minimo)} km: dados insuficientes
          </span>
        </footer>
      )}
    </div>
  );
}
