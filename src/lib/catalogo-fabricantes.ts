import type { ParametroManutencao, RegraAjuste, StatusDado } from "@/types";

/**
 * Catálogo de manutenção por fabricante, a partir de pesquisa documental.
 *
 * Cada item declara a origem do número e o quanto confiar nele. A distinção
 * importa porque um intervalo errado gera alerta errado — mandar um carro para
 * a oficina 20 mil km antes custa dinheiro, e 20 mil depois custa motor.
 *
 * O que está aqui como `oficial` veio de manual ou documento do fabricante. O
 * que está como `concessionaria` funciona como ponto de partida e precisa de
 * confirmação antes de virar alerta em produção.
 *
 * **Duas camadas.** Ônibus encarroçado tem plano de chassi e plano de
 * carroceria, com fornecedores diferentes. Como o cadastro registra um modelo
 * só, a separação vive no campo `camada` de cada item.
 */

/**
 * Item do catálogo antes de virar parâmetro.
 *
 * Os três gatilhos são opcionais aqui porque quase nenhum item tem os três: um
 * plano por quilometragem não tem prazo, e um por prazo não tem horímetro.
 * Preencher com null explícito em cada entrada só adicionaria ruído — a
 * conversão para `ParametroManutencao` normaliza no fim.
 */
type ItemCatalogo = Omit<
  ParametroManutencao,
  "id" | "modeloId" | "intervaloKm" | "intervaloMeses" | "intervaloHoras" | "tipoOperacao"
> & {
  intervaloKm?: number | null;
  intervaloMeses?: number | null;
  intervaloHoras?: number | null;
  tipoOperacao?: ParametroManutencao["tipoOperacao"];
  /** Motor a que o item se aplica, para casar com o modelo certo. */
  motor?: string;
};

/**
 * Normaliza um item do catálogo para o formato do parâmetro.
 *
 * Gatilho ausente vira `null`, que significa "não se aplica" — diferente de
 * zero, que significaria vencimento imediato.
 */
