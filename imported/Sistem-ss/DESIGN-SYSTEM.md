# Design System — Sistema SS Telemática

Referência do design do **sistema** (a plataforma logada). Herda a identidade da
marca SS (site `fleet-advantage`) e a estende com tokens próprios de aplicação
para densidade, tabelas e status. Fonte da verdade dos tokens: `src/styles.css`.

> Regra de ouro: **puxe destes tokens** — não invente cor, sombra ou raio. O
> verde é sempre acento/positivo; o CO₂ é sempre **redução**, nunca "neutro".

---

## 1. Princípio

O site é linguagem de **marketing** (seções de 96px, gradientes de tela cheia,
cards enormes). O sistema é linguagem de **operação**: mesma paleta, mesma
tipografia, mesmas sombras coloridas e mesmo raio de pílula — porém **densidade
e escala recalibradas** para tabelas, formulários e painéis.

| Site (marketing) | Sistema (operação) |
|---|---|
| `py-24` entre seções | `p-6` / `gap-4/5` em grids |
| `rounded-3xl` + `shadow-elegant` | `rounded-2xl` + `shadow-card` |
| gradiente hero de tela cheia | faixa hero por tela + sidebar navy sólida |
| Space Grotesk em h1–h4 | Space Grotesk em títulos e **números**; Inter no resto |

---

## 2. Cores

### 2.1 Marca (núcleo — idêntico ao site)

| Token | oklch | Hex | Papel |
|---|---|---|---|
| `--brand-navy` | `oklch(0.32 0.13 260)` | `#20448C` | Primária. Botões, títulos, base do gradiente, sidebar. |
| `--brand-blue` | `oklch(0.42 0.16 260)` | `#2651A6` | Azul médio. Fim do gradiente, hover. |
| `--brand-sky` | `oklch(0.68 0.14 235)` | `#32A9D9` | Acento. Foco/ring, links, destaques. |
| `--brand-green` | `oklch(0.72 0.18 138)` | `#7FBF50` | **Ação e positivo.** CTAs, item ativo do menu, sucesso. |
| `--brand-ink` | `oklch(0.15 0.01 260)` | `#0D0D0D` | Texto principal. |

### 2.2 Semânticos

| Token | Papel |
|---|---|
| `--background` `#FFF` / `--card` `#FFF` | Fundo de página / cartão. |
| `--canvas` `#DDE5EA` | **Fundo do conteúdo logado** (o cinza-azulado das faixas do login SS). |
| `--sidebar` `#33475B` / `--sidebar-dark` `#2A3B4C` | Navy grafite do menu. |
| `--primary` = navy · `--accent` = sky · `--ring` = sky | Ação / acento / foco. |
| `--secondary` `oklch(0.96 0.01 240)` | Superfícies suaves (`bg-secondary/40`). |
| `--muted-foreground` | Texto de apoio. |
| `--border` | Bordas e divisórias. |
| `--ink-soft` `#3D3D42` | Texto de corpo em tabelas/cards. |
| `--deep` `#122A52` | Blocos escuros (rodapé de tela, callout). |

### 2.3 Cores de status (extensão do app — trio cor/tint/linha)

Cada severidade vem em **três** valores: cor sólida, tint de fundo e linha de
borda — para os cartões tintados não virarem bloco chapado.

| Severidade | cor | tint | linha | Uso |
|---|---|---|---|---|
| Crítico | `--coral` `#C0392B` | `--coral-tint` | `--coral-line` | Alertas críticos, erro. |
| Atenção | `--gold` `#B5590C` | `--gold-tint` | `--gold-line` | Avisos, faixa amarela. |
| Operacional | `--teal` `#0C8577` | `--teal-tint` | `--teal-line` | Info operacional. |
| Positivo | `--leaf` `#5A9A3C` | `--leaf-tint` | `--leaf-line` | Sucesso **em texto** (versão legível do brand-green). |
| Marca | `--navy-tint` `#E8F1FA` | — | `--navy-line` | Realce neutro-azul. |

> **Por que `--leaf` e não `--brand-green` em texto:** o verde-lima da marca é
> claro demais para texto sobre branco (falha em contraste). Use `--brand-green`
> em preenchimentos (botão, item ativo) e `--leaf` em texto/número de sucesso.

### 2.4 Regras invioláveis de cor

