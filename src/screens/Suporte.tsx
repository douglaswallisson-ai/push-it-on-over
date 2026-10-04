import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Camera,
  CheckCircle2,
  ChevronDown,
  Cpu,
  ExternalLink,
  GraduationCap,
  HelpCircle,
  Inbox,
  Loader2,
  MessageSquarePlus,
  MonitorX,
  Paperclip,
  Search,
  Send,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  Users,
  Wallet,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ss/layout/PageHeader";
import { BalaoSelma, Selma } from "@/components/ss/suporte/Selma";
import { Link } from "@/lib/router-compat";
import { lerSessao } from "@/lib/session";
import { usandoMock } from "@/lib/modo";
import { cn } from "@/lib/utils";
import { CATEGORIAS_FAQ, DUVIDAS, buscarDuvidas, type CategoriaFaq, type Duvida, type PoseSelma } from "@/lib/suporte-faq";
import {
  abrirChamado,
  arquivoParaBase64,
  meusChamadosQuery,
  mensagemErro,
  respostasQuery,
  servicosSuporteQuery,
  type Chamado,
} from "@/lib/suporte-api";

/**
 * Suporte — a Selma ajuda com dúvidas frequentes (regras do vault) e abre
 * chamados no Zendesk com a mesma lógica do sistema antigo: assunto da lista
 * de serviços, solicitante = usuário logado, anexo opcional, "Meus chamados"
 * dos últimos 3 meses com as respostas.
 *
 * A pose da Selma acompanha o momento: boas-vindas ao chegar, pensando
 * enquanto o cliente digita, explicando ao mostrar uma resposta, preocupada
 * quando há problema ou nada foi encontrado, e dica ao concluir.
 */

type Aba = "duvidas" | "chamado" | "meus";

const ICONE_GRUPO: Record<string, LucideIcon> = {
  "Câmeras e vídeo": Camera,
  "Cadastros, usuários e acessos": Users,
  "Erro ou lentidão na plataforma": MonitorX,
  "Indicadores, BI e relatórios": BarChart3,
  "Configurações e alertas": SlidersHorizontal,
  "Equipamento, sinal e telemetria": Cpu,
  "Instalação, troca e materiais": Wrench,
  "Treinamento e reuniões": GraduationCap,
  "Comercial e financeiro": Wallet,
};
const GRUPOS_PROBLEMA = new Set(["Erro ou lentidão na plataforma", "Equipamento, sinal e telemetria", "Câmeras e vídeo"]);

const TIPOS_ACEITOS = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.docx,.xlsx,.csv,.txt";
const MAX_ANEXO = 10 * 1024 * 1024;

const TOM_STATUS: Record<string, string> = {
  new: "bg-brand-sky/15 text-brand-navy border-brand-sky/40",
  open: "bg-navy-tint text-brand-navy border-navy-line",
  pending: "bg-gold-tint text-[#8a5a12] border-gold-line",
  hold: "bg-secondary text-muted-foreground border-border",
  solved: "bg-leaf-tint text-[#2f6b1f] border-leaf-line",
  closed: "bg-leaf-tint text-[#2f6b1f] border-leaf-line",
  registrado: "bg-coral-tint text-[#9b3326] border-coral-line",
};

