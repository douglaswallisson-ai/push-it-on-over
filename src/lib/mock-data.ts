/**
 * Dados de exemplo (mock) usados enquanto a API externa está desligada.
 *
 * Para voltar a usar a API real, basta ligar `USE_MOCK = false` em
 * `src/lib/api.ts` — nenhuma tela precisa ser alterada.
 */
import type {
  Alarme,
  EmissaoResumo,
  Manutencao,
  Motorista,
  Paginated,
  PosicaoVeiculo,
  ResumoOperacao,
  Veiculo,
  Viagem,
} from "@/types";

export const MOCK_RESUMO: ResumoOperacao = {
  veiculosAtivos: 48,
  alertasAbertos: 7,
  custoPorKm: 2.14,
  consumoMedio: 2.8,
  disponibilidade: 94.2,
};

const agora = (minAtras: number) => new Date(Date.now() - minAtras * 60_000).toISOString();

export const MOCK_POSICOES: PosicaoVeiculo[] = [
  { veiculoId: "v1", placa: "BCA7A56", lat: -23.55, lng: -46.63, endereco: "BR-116, São Paulo / SP", velocidade: 82, ignicao: true, atualizadoEm: agora(0.5) },
  { veiculoId: "v2", placa: "SXD1J61", lat: -16.68, lng: -49.25, endereco: "Goiânia / GO", velocidade: 74, ignicao: true, atualizadoEm: agora(1) },
  { veiculoId: "v3", placa: "EBZ3590", lat: -8.05, lng: -34.9, endereco: "Recife / PE", velocidade: 0, ignicao: true, atualizadoEm: agora(2) },
  { veiculoId: "v4", placa: "QHH1360", lat: -3.73, lng: -38.52, endereco: "Fortaleza / CE", velocidade: 0, ignicao: true, atualizadoEm: agora(4) },
  { veiculoId: "v5", placa: "LUO5I08", lat: -25.43, lng: -49.27, endereco: "Curitiba / PR", velocidade: 0, ignicao: false, atualizadoEm: agora(9) },
  { veiculoId: "v6", placa: "JBE6H85", lat: -5.79, lng: -35.21, endereco: "Natal / RN", velocidade: 0, ignicao: false, atualizadoEm: agora(40) },
  { veiculoId: "v7", placa: "SB157940", lat: -12.97, lng: -38.5, endereco: "Salvador / BA", velocidade: 0, ignicao: true, atualizadoEm: agora(3) },
  { veiculoId: "v8", placa: "AYK7080", lat: -19.92, lng: -43.94, endereco: "Belo Horizonte / MG", velocidade: 61, ignicao: true, atualizadoEm: agora(1) },
  { veiculoId: "v9", placa: "TPA1106", lat: -30.03, lng: -51.23, endereco: "Porto Alegre / RS", velocidade: 55, ignicao: true, atualizadoEm: agora(2) },
  { veiculoId: "v10", placa: "GAP4C73", lat: -22.91, lng: -43.17, endereco: "Rio de Janeiro / RJ", velocidade: 0, ignicao: false, atualizadoEm: agora(15) },
];

export const MOCK_VEICULOS: Veiculo[] = [
  { id: "v1", prefixo: "11596", placa: "BCA7A56", marca: "Volvo", modelo: "FH 540", ano: 2022, operacao: "Longa distância", situacao: "em_rota", kml: 2.9, odometro: 812977 , garagemId: "g1" },
  { id: "v2", prefixo: "11278", placa: "SXD1J61", marca: "Scania", modelo: "R 450", ano: 2021, operacao: "Longa distância", situacao: "em_rota", kml: 3.1, odometro: 489020 , garagemId: "g1" },
  { id: "v3", prefixo: "11275", placa: "EBZ3590", marca: "Mercedes-Benz", modelo: "Actros 2651", ano: 2020, operacao: "Regional", situacao: "parado", kml: 2.6, odometro: 913006 , garagemId: "g4" },
  { id: "v4", prefixo: "11107", placa: "QHH1360", marca: "DAF", modelo: "XF 480", ano: 2023, operacao: "Regional", situacao: "parado", kml: 2.8, odometro: 174320 , garagemId: "g4" },
  { id: "v5", prefixo: "11005", placa: "LUO5I08", marca: "Volvo", modelo: "FH 460", ano: 2019, operacao: "Urbano", situacao: "manutencao", kml: 2.4, odometro: 1024500 , garagemId: "g5" },
  { id: "v6", prefixo: "11589", placa: "JBE6H85", marca: "Iveco", modelo: "S-Way 480", ano: 2022, operacao: "Longa distância", situacao: "sem_sinal", kml: 2.7, odometro: 322110 , garagemId: "g5" },
  { id: "v7", prefixo: "11505", placa: "SB157940", marca: "Scania", modelo: "P 320", ano: 2018, operacao: "Urbano", situacao: "parado", kml: 3.4, odometro: 640980 , garagemId: "g2" },
  { id: "v8", prefixo: "11509", placa: "AYK7080", marca: "Volkswagen", modelo: "Constellation 25.460", ano: 2021, operacao: "Regional", situacao: "em_rota", kml: 3.0, odometro: 401220 , garagemId: "g2" },
  { id: "v9", prefixo: "11096", placa: "TPA1106", marca: "Mercedes-Benz", modelo: "Axor 2544", ano: 2020, operacao: "Longa distância", situacao: "em_rota", kml: 2.5, odometro: 634210 , garagemId: "g3" },
  { id: "v10", prefixo: "11455", placa: "GAP4C73", marca: "Ford", modelo: "Cargo 2429", ano: 2017, operacao: "Urbano", situacao: "parado", kml: 3.2, odometro: 201774 , garagemId: "g3" },
];

export const mockVeiculosPage = (page = 1, pageSize = 50): Paginated<Veiculo> => ({
  items: MOCK_VEICULOS.slice((page - 1) * pageSize, page * pageSize),
  total: MOCK_VEICULOS.length,
  page,
  pageSize,
});

