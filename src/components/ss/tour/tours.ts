/**
 * Registro de tours guiados por rota. Cada tela tem seus passos; ao entrar nela
 * pela primeira vez, o tour abre automaticamente e explica o que há ali.
 *
 * `selector` aponta o elemento a destacar (âncoras `data-tour` nos componentes
 * compartilhados: page-header, hero, sidebar, stat, table, bus, seatmap; ou um
 * seletor estrutural). Se o elemento não existir, o passo é pulado.
 */

export type TourStep = {
  selector: string;
  title: string;
  body: string;
  /**
   * Passo largo, para explicações que não cabem em três linhas.
   *
   * O balão padrão de 320px foi dimensionado para legendas curtas. Conceito
   * novo — herança de padrão, resolução por faixa horária — precisa de espaço
   * e de mais de um parágrafo, senão vira texto espremido que ninguém lê.
   */
  amplo?: boolean;
  /** Parágrafos adicionais, exibidos abaixo do corpo. */
  detalhes?: string[];
  /** Exemplo concreto, destacado ao final. */
  exemplo?: string;
};

/** Passos comuns às telas de lista (hero + KPIs + tabela). */
function listSteps(o: {
  header: string;
  hero: string;
  stat: string;
  table: string;
}): TourStep[] {
  return [
    { selector: '[data-tour="page-header"]', title: "Cabeçalho da tela", body: o.header },
    { selector: '[data-tour="hero"]', title: "Resumo em destaque", body: o.hero },
    { selector: '[data-tour="stat"]', title: "Indicadores-chave", body: o.stat },
    { selector: '[data-tour="table"]', title: "Detalhamento", body: o.table },
  ];
}

/** Passos de um cadastro padrão (scaffold). */
function cadastroSteps(nome: string, oque: string): TourStep[] {
  return [
    { selector: '[data-tour="page-header"]', title: `Cadastro de ${nome}`, body: `Aqui você gerencia ${oque}. O botão no canto abre o formulário de novo registro.` },
    { selector: '[data-tour="hero"]', title: "Panorama", body: `Os números em destaque resumem a situação de ${nome} na operação.` },
    { selector: '[data-tour="stat"]', title: "Indicadores", body: "Contadores rápidos para leitura imediata do estado atual." },
    { selector: '[data-tour="table"]', title: "Registros", body: "Lista completa. A busca no topo do quadro filtra de verdade, e clicar em qualquer linha abre o registro para ver e editar." },
    { selector: '[data-tour="page-header"] button', title: "Criar e excluir", body: "O botão abre o painel lateral de cadastro. Nele também estão a edição e a exclusão, com confirmação antes de apagar." },
  ];
}

