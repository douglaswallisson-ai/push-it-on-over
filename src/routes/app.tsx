import { createFileRoute, redirect } from "@tanstack/react-router";
import { estaAutenticado } from "@/lib/session";
import { dentroDeIframe } from "@/lib/embutido";
import { AppShell } from "@/components/ss/layout/AppShell";

export const Route = createFileRoute("/app")({
  /**
   * Guard de acesso. Antes qualquer pessoa entrava digitando /app na barra de
   * endereço — o login era decorativo.
   *
   * A checagem é client-only: no SSR não há sessão para consultar, então
   * deixamos passar e o cliente reavalia na hidratação.
   */
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;
    if (!estaAutenticado()) {
      // Dentro do sistema de um parceiro não há tela de login: avisa que expirou.
      if (dentroDeIframe()) throw redirect({ to: "/embed", search: { expirou: "1" } as never });
      throw redirect({ to: "/login", search: { destino: location.href } as never });
    }
  },
  head: () => ({
    meta: [
      { title: "SS Telemática — Plataforma de Gestão de Frota" },
      {
        name: "description",
        content:
          "Painel operacional de telemetria, frota, motoristas e fretamento da SS Telemática.",
      },
      { property: "og:title", content: "SS Telemática — Plataforma de Gestão de Frota" },
      {
        property: "og:description",
        content: "Telemetria, frota, motoristas e fretamento em um só painel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppShell,
});
