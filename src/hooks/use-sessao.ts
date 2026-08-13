import { useEffect, useState } from "react";
import { assinar, lerSessao, type Sessao } from "@/lib/session";

/**
 * Lê a sessão de forma segura em SSR.
 *
 * A sessão vive em `sessionStorage`, que não existe no servidor. Ler direto
 * durante a renderização faz o HTML do servidor sair sem usuário e o cliente
 * hidratar com usuário — divergência que o React acusa, e que na prática
 * aparecia como um piscar de "Sem permissão" antes do conteúdo real.
 *
 * Aqui o primeiro render (servidor e hidratação) é sempre `carregando`, e o
 * valor real entra no efeito. Componentes que dependem de perfil devem esperar
 * `carregando` terminar antes de decidir bloquear alguma coisa.
 */
export function useSessao(): { sessao: Sessao | null; carregando: boolean } {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setSessao(lerSessao());
    setCarregando(false);
    // Reage a login, logout e troca de organização feitos em qualquer tela.
    return assinar("sessao", () => setSessao(lerSessao()));
  }, []);

  return { sessao, carregando };
}
