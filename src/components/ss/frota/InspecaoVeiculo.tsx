import type { LucideIcon } from "lucide-react";
import { BatteryCharging, Droplet, Fuel, Gauge, Thermometer, Waves } from "lucide-react";
import type { Sinais } from "@/lib/manutencao-api";
import { cn } from "@/lib/utils";

/**
 * Inspeção visual com os SINAIS REAIS da última leitura do veículo
 * (dev_status): arrefecimento, pressão do óleo, bateria, combustível, ARLA e
 * ar dos freios. A imagem segue o tipo do veículo — foto de ônibus ou
 * ilustração de caminhão. Sem o sinal, o ponto aparece cinza ("sem sensor").
 *
 * As faixas de atenção/crítico são as mesmas dos alertas do servidor
 * (manutencao.py, LIMITES).
 */

type Tom = "ok" | "atencao" | "critico" | "sem";
type Ponto = { id: keyof Sinais; rotulo: string; icon: LucideIcon; x: number; y: number };

const PONTOS: Record<"onibus" | "caminhao", Ponto[]> = {
  // Foto real (public/onibus.webp): motor ao fundo à esquerda, frente à direita.
  onibus: [
    { id: "temp", rotulo: "Arrefecimento", icon: Thermometer, x: 14, y: 40 },
    { id: "oleo", rotulo: "Pressão do óleo", icon: Droplet, x: 11, y: 57 },
    { id: "voltage", rotulo: "Bateria", icon: BatteryCharging, x: 40, y: 56 },
    { id: "combustivel", rotulo: "Combustível", icon: Fuel, x: 52, y: 64 },
    { id: "arla", rotulo: "ARLA 32", icon: Waves, x: 30, y: 64 },
    { id: "ar_freio", rotulo: "Ar dos freios", icon: Gauge, x: 64, y: 72 },
  ],
  // Ilustração (CaminhaoArte): cabine à direita, motor sob a cabine.
  caminhao: [
    { id: "temp", rotulo: "Arrefecimento", icon: Thermometer, x: 92, y: 55 },
    { id: "oleo", rotulo: "Pressão do óleo", icon: Droplet, x: 80, y: 68 },
    { id: "voltage", rotulo: "Bateria", icon: BatteryCharging, x: 72, y: 50 },
    { id: "combustivel", rotulo: "Combustível", icon: Fuel, x: 60, y: 64 },
    { id: "arla", rotulo: "ARLA 32", icon: Waves, x: 44, y: 72 },
    { id: "ar_freio", rotulo: "Ar dos freios", icon: Gauge, x: 22, y: 64 },
  ],
};

const COR: Record<Tom, string> = { ok: "bg-leaf", atencao: "bg-gold", critico: "bg-coral", sem: "bg-muted-foreground/60" };

function avaliar(id: keyof Sinais, s: Sinais, L: Record<string, number>): { tom: Tom; valor: string; detalhe: string } {
  const v = s[id];
  if (v == null) return { tom: "sem", valor: "—", detalhe: "Este veículo não envia esse sinal." };
  const n = (x: number, c = 0) => x.toLocaleString("pt-BR", { maximumFractionDigits: c, minimumFractionDigits: c });
  switch (id) {
    case "temp":
      return {
        tom: v >= L.temp_critico ? "critico" : v >= L.temp_atencao ? "atencao" : "ok",
        valor: `${n(v)}°C`,
        detalhe: `Líquido de arrefecimento a ${n(v)} °C. Atenção a partir de ${L.temp_atencao} °C, crítico a partir de ${L.temp_critico} °C.`,
      };
    case "oleo": {
      const girando = (s.rpm ?? 0) >= L.oleo_rpm_min;
      return {
        tom: girando && v < L.oleo_min_kpa ? "critico" : "ok",
        valor: `${n(v)} kPa`,
        detalhe: girando
          ? `Pressão do óleo em ${n(v)} kPa com o motor a ${n(s.rpm ?? 0)} rpm. Mínimo de ${L.oleo_min_kpa} kPa com o motor acelerado.`
          : `Pressão do óleo em ${n(v)} kPa. Só é avaliada com o motor acima de ${L.oleo_rpm_min} rpm.`,
      };
    }
    case "voltage": {
      const v24 = v > 18;
      const crit = v24 ? L.v24_critico : L.v12_critico;
      const aten = v24 ? L.v24_atencao : L.v12_atencao;
      return {
        tom: v < crit ? "critico" : v < aten ? "atencao" : "ok",
        valor: `${n(v, 1)} V`,
        detalhe: `Sistema de ${v24 ? "24" : "12"} V. Atenção abaixo de ${aten} V, crítico abaixo de ${crit} V.`,
      };
    }
    case "arla":
      return { tom: v < L.arla_min ? "atencao" : "ok", valor: `${n(v)}%`, detalhe: `Tanque de ARLA 32 em ${n(v)}%.` };
    case "combustivel":
      return { tom: v < 10 ? "atencao" : "ok", valor: `${n(v)}%`, detalhe: `Tanque de combustível em ${n(v)}%.` };
    case "ar_freio":
      return { tom: "ok", valor: n(v), detalhe: `Pressão do sistema de ar dos freios: ${n(v)} (unidade informada pelo veículo; sem alerta automático).` };
    default:
      return { tom: "sem", valor: "—", detalhe: "" };
  }
}

