# Roteirização — `RoteirizacaoReal.tsx`

Regras do cálculo: `ss-fleet-core/app/api/v1/endpoints/_docs/escala-e-roteirizacao.md`.

- **Rotas do cliente** (busca no topo): rotas do cadastro (`CadastrosApi.listar("rota")`, `mova.route`, com traçado) + rotas salvas para a escala (`escalaRotasQuery`). Rota do cadastro abre com o traçado real (cor da rota), origem e destino nas pontas e o painel **Dados da rota** (nome, descrição, centro de custo, velocidade máxima, cor → `CadastrosApi.editar("rota")`, provisório). Decisão do PM: a página Rotas saiu, rota vive aqui.
- **Pontos**: da viagem da Escala (`?viagem=ID`), de uma rota, de um POI buscado ou clique no mapa. Subir/descer/remover, minutos parado por ponto, **Otimizar ordem** (`lib/roteirizacao.ts`, origem e destino fixos).
- **Parâmetros**: veículo (km/L real dele), saída, eixos, tarifa por eixo (padrão R$ 8,00 estimado).
- **Cálculo**: `POST /roteirizacao/calcular` com espera de 500 ms a cada mudança; com rota do cadastro manda `trajeto`, `rota_id` e `operacao: "passageiros"`.
- **Resultado**: distância (com a fonte), tempo total (direção + pausas legais + paradas), chegada, combustível, custo (diesel ANP + pedágio), programação da viagem com as pausas da Lei 13.103 e trechos + praças de pedágio.
- **Salvar para a escala**: grava rota padrão em `/escala-viagem/rotas` (a Escala passa a oferecer).
- Mapa: importa `leaflet/dist/leaflet.css`; `Enquadrar` ajusta ao traçado.
- Em modo demonstração a rota usa `RoteirizacaoOtimizada.tsx` (cálculo só no navegador).
