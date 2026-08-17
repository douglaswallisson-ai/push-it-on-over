import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Info, MapPin, Route, Search, Shapes, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { Card, DataTable, Pill, StatTile, type Column } from "@/components/ss/ui/data";
import { EmptyNote, ErrorBox, SkeletonRows } from "@/components/ss/ui/QueryState";
import { nf, pontosApiQuery } from "@/lib/queries";
import { usandoMock } from "@/lib/modo";
import { cn } from "@/lib/utils";

/**
 * Pontos de interesse e cercas.
 *
 * Módulo que existia no backend (`ss-gateway-poi_fence` calcula entrada e
 * saída) e nunca teve interface. É o que sustenta o ponto de controle: a cerca
 * vinculada ao turno é o que permite saber se a viagem abriu no lugar certo.
 *
 * A lista é derivada do uso real — quais pontos aparecem nas viagens — porque
 * a tabela de cadastro não está mapeada. Um ponto cadastrado e nunca visitado
 * não aparece aqui, e a tela diz isso em vez de deixar parecer inventário
 * completo.
 */

type Ponto = {
  id?: number;
  name: string;
  type: string;
  visits: number;
  latitude?: number;
  longitude?: number;
  source: string;
};

export default function PontosInteresse() {
  const [dias, setDias] = useState(30);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<"todos" | "poi" | "area">("todos");

  const q = useQuery(pontosApiQuery(dias, busca || undefined));
  const todos = ((q.data as Ponto[] | undefined) ?? []).filter(
    (p) => tipo === "todos" || p.type === tipo,
  );

  const pois = todos.filter((p) => p.type === "poi");
  const areas = todos.filter((p) => p.type === "area");
  const totalVisitas = todos.reduce((a, p) => a + p.visits, 0);

  const COLS: Column<Ponto & Record<string, unknown>>[] = [
    {
      key: "name",
      header: "Ponto",
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              p.type === "area" ? "bg-gold-tint" : "bg-navy-tint",
            )}
          >
            {p.type === "area" ? (
              <Shapes className="h-4 w-4 text-gold" />
            ) : (
              <MapPin className="h-4 w-4 text-brand-navy" />
            )}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-medium text-foreground">{p.name}</div>
            {p.id != null && <div className="font-mono text-[11px] text-muted-foreground">#{p.id}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Tipo",
      align: "center",
      render: (p) => (
        <Pill tone={p.type === "area" ? "gold" : "sky"}>{p.type === "area" ? "Cerca" : "Ponto"}</Pill>
      ),
    },
    {
      key: "visits",
      header: "Passagens",
      align: "right",
      render: (p) => {
        const maior = Math.max(1, ...todos.map((x) => x.visits));
        return (
          <div className="ml-auto w-32">
            <div className="text-right font-mono text-[12.5px] font-semibold text-foreground">{nf(p.visits)}</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-1.5 rounded-full bg-brand-navy" style={{ width: `${(p.visits / maior) * 100}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "coords",
      header: "Coordenada aproximada",
      align: "right",
      render: (p) =>
        p.latitude != null ? (
          <span className="font-mono text-[11.5px] text-muted-foreground">
            {p.latitude.toFixed(4)}, {p.longitude?.toFixed(4)}
          </span>
        ) : (
          <span className="text-[11.5px] text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Pontos e cercas"
        subtitle="Cadastros › Pontos de interesse"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={dias}
              onChange={(e) => setDias(Number(e.target.value))}
              className="h-9 rounded-lg border border-border bg-white px-3 text-[13px] outline-none focus:border-accent"
            >
              {[7, 30, 90, 180].map((d) => (
                <option key={d} value={d}>
                  últimos {d} dias
                </option>
              ))}
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Nome do ponto…"
                className="h-9 w-52 rounded-lg border border-border bg-white pl-8 pr-3 text-[13px] outline-none focus:border-accent"
              />
            </div>
          </div>
        }
      />

      <div className="mx-auto max-w-[1360px] space-y-5 px-6 py-6 md:px-8">
        {usandoMock() ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
            <p className="text-[12.5px] text-muted-foreground">
              Esta tela lê direto da API — não tem versão de exemplo. Alterne para <strong>API real</strong> em
              Administração › Configurações.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile icon={MapPin} label="Pontos" value={nf(pois.length)} color="var(--brand-navy)" />
              <StatTile icon={Shapes} label="Cercas" value={nf(areas.length)} color="var(--gold)" />
              <StatTile icon={TrendingUp} label="Passagens" value={nf(totalVisitas)} color="var(--brand-sky)" foot={`em ${dias} dias`} />
              <StatTile
                icon={Route}
                label="Média por ponto"
                value={todos.length ? nf(Math.round(totalVisitas / todos.length)) : "0"}
                color="var(--leaf)"
              />
            </div>

            <div className="flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-sky" />
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                A lista vem do <strong className="text-foreground">uso real</strong>: são os pontos e cercas que
                apareceram nas viagens do período. Um ponto cadastrado e nunca visitado não aparece, e a coordenada é
                a média das passagens — o valor exato está no cadastro, que ainda não foi mapeado.
              </p>
            </div>

            <Card
              title="Pontos observados"
              icon={MapPin}
              action={
                <div className="flex items-center gap-1.5">
                  {(["todos", "poi", "area"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTipo(t)}
                      className={cn(
                        "rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                        tipo === t
                          ? "bg-brand-navy text-white"
                          : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                      )}
                    >
                      {t === "todos" ? "Todos" : t === "poi" ? "Pontos" : "Cercas"}
                    </button>
                  ))}
                </div>
              }
              bodyClassName="p-4"
            >
              {q.isPending ? (
                <SkeletonRows rows={8} />
              ) : q.error ? (
                <ErrorBox error={q.error} onRetry={() => q.refetch()} />
              ) : todos.length === 0 ? (
                <EmptyNote>Nenhum ponto registrado no período.</EmptyNote>
              ) : (
                <DataTable columns={COLS} rows={todos as (Ponto & Record<string, unknown>)[]} />
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
