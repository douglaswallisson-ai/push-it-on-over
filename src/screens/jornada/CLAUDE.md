# Jornada — `JornadaReal.tsx`

Aberta por `JornadaTrabalho.tsx` (`abaInicial="jornada"`) e `Escala.tsx`
(`abaInicial="escala"`). Regras da lei e fontes:
`ss-fleet-core/app/api/v1/endpoints/_docs/jornada.md`. Cliente: `lib/jornada-api.ts`.

- **Jornada do dia**: por motorista — início, fim, direção, pausas, infrações da Lei 13.103 com o artigo (rótulos com o texto da lei), fonte (diário de bordo ou telemetria). Jornada > 16 h marcada "a conferir".
- **Escala**: planejado × realizado por motorista e dia; cadastrar escala (dias da semana, início, fim, linha) — provisório.
- **Espelho de ponto**: um motorista num período, com justificativa por dia (motivos fixos) e exportação CSV.
- **Identificação**: km sem motorista identificado e identificações presas (> 16 h sem descanso de 6 h), com CSV. Achado importante para levar ao cliente (FERTRAN).
- Jornada pela telemetria é conferência, não ponto (decisão do PM).
