/**
 * Painel CCO — regras de cor e gravidade, e os dados de EXEMPLO da fase 1.
 *
 * Especificação combinada com o PM em 06/10/2026 (memória "painel-cco"):
 * - cor do carro: vermelho = alerta crítico em aberto; amarelo = moderado;
 *   verde = em movimento sem alerta; cinza = parado ou desligado sem alerta;
 * - wifi vermelho só sem comunicação há mais de 2 h (não é alerta);
 * - alerta só sai com "Visto" ou "Tratado";
 * - gravidade: a que já existe no código (timeline.py CRITICOS + pânico e furto
 *   de combustível; fleet_events.severity; manutenção) + ADAS/DMS da tabela
 *   aprovada.
 *
 * Os dados abaixo são fictícios (placas, empresas, posições). Na fase 2 eles
 * saem e entram positions, events, video e manutencao.
 */

export type Gravidade = "critico" | "moderado";
export type Fonte = "seguranca" | "camera" | "manutencao" | "equipamento" | "operacao";
export type CorCarro = "vermelho" | "amarelo" | "verde" | "cinza";

export const COR_HEX: Record<CorCarro, string> = {
  vermelho: "#d64545",
  amarelo: "#e0a400",
  verde: "#2e9e5b",
  cinza: "#8a96a3",
};

export const ROTULO_COR: Record<CorCarro, string> = {
  vermelho: "Alerta crítico",
  amarelo: "Alerta moderado",
  verde: "Em movimento",
  cinza: "Parado ou desligado",
};

/** Catálogo de eventos do painel, com fonte e gravidade (tabela aprovada em 06/10/2026). */
export const CATALOGO: Record<string, { nome: string; fonte: Fonte; gravidade: Gravidade }> = {
  // Equipamento de telemetria (timeline.py CRITICOS + pânico e furto, confirmados pelo PM)
  ev_7: { nome: "Excesso de velocidade", fonte: "seguranca", gravidade: "critico" },
  ev_9: { nome: "Freada brusca", fonte: "seguranca", gravidade: "critico" },
  ev_153: { nome: "Aceleração brusca", fonte: "seguranca", gravidade: "critico" },
  ev_163: { nome: "Faixa vermelha", fonte: "seguranca", gravidade: "critico" },
  ev_13: { nome: "Movimento sem tração", fonte: "seguranca", gravidade: "critico" },
  ev_27: { nome: "Alimentação desconectada", fonte: "seguranca", gravidade: "critico" },
  ev_11: { nome: "Pânico ativado", fonte: "seguranca", gravidade: "critico" },
  ev_161: { nome: "Faixa amarela", fonte: "seguranca", gravidade: "moderado" },
  ev_359: { nome: "Curva brusca", fonte: "seguranca", gravidade: "moderado" },
  ev_148: { nome: "Excesso de embreagem", fonte: "seguranca", gravidade: "moderado" },
  // Câmera — DMS (motorista)
  dms_fadiga: { nome: "Fadiga (DMS)", fonte: "camera", gravidade: "critico" },
  dms_olhos_fechados: { nome: "Olhos fechados (DMS)", fonte: "camera", gravidade: "critico" },
  dms_celular: { nome: "Uso de celular (DMS)", fonte: "camera", gravidade: "critico" },
  dms_distracao: { nome: "Distração (DMS)", fonte: "camera", gravidade: "moderado" },
  dms_bocejo: { nome: "Bocejo (DMS)", fonte: "camera", gravidade: "moderado" },
  dms_fumando: { nome: "Fumando (DMS)", fonte: "camera", gravidade: "moderado" },
  // Câmera — ADAS (pista)
  adas_colisao: { nome: "Colisão (ADAS)", fonte: "camera", gravidade: "critico" },
  adas_risco_colisao: { nome: "Risco de colisão (ADAS)", fonte: "camera", gravidade: "critico" },
  adas_proximidade: {
    nome: "Proximidade dianteira (ADAS)",
    fonte: "camera",
    gravidade: "moderado",
  },
  // Saúde da câmera
  cam_calibracao: {
    nome: "Calibração anormal da câmera",
    fonte: "equipamento",
    gravidade: "moderado",
  },
  cam_falha_gravacao: {
    nome: "Falha de gravação da câmera",
    fonte: "equipamento",
    gravidade: "moderado",
  },
  // Manutenção (regras de manutencao.py)
  man_temperatura: { nome: "Motor quente", fonte: "manutencao", gravidade: "critico" },
  man_bateria: {
    nome: "Bateria não está segurando a carga",
    fonte: "manutencao",
    gravidade: "moderado",
  },
  man_arla: { nome: "ARLA baixo", fonte: "manutencao", gravidade: "moderado" },
};

