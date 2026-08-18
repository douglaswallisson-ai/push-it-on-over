import { useMemo, useState } from "react";
import {
  ArrowDown,
  Check,
  Clock,
  Fuel,
  GripVertical,
  Info,
  MapPin,
  Plus,
  Route,
  Sparkles,
  TrendingDown,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, Pill, StatTile } from "@/components/ss/ui/data";
import { MapaCliente } from "@/components/ss/mapa/MapaCliente";
import { compararRotas, projetarEconomia, type Parada } from "@/lib/roteirizacao";
import { registrarAuditoria } from "@/lib/session";
import { nf } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * Roteirização com otimização de rota.
 *
 * A tela anterior desenhava um traçado ilustrativo e um botão de "aplicar
 * sugestão" que não calculava nada. Aqui a ordem das paradas é realmente
 * otimizada, e a comparação mostra quanto se economiza.
 *
 * O cálculo roda no navegador em milissegundos — não depende de servidor nem
 * de serviço pago de roteirização.
 */

const PARADAS_INICIAIS: Parada[] = [
  { id: "p0", nome: "Garagem Central", lat: -23.5505, lng: -46.6333, fixo: "inicio", endereco: "Ponto de saída", paradaMin: 0 },
  { id: "p1", nome: "Jardim Aeroporto", lat: -23.6270, lng: -46.6650, passageiros: 8, paradaMin: 2 },
  { id: "p2", nome: "Vila Mariana", lat: -23.5890, lng: -46.6340, passageiros: 12, paradaMin: 2 },
  { id: "p3", nome: "Santo Amaro", lat: -23.6540, lng: -46.7100, passageiros: 15, paradaMin: 3 },
  { id: "p4", nome: "Butantã", lat: -23.5714, lng: -46.7085, passageiros: 9, paradaMin: 2 },
  { id: "p5", nome: "Lapa", lat: -23.5280, lng: -46.7050, passageiros: 11, paradaMin: 2 },
  { id: "p6", nome: "Barra Funda", lat: -23.5250, lng: -46.6650, passageiros: 7, paradaMin: 2 },
  { id: "p7", nome: "Pinheiros", lat: -23.5670, lng: -46.7020, passageiros: 14, paradaMin: 3 },
  { id: "p8", nome: "Fábrica Leste", lat: -23.5100, lng: -46.4300, fixo: "fim", endereco: "Destino final", paradaMin: 0 },
];

const hhmm = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;

