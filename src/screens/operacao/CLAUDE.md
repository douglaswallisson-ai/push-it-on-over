# Operação urbana — `SinoticoUrbano.tsx`

Aberto por `PainelSinotico.tsx` quando há linhas urbanas (`useLinhasUrbanas`).
Regras: `ss-fleet-core/app/api/v1/endpoints/_docs/operacao-urbano-fretamento.md`.

- Uma régua por linha e sentido (trajeto real de uma viagem recente); ônibus na posição atual; minutos até o carro da frente.
- Pílulas: **colado** (< 50% do intervalo médio), **buraco** (> 150%), fora da rota (> 300 m). Legenda TCQSM e pílula de **regularidade** com o nível de serviço (A–F pelo Cvh).
- Testar com o **Consórcio Fênix 14330**.

O monitor de viagens (programado × realizado) e as viagens produtivas ficam em
`screens/OperacaoLinhas.tsx` (abas; abre na que tem dado para o cliente).
