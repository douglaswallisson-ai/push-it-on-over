import { createFileRoute, redirect } from "@tanstack/react-router";
import { ConsoleShell } from "@/components/ss/console/ConsoleShell";
import { estaAutenticado, lerSessao } from "@/lib/session";

/**
 * Console de gestão da plataforma. Só o dono do software entra aqui — o guarda
 * verifica sessão e perfil antes de montar o shell.
 */
export const Route = createFileRoute("/console")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (!estaAutenticado()) throw redirect({ to: "/login" });
    if (lerSessao()?.perfil !== "super_admin") throw redirect({ to: "/app" });
  },
  component: ConsoleShell,
});
