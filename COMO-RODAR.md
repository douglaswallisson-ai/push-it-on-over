# Como rodar as telas (push-it-on-over) num computador novo

Estas são as **telas da plataforma nova** da SS. Elas precisam do **servidor**, que fica no repositório
[`ss-fleet-core`](https://github.com/douglaswallisson-ai/ss-fleet-core). Suba o servidor primeiro, seguindo o
`COMO-RODAR.md` de lá.

> ⚠️ Use o ramo **`main`** deste repositório: https://github.com/douglaswallisson-ai/push-it-on-over

## O que precisa estar instalado
- **Node.js 24** (testado com 24.19).
- O servidor `ss-fleet-core` rodando em http://localhost:8000.

## Passo a passo

### 1. Baixar o código
```bash
git clone https://github.com/douglaswallisson-ai/push-it-on-over.git
```
```bash
cd push-it-on-over
```

### 2. Instalar
```bash
npm install
```

### 3. Configurar o `.env` (importante)
```bash
copy .env.example .env
```
Confira se o `.env` tem esta linha:
```
VITE_API_BASE=http://localhost:8000
```
**Sem ela, as telas entram em MODO DEMONSTRAÇÃO**: aparecem dados de exemplo, que não são da frota, e uma faixa amarela no topo avisa isso.

### 4. Subir as telas
```bash
npx vite dev --port 8080
```
Abra http://localhost:8080 e entre com o usuário e a senha da plataforma atual da SS.

## Problemas comuns

| Sintoma | Causa |
|---|---|
| Faixa amarela "MODO DEMONSTRAÇÃO" e números de exemplo | falta `VITE_API_BASE=http://localhost:8000` no `.env`. Depois de corrigir, pare e suba as telas de novo |
| "Servidor fora" ou erro ao entrar | o servidor (`ss-fleet-core`) não está rodando, ou o Redis dele está desligado |
| Login aceito, mas tudo vazio | o usuário do banco configurado no servidor não tem permissão de leitura |
| O endereço do servidor mudou | o `VITE_API_BASE` é lido só quando as telas sobem: pare e suba de novo |

Mais detalhes em `CLAUDE.md`.