const dataHora = (s?: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

export default function Suporte() {
  const sessao = lerSessao();
  const primeiroNome = (sessao?.nome ?? "").split(" ")[0];
  const mock = usandoMock();

  const [aba, setAba] = useState<Aba>(() => {
    if (typeof window === "undefined") return "duvidas";
    const h = window.location.hash.replace("#", "");
    return h === "chamado" || h === "meus" ? h : "duvidas";
  });
  const topo = useRef<HTMLElement>(null);
  const irPara = (a: Aba) => {
    setAba(a);
    topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      history.replaceState(null, "", a === "duvidas" ? window.location.pathname : `#${a}`);
    } catch {
      /* ignora */
    }
  };

  // ---------------------------------------------------------- Dúvidas
  const [termo, setTermo] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaFaq | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [resolveu, setResolveu] = useState<Record<string, boolean>>({});
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onTermo = (v: string) => {
    setTermo(v);
    setDigitando(true);
    setAberta(null);
    if (aba !== "duvidas") irPara("duvidas");
    clearTimeout(espera.current);
    espera.current = setTimeout(() => setDigitando(false), 700);
  };

  const resultados = useMemo(() => {
    const base = categoria ? DUVIDAS.filter((d) => d.categoria === categoria) : DUVIDAS;
    return buscarDuvidas(termo, base);
  }, [termo, categoria]);

  // ---------------------------------------------------------- Chamado
  const servicos = useQuery(servicosSuporteQuery());
  const [grupo, setGrupo] = useState<string | null>(null);
  const [assunto, setAssunto] = useState<string | null>(null);
  const [filtroAssunto, setFiltroAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("normal");
  const [anexo, setAnexo] = useState<File | null>(null);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);
  const qc = useQueryClient();

  const enviar = useMutation({
    mutationFn: async () => {
      const contexto: Record<string, string> = {
        organizacao: sessao?.organizacaoAtiva ?? "",
        tela: "Suporte",
        navegador: typeof navigator !== "undefined" ? navigator.userAgent : "",
      };
      return abrirChamado({
        assunto: assunto!,
        descricao,
        prioridade,
        anexo: anexo ? { nome: anexo.name, tipo: anexo.type || "application/octet-stream", base64: await arquivoParaBase64(anexo) } : null,
        contexto,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suporte", "chamados"] }),
  });

  const limparChamado = () => {
    setGrupo(null);
    setAssunto(null);
    setFiltroAssunto("");
    setDescricao("");
    setPrioridade("normal");
    setAnexo(null);
    setErroAnexo(null);
    enviar.reset();
  };

  /** Abre o formulário já com o assunto sugerido e o contexto da dúvida. */
  const chamadoSobre = (d?: Duvida, texto?: string) => {
    limparChamado();
    const lista = servicos.data?.grupos ?? [];
    const alvo = d?.servico ?? servicos.data?.padrao ?? null;
    const g = lista.find((x) => alvo && x.servicos.includes(alvo));
    if (g && alvo) {
      setGrupo(g.nome);
      setAssunto(alvo);
    }
    if (d) setDescricao(`Sobre: ${d.pergunta}\n\n`);
    else if (texto) setDescricao(`Procurei por "${texto}" e não encontrei a resposta.\n\n`);
    irPara("chamado");
  };

  const escolherAnexo = (f: File | null) => {
    setErroAnexo(null);
    if (f && f.size > MAX_ANEXO) {
      setErroAnexo("O arquivo passa de 10 MB. Envie um menor ou um print da tela.");
      return;
    }
    setAnexo(f);
  };

  /** O que o cliente escreveu, sem a linha de contexto que a tela preenche sozinha. */
  const escrito = descricao.replace(/^(Sobre: .*|Procurei por .*)\n*/, "").trim();
  const faltando = !assunto ? "Escolha o assunto." : escrito.length < 10 ? "Conte um pouco mais do que aconteceu (pelo menos 10 letras)." : null;

  // ---------------------------------------------------------- Meus chamados
  const chamados = useQuery({ ...meusChamadosQuery(), enabled: !mock && aba === "meus" });
  const [chamadoAberto, setChamadoAberto] = useState<number | string | null>(null);
  const aguardando = (chamados.data?.chamados ?? []).filter((c) => c.status_codigo === "pending").length;

  // ---------------------------------------------------------- Selma
  const { pose, fala } = useMemo((): { pose: PoseSelma; fala: React.ReactNode } => {
    if (aba === "duvidas") {
      if (digitando) return { pose: "pensando", fala: "Deixa eu procurar aqui…" };
      if (termo.trim() && resultados.length === 0)
        return { pose: "preocupada", fala: <>Não encontrei nada sobre <b>“{termo}”</b>. Abra um chamado que eu levo para o time certo.</> };
      if (aberta) {
        if (resolveu[aberta] === true) return { pose: "dica", fala: "Que bom que resolveu! Se surgir outra dúvida, é só procurar aqui." };
        if (resolveu[aberta] === false) return { pose: "preocupada", fala: "Poxa! Vamos abrir um chamado. Eu já deixei o assunto preenchido." };
        return { pose: "explicando", fala: "Olha só como funciona. Se ainda ficar dúvida, me avise no fim da resposta." };
      }
      if (termo.trim())
        return { pose: "explicando", fala: `Achei ${resultados.length} resposta${resultados.length > 1 ? "s" : ""}. Clique na que combina com a sua dúvida.` };
      return {
        pose: "boas-vindas",
        fala: (
          <>
            Oi{primeiroNome ? `, ${primeiroNome}` : ""}! Eu sou a <b>Selma</b>, do Suporte SS. Escreva sua dúvida abaixo ou escolha um assunto. Se
            preferir, abra um chamado para o nosso time.
          </>
        ),
      };
    }
    if (aba === "chamado") {
      if (enviar.isPending) return { pose: "pensando", fala: "Enviando seu chamado…" };
      if (enviar.isSuccess) return { pose: "dica", fala: "Pronto! Seu chamado foi registrado. Você acompanha tudo em “Meus chamados”." };
      if (enviar.isError) return { pose: "preocupada", fala: "Não consegui enviar. Veja o aviso abaixo e tente de novo." };
      if (grupo && GRUPOS_PROBLEMA.has(grupo))
        return { pose: "preocupada", fala: "Poxa, vamos resolver isso! Diga a placa, o dia e o horário. Isso acelera muito o atendimento." };
      if (assunto) return { pose: "explicando", fala: "Agora me conte o que aconteceu. Um print ajuda bastante." };
      return { pose: "explicando", fala: "Sobre o que é o seu pedido? Escolha um assunto e eu encaminho para a equipe certa." };
    }
    if (chamados.isLoading) return { pose: "pensando", fala: "Buscando seus chamados…" };
    if (aguardando)
      return {
        pose: "preocupada",
        fala: `${aguardando} chamado${aguardando > 1 ? "s estão" : " está"} aguardando uma resposta sua. Abra para ver o que o Suporte pediu.`,
      };
    return { pose: "dica", fala: "Aqui você acompanha seus chamados dos últimos 3 meses. Clique em um para ver as respostas." };
  }, [aba, digitando, termo, resultados.length, aberta, resolveu, enviar.isPending, enviar.isSuccess, enviar.isError, grupo, assunto, chamados.isLoading, aguardando, primeiroNome]);

  useEffect(() => () => clearTimeout(espera.current), []);

  const gruposServico = servicos.data?.grupos ?? [];
  const servicosDoGrupo = useMemo(() => {
    const g = gruposServico.find((x) => x.nome === grupo);
    const f = filtroAssunto.trim().toLowerCase();
    return (g?.servicos ?? []).filter((s) => !f || s.toLowerCase().includes(f));
  }, [gruposServico, grupo, filtroAssunto]);

  return (
    <>
      <PageHeader title="Suporte" subtitle="Tire dúvidas com a Selma ou abra um chamado para o time SS" />
      <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-8">
        {/* ------------------------------------------------ Selma + busca */}
        <section ref={topo} className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-white via-white to-brand-sky/10">
          <div className="grid items-end gap-4 px-5 pt-5 sm:grid-cols-[150px_1fr] sm:px-7">
            <Selma pose={pose} className="mx-auto hidden h-[210px] w-[130px] sm:block" />
            <div className="space-y-4 pb-5">
              <div className="flex items-start gap-3">
                <Selma pose={pose} className="h-[96px] w-[56px] shrink-0 sm:hidden" />
                <BalaoSelma className="flex-1">{fala}</BalaoSelma>
              </div>
              <label className="relative block">
                <span className="sr-only">Procure sua dúvida</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={termo}
                  onChange={(e) => onTermo(e.target.value)}
                  placeholder="Escreva sua dúvida. Ex.: senha, cerca, sem sinal, relatório…"
                  className="h-12 w-full rounded-xl border border-border bg-white pl-10 pr-10 text-[14px] shadow-sm outline-none transition focus:border-brand-sky focus:ring-4 focus:ring-brand-sky/15"
                />
                {termo && (
                  <button
                    type="button"
                    onClick={() => onTermo("")}
                    aria-label="Limpar busca"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-secondary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
            </div>
          </div>
          <nav className="flex gap-1 border-t border-border bg-white/70 px-3 sm:px-5" aria-label="Seções do suporte">
            {(
              [
                ["duvidas", "Dúvidas frequentes", HelpCircle],
                ["chamado", "Abrir chamado", MessageSquarePlus],
                ["meus", "Meus chamados", Inbox],
              ] as const
            ).map(([id, rotulo, Icone]) => (
              <button
                key={id}
                type="button"
                onClick={() => (id === "chamado" && aba !== "chamado" ? chamadoSobre() : irPara(id))}
                aria-current={aba === id ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-[14px] font-medium transition-colors",
                  aba === id ? "border-brand-navy text-brand-navy" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icone className="h-4 w-4" />
                {rotulo}
              </button>
            ))}
          </nav>
        </section>

        {/* ------------------------------------------------ Dúvidas */}
        {aba === "duvidas" && (
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por assunto">
              <Chip ativo={!categoria} onClick={() => setCategoria(null)}>
                Todos os assuntos
              </Chip>
              {CATEGORIAS_FAQ.map((c) => (
                <Chip key={c.nome} ativo={categoria === c.nome} onClick={() => setCategoria(categoria === c.nome ? null : c.nome)} title={c.dica}>
                  {c.nome}
                </Chip>
              ))}
            </div>

            {resultados.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center">
                <p className="text-[14px] text-muted-foreground">Nenhuma resposta para essa busca{categoria ? ` em “${categoria}”` : ""}.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {categoria && (
                    <button type="button" onClick={() => setCategoria(null)} className="rounded-lg border border-border px-3 py-2 text-[13px] hover:bg-secondary">
                      Procurar em todos os assuntos
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => chamadoSobre(undefined, termo)}
                    className="flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
                  >
                    <MessageSquarePlus className="h-4 w-4" /> Abrir chamado sobre isso
                  </button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
                {resultados.map((d) => {
                  const aberto = aberta === d.id;
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => setAberta(aberto ? null : d.id)}
                        aria-expanded={aberto}
                        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-secondary/50"
                      >
                        <span className="flex-1">
                          <span className="block text-[14px] font-medium text-foreground">{d.pergunta}</span>
                          <span className="text-[12px] text-muted-foreground">{d.categoria}</span>
                        </span>
                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} />
                      </button>
                      {aberto && (
                        <div className="space-y-4 px-5 pb-5">
                          <Resposta linhas={d.resposta} />
                          <div className="flex flex-wrap items-center gap-2">
                            {d.tela && (
                              <Link
                                to={d.tela.to}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-navy/30 px-3 py-2 text-[13px] font-medium text-brand-navy hover:bg-navy-tint"
                              >
                                {d.tela.rotulo} <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-secondary/60 px-4 py-3">
                            <span className="mr-1 text-[13px] text-foreground">Isso resolveu sua dúvida?</span>
                            {resolveu[d.id] === true ? (
                              <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#2f6b1f]">
                                <CheckCircle2 className="h-4 w-4" /> Obrigada pelo retorno!
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setResolveu((r) => ({ ...r, [d.id]: true }))}
                                  className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] hover:border-leaf-line hover:bg-leaf-tint"
                                >
                                  <ThumbsUp className="h-3.5 w-3.5" /> Sim
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResolveu((r) => ({ ...r, [d.id]: false }));
                                    chamadoSobre(d);
                                  }}
                                  className="flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[13px] hover:border-coral-line hover:bg-coral-tint"
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" /> Não, quero abrir um chamado
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4 sm:flex-row sm:items-center">
              <p className="text-[14px] text-muted-foreground">Não achou o que precisava? O time SS responde pelo chamado.</p>
              <button
                type="button"
                onClick={() => chamadoSobre()}
                className="flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
              >
                <MessageSquarePlus className="h-4 w-4" /> Abrir chamado
              </button>
            </div>
          </section>
        )}

        {/* ------------------------------------------------ Abrir chamado */}
        {aba === "chamado" && (
          <section className="space-y-4">
            {mock ? (
              <Aviso tom="gold">Você está no modo demonstração. Para abrir chamados, entre com os dados reais da sua empresa.</Aviso>
            ) : servicos.isError ? (
              <Aviso tom="coral">{mensagemErro(servicos.error)}</Aviso>
            ) : servicos.data && !servicos.data.integrado ? (
              <Aviso tom="gold">
                A ligação com o Zendesk ainda não está ativa neste ambiente. O chamado fica registrado aqui, mas ainda não chega ao time de Suporte. Em caso
                de urgência, fale com o seu contato na SS.
              </Aviso>
            ) : null}

            {enviar.isSuccess ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-leaf-line bg-leaf-tint/60 px-6 py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-[#2f6b1f]" />
                <p className="text-[16px] font-semibold text-foreground">Chamado nº {enviar.data.id} registrado</p>
                <p className="max-w-md text-[14px] text-muted-foreground">
                  {enviar.data.integrado
                    ? "O time de Suporte já recebeu. Quando responderem, a resposta aparece em “Meus chamados”."
                    : "Ele ficou registrado na plataforma e será enviado ao Suporte quando a integração com o Zendesk for ativada."}
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <button type="button" onClick={() => irPara("meus")} className="rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-medium text-white hover:opacity-90">
                    Ver meus chamados
                  </button>
                  <button type="button" onClick={limparChamado} className="rounded-lg border border-border bg-white px-4 py-2 text-[13px] hover:bg-secondary">
                    Abrir outro chamado
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!faltando && !mock) enviar.mutate();
                }}
              >
                {/* 1. Assunto */}
                <Etapa n={1} titulo="Sobre o que é?" feito={Boolean(assunto)}>
                  {servicos.isLoading ? (
                    <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando assuntos…
                    </p>
                  ) : !grupo ? (
                    <>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {gruposServico.map((g) => {
                          const Icone = ICONE_GRUPO[g.nome] ?? HelpCircle;
                          return (
                            <button
                              key={g.nome}
                              type="button"
                              onClick={() => {
                                setGrupo(g.nome);
                                setAssunto(g.servicos.length === 1 ? g.servicos[0] : null);
                                setFiltroAssunto("");
                              }}
                              className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-left transition hover:border-brand-sky hover:bg-brand-sky/5"
                            >
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-tint text-brand-navy">
                                <Icone className="h-4.5 w-4.5" />
                              </span>
                              <span className="text-[14px] font-medium text-foreground">{g.nome}</span>
                            </button>
                          );
                        })}
                      </div>
                      {servicos.data && (
                        <button
                          type="button"
                          onClick={() => {
                            const g = gruposServico.find((x) => x.servicos.includes(servicos.data!.padrao));
                            setGrupo(g?.nome ?? null);
                            setAssunto(servicos.data!.padrao);
                          }}
                          className="mt-3 text-[13px] font-medium text-brand-navy underline-offset-2 hover:underline"
                        >
                          Não sei qual escolher
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => {
                          setGrupo(null);
                          setAssunto(null);
                        }}
                        className="flex items-center gap-1.5 text-[13px] font-medium text-brand-navy hover:underline"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> {grupo}
                      </button>
                      {assunto ? (
                        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-sky/40 bg-brand-sky/5 px-4 py-3">
                          <CheckCircle2 className="h-4.5 w-4.5 text-brand-navy" />
                          <span className="flex-1 text-[14px] font-medium">{assunto}</span>
                          <button type="button" onClick={() => setAssunto(null)} className="text-[13px] text-muted-foreground underline-offset-2 hover:underline">
                            Trocar
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            value={filtroAssunto}
                            onChange={(e) => setFiltroAssunto(e.target.value)}
                            placeholder="Filtrar assuntos…"
                            className="h-10 w-full rounded-lg border border-border px-3 text-[14px] outline-none focus:border-brand-sky sm:max-w-sm"
                          />
                          <div className="grid max-h-72 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                            {servicosDoGrupo.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setAssunto(s)}
                                className="rounded-lg border border-border bg-white px-3 py-2 text-left text-[13px] hover:border-brand-sky hover:bg-brand-sky/5"
                              >
                                {s}
                              </button>
                            ))}
                            {!servicosDoGrupo.length && <p className="text-[13px] text-muted-foreground">Nenhum assunto com esse nome neste grupo.</p>}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </Etapa>

                {/* 2. Descrição */}
                <Etapa n={2} titulo="Conte o que aconteceu" feito={escrito.length >= 10}>
                  <textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value.slice(0, 4000))}
                    rows={6}
                    placeholder={"Ex.: O veículo ABC-1234 não aparece no mapa desde ontem às 14h.\nInforme placa, dia e horário, e em qual tela viu o problema."}
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-brand-sky focus:ring-4 focus:ring-brand-sky/15"
                  />
                  <p className="mt-1 text-right text-[12px] text-muted-foreground">{descricao.length} / 4000</p>
                </Etapa>

                {/* 3. Urgência */}
                <Etapa n={3} titulo="Qual a urgência?" feito>
                  <div className="grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Urgência">
                    {(servicos.data?.prioridades ?? []).map((p) => (
                      <button
                        key={p.valor}
                        type="button"
                        role="radio"
                        aria-checked={prioridade === p.valor}
                        onClick={() => setPrioridade(p.valor)}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-[13px] transition",
                          prioridade === p.valor
                            ? p.valor === "urgent" || p.valor === "high"
                              ? "border-coral bg-coral-tint font-medium text-[#9b3326]"
                              : "border-brand-navy bg-navy-tint font-medium text-brand-navy"
                            : "border-border bg-white hover:bg-secondary",
                        )}
                      >
                        {p.rotulo}
                      </button>
                    ))}
                  </div>
                </Etapa>

                {/* 4. Anexo */}
                <Etapa n={4} titulo="Anexo (opcional)" feito={Boolean(anexo)}>
                  {anexo ? (
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate text-[14px]">{anexo.name}</span>
                      <span className="text-[12px] text-muted-foreground">{(anexo.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button type="button" onClick={() => setAnexo(null)} aria-label="Remover anexo" className="rounded p-1 hover:bg-secondary">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-border bg-white px-4 py-5 text-center hover:border-brand-sky hover:bg-brand-sky/5">
                      <Paperclip className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[14px] font-medium text-foreground">Clique para anexar um print ou arquivo</span>
                      <span className="text-[12px] text-muted-foreground">Imagem, PDF, Word, Excel, CSV ou texto, até 10 MB</span>
                      <input type="file" accept={TIPOS_ACEITOS} className="sr-only" onChange={(e) => escolherAnexo(e.target.files?.[0] ?? null)} />
                    </label>
                  )}
                  {erroAnexo && <p className="mt-2 text-[13px] text-[#9b3326]">{erroAnexo}</p>}
                </Etapa>

                {enviar.isError && <Aviso tom="coral">{mensagemErro(enviar.error)}</Aviso>}

                <div className="flex flex-col-reverse items-stretch justify-between gap-3 rounded-2xl border border-border bg-white px-5 py-4 sm:flex-row sm:items-center">
                  <p className="text-[13px] text-muted-foreground">
                    {faltando ?? (
                      <>
                        O chamado será aberto em nome de <b>{sessao?.email ?? "você"}</b>.
                      </>
                    )}
                  </p>
                  <button
                    type="submit"
                    disabled={Boolean(faltando) || enviar.isPending || mock}
                    className="flex items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 py-2.5 text-[14px] font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {enviar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar chamado
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* ------------------------------------------------ Meus chamados */}
        {aba === "meus" && (
          <section className="space-y-3">
            {mock ? (
              <Aviso tom="gold">No modo demonstração não há chamados.</Aviso>
            ) : chamados.isError ? (
              <Aviso tom="coral">{mensagemErro(chamados.error)}</Aviso>
            ) : chamados.isLoading ? (
              <p className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </p>
            ) : !chamados.data?.chamados.length ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-white px-6 py-10 text-center">
                <p className="text-[14px] text-muted-foreground">Você não abriu chamados nos últimos 3 meses.</p>
                <button
                  type="button"
                  onClick={() => chamadoSobre()}
                  className="flex items-center gap-2 rounded-lg bg-brand-navy px-4 py-2 text-[13px] font-medium text-white hover:opacity-90"
                >
                  <MessageSquarePlus className="h-4 w-4" /> Abrir chamado
                </button>
              </div>
            ) : (
              <>
                {!chamados.data.integrado && (
                  <Aviso tom="gold">A ligação com o Zendesk ainda não está ativa. Aqui aparecem só os chamados registrados nesta plataforma.</Aviso>
                )}
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
                  {chamados.data.chamados.map((c) => (
                    <ItemChamado
                      key={c.id}
                      chamado={c}
                      aberto={chamadoAberto === c.id}
                      onClick={() => setChamadoAberto(chamadoAberto === c.id ? null : c.id)}
                    />
                  ))}
                </ul>
              </>
            )}
          </section>
        )}
      </main>
    </>
  );
}

// ------------------------------------------------------------- Peças

function Chip({ ativo, children, ...rest }: { ativo: boolean; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      {...rest}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[13px] transition",
        ativo ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-white text-foreground hover:border-brand-sky",
      )}
    >
      {children}
    </button>
  );
}

function Resposta({ linhas }: { linhas: string[] }) {
  const blocos: React.ReactNode[] = [];
  let lista: string[] = [];
  const fechar = () => {
    if (lista.length) {
      blocos.push(
        <ul key={`l${blocos.length}`} className="list-disc space-y-1 pl-5">
          {lista.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>,
      );
      lista = [];
    }
  };
  linhas.forEach((l, i) => {
    if (l.startsWith("• ")) lista.push(l.slice(2));
    else {
      fechar();
      blocos.push(<p key={`p${i}`}>{l}</p>);
    }
  });
  fechar();
  return <div className="space-y-2.5 text-[14px] leading-relaxed text-foreground/90">{blocos}</div>;
}

function Etapa({ n, titulo, feito, children }: { n: number; titulo: string; feito?: boolean; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-2xl border border-border bg-white px-5 py-4">
      <legend className="sr-only">{titulo}</legend>
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold",
            feito ? "bg-leaf-tint text-[#2f6b1f]" : "bg-navy-tint text-brand-navy",
          )}
        >
          {feito ? <CheckCircle2 className="h-4 w-4" /> : n}
        </span>
        <h2 className="text-[14px] font-semibold text-foreground">{titulo}</h2>
      </div>
      {children}
    </fieldset>
  );
}

function Aviso({ tom, children }: { tom: "gold" | "coral"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px]",
        tom === "gold" ? "border-gold-line bg-gold-tint text-[#7a4f10]" : "border-coral-line bg-coral-tint text-[#8f2e22]",
      )}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function ItemChamado({ chamado: c, aberto, onClick }: { chamado: Chamado; aberto: boolean; onClick: () => void }) {
  const respostas = useQuery({ ...respostasQuery(c.id), enabled: aberto && !String(c.id).startsWith("L") });
  return (
    <li>
      <button type="button" onClick={onClick} aria-expanded={aberto} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-secondary/50">
        <span className="w-16 shrink-0 font-mono text-[13px] text-muted-foreground">#{c.id}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{c.assunto}</span>
          <span className="text-[12px] text-muted-foreground">
            Aberto em {dataHora(c.criado_em)} · atualizado {dataHora(c.atualizado_em)}
          </span>
        </span>
        <span className={cn("shrink-0 rounded-full border px-2.5 py-0.5 text-[12px] font-medium", TOM_STATUS[c.status_codigo] ?? TOM_STATUS.hold)}>
          {c.status}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", aberto && "rotate-180")} />
      </button>
      {aberto && (
        <div className="space-y-3 bg-secondary/30 px-5 py-4">
          {String(c.id).startsWith("L") ? (
            <>
              {c.descricao && <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{c.descricao.split("\n\n—\n")[0]}</p>}
              {c.anexo && (
                <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <Paperclip className="h-3.5 w-3.5" /> {c.anexo}
                </p>
              )}
              <p className="text-[13px] text-muted-foreground">Ainda sem respostas: este chamado não foi enviado ao Zendesk.</p>
            </>
          ) : respostas.isLoading ? (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando respostas…
            </p>
          ) : respostas.isError ? (
            <p className="text-[13px] text-[#8f2e22]">{mensagemErro(respostas.error)}</p>
          ) : (
            (respostas.data?.respostas ?? []).map((r, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl border px-4 py-3 text-[14px]",
                  r.do_suporte ? "border-brand-sky/30 bg-white" : "ml-auto border-navy-line bg-navy-tint",
                )}
              >
                <p className="mb-1 text-[12px] font-semibold text-muted-foreground">
                  {r.autor} · {dataHora(r.em)}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{r.texto}</p>
                {r.anexos.map((a) => (
                  <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-[13px] text-brand-navy hover:underline">
                    <Paperclip className="h-3.5 w-3.5" /> {a.nome}
                  </a>
                ))}
              </div>
            ))
          )}
          {c.status_codigo === "pending" && (
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-[#7a4f10]">
              <ArrowRight className="h-3.5 w-3.5" /> O Suporte aguarda sua resposta. Responda pelo e-mail do chamado que você recebeu.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