export const mockManutencao = (veiculoId: string): Manutencao => ({
  veiculoId,
  indiceSaude: 77,
  componentes: [
    { id: "motor", label: "Motor", valor: "Bom", severidade: "ok" },
    { id: "freios", label: "Freios", valor: "72% de vida útil", severidade: "operacional" },
    { id: "pneus", label: "Pneus", valor: "Pressão traseira baixa", severidade: "atencao" },
    { id: "oleo", label: "Óleo do motor", valor: "Troca em 8 dias", severidade: "critico" },
    { id: "filtro", label: "Filtro de ar", valor: "25% de vida útil", severidade: "atencao" },
    { id: "bateria", label: "Bateria", valor: "12,6 V", severidade: "ok" },
  ],
  predicoes: [
    { titulo: "Troca de óleo do motor", prazoDias: 8, custo: 850, severidade: "critico" },
    { titulo: "Substituição do filtro de ar", prazoDias: 25, custo: 320, severidade: "atencao" },
    { titulo: "Rodízio de pneus", prazoDias: 30, custo: 200, severidade: "atencao" },
  ],
});

export const MOCK_ALARMES: Alarme[] = [
  { id: "a1", nome: "Excesso de velocidade", tipo: "velocidade", condicao: "> 90 km/h por 30s", severidade: "critico", canais: ["App", "E-mail"], ativo: true },
  { id: "a2", nome: "Cerca violada — Pátio", tipo: "cerca", condicao: "Saída fora de janela", severidade: "critico", canais: ["App", "SMS"], ativo: true, veiculos: ["BCA7A56", "SXD1J61"] },
  { id: "a3", nome: "Motor ligado parado", tipo: "ociosidade", condicao: "> 15 min parado", severidade: "atencao", canais: ["App"], ativo: true },
  { id: "a4", nome: "Pane seca iminente", tipo: "combustivel", condicao: "Nível < 8%", severidade: "atencao", canais: ["App", "E-mail"], ativo: false, veiculos: ["EBZ3590"] },
  { id: "a5", nome: "Botão de pânico", tipo: "panico", condicao: "Acionamento manual", severidade: "critico", canais: ["App", "SMS", "E-mail"], ativo: true },
];

export const MOCK_MOTORISTAS: Motorista[] = [
  { id: "m1", nome: "Marco Taborda", filial: "Matriz São Paulo", cnhCategoria: "E", cnhValidade: "2027-04-12", kmRodado: 128400, notaGeral: 9.2, viagens: 84, premiacao: 1450, situacao: "ativo" },
  { id: "m2", nome: "Najla Maltaca", filial: "Filial Paraná", cnhCategoria: "E", cnhValidade: "2026-11-03", kmRodado: 98720, notaGeral: 8.7, viagens: 66, premiacao: 980, situacao: "ativo" },
  { id: "m3", nome: "Remildo N. de Lima", filial: "Filial Bahia", cnhCategoria: "D", cnhValidade: "2026-02-20", kmRodado: 74310, notaGeral: 7.4, viagens: 51, premiacao: 420, situacao: "atencao" },
  { id: "m4", nome: "Richard Acácio", filial: "Filial Rio de Janeiro", cnhCategoria: "E", cnhValidade: "2028-01-09", kmRodado: 111230, notaGeral: 8.9, viagens: 72, premiacao: 1120, situacao: "ativo" },
  { id: "m5", nome: "Rafael Sabini", filial: "Matriz São Paulo", cnhCategoria: "D", cnhValidade: "2025-12-01", kmRodado: 45210, notaGeral: 6.8, viagens: 29, premiacao: 0, situacao: "afastado" },
];

export const MOCK_VIAGENS: Viagem[] = [
  { id: "t1", codigo: "VG-2401", origem: "São Paulo / SP", destino: "Curitiba / PR", saida: agora(-120), veiculoId: "v1", motoristaId: "m1", assentos: [1, 2, 3], status: "agendada" },
  { id: "t2", codigo: "VG-2402", origem: "Rio de Janeiro / RJ", destino: "Belo Horizonte / MG", saida: agora(90), veiculoId: "v8", motoristaId: "m4", assentos: [4, 5], status: "em_curso" },
  { id: "t3", codigo: "VG-2403", origem: "Salvador / BA", destino: "Recife / PE", saida: agora(600), veiculoId: "v3", motoristaId: "m3", assentos: [6], status: "concluida" },
];

export const MOCK_CO2: EmissaoResumo = {
  periodo: "Julho / 2026",
  toneladasCO2: 132.4,
  kgPorKm: 0.82,
  arvoresCompensacao: 1180,
  consumoLitros: 12480,
};

/* ------------------------------------------------------------------ */
/* Garagens, equipamentos, kanban de manutenção e conduções            */
/* ------------------------------------------------------------------ */

import type { CardManutencao, Conducao, Equipamento, Garagem, IndicadoresConducao } from "@/types";

const horasAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const diasAtras = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

export const MOCK_GARAGENS: Garagem[] = [
  { id: "g1", nome: "Garagem Central", unidadeId: "u1", unidade: "Matriz São Paulo", endereco: "Av. do Estado, 4200", cidade: "São Paulo", uf: "SP", responsavel: "Marco Taborda", vagas: 80, veiculos: 72, ativa: true },
  { id: "g2", nome: "Garagem Zona Leste", unidadeId: "u1", unidade: "Matriz São Paulo", endereco: "Av. Aricanduva, 1500", cidade: "São Paulo", uf: "SP", responsavel: "Rafael Sabini", vagas: 60, veiculos: 48, ativa: true },
  { id: "g3", nome: "Pátio Guarulhos", unidadeId: "u1", unidade: "Matriz São Paulo", endereco: "Rod. Pres. Dutra, km 225", cidade: "Guarulhos", uf: "SP", responsavel: "Thiago Bora", vagas: 40, veiculos: 21, ativa: true },
  { id: "g4", nome: "Garagem Caju", unidadeId: "u2", unidade: "Filial Rio de Janeiro", endereco: "Av. Brasil, 2200", cidade: "Rio de Janeiro", uf: "RJ", responsavel: "Richard Acácio", vagas: 50, veiculos: 46, ativa: true },
  { id: "g5", nome: "Garagem CIC", unidadeId: "u3", unidade: "Filial Paraná", endereco: "Av. Juscelino K., 900", cidade: "Curitiba", uf: "PR", responsavel: "Najla Maltaca", vagas: 45, veiculos: 38, ativa: true },
  { id: "g6", nome: "Pátio Salvador", unidadeId: "u4", unidade: "Filial Bahia", endereco: "Via Regional, 77", cidade: "Salvador", uf: "BA", responsavel: "Remildo N. de Lima", vagas: 20, veiculos: 12, ativa: false },
];

