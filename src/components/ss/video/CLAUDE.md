# components/ss/video — vídeo embarcado

| Arquivo | O que é |
|---|---|
| `AoVivo.tsx` | protótipo do monitoramento ao vivo (só no modo exemplo) |
| `AoVivoReal.tsx` | ao vivo com as câmeras reais — cópia da "Vídeos Online" da plataforma de câmeras |
| `PlayerAoVivo.tsx` | player: FLV (JIMI) com mpegts.js, HLS (Hikvision) com hls.js, carregados sob demanda |
| `Gravacoes.tsx` | gravações |

Regras do ao vivo (backend: `ss-fleet-core/app/api/v1/endpoints/cameras.py`):

- dados vêm de `lib/cameras-api.ts` (`camerasQuery`, `Cameras.abrir`); o navegador nunca
  fala direto com JIMI/Hikvision — as chaves ficam no `.env` do backend;
- canal só abre por clique do operador, no máximo 4 ao mesmo tempo (dados do chip);
- botão desabilitado diz o porquê (sem veículo, modelo sem ao vivo, offline, ignição desligada);
- erro do player → até 3 reaberturas (2 s, 4 s, 6 s), depois "Tentar de novo";
- trocar de veículo fecha todos os canais;
- `online: null` = não deu para consultar (proxy fora do ar) — mostrar "Status desconhecido",
  nunca "Offline".