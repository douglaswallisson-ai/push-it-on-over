# src/screens — catálogo das telas

O comentário `/** ... */` no topo de cada arquivo diz o que a tela resolve e as
decisões de produto. Telas reais novas ficam em subpasta própria, cada uma com
o seu `CLAUDE.md`. As telas soltas nesta pasta são, em geral, as do protótipo
original; várias delas viraram **casca**: em modo real abrem a tela real da
subpasta (`usandoMock() ? <Exemplo /> : <Real />`).

Legenda de situação:
- **Real**: dado do banco via API.
- **Casca → X**: protótipo só em demonstração; em modo real abre X.
- **Protótipo**: sem fonte real. Em modo real mostra `ModuloSemFonte` (aviso
  no lugar da tela) ou `SeloDadosExemplo` (selo dizendo o que falta). Não
  inventar dado para "completar".

## Por módulo do menu

| Menu | Rota | Arquivo | Situação | Fonte (backend) |
|---|---|---|---|---|
| Início | `/app/` | `Inicio.tsx` | Real (ROI, saúde, alarmes, ranking) | `gerencial/roi`, `fleet-health`, `events`, `driver-ranking` |
| Mapa ao vivo | `/app/mapa` | `MapaAoVivo.tsx` | Real | `positions`, `mapa/camadas`, `video` |
| Pessoas › Motoristas | `/app/motoristas/` | `Motoristas.tsx`, `AcompanhamentoMotorista.tsx` | Real | `driver-ranking` |
| Pessoas › Jornada, escala e ponto | `/app/pessoas/jornada` | `JornadaTrabalho.tsx` | Casca → `jornada/JornadaReal` | `jornada` |
| Pessoas › Premiação / Metas e pesos | `/app/premiacao`, `/app/premiacao/metas` | `Premiacao.tsx`, `MetasPesos.tsx` | Protótipo (lista vazia em real) | — |
| Frota › Veículos | `/app/veiculos/` | `Veiculos.tsx` (clique abre o acompanhamento do veículo) | Real | `vehicles`, BI |
| Frota › Tracking | `/app/frota/tracking` | `Tracking.tsx` | Real | `tracking`, `relevo/trajeto` |
| Frota › Desempenho | `/app/frota/desempenho`, `/app/frota/analise` | `DesempenhoFrota.tsx`, `AnaliseIndividual.tsx` | Real (distribuição pelo ranking) | `driver-ranking`, `gerencial` |
| Frota › Telemetria | `/app/frota/telemetria` | `Telemetria.tsx` | Real (componente `TelemetriaEquipamentos`) | `equipamentosReais()` em `lib/queries.ts` |
| Frota › Combustível | `/app/frota/combustivel` | `combustivel/ControleCombustivel.tsx` | Real | `combustivel` |
| Frota/Urbano/Fretamento › Escala de viagem | `/app/escala-viagem` | `EscalaViagem.tsx` | Real | `escala-viagem` |
| Frota/Fretamento › Roteirização | `/app/fretamento/roteirizacao` | `roteirizacao/RoteirizacaoReal.tsx` (demonstração: `RoteirizacaoOtimizada.tsx`) | Real | `roteirizacao`, `cadastros/rota` |
| Frota › Checklist β | `/app/frota/checklist` | `Checklist.tsx` | Protótipo (API Gateway separada, não configurada) | — |
| Frota › Multas β | `/app/pessoas/multas` | `Multas.tsx` | Protótipo | — |
| Urbano › Painel sinótico | `/app/operacao/sinotico` | `PainelSinotico.tsx` | Casca → `operacao/SinoticoUrbano` | `sinotico` |
| Urbano › Gestão de viagens | `/app/operacao/viagens` | `GestaoViagens.tsx` | Casca → `OperacaoLinhas.tsx` | `operacao` |
| Urbano › Padrão por linha β | `/app/urbano/padrao` | `PadraoPorLinha.tsx` | Protótipo | — |
| Urbano/Fretamento › Contagem de passageiros | `/app/urbano/passageiros`, `/app/fretamento/passageiros` | `ContagemPassageiros.tsx` | Casca → `passageiros/ContagemReal` | `passageiros` |
| Fretamento › Viagens | `/app/fretamento/viagens/` | `Viagens.tsx` (`CadastroViagem.tsx` = nova viagem, protótipo) | Casca → `OperacaoLinhas.tsx` | `operacao/monitor` |
| Fretamento › Layout de assentos | `/app/fretamento/assentos` | `LayoutAssentos.tsx` | Casca → `CadastroTela` (`layout_assentos`) | `cadastros` |
| Fretamento › cadastros (passageiros, centros de custo, turnos) | `/app/fretamento/...` | `cadastros/CadastroTela.tsx` | Real | `cadastros` |
| Segurança › Eventos | `/app/eventos` | `Eventos.tsx` (+ `eventos/TimelineEventos`) | Real | `bi/eventos`, `events`, `eventos/timeline` |
| Segurança › Videotelemetria | `/app/seguranca/video` | `Videotelemetria.tsx` | Real | `video` |
| Manutenção › Painel | `/app/manutencao/` | `Manutencao.tsx` | Casca → `manutencao/ManutencaoReal` | `manutencao` |
| Manutenção › Sinais do motor | `/app/frota/sinais` | `SinaisCAN.tsx` | Real (esconde heartbeats; marcha válida) | `reports/history/detailed` |
| Manutenção › Ordens | `/app/manutencao/ordens` | `OrdensServico.tsx` | Casca → `ManutencaoReal` (corretiva) | `manutencao` |
| Manutenção › Pneus β / DTC β / DPF β | `/app/manutencao/pneus`, `diagnostico`, `regeneracao` | `Pneus.tsx`, `DiagnosticoDTC.tsx`, `Regeneracao.tsx` | Protótipo | — |
| Gerencial | `/app/gerencial` | `Gerencial.tsx` | Casca → `RelatoriosGerenciais.tsx` + `gerencial/*` | `bi`, `gerencial`, `relevo` |
| IA Ops Advisor | `/app/estrategico` | `IAFleetManager.tsx` (+ `ai-fleet/PainelReal`) | Real | `ai-fleet` |
| Cadastros (13 itens) | `/app/cadastros/...` | `cadastros/CadastroTela.tsx` | Real (gravação provisória) | `cadastros` |
| Relatórios | `/app/relatorios` | `Relatorios.tsx` (central) → `TelemetriaViagens.tsx`, `RelatoriosOperacionais.tsx`, `relatorios/RelatoriosFrota.tsx` | Real | `reports`, `relatorios-frota` |
| Emissão de CO₂ | `/app/co2` | `EmissaoCO2.tsx` | Casca → `CO2Real.tsx` | `gerencial/co2` |
| Suporte | `/app/suporte` | `Suporte.tsx` | Real (Zendesk desligado sem variáveis) | `suporte` |
| Assistente (tela cheia) | `/app/assistente` | `AssistenteDados.tsx` | Protótipo de IA (ver `components/ss/selma/CLAUDE.md`) | — |
| Console › Estoque de equipamentos | `/console/estoque` | `estoque/EstoqueEquipamentos.tsx` | Real (serial × placa ao vivo × contrato/aditivo) | `estoque` |
| Console › Contratos | `/console/contratos` | `ContratosOrganizacao.tsx` | Casca → `contratos/ContratosReal` (todo cliente tem contrato; grupo novo só por contrato) | `contratos` |
| Console (só SS) | `/console/...` | `console/*`, `Auditoria.tsx`, `ContratosOrganizacao.tsx`, `CatalogoManutencao.tsx`, `IndicadoresGerenciais.tsx`, `ConfiguracoesAdmin.tsx` | Acessos e administradores reais; contratos, catálogo e indicadores protótipo | `acessos` |
| Login / Embutido | `/login`, `/embed` | `Login.tsx`, `Embutido.tsx` | Real | `auth`, `embed` |
| Itens sem tela | `/app/$` | `EmBreve.tsx` | — | — |

Outros protótipos sem menu: `Escala.tsx` (casca → `JornadaReal` aba escala),
`Ponto.tsx` (ponto do motorista — futuro app), `DashboardOperacional.tsx`,
`Roteirizacao.tsx`, `MotoristaNovo.tsx`, `VeiculoNovo.tsx`, `CadastroAlarme.tsx`
(lista real de alarmes, formulário protótipo).

## Ao mexer numa tela solta
- Se ela é casca, a lógica real está na subpasta — mexa lá.
- Se é protótipo e a fonte passou a existir, crie a tela real em
  `screens/<funcionalidade>/` e transforme o arquivo solto em casca.
- Atualize esta tabela e o `CLAUDE.md` da subpasta.