export default function RoteirizacaoOtimizada() {
  const [paradas, setParadas] = useState<Parada[]>(PARADAS_INICIAIS);
  const [aplicada, setAplicada] = useState(false);
  const [viagensMes, setViagensMes] = useState(44);
  const [custoKm, setCustoKm] = useState(4.2);

  const comparacao = useMemo(() => compararRotas(paradas), [paradas]);
  const { manual, otimizada, economiaKm, economiaPct, economiaMin } = comparacao;

  const exibida = aplicada ? otimizada : manual;
  const projecao = projetarEconomia(economiaKm, viagensMes, custoKm);

  const aplicar = () => {
    setParadas(otimizada.ordem);
    setAplicada(true);
    registrarAuditoria(
      "roteirizacao",
      `Rota otimizada aplicada: ${manual.distanciaKm} km → ${otimizada.distanciaKm} km (−${economiaPct}%).`,
    );
    toast.success(`Rota otimizada: ${economiaKm} km a menos.`, {
      description: `${economiaPct}% de redução · ${hhmm(economiaMin)} economizados por viagem.`,
    });
  };

  const remover = (id: string) => {
    setParadas((p) => p.filter((x) => x.id !== id));
    setAplicada(false);
  };

  /** Traçado no mapa, seguindo a ordem exibida. */
  const percurso = exibida.ordem.map((p) => [p.lat, p.lng] as [number, number]);
  const marcadores = exibida.ordem.map((p, i) => ({
    placa: p.id,
    rotulo: p.fixo ? (p.fixo === "inicio" ? "Saída" : "Destino") : String(i),
    lat: p.lat,
    lng: p.lng,
    situacao: p.fixo ? "manutencao" : "em_viagem",
    velocidade: 0,
    endereco: p.nome,
  }));

  return (
    <>
      <PageHeader
        title="Roteirização"
        subtitle="Fretamento › Otimização de rota"
        actions={
          !aplicada && economiaKm > 0 ? (
            <button
              onClick={aplicar}
              className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-5 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              <Sparkles className="h-[15px] w-[15px]" />
              Aplicar rota otimizada
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-leaf-tint px-4 py-2 text-sm font-semibold text-leaf">
              <Check className="h-[15px] w-[15px]" />
              Rota otimizada
            </span>
          )
        }
      />

      <div className="mx-auto max-w-[1600px] space-y-5 px-6 py-6 md:px-8">
        {/* A comparação é o argumento da tela. */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
          <div className={cn("rounded-2xl border p-4", aplicada ? "border-border bg-card opacity-60" : "border-coral-line bg-coral-tint/30")}>
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Ordem cadastrada
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-display text-[30px] font-bold leading-none text-foreground">{manual.distanciaKm}</span>
              <span className="text-[13px] text-muted-foreground">km</span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {hhmm(manual.duracaoMin)} · {manual.ordem.length} paradas
            </p>
          </div>

          <div className={cn("rounded-2xl border p-4", aplicada ? "border-leaf-line bg-leaf-tint/30" : "border-border bg-card")}>
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Rota otimizada
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-display text-[30px] font-bold leading-none text-leaf">{otimizada.distanciaKm}</span>
              <span className="text-[13px] text-muted-foreground">km</span>
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {hhmm(otimizada.duracaoMin)} · mesma cobertura
            </p>
          </div>

          <div className="flex min-w-[200px] flex-col justify-center rounded-2xl border border-leaf-line bg-leaf-tint/50 p-4">
            <span className="flex items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-leaf">
              <TrendingDown className="h-3.5 w-3.5" />
              Economia
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-display text-[30px] font-bold leading-none text-leaf">−{economiaPct}%</span>
            </div>
            <p className="mt-1 text-[12px] text-leaf">
              {economiaKm} km · {hhmm(economiaMin)} por viagem
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
          {/* Sequência de paradas. */}
          <Card
            title="Sequência"
            icon={Route}
            action={<Pill tone="sky">{exibida.ordem.length} paradas</Pill>}
            bodyClassName="p-3"
          >
            <ol className="space-y-1">
              {exibida.ordem.map((p, i) => {
                const trecho = exibida.trechos[i - 1];
                return (
                  <li key={p.id}>
                    {trecho && (
                      <div className="flex items-center gap-2 py-0.5 pl-[26px] text-[11px] text-muted-foreground">
                        <ArrowDown className="h-3 w-3" />
                        {trecho.km} km · {trecho.min} min
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-2.5 py-2",
                        p.fixo ? "border-brand-navy bg-navy-tint" : "border-border bg-card",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold",
                          p.fixo ? "bg-brand-navy text-white" : "bg-secondary text-ink-soft",
                        )}
                      >
                        {p.fixo === "inicio" ? "S" : p.fixo === "fim" ? "D" : i}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-foreground">{p.nome}</span>
                        {p.passageiros ? (
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Users className="h-3 w-3" />
                            {p.passageiros} passageiros
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">{p.endereco}</span>
                        )}
                      </span>
                      {!p.fixo && (
                        <button
                          onClick={() => remover(p.id)}
                          className="shrink-0 p-1 text-muted-foreground transition-colors hover:text-coral"
                          aria-label="Remover parada"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <p className="mt-3 flex items-start gap-1.5 px-1 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Saída e destino são fixos e não entram na reordenação — a operação não aceita começar no meio do
              roteiro.
            </p>
          </Card>

          {/* Mapa com o traçado. */}
          <Card title="Traçado" icon={MapPin} bodyClassName="p-3">
            <MapaCliente
              veiculos={marcadores}
              selecionado={null}
              onSelect={() => {}}
              altura="h-[420px] lg:h-[520px]"
              percurso={percurso}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              A distância considera um fator de 1,35 sobre a linha reta, que é a sinuosidade típica de malha urbana.
              Sem esse ajuste, a rota pareceria 25% mais curta do que é e o motorista chegaria atrasado.
            </p>
          </Card>
        </div>

        {/* Projeção financeira. */}
        <Card title="Projeção de economia" icon={Fuel} bodyClassName="p-4">
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] text-muted-foreground">Viagens por mês</span>
              <input
                type="number"
                value={viagensMes}
                onChange={(e) => setViagensMes(Number(e.target.value))}
                className="h-9 w-28 rounded-lg border border-border bg-white px-2.5 font-mono text-[13px] outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11.5px] text-muted-foreground">Custo por km (R$)</span>
              <input
                type="number"
                step="0.1"
                value={custoKm}
                onChange={(e) => setCustoKm(Number(e.target.value))}
                className="h-9 w-28 rounded-lg border border-border bg-white px-2.5 font-mono text-[13px] outline-none focus:border-accent"
              />
            </label>
            <p className="flex-1 text-[11.5px] text-muted-foreground">
              Os parâmetros ficam editáveis de propósito: o custo por quilômetro varia muito entre operações, e um
              valor embutido daria uma projeção que não corresponde à realidade de quem está olhando.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile icon={Route} label="Km por mês" value={nf(projecao.kmMes)} color="var(--brand-navy)" />
            <StatTile icon={Route} label="Km por ano" value={nf(projecao.kmAno)} color="var(--brand-sky)" />
            <StatTile
              icon={Fuel}
              label="Economia mensal"
              value={`R$ ${nf(projecao.reaisMes)}`}
              color="var(--leaf)"
            />
            <StatTile
              icon={Fuel}
              label="Economia anual"
              value={`R$ ${nf(projecao.reaisAno)}`}
              color="var(--leaf)"
              foot="por veículo nesta rota"
            />
          </div>
        </Card>

        {/* Como o cálculo funciona. */}
        <Card title="Como a rota é calculada" icon={Sparkles} bodyClassName="p-4">
          <ol className="space-y-2 text-[12.5px] text-ink-soft">
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-tint font-mono text-[11px] font-bold text-brand-navy">
                1
              </span>
              <span>
                <strong className="text-foreground">Vizinho mais próximo.</strong> Monta uma primeira rota indo sempre
                ao ponto mais perto ainda não visitado. É rápido, mas fica 20 a 25% acima do ideal.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-tint font-mono text-[11px] font-bold text-brand-navy">
                2
              </span>
              <span>
                <strong className="text-foreground">Refinamento 2-opt.</strong> Desfaz cruzamentos: sempre que dois
                trechos se cruzam, inverter o segmento entre eles encurta o caminho. Chega perto de 5% do ideal.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-tint font-mono text-[11px] font-bold text-brand-navy">
                3
              </span>
              <span>
                <strong className="text-foreground">Restrições respeitadas.</strong> Saída e destino ficam fixos, e o
                tempo de permanência em cada parada entra na duração — mas não na distância.
              </span>
            </li>
          </ol>
          <p className="mt-3 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
            O cálculo roda no navegador, em milissegundos. Não depende de servidor nem de serviço pago de
            roteirização.
          </p>
        </Card>
      </div>
    </>
  );
}
