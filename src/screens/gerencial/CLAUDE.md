# Gerencial — páginas do Power BI e do Dashboard Start

Container: `screens/RelatoriosGerenciais.tsx` (menu de páginas à esquerda,
filtros iguais em todas: período, garagem, placa, condutor; período padrão
"últimos 30 dias" até o dia 7 do mês — `periodoPadrao()` em `lib/gerencial-api.ts`).
Regras: `ss-fleet-core/app/api/v1/endpoints/_docs/gerencial-e-bi.md`.

| Arquivo | Página | Fonte |
|---|---|---|
| `Comparativo.tsx` | período × anterior em cartões (variação colorida pelo sentido bom) | `gerencial/serie-diaria` |
| `Conducao.tsx` | ranking de condução (velocímetros das faixas × metas, pódio), análise por evento, pontuação, evolução | `bi`, `driver-ranking`, `gerencial` |
| `Seguranca.tsx` | gestão de eventos: matriz dia × hora, evolução, placas e condutores | `bi/eventos` |
| `Operacao.tsx` | parado ligado (local, placa, condutor, hora, dia), combustível | `bi/parado`, `gerencial/ocioso` |
| `Relevo.tsx` | subida/descida por veículo e motorista × consumo; faixas plano/ondulado/montanhoso/serra | `relevo/resumo` |
| `Qualidade.tsx` | não identificado, coluna "Verificar" do BI, saúde da frota, faixas a recalibrar | `bi/nao-identificado`, `fleet-health` |
| `pecas.tsx` | peças visuais (indicador com explicação, número animado, velocímetro, matriz de calor, barras) | — |

Instrutor e função (filtros do Power BI) ficam de fora: não há o vínculo no sistema novo.
Faixa vermelha é pequena mas real — mostrar com casas decimais (`hooks/use-indicadores-bi.ts`).