- Verde = ação/positivo. Nunca verde para texto corrido nem erro.
- Sombra **sempre azul-marinho translúcida**, nunca preta/cinza.
- Texto sobre verde/gradiente: navy escuro (`oklch(0.15 0.03 260)`) ou branco no
  gradiente hero.
- CO₂ = **redução** medida por telemetria. Nunca "neutro/zero".

---

## 3. Gradientes e sombras

```css
--gradient-hero:  linear-gradient(135deg, oklch(0.18 0.06 260) 0%, var(--brand-navy) 40%, var(--brand-blue) 100%);
--gradient-accent:linear-gradient(90deg, var(--brand-sky), var(--brand-green));  /* text-gradient */
--gradient-green: linear-gradient(135deg, var(--brand-green), oklch(0.62 0.18 155));

--shadow-card:    0 8px 24px -12px color-mix(in oklab, var(--brand-navy) 20%, transparent);  /* repouso */
--shadow-elegant: 0 20px 60px -20px color-mix(in oklab, var(--brand-navy) 40%, transparent); /* flutuante/hover */
--shadow-glow:    0 0 60px        color-mix(in oklab, var(--brand-sky)  30%, transparent);    /* CTA verde */
```

- `hero` → faixa de abertura de tela (componente `HeroBanner`) e sidebar do login.
- `text-gradient` (sky→green recortado no texto) → palavra-chave em títulos e no hero.
- `shadow-card` em repouso; sobe para `shadow-elegant` no hover de cartão / itens flutuantes (tour, menu expandido).

---

## 4. Raios (densidade de app)

`--radius: 0.625rem` (10px). Uso real no sistema:

| Elemento | Raio |
|---|---|
| Cartão / bloco / hero | `rounded-2xl` (16px) |
| Campo, chip, ícone-caixa, tabela | `rounded-xl` / `rounded-lg` |
| Botão, pílula, avatar, item de menu | `rounded-full` |

> O site usa `rounded-3xl` (24px) em cards; o sistema recalibra para `2xl` por
> densidade — mas **pílula continua `rounded-full`** (traço mais reconhecível).

---

## 5. Tipografia

```
Space Grotesk (500/600/700) → títulos e NÚMEROS (font-display, .font-display)
Inter (400–700)             → corpo (font-sans)
IBM Plex Mono (400–700)     → rótulos técnicos, placas, códigos, eixos (font-mono)
```

| Papel | Classe |
|---|---|
| Título de página | `h1` no `PageHeader`, `text-xl font-bold` |
| Título de hero | `text-2xl md:text-[26px] font-bold` |
| Número/KPI | `font-display ... font-bold tabular-nums` |
| Eyebrow / rótulo | `font-mono text-[11px] uppercase tracking-[0.12–0.16em]` |
| Corpo | `text-[13–14px] text-ink-soft` |
| Apoio | `text-[11–12px] text-muted-foreground` |

Abertura de seção interna (eyebrow com traço):
```html
<p class="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
  <span class="inline-block h-px w-4 bg-current opacity-50"></span> EYEBROW
</p>
```

---

## 6. Layout

- **Container de conteúdo:** `mx-auto max-w-[1360px] px-6 md:px-8 py-6`, `space-y-6`.
- **Sidebar:** trilho de ícones de **68px** que expande para **256px** no hover
  (flutua por cima, não empurra). Navy sólida, item ativo verde, orb no topo.
  No mobile vira gaveta.
- **PageHeader:** branco, sticky, com título + subtítulo + ações. `data-tour="page-header"`.
- **Grids de KPI:** `grid-cols-2 lg:grid-cols-4/5`, `gap-4`.

---

## 7. Componentes (no código)

