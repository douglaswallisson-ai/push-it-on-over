import { PageHeader } from "@/components/ss/layout/PageHeader";
import { TelemetriaEquipamentos } from "@/components/ss/frota/TelemetriaEquipamentos";

/**
 * Telemetria de equipamentos — rota própria, destino do KPI "Sem sinal" da tela
 * de Veículos. O conteúdo é o mesmo componente usado na aba Telemetria da tela
 * de Manutenção, para não existirem duas versões da mesma lista.
 */
export default function Telemetria() {
  return (
    <>
      <PageHeader title="Telemetria" subtitle="Frota › Equipamentos e comunicação" />
      <div className="mx-auto max-w-[1360px] space-y-5 px-6 py-6 md:px-8">
        <TelemetriaEquipamentos />
      </div>
    </>
  );
}
