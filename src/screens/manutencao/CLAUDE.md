# Manutenção — `ManutencaoReal.tsx`, `RelatorioVeiculo.tsx`

Aberta por `Manutencao.tsx` (painel) e `routes/app.manutencao.ordens.tsx`
(`abaInicial` corretiva). Regras e limites:
`ss-fleet-core/app/api/v1/endpoints/_docs/manutencao.md`. Cliente: `lib/manutencao-api.ts`.

- **Painel**: cada veículo com odômetro e horímetro reais, situação dos itens do plano (vencido, vence em breve, em dia, sem registro) e alertas dos sinais do motor.
- **Preventiva**: o cliente cria planos por tipo, modelo ou veículo a partir dos modelos sugeridos; item vence por km, dias e/ou horas; registrar serviço feito (com km e horímetro).
- **Corretiva**: alerta automático → ordem de serviço (aberta, em andamento, aguardando peça, concluída, cancelada); também abre à mão.
- **Inspeção do veículo** (`components/ss/frota/InspecaoVeiculo.tsx`): sinais com a referência Cummins; óleo 0 = sem sensor; tensão do alternador.
- **Relatório do veículo**: tudo da última leitura + plano + OS + histórico + observação; "Imprimir / salvar em PDF" pela impressão do navegador.
- Gravação provisória (selo).
