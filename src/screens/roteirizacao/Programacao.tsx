import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Pause, Play, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { veiculosApiQuery } from "@/lib/queries";
import { DIAS, programacoesQuery, RotasSeguras, type Programacao } from "@/lib/rotas-seguras-api";
import { mensagemErro } from "@/lib/suporte-api";
import { cn } from "@/lib/utils";

/**
 * Programação de viagens: qual veículo faz qual rota, em que dias e horário.
 * É o que faltava no banco para o CCO avisar "Desvio de rota" e "Parada fora do
 * lugar" (06/10/2026: nenhum veículo ativo tinha rota vinculada no sistema atual).
 */

type Base = {
  pontos: { nome: string; latitude: number; longitude: number }[];
  trajeto: [number, number][];
  unitId?: string;
  nome: string;
};

export function ProgramarViagem({
  grupo,
  base,
  onFechar,
}: {
  grupo: string;
  base: Base;
  onFechar: () => void;
}) {
  const qc = useQueryClient();
  const veiculos = useQuery(veiculosApiQuery());
  const [f, setF] = useState({
    unit_id: base.unitId ?? "",
    nome: base.nome,
    dias: [0, 1, 2, 3, 4],
    hora_ini: "06:00",
    hora_fim: "18:00",
    tolerancia_m: 300,
    desvio_min: 2,
    parada_max_min: 10,
  });
  const [salvando, setSalvando] = useState(false);
  const salvar = async () => {
    if (!f.unit_id || !f.dias.length) return;
    setSalvando(true);
    try {
      await RotasSeguras.criarProgramacao({
        group_id: Number(grupo),
        unit_id: Number(f.unit_id),
        nome: f.nome.trim(),
        pontos: base.pontos,
        trajeto: base.trajeto,
        dias: f.dias,
        hora_ini: f.hora_ini,
        hora_fim: f.hora_fim,
        tolerancia_m: f.tolerancia_m,
        desvio_min: f.desvio_min,
        parada_max_min: f.parada_max_min,
        ativo: true,
      });
      await qc.invalidateQueries({ queryKey: ["programacao"] });
      toast.success(
        "Viagem programada. O CCO passa a vigiar desvio de rota e parada fora do lugar.",
      );
      onFechar();
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };
  const campo = "h-9 w-full rounded-lg border border-border bg-white px-3 text-[13px]";
  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-label="Programar viagem"
    >
      <div className="w-[520px] max-w-full rounded-2xl bg-card p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold">
            <CalendarClock className="h-4 w-4" /> Programar viagem
          </p>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded p-1 hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
          <label className="col-span-2 space-y-1">
            <span>Nome</span>
            <input
              className={campo}
              value={f.nome}
              onChange={(e) => setF({ ...f, nome: e.target.value })}
            />
          </label>
          <label className="col-span-2 space-y-1">
            <span>Veículo</span>
            <select
              className={campo}
              value={f.unit_id}
              onChange={(e) => setF({ ...f, unit_id: e.target.value })}
            >
              <option value="">Escolha o veículo</option>
              {(veiculos.data?.items ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {[v.prefixo, v.placa].filter(Boolean).join(" · ")}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-2 space-y-1">
            <span>Dias</span>
            <div className="flex flex-wrap gap-1">
              {DIAS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={f.dias.includes(i)}
                  onClick={() =>
                    setF({
                      ...f,
                      dias: f.dias.includes(i)
                        ? f.dias.filter((x) => x !== i)
                        : [...f.dias, i].sort(),
                    })
                  }
                  className={cn(
                    "h-8 w-11 rounded-md border text-[12px] font-medium",
                    f.dias.includes(i)
                      ? "border-brand-navy bg-brand-navy text-white"
                      : "border-border",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <label className="space-y-1">
            <span>Começa às</span>
            <input
              type="time"
              className={campo}
              value={f.hora_ini}
              onChange={(e) => setF({ ...f, hora_ini: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span>Termina às</span>
            <input
              type="time"
              className={campo}
              value={f.hora_fim}
              onChange={(e) => setF({ ...f, hora_fim: e.target.value })}
            />
          </label>
          <label className="space-y-1">
            <span>Fora da rota a partir de (m)</span>
            <input
              type="number"
              min={50}
              max={5000}
              className={campo}
              value={f.tolerancia_m}
              onChange={(e) => setF({ ...f, tolerancia_m: Number(e.target.value) || 300 })}
            />
          </label>
          <label className="space-y-1">
            <span>Desvio depois de (min)</span>
            <input
              type="number"
              min={1}
              max={60}
              className={campo}
              value={f.desvio_min}
              onChange={(e) => setF({ ...f, desvio_min: Number(e.target.value) || 2 })}
            />
          </label>
          <label className="col-span-2 space-y-1">
            <span>Parada fora do lugar depois de (min parado fora da rota e fora das cercas)</span>
            <input
              type="number"
              min={2}
              max={240}
              className={campo}
              value={f.parada_max_min}
              onChange={(e) => setF({ ...f, parada_max_min: Number(e.target.value) || 10 })}
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Caminho com {base.trajeto.length} pontos. Garagem, clientes e postos cadastrados como
          cerca contam como lugar permitido de parada.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-md border border-border px-3 py-1.5 text-[13px]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando || !f.unit_id || !f.dias.length || f.nome.trim().length < 2}
            onClick={salvar}
            className="inline-flex items-center gap-1 rounded-md bg-brand-navy px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
            Programar
          </button>
        </div>
      </div>
    </div>
  );
}

export function ListaProgramacao({ grupo }: { grupo: string }) {
  const qc = useQueryClient();
  const q = useQuery(programacoesQuery(grupo));
  const itens = q.data?.data ?? [];
  const alternar = async (p: Programacao) => {
    try {
      const completa = await RotasSeguras.verProgramacao(p.id);
      const { id, ...resto } = completa;
      await RotasSeguras.editarProgramacao(id, { ...resto, ativo: !p.ativo });
      await qc.invalidateQueries({ queryKey: ["programacao"] });
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  };
  const remover = async (p: Programacao) => {
    try {
      await RotasSeguras.removerProgramacao(p.id);
      await qc.invalidateQueries({ queryKey: ["programacao"] });
      toast.success("Programação removida");
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  };
  return (
    <main className="mx-auto max-w-[1200px] space-y-3 px-4 py-4 md:px-6">
      <p className="rounded-lg bg-brand-sky/10 px-3 py-2 text-[12px] text-brand-navy">
        Com a viagem programada, o CCO avisa <b>Desvio de rota</b> (andando fora do caminho) e{" "}
        <b>Parada fora do lugar</b> (parado fora do caminho e fora das cercas do cliente). Para
        programar, calcule a rota na aba <b>Rota</b> e use "Programar viagem".
      </p>
      {q.isPending && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {q.error && <p className="text-[13px] text-coral">{mensagemErro(q.error)}</p>}
      {!q.isPending && !itens.length && (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-[13px] text-muted-foreground">
          Nenhuma viagem programada.
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {itens.length > 0 && (
          <table className="w-full text-[13px]">
            <thead className="border-b border-border text-left text-[12px] text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Viagem</th>
                <th className="px-3 py-2">Veículo</th>
                <th className="px-3 py-2">Dias e horário</th>
                <th className="px-3 py-2">Regras</th>
                <th className="px-3 py-2">Situação</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {itens.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">
                    <b>{p.nome}</b>
                    <span className="block text-[12px] text-muted-foreground">
                      {p.pontos.map((x) => x.nome).join(" → ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{p.veiculo}</td>
                  <td className="px-3 py-2">
                    {p.dias.map((d) => DIAS[d]).join(", ")}
                    <span className="block text-[12px] text-muted-foreground">
                      {p.hora_ini} às {p.hora_fim}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[12px] text-muted-foreground">
                    fora da rota a {p.tolerancia_m} m por {p.desvio_min} min · parada fora após{" "}
                    {p.parada_max_min} min
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        !p.ativo
                          ? "bg-secondary text-muted-foreground"
                          : p.em_execucao
                            ? "bg-leaf/15 text-leaf"
                            : "bg-brand-sky/15 text-brand-navy",
                      )}
                    >
                      {!p.ativo
                        ? "Pausada"
                        : p.em_execucao
                          ? "Em execução agora"
                          : "Aguardando horário"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => alternar(p)}
                      title={p.ativo ? "Pausar" : "Retomar"}
                      aria-label={p.ativo ? "Pausar" : "Retomar"}
                      className="rounded p-1 hover:bg-secondary"
                    >
                      {p.ativo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => remover(p)}
                      title="Remover"
                      aria-label="Remover"
                      className="rounded p-1 text-muted-foreground hover:text-coral"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
