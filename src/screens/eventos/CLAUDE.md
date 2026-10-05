# Eventos — `TimelineEventos.tsx`

Usada dentro de `screens/Eventos.tsx` (Segurança › Eventos). Regras:
`ss-fleet-core/app/api/v1/endpoints/_docs/tracking-e-timeline.md` e `eventos-e-video.md`.

- Um veículo (ou motorista) por vez: à esquerda quem mais precisa de atenção, à direita a linha do tempo — barra das viagens e uma faixa por tipo de evento no minuto em que aconteceu (feedback do PM: a frota inteira de uma vez virava ruído).
- Marcas técnicas do equipamento não aparecem; cores por gravidade (críticos, leves).
- A lista de eventos de `Eventos.tsx` mostra 40 e carrega mais 60 por vez.