export const MOCK_EQUIPAMENTOS: Equipamento[] = [
  { id: "e1", serial: "SS-4412-0091", modelo: "SS Track 4G", firmware: "3.8.2", veiculoId: "v1", placa: "BCA7A56", garagemId: "g1", ultimaComunicacao: horasAtras(0.05), simOperadora: "Vivo" },
  { id: "e2", serial: "SS-4412-0114", modelo: "SS Track 4G", firmware: "3.8.2", veiculoId: "v2", placa: "SXD1J61", garagemId: "g1", ultimaComunicacao: horasAtras(0.1), simOperadora: "Vivo" },
  { id: "e3", serial: "SS-4412-0155", modelo: "SS Track 4G", firmware: "3.7.9", veiculoId: "v3", placa: "EBZ3590", garagemId: "g4", ultimaComunicacao: horasAtras(0.4), simOperadora: "Claro" },
  { id: "e4", serial: "SS-5200-0007", modelo: "SS Vision DMS", firmware: "2.1.4", veiculoId: "v4", placa: "QHH1360", garagemId: "g4", ultimaComunicacao: horasAtras(2.5), simOperadora: "Claro" },
  { id: "e5", serial: "SS-4412-0203", modelo: "SS Track 4G", firmware: "3.8.2", veiculoId: "v5", placa: "LUO5I08", garagemId: "g5", ultimaComunicacao: horasAtras(9), simOperadora: "TIM" },
  { id: "e6", serial: "SS-4412-0219", modelo: "SS Track 4G", firmware: "3.6.1", veiculoId: "v6", placa: "JBE6H85", garagemId: "g5", ultimaComunicacao: horasAtras(52), simOperadora: "TIM" },
  { id: "e7", serial: "SS-5200-0021", modelo: "SS Vision DMS", firmware: "2.1.4", veiculoId: "v7", placa: "SB157940", garagemId: "g2", ultimaComunicacao: horasAtras(0.3), simOperadora: "Vivo" },
  { id: "e8", serial: "SS-4412-0244", modelo: "SS Track 4G", firmware: "3.8.2", veiculoId: "v8", placa: "AYK7080", garagemId: "g2", ultimaComunicacao: horasAtras(0.02), simOperadora: "Vivo" },
  { id: "e9", serial: "SS-4412-0250", modelo: "SS Track 4G", firmware: "3.8.0", veiculoId: "v9", placa: "TPA1106", garagemId: "g3", ultimaComunicacao: horasAtras(1.2), simOperadora: "Claro" },
  { id: "e10", serial: "SS-4412-0261", modelo: "SS Track 4G", firmware: "3.5.4", veiculoId: "v10", placa: "GAP4C73", garagemId: "g3", ultimaComunicacao: horasAtras(180), simOperadora: "TIM" },
  { id: "e11", serial: "SS-5200-0033", modelo: "SS Vision DMS", firmware: "2.0.9", veiculoId: null, placa: null, garagemId: "g1", ultimaComunicacao: horasAtras(720), simOperadora: "Vivo" },
  { id: "e12", serial: "SS-4412-0288", modelo: "SS Track 4G", firmware: "3.8.2", veiculoId: null, placa: null, garagemId: "g1", ultimaComunicacao: null },
];

/**
 * Kanban de manutenção — um card por placa. A coluna segue a regra de
 * precedência: corretiva > preventiva > preditiva > em dia. Um veículo com
 * mais de uma pendência aparece na mais grave e informa o total em `pendencias`.
 */
export const MOCK_KANBAN: CardManutencao[] = [
  { veiculoId: "v1", placa: "BCA7A56", marca: "Volvo", modelo: "FH 540", status: "em_dia", servico: "Nenhuma pendência", prazoDias: null, indiceSaude: 94, custoEstimado: null, pendencias: 0, garagem: "Garagem Central" },
  { veiculoId: "v2", placa: "SXD1J61", marca: "Scania", modelo: "R 450", status: "preditiva", servico: "Desgaste de embreagem acima do previsto", prazoDias: 18, indiceSaude: 71, custoEstimado: 2400, pendencias: 1, garagem: "Garagem Central" },
  { veiculoId: "v3", placa: "EBZ3590", marca: "Mercedes-Benz", modelo: "Actros 2651", status: "corretiva", servico: "Falha no sensor de pressão do turbo", prazoDias: -2, indiceSaude: 38, custoEstimado: 1850, pendencias: 3, garagem: "Garagem Caju" },
  { veiculoId: "v4", placa: "QHH1360", marca: "DAF", modelo: "XF 480", status: "preventiva", servico: "Revisão de 180.000 km", prazoDias: 6, indiceSaude: 66, custoEstimado: 3200, pendencias: 1, garagem: "Garagem Caju" },
  { veiculoId: "v5", placa: "LUO5I08", marca: "Volvo", modelo: "FH 460", status: "corretiva", servico: "Vazamento no sistema de arrefecimento", prazoDias: -5, indiceSaude: 29, custoEstimado: 980, pendencias: 2, garagem: "Garagem CIC" },
  { veiculoId: "v6", placa: "JBE6H85", marca: "Iveco", modelo: "S-Way 480", status: "preditiva", servico: "Tendência de queda na bateria", prazoDias: 24, indiceSaude: 74, custoEstimado: 620, pendencias: 1, garagem: "Garagem CIC" },
  { veiculoId: "v7", placa: "SB157940", marca: "Scania", modelo: "P 320", status: "liberado", servico: "Troca de óleo concluída em 09/08", prazoDias: null, indiceSaude: 88, custoEstimado: null, pendencias: 0, garagem: "Garagem Zona Leste" },
  { veiculoId: "v8", placa: "AYK7080", marca: "Volkswagen", modelo: "Constellation 25.460", status: "em_dia", servico: "Nenhuma pendência", prazoDias: null, indiceSaude: 91, custoEstimado: null, pendencias: 0, garagem: "Garagem Zona Leste" },
  { veiculoId: "v9", placa: "TPA1106", marca: "Mercedes-Benz", modelo: "Axor 2544", status: "preventiva", servico: "Rodízio de pneus + alinhamento", prazoDias: 11, indiceSaude: 69, custoEstimado: 740, pendencias: 1, garagem: "Pátio Guarulhos" },
  { veiculoId: "v10", placa: "GAP4C73", marca: "Ford", modelo: "Cargo 2429", status: "liberado", servico: "Revisão de freios concluída em 05/08", prazoDias: null, indiceSaude: 83, custoEstimado: null, pendencias: 0, garagem: "Pátio Guarulhos" },
];

