# src/components/ss — componentes da marca

## layout/
- `AppShell.tsx` — moldura de `/app/*`: `Sidebar`, `BuscaGlobal`, `SelmaLauncher`, `RegistroPaginas` (manda cada página aberta para `/acessos/registro`). Sem faixa de "base do cliente" (o PM achou horrível; `ContextoOrganizacao.tsx` ficou sem uso).
- `Sidebar.tsx` — o menu. Estrutura: `NAV` (grupos com `items: SubItem[]` = `{ label, to, beta? }` e `modulo?: "urbano" | "fretamento"`) e `NAV_SECONDARY` (CO₂, Suporte). Grupos com `modulo` só aparecem se `/cliente/modulos` liga o segmento. Rodapé: clicar no nome abre o menu do usuário com "Console de gestão" (só super admin). Ordem e rótulos são decisão do PM (ver `CLAUDE.md` da raiz) — **adicionar itens sem renomear os existentes**.
- `PageHeader.tsx` — título, subtítulo, logo do cliente (`/cliente/logo`) e botão "Buscar Ctrl K" (dispara `ss:abrir-busca`).
- `BuscaGlobal.tsx` — busca de telas/veículos/motoristas (Ctrl K), sem botão flutuante.
- `OrgSwitcher.tsx` — troca o cliente (grava `organizacaoAtivaId` na sessão); as consultas mudam porque a chave do cache inclui o grupo (`chaveComGrupo`).
- `PonteEmbutido.tsx` — conversa com o parceiro no modo embutido.

## ui/
- `data.tsx` — `Card` (título, ícone, `action`), `StatTile` (ícone, rótulo, valor, `unit`, `foot`, `color`), `Pill` (tons `green | sky | gold | coral | neutral`), `Dot`, `DataTable` (colunas `{ key, header, align, render }`, paginação `porPagina = 50`, `0` desliga, `empty`), `FilterBar`, `FilterChip`.
- `QueryState.tsx` — `ErrorBox`, `SkeletonRows`, `SkeletonBlock`, `EmptyNote`.
- `SeloDadosExemplo.tsx` — `ModuloSemFonte` (em modo real troca a tela por um aviso com o motivo) e `SeloDadosExemplo` (selo com o que falta).
- `HeroBanner.tsx` — faixa compacta clara (`hero-compacto`). `charts.tsx`, `gauges.tsx`, `Sparkline.tsx` — gráficos.

## mapa/
`MapaLeaflet.tsx`, `MapaCliente.tsx`, `CamadasMapa.tsx` (cercas e POIs), `PopupVeiculo.tsx` ("Desempenho" abre a análise do veículo), `iconesVeiculo.ts`. Todo arquivo com `MapContainer` importa `leaflet/dist/leaflet.css`.

## frota/
`InspecaoVeiculo.tsx` (sinais com limites Cummins; óleo 0 = sem sensor), `TelemetriaEquipamentos.tsx`, `ManutencaoKanban.tsx`, `PlanoPreventivo.tsx`, `FaixasConducao.tsx`, `HistoricoConducao.tsx`, `PerfilElevacao.tsx`, `RelevoDetalhe.tsx`, `TelemetryChart.tsx`…

## Outros
`selma/` (assistente — ver o `CLAUDE.md` de lá), `suporte/Selma.tsx` (personagem com poses), `tour/` (tour guiado por tela), `console/ConsoleShell.tsx`, `cadastro/` (pickers e importadores do protótipo), `fretamento/SeatMap.tsx`, `video/`, `brand/` (logo, orb, selo SS Green).