export const ROTULO_FONTE: Record<Fonte, string> = {
  seguranca: "Segurança",
  camera: "Câmera",
  manutencao: "Manutenção",
  equipamento: "Equipamento",
  operacao: "Operação",
};

export type Aviso = {
  id: string;
  veiculoId: string;
  tipo: keyof typeof CATALOGO;
  em: number;
  detalhe: string;
  /** Aberto até alguém marcar Visto ou Tratado (opção B). */
  situacao: "aberto" | "visto" | "tratado";
  por?: string;
  quando?: number;
  nota?: string;
};

export type Faixa = "Econômica" | "Verde" | "Amarela" | "Vermelha" | "Marcha lenta" | "Inércia";

export type VeiculoCCO = {
  id: string;
  placa: string;
  prefixo: string;
  empresa: string;
  motorista: string | null;
  lat: number;
  lng: number;
  rumo: number;
  ignicao: boolean;
  velocidade: number;
  rpm: number | null;
  faixa: Faixa | null;
  consumoLh: number | null;
  altitude: number | null;
  temperatura: number | null;
  combustivelPct: number | null;
  /** Última comunicação (ms). Sem comunicação há mais de 2 h → wifi vermelho. */
  ultimaComunicacao: number;
  temCamera: boolean;
};

export const LIMITE_SEM_COMUNICACAO_MS = 2 * 60 * 60 * 1000;

export function corDoCarro(v: VeiculoCCO, avisosAbertos: Aviso[]): CorCarro {
  const meus = avisosAbertos.filter((a) => a.veiculoId === v.id);
  if (meus.some((a) => CATALOGO[a.tipo].gravidade === "critico")) return "vermelho";
  if (meus.length) return "amarelo";
  return v.ignicao && v.velocidade > 3 ? "verde" : "cinza";
}

export const comunicando = (v: VeiculoCCO, agora: number) =>
  agora - v.ultimaComunicacao <= LIMITE_SEM_COMUNICACAO_MS;

/** Áreas prontas para cada mapa (o operador também arrasta e dá zoom). */
export const AREAS: { id: string; nome: string; centro: [number, number]; zoom: number }[] = [
  { id: "brasil", nome: "Brasil", centro: [-14.5, -50], zoom: 4 },
  { id: "mg", nome: "Minas Gerais", centro: [-19.6, -44.4], zoom: 7 },
  { id: "bh", nome: "Belo Horizonte", centro: [-19.93, -44.0], zoom: 11 },
  { id: "go", nome: "Goiás", centro: [-16.6, -49.3], zoom: 8 },
  { id: "sp", nome: "São Paulo", centro: [-23.55, -46.63], zoom: 10 },
  { id: "norte", nome: "Norte", centro: [-4.5, -55], zoom: 5 },
];

// ------------------------------------------------------------ dados de exemplo

const EMPRESAS = ["Transportes Exemplo Minas", "Logística Exemplo Norte", "Viação Exemplo SP"];
const NOMES = [
  "A. Souza",
  "B. Lima",
  "C. Rocha",
  "D. Alves",
  "E. Martins",
  "F. Costa",
  "G. Ribeiro",
  "H. Dias",
  null,
];
const FAIXAS: Faixa[] = ["Econômica", "Verde", "Verde", "Amarela", "Vermelha", "Inércia"];
const POLOS: { centro: [number, number]; raio: number; empresa: number; n: number; alt: number }[] =
  [
    { centro: [-19.93, -44.0], raio: 0.25, empresa: 0, n: 18, alt: 850 },
    { centro: [-20.44, -44.77], raio: 0.3, empresa: 0, n: 8, alt: 780 },
    { centro: [-16.68, -49.25], raio: 0.35, empresa: 0, n: 8, alt: 750 },
    { centro: [-1.45, -48.49], raio: 0.3, empresa: 1, n: 9, alt: 15 },
    { centro: [-8.76, -63.9], raio: 0.3, empresa: 1, n: 7, alt: 90 },
    { centro: [-23.55, -46.63], raio: 0.2, empresa: 2, n: 12, alt: 760 },
  ];