/** Histórico de conduções — sustenta o cruzamento motorista ↔ veículo. */
export const MOCK_CONDUCOES: Conducao[] = [
  { id: "c1", veiculoId: "v1", placa: "BCA7A56", motoristaId: "m1", motorista: "Marco Taborda", inicio: diasAtras(2), fim: null, km: 412, notaGeral: 88 },
  { id: "c2", veiculoId: "v1", placa: "BCA7A56", motoristaId: "m4", motorista: "Richard Acácio", inicio: diasAtras(9), fim: diasAtras(6), km: 1890, notaGeral: 79 },
  { id: "c3", veiculoId: "v1", placa: "BCA7A56", motoristaId: "m2", motorista: "Najla Maltaca", inicio: diasAtras(21), fim: diasAtras(17), km: 2240, notaGeral: 65 },
  { id: "c4", veiculoId: "v3", placa: "EBZ3590", motoristaId: "m3", motorista: "Remildo N. de Lima", inicio: diasAtras(1), fim: null, km: 180, notaGeral: 52 },
  { id: "c5", veiculoId: "v3", placa: "EBZ3590", motoristaId: "m1", motorista: "Marco Taborda", inicio: diasAtras(14), fim: diasAtras(11), km: 1420, notaGeral: 86 },
  { id: "c6", veiculoId: "v5", placa: "LUO5I08", motoristaId: "m5", motorista: "Rafael Sabini", inicio: diasAtras(30), fim: diasAtras(26), km: 890, notaGeral: 41 },
  { id: "c7", veiculoId: "v5", placa: "LUO5I08", motoristaId: "m2", motorista: "Najla Maltaca", inicio: diasAtras(8), fim: diasAtras(4), km: 1610, notaGeral: 67 },
  { id: "c8", veiculoId: "v8", placa: "AYK7080", motoristaId: "m4", motorista: "Richard Acácio", inicio: diasAtras(3), fim: null, km: 720, notaGeral: 84 },
  { id: "c9", veiculoId: "v8", placa: "AYK7080", motoristaId: "m1", motorista: "Marco Taborda", inicio: diasAtras(19), fim: diasAtras(15), km: 2010, notaGeral: 90 },
  { id: "c10", veiculoId: "v9", placa: "TPA1106", motoristaId: "m2", motorista: "Najla Maltaca", inicio: diasAtras(5), fim: diasAtras(1), km: 1780, notaGeral: 63 },
  { id: "c11", veiculoId: "v2", placa: "SXD1J61", motoristaId: "m1", motorista: "Marco Taborda", inicio: diasAtras(12), fim: diasAtras(10), km: 940, notaGeral: 87 },
  { id: "c12", veiculoId: "v6", placa: "JBE6H85", motoristaId: "m3", motorista: "Remildo N. de Lima", inicio: diasAtras(25), fim: diasAtras(22), km: 1330, notaGeral: 58 },
];

/** Indicadores de condução por veículo — mesma escala usada em Motoristas. */
export const MOCK_INDICADORES_VEICULO: Record<string, IndicadoresConducao> = {
  v1: { iv: 4.5, ae: 4, mp: 4.5, av: 4, pa: 5, ev: 4.5, fm: 3.5, pac: 4 },
  v2: { iv: 3.5, ae: 3, mp: 3, av: 3.5, pa: 4, ev: 3, fm: 2.5, pac: 3 },
  v3: { iv: 1, ae: 1.5, mp: 0.5, av: 1, pa: 2, ev: 1, fm: null, pac: 1.5 },
  v4: { iv: 3, ae: 3.5, mp: 2.5, av: 3, pa: 4, ev: 3.5, fm: 2, pac: 3 },
  v5: { iv: 0.5, ae: 1, mp: 1, av: 0.5, pa: 1.5, ev: 0.5, fm: null, pac: 1 },
  v6: { iv: 3.5, ae: 3, mp: 3.5, av: 3, pa: 4, ev: 3, fm: 2.5, pac: 2.5 },
  v7: { iv: 4, ae: 4.5, mp: 4, av: 4.5, pa: 5, ev: 4, fm: 3, pac: 4 },
  v8: { iv: 4.5, ae: 4.5, mp: 5, av: 4, pa: 5, ev: 4.5, fm: 4, pac: 4.5 },
  v9: { iv: 2.5, ae: 3, mp: 2, av: 2.5, pa: 3.5, ev: 2.5, fm: 2, pac: 2 },
  v10: { iv: 4, ae: 3.5, mp: 4, av: 4, pa: 4.5, ev: 4, fm: 3, pac: 3.5 },
};

/** Motoristas que dirigiram um veículo, mais recentes primeiro. */
export const conducoesDoVeiculo = (veiculoId: string) =>
  MOCK_CONDUCOES.filter((c) => c.veiculoId === veiculoId).sort((a, b) => b.inicio.localeCompare(a.inicio));

/** Veículos que um motorista dirigiu, mais recentes primeiro. */
export const conducoesDoMotorista = (motoristaId: string) =>
  MOCK_CONDUCOES.filter((c) => c.motoristaId === motoristaId).sort((a, b) => b.inicio.localeCompare(a.inicio));

/** Mesma busca, por nome — as telas de motorista navegam por nome hoje. */
export const conducoesPorNome = (nome: string) =>
  MOCK_CONDUCOES.filter((c) => c.motorista.toLowerCase() === nome.toLowerCase()).sort((a, b) =>
    b.inicio.localeCompare(a.inicio),
  );

/* ------------------------------------------------------------------ */
/* Distribuição por faixas de condução                                 */
/* ------------------------------------------------------------------ */

import type { DistribuicaoFaixas } from "@/lib/faixas";

/** Média da frota — soma 100. */
export const MOCK_FAIXAS_FROTA: DistribuicaoFaixas = {
  parado_ocioso: 9.4,
  parado_produtivo: 5.1,
  parado_acelerando: 1.2,
  baixa_velocidade: 6.8,
  sem_tracao: 3.6,
  eco_roll: 4.2,
  giro_baixo: 7.5,
  verde: 24.8,
  extra_economica: 15.3,
  amarela: 9.1,
  vermelha: 3.4,
  inercia_simples: 5.6,
  freio_motor: 2.4,
  tolerancia: 1.6,
};

