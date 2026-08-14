import { PageHeader } from "@/components/ss/layout/PageHeader";
import { ModoDadosPainel } from "@/components/ss/admin/ModoDadosPainel";

/**
 * Configurações do sistema. Reúne o que é decisão de plataforma, não de
 * operação — hoje, a origem dos dados e a frequência de atualização.
 */
export default function ConfiguracoesAdmin() {
  return (
    <>
      <PageHeader title="Configurações" subtitle="Administração › Sistema" />
      <div className="mx-auto max-w-[1000px] space-y-5 px-6 py-6 md:px-8">
        <ModoDadosPainel />
      </div>
    </>
  );
}
