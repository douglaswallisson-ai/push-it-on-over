import { createFileRoute } from "@tanstack/react-router";
import Login from "@/screens/Login";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — SS Telemática" },
      { name: "description", content: "Acesse a plataforma de gestão de frota da SS Telemática." },
      { property: "og:title", content: "Entrar — SS Telemática" },
      { property: "og:description", content: "Acesse a plataforma de gestão de frota." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});