/** Distribuição por veículo. */
export const MOCK_FAIXAS_VEICULO: Record<string, DistribuicaoFaixas> = {
  v1: { parado_ocioso: 5.2, parado_produtivo: 6.0, parado_acelerando: 0.4, baixa_velocidade: 4.1, sem_tracao: 2.0, eco_roll: 6.8, giro_baixo: 5.2, verde: 28.4, extra_economica: 22.6, amarela: 6.1, vermelha: 1.2, inercia_simples: 7.4, freio_motor: 3.2, tolerancia: 1.4 },
  v2: { parado_ocioso: 8.1, parado_produtivo: 4.8, parado_acelerando: 1.0, baixa_velocidade: 6.2, sem_tracao: 3.4, eco_roll: 4.6, giro_baixo: 7.1, verde: 25.2, extra_economica: 16.0, amarela: 9.4, vermelha: 3.0, inercia_simples: 6.0, freio_motor: 2.6, tolerancia: 2.6 },
  v3: { parado_ocioso: 16.4, parado_produtivo: 3.2, parado_acelerando: 3.1, baixa_velocidade: 11.2, sem_tracao: 7.4, eco_roll: 1.2, giro_baixo: 11.8, verde: 17.4, extra_economica: 6.2, amarela: 12.6, vermelha: 7.1, inercia_simples: 1.6, freio_motor: 0.4, tolerancia: 0.4 },
  v4: { parado_ocioso: 10.2, parado_produtivo: 5.4, parado_acelerando: 1.4, baixa_velocidade: 7.1, sem_tracao: 4.0, eco_roll: 3.8, giro_baixo: 8.2, verde: 23.1, extra_economica: 13.4, amarela: 10.2, vermelha: 4.0, inercia_simples: 5.2, freio_motor: 2.4, tolerancia: 1.6 },
  v5: { parado_ocioso: 18.6, parado_produtivo: 2.8, parado_acelerando: 4.2, baixa_velocidade: 12.4, sem_tracao: 8.1, eco_roll: 0.8, giro_baixo: 12.4, verde: 15.2, extra_economica: 4.8, amarela: 12.1, vermelha: 6.4, inercia_simples: 1.4, freio_motor: 0.4, tolerancia: 0.4 },
  v6: { parado_ocioso: 8.8, parado_produtivo: 5.0, parado_acelerando: 1.1, baixa_velocidade: 6.4, sem_tracao: 3.2, eco_roll: 4.4, giro_baixo: 7.2, verde: 24.6, extra_economica: 15.8, amarela: 9.0, vermelha: 3.2, inercia_simples: 6.2, freio_motor: 2.6, tolerancia: 2.5 },
  v7: { parado_ocioso: 6.1, parado_produtivo: 5.8, parado_acelerando: 0.6, baixa_velocidade: 4.8, sem_tracao: 2.4, eco_roll: 6.0, giro_baixo: 5.8, verde: 27.2, extra_economica: 20.4, amarela: 7.0, vermelha: 1.8, inercia_simples: 7.0, freio_motor: 3.0, tolerancia: 2.1 },
  v8: { parado_ocioso: 4.8, parado_produtivo: 6.2, parado_acelerando: 0.3, baixa_velocidade: 3.8, sem_tracao: 1.8, eco_roll: 7.2, giro_baixo: 4.9, verde: 29.1, extra_economica: 23.8, amarela: 5.4, vermelha: 0.9, inercia_simples: 7.8, freio_motor: 3.2, tolerancia: 0.8 },
  v9: { parado_ocioso: 12.1, parado_produtivo: 4.2, parado_acelerando: 2.2, baixa_velocidade: 8.8, sem_tracao: 5.4, eco_roll: 2.4, giro_baixo: 9.8, verde: 20.4, extra_economica: 10.1, amarela: 11.4, vermelha: 5.2, inercia_simples: 4.2, freio_motor: 1.8, tolerancia: 2.0 },
  v10: { parado_ocioso: 7.2, parado_produtivo: 5.6, parado_acelerando: 0.8, baixa_velocidade: 5.4, sem_tracao: 2.8, eco_roll: 5.2, giro_baixo: 6.4, verde: 26.0, extra_economica: 18.2, amarela: 8.0, vermelha: 2.4, inercia_simples: 6.6, freio_motor: 2.8, tolerancia: 2.6 },
};

/** Distribuição por motorista (chave = nome, como as telas navegam hoje). */
export const MOCK_FAIXAS_MOTORISTA: Record<string, DistribuicaoFaixas> = {
  "Marco Taborda": MOCK_FAIXAS_VEICULO.v8,
  "Najla Maltaca": MOCK_FAIXAS_VEICULO.v2,
  "Remildo N. de Lima": MOCK_FAIXAS_VEICULO.v3,
  "Richard Acácio": MOCK_FAIXAS_VEICULO.v1,
  "Rafael Sabini": MOCK_FAIXAS_VEICULO.v5,
  "Crísala Boni": MOCK_FAIXAS_VEICULO.v6,
  "Davi Nadalin": MOCK_FAIXAS_VEICULO.v9,
  "Guilherme Souza": MOCK_FAIXAS_VEICULO.v4,
};

export const faixasDoVeiculo = (id: string): DistribuicaoFaixas =>
  MOCK_FAIXAS_VEICULO[id] ?? MOCK_FAIXAS_FROTA;

export const faixasDoMotorista = (nome: string): DistribuicaoFaixas =>
  MOCK_FAIXAS_MOTORISTA[nome] ?? MOCK_FAIXAS_FROTA;

/** Validade de CNH por motorista — alguns em branco, o campo é opcional. */
export const MOCK_CNH: Record<string, { numero?: string; categoria?: string; validade?: string }> = {
  "Marco Taborda": { numero: "04567890123", categoria: "E", validade: "2027-04-12" },
  "Najla Maltaca": { numero: "03211456789", categoria: "E", validade: "2026-09-03" },
  "Remildo N. de Lima": { numero: "02987654321", categoria: "D", validade: "2026-08-20" },
  "Richard Acácio": { numero: "05123498760", categoria: "E", validade: "2028-01-09" },
  "Rafael Sabini": { numero: "04001122334", categoria: "D", validade: "2026-07-01" },
  "Crísala Boni": { categoria: "D" },
  "Davi Nadalin": { numero: "06778899001", categoria: "E", validade: "2026-10-15" },
  "Guilherme Souza": { numero: "05544332211", categoria: "D", validade: "2029-03-22" },
};

/* ------------------------------------------------------------------ */
/* BLOCO 0 — Linhas, itinerários, pontos, programação e realizado      */
/* ------------------------------------------------------------------ */

import type {
  AlarmeOperacional,
  GrupoLinhas,
  Itinerario,
  Linha,
  PontoParada,
  ViagemProgramada,
  ViagemRealizada,
} from "@/types";
import { classificarViagem } from "@/lib/operacao";

