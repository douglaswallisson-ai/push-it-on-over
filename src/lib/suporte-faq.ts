/**
 * Dúvidas frequentes do Suporte.
 *
 * As regras vêm do vault "Sistema SS" (nota indicada em `fonte`); o caminho
 * de tela é o da plataforma nova. Quando a resposta não resolve, o botão
 * "Abrir chamado" já sugere o `servico` (o mesmo nome da lista do Zendesk).
 */

export type PoseSelma = "boas-vindas" | "explicando" | "dica" | "pensando" | "preocupada";

export type Duvida = {
  id: string;
  categoria: CategoriaFaq;
  pergunta: string;
  /** Parágrafos curtos; linhas começando com "• " viram lista. */
  resposta: string[];
  tela?: { rotulo: string; to: string };
  servico?: string;
  palavras?: string;
  fonte?: string;
};

export type CategoriaFaq =
  | "Acesso e usuários"
  | "Mapa e percurso"
  | "Cadastros"
  | "Indicadores"
  | "Relatórios"
  | "Alarmes"
  | "Chamados";

export const CATEGORIAS_FAQ: { nome: CategoriaFaq; dica: string }[] = [
  { nome: "Acesso e usuários", dica: "senha, permissões, grupos" },
  { nome: "Mapa e percurso", dica: "posição, sinal, trajeto" },
  { nome: "Cadastros", dica: "cercas, pontos, motoristas" },
  { nome: "Indicadores", dica: "saúde da frota, faixas, ROI" },
  { nome: "Relatórios", dica: "períodos, exportação, consumo" },
  { nome: "Alarmes", dica: "regras e avisos por e-mail" },
  { nome: "Chamados", dica: "acompanhar e anexar" },
];

