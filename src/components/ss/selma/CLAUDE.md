# Selma — assistente de conversa (ícone no canto inferior direito)

## Como está hoje (04/10/2026)
- `SelmaLauncher.tsx` — o orb no canto; abre o chat com saudação, sugestões
  (`SUGESTOES_ASSISTENTE`), atalho para refazer o tour da tela e link para a
  tela cheia (`/app/assistente`, `screens/AssistenteDados.tsx`). Escondido no
  modo embutido.
- `hooks/use-assistente.ts` — **motor de respostas sem IA**: procura palavras
  na pergunta ("resumo", "pneu", "programação", "multa", "manutenção",
  "segurança", "linha") e monta o texto com os dados já carregados no
  navegador. Fora dessas palavras responde que não sabe. A regra de conduta já
  está certa: sem dado, diz que não tem, em vez de estimar.
- Limitações: vários tópicos usam fontes de protótipo (pneus, multas, ordens);
  não conhece Combustível, Jornada, Cadastros, Relatórios, Roteirização nem
  Passageiros; não tem memória da conversa nem backend; não respeita escopo
  além do que a tela já carregou.

## O que falta para ligar uma IA de verdade (plano proposto, a validar com a engenharia)
1. **Backend** `POST /assistente/perguntar` (`ss-fleet-core`): recebe a pergunta,
   o histórico curto e a tela atual; chama o modelo (Claude) com **ferramentas**
   que são as rotas de leitura que já existem (painel de combustível, jornada,
   relatórios de frota, contagem de passageiros, ranking, manutenção, eventos…),
   sempre com o `group_id` e as permissões do usuário logado.
2. **Conhecimento das regras**: os `CLAUDE.md` e as fichas `_docs/*.md` viram o
   texto de referência do assistente (como cada número é calculado, o que é
   SUPOSIÇÃO, o que não existe). Assim ele explica a regra e não inventa.
3. **Regras de conduta no prompt**: responder só com dado devolvido pelas
   ferramentas, citar a tela de origem, dizer quando não há dado, nunca executar
   gravação nem comando.
4. **Front**: `useAssistente().responder` passa a chamar o backend (resposta em
   streaming); nenhuma das duas telas precisa mudar de layout.
5. **Decisões da engenharia**: chave/conta do modelo (API da Anthropic ou
   Bedrock na AWS), onde guardar o histórico e o registro das perguntas,
   limite de custo por cliente.