export const MOCK_GRUPOS_LINHAS: GrupoLinhas[] = [
  { id: "gl1", nome: "Corredor Norte", descricao: "Eixo estrutural norte-sul", cor: "#1B3A6B" },
  { id: "gl2", nome: "Alimentadoras Leste", descricao: "Linhas de bairro que alimentam o terminal leste", cor: "#2E86C1" },
  { id: "gl3", nome: "Fretamento contínuo", descricao: "Transporte de colaboradores", cor: "#2E9E4F" },
];

export const MOCK_PONTOS: PontoParada[] = [
  { id: "p1", codigo: "PC1", nome: "Terminal Central", endereco: "Praça da Sé, s/n", lat: -23.5505, lng: -46.6333, controle: true, toleranciaMin: 3, abrigo: true, acessivel: true },
  { id: "p2", codigo: "P002", nome: "Av. Paulista, 900", endereco: "Av. Paulista, 900", lat: -23.5629, lng: -46.6544, controle: false, toleranciaMin: 2, abrigo: true, acessivel: true },
  { id: "p3", codigo: "P003", nome: "Hospital das Clínicas", endereco: "Av. Dr. Enéas de Carvalho, 255", lat: -23.5566, lng: -46.6699, controle: false, toleranciaMin: 2, abrigo: true, acessivel: true },
  { id: "p4", codigo: "P004", nome: "Estação Butantã", endereco: "Av. Vital Brasil, 1000", lat: -23.5714, lng: -46.7085, controle: false, toleranciaMin: 2, abrigo: true, acessivel: false },
  { id: "p5", codigo: "PC2", nome: "Terminal Pinheiros", endereco: "Av. Pedroso de Morais, 1", lat: -23.5670, lng: -46.7020, controle: true, toleranciaMin: 3, abrigo: true, acessivel: true },
  { id: "p6", codigo: "P006", nome: "Shopping Aricanduva", endereco: "Av. Aricanduva, 5555", lat: -23.5620, lng: -46.5060, controle: false, toleranciaMin: 2, abrigo: true, acessivel: true },
  { id: "p7", codigo: "PC3", nome: "Terminal Itaquera", endereco: "Av. José Pinheiro Borges, s/n", lat: -23.5405, lng: -46.4666, controle: true, toleranciaMin: 3, abrigo: true, acessivel: true },
  { id: "p8", codigo: "P008", nome: "Portaria — Fábrica Leste", endereco: "Rod. Ayrton Senna, km 21", lat: -23.5100, lng: -46.4300, controle: false, toleranciaMin: 5 },
];

export const MOCK_LINHAS: Linha[] = [
  { id: "l1", codigo: "8207-01", nome: "Terminal Central / Terminal Pinheiros", modalidade: "publico", grupoId: "gl1", garagemId: "g1", operadora: "Viação Cometa", cor: "#1B3A6B", ativa: true, tarifa: 5.2 },
  { id: "l2", codigo: "5550-01", nome: "Est. Pampulha / Est. São José", modalidade: "publico", grupoId: "gl1", garagemId: "g1", operadora: "Viação Cometa", cor: "#2E86C1", ativa: true, tarifa: 5.2 },
  { id: "l3", codigo: "3450-10", nome: "Terminal Itaquera / Shopping Aricanduva", modalidade: "publico", grupoId: "gl2", garagemId: "g2", operadora: "Expresso Sul", cor: "#B8860B", ativa: true, tarifa: 5.2 },
  { id: "l4", codigo: "FRET-012", nome: "Fábrica Leste / Centro", modalidade: "fretamento", grupoId: "gl3", garagemId: "g2", operadora: "Contrato Azul Ind.", cor: "#2E9E4F", ativa: true },
  { id: "l5", codigo: "9110-02", nome: "Circular Butantã", modalidade: "publico", grupoId: "gl2", garagemId: "g3", operadora: "Expresso Sul", cor: "#7B3FA0", ativa: false, tarifa: 5.2 },
];

export const MOCK_ITINERARIOS: Itinerario[] = [
  {
    id: "it1", linhaId: "l1", sentido: "ida", nome: "Central → Pinheiros", extensaoKm: 18.4, duracaoMin: 62, ativo: true,
    paradas: [
      { pontoId: "p1", ordem: 1, minutosAcumulados: 0, kmAcumulado: 0 },
      { pontoId: "p2", ordem: 2, minutosAcumulados: 14, kmAcumulado: 4.2 },
      { pontoId: "p3", ordem: 3, minutosAcumulados: 28, kmAcumulado: 8.6 },
      { pontoId: "p4", ordem: 4, minutosAcumulados: 48, kmAcumulado: 15.1 },
      { pontoId: "p5", ordem: 5, minutosAcumulados: 62, kmAcumulado: 18.4 },
    ],
  },
  {
    id: "it2", linhaId: "l1", sentido: "volta", nome: "Pinheiros → Central", extensaoKm: 18.9, duracaoMin: 65, ativo: true,
    paradas: [
      { pontoId: "p5", ordem: 1, minutosAcumulados: 0, kmAcumulado: 0 },
      { pontoId: "p4", ordem: 2, minutosAcumulados: 15, kmAcumulado: 3.4 },
      { pontoId: "p3", ordem: 3, minutosAcumulados: 36, kmAcumulado: 10.2 },
      { pontoId: "p2", ordem: 4, minutosAcumulados: 51, kmAcumulado: 14.6 },
      { pontoId: "p1", ordem: 5, minutosAcumulados: 65, kmAcumulado: 18.9 },
    ],
  },
  {
    id: "it3", linhaId: "l3", sentido: "ida", nome: "Itaquera → Aricanduva", extensaoKm: 11.2, duracaoMin: 41, ativo: true,
    paradas: [
      { pontoId: "p7", ordem: 1, minutosAcumulados: 0, kmAcumulado: 0 },
      { pontoId: "p6", ordem: 2, minutosAcumulados: 41, kmAcumulado: 11.2 },
    ],
  },
  {
    id: "it4", linhaId: "l4", sentido: "ida", nome: "Fábrica → Centro", extensaoKm: 32.6, duracaoMin: 74, ativo: true,
    paradas: [
      { pontoId: "p8", ordem: 1, minutosAcumulados: 0, kmAcumulado: 0 },
      { pontoId: "p1", ordem: 2, minutosAcumulados: 74, kmAcumulado: 32.6 },
    ],
  },
];

