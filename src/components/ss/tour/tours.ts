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
    { selector: '[data-tour="table"]', title: "Registros", body: `Lista completa. Use a busca no topo do quadro para filtrar. Clique numa linha para ver o detalhe.` },
  ];
}

export const TOURS: Record<string, TourStep[]> = {
  "/app": [
    { selector: '[data-tour="sidebar"]', title: "Menu de navegação", body: "Passe o mouse aqui para expandir. Os itens do dia a dia ficam em cima; gestão e configuração, abaixo do divisor." },
    { selector: '[data-tour="page-header"]', title: "Barra da página", body: "Toda tela abre com um título, um resumo do contexto e ações rápidas à direita." },
    { selector: '[data-tour="hero"]', title: "Leitura do dia", body: "A abertura traz a economia gerada, o ROI e o payback — a história de valor da operação num relance." },
    { selector: '[data-tour="stat"]', title: "KPIs operacionais", body: "Cinco números que respondem se o dia está sob controle: veículos ativos, alertas, custo por km, consumo e disponibilidade." },
    { selector: '.pulse-dot', title: "Eventos críticos", body: "O que exige ação imediata aparece destacado, com o ponto pulsante chamando atenção." },
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
    table: "Cada motorista com nota, viagens e premiação. Clique numa linha para abrir o perfil.",
  }),

  "/app/motoristas/novo": [
    { selector: '[data-tour="page-header"]', title: "Novo motorista", body: "Formulário de cadastro dividido em seções." },
    { selector: 'form section:first-child', title: "Identificação", body: "Dados pessoais básicos. Os rótulos ficam sempre visíveis." },
    { selector: 'form', title: "Seções seguintes", body: "Habilitação (CNH), vínculo operacional e telemetria/premiação. As chaves ligam recursos do motorista." },
    { selector: 'form button[type="submit"]', title: "Salvar", body: "Ao salvar, o motorista volta para a lista. No protótipo não há persistência." },
  ],

  "/app/premiacao": [
    { selector: '[data-tour="page-header"]', title: "Premiação", body: "Acompanhamento do programa de bônus dos motoristas." },
    { selector: '[data-tour="hero"]', title: "Total do ciclo", body: "O valor apurado e a performance média da equipe no período." },
    { selector: 'main svg circle', title: "Meta de quilometragem", body: "O anel mostra o quanto da meta de km já foi cumprido." },
    { selector: '[data-tour="table"]', title: "Detalhamento", body: "Cada motorista com nota, viagens e valor. Os ícones geram demonstrativo e relatório de viagens." },
  ],

  "/app/veiculos": listSteps({
    header: "Cadastro e situação da frota. O botão abre o cadastro de um novo veículo.",
    hero: "Em rota agora e KML médio da frota.",
    stat: "Em rota, parados, em manutenção e sem sinal.",
    table: "Cada veículo com operação, situação, consumo e odômetro.",
  }),

  "/app/frota/analise": [
    { selector: '[data-tour="page-header"]', title: "Análise individual", body: "Desempenho detalhado de um veículo no período." },
    { selector: '[data-tour="hero"]', title: "Veículo em foco", body: "Troque o veículo no seletor. Ao lado, velocidade média e média do bordo." },
    { selector: '[data-tour="score"]', title: "Nota de desempenho", body: "O velocímetro traz a nota consolidada e a tendência dos últimos dias." },
    { selector: '[data-tour="accel"]', title: "Pressão do acelerador", body: "Distribui a condução em ideal, atenção e crítico — a base da economia." },
  ],

  "/app/frota/posicionamento": [
    { selector: '[data-tour="page-header"]', title: "Posicionamento", body: "Retrato da posição atual de cada veículo (último sinal)." },
    { selector: '[data-tour="hero"]', title: "Panorama", body: "Quantos em movimento, parados e a hora da última atualização." },
    { selector: 'main .lg\\:grid-cols-\\[1fr_360px\\]', title: "Mapa e resumo", body: "Marcadores no mapa e um resumo por status ao lado." },
    { selector: '[data-tour="table"]', title: "Posições", body: "Endereço, ignição e horário do último sinal por veículo." },
  ],

  "/app/frota/motor-parado": [
    { selector: '[data-tour="page-header"]', title: "Motor ligado parado", body: "Marcha lenta ociosa — combustível gasto sem rodar." },
    { selector: '[data-tour="hero"]', title: "O desperdício", body: "Quanto a frota queimou em R$ e litros nesta semana." },
    { selector: '[data-tour="stat"]', title: "Indicadores", body: "Tempo ocioso, litros, custo e o CO₂ que dava para evitar." },
    { selector: '[data-tour="table"]', title: "Ranking", body: "Os maiores tempos parados, com a tendência de cada veículo." },
  ],

  "/app/frota/manutencao": [
    { selector: '[data-tour="page-header"]', title: "Manutenção", body: "Inspeção visual do veículo e predições de manutenção." },
    { selector: '[data-tour="score"]', title: "Índice de saúde", body: "A nota geral do veículo, calculada a partir dos componentes." },
    { selector: '[data-tour="bus"]', title: "Inspeção visual", body: "Cada ponto na foto é um componente com sua leitura. O óleo, em vermelho e pulsando, está crítico. Clique num ponto para ver o detalhe e a recomendação." },
    { selector: '[data-tour="predicoes"]', title: "Predições e riscos", body: "O que precisa de manutenção, quando e quanto custa — e os fatores que puxam a nota para baixo." },
  ],

  "/app/frota/regeneracao": [
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
    { selector: '[data-tour="page-header"]', title: "IA Fleet Manager", body: "A Selma — a inteligência que lê a telemetria e te diz o que fazer agora." },
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
  "/app/cadastros/usuarios": cadastroSteps("usuários", "quem acessa a plataforma e com qual perfil"),
};
