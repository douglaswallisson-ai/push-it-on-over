# Relatórios de frota — `RelatoriosFrota.tsx`

Aberto pela central (`screens/Relatorios.tsx`): o cartão do catálogo tem
`embutido: "frota"` e `abaFrota: <aba>`; o botão "Voltar" volta à central.
Regras de cada relatório: `ss-fleet-core/app/api/v1/endpoints/_docs/relatorios-frota.md`.

| Aba (`AbaFrota`) | Endpoint | Filtros | Período máx. |
|---|---|---|---|
| `paradas` — Paradas e deslocamentos | `paradas-deslocamentos` | veículo, tipo, duração mínima | 31 dias |
| `consolidado` | `paradas-deslocamentos` (campo `consolidado`) | veículo, duração mínima | 31 |
| `paradas-poi` — Paradas em pontos | `paradas-poi` | veículo, duração mínima | 31 |
| `passagem-poi` — Passagem por pontos | `passagem-poi` | veículo, distância do ponto | 7 |
| `cercas` | `cercas` | veículo | 31 |
| `distancia` — Distância e horímetro | `distancia-horimetro` | veículo, "somar por semana" (seg–dom, no front) | 31 |
| `sla` — SLA de paradas | `sla-paradas` | — | 31 |
| `configuracoes` — Configurações do veículo | `configuracoes` | veículo (filtro no front) | sem período |
| `odometro` — Odômetro travado | `odometro-travado` | — | últimas 24 h |

Padrões da tela: um `ABAS` com `maxDias` (0 = sem período); trocar de aba
encurta o período se passar do máximo; colunas e CSV declarados por aba
(`colunas`, `csv.cab`, `csv.lin`); totais no cabeçalho do cartão; aviso quando
`cortado` (5.000 linhas); notas explicando a regra abaixo da tabela; valores
descartados aparecem num aviso, nunca somados.

Relatório novo = endpoint no backend + entrada em `ABAS` + bloco de colunas +
cartão no `CATALOGO` de `Relatorios.tsx` (`embutido: "frota"`, `abaFrota`).
