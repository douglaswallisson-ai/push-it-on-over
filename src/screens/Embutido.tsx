import { useEffect, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { buscarPerfil, gravarTokensRecebidos } from "@/lib/auth-api";
import { entrarComPerfil, estaAutenticado } from "@/lib/session";
import { perfilDoUsuario } from "@/screens/Login";
import {
  aplicarMarca,
  corValida,
  dentroDeIframe,
  gravarEmbutido,
  lerEmbutido,
  logoValida,
  origemDoPai,
  origemPermitida,
  type Marca,
} from "@/lib/embutido";

/**
 * Porta de entrada do modo embutido: `/embed?ticket=...&tela=/app/mapa`.
 *
 * Parâmetros opcionais: `cor`, `destaque` (hex sem #), `logo` (https) — por
 * cima da marca cadastrada para o parceiro — e `menu=1` para mostrar o menu
 * lateral da plataforma.
 */

const BASE = (import.meta.env.VITE_API_BASE as string) || "";

function telaSegura(t: string | null) {
  // Só caminhos internos da plataforma; nada de URL externa.
  return t && /^\/app(\/[\w\-./#?=&%]*)?$/.test(t) && !t.includes("//") ? t : "/app";
}

export default function Embutido() {
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [marca, setMarca] = useState<Marca>({});

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ticket = q.get("ticket");
    const tela = telaSegura(q.get("tela"));
    const porUrl: Marca = {
      cor: corValida(q.get("cor")),
      destaque: corValida(q.get("destaque")),
      logo: logoValida(q.get("logo")),
    };

    if (q.get("expirou")) {
      setMarca(lerEmbutido()?.marca ?? {});
      setErro("Seu acesso expirou. Recarregue a página no sistema de origem para continuar.");
      return;
    }

    if (!ticket) {
      // Recarregou o iframe sem ticket: segue se ainda há sessão embutida.
      if (lerEmbutido() && estaAutenticado()) navigate(tela);
      else setErro("Este endereço precisa ser aberto pelo sistema parceiro.");
      return;
    }
    // Tira o ticket da barra de endereço/histórico assim que lido.
    history.replaceState(null, "", window.location.pathname);

    (async () => {
      const r = await fetch(`${BASE}/api/v1/embed/entrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket }),
      });
      if (!r.ok) throw new Error("Acesso inválido ou expirado. Volte ao sistema de origem e abra a tela de novo.");
      const dados = await r.json();
      const parceiro = dados.parceiro as { id: string; nome: string; origens: string[]; marca: Marca };

      // Só abre dentro do site do parceiro (e não numa página qualquer).
      if (!dentroDeIframe() || !origemPermitida(parceiro.origens)) {
        throw new Error(`Esta tela só pode ser aberta dentro do sistema ${parceiro.nome}.${origemDoPai() ? "" : " Origem não identificada."}`);
      }

      const m: Marca = {
        nome: parceiro.nome,
        cor: porUrl.cor ?? corValida(parceiro.marca?.cor),
        destaque: porUrl.destaque ?? corValida(parceiro.marca?.destaque),
        logo: porUrl.logo ?? logoValida(parceiro.marca?.logo),
      };
      setMarca(m);
      aplicarMarca(m);

      gravarTokensRecebidos(dados);
      const perfil = await buscarPerfil();
      entrarComPerfil({
        nome: perfil?.name ?? perfil?.login ?? "Usuário",
        email: perfil?.email ?? "",
        organizacao: perfil?.account_name ?? parceiro.nome,
        organizacaoId: perfil?.group_id != null ? String(perfil.group_id) : "",
        perfil: perfilDoUsuario(perfil),
      });
      gravarEmbutido({ parceiro: { id: parceiro.id, nome: parceiro.nome, origens: parceiro.origens }, marca: m, menu: q.get("menu") === "1" });
      navigate(tela);
    })().catch((e) => setErro(e instanceof Error ? e.message : "Não foi possível abrir a tela."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        {marca.logo && <img src={marca.logo} alt={marca.nome ?? "Logo"} className="h-10 max-w-[180px] object-contain" />}
        {erro ? (
          <>
            <LockKeyhole className="h-7 w-7 text-muted-foreground" />
            <p className="text-[14px] text-foreground">{erro}</p>
          </>
        ) : (
          <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
          </p>
        )}
      </div>
    </div>
  );
}
