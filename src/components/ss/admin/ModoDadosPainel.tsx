import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Database, Info, Radio, Server } from "lucide-react";
import { toast } from "sonner";
import { Card, Pill } from "@/components/ss/ui/data";
import { baseApi, definirIntervalo, definirModo, intervaloAtualizacao, modoAtual, type ModoDados } from "@/lib/modo";
import { temTokenValido } from "@/lib/auth-api";
import { registrarAuditoria } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * Origem dos dados.
 *
 * Trocar entre exemplo e API exigia editar uma constante e republicar, o que
 * impedia validar a integração em ambiente já publicado. Aqui a escolha vive na
 * sessão e o cliente HTTP a consulta a cada chamada.
 *
 * Trocar o modo limpa o cache do React Query: sem isso a tela seguiria
 * mostrando o dado anterior e daria a impressão de que a API respondeu.
 */
export function ModoDadosPainel() {
  const qc = useQueryClient();
  const [modo, setModo] = useState<ModoDados>(() => modoAtual());
  const [intervalo, setIntervalo] = useState(() => intervaloAtualizacao());

  const trocar = (novo: ModoDados) => {
    definirModo(novo);
    setModo(novo);
    qc.clear();
    registrarAuditoria("modo_dados", `Origem dos dados alterada para ${novo === "mock" ? "exemplo" : "API real"}.`);
    toast.success(novo === "mock" ? "Usando dados de exemplo." : "Conectado à API real.", {
      description: novo === "api" ? `Base: ${baseApi()}` : "Nenhuma requisição sai do navegador.",
    });
  };

  const mudarIntervalo = (s: number) => {
    definirIntervalo(s);
    setIntervalo(s);
    qc.clear();
    toast.success(s > 0 ? `Atualizando a cada ${s}s.` : "Atualização automática desligada.");
  };

  return (
    <Card title="Origem dos dados" icon={Database} bodyClassName="p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          onClick={() => trocar("mock")}
          className={cn(
            "rounded-xl border p-4 text-left transition-colors",
            modo === "mock" ? "border-brand-navy bg-navy-tint" : "border-border bg-card hover:bg-secondary",
          )}
        >
          <span className="flex items-center gap-2">
            <Database className={cn("h-4 w-4", modo === "mock" ? "text-brand-navy" : "text-muted-foreground")} />
            <span className="text-[14px] font-semibold text-foreground">Dados de exemplo</span>
            {modo === "mock" && <Pill tone="sky">ativo</Pill>}
          </span>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Tudo vem da base local. Nenhuma requisição sai do navegador — serve para demonstração e para trabalhar com
            a API fora do ar.
          </p>
          {!import.meta.env.VITE_API_BASE && (
            <p className="mt-1.5 text-[12px] font-medium text-gold">
              Em uso por padrão: sem VITE_API_BASE configurado, não há para onde consultar.
            </p>
          )}
        </button>

        <button
          onClick={() => trocar("api")}
          className={cn(
            "rounded-xl border p-4 text-left transition-colors",
            modo === "api" ? "border-brand-navy bg-navy-tint" : "border-border bg-card hover:bg-secondary",
          )}
        >
          <span className="flex items-center gap-2">
            <Server className={cn("h-4 w-4", modo === "api" ? "text-brand-navy" : "text-muted-foreground")} />
            <span className="text-[14px] font-semibold text-foreground">API real</span>
            {modo === "api" && <Pill tone="green">ativo</Pill>}
          </span>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            Consulta o servidor em <span className="font-mono">{baseApi()}</span>. Erro de rede passa a aparecer nas
            telas, com opção de tentar de novo.
          </p>
          {import.meta.env.VITE_API_BASE && (
            <p className="mt-1.5 text-[12px] font-medium text-leaf">
              Padrão do sistema — abre assim automaticamente.
            </p>
          )}
        </button>
      </div>

      {/* Diagnóstico da conexão.
          Sem isto, "ativei a API e nada mudou" não tem como ser investigado
          pela interface: o usuário não sabe se falta endereço, se o login
          falhou ou se a tela simplesmente não está ligada. */}
      {modo === "api" && (
        <div className="mt-4 rounded-xl border border-border p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-foreground">
            <Server className="h-3.5 w-3.5 text-muted-foreground" />
            Diagnóstico
          </h4>
          <ul className="space-y-1.5 text-[13px]">
            <Verificacao
              ok={Boolean(import.meta.env.VITE_API_BASE)}
              rotulo="Endereço da API configurado"
              detalhe={
                import.meta.env.VITE_API_BASE
                  ? String(import.meta.env.VITE_API_BASE)
                  : "defina VITE_API_BASE no .env e reinicie o servidor"
              }
            />
            <Verificacao
              ok={temTokenValido()}
              rotulo="Sessão autenticada"
              detalhe={temTokenValido() ? "token válido" : "faça login novamente"}
            />
            <Verificacao
              ok={Boolean(import.meta.env.VITE_WS_BASE)}
              rotulo="Tempo real (WebSocket)"
              detalhe={
                import.meta.env.VITE_WS_BASE
                  ? String(import.meta.env.VITE_WS_BASE)
                  : "opcional — sem isso o mapa usa consulta periódica"
              }
              opcional
            />
          </ul>
          <p className="mt-2.5 text-[12px] text-muted-foreground">
            Telas marcadas como <strong>beta</strong> continuam com dados de exemplo mesmo aqui — elas não têm
            endpoint no backend, e tentar consultá-las devolveria erro.
          </p>
        </div>
      )}

      {/* Atualização automática só faz sentido ligado à API. */}
      <div className={cn("mt-4 rounded-xl border border-border p-4", modo === "mock" && "opacity-55")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-muted-foreground" />
            <span className="text-[13px] font-medium text-foreground">Atualização automática</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {[0, 15, 30, 60, 120].map((s) => (
              <button
                key={s}
                onClick={() => mudarIntervalo(s)}
                disabled={modo === "mock"}
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-medium transition-colors disabled:cursor-not-allowed",
                  intervalo === s
                    ? "bg-brand-navy text-white"
                    : "border border-border bg-white text-muted-foreground hover:bg-secondary",
                )}
              >
                {s === 0 ? "Desligada" : `${s}s`}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[12px] text-muted-foreground">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          {modo === "mock"
            ? "Com dados de exemplo não há o que recarregar — o polling só gastaria ciclo."
            : "Mapa, viagens e alarmes recarregam sozinhos nesse intervalo. Intervalo curto aumenta o custo de requisições no servidor."}
        </p>
      </div>
    </Card>
  );
}


/** Uma linha do diagnóstico. */
function Verificacao({
  ok,
  rotulo,
  detalhe,
  opcional,
}: {
  ok: boolean;
  rotulo: string;
  detalhe: string;
  opcional?: boolean;
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white",
          ok ? "bg-leaf" : opcional ? "bg-muted-foreground" : "bg-coral",
        )}
      >
        {ok ? "✓" : "!"}
      </span>
      <span className="min-w-0">
        <span className="block text-foreground">{rotulo}</span>
        <span className="block break-all font-mono text-[12px] text-muted-foreground">{detalhe}</span>
      </span>
    </li>
  );
}
