# Contagem de passageiros — `ContagemReal.tsx`

Aberta por `screens/ContagemPassageiros.tsx` em modo real (Urbano e Fretamento).
Regras: `ss-fleet-core/app/api/v1/endpoints/_docs/passageiros.md`.

- Filtro: período (padrão: últimos 7 dias até ontem; máximo 31).
- Cartões: embarques (e por dia), passageiros diferentes, viagens feitas (média por viagem), fora da lista da viagem, cartão sem cadastro (% das leituras), na lista e não embarcou.
- Abas: **Resumo** (embarques por dia e por hora, pontos com mais embarques; "Fora de ponto cadastrado" em itálico), **Por viagem** (início, linha, tabela e sentido, veículo, motorista, embarques, na lista, ocupação — só com capacidade cadastrada; CSV), **Taxa de frequência** (passageiro × viagem: embarques ÷ viagens feitas; busca, "só quem não embarcou"; CSV), **Cartões sem cadastro**.
- Sem embarques no período (cliente sem validador, ex.: Fênix): aviso explicando, sem números.
- Não mostra "a bordo": a saída do passageiro quase nunca é lida.
