# Cadastros — tela única para todos

Regras e campos de cada tipo: `ss-fleet-core/app/api/v1/endpoints/_docs/cadastros.md`.

## Arquivos
- `CadastroTela.tsx` — lista com busca, painel lateral (Sheet) de criar/editar, exclusão com confirmação (e motivo quando o tipo exige), histórico, selo "provisório". Campos por tipo: `texto`, `numero`, `select`, `multi`, `toggle`, `cor`, `area`, `email`, `hora`, `data`, `imagem` (data URL ≤ 500 KB), `mapa` (ponto + raio), `geometria` (cerca: círculo, retângulo, polígono, linha — com limite de pontos), `regras` (alarme), `pontos` (itinerário da linha).
- `config.tsx` — uma `CFG_<TIPO>: ConfigCadastro` por cadastro: `tipo`, `titulo`, `subtitulo`, `singular`, `explicacao`, `colunas` (chave, rótulo, `render`, `num`), `secoes` → `campos` (nome, rótulo, tipo, `opcoes` = chave de `/cadastros/opcoes/todas` ou lista fixa, `obrig`, `ajuda`, `visivel`, `filtro`, `somenteSS`), `padrao`, `rotulo`, `podeCriar` (`"ss"` = só SS), `podeExcluir`, `motivoExclusao`.
- Configs: `CFG_EMPRESA`, `CFG_SUBGRUPO`, `CFG_GARAGEM`, `CFG_VEICULO`, `CFG_DISPOSITIVO`, `CFG_VINCULO`, `CFG_USUARIO`, `CFG_ALARME`, `CFG_CERCA`, `CFG_POI`, `CFG_PONTO_PARADA`, `CFG_LINHA`, `CFG_PASSAGEIRO`, `CFG_CENTRO_CUSTO`, `CFG_TURNO`, `CFG_GRUPO_LINHAS`, `CFG_LAYOUT_ASSENTOS`.
- Demais arquivos (`Cerca.tsx`, `Dispositivos.tsx`, `Grupos.tsx`, `Linhas.tsx`, `Pontos.tsx`, `Unidades.tsx`, `Usuarios.tsx`, `Garagens.tsx`, `Combustivel.tsx`, `ListasReais.tsx`) — protótipos usados só em modo demonstração.

## Rotas
`routes/app.cadastros.*.tsx`: `usandoMock() ? <Exemplo /> : <CadastroTela cfg={CFG_X} />`.
Fretamento: `app.fretamento.cadastro-passageiros`, `centros-custo`, `turnos`, `assentos`;
`app.cadastros.grupos-linhas` (link em Urbano e Fretamento). Rotas do fretamento
**não** têm cadastro: vivem na Roteirização (`app.fretamento.rotas` redireciona).

## Cadastro novo (passo a passo)
1. Backend: tipo em `cadastros.py` (ver a ficha).
2. `TipoCadastro` em `lib/cadastros-api.ts` (+ listas em `Opcoes`, se houver).
3. `CFG_<TIPO>` aqui, com as mesmas palavras do sistema antigo.
4. Rota + item de menu. Testar criar, editar, excluir e uma validação com erro.
