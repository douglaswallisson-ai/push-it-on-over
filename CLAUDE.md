# push-it-on-over — guia para quem (pessoa ou IA) for mexer aqui

Front da plataforma nova da SS Telemática: React 19 + TanStack Router (rotas por
arquivo), React Query, Tailwind 4, Leaflet, recharts. Backend:
`ss-fleet-core` (ver o `CLAUDE.md` de lá). Projeto ligado ao Lovable — ver
`AGENTS.md` (nunca reescrever histórico já publicado).

Cada pasta tem o seu `CLAUDE.md` com as telas, regras e campos daquela parte.
Este arquivo explica **como o trabalho foi feito** para outra IA seguir igual.

## 1. Regras que não se quebram

1. **Dado real ou nenhum.** Com `VITE_API_BASE` configurado o sistema está
   sempre em modo real (`lib/modo.ts`). Tela sem fonte real mostra o protótipo
   só em modo demonstração (`usandoMock()`); em modo real mostra aviso
   (`ModuloSemFonte`) ou lista vazia — **nunca** número de exemplo misturado
   com dado real.
2. **Regras de negócio moram no backend.** A tela formata e decide o que
   mostrar; cálculo de indicador, plausibilidade e validação vêm prontos da API.
   Quando um cálculo precisa existir no front, ele fica num lugar só (`lib/`).
3. **Escopo do cliente**: toda consulta manda o grupo ativo (`grupoAtivo()` de
   `lib/escopo-ativo.ts`). O cliente é o GRUPO, não a conta.
4. **Módulo por segmento**: o cliente vê só os módulos do seu nicho
   (`/cliente/modulos`). Ferramentas compartilhadas (Escala de viagem,
   Roteirização, Contagem de passageiros) aparecem como LINK dentro de cada
   módulo — não fundir e não tirar os "duplicados" entre módulos.
5. **Textos em português simples**, para usuário de operação. Sem jargão
   técnico na tela. Erro da API aparece com `mensagemErro(e)` (`lib/suporte-api.ts`).
6. **Gravação é provisória**: o banco é só leitura. Tudo o que a tela salva vai
   para o armazenamento provisório do backend e a tela mostra o selo
   "provisório". Nunca chamar rotas que gravam em produção (`/vehicles` POST etc.).
7. **Commit só local** a não ser que o PM peça para subir; mensagem em
   português, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## 2. Padrão de uma tela nova

1. Ler a regra no vault (`Telas/`, `Regras-de-Negocio/`) e o controller antigo.
   Conferir se a plataforma já tem algo parecido (menu, central de relatórios)
   antes de criar — **não repetir funcionalidade**.
2. Cliente da API em `src/lib/<funcionalidade>-api.ts` (tipos + funções que
   chamam `api.get/post`) ou `useQuery` direto com `api.get<Tipo>(...)`.
3. Tela em `src/screens/<funcionalidade>/<Nome>.tsx` (pasta própria para telas
   reais novas). Estrutura: `PageHeader` → filtros (período com
   `<input type="date">`, veículo) → `StatTile`s → abas → `Card` com
   `DataTable` (paginação 50) → nota de rodapé explicando a regra.
4. Rota em `src/routes/app.<caminho>.tsx`. Se existir protótipo:
   `usandoMock() ? <Exemplo /> : <Real />`. O `routeTree.gen.ts` é gerado pelo
   servidor de desenvolvimento (commitar junto).
5. Item no menu (`components/ss/layout/Sidebar.tsx`) no grupo certo, sem mudar
   os rótulos que já existem.
6. Exportar CSV quando for lista (BOM `﻿`, separador `;`).
7. Testar no navegador com os três clientes de referência: **FERTRAN 13956**
   (carga), **VTR 15686** (fretamento), **Consórcio Fênix 14330** (urbano).
   `npx tsc --noEmit -p .` precisa passar.

## 3. Visual (decisões aprovadas pelo PM)

- Visual da **plataforma de câmeras** (CoreUI: menu #3c4b64, verde #78c052,
  fonte do sistema, cantos 0,25 rem) — decisão do PM em 08/10/2026; ver o fim de
  `src/styles.css`. Números com `tabular-nums`. Escala de tamanhos: 12 · 13 · 14 · 16 · 20 · 24 · 30 px.
- Layout **denso** (piloto de Eventos aprovado): sem banner grande, tela larga
  (`max-w-[1360px]` ou `tema-denso` com `max-w-[1760px]`). `HeroBanner` virou
  faixa compacta clara.
- Cores por token (`styles.css`): `brand-navy`, `brand-blue`, `brand-sky`,
  `leaf` (bom), `gold` (atenção), `coral` (ruim), `muted-foreground`. Pills:
  `green`, `sky`, `gold`, `coral`, `neutral`.
- Sem faixa de aviso de "base do cliente". Logo do cliente no `PageHeader`.
- Todo mapa importa `leaflet/dist/leaflet.css` no próprio arquivo (sem isso o
  mapa quebra quando é o primeiro aberto). Mapa dentro de painel lateral monta
  depois da animação (≈ 400 ms).

## 4. Menu (ordem decidida pelo PM em 04/10/2026)

Início · Mapa ao vivo · Pessoas · Frota · Urbano · Fretamento · Segurança ·
Manutenção · Gerencial · IA Ops Advisor · Cadastros · Relatórios (último).
Depois do divisor: Emissão de CO₂ e Suporte (Suporte some no modo embutido).
Console de gestão (só SS) abre ao clicar no nome do usuário; Auditoria só
dentro do Console. "Percurso do dia" se chama **Tracking**.

## 5. Mapa das pastas

| Pasta | Doc |
|---|---|
| `src/screens/` (telas soltas) e subpastas por funcionalidade | `src/screens/CLAUDE.md` + `CLAUDE.md` em cada subpasta |
| `src/components/ss/` (layout, menu, UI, mapa, Selma) | `src/components/ss/CLAUDE.md` + `selma/CLAUDE.md` |
| `src/lib/`, `src/hooks/` (clientes da API, sessão, escopo, regras do front) | `src/lib/CLAUDE.md` |
| `src/routes/` (uma rota por arquivo) | `src/routes/CLAUDE.md` + `README.md` |