/** Gerador determinístico (mesma frota a cada abertura). */
function aleatorio(semente: number) {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function frotaExemplo(agora = Date.now()): VeiculoCCO[] {
  const r = aleatorio(42);
  const out: VeiculoCCO[] = [];
  let i = 0;
  for (const p of POLOS) {
    for (let k = 0; k < p.n; k++, i++) {
      const situ = r();
      const ignicao = situ > 0.25;
      const andando = ignicao && situ > 0.45;
      const semSinal = r() < 0.06;
      const letras = String.fromCharCode(
        65 + Math.floor(r() * 26),
        65 + Math.floor(r() * 26),
        65 + Math.floor(r() * 26),
      );
      out.push({
        id: `ex${i}`,
        placa: `${letras}-${Math.floor(r() * 10)}X${String(Math.floor(r() * 90) + 10)}`,
        prefixo: String(1000 + i),
        empresa: EMPRESAS[p.empresa],
        motorista: ignicao ? NOMES[Math.floor(r() * NOMES.length)] : null,
        lat: p.centro[0] + (r() - 0.5) * p.raio * 2,
        lng: p.centro[1] + (r() - 0.5) * p.raio * 2,
        rumo: r() * 360,
        ignicao,
        velocidade: andando ? Math.round(20 + r() * 70) : 0,
        rpm: ignicao ? Math.round(andando ? 1100 + r() * 1100 : 650 + r() * 150) : null,
        faixa: ignicao
          ? andando
            ? FAIXAS[Math.floor(r() * FAIXAS.length)]
            : "Marcha lenta"
          : null,
        consumoLh: ignicao
          ? Math.round((andando ? 18 + r() * 22 : 2.5 + r() * 1.5) * 10) / 10
          : null,
        altitude: Math.round(p.alt + (r() - 0.5) * 120),
        temperatura: ignicao ? Math.round(78 + r() * 18) : null,
        combustivelPct: Math.round(15 + r() * 80),
        ultimaComunicacao: semSinal
          ? agora - (3 + r() * 20) * 3600_000
          : agora - r() * (ignicao ? 60_000 : 90 * 60_000),
        temCamera: r() < 0.55,
      });
    }
  }
  return out;
}

export function avisosExemplo(frota: VeiculoCCO[], agora = Date.now()): Aviso[] {
  const r = aleatorio(7);
  const tipos = Object.keys(CATALOGO);
  const out: Aviso[] = [];
  frota.forEach((v, i) => {
    if (r() > 0.32) return;
    const n = r() < 0.25 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      let tipo = tipos[Math.floor(r() * tipos.length)];
      if (CATALOGO[tipo].fonte === "camera" || CATALOGO[tipo].fonte === "equipamento") {
        if (!v.temCamera) tipo = "ev_161";
      }
      out.push({
        id: `a${i}-${k}`,
        veiculoId: v.id,
        tipo,
        em: agora - Math.floor(r() * 50) * 60_000,
        detalhe: detalheDe(tipo, v),
        situacao: "aberto",
      });
    }
  });
  return out.sort((a, b) => b.em - a.em);
}

function detalheDe(tipo: string, v: VeiculoCCO) {
  if (tipo === "ev_7") return `${Math.max(v.velocidade, 92)} km/h`;
  if (tipo === "man_temperatura") return `${Math.max(v.temperatura ?? 0, 104)} °C`;
  if (tipo === "man_arla") return "8%";
  if (tipo === "man_bateria") return "23,1 V em repouso";
  return v.motorista ? `Motorista ${v.motorista}` : "";
}

/** Simula 30 s de operação: anda quem está em movimento e, às vezes, chega um aviso novo. */
export function avancar(
  frota: VeiculoCCO[],
  agora: number,
  n: number,
): { frota: VeiculoCCO[]; novo: Aviso | null } {
  const r = aleatorio(1000 + n);
  const nova = frota.map((v) => {
    if (!v.ignicao || v.velocidade < 3 || agora - v.ultimaComunicacao > LIMITE_SEM_COMUNICACAO_MS)
      return v;
    const passo = ((v.velocidade / 3600) * 30) / 111;
    const rumo = v.rumo + (r() - 0.5) * 40;
    return {
      ...v,
      rumo,
      lat: v.lat + Math.cos((rumo * Math.PI) / 180) * passo,
      lng: v.lng + Math.sin((rumo * Math.PI) / 180) * passo,
      velocidade: Math.max(5, Math.min(110, Math.round(v.velocidade + (r() - 0.5) * 12))),
      ultimaComunicacao: agora,
    };
  });
  let novo: Aviso | null = null;
  if (r() < 0.5) {
    const v = nova[Math.floor(r() * nova.length)];
    const pool = v.temCamera
      ? ["dms_distracao", "adas_proximidade", "ev_9", "ev_161", "dms_fadiga"]
      : ["ev_9", "ev_161", "ev_359", "ev_7"];
    const tipo = pool[Math.floor(r() * pool.length)];
    novo = {
      id: `n${n}`,
      veiculoId: v.id,
      tipo,
      em: agora,
      detalhe: detalheDe(tipo, v),
      situacao: "aberto",
    };
  }
  return { frota: nova, novo };
}
