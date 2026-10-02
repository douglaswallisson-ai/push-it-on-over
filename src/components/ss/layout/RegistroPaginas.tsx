import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { lerTokens } from "@/lib/auth-api";
import { lerEmbutido } from "@/lib/embutido";
import { usandoMock } from "@/lib/modo";
import { lerSessao } from "@/lib/session";

/**
 * Registro de páginas da plataforma: a cada tela que a pessoa deixa, avisa o
 * servidor qual tela foi e quanto tempo ficou VISÍVEL (aba escondida não
 * conta). Alimenta Console › Acessos › Páginas mais acessadas.
 *
 * Só o caminho da tela vai — nada do que está nela (filtros, dados, buscas).
 * Telas com parte variável no endereço (ex.: perfil de um motorista) vão pelo
 * modelo da rota, para somarem juntas.
 */

const BASE = (import.meta.env.VITE_API_BASE as string) || "";
const MIN_SEGUNDOS = 2; // abaixo disso foi só passagem (redirecionamento, clique errado)

type Aberta = { caminho: string; titulo: string; entrou: Date; visivelMs: number; desde: number | null };

export function RegistroPaginas() {
  const routeId = useRouterState({ select: (s) => s.matches[s.matches.length - 1]?.routeId ?? s.location.pathname });
  const hash = useRouterState({ select: (s) => s.location.hash });
  const atual = useRef<Aberta | null>(null);

  const fechar = (saindo = false) => {
    const a = atual.current;
    atual.current = null;
    if (!a || usandoMock() || !lerTokens()) return;
    const ms = a.visivelMs + (a.desde != null ? Date.now() - a.desde : 0);
    const segundos = Math.round(ms / 1000);
    if (segundos < MIN_SEGUNDOS) return;
    const visita = {
      caminho: a.caminho,
      titulo: a.titulo || null,
      entrou_em: a.entrou.toISOString(),
      segundos,
      group_id: Number(lerSessao()?.organizacaoAtivaId) || null,
      parceiro: lerEmbutido()?.parceiro.id ?? null,
    };
    if (saindo) {
      // Fechando a aba: requisição que sobrevive ao fechamento.
      const t = lerTokens();
      fetch(`${BASE}/api/v1/acessos/registro`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t.access_token}` } : {}) },
        body: JSON.stringify({ visitas: [visita] }),
      }).catch(() => {});
    } else {
      api.post("/api/v1/acessos/registro", { visitas: [visita] }).catch(() => {});
    }
  };

  // Troca de tela: fecha a anterior e abre a nova.
  useEffect(() => {
    const caminho = (routeId.replace(/\/$/, "") || "/") + (hash ? `#${hash.split("&")[0]}` : "");
    fechar();
    atual.current = { caminho, titulo: "", entrou: new Date(), visivelMs: 0, desde: document.visibilityState === "visible" ? Date.now() : null };
    // O título da tela aparece depois que ela monta.
    const t = setTimeout(() => {
      if (atual.current?.caminho === caminho) atual.current.titulo = document.querySelector("header h1")?.textContent?.trim().slice(0, 120) ?? "";
    }, 1200);
    return () => clearTimeout(t);
  }, [routeId, hash]); // eslint-disable-line react-hooks/exhaustive-deps

  // Aba escondida não conta tempo; fechar a aba envia o que estava aberto.
  useEffect(() => {
    const visibilidade = () => {
      const a = atual.current;
      if (!a) return;
      if (document.visibilityState === "hidden" && a.desde != null) {
        a.visivelMs += Date.now() - a.desde;
        a.desde = null;
      } else if (document.visibilityState === "visible" && a.desde == null) {
        a.desde = Date.now();
      }
    };
    const saindo = () => fechar(true);
    document.addEventListener("visibilitychange", visibilidade);
    window.addEventListener("pagehide", saindo);
    return () => {
      document.removeEventListener("visibilitychange", visibilidade);
      window.removeEventListener("pagehide", saindo);
      fechar();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
