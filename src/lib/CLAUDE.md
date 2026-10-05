# src/lib e src/hooks — clientes da API, sessão e regras do front

## Base
- `api.ts` — `api.get/post/put/patch/del` (única porta para o backend; passa por `requisicaoAutenticada` de `auth-api.ts`, que põe o Bearer e renova o token). `ApiError(status, mensagem)`. Base = `VITE_API_BASE`. Os objetos antigos (`Motoristas`, `Veiculos`, `Frota`… com `M` de `mock-data.ts`) são do protótipo.
- `modo.ts` — `usandoMock()`: com `VITE_API_BASE` é sempre real. `exemploOuVazio(dados)` devolve o exemplo só em demonstração.
- `session.ts` / `auth-api.ts` — sessão em `sessionStorage` (`ss:sessao`: nome, perfil, `organizacaoAtivaId`…; `ss:auth-tokens`). `Login.tsx` define o perfil (`user_mova` → `super_admin`).
- `escopo-ativo.ts` — `grupoAtivo()` (empresa escolhida no seletor), `filtroGrupo()`, `chaveComGrupo(...)` para a chave do React Query mudar quando troca o cliente. **Toda consulta nova usa o grupo ativo.**
- `permissoes.ts` — `pode(perfil, acao)`, `ehSuperAdmin()`.
- `queries.ts` — `queryOptions` reutilizáveis (`veiculosApiQuery`, `rankingMotoristasQuery`, `equipamentosQuery`…) e `nf()` (número pt-BR). Tracking 404 vira `null`.
- `export.ts` — `exportarCSV(linhas, colunas, nome)`.
- `suporte-api.ts` — `mensagemErro(e)`: transforma `ApiError` (inclusive `detail.message` do 422) em texto para o usuário. Use em todo `toast.error`.

## Um cliente por funcionalidade (`<funcionalidade>-api.ts`)
`cadastros-api.ts` (`CadastrosApi`, `TipoCadastro`, `Registro`, `Opcoes`), `combustivel-api.ts`, `manutencao-api.ts`, `jornada-api.ts`, `escala-api.ts`, `gerencial-api.ts` (`periodoPadrao`), `bi-api.ts`, `relatorios-api.ts` (`useRelatorioCursor`, `baixarCsv`), `relevo-api.ts`, `operacao-api.ts`, `acessos-api.ts`, `ai-fleet-api.ts`, `suporte-api.ts`.
Padrão: tipos TypeScript espelhando a resposta (chaves em português, como o backend devolve) + funções finas; nada de regra de negócio aqui.

## Regras que existem no front (num lugar só)
- `roteirizacao.ts` — otimização da ordem das paradas (vizinho mais próximo + 2-opt, origem/destino fixos).
- `operacao.ts` — `calcularIndicadores`, `resumoViagens`, `dataOperacao` (dia fiscal 03:00–02:59), `variacao`.
- `faixas.ts`, `scoring.ts` — faixas de condução e nota (iguais às do BI).
- `preventiva.ts`, `catalogo-fabricantes.ts`, `dtc.ts`, `padrao-linha.ts`, `projecao-linha.ts` — protótipos de manutenção e linha.
- `cnh.ts` — validação de CNH. `embutido.ts` — `lerEmbutido()` (modo parceiro).
- `suporte-faq.ts` — artigos de ajuda (texto fixo, aprovado pelo PM).

## Hooks (`src/hooks/`)
- `use-assistente.ts` — motor de respostas da Selma (palavras-chave, sem IA). Ver `components/ss/selma/CLAUDE.md`.
- `use-indicadores-bi.ts`, `use-indicadores-veiculo.ts`, `use-resumo-frota.ts`, `use-preventiva-frota.ts`, `use-posicoes-ao-vivo.ts`, `use-sessao.ts`, `use-crud.ts`, `use-mobile.tsx`.