export function InspecaoVeiculo({
  tipo,
  sinais,
  limites,
  selecionado,
  onSelect,
}: {
  tipo: "onibus" | "caminhao";
  sinais: Sinais;
  limites: Record<string, number>;
  selecionado?: string | null;
  onSelect?: (id: string, info: { rotulo: string; valor: string; detalhe: string; tom: Tom }) => void;
}) {
  const pontos = PONTOS[tipo];
  return (
    <div className="relative mx-auto w-full max-w-[620px]" style={{ aspectRatio: tipo === "onibus" ? "477 / 280" : "640 / 300" }}>
      {tipo === "onibus" ? (
        <img src="/onibus.webp" alt="Ônibus" className="h-full w-full rounded-xl object-cover" />
      ) : (
        <CaminhaoArte />
      )}
      {pontos.map((p) => {
        const a = avaliar(p.id, sinais, limites);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect?.(p.id, { rotulo: p.rotulo, ...a })}
            title={`${p.rotulo}: ${a.valor}`}
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            className={cn(
              "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold text-white shadow-card ring-4 ring-white/40 transition-transform hover:scale-110",
              COR[a.tom],
              selecionado === p.id && "scale-[1.15] ring-8",
              a.tom === "critico" && "animate-pulse",
            )}
          >
            <p.icon className="h-3 w-3" />
            {a.valor}
          </button>
        );
      })}
    </div>
  );
}

export { avaliar as avaliarSinal };

/** Caminhão em perfil (frente à direita): cavalo mecânico com baú. */
function CaminhaoArte() {
  return (
    <svg viewBox="0 0 640 300" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="cam-bau" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dde5ec" />
        </linearGradient>
        <linearGradient id="cam-cabine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2651A6" />
          <stop offset="100%" stopColor="#1B3A6B" />
        </linearGradient>
        <linearGradient id="cam-vidro" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dcecf6" />
          <stop offset="100%" stopColor="#9cc4dd" />
        </linearGradient>
      </defs>
      <ellipse cx="322" cy="270" rx="300" ry="12" fill="#0d0d0d" opacity="0.07" />
      {/* baú */}
      <rect x="20" y="62" width="420" height="152" rx="8" fill="url(#cam-bau)" stroke="#c4cdd6" strokeWidth="2" />
      <rect x="20" y="186" width="420" height="10" fill="#32A9D9" opacity="0.85" />
      <rect x="20" y="196" width="420" height="4" fill="#7FBF50" />
      {[110, 200, 290, 380].map((x) => (
        <line key={x} x1={x} y1="70" x2={x} y2="180" stroke="#e3e9ef" strokeWidth="2" />
      ))}
      {/* chassi */}
      <rect x="30" y="214" width="580" height="12" rx="3" fill="#3b4652" />
      {/* tanques (combustível e ARLA) */}
      <rect x="350" y="198" width="54" height="30" rx="10" fill="#c9d3dc" stroke="#9aa6b4" strokeWidth="2" />
      <rect x="282" y="202" width="40" height="24" rx="8" fill="#d7e6f3" stroke="#9aa6b4" strokeWidth="2" />
      {/* cabine */}
      <path d="M458 214 L458 92 Q458 70 480 68 L560 64 Q590 64 604 96 L616 150 Q620 168 620 186 L620 214 Z" fill="url(#cam-cabine)" />
      <path d="M538 82 L572 80 Q590 82 598 110 L604 138 L538 138 Z" fill="url(#cam-vidro)" stroke="#a9c4d6" />
      <rect x="474" y="96" width="50" height="50" rx="6" fill="url(#cam-vidro)" stroke="#a9c4d6" />
      <rect x="474" y="152" width="50" height="4" rx="2" fill="#7fa6e8" opacity="0.6" />
      {/* grade, farol e para-choque */}
      <rect x="606" y="160" width="14" height="34" rx="3" fill="#24324a" />
      <ellipse cx="616" cy="200" rx="6" ry="7" fill="#ffe08a" stroke="#e6c14e" />
      <rect x="586" y="206" width="38" height="12" rx="3" fill="#8b97a5" />
      {/* retrovisor */}
      <line x1="604" y1="92" x2="624" y2="84" stroke="#8b97a5" strokeWidth="3" />
      <rect x="620" y="74" width="12" height="22" rx="3" fill="#c9d3dc" />
      {/* rodas */}
      {[110, 170, 500, 580].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="232" r="30" fill="#1c2530" />
          <circle cx={cx} cy="232" r="15" fill="#9aa6b4" />
          <circle cx={cx} cy="232" r="5" fill="#5b6674" />
        </g>
      ))}
    </svg>
  );
}
