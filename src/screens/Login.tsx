import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles } from "lucide-react";
import { SSOrb } from "@/components/ss/brand/SSOrb";
import { SSLogo } from "@/components/ss/brand/SSLogo";
import { Button } from "@/components/ss/ui/button";
import { Field } from "@/components/ss/ui/field";
import heroImg from "@/assets/hero-fleet.jpg";

/**
 * Login em duas colunas: marca à esquerda, acesso à direita.
 *
 * A tela antiga gastava 100% da largura num formulário de 370px e não dizia
 * nada — nenhum posicionamento, nenhuma marca além do logo. Aqui a coluna da
 * esquerda carrega o discurso do site (slogan, orb girando, números) e a da
 * direita fica limpa, com o formulário como único foco. Em telas < lg a coluna
 * de marca vira uma faixa compacta no topo.
 */

const STATS = [
  { k: "−28%", v: "meta de custo por km" },
  { k: "+40%", v: "meta de vida útil dos pneus" },
  { k: "24/7", v: "monitoramento com IA" },
];

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // Protótipo: sem back-end ainda. A API em Python entra aqui.
    setTimeout(() => navigate("/app"), 700);
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.1fr_0.9fr] xl:grid-cols-[1.2fr_0.8fr]">
      <BrandPanel />

      <section className="flex min-h-[70vh] items-center justify-center px-6 py-12 lg:min-h-screen lg:py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <SSLogo size={36} />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground">Acesse sua operação</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Entre com as credenciais da sua conta SS Telemática.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <Field
              label="E-mail"
              icon={Mail}
              type="email"
              name="email"
              autoComplete="username"
              placeholder="voce@empresa.com.br"
              defaultValue="douglas.morais@sstelematica.com.br"
              required
            />

            <Field
              label="Senha"
              icon={Lock}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  name="remember"
                  className="h-4 w-4 cursor-pointer rounded border-input accent-[var(--brand-navy)]"
                />
                Lembrar de mim
              </label>
              <a
                href="#"
                className="text-sm font-medium text-primary transition-colors hover:text-accent"
              >
                Esqueci minha senha
              </a>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">Primeiro acesso?</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <a
            href="#"
            className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            Falar com o suporte SS
            <ArrowRight className="h-3.5 w-3.5" />
          </a>

          <p className="mt-12 text-center text-xs text-muted-foreground/80">
            © {new Date().getFullYear()} SS Telemática · v2.0
          </p>
        </div>
      </section>
    </div>
  );
}

/** Coluna de marca: gradiente do site + foto em Ken Burns + discurso. */
function BrandPanel() {
  return (
    <section className="relative flex flex-col justify-between overflow-hidden bg-gradient-hero px-8 py-10 text-white lg:px-14 lg:py-14">
      <div className="absolute inset-0 opacity-40">
        <img
          src={heroImg}
          alt=""
          className="animate-ken-burns h-full w-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[oklch(0.18_0.06_260)]/70 via-[oklch(0.18_0.06_260)]/55 to-[oklch(0.18_0.06_260)]" />
      </div>

      <div className="relative">
        <SSLogo size={40} tone="light" />
      </div>

      <div className="relative animate-rise-in py-12 lg:py-0">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[11px] font-medium tracking-wide backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-brand-green" />
          DA TELEMETRIA À DECISÃO
        </span>

        <h2 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight xl:text-6xl">
          Não entregamos dados.
          <br />
          <span className="text-gradient">Entregamos decisão.</span>
        </h2>

        <p className="mt-5 max-w-md text-base text-white/75">
          A plataforma interpreta cada quilômetro rodado e devolve o que realmente importa:{" "}
          <strong className="font-semibold text-white">a próxima decisão certa.</strong>
        </p>

        <div className="mt-10 flex items-center gap-5">
          <SSOrb size={84} halo className="text-brand-green" />
          <p className="max-w-[220px] text-sm text-white/60">
            A inteligência da SS rodando 24/7 na sua operação.
          </p>
        </div>
      </div>

      <div className="relative grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-8">
        {STATS.map((s) => (
          <div key={s.k}>
            <div className="font-display text-2xl font-bold text-brand-green xl:text-3xl">{s.k}</div>
            <div className="mt-1 text-[11px] leading-snug text-white/60">{s.v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