export const TOURS: Record<string, TourStep[]> = {
  "/app/admin/catalogo": [
    {
      selector: '[data-tour="page-header"]',
      title: "O que este catálogo controla",
      amplo: true,
      body: "Aqui ficam os parâmetros que cada montadora exige por modelo: o que trocar, a cada quantos quilômetros, horas ou meses. É a partir daqui que a manutenção preventiva sabe quando chamar um veículo para a oficina.",
      detalhes: [
        "A regra de disparo dos fabricantes é sempre a mesma: o que ocorrer primeiro entre quilometragem, horas de motor e tempo. Preencher só um dos três é comum e válido — um item pode ser controlado só por tempo, como a aferição do tacógrafo.",
      ],
    },
    {
      selector: '[data-tour="pendencias"]',
      title: "Modelos que não geram preventiva",
      amplo: true,
      body: "Este bloco é o que exige ação do administrador. Modelo sem parâmetro utilizável significa que os veículos dele passam batido: rodam, acumulam quilometragem e nunca entram na fila de manutenção.",
      detalhes: [
        "Há duas origens. A primeira: alguém cadastrou um veículo cujo modelo não existia, e o sistema criou o modelo na hora em vez de travar o cadastro — o veículo precisa entrar em operação hoje, mas os parâmetros ficam devendo.",
        "A segunda: o parâmetro existe mas sem número oficial. A Mercedes-Benz é o caso mais comum — o escopo dos itens é público, o quilômetro exato de cada marco não. Nesses casos o sistema não estima; pede confirmação com a concessionária.",
      ],
      exemplo: "Um número inventado que pareça plausível é pior que nenhum: o cliente segue, o motor quebra e a garantia é negada.",
    },
    {
      selector: '[data-tour="arvore"]',
      title: "Montadora, modelo e parâmetros",
      amplo: true,
      body: "A navegação segue a hierarquia real: montadora, depois os modelos daquela marca, depois os itens de manutenção de cada modelo.",
      detalhes: [
        "Cada parâmetro mostra o intervalo, o tipo de operação a que se aplica e a procedência do dado. Verde é tabela oficial do fabricante e pode virar regra; âmbar precisa de confirmação.",
        "O mesmo item pode ter vários parâmetros, um por tipo de operação. Não é redundância: o mesmo motor Scania DC13 troca óleo a cada 120.000 km em longa distância leve e a cada 20.000 km em construção. Um plano sem tipo de operação erraria por um fator de seis.",
      ],
    },
    {
      selector: '[data-tour="stat"]',
      title: "Leitura de cobertura",
      amplo: true,
      body: "Os dois últimos números são os que importam para confiar no módulo: quantos parâmetros têm fonte oficial e quantos aguardam confirmação.",
      detalhes: [
        "Só os oficiais disparam alerta automático. Os demais ficam registrados para não se perderem, mas não geram ordem de serviço — é a diferença entre o sistema informar e o sistema decidir.",
      ],
    },
  ],

  /*
   * Padrão por linha é o único conceito realmente novo do sistema — herança de
   * valores entre três níveis. Por isso este tour usa passos amplos, com
   * exemplo concreto: explicação curta aqui não seria entendida.
   */
  "/app/urbano/padrao": [
    {
      selector: '[data-tour="page-header"]',
      title: "Por que esta tela existe",
      amplo: true,
      body: "Até agora o motorista era avaliado contra a média geral da frota. Isso é injusto nos dois sentidos: pune quem roda em linha de morro, com muitos semáforos e trânsito, e premia quem roda em linha plana e livre.",
      detalhes: [
        "Aqui cada linha declara o que se espera dela. Quando o motorista roda a linha 8207, ele passa a ser comparado com o padrão da 8207 — não com a frota inteira.",
        "Configurar é opcional. Linha sem padrão próprio continua usando o padrão global, e nada quebra. Você configura só as linhas que realmente destoam.",
      ],
      exemplo:
        "Um motorista reduziu o motor ligado parado de 25% para 18%. Melhorou — mas isso é bom? Depende: se na linha dele o padrão é 16%, ainda está acima. Se é 20%, já superou.",
    },
    {
      selector: '[data-tour="seletor-linha"]',
      title: "Escolha da linha",
      amplo: true,
      body: "Comece escolhendo a linha. O ✓ ao lado do nome indica que ela já tem padrão próprio configurado; as demais estão usando o padrão global.",
      detalhes: [
        "Não é preciso configurar todas. Na prática, poucas linhas destoam o suficiente para justificar padrão próprio — normalmente as de topografia difícil, as de corredor congestionado e as expressas.",
      ],
    },
    {
      selector: '[data-tour="faixa-horaria"]',
      title: "Faixa horária — o segundo nível",
      amplo: true,
      body: "A mesma linha no pico e no entrepico são operações diferentes: no pico há mais trânsito, mais lotação e mais paradas efetivas, e o consumo sobe por motivos que não têm relação com o motorista.",
      detalhes: [
        '"Linha inteira" vale para qualquer horário. As abas de faixa valem só naquele intervalo e têm prioridade sobre a linha inteira.',
        "O número em cada aba mostra quantos indicadores foram definidos ali. Aba com zero não significa problema — significa que ela está herdando, que é o comportamento normal.",
      ],
      exemplo:
        "Linha 8207 · linha inteira: motor parado 11%.\nLinha 8207 · pico manhã: motor parado 16%.\n\nNo pico vale 16%. Nos demais horários, 11%.",
    },
    {
      selector: '[data-tour="indicadores"]',
      title: "Herdado × definido aqui",
      amplo: true,
      body: "Cada indicador mostra de onde vem o valor aplicado. Esse rótulo é a parte mais importante da tela: sem ele você não sabe se está olhando um número que alguém definiu ou um número que veio de cima.",
      detalhes: [
        "«Padrão global» — ninguém definiu nada para esta linha; o valor vem da configuração geral da empresa. O campo fica desabilitado.",
        "«Definido nesta linha» ou «Definido nesta faixa» — alguém configurou aqui. O campo fica editável, e o botão de desfazer devolve o indicador à herança.",
        "Você não precisa preencher os 24 indicadores. Definir dois ou três e deixar o resto herdando é o uso esperado — e é o que mantém a manutenção viável quando o padrão global mudar.",
      ],
      exemplo:
        "Se você definir só «faixa verde» na linha 8207, os outros 23 indicadores continuam vindo do padrão global — e continuam se atualizando sozinhos quando o global for alterado.",
    },
    {
      selector: '[data-tour="sugestao"]',
      title: "Sugerir do histórico",
      amplo: true,
      body: 'Para a pergunta "qual é o padrão que esta linha deveria ter?", o botão calcula a partir das viagens já realizadas neste mesmo contexto.',
      detalhes: [
        "O cálculo usa o percentil 75, não a média. A média incorporaria a ineficiência de quem dirige mal e congelaria o problema; o P75 responde o que o quarto superior dos motoristas consegue fazer nesta linha — desempenho comprovadamente atingível ali, não meta inventada.",
        "É apoio, não imposição: os valores entram nos campos e continuam editáveis. E quando não há viagens suficientes no contexto, o botão avisa em vez de sugerir um número frágil.",
      ],
    },
    {
      selector: '[data-tour="conceito"]',
      title: "Como o padrão é aplicado",
      amplo: true,
      body: "Na hora de pontuar uma viagem, o sistema procura o valor na ordem do mais específico para o mais geral, e o primeiro que encontrar vence.",
      detalhes: [
        "1. Padrão da linha na faixa horária da partida — se existir.\n2. Padrão da linha inteira — se existir.\n3. Padrão global da empresa — sempre existe.",
        "A faixa é definida pelo horário de partida da viagem, não pelo instante de cada evento. Se fosse pelo evento, uma viagem que atravessa o limite de faixa seria avaliada por dois padrões diferentes.",
        "Motorista que rodou três linhas no mês é avaliado pelo padrão de cada uma, proporcionalmente ao quilômetro rodado em cada.",
      ],
    },
  ],

  "/app/motoristas/perfil/:nome": [
    { selector: '[data-tour="page-header"]', title: "Acompanhamento do motorista", body: "O desempenho individual no período, com tudo o que sustenta a nota." },
    { selector: '[data-tour="cnh"]', title: "Situação da CNH", body: "O sistema confere a validade e avisa com 60 e 30 dias de antecedência. \"Sem informação\" também aparece: significa que falta digitalizar o documento, e não que está tudo certo." },
    {
      selector: '[data-tour="contexto"]',
      title: "Nota por linha e horário",
      amplo: true,
      body: "Esta é a nota que vale. O motorista é comparado com o padrão da linha e da faixa horária que ele efetivamente rodou — não com a média geral da frota.",
      detalhes: [
        "No topo aparecem as duas notas lado a lado: contra o padrão de cada linha e contra a média geral. A diferença entre elas é o quanto a dificuldade da linha estava distorcendo a avaliação.",
        "Cada bloco abaixo é um contexto que ele rodou. Para cada indicador você vê o valor dele, o padrão daquele contexto e o desvio — é o que permite responder uma contestação com número, em vez de discussão.",
        "A etiqueta ao final de cada linha (global, linha ou faixa) mostra de onde veio o valor de referência. O motorista precisa poder conferir contra o que foi medido.",
      ],
      exemplo:
        "Um motorista que só roda pico pode ter nota baixa contra a média geral e nota alta contra o padrão do pico — porque no pico todo mundo consome mais, e isso não é culpa dele.",
    },
    { selector: '[data-tour="faixas"]', title: "Faixas de condução", body: "Como este motorista distribui o tempo entre as 14 faixas. É a mesma leitura da frota e do veículo, então dá para comparar direto." },
    { selector: '[data-tour="table"]', title: "Veículos dirigidos", body: "Todas as placas que este motorista conduziu, com período, km e nota. Clique para abrir o veículo — o cruzamento funciona nos dois sentidos." },
  ],


  "/app/frota/telemetria": [
    { selector: '[data-tour="page-header"]', title: "Hardware", body: "O inventário dos equipamentos instalados e quando cada um comunicou dados pela última vez." },
    { selector: '[data-tour="stat"]', title: "Saúde da comunicação", body: "Quantos equipamentos existem, quantos comunicam agora, quantos estão em atraso e quantos sem sinal." },
    { selector: '[data-tour="table"]', title: "Equipamento por placa", body: "Serial, modelo, firmware, placa vinculada e a última comunicação. Passe o mouse no tempo relativo para ver a data exata." },
    { selector: '[data-tour="table"]', title: "Regra de sem sinal", body: "Comunicando até 1 h, atraso até 24 h, sem sinal acima disso. O limiar é o mesmo em todo o sistema — mudar aqui muda em todo lugar." },
  ],

  "/app/frota/desempenho": [
    { selector: '[data-tour="page-header"]', title: "Desempenho da frota", body: "Como a frota está conduzindo, e onde o combustível está indo embora." },
    { selector: '[data-tour="stat"]', title: "Indicadores", body: "Consumo, nota média e os números que resumem a eficiência do período." },
    { selector: '[data-tour="faixas"]', title: "Faixas de condução", body: "As 14 faixas do diagrama, do veículo parado ao freio motor. A barra segue a ordem oficial, então a forma dela é comparável entre frota, veículo e motorista sem precisar ler número." },
    { selector: '[data-tour="faixas"]', title: "Faixas desejáveis", body: "O percentual no canto soma as faixas que interessam: verde, extra econômica, eco-roll, inércia e parado produtivo. É a leitura rápida de eficiência." },
  ],

  "/app/premiacao/metas": [
    { selector: '[data-tour="page-header"]', title: "Metas e pesos", body: "A configuração que define como a nota do motorista é calculada." },
    { selector: '[data-tour="pesos"]', title: "Distribuição dos pesos", body: "A barra mostra o peso relativo de cada indicador ativo. Enquanto a soma não fechar 100%, o salvamento fica bloqueado — e o botão de ajuste redistribui automaticamente." },
    { selector: 'main .rounded-2xl.border:nth-of-type(2)', title: "Indicadores por categoria", body: "Os 24 indicadores agrupados em faixas de condução, ociosidade, direção segura e operação. Cada grupo mostra quanto pesa no total." },
    { selector: 'main [role="switch"]', title: "Ligar e desligar", body: "O peso é um interruptor: indicador desligado sai da conta. Normalmente uns 14 dos 24 valem para uma operação." },
    { selector: 'main input[type="range"]', title: "Meta e peso", body: "Cada indicador diz sua unidade e a direção — ↑ quanto maior melhor, ↓ quanto menor melhor. O peso mostra a participação real na nota final." },
  ],

  "/app/cadastros/garagens": [
    { selector: '[data-tour="page-header"]', title: "Garagens", body: "Uma empresa pode ter várias garagens, inclusive na mesma cidade. É o nível abaixo de Unidade." },
    { selector: '[data-tour="stat"]', title: "Rede de pátios", body: "Quantas garagens existem, quantas estão ativas, quantas unidades atendem e a ocupação total." },
    { selector: '[data-tour="table"]', title: "Ocupação por pátio", body: "Veículos alocados sobre vagas disponíveis. Clique numa linha para editar." },
    { selector: '[data-tour="table"]', title: "Por que isso importa", body: "A garagem é o menor escopo de permissão do sistema: no cadastro de usuários você define quem enxerga quais pátios." },
  ],

  "/app/auditoria": [
    { selector: '[data-tour="page-header"]', title: "Auditoria", body: "Quem fez o quê, quando e em qual organização." },
    { selector: '[data-tour="stat"]', title: "Panorama", body: "Total de registros, quantas ações partiram do super admin e quantas organizações foram tocadas." },
    { selector: '[data-tour="table"]', title: "A trilha", body: "Entrada, saída, troca de organização, criação, edição e exclusão. Cada linha guarda o usuário, o perfil e a base em que a ação ocorreu." },
    { selector: '[data-tour="page-header"] button', title: "Exportação", body: "A trilha sai em CSV. O administrador da empresa também vê o registro da própria base, inclusive o que foi feito pela equipe da SS." },
  ],
  "/app": [
    { selector: '[data-tour="sidebar"]', title: "Menu de navegação", body: "Passe o mouse aqui para expandir. Os itens do dia a dia ficam em cima; gestão e configuração, abaixo do divisor." },
    { selector: '[data-tour="page-header"]', title: "Barra da página", body: "Toda tela abre com um título, um resumo do contexto e ações rápidas à direita." },
    { selector: '[data-tour="hero"]', title: "Leitura do dia", body: "A abertura traz a economia gerada, o ROI e o payback — a história de valor da operação num relance." },
    { selector: '[data-tour="stat"]', title: "KPIs operacionais", body: "Cinco números que respondem se o dia está sob controle: veículos ativos, alertas, custo por km, consumo e disponibilidade." },
    { selector: '.pulse-dot', title: "Eventos críticos", body: "O que exige ação imediata aparece destacado, com o ponto pulsante chamando atenção." },
    { selector: '[data-tour="org-switcher"]', title: "Organização", body: "Só o super admin vê este seletor. Trocar aqui muda a base de dados exibida em todo o sistema — e uma faixa no topo lembra em qual cliente você está enquanto durar a visita." },
    { selector: '[data-tour="garagem-switcher"]', title: "Foco de garagem", body: "Restringe as telas a um pátio. A lista já vem filtrada pelo que o seu acesso permite: garagem fora do seu escopo não aparece aqui." },
  ],

  "/app/mapa": [
    { selector: '[data-tour="page-header"]', title: "Mapa ao vivo", body: "Acompanhe a posição da frota em tempo real." },
    { selector: 'main .rounded-xl.border', title: "Filtros de status", body: "Ligue ou desligue cada status (em movimento, parado, sem sinal…) para focar no que importa." },
    { selector: 'main .lg\\:grid-cols-\\[320px_1fr\\] > div:first-child', title: "Lista de veículos", body: "Busque por placa ou motorista e clique para centralizar no mapa." },
    { selector: 'main .lg\\:grid-cols-\\[320px_1fr\\] > div:last-child', title: "Mapa", body: "Cada marcador é um veículo, colorido pelo status. Clique para ver detalhes. Aqui entra a integração de mapa real." },
  ],

  "/app/co2": [
    { selector: '[data-tour="page-header"]', title: "Emissão de CO₂", body: "A pegada de carbono da frota e a certificação SS Green." },
    { selector: 'main svg', title: "Selo de redução", body: "O selo CO₂ Reduzido é emitido a partir da telemetria da própria operação — verificável, sem autodeclaração." },
    { selector: '[data-tour="stat"]', title: "Indicadores ambientais", body: "Consumo, toneladas de CO₂, km rodados e árvores estimadas para compensar." },
    { selector: '[data-tour="table"]', title: "Panorama por veículo", body: "Emissão detalhada por placa, com exportação em CSV." },
  ],

  "/app/motoristas": listSteps({
    header: "Gestão da equipe de motoristas. O botão abre o cadastro de um novo motorista.",
    hero: "Km rodados e premiação do mês — o impacto da equipe num relance.",
    stat: "Ativos, nota média, em atenção e afastados.",
    table: "Cada motorista com nota, viagens e premiação. A coluna CNH avisa quanto falta para o documento vencer. Clique numa linha para abrir o perfil.",
  }),

  "/app/motoristas/novo": [
    { selector: '[data-tour="page-header"]', title: "Novo motorista", body: "Formulário de cadastro dividido em seções." },
    { selector: 'form section:first-child', title: "Identificação", body: "Dados pessoais básicos. Os rótulos ficam sempre visíveis." },
    { selector: 'form', title: "Habilitação e vínculo", body: "Os campos de CNH são opcionais, mas a validade alimenta os alertas de vencimento na lista e no acompanhamento do motorista." },
    { selector: 'form button[type="submit"]', title: "Salvar", body: "O motorista é gravado e você volta para a lista. Se a validade da CNH ficar em branco, o sistema avisa — sem ela não há alerta de vencimento." },
  ],

  "/app/veiculos/novo": [
    { selector: '[data-tour="page-header"]', title: "Novo veículo", body: "Cadastro de um veículo da frota, dividido em seções." },
    { selector: 'form section:first-child', title: "Identificação", body: "Placa, marca, modelo e ano. A placa é o que amarra o veículo à telemetria e à manutenção." },
    { selector: 'form', title: "Operação e equipamento", body: "Vínculo com grupo, unidade e garagem, e o rastreador instalado. A garagem define quem enxerga este veículo." },
    { selector: 'form button[type="submit"]', title: "Salvar", body: "O veículo é gravado e você volta para a lista." },
  ],

  "/app/premiacao": [
    { selector: '[data-tour="page-header"]', title: "Premiação", body: "Acompanhamento do programa de bônus dos motoristas." },
    { selector: '[data-tour="hero"]', title: "Total do ciclo", body: "O valor apurado e a performance média da equipe no período." },
    { selector: 'main svg circle', title: "Meta de quilometragem", body: "O anel mostra o quanto da meta de km já foi cumprido." },
    { selector: '[data-tour="table"]', title: "Detalhamento", body: "Cada motorista com nota, viagens e valor. Os ícones geram demonstrativo e relatório de viagens." },
  ],

  "/app/veiculos": [
    { selector: '[data-tour="page-header"]', title: "Veículos", body: "Cadastro e situação da frota. O botão abre o cadastro de um novo veículo." },
    { selector: '[data-tour="stat"]', title: "Indicadores clicáveis", body: "Em rota, parados, em manutenção, sem sinal e KML médio. \"Sem sinal\" leva à telemetria dos equipamentos e \"Em manutenção\" abre o quadro — não são só números." },
    { selector: '[data-tour="table"]', title: "Frota com indicadores de condução", body: "Os mesmos oito indicadores em estrelas da tela de Motoristas, na mesma escala. A última coluna mostra a ação de manutenção da placa e abre o quadro já filtrado nela." },
    { selector: '[data-tour="table"] tbody tr', title: "Faixas por veículo", body: "O botão \"ver\" na coluna Faixas abre a distribuição de condução daquele veículo, abaixo da tabela." },
  ],

  "/app/frota/analise": [
    { selector: '[data-tour="page-header"]', title: "Análise individual", body: "Desempenho detalhado de um veículo no período." },
    { selector: '[data-tour="hero"]', title: "Veículo em foco", body: "Troque o veículo no seletor. Ao lado, velocidade média e média do bordo." },
    { selector: '[data-tour="score"]', title: "Nota de desempenho", body: "O velocímetro traz a nota consolidada e a tendência dos últimos dias." },
    { selector: '[data-tour="accel"]', title: "Pressão do acelerador", body: "Distribui a condução em ideal, atenção e crítico — a base da economia." },
  ],



  "/app/manutencao": [
    { selector: '[data-tour="page-header"]', title: "Manutenção", body: "O estado de manutenção de toda a frota, e a inspeção detalhada de cada veículo." },
    { selector: 'main .rounded-xl.border.bg-card.shadow-card', title: "Abas da tela", body: "Visão geral (o quadro), consumíveis, telemetria dos equipamentos, predições da frota e histórico de ordens. Cada aba tem conteúdo próprio." },
    { selector: '[data-tour="stat"]', title: "Indicadores", body: "Placas na frota, quantas estão em dia, quantas em atraso e o custo previsto." },
    { selector: '[data-tour="kanban"]', title: "Quadro de manutenção", body: "Um card por placa, distribuído em Em dia, Preditiva, Preventiva, Corretiva e Liberado. Veículo com mais de uma pendência aparece na coluna mais grave e informa as demais no rodapé do card." },
    {
      selector: 'main .rounded-xl.border.bg-card.shadow-card',
      title: "Plano preventivo — de onde vem o alerta",
      amplo: true,
      body: "A aba Plano preventivo calcula, veículo a veículo, o que vence e quando. Ela cruza três coisas: o parâmetro do fabricante no catálogo, o odômetro atual e a data da última execução daquele item.",
      detalhes: [
        "O disparo segue a regra dos fabricantes — o que ocorrer primeiro entre quilometragem, horas de motor e tempo. Por isso a tela informa por qual dos três o item está vencendo: um ônibus que roda pouco pode ter o óleo vencendo por prazo, não por quilômetro.",
        "O intervalo do catálogo é o ponto de partida, não a palavra final. Quando a telemetria mostra operação mais severa que a prevista, ele é encurtado automaticamente e a tela mostra o motivo, com o número original riscado ao lado do aplicado.",
        "Veículo cujo modelo não tem parâmetro utilizável aparece no aviso do topo. Ele roda e acumula quilometragem, mas nunca entra na fila — é a pendência que o administrador precisa resolver no catálogo.",
      ],
      exemplo:
        "Volvo urbano: catálogo manda trocar óleo a cada 30.000 km.\nO carro está com 37% de marcha-lenta, acima do limite de 30% publicado pela Volvo.\nO sistema aplica 21.000 km e mostra: \"intervalo reduzido para 70% — marcha-lenta em 37%\".",
    },
    { selector: '[data-tour="kanban"] button', title: "Abrir um veículo", body: "Clique num card para ver a inspeção visual, as predições e quem dirigiu aquela placa. De lá dá para agendar a manutenção ou liberar o veículo." },
  ],

  "/app/manutencao/regeneracao": [
    { selector: '[data-tour="page-header"]', title: "Regeneração (DPF)", body: "Saúde do filtro de partículas diesel da frota." },
    { selector: '[data-tour="stat"]', title: "Indicadores", body: "Em regeneração, necessárias, interrompidas e DPF saturado." },
    { selector: '[data-tour="ciclo"]', title: "O ciclo", body: "Detecção → aquecimento → queima → conclusão. Interromper o ciclo entope o filtro e leva a derate." },
    { selector: '[data-tour="table"]', title: "Estado por veículo", body: "Nível de fuligem, temperatura, tipo e número de interrupções." },
  ],

  "/app/fretamento/viagens": listSteps({
    header: "Agenda de viagens de fretamento. O botão abre o cadastro de uma nova viagem.",
    hero: "Passageiros e ocupação média da semana.",
    stat: "Em curso, agendadas, concluídas e canceladas.",
    table: "Cada viagem com rota, recurso e ocupação. Clique para abrir.",
  }),

  "/app/fretamento/viagens/nova": [
    { selector: '[data-tour="page-header"]', title: "Nova viagem", body: "Cadastro de uma viagem de fretamento." },
    { selector: 'form .lg\\:grid-cols-\\[1fr_360px\\] > div:first-child', title: "Rota e agenda", body: "Origem, destino, horários e o recurso (veículo + motorista)." },
    { selector: '[data-tour="seatmap"]', title: "Reserva de assentos", body: "Selecione os assentos direto na planta do veículo. Os ocupados ficam bloqueados." },
    { selector: 'form button[type="submit"]', title: "Salvar", body: "Ao salvar, a viagem entra na agenda." },
  ],

  "/app/fretamento/assentos": [
    { selector: '[data-tour="page-header"]', title: "Layout de assentos", body: "Desenhe e pré-visualize a planta de um veículo." },
    { selector: '[data-tour="seatmap"]', title: "Planta do veículo", body: "Clique nos assentos para selecionar. Verde livre, escuro selecionado, cinza ocupado." },
    { selector: 'main .lg\\:grid-cols-\\[1fr_340px\\] > div:last-child', title: "Configuração e ocupação", body: "Ajuste veículo, fileiras e configuração; a ocupação atualiza ao lado." },
  ],

  "/app/fretamento/roteirizacao": [
    { selector: '[data-tour="page-header"]', title: "Roteirização", body: "Planejamento e otimização de rota." },
    { selector: '[data-tour="stat"]', title: "Resumo da rota", body: "Distância, tempo estimado, paradas e veículo." },
    { selector: 'main ol', title: "Sequência de paradas", body: "As paradas em ordem, com horário e trecho. A sugestão de otimização propõe reordenar para economizar tempo." },
    { selector: 'main .lg\\:grid-cols-\\[380px_1fr\\] > div:last-child', title: "Prévia no mapa", body: "A rota desenhada com os marcadores A→B." },
  ],

  "/app/fretamento/passageiros": [
    { selector: '[data-tour="page-header"]', title: "Contagem de passageiros", body: "Embarque e desembarque por parada, dos sensores de porta." },
    { selector: '[data-tour="stat"]', title: "Indicadores", body: "Passageiros, embarques, desembarques, a bordo e ocupação média." },
    { selector: 'main .overflow-x-auto', title: "Fluxo por parada", body: "Barras de embarque (verde) e desembarque (vermelho) por parada, com o total a bordo acumulado." },
    { selector: '[data-tour="table"]', title: "Ocupação por viagem", body: "Pico a bordo e ocupação de cada viagem." },
  ],

  "/app/fretamento/escala": [
    { selector: '[data-tour="page-header"]', title: "Controle de escala", body: "Grade semanal de turnos da equipe." },
    { selector: '[data-tour="hero"]', title: "Panorama", body: "Cobertura da semana e turnos escalados." },
    { selector: '[data-tour="table"]', title: "Grade", body: "Cada célula é um turno (manhã, tarde, noite) ou folga. A legenda explica as cores." },
  ],

  "/app/fretamento/ponto": [
    { selector: '[data-tour="page-header"]', title: "Ponto", body: "Registro de jornada dos motoristas no dia." },
    { selector: '[data-tour="hero"]', title: "Panorama", body: "Jornada média e motoristas escalados." },
    { selector: '[data-tour="stat"]', title: "Indicadores", body: "Presentes, faltas, horas extras e em intervalo." },
    { selector: '[data-tour="table"]', title: "Registros", body: "Entrada, intervalo, saída, horas e situação de cada motorista." },
  ],

  "/app/eventos": [
    { selector: '[data-tour="page-header"]', title: "Eventos do dia", body: "Tudo o que aconteceu na frota hoje, num feed único e de leitura rápida." },
    { selector: '[data-tour="stat"]', title: "Resumo", body: "Total do dia, críticos, eventos de vídeo e quantos ainda não foram vistos." },
    { selector: 'main .rounded-xl.border.bg-card', title: "Filtros", body: "Filtre por veículo, motorista, data e gravidade. Esses filtros são os mesmos em todo o sistema." },
    { selector: 'main .space-y-6 > .rounded-2xl:last-of-type', title: "Feed de eventos", body: "Cada evento traz horário, motorista, veículo, tipo, gravidade e se foi visto. Nos eventos de vídeo (fadiga, celular, distração…), confirme se a IA acertou ou marque como falso positivo." },
  ],

  "/app/estrategico": [
    { selector: '[data-tour="page-header"]', title: "IA Ops Advisor", body: "A Selma — a inteligência que lê a telemetria e te diz o que fazer agora." },
    { selector: '[data-tour="hero"]', title: "Da telemetria à ação", body: "A abertura traz a economia potencial e o número de motoristas para retreinar — a leitura da Selma num relance." },
    { selector: '[data-tour="acoes"]', title: "Ações prioritárias", body: "As ações em ordem de impacto e velocidade de resultado. Cada card traz o porquê, o impacto e o retorno." },
    { selector: '[data-tour="table"]', title: "Motoristas para retreinar", body: "A lista de quem opera abaixo da média, com a ação recomendada para cada um." },
  ],

  "/app/relatorios": [
    { selector: '[data-tour="page-header"]', title: "Relatórios", body: "Central de relatórios do sistema." },
    { selector: 'main section:first-of-type', title: "Catálogo por categoria", body: "Operação, frota, motoristas, fretamento — clique num cartão para gerar o relatório." },
    { selector: '[data-tour="table"]', title: "Gerados recentemente", body: "Histórico dos últimos relatórios, com status e download." },
  ],

  "/app/cadastros/alarme": [
    { selector: '[data-tour="page-header"]', title: "Cadastro de alarme", body: "Crie regras de alerta para a frota." },
    { selector: 'form', title: "Regra de disparo", body: "Escolha o tipo, defina a condição e a que veículos se aplica." },
    { selector: 'form section:last-of-type', title: "Severidade e canais", body: "Peso do alarme e por onde a equipe é avisada (app, e-mail, SMS)." },
    { selector: '[data-tour="table"]', title: "Alarmes configurados", body: "Todas as regras já cadastradas, com status." },
  ],

  "/app/cadastros/cerca": cadastroSteps("cercas eletrônicas", "os perímetros que disparam alerta na entrada, saída ou permanência"),
  "/app/cadastros/combustivel": cadastroSteps("abastecimentos", "os abastecimentos que alimentam consumo, KML e economia"),
  "/app/cadastros/dispositivos": cadastroSteps("dispositivos", "os rastreadores instalados e em estoque"),
  "/app/cadastros/grupos": cadastroSteps("grupos", "os grupos que organizam a frota por operação"),
  "/app/cadastros/unidades": cadastroSteps("unidades", "as filiais da empresa"),
  "/app/cadastros/usuarios": [
    { selector: '[data-tour="page-header"]', title: "Usuários", body: "Quem acessa a plataforma, com qual perfil e sobre quais garagens." },
    { selector: '[data-tour="stat"]', title: "Indicadores", body: "Total de contas, ativas, administradores e último acesso." },
    { selector: '[data-tour="table"]', title: "Contas e escopo", body: "A coluna Escopo mostra sobre quantas garagens cada pessoa enxerga dados. Administrador vê todas; quem está sem garagem não vê veículo nenhum." },
    { selector: '[data-tour="page-header"] button', title: "Criar usuário", body: "No painel lateral você define perfil e marca as garagens do acesso, agrupadas por unidade. Desativar preserva o histórico; excluir remove o registro." },
  ],
};

/**
 * Encontra o tour de um caminho.
 *
 * Rotas com parâmetro (o perfil do motorista, por exemplo) chegam com o valor
 * já preenchido — `/app/motoristas/perfil/Marco%20Taborda` — e nunca casariam
 * numa busca por chave exata. Por isso a segunda passada compara segmento a
 * segmento, tratando `:algo` como curinga.
 */
export function tourDe(pathname: string): TourStep[] {
  const exato = TOURS[pathname];
  if (exato) return exato;

  const partes = pathname.split("/").filter(Boolean);
  for (const [padrao, passos] of Object.entries(TOURS)) {
    const alvo = padrao.split("/").filter(Boolean);
    if (alvo.length !== partes.length) continue;
    const casa = alvo.every((seg, i) => seg.startsWith(":") || seg === partes[i]);
    if (casa) return passos;
  }
  return [];
}