export function paraParametro(item: ItemCatalogo, id: string, modeloId: string): ParametroManutencao {
  return {
    ...item,
    id,
    modeloId,
    intervaloKm: item.intervaloKm ?? null,
    intervaloMeses: item.intervaloMeses ?? null,
    intervaloHoras: item.intervaloHoras ?? null,
    tipoOperacao: item.tipoOperacao ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Conversões oficiais entre quilometragem e horas                     */
/* ------------------------------------------------------------------ */

/**
 * Equivalências publicadas pelos fabricantes.
 *
 * Servem quando o plano vem em km e a operação é medida em horas — ônibus
 * urbano e veículo com muito PTO acumulam hora sem acumular quilômetro, e
 * cobrar só por km atrasaria a manutenção deles.
 */
export const CONVERSAO_KM_HORA = {
  /** Scania: 20.000 km equivalem a 300 h de motor. */
  scania: { km: 20_000, horas: 300, fonte: "Manual de manutenção periódica Scania" },
  /** DAF: cada hora de tomada de força conta como 40 km. */
  daf: { km: 40, horas: 1, contexto: "tomada de força", fonte: "Manual de garantia DAF XF/CF" },
} as const;

export const kmEquivalenteEmHoras = (km: number, fabricante: "scania" = "scania") =>
  Math.round((km / CONVERSAO_KM_HORA[fabricante].km) * CONVERSAO_KM_HORA[fabricante].horas);

/* ------------------------------------------------------------------ */
/* Regras de severidade                                                */
/* ------------------------------------------------------------------ */

/**
 * Ajustes de intervalo por condição de operação, conforme cada fabricante.
 *
 * São numéricas e diretas — dá para aplicar sem interpretação, o que é raro
 * neste assunto.
 */
export const REGRAS_FABRICANTE: Omit<RegraAjuste, "id">[] = [
  {
    nome: "Volvo — marcha-lenta acima de 30%",
    montadoraId: "volvo",
    indicador: "parado_motor_ligado",
    operador: "maior_que",
    limiar: 30,
    // A Volvo manda reduzir um nível do intervalo. 0,7 aproxima o degrau entre
    // níveis consecutivos da tabela.
    fator: 0.7,
    fonte:
      "Marcha-lenta acima de 30% do tempo obriga a reduzir um nível do intervalo, conforme orientação Volvo.",
    ativa: true,
  },
  {
    nome: "Volare — uso severo",
    montadoraId: "volare",
    indicador: "operacao_severa",
    operador: "maior_que",
    limiar: 0,
    // Literal do manual: "efetuar as manutenções na metade dos períodos".
    fator: 0.5,
    fonte:
      "Manual do proprietário Volare: em aplicações severas ou especiais, efetuar as manutenções na metade dos períodos indicados.",
    ativa: true,
  },
  {
    nome: "Scania — operação urbana rebaixa o tipo",
    montadoraId: "scania",
    indicador: "parado_motor_ligado",
    operador: "maior_que",
    limiar: 25,
    fator: 0.75,
    fonte:
      "A matriz Scania rebaixa o tipo de operação conforme a rota; marcha-lenta com tomada de força ativa entra no ajuste do plano.",
    ativa: true,
  },
  {
    nome: "Condição adversa — leves VW e Toyota",
    indicador: "operacao_severa",
    operador: "maior_que",
    limiar: 0,
    // Passa de 10.000 km/12 meses para 10.000 km/6 meses: o km não muda, o
    // prazo cai pela metade. O fator aqui vale para o gatilho de tempo.
    fator: 0.5,
    fonte:
      "Em condição adversa, VW e Toyota reduzem o prazo de 12 para 6 meses, mantendo a quilometragem.",
    ativa: true,
  },
];

/* ------------------------------------------------------------------ */
/* Itens por fabricante                                                */
/* ------------------------------------------------------------------ */

const oficial = (fonte: string): { statusDado: StatusDado; fonte: string } => ({
  statusDado: "oficial",
  fonte,
});
const concessionaria = (fonte: string): { statusDado: StatusDado; fonte: string } => ({
  statusDado: "concessionaria",
  fonte,
});
const divulgado = (fonte: string): { statusDado: StatusDado; fonte: string } => ({
  statusDado: "divulgado",
  fonte,
});
const naoLocalizado = (ondeBuscar: string): { statusDado: StatusDado; fonte: string } => ({
  statusDado: "nao_localizado",
  fonte: `Buscar em: ${ondeBuscar}`,
});

/** Toyota Hilux — tabela nacional da rede, dado sólido. */
export const CATALOGO_TOYOTA: ItemCatalogo[] = [
  {
    sistema: "Revisão programada",
    item: "Revisão periódica",
    acao: "revisar",
    intervaloKm: 10_000,
    intervaloMeses: 12,
    especificacao: "Peças e lubrificantes genuínos; até 10 revisões programadas",
    obsUsoSevero: "Condição adversa antecipa para 6 meses",
    camada: "chassi",
    ativo: true,
    ...oficial("Tabela de revisões Toyota Brasil, válida 01/10/2025 a 31/03/2026"),
  },
];

/** Volkswagen leves — Polo e Saveiro. */
export const CATALOGO_VW_LEVES: ItemCatalogo[] = [
  {
    sistema: "Revisão programada",
    item: "Revisão periódica",
    acao: "revisar",
    intervaloKm: 10_000,
    intervaloMeses: 12,
    obsUsoSevero: "Condição adversa: 10.000 km ou 6 meses",
    camada: "chassi",
    ativo: true,
    ...oficial("vw.com.br — plano de revisões a preço fixo nacional"),
  },
  {
    sistema: "Motor",
    item: "Correia dentada",
    acao: "substituir",
    intervaloKm: 60_000,
    especificacao: "Saveiro",
    camada: "chassi",
    ativo: true,
    ...oficial("vw.com.br"),
  },
];

/**
 * Renault Master.
 *
 * O item de correia **não existe** neste motor, e isso é importante: o 2.3 dCi
 * usa corrente. A própria Renault reconheceu erro no manual antigo, que citava
 * correia a 80.000 km. Programar esse alerta mandaria a oficina procurar uma
 * peça que não está lá.
 */
export const CATALOGO_RENAULT: ItemCatalogo[] = [
  {
    sistema: "Revisão programada",
    item: "Revisão periódica",
    acao: "revisar",
    intervaloKm: 20_000,
    intervaloMeses: 12,
    especificacao: "Motor 2.3 dCi, com OCS detectando uso severo",
    obsUsoSevero: "O sistema OCS antecipa a revisão automaticamente",
    camada: "chassi",
    ativo: true,
    ...oficial("Renault Brasil — programa Revisão Programada"),
  },
  {
    sistema: "Motor",
    item: "Velas de pré-aquecimento",
    acao: "substituir",
    intervaloKm: 40_000,
    camada: "chassi",
    ativo: true,
    ...concessionaria("Rede Renault"),
  },
];

/** Honda CG 125 — intervalos curtos, plano do manual do próprio modelo. */
export const CATALOGO_HONDA: ItemCatalogo[] = [
  {
    sistema: "Revisão programada",
    item: "Primeira revisão",
    acao: "revisar",
    intervaloKm: 1_000,
    intervaloMeses: 6,
    especificacao: "Tolerância de ±10%",
    camada: "chassi",
    ativo: true,
    ...oficial("Manual do proprietário Honda CG 125i Fan"),
  },
  {
    sistema: "Revisão programada",
    item: "Segunda revisão",
    acao: "revisar",
    intervaloKm: 4_000,
    intervaloMeses: 12,
    // A CG 160 usa 6.000 km na segunda revisão. Separar por cilindrada evita
    // aplicar o intervalo de um modelo no outro.
    especificacao: "Válido para CG 125; a CG 160 usa 6.000 km",
    camada: "chassi",
    ativo: true,
    ...oficial("Manual do proprietário Honda CG 125i Fan"),
  },
  {
    sistema: "Revisão programada",
    item: "Revisões seguintes",
    acao: "revisar",
    intervaloKm: 5_000,
    intervaloMeses: 6,
    obsUsoSevero: "Poeira ou uso intenso exigem serviços mais frequentes",
    camada: "chassi",
    ativo: true,
    ...oficial("Manual do proprietário Honda CG 125i Fan"),
  },
];

/**
 * Volkswagen Constellation e Delivery.
 *
 * A estrutura oficial é um ciclo L → MP1 → L → MP2 → L → MP3, com passo
 * diferente por grupo de aplicação. O passo é o que muda entre rodoviário,
 * misto e severo — não a sequência.
 */
export const CATALOGO_VWCO: ItemCatalogo[] = [
  {
    sistema: "Revisão programada",
    item: "Revisão de assentamento",
    acao: "revisar",
    intervaloKm: 5_000,
    especificacao: "Entre 1.000 e 5.000 km, uma única vez",
    camada: "chassi",
    ativo: true,
    ...oficial("Manual de manutenção VW Constellation"),
  },
  {
    sistema: "Revisão programada",
    item: "Revisão L — rodoviário",
    acao: "revisar",
    intervaloKm: 25_000,
    tipoOperacao: "longa",
    camada: "chassi",
    ativo: true,
    ...oficial("Manual de manutenção VW Constellation, grupo 1"),
  },
  {
    sistema: "Revisão programada",
    item: "Revisão L — misto",
    acao: "revisar",
    intervaloKm: 20_000,
    tipoOperacao: "longa_pesado",
    camada: "chassi",
    ativo: true,
    ...oficial("Manual de manutenção VW Constellation, grupo 2"),
  },
  {
    sistema: "Revisão programada",
    item: "Revisão L — severo",
    acao: "revisar",
    intervaloKm: 15_000,
    tipoOperacao: "urbano",
    camada: "chassi",
    ativo: true,
    ...oficial("Manual de manutenção VW Constellation, grupo 3"),
  },
  {
    sistema: "Alimentação",
    item: "Filtros de combustível",
    acao: "substituir",
    intervaloKm: 25_000,
    especificacao: "VW Meteor, motor MAN D26",
    camada: "chassi",
    ativo: true,
    ...divulgado("Plano Volks Total, caso documentado do Meteor 28.480"),
  },
  {
    sistema: "Revisão programada",
    item: "Revisão por horímetro",
    acao: "revisar",
    intervaloHoras: 500,
    especificacao: "Grupo IV — aplicações medidas em horas",
    camada: "chassi",
    ativo: true,
    ...oficial("Manual de manutenção VW Constellation"),
  },
];

/**
 * DAF.
 *
 * O plano é por grupo de uso, com serviço intermediário e revisão principal. A
 * tolerância de ±1.000 km é do próprio manual — vale programar o alerta com
 * essa folga, senão ele dispara antes do que o fabricante considera devido.
 */
export const CATALOGO_DAF: ItemCatalogo[] = [
  {
    sistema: "Revisão programada",
    item: "Serviço intermediário — grupo 1",
    acao: "revisar",
    intervaloKm: 30_000,
    tipoOperacao: "longa",
    especificacao: "Tolerância de ±1.000 km",
    camada: "chassi",
    ativo: true,
    ...oficial("Manual de garantia DAF XF/CF"),
  },
  {
    sistema: "Revisão programada",
    item: "Serviço intermediário — grupo 3",
    acao: "revisar",
    intervaloKm: 20_000,
    tipoOperacao: "urbano",
    especificacao: "Tolerância de ±1.000 km",
    camada: "chassi",
    ativo: true,
    ...oficial("Manual de garantia DAF XF/CF"),
  },
  {
    sistema: "Revisão programada",
    item: "Revisão principal — grupo 1",
    acao: "revisar",
    intervaloKm: 60_000,
    tipoOperacao: "longa",
    camada: "chassi",
    ativo: true,
    ...oficial("Manual de garantia DAF XF/CF"),
  },
  {
    sistema: "Revisão programada",
    item: "Revisão principal — grupo 3",
    acao: "revisar",
    intervaloKm: 40_000,
    tipoOperacao: "urbano",
    camada: "chassi",
    ativo: true,
    ...oficial("Manual de garantia DAF XF/CF"),
  },
];

/** Iveco Stralis — marcos de revisão a preço fixo. */
export const CATALOGO_IVECO: ItemCatalogo[] = [
  {
    sistema: "Revisão programada",
    item: "Revisão periódica",
    acao: "revisar",
    intervaloKm: 40_000,
    especificacao: "Stralis, motor Cursor 13",
    camada: "chassi",
    ativo: true,
    ...divulgado("Release Iveco — revisões a preço fixo em 40, 80 e 120 mil km"),
  },
  {
    sistema: "Revisão programada",
    item: "Revisão periódica — Stralis NR",
    acao: "revisar",
    intervaloKm: 30_000,
    especificacao: "Permite óleo semissintético",
    camada: "chassi",
    ativo: true,
    ...divulgado("Release Iveco sobre o Stralis NR renovado"),
  },
  {
    sistema: "Revisão programada",
    item: "Revisão periódica — S-Way",
    acao: "revisar",
    intervaloKm: null,
    camada: "chassi",
    ativo: false,
    ...naoLocalizado("iveco.com.br/manuais — Manual de uso e manutenção S-Way"),
  },
];

/** Mercedes-Benz caminhões. */
export const CATALOGO_MB: ItemCatalogo[] = [
  {
    sistema: "Motor",
    item: "Óleo do motor",
    acao: "substituir",
    intervaloKm: 30_000,
    intervaloMeses: 12,
    especificacao: "MB 228.31 para Euro 5 e 6; MB 228.51 recomendado para Euro 6",
    capacidade: "29,3 L",
    motor: "OM 926 LA",
    camada: "chassi",
    ativo: true,
    ...concessionaria("Rede Mercedes-Benz — confirmar no manual do proprietário"),
  },
  {
    sistema: "Motor",
    item: "Óleo do motor",
    acao: "substituir",
    intervaloKm: 30_000,
    intervaloMeses: 12,
    especificacao: "MB 228.5 — Axor e Atron",
    capacidade: "39,0 L",
    motor: "OM 457 LA",
    camada: "chassi",
    ativo: true,
    ...concessionaria("Rede Mercedes-Benz — confirmar no manual do proprietário"),
  },
  {
    sistema: "Motor",
    item: "Óleo do motor",
    acao: "substituir",
    intervaloKm: 30_000,
    intervaloMeses: 12,
    especificacao: "MB 228.31 — Accelo e Atego leves",
    capacidade: "15,8 L",
    motor: "OM 924 LA",
    camada: "chassi",
    ativo: true,
    ...concessionaria("Rede Mercedes-Benz — confirmar no manual do proprietário"),
  },
  {
    sistema: "Transmissão",
    item: "Óleo do câmbio",
    acao: "substituir",
    intervaloKm: 90_000,
    intervaloMeses: 48,
    especificacao: "O que ocorrer primeiro — linha Atego 2024/2025",
    camada: "chassi",
    ativo: true,
    ...oficial("Resposta oficial da Mercedes-Benz, caso público documentado"),
  },
  {
    sistema: "Revisão programada",
    item: "Revisão do chassi de ônibus",
    acao: "revisar",
    intervaloKm: null,
    especificacao: "OF-1519, OF-1721 e O-500M",
    obsUsoSevero: "Uso urbano é considerado severo, sem valor numérico publicado",
    camada: "chassi",
    ativo: false,
    ...naoLocalizado(
      "mercedes-benz-trucks.com.br/onibus/manuais ou CRC 0800 970 9090 — atenção: valores de Serviço A/B e ASSYST são de automóveis e vans, não valem para ônibus pesado",
    ),
  },
];

/** Volvo. */
export const CATALOGO_VOLVO: ItemCatalogo[] = [
  {
    sistema: "Motor",
    item: "Óleo do motor",
    acao: "substituir",
    intervaloKm: 60_000,
    especificacao: "VDS-4 ou VDS-4.5 — motor D8K, condições normais",
    motor: "D8K",
    obsUsoSevero: "Marcha-lenta acima de 30% reduz um nível do intervalo",
    camada: "chassi",
    ativo: true,
    ...concessionaria("Publicação técnica sobre a linha VM — confirmar no manual Volvo"),
  },
];

/**
 * Scania.
 *
 * O plano não é um número por modelo: é uma matriz de seis tipos de operação,
 * cada um com sua sequência de manutenção. O tipo é definido pela rota, e o
 * intervalo de óleo ainda depende da fase de emissão.
 */
export const CATALOGO_SCANIA: ItemCatalogo[] = [
  {
    sistema: "Revisão programada",
    item: "Manutenção periódica — longa distância",
    acao: "revisar",
    intervaloKm: 45_000,
    tipoOperacao: "longa",
    especificacao: "Tipo 1 da matriz Scania; sequência M-S-L-S-M-S-XL",
    camada: "chassi",
    ativo: true,
    ...oficial("Prefácio da manutenção periódica Scania — séries L, P, G, R e S"),
  },
  {
    sistema: "Revisão programada",
    item: "Manutenção periódica — distribuição urbana",
    acao: "revisar",
    intervaloKm: 30_000,
    tipoOperacao: "urbano",
    especificacao: "Tipo 4 da matriz Scania — curta distância",
    obsUsoSevero: "Marcha-lenta com tomada de força ativa ajusta o plano",
    camada: "chassi",
    ativo: true,
    ...oficial("Prefácio da manutenção periódica Scania"),
  },
  {
    sistema: "Revisão programada",
    item: "Manutenção periódica — construção",
    acao: "revisar",
    intervaloKm: 20_000,
    intervaloHoras: 300,
    tipoOperacao: "longa_pesado",
    especificacao: "Tipo 3 — fora de estrada; 20.000 km equivalem a 300 h",
    camada: "chassi",
    ativo: true,
    ...oficial("Prefácio da manutenção periódica Scania"),
  },
  {
    sistema: "Motor",
    item: "Óleo do motor — série 4",
    acao: "substituir",
    intervaloKm: 30_000,
    motor: "DSC12",
    especificacao: "R124 série 4 — tabela distinta da linha PGR",
    camada: "chassi",
    ativo: false,
    ...naoLocalizado("til.scania.com — manual de manutenção da série 4"),
  },
];

/**
 * Volare.
 *
 * O manual traz a regra de severidade mais direta de todo o levantamento:
 * metade do período em aplicação severa. É literal, não interpretação.
 */
export const CATALOGO_VOLARE: ItemCatalogo[] = [
  {
    sistema: "Revisão programada",
    item: "Manutenção periódica preventiva",
    acao: "revisar",
    intervaloKm: null,
    obsUsoSevero:
      "Aplicações severas ou especiais: efetuar as manutenções na metade dos períodos indicados",
    camada: "chassi",
    ativo: false,
    ...naoLocalizado("volare.com.br — plano de manutenção periódica preventiva do manual"),
  },
  {
    sistema: "Acessibilidade",
    item: "Dispositivo de poltrona móvel",
    acao: "revisar",
    intervaloKm: null,
    especificacao: "Plano DPM, separado do plano principal",
    camada: "carroceria",
    encarrocadora: "Marcopolo",
    ativo: false,
    ...naoLocalizado("volare.com.br — plano de manutenção DPM"),
  },
];

/**
 * Carroceria — segunda camada.
 *
 * Vale para qualquer chassi encarroçado, independentemente da montadora. O
 * ritmo é outro: enquanto o chassi conta quilômetros, a carroceria conta dias.
 */
export const CATALOGO_CARROCERIA: ItemCatalogo[] = [
  {
    sistema: "Climatização",
    item: "Feltro do ar-condicionado",
    acao: "limpar",
    intervaloKm: null,
    // Sete dias. É o item mais frequente de todo o catálogo, e o que mais
    // some quando só se conta quilometragem.
    intervaloMeses: null,
    especificacao: "Limpeza semanal",
    camada: "carroceria",
    encarrocadora: "Marcopolo",
    ativo: true,
    ...oficial("Manual de operação e manutenção da carroceria Marcopolo Torino"),
  },
  {
    sistema: "Estrutura",
    item: "Reaperto estrutural",
    acao: "revisar",
    intervaloKm: null,
    especificacao: "Tabela de torque própria da encarroçadora",
    camada: "carroceria",
    ativo: false,
    ...naoLocalizado("Manual de operação e manutenção da encarroçadora"),
  },
  {
    sistema: "Acessos",
    item: "Lubrificação de portas",
    acao: "lubrificar",
    intervaloKm: null,
    camada: "carroceria",
    ativo: false,
    ...naoLocalizado("Manual de operação e manutenção da encarroçadora"),
  },
];

/** Tudo reunido, para carga inicial do catálogo. */
export const CATALOGO_COMPLETO = [
  ...CATALOGO_TOYOTA,
  ...CATALOGO_VW_LEVES,
  ...CATALOGO_RENAULT,
  ...CATALOGO_HONDA,
  ...CATALOGO_VWCO,
  ...CATALOGO_DAF,
  ...CATALOGO_IVECO,
  ...CATALOGO_MB,
  ...CATALOGO_VOLVO,
  ...CATALOGO_SCANIA,
  ...CATALOGO_VOLARE,
  ...CATALOGO_CARROCERIA,
];
