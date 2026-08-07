import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/ss/layout/AppShell";

export const Route = createFileRoute("/app")({
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