| Componente | Arquivo | Papel |
|---|---|---|
| `HeroBanner` / `HeroMetric` | `ui/HeroBanner.tsx` | Faixa de abertura em gradiente + orb + métricas. |
| `Card` | `ui/data.tsx` | Cartão com título/ícone/ação. `tourId` opcional. |
| `StatTile` | `ui/data.tsx` | KPI: ícone tintado + número + rótulo. |
| `DataTable` / `Column` | `ui/data.tsx` | Tabela zebra com rolagem própria. |
| `Pill` / `Dot` | `ui/data.tsx` | Status compacto (5 tons). |
| `FilterBar` / `FilterChip` | `ui/data.tsx` | Faixa de filtros. |
| `ScoreGauge` | `ui/gauges.tsx` | Velocímetro de nota 270°, cor por faixa. |
| `RingProgress` | `ui/gauges.tsx` | Anel de % / valor livre. |
| `AccelBands` | `ui/gauges.tsx` | Pressão do acelerador (ideal/atenção/crítico). |
| `IndicatorCard` | `ui/gauges.tsx` | Indicador % com barra. |
| `Sparkline` | `ui/Sparkline.tsx` | Mini-tendência. |
| `MonthlyBars` | `ui/charts.tsx` | Barras mensais (mês atual em cor cheia). |
| `Field/Input/Select/Textarea/Toggle` | `ui/form.tsx` | Formulário. |
| `SSOrb` / `SSLogo` | `brand/` | Marca animada (esfera parada, anel girando). |
| `SSGreenSeal` / `SSGreenBadge` | `brand/SSGreenSeal.tsx` | Selo CO₂ **Reduzido** hexagonal. |
| `CadastroScaffold` | `layout/CadastroScaffold.tsx` | Padrão de cadastro (hero+KPIs+tabela). |

### Receitas rápidas

```
Botão primário:  rounded-full bg-brand-navy px-4 py-2 text-sm font-semibold
                 text-white transition-transform hover:-translate-y-0.5
CTA verde:       rounded-full bg-brand-green px-6 py-3.5 text-sm font-semibold
                 text-[oklch(0.15_0.03_260)] shadow-glow hover:-translate-y-0.5
Cartão:          rounded-2xl border border-border bg-card shadow-card
Campo:           rounded-lg border border-border bg-white px-3 h-10 text-[13.5px]
                 focus:border-accent focus:ring-4 focus:ring-accent/12
```

---

## 8. Movimento

Sutil e proposital, com `prefers-reduced-motion` desligando tudo.

| Animação | Onde |
|---|---|
| `hover:-translate-y-0.5` | botões/CTAs |
| Anel do orb (11s) / halo (34s) | marca SSOrb |
| Ken Burns (28s) | foto do hero no login |
| `pulse-ring` | ponto de evento crítico |
| Expansão do menu (0.22s) | trilho → painel |

---

## 9. Marca e selos

- **SSOrb:** esfera "SS" parada, anel girando (arco azul assimétrico + traços
  verdes). Usar no login, na sidebar e nos heros internos.
- **Selo CO₂ Reduzido / SS Green:** hexágono (vértice no topo) com gradiente
  azul→verde, microtexto nas arestas, texto central curto (**"CO₂ REDUZIDO"**),
  folha + verificação. Cartão-alternativa: disco verde + "FROTA CERTIFICADA · SS
  GREEN · ano".

---

## 10. Tour guiado

Cada tela tem um tour (`components/tour/tours.ts`) que abre ao entrar (uma vez,
`localStorage`) e destaca as áreas via âncoras `data-tour`
(`page-header`, `hero`, `sidebar`, `stat`, `table`, `bus`, `seatmap`, `score`,
`accel`, `ciclo`, `predicoes`, `tabs`). Botão flutuante "Tour da tela" repete.

Para dar tour a uma tela nova: adicione `data-tour` nos pontos-chave e registre
os passos em `TOURS["/app/nova-rota"]`.

---

## 11. Acessibilidade

- `lang="pt-BR"`; contraste AA (texto sobre verde = navy escuro; sucesso em
  texto = `--leaf`, não brand-green).
- Ícones decorativos `aria-hidden`; ações com `aria-label`.
- Foco visível: anel sky.
- `prefers-reduced-motion` respeitado.

---

## 12. Checklist final

- [ ] Cores só dos tokens; verde = ação/positivo; sucesso em texto usa `--leaf`.
- [ ] Sombra colorida (navy/sky), nunca preta.
- [ ] Cartão `rounded-2xl`; pílula/botão `rounded-full`; campo `rounded-lg/xl`.
- [ ] Título e número em Space Grotesk; corpo em Inter; rótulo técnico em Mono.
- [ ] Tela abre com `HeroBanner`; KPIs em `StatTile`; listas em `DataTable`.
- [ ] CO₂ = "redução", nunca "neutro".
- [ ] Tela nova tem tour registrado.
- [ ] PT-BR; CTA = verbo + benefício.
