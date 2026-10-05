# IA Ops Advisor — `PainelReal.tsx`

Usado por `screens/IAFleetManager.tsx` em modo real. Nada é calculado aqui:
valores, metas, vereditos e listas vêm prontos das funções `fleet_mvp.*` do
worker de insights (`/ai-fleet/painel`). Ficha: `ss-fleet-core/app/api/v1/endpoints/_docs/ia-ops-advisor.md`.

- Filtros: conta/grupo (`/ai-fleet/contas`), período (máx. 92 dias), comparação com a mesma janela 3 meses antes.
- Sem permissão do banco nos esquemas `fleet_mvp`/`fleet_ai` a API responde 503 e a tela mostra o motivo.
- Não é a Selma (assistente de conversa) — ver `components/ss/selma/CLAUDE.md`.
