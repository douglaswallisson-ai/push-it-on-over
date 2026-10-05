# src/routes — uma rota por arquivo (TanStack Router)

Convenções de nome: `README.md` desta pasta. `routeTree.gen.ts` é gerado pelo
servidor de desenvolvimento (`npm run dev`) — nunca editar à mão, mas commitar.

Três formatos usados aqui:

```tsx
// 1. Tela real direta
export const Route = createFileRoute("/app/frota/combustivel")({ component: ControleCombustivel });

// 2. Protótipo em demonstração, real em produção
function Screen() { return usandoMock() ? <Exemplo /> : <CadastroTela cfg={CFG_LINHA} />; }

// 3. Página aposentada: redireciona para onde a funcionalidade foi
export const Route = createFileRoute("/app/fretamento/rotas")({
  beforeLoad: () => { throw redirect({ to: "/app/fretamento/roteirizacao", replace: true }); },
});
```

Rotas aposentadas: `/app/fretamento/rotas` → Roteirização;
`/app/relatorios/operacionais` → central de Relatórios. Mantê-las evita link
quebrado em favorito do usuário.

Prefixos: `/app/...` plataforma (com `AppShell` e menu), `/console/...` Console
da SS, `/embed` modo embutido, `/login`.
