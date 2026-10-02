import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { aplicarMarca, avisarParceiro, corValida, gravarEmbutido, lerEmbutido, logoValida, origemDoPai } from "@/lib/embutido";

/**
 * Conversa com o sistema do parceiro por `postMessage`, só com a origem dele:
 *
 * Enviamos   { origem: "ss-plataforma", tipo: "ss:pagina", caminho, titulo }
 *            { origem: "ss-plataforma", tipo: "ss:altura", altura }
 * Recebemos  { tipo: "ss:navegar", caminho: "/app/..." }
 *            { tipo: "ss:marca", cor?, destaque?, logo? }
 */
export function PonteEmbutido() {
  const navigate = useNavigate();

  useEffect(() => {
    const c = lerEmbutido();
    if (!c) return;
    aplicarMarca(c.marca);

    let ultimo = "";
    const pagina = () => {
      const caminho = window.location.pathname + window.location.hash;
      if (caminho === ultimo) return;
      ultimo = caminho;
      avisarParceiro({ tipo: "ss:pagina", caminho, titulo: document.querySelector("h1")?.textContent ?? "" });
    };
    const intervalo = setInterval(pagina, 500);
    pagina();

    const obs = new ResizeObserver(() => avisarParceiro({ tipo: "ss:altura", altura: document.documentElement.scrollHeight }));
    obs.observe(document.body);

    const aoReceber = (e: MessageEvent) => {
      const atual = lerEmbutido();
      if (!atual || e.origin !== origemDoPai() || !atual.parceiro.origens.includes(e.origin)) return;
      const d = e.data ?? {};
      if (d.tipo === "ss:navegar" && typeof d.caminho === "string" && /^\/app(\/|$)/.test(d.caminho) && !d.caminho.includes("//")) {
        navigate(d.caminho);
      }
      if (d.tipo === "ss:marca") {
        const marca = {
          ...atual.marca,
          ...(corValida(d.cor) ? { cor: corValida(d.cor) } : {}),
          ...(corValida(d.destaque) ? { destaque: corValida(d.destaque) } : {}),
          ...(logoValida(d.logo) ? { logo: logoValida(d.logo) } : {}),
        };
        gravarEmbutido({ ...atual, marca });
        aplicarMarca(marca);
        window.dispatchEvent(new Event("ss:marca"));
      }
    };
    window.addEventListener("message", aoReceber);
    return () => {
      clearInterval(intervalo);
      obs.disconnect();
      window.removeEventListener("message", aoReceber);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/** Marca atual do modo embutido (atualiza quando o parceiro troca por mensagem). */
export function useMarcaEmbutido() {
  const [, forcar] = useStateTick();
  useEffect(() => {
    const f = () => forcar();
    window.addEventListener("ss:marca", f);
    return () => window.removeEventListener("ss:marca", f);
  }, [forcar]);
  return lerEmbutido();
}

function useStateTick(): [number, () => void] {
  const [n, setN] = useState(0);
  return [n, useCallback(() => setN((x) => x + 1), [])];
}
