import { useState } from "react";
import { Outlet } from "@/lib/router-compat";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TourProvider } from "@/components/ss/tour/TourProvider";
import { SelmaLauncher } from "@/components/ss/selma/SelmaLauncher";
import { Toaster } from "@/components/ui/sonner";
import { BuscaGlobal } from "@/components/ss/layout/BuscaGlobal";
import { PonteEmbutido } from "@/components/ss/layout/PonteEmbutido";
import { RegistroPaginas } from "@/components/ss/layout/RegistroPaginas";
import { lerEmbutido } from "@/lib/embutido";

/**
 * Casca do sistema: trilho de ícones fixo + conteúdo sobre o canvas
 * cinza-azulado. A margem do conteúdo é a largura do TRILHO (68px), não do
 * menu expandido — assim o menu abre por cima ao passar o mouse e nada reflui.
 *
 * O TourProvider envolve o conteúdo para o tour guiado ter acesso à rota atual.
 */
export function AppShell() {
  const [open, setOpen] = useState(false);
  // Dentro do sistema de um parceiro: sem o menu e a marca da SS (o menu é o
  // dele), a não ser que ele peça o menu com `menu=1`.
  const embutido = lerEmbutido();
  const comMenu = !embutido || embutido.menu;

  return (
    <TourProvider>
      <div className="min-h-screen bg-canvas">
        <RegistroPaginas />
        {embutido && <PonteEmbutido />}
        {comMenu && <Sidebar open={open} onClose={() => setOpen(false)} />}

        {comMenu && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="fixed left-4 top-4 z-[210] flex h-10 w-10 items-center justify-center rounded-full bg-sidebar text-white shadow-lg lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        )}

        <div className={comMenu ? "min-w-0 lg:ml-[68px]" : "min-w-0"}>
          <Outlet />
        </div>

        {!embutido && <SelmaLauncher />}
        {!embutido && <BuscaGlobal />}

        {/* Confirmações de ação. O sonner estava instalado mas nunca montado. */}
        <Toaster position="bottom-right" richColors closeButton />
      </div>
    </TourProvider>
  );
}