export const DUVIDAS: Duvida[] = [
  // ---------------------------------------------------------------- Acesso
  {
    id: "nao-vejo-veiculo",
    categoria: "Acesso e usuários",
    pergunta: "Não estou vendo um veículo ou um grupo que deveria ver",
    resposta: [
      "O que cada pessoa vê depende dos grupos e subgrupos liberados no cadastro dela. Se um grupo não foi marcado, os veículos dele não aparecem em nenhuma tela.",
      "Peça ao administrador da sua empresa para abrir Cadastros › Usuários, escolher o seu nome e marcar o grupo ou subgrupo na árvore de acessos.",
      "Só aparecem na árvore os grupos que têm pelo menos um subgrupo.",
    ],
    tela: { rotulo: "Abrir Usuários", to: "/app/cadastros/usuarios" },
    servico: "Alteração de Grupo/Subgrupo",
    palavras: "sumiu veiculo grupo subgrupo acesso permissão não aparece",
    fonte: "Regras-de-Negocio/hierarquia-grupo-subgrupo-acesso",
  },
  {
    id: "senha",
    categoria: "Acesso e usuários",
    pergunta: "Esqueci minha senha. Como recebo uma nova?",
    resposta: [
      "A senha é gerada pelo sistema e enviada para o seu e-mail cadastrado.",
      "O administrador da sua empresa pode usar \"Resetar senha\" em Cadastros › Usuários. Uma nova senha chega no seu e-mail na hora.",
      "Se você não tem administrador ou o e-mail não chega, abra um chamado que o Suporte faz o reset.",
    ],
    servico: "Suporte - Reset de senha do usuário",
    palavras: "senha esqueci login entrar bloqueado reset",
    fonte: "Telas/Usuarios",
  },
  {
    id: "criar-usuario",
    categoria: "Acesso e usuários",
    pergunta: "Como criar um acesso para alguém da minha equipe?",
    resposta: [
      "Vá em Cadastros › Usuários e clique em adicionar. Nome, login e e-mail são obrigatórios.",
      "• O login precisa ser único em todo o sistema, não só na sua empresa.",
      "• Marque pelo menos uma tela que a pessoa pode usar. Sem isso o cadastro não é salvo.",
      "• Para ir mais rápido, use \"Carregar permissões de um usuário\". Ele copia telas, grupos e restrições de alguém que já tem o mesmo papel.",
      "• Dá para limitar horário, dias da semana e uma data final de acesso, por exemplo para um temporário.",
      "A senha é gerada pelo sistema e enviada para o e-mail da pessoa.",
    ],
    tela: { rotulo: "Abrir Usuários", to: "/app/cadastros/usuarios" },
    servico: "Suporte - Criação de usuário",
    palavras: "novo usuário criar acesso equipe login permissão",
    fonte: "Telas/Usuarios",
  },
  {
    id: "trocar-empresa",
    categoria: "Acesso e usuários",
    pergunta: "Tenho acesso a mais de uma empresa. Como troco?",
    resposta: [
      "Use o seletor de empresa no topo do menu lateral. Todas as telas passam a mostrar os dados da empresa escolhida.",
    ],
    palavras: "empresa organização trocar cliente outra conta",
  },

  // ---------------------------------------------------------------- Mapa
  {
    id: "sem-sinal",
    categoria: "Mapa e percurso",
    pergunta: "O veículo aparece como \"sem sinal recente\". O que significa?",
    resposta: [
      "O equipamento do veículo não envia posição há algum tempo. Até 1 hora sem sinal, a comunicação é considerada normal. Até 24 horas, fica em atenção. Mais que isso, aparece como sem comunicação.",
      "Isso pode ser normal: veículo desligado na garagem, em área sem cobertura de celular ou em manutenção.",
      "Se o veículo está rodando e mesmo assim não atualiza, abra um chamado para o Suporte verificar o equipamento.",
    ],
    tela: { rotulo: "Abrir Mapa ao vivo", to: "/app/mapa" },
    servico: "Equipamento sem transmissão",
    palavras: "sem sinal transmissão offline não atualiza parado comunicação",
  },
  {
    id: "sem-gps",
    categoria: "Mapa e percurso",
    pergunta: "O mapa diz que há veículos sem posição de GPS",
    resposta: [
      "Esses veículos estão na lista, mas o último sinal veio sem coordenada válida. Por isso não aparecem no mapa.",
      "Se acontecer sempre com o mesmo veículo, o GPS do equipamento pode estar travado. Abra um chamado indicando a placa.",
    ],
    servico: "Problema - Travamento de GPS",
    palavras: "gps sem posição coordenada localização mapa",
  },
  {
    id: "cercas-no-mapa",
    categoria: "Mapa e percurso",
    pergunta: "Como vejo as cercas e os pontos de interesse no mapa?",
    resposta: [
      "No canto superior direito de qualquer mapa há os botões \"Cercas\" e \"Pontos (POIs)\". Clique para mostrar ou esconder cada um. O sistema lembra a sua escolha.",
      "Com o mapa muito afastado, as formas não são desenhadas. Aproxime o zoom na região que quer ver.",
      "Passe o mouse sobre uma cerca para ver o nome e a velocidade máxima.",
    ],
    tela: { rotulo: "Abrir Mapa ao vivo", to: "/app/mapa" },
    palavras: "cerca poi ponto interesse mapa mostrar camada",
  },
  {
    id: "percurso",
    categoria: "Mapa e percurso",
    pergunta: "Como vejo o caminho que um veículo fez no dia?",
    resposta: [
      "Abra Frota › Percurso do dia, escolha o veículo e a data. O traçado aparece no mapa.",
      "Os eventos (freada brusca, excesso de velocidade etc.) aparecem no ponto exato onde aconteceram. Abaixo do mapa fica o perfil de elevação do trajeto.",
    ],
    tela: { rotulo: "Abrir Percurso do dia", to: "/app/frota/tracking" },
    palavras: "trajeto percurso caminho rota histórico tracking dia",
  },

  // ---------------------------------------------------------------- Cadastros
  {
    id: "cadastrar-cerca",
    categoria: "Cadastros",
    pergunta: "Como cadastrar uma cerca?",
    resposta: [
      "Em Cadastros › Cerca, desenhe a área no mapa. O tipo é definido pela ferramenta de desenho: círculo, quadrado, polígono ou vetor (um trajeto com largura de 15, 25 ou 50 metros).",
      "• Nome, grupo e categoria são obrigatórios.",
      "• O nome não aceita acentos nem caracteres especiais.",
      "• O polígono aceita até 31 pontos e o vetor até 32.",
      "• A velocidade máxima da cerca vai de 0 a 300 km/h.",
      "• Cercas circulares não podem ser gravadas no equipamento (embarcadas).",
    ],
    tela: { rotulo: "Abrir Cerca", to: "/app/cadastros/cerca" },
    servico: "Configuração - Ajuste de Cercas",
    palavras: "cerca criar desenhar área geofence polígono",
    fonte: "Telas/Cerca",
  },
  {
    id: "cadastrar-poi",
    categoria: "Cadastros",
    pergunta: "Como cadastrar um ponto de interesse (POI)?",
    resposta: [
      "Em Cadastros › Pontos e cercas, informe o nome e marque o local clicando no mapa ou buscando pelo endereço.",
      "• O raio padrão é 50 metros e pode ir de 10 a 5.000.",
      "• Grupo e categoria são obrigatórios.",
      "• O nome não pode ter aspas nem o caractere |.",
    ],
    tela: { rotulo: "Abrir Pontos e cercas", to: "/app/cadastros/pontos-interesse" },
    palavras: "poi ponto interesse local cliente garagem cadastrar",
    fonte: "Telas/POI",
  },
  {
    id: "cadastrar-motorista",
    categoria: "Cadastros",
    pergunta: "Como cadastrar um motorista?",
    resposta: [
      "Vá em Pessoas › Motoristas e adicione. Em geral são obrigatórios: nome, e-mail, telefone, tipo de identificação, CNH (número, categoria e validade) e grupo. Algumas empresas têm campos a mais.",
      "Tipos de identificação no veículo: só matrícula, matrícula com senha, iButton, CPF, cartão RFID ou só senha. Quando há senha gerada, ela é criada pelo sistema.",
      "• A matrícula não pode começar com zero.",
      "• Não é possível cadastrar duas vezes a mesma CNH.",
    ],
    tela: { rotulo: "Abrir Motoristas", to: "/app/motoristas" },
    servico: "Suporte - Cadastro de motorista",
    palavras: "motorista condutor cadastrar cnh matrícula cartão rfid ibutton",
    fonte: "Telas/Motorista",
  },
  {
    id: "nao-identificado",
    categoria: "Cadastros",
    pergunta: "Por que aparecem viagens com motorista \"Não identificado\"?",
    resposta: [
      "O veículo rodou sem que o motorista se identificasse no equipamento: não passou o cartão, não digitou a matrícula ou o cadastro dele não está no veículo.",
      "Quando mais de 60% das horas de um veículo ficam sem motorista, a Saúde da frota avisa \"% Não Informado Alto\".",
      "Confira se o motorista está cadastrado e associado ao veículo. Se ele se identifica e mesmo assim não aparece, abra um chamado.",
    ],
    tela: { rotulo: "Ver no Gerencial", to: "/app/gerencial#nao-identificado" },
    servico: "Problema - Falha na Autenticação de motorista",
    palavras: "não identificado não informado sem motorista autenticação cartão",
    fonte: "Regras-de-Negocio/saude-da-frota-cascata",
  },

  // ---------------------------------------------------------------- Indicadores
  {
    id: "saude-frota",
    categoria: "Indicadores",
    pergunta: "O que é a \"Saúde da frota\"?",
    resposta: [
      "Não é manutenção. Mede a qualidade do sinal e da condução: a porcentagem de veículos que não dispararam nenhum alerta.",
      "Cada veículo passa por uma lista de verificações, na ordem. O primeiro problema encontrado é o motivo exibido, por exemplo \"Verificar Telemetria\", \"Verificar Faixa Vermelha\" ou \"Verificar Informação de Odômetro\".",
      "O veículo só é avaliado se trabalhou mais de 1 hora e rodou mais de 1 km. O cálculo usa o último dia com dados, não o dia de hoje.",
    ],
    tela: { rotulo: "Abrir Início", to: "/app" },
    palavras: "saúde frota saudável alerta verificar indicador",
    fonte: "Regras-de-Negocio/saude-da-frota-cascata",
  },
  {
    id: "faixas",
    categoria: "Indicadores",
    pergunta: "O que são as faixas de condução (verde, amarela, vermelha…)?",
    resposta: [
      "O tempo de uso de cada veículo é dividido em faixas. Elas formam dois grupos:",
      "• Ideal: verde, extra econômica, inércia, eco-roll (roda livre) e baixa velocidade.",
      "• Irregular: amarela, vermelha, batendo transmissão, movimento sem tração (banguela), parado acelerando, tolerância, parado com motor ligado e parado com motor ligado produtivo.",
      "Ideal + irregular somam 100% do tempo medido nas faixas. Cada faixa tem meta e peso, que alimentam a pontuação do motorista.",
    ],
    tela: { rotulo: "Abrir Gerencial", to: "/app/gerencial" },
    servico: "Configuração - Ajuste de Faixas",
    palavras: "faixa verde amarela vermelha banguela inércia rpm condução",
    fonte: "Regras-de-Negocio/13-faixas-fleet-insights",
  },
  {
    id: "metas-pesos",
    categoria: "Indicadores",
    pergunta: "Como mudo as metas e os pesos das faixas?",
    resposta: [
      "Em Premiação › Metas e pesos, escolha o subgrupo. Para cada faixa há uma meta e um peso, que valem para todos os veículos daquele subgrupo.",
    ],
    tela: { rotulo: "Abrir Metas e pesos", to: "/app/premiacao/metas" },
    servico: "Configuração - Pesos e Metas",
    palavras: "meta peso pontuação premiação faixa subgrupo",
    fonte: "Telas/Metas-e-Pesos",
  },
  {
    id: "roi-payback",
    categoria: "Indicadores",
    pergunta: "Como são calculados o ROI e o payback da tela Início?",
    resposta: [
      "Economia do mês = litros consumidos nos últimos 30 dias × custo do litro × redução estimada do seu contrato.",
      "• ROI = economia do mês ÷ mensalidade.",
      "• Payback = custo total do contrato (todas as mensalidades + implantação) ÷ economia do mês. Mostra em quantos meses a economia paga o contrato inteiro.",
      "Se algum número do contrato estiver diferente do combinado, abra um chamado no assunto financeiro.",
    ],
    tela: { rotulo: "Abrir Início", to: "/app" },
    servico: "Administrativo e Financeiro",
    palavras: "roi payback economia retorno contrato mensalidade",
  },
  {
    id: "co2",
    categoria: "Indicadores",
    pergunta: "Como funciona o certificado de CO₂ reduzido?",
    resposta: [
      "Comparamos o km/l do período com o mesmo período do ano anterior. Os litros que deixaram de ser gastos viram CO₂ evitado: cada litro de diesel equivale a 3,21 kg de CO₂.",
      "O certificado só é emitido quando houve melhora e o período de comparação tem dados em pelo menos 80% dos dias.",
      "O certificado mostra redução medida. Não é um selo de neutralidade de carbono.",
    ],
    tela: { rotulo: "Abrir Emissão de CO₂", to: "/app/co2" },
    palavras: "co2 carbono certificado emissão sustentabilidade",
    fonte: "BI/Power-BI",
  },
  {
    id: "relevo",
    categoria: "Indicadores",
    pergunta: "Por que alguns veículos não mostram relevo (elevação)?",
    resposta: [
      "O relevo usa a altitude enviada pelo equipamento. Só alguns modelos de equipamento enviam essa informação. Nos outros, a coluna fica vazia.",
      "O número principal é a subida acumulada a cada 100 km: quanto maior, mais serra no trajeto, e isso pesa no consumo.",
    ],
    tela: { rotulo: "Abrir Gerencial", to: "/app/gerencial#relevo" },
    palavras: "relevo elevação altitude serra subida",
  },

  // ---------------------------------------------------------------- Relatórios
  {
    id: "periodo-relatorio",
    categoria: "Relatórios",
    pergunta: "Qual o período máximo de um relatório?",
    resposta: [
      "A maioria dos relatórios aceita até 93 dias por consulta. O histórico de posições aceita até 31 dias.",
      "Para períodos maiores, faça consultas em partes. Também dá para baixar cada parte em CSV e juntar numa planilha.",
    ],
    tela: { rotulo: "Abrir Relatórios", to: "/app/relatorios" },
    servico: "Solicitação de relatório",
    palavras: "relatório período dias máximo limite demora exportar csv",
  },
  {
    id: "consumo-errado",
    categoria: "Relatórios",
    pergunta: "O consumo (km/l) ou o km do veículo parece errado",
    resposta: [
      "O consumo depende de um fator de calibração do equipamento, e o km depende do odômetro. Quando um deles falha, o km/l fica irreal ou o odômetro para de subir.",
      "O Suporte consegue sugerir um novo fator de consumo e corrigir odômetro travado. Abra um chamado com a placa e o período em que notou o problema.",
    ],
    servico: "Ajuste no Consumo CAN",
    palavras: "consumo km/l litro errado odômetro travado km calibração",
    fonte: "Telas/Calibracao-do-Fator-de-Consumo",
  },

  // ---------------------------------------------------------------- Alarmes
  {
    id: "alarme-email",
    categoria: "Alarmes",
    pergunta: "Como criar um alarme e receber por e-mail?",
    resposta: [
      "Em Cadastros › Alarme, dê um nome, escolha o grupo e monte a regra em \"Disparar alarme quando\".",
      "• Nível crítico: baixo, médio ou alto.",
      "• \"Exibir no Monitor de Alarmes\" e \"Enviar por e-mail\" já vêm marcados.",
      "• Para vários e-mails, separe com ponto e vírgula (;).",
      "• Em Descrição, escreva o procedimento que a equipe deve seguir quando o alarme tocar.",
      "Depois, associe os veículos que o alarme deve vigiar.",
    ],
    tela: { rotulo: "Abrir Alarme", to: "/app/cadastros/alarme" },
    servico: "Plataforma - Falha no Alarme",
    palavras: "alarme aviso alerta email notificação regra",
    fonte: "Telas/Alarmes",
  },

  // ---------------------------------------------------------------- Chamados
  {
    id: "acompanhar-chamado",
    categoria: "Chamados",
    pergunta: "Como acompanho um chamado que abri?",
    resposta: [
      "Na aba \"Meus chamados\" aparecem os chamados dos últimos 3 meses. Clique em um para ver as respostas do Suporte.",
      "• Novo: chegou e ainda não foi lido.",
      "• Em atendimento: alguém do Suporte está cuidando.",
      "• Aguardando você: o Suporte precisa de uma informação sua.",
      "• Resolvido: o Suporte concluiu. Se não ficou bom, abra um novo chamado citando o número.",
    ],
    palavras: "chamado ticket acompanhar status resposta zendesk",
  },
  {
    id: "anexos",
    categoria: "Chamados",
    pergunta: "Posso mandar print ou arquivo no chamado?",
    resposta: [
      "Pode e ajuda muito. São aceitos imagem (print da tela), PDF, Word, Excel, CSV e texto, até 10 MB.",
      "Dica: um print com a placa, a data e a tela onde viu o problema economiza várias trocas de mensagem.",
    ],
    palavras: "anexo print arquivo imagem foto pdf",
  },
];

/** Busca simples: todas as palavras digitadas precisam aparecer (sem acento). */
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function buscarDuvidas(termo: string, lista = DUVIDAS): Duvida[] {
  const partes = semAcento(termo).split(/\s+/).filter((p) => p.length > 1);
  if (!partes.length) return lista;
  return lista
    .map((d) => {
      const alvo = semAcento([d.pergunta, d.palavras ?? "", d.resposta.join(" "), d.categoria].join(" "));
      const titulo = semAcento(d.pergunta);
      const ok = partes.every((p) => alvo.includes(p));
      const pontos = partes.reduce((s, p) => s + (titulo.includes(p) ? 2 : 0) + (alvo.includes(p) ? 1 : 0), 0);
      return { d, ok, pontos };
    })
    .filter((x) => x.ok)
    .sort((a, b) => b.pontos - a.pontos)
    .map((x) => x.d);
}
