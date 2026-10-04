import type { ReactNode } from "react";
import { CalendarDays, ChevronDown, Truck, User, X, type LucideIcon } from "lucide-react";

/**
 * Barra de filtros padrão da frota: veículo · motorista · data. Reutilizável em
 * qualquer tela persistente (eventos, mapa, posicionamento, viagens…). Mantém o
 * mesmo comportamento e visual em todo o sistema.
 */

export type FleetFilterValue = { veiculo: string; motorista: string; data: string };
export type FilterField = "veiculo" | "motorista" | "data";

function FilterSelect({
  icon: Icon,
  label,
  value,
  onChange,
  options,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-[13px] transition-colors hover:border-[#c7d2df]">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="cursor-pointer appearance-none bg-transparent pr-5 font-medium text-foreground outline-none"
        >
          {/* Sem repetição: dois veículos com o mesmo rótulo duplicavam a chave. */}
          {[...new Set(options)].map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
    </label>
  );
}

export function FleetFilters({
  veiculos,
  motoristas,
  value,
  onChange,
  extra,
  show = ["veiculo", "motorista", "data"],
}: {
  veiculos: string[];
  motoristas: string[];
  value: FleetFilterValue;
  onChange: (v: FleetFilterValue) => void;
  /** Chips/filtros adicionais específicos da tela (severidade, tipo…). */
  extra?: ReactNode;
  /** Quais campos exibir. Padrão: os três. */
  show?: FilterField[];
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-card">
      {show.includes("veiculo") && (
        <FilterSelect
          icon={Truck}
          label="Veículo"
          value={value.veiculo}
          onChange={(v) => onChange({ ...value, veiculo: v })}
          options={["Todos", ...veiculos]}
        />
      )}
      {show.includes("motorista") && (
        <FilterSelect
          icon={User}
          label="Motorista"
          value={value.motorista}
          onChange={(v) => onChange({ ...value, motorista: v })}
          options={["Todos", ...motoristas]}
        />
      )}
      {show.includes("data") && (
        <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-[13px] transition-colors hover:border-[#c7d2df]">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Data:</span>
          <input
            type="date"
            value={value.data}
            onChange={(e) => onChange({ ...value, data: e.target.value })}
            className="cursor-pointer bg-transparent font-medium text-foreground outline-none"
          />
        </label>
      )}

      {extra}

      <button
        onClick={() => onChange({ veiculo: "Todos", motorista: "Todos", data: value.data })}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
        Limpar
      </button>
    </div>
  );
}
