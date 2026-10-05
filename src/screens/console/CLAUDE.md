# Console de gestão (só SS)

Aberto ao clicar no nome do usuário no rodapé do menu → "Console de gestão"
(só aparece para super admin: `user_mova = 1` ou id em `SS_ADMIN_USER_IDS`).
Moldura: `components/ss/console/ConsoleShell.tsx`.

| Arquivo | Rota | Situação |
|---|---|---|
| `PainelConsole.tsx` | `/console/` | real em parte (contratos vencendo, administradores) |
| `Acessos.tsx` | `/console/acessos` | **real**: quem usa a plataforma, quando e quanto (`/acessos`); robôs e Power BI à parte; uso das telas novas (`/acessos/paginas`) |
| `Administradores.tsx` | `/console/administradores` | qualquer admin adiciona outro; o fundador não pode ser desativado |
| `PerfisAcesso.tsx` | `/console/perfis` | protótipo; os 4 perfis do sistema não se excluem |
| `../Auditoria.tsx` | `/console/auditoria` | quem fez o quê — Auditoria só existe dentro do Console |
| `../ContratosOrganizacao.tsx`, `../CatalogoManutencao.tsx`, `../IndicadoresGerenciais.tsx`, `../ConfiguracoesAdmin.tsx` | `/console/...` | protótipos (selo de exemplo) |

Ficha do backend: `ss-fleet-core/app/api/v1/endpoints/_docs/cliente-e-acesso.md`.
