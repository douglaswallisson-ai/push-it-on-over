import { useLocation } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";

/** Destino provisório dos itens de menu ainda não desenhados. */
export default function EmBreve() {
  const { pathname } = useLocation();
  const nome = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
  const titulo = nome.charAt(0).toUpperCase() + nome.slice(1);

  return (
    <>
      <PageHeader title={titulo || "Em breve"} subtitle="Tela ainda não desenhada" />
      <div className="mx-auto max-w-[1400px] px-8 py-6">
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            A navegação já chega até <code className="font-mono text-[13px]">{pathname}</code>.
            Estamos fazendo uma tela por vez.
          </p>
        </div>
      </div>
    </>
  );
}
