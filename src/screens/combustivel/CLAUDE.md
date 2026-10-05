# Controle de combustível — `ControleCombustivel.tsx`

Cópia da tela "Controle de Combustível V2" do time de TI (mesmas abas, colunas,
alertas e textos), a pedido do PM. Regras: `ss-fleet-core/app/api/v1/endpoints/_docs/combustivel.md`.
Cliente da API: `lib/combustivel-api.ts` (`CombustivelApi`).

- Abas: **Painel** (litros, km/L do período sem ciclos com erro, custo/km por ciclo, ranking de veículos), **Alertas** (verificar / desfazer), **Pendências** (cartão que não virou abastecimento: resolver ligando a um veículo, ou descartar), **Postos**, **Sem abastecimento**, **Veículo** (ciclos, histórico, perfil de tanque e faixa de km/L).
- Prop `abaInicial`: `/app/frota/combustivel` abre no Painel; `/app/cadastros/combustivel` abre em Postos.
- Lançamento manual com km sugerido pelo rastreador; integração (cartão) só edita km, tanque cheio, motorista e observação.
- Tudo o que se grava é provisório (selo na linha). Importação por planilha em `POST /combustivel/planilha`.
- Testar com **RCA 15092** (tem dados de abastecimento).
