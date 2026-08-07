# Prontidão para o back-end Python

Avaliação honesta do protótipo e o caminho para plugar um back-end em Python.

---

## 1. Onde estamos hoje

**A UI está bem preparada; a camada de dados ainda não existe.**

✅ **A favor:**
- Tudo é **TypeScript tipado** e componentizado (tabelas, cartões, formulários,
  gráficos reutilizáveis). Trocar a fonte dos dados não mexe no visual.
- Estado local com `useState`; navegação com React Router — nada acoplado a mock.
- Já existe o esqueleto da camada de dados: `src/types.ts` (contrato) +
  `src/lib/api.ts` (cliente) + proxy `/api` no `vite.config.ts` + `.env.example`.

⚠️ **Contra (o que falta):**
- **Nenhuma chamada de rede.** Cada tela tem os dados fixos inline
  (`const DADOS = [...]`). Não há `fetch`, `env`, cache nem estados de
  carregando/erro.
- Sem autenticação de verdade (o login só navega para `/app`).
- Formulários não persistem (o "salvar" apenas navega).

**Veredito:** a base é sólida e a migração é mecânica, mas **ainda não está
plugável** — é preciso mover os dados inline para a camada de API e tratar
loading/erro. Estimo trabalho de integração **médio e repetitivo**, não estrutural.

---

## 2. Arquitetura alvo

```
Componente de tela
   └─ chama →  src/lib/api.ts   (Motoristas.list(), Veiculos.get()…)
                   └─ fetch →  /api/...   (proxy Vite em dev / mesmo domínio em prod)
                                   └─  Back-end Python (FastAPI ou Django REST)
```

- **Contrato**: os tipos em `src/types.ts` são o acordo. O JSON do Python deve
  bater com eles (mesmos nomes de campo). Coleções usam o envelope
  `Paginated<T>` (`items`, `total`, `page`, `pageSize`).
- **Base da API**: `VITE_API_BASE` (vazio = mesma origem). Em dev, o proxy do
  Vite encaminha `/api` para `http://localhost:8000` (ajustável por `API_PROXY`).

---

## 3. Endpoints esperados (implementar no Python)

| Método | Rota | Retorno |
|---|---|---|
| GET | `/api/frota/resumo` | `ResumoOperacao` (KPIs do Início) |
| GET | `/api/frota/posicoes` | `PosicaoVeiculo[]` (mapa ao vivo) |
| GET | `/api/motoristas?page=&pageSize=&q=` | `Paginated<Motorista>` |
| POST | `/api/motoristas` | `Motorista` |
| GET/PUT/DELETE | `/api/motoristas/{id}` | `Motorista` |
| GET | `/api/veiculos` | `Paginated<Veiculo>` |
| GET | `/api/veiculos/{id}/manutencao` | `Manutencao` (saúde + predições) |
| GET | `/api/viagens` · POST | `Paginated<Viagem>` · `Viagem` |
| GET | `/api/alarmes` · POST | `Alarme[]` · `Alarme` |
| GET | `/api/co2/resumo?periodo=` | `EmissaoResumo` |

(Amplie seguindo o mesmo padrão para cadastros, escala, ponto, premiação, painel
estratégico etc. — cada tela mapeia para um recurso.)

Convenções: JSON `snake_case` **ou** `camelCase` — escolha uma e alinhe com
`types.ts` (hoje os tipos estão em camelCase). Datas em **ISO 8601**. Erros com
status HTTP adequado; o cliente lança `ApiError(status, mensagem)`.

---

## 4. Como migrar uma tela (exemplo: Motoristas)

**Antes** (`src/pages/Motoristas.tsx`):
```tsx
const DADOS: Motorista[] = [ /* … mock … */ ];
export default function Motoristas() {
  return <DataTable columns={COLS} rows={DADOS} />;
}
```

**Depois** (com estado de carregamento/erro):
```tsx
import { useEffect, useState } from "react";
import { Motoristas as MotoristasApi } from "@/lib/api";
import type { Motorista } from "@/types";

export default function Motoristas() {
  const [rows, setRows] = useState<Motorista[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    MotoristasApi.list({ page: 1, pageSize: 50 })
      .then((r) => setRows(r.items))
      .catch((e) => setErro(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;      // criar um estado de esqueleto
  if (erro) return <ErroInline msg={erro} />;
  return <DataTable columns={COLS} rows={rows} />;
}
```

Repita para cada tela. Os `COLS` e o layout permanecem idênticos.

---

## 5. Recomendações

1. **React Query** (`@tanstack/react-query`) — o site institucional já usa. Dá
   cache, revalidação, loading/erro de graça e enxuga o boilerplate acima. Vale
   adicionar antes de migrar muitas telas.
2. **Estados de carregando/erro** padronizados: um `<Skeleton>` (a base já tem a
   estética) e um `<ErroInline>` reaproveitáveis.
3. **Autenticação**: login real com token (JWT/cookie httpOnly). Guardar o token,
   enviá-lo no header do `request()`, e um guard de rota que manda para `/login`
   quando 401.
4. **Formulários**: trocar o `navigate()` do submit por `create()/update()` do
   recurso, com validação (a base do site usa `zod`).
5. **Paginação/filtros server-side**: as tabelas já têm busca visual; ligar aos
   parâmetros `q`, `page`, `pageSize`.
6. **WebSocket/polling** para o mapa ao vivo e status em tempo real.

---

## 6. Resumo

| Camada | Estado |
|---|---|
| Visual / componentes | ✅ pronto e no padrão |
| Tipos de domínio | ✅ `src/types.ts` |
| Cliente de API | ✅ `src/lib/api.ts` (esqueleto) |
| Proxy dev | ✅ `vite.config.ts` |
| Telas consumindo a API | ⛔ ainda usam mock inline |
| Auth real | ⛔ pendente |
| Loading/erro | ⛔ pendente |

O back Python encontra um front **desenhado para recebê-lo**, com o contrato já
escrito. Falta a etapa mecânica de ligar cada tela ao cliente.