/** Tabela horária do dia útil da linha 8207-01. */
export const MOCK_PROGRAMACAO: ViagemProgramada[] = [
  { id: "pg1", linhaId: "l1", itinerarioId: "it1", tipoDia: "util", tabela: 4, partida: "10:36", chegada: "11:38", headwayMin: 12, veiculoId: "v1" },
  { id: "pg2", linhaId: "l1", itinerarioId: "it2", tipoDia: "util", tabela: 4, partida: "10:36", chegada: "11:41", headwayMin: 12, veiculoId: "v1" },
  { id: "pg3", linhaId: "l1", itinerarioId: "it1", tipoDia: "util", tabela: 21, partida: "10:48", chegada: "11:50", headwayMin: 12, veiculoId: "v2" },
  { id: "pg4", linhaId: "l1", itinerarioId: "it2", tipoDia: "util", tabela: 3, partida: "10:48", chegada: "11:53", headwayMin: 12, veiculoId: "v3" },
  { id: "pg5", linhaId: "l1", itinerarioId: "it1", tipoDia: "util", tabela: 19, partida: "10:59", chegada: "12:01", headwayMin: 11, veiculoId: "v4" },
  { id: "pg6", linhaId: "l1", itinerarioId: "it2", tipoDia: "util", tabela: 7, partida: "11:00", chegada: "12:05", headwayMin: 12, veiculoId: "v5" },
  { id: "pg7", linhaId: "l1", itinerarioId: "it1", tipoDia: "util", tabela: 13, partida: "11:09", chegada: "12:11", headwayMin: 10, veiculoId: "v6" },
  { id: "pg8", linhaId: "l1", itinerarioId: "it2", tipoDia: "util", tabela: 9, partida: "11:12", chegada: "12:17", headwayMin: 12, veiculoId: "v7" },
  { id: "pg9", linhaId: "l1", itinerarioId: "it1", tipoDia: "util", tabela: 22, partida: "11:19", chegada: "12:21", headwayMin: 10, veiculoId: "v8" },
  { id: "pg10", linhaId: "l1", itinerarioId: "it2", tipoDia: "util", tabela: 1, partida: "11:24", chegada: "12:29", headwayMin: 12, veiculoId: "v9" },
  { id: "pg11", linhaId: "l1", itinerarioId: "it1", tipoDia: "util", tabela: 16, partida: "11:29", chegada: "12:31", headwayMin: 10, veiculoId: "v10" },
  { id: "pg12", linhaId: "l1", itinerarioId: "it2", tipoDia: "util", tabela: 11, partida: "11:36", chegada: "12:41", headwayMin: 12 },
  { id: "pg13", linhaId: "l1", itinerarioId: "it1", tipoDia: "util", tabela: 10, partida: "11:39", chegada: "12:41", headwayMin: 10 },
  { id: "pg14", linhaId: "l1", itinerarioId: "it2", tipoDia: "util", tabela: 15, partida: "11:48", chegada: "12:53", headwayMin: 12 },
  { id: "pg15", linhaId: "l1", itinerarioId: "it1", tipoDia: "util", tabela: 6, partida: "11:49", chegada: "12:51", headwayMin: 10 },
];

const HOJE_OP = new Date().toISOString().slice(0, 10);

/** Realizado do dia, confrontado com a programação acima. */
const REALIZADO_BRUTO: Omit<ViagemRealizada, "situacao">[] = [
  { id: "vr1", programadaId: "pg1", linhaId: "l1", itinerarioId: "it1", dataOperacao: HOJE_OP, tabela: 4, sentido: "ida", partidaProgramada: "10:36", partidaRealizada: "10:36", chegadaProgramada: "11:38", chegadaRealizada: "11:59", veiculoProgramadoId: "v1", veiculoRealizadoId: "v1", motoristaRealizadoId: "m1", percursoPct: 100, headwayProgramadoMin: 12, headwayRealizadoMin: 12, passageiros: 64, kmRodado: 18.4 },
  { id: "vr2", programadaId: "pg2", linhaId: "l1", itinerarioId: "it2", dataOperacao: HOJE_OP, tabela: 4, sentido: "volta", partidaProgramada: "10:36", partidaRealizada: "10:42", chegadaProgramada: "11:41", chegadaRealizada: "11:56", veiculoProgramadoId: "v1", veiculoRealizadoId: "v1", motoristaRealizadoId: "m1", percursoPct: 100, headwayProgramadoMin: 12, headwayRealizadoMin: 6, passageiros: 58, kmRodado: 18.9 },
  { id: "vr3", programadaId: "pg3", linhaId: "l1", itinerarioId: "it1", dataOperacao: HOJE_OP, tabela: 21, sentido: "ida", partidaProgramada: "10:48", partidaRealizada: "10:12", chegadaProgramada: "11:50", chegadaRealizada: "11:20", veiculoProgramadoId: "v2", veiculoRealizadoId: "v2", motoristaRealizadoId: "m2", percursoPct: 100, headwayProgramadoMin: 12, passageiros: 41, kmRodado: 18.4 },
  { id: "vr4", programadaId: "pg4", linhaId: "l1", itinerarioId: "it2", dataOperacao: HOJE_OP, tabela: 3, sentido: "volta", partidaProgramada: "10:48", partidaRealizada: "10:48", chegadaProgramada: "11:53", veiculoProgramadoId: "v3", veiculoRealizadoId: "v3", motoristaRealizadoId: "m3", percursoPct: 62, headwayProgramadoMin: 12, passageiros: 33, kmRodado: 11.7 },
  { id: "vr5", programadaId: "pg5", linhaId: "l1", itinerarioId: "it1", dataOperacao: HOJE_OP, tabela: 19, sentido: "ida", partidaProgramada: "10:59", partidaRealizada: "10:28", chegadaProgramada: "12:01", chegadaRealizada: "11:34", veiculoProgramadoId: "v4", veiculoRealizadoId: "v4", motoristaRealizadoId: "m4", percursoPct: 100, headwayProgramadoMin: 11, passageiros: 52, kmRodado: 18.4 },
  { id: "vr6", programadaId: "pg6", linhaId: "l1", itinerarioId: "it2", dataOperacao: HOJE_OP, tabela: 7, sentido: "volta", partidaProgramada: "11:00", partidaRealizada: "10:32", chegadaProgramada: "12:05", veiculoProgramadoId: "v5", veiculoRealizadoId: "v5", motoristaRealizadoId: "m5", percursoPct: 45, headwayProgramadoMin: 12, passageiros: 28, kmRodado: 8.5 },
  { id: "vr7", programadaId: "pg7", linhaId: "l1", itinerarioId: "it1", dataOperacao: HOJE_OP, tabela: 13, sentido: "ida", partidaProgramada: "11:09", partidaRealizada: "10:45", chegadaProgramada: "12:11", veiculoProgramadoId: "v6", veiculoRealizadoId: "v6", motoristaRealizadoId: "m1", percursoPct: 30, headwayProgramadoMin: 10, passageiros: 19, kmRodado: 5.5 },
  { id: "vr8", programadaId: "pg8", linhaId: "l1", itinerarioId: "it2", dataOperacao: HOJE_OP, tabela: 9, sentido: "volta", partidaProgramada: "11:12", partidaRealizada: "11:18", chegadaProgramada: "12:17", veiculoProgramadoId: "v7", veiculoRealizadoId: "v7", motoristaRealizadoId: "m2", percursoPct: 20, headwayProgramadoMin: 12, passageiros: 12, kmRodado: 3.8 },
  { id: "vr9", programadaId: "pg9", linhaId: "l1", itinerarioId: "it1", dataOperacao: HOJE_OP, tabela: 22, sentido: "ida", partidaProgramada: "11:19", chegadaProgramada: "12:21", veiculoProgramadoId: "v8", percursoPct: 0, headwayProgramadoMin: 10 },
  { id: "vr10", programadaId: "pg10", linhaId: "l1", itinerarioId: "it2", dataOperacao: HOJE_OP, tabela: 1, sentido: "volta", partidaProgramada: "11:24", chegadaProgramada: "12:29", veiculoProgramadoId: "v9", percursoPct: 0, headwayProgramadoMin: 12 },
  { id: "vr11", programadaId: "pg11", linhaId: "l1", itinerarioId: "it1", dataOperacao: HOJE_OP, tabela: 16, sentido: "ida", partidaProgramada: "11:29", chegadaProgramada: "12:31", veiculoProgramadoId: "v10", percursoPct: 0, headwayProgramadoMin: 10 },
  { id: "vr12", programadaId: "pg12", linhaId: "l1", itinerarioId: "it2", dataOperacao: HOJE_OP, tabela: 11, sentido: "volta", partidaProgramada: "11:36", chegadaProgramada: "12:41", percursoPct: 0, headwayProgramadoMin: 12 },
  { id: "vr13", linhaId: "l1", itinerarioId: "it1", dataOperacao: HOJE_OP, tabela: 99, sentido: "ida", partidaRealizada: "11:05", chegadaRealizada: "12:04", veiculoRealizadoId: "v3", motoristaRealizadoId: "m4", percursoPct: 100, passageiros: 71, kmRodado: 18.4 },
  { id: "vr14", programadaId: "pg13", linhaId: "l1", itinerarioId: "it1", dataOperacao: HOJE_OP, tabela: 10, sentido: "ida", partidaProgramada: "11:39", chegadaProgramada: "12:41", percursoPct: 0, headwayProgramadoMin: 10 },
  { id: "vr15", programadaId: "pg14", linhaId: "l1", itinerarioId: "it2", dataOperacao: HOJE_OP, tabela: 15, sentido: "volta", partidaProgramada: "11:48", chegadaProgramada: "12:53", percursoPct: 0, headwayProgramadoMin: 12 },
];

const agoraHHMM = () => new Date().toTimeString().slice(0, 5);

/** Realizado com a situação já classificada pela regra de tolerância. */
export const MOCK_VIAGENS_REALIZADAS: ViagemRealizada[] = REALIZADO_BRUTO.map((v) => ({
  ...v,
  situacao: classificarViagem(v, agoraHHMM()),
}));

export const MOCK_ALARMES_OPERACIONAIS: AlarmeOperacional[] = [
  { id: "ao1", tipo: "abertura_fora_pc", linhaId: "l2", sentido: "volta", veiculoId: "v3", pontoId: "p5", motoristaId: "m3", matricula: "0000553731", em: new Date(Date.now() - 34 * 60000).toISOString(), pontuacao: 5, observacao: "Cartão de operação do veículo", tratado: false },
  { id: "ao2", tipo: "parado_com_viagem_aberta", linhaId: "l2", sentido: "ida", veiculoId: "v5", pontoId: "p5", motoristaId: "m5", matricula: "0000618362", em: new Date(Date.now() - 66 * 60000).toISOString(), pontuacao: 3, observacao: "Veículo parado no PC2 há 12 min", tratado: false },
  { id: "ao3", tipo: "parado_com_viagem_aberta", linhaId: "l2", sentido: "ida", veiculoId: "v6", pontoId: "p5", matricula: "0000974605", em: new Date(Date.now() - 120 * 60000).toISOString(), pontuacao: 3, observacao: "Veículo parado no PC2 há 21 min", tratado: true },
  { id: "ao4", tipo: "velocidade_maxima", linhaId: "l1", sentido: "ida", veiculoId: "v4", motoristaId: "m4", matricula: "0000555446", em: new Date(Date.now() - 18 * 60000).toISOString(), pontuacao: 8, observacao: "Permitida 60 · real 78 km/h", tratado: false },
  { id: "ao5", tipo: "velocidade_maxima", linhaId: "l3", sentido: "ida", veiculoId: "v9", motoristaId: "m2", matricula: "0000771203", em: new Date(Date.now() - 95 * 60000).toISOString(), pontuacao: 8, observacao: "Permitida 50 · real 71 km/h", tratado: false },
  { id: "ao6", tipo: "viagem_nao_iniciada", linhaId: "l1", sentido: "ida", veiculoId: "v8", em: new Date(Date.now() - 8 * 60000).toISOString(), pontuacao: 10, observacao: "Tabela 22 · partida 11:19", tratado: false },
  { id: "ao7", tipo: "headway_irregular", linhaId: "l1", sentido: "volta", veiculoId: "v1", em: new Date(Date.now() - 50 * 60000).toISOString(), pontuacao: 4, observacao: "Programado 12 min · realizado 6 min", tratado: false },
  { id: "ao8", tipo: "fora_itinerario", linhaId: "l3", sentido: "ida", veiculoId: "v10", em: new Date(Date.now() - 150 * 60000).toISOString(), pontuacao: 6, observacao: "Desvio de 1,8 km do traçado", tratado: true },
];

export const linhaPorId = (id: string) => MOCK_LINHAS.find((l) => l.id === id);
export const pontoPorId = (id: string) => MOCK_PONTOS.find((p) => p.id === id);
export const itinerarioPorId = (id: string) => MOCK_ITINERARIOS.find((i) => i.id === id);
