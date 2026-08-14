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

/* ------------------------------------------------------------------ */
/* BLOCO 1 — Consolidado de indicadores por período                    */
/* ------------------------------------------------------------------ */

import type { FalhaFrota, IndicadoresPeriodo } from "@/types";

/**
 * Sete meses de consolidado. Os números seguem a ordem de grandeza de uma
 * operação urbana de ~370 carros: ~2 milhões de km e ~4,8 milhões de
 * passageiros por mês, custo por passageiro na casa de R$ 4.
 */
export const MOCK_INDICADORES_PERIODO: IndicadoresPeriodo[] = [
  {
    periodo: "2026-02", frotaAtiva: 361, frotaTotal: 372, kmRodado: 1_985_400, kmComItinerario: 1_742_100,
    passageiros: 4_612_800, litrosDiesel: 1_301_200, kwh: 96_400,
    custoPorCategoria: { combustivel: 8_452_000, energia: 62_100, pecas: 2_780_000, mao_obra: 4_310_000, pneus: 890_000, terceiros: 1_120_000, outros: 640_000 },
    falhas: 238, falhasEmRota: 71, tempoReparoTotalMin: 121_000, horasDisponiveis: 236_400, horasTotais: 249_800,
    viagensProgramadas: 58_400, viagensRealizadas: 56_100, eventosConducao: 742_000,
  },
  {
    periodo: "2026-03", frotaAtiva: 364, frotaTotal: 372, kmRodado: 2_042_700, kmComItinerario: 1_812_900,
    passageiros: 4_780_100, litrosDiesel: 1_331_800, kwh: 101_200,
    custoPorCategoria: { combustivel: 8_614_000, energia: 65_300, pecas: 2_690_000, mao_obra: 4_355_000, pneus: 902_000, terceiros: 1_090_000, outros: 651_000 },
    falhas: 226, falhasEmRota: 64, tempoReparoTotalMin: 114_500, horasDisponiveis: 240_100, horasTotais: 252_300,
    viagensProgramadas: 60_100, viagensRealizadas: 58_200, eventosConducao: 738_400,
  },
  {
    periodo: "2026-04", frotaAtiva: 366, frotaTotal: 373, kmRodado: 2_058_900, kmComItinerario: 1_849_600,
    passageiros: 4_836_400, litrosDiesel: 1_338_100, kwh: 108_700,
    custoPorCategoria: { combustivel: 8_701_000, energia: 70_100, pecas: 2_612_000, mao_obra: 4_398_000, pneus: 915_000, terceiros: 1_064_000, outros: 662_000 },
    falhas: 214, falhasEmRota: 58, tempoReparoTotalMin: 106_200, horasDisponiveis: 243_600, horasTotais: 254_100,
    viagensProgramadas: 60_800, viagensRealizadas: 59_100, eventosConducao: 721_900,
  },
  {
    periodo: "2026-05", frotaAtiva: 367, frotaTotal: 373, kmRodado: 2_066_200, kmComItinerario: 1_871_400,
    passageiros: 4_901_300, litrosDiesel: 1_341_600, kwh: 114_300,
    custoPorCategoria: { combustivel: 8_755_000, energia: 73_800, pecas: 2_548_000, mao_obra: 4_412_000, pneus: 921_000, terceiros: 1_048_000, outros: 668_000 },
    falhas: 208, falhasEmRota: 54, tempoReparoTotalMin: 101_400, horasDisponiveis: 245_200, horasTotais: 254_900,
    viagensProgramadas: 61_200, viagensRealizadas: 59_700, eventosConducao: 712_600,
  },
  {
    periodo: "2026-06", frotaAtiva: 368, frotaTotal: 374, kmRodado: 2_075_998, kmComItinerario: 1_896_200,
    passageiros: 4_871_456, litrosDiesel: 1_344_849, kwh: 121_900,
    custoPorCategoria: { combustivel: 8_812_400, energia: 78_600, pecas: 2_496_300, mao_obra: 4_428_700, pneus: 928_400, terceiros: 1_032_600, outros: 671_000 },
    falhas: 201, falhasEmRota: 51, tempoReparoTotalMin: 97_100, horasDisponiveis: 246_800, horasTotais: 255_400,
    viagensProgramadas: 61_500, viagensRealizadas: 60_100, eventosConducao: 705_300,
  },
  {
    periodo: "2026-07", frotaAtiva: 366, frotaTotal: 374, kmRodado: 2_075_413, kmComItinerario: 1_908_700,
    passageiros: 4_724_130, litrosDiesel: 1_346_135, kwh: 128_400,
    custoPorCategoria: { combustivel: 8_798_900, energia: 82_900, pecas: 2_441_800, mao_obra: 4_441_200, pneus: 934_100, terceiros: 1_018_400, outros: 674_500 },
    falhas: 194, falhasEmRota: 47, tempoReparoTotalMin: 92_300, horasDisponiveis: 247_900, horasTotais: 255_800,
    viagensProgramadas: 61_400, viagensRealizadas: 60_300, eventosConducao: 698_100,
  },
  {
    periodo: "2026-08", frotaAtiva: 369, frotaTotal: 375, kmRodado: 2_089_600, kmComItinerario: 1_934_800,
    passageiros: 4_802_900, litrosDiesel: 1_349_400, kwh: 134_800,
    custoPorCategoria: { combustivel: 8_824_100, energia: 86_400, pecas: 2_398_600, mao_obra: 4_452_800, pneus: 940_200, terceiros: 1_004_900, outros: 678_200 },
    falhas: 188, falhasEmRota: 44, tempoReparoTotalMin: 88_600, horasDisponiveis: 249_400, horasTotais: 256_300,
    viagensProgramadas: 61_900, viagensRealizadas: 60_900, eventosConducao: 691_500,
  },
];

export const MOCK_FALHAS: FalhaFrota[] = [
  { id: "f1", veiculoId: "v3", linhaId: "l1", em: new Date(Date.now() - 5 * 3600_000).toISOString(), tempoReparoMin: 310, emRota: true, sistema: "Alimentação", descricao: "Falha no sensor de pressão do turbo" },
  { id: "f2", veiculoId: "v5", linhaId: "l2", em: new Date(Date.now() - 26 * 3600_000).toISOString(), tempoReparoMin: 480, emRota: true, sistema: "Arrefecimento", descricao: "Vazamento no radiador" },
  { id: "f3", veiculoId: "v9", linhaId: "l3", em: new Date(Date.now() - 52 * 3600_000).toISOString(), tempoReparoMin: 145, emRota: false, sistema: "Suspensão", descricao: "Bolsa de ar rompida" },
  { id: "f4", veiculoId: "v6", linhaId: "l1", em: new Date(Date.now() - 74 * 3600_000).toISOString(), tempoReparoMin: 95, emRota: false, sistema: "Elétrico", descricao: "Bateria sem carga" },
  { id: "f5", veiculoId: "v2", linhaId: "l1", em: new Date(Date.now() - 120 * 3600_000).toISOString(), tempoReparoMin: 620, emRota: true, sistema: "Transmissão", descricao: "Embreagem em fim de vida" },
];

export const periodoPorMes = (p: string) => MOCK_INDICADORES_PERIODO.find((x) => x.periodo === p);

/* ------------------------------------------------------------------ */
/* BLOCOS 2, 4, 5, 6                                                   */
/* ------------------------------------------------------------------ */

import type {
  Jornada, Multa, OcorrenciaVideo, OrdemServico,
  PlanoManutencao, Pneu, TipoAlarmeVideo,
} from "@/types";

const hAtras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const dAtras = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

/* ---- Bloco 2: ordens de serviço ---- */
export const MOCK_ORDENS: OrdemServico[] = [
  { id: "os1", numero: "OS-2026-0841", veiculoId: "v3", abertaEm: dAtras(2), status: "em_execucao", tipo: "corretiva", origem: "falha", descricao: "Substituição do sensor de pressão do turbo", oficina: "Oficina Central", interna: true, responsavel: "Marcos Pereira", odometro: 913006, horasParado: 26, custoPrevisto: 1850, falhaId: "f1",
    itens: [{ descricao: "Sensor de pressão MAP", tipo: "peca", quantidade: 1, valorUnitario: 980 }, { descricao: "Mão de obra mecânica", tipo: "servico", quantidade: 4, valorUnitario: 145 }] },
  { id: "os2", numero: "OS-2026-0839", veiculoId: "v5", abertaEm: dAtras(4), status: "aguardando_peca", tipo: "corretiva", origem: "falha", descricao: "Reparo no sistema de arrefecimento", oficina: "Oficina CIC", interna: true, responsavel: "Najla Maltaca", odometro: 704112, horasParado: 52, custoPrevisto: 980, falhaId: "f2",
    itens: [{ descricao: "Radiador completo", tipo: "peca", quantidade: 1, valorUnitario: 2400 }] },
  { id: "os3", numero: "OS-2026-0836", veiculoId: "v9", abertaEm: dAtras(6), concluidaEm: dAtras(5), status: "concluida", tipo: "preventiva", origem: "plano", descricao: "Rodízio de pneus e alinhamento", oficina: "Oficina Zona Leste", interna: true, odometro: 388940, horasParado: 6, custoPrevisto: 740,
    itens: [{ descricao: "Alinhamento", tipo: "servico", quantidade: 1, valorUnitario: 320 }, { descricao: "Rodízio", tipo: "servico", quantidade: 1, valorUnitario: 180 }] },
  { id: "os4", numero: "OS-2026-0834", veiculoId: "v4", abertaEm: dAtras(1), status: "aberta", tipo: "preventiva", origem: "plano", descricao: "Revisão de 180.000 km", oficina: "Terceirizada RJ", interna: false, odometro: 180450, custoPrevisto: 3200, itens: [] },
  { id: "os5", numero: "OS-2026-0830", veiculoId: "v2", abertaEm: dAtras(9), concluidaEm: dAtras(7), status: "concluida", tipo: "preditiva", origem: "predicao", descricao: "Substituição preventiva da embreagem", oficina: "Oficina Central", interna: true, odometro: 489020, horasParado: 34, custoPrevisto: 2400,
    itens: [{ descricao: "Kit embreagem", tipo: "peca", quantidade: 1, valorUnitario: 3180 }, { descricao: "Mão de obra", tipo: "servico", quantidade: 8, valorUnitario: 145 }] },
  { id: "os6", numero: "OS-2026-0828", veiculoId: "v6", abertaEm: dAtras(12), concluidaEm: dAtras(12), status: "concluida", tipo: "corretiva", origem: "falha", descricao: "Troca de bateria", oficina: "Oficina CIC", interna: true, odometro: 552310, horasParado: 3, custoPrevisto: 620,
    itens: [{ descricao: "Bateria 150Ah", tipo: "peca", quantidade: 2, valorUnitario: 890 }] },
];

/* ---- Bloco 2: planos por modelo ---- */
export const MOCK_PLANOS: PlanoManutencao[] = [
  { id: "pl1", nome: "Volvo FH — plano padrão", marca: "Volvo", modelo: "FH 460/540", motor: "D13K", veiculosAplicados: 2, itens: [
    { id: "i1", descricao: "Troca de óleo do motor e filtros", sistema: "Motor", intervaloKm: 60000, custoEstimado: 1450 },
    { id: "i2", descricao: "Filtro de ar", sistema: "Motor", intervaloKm: 90000, custoEstimado: 420 },
    { id: "i3", descricao: "Filtro de combustível", sistema: "Alimentação", intervaloKm: 60000, custoEstimado: 380 },
    { id: "i4", descricao: "Óleo da transmissão", sistema: "Transmissão", intervaloKm: 240000, custoEstimado: 2100 },
    { id: "i5", descricao: "Revisão de freios", sistema: "Freios", intervaloKm: 80000, custoEstimado: 1800 },
  ]},
  { id: "pl2", nome: "Scania R/P — plano padrão", marca: "Scania", modelo: "R 450 / P 320", motor: "DC13", veiculosAplicados: 2, itens: [
    { id: "i6", descricao: "Troca de óleo e filtros", sistema: "Motor", intervaloKm: 45000, custoEstimado: 1380 },
    { id: "i7", descricao: "Filtro de ar", sistema: "Motor", intervaloKm: 75000, custoEstimado: 390 },
    { id: "i8", descricao: "Correia do alternador", sistema: "Elétrico", intervaloKm: 120000, custoEstimado: 640 },
    { id: "i9", descricao: "Aferição do tacógrafo", sistema: "Legal", intervaloDias: 730, custoEstimado: 280 },
  ]},
  { id: "pl3", nome: "Mercedes-Benz — urbano", marca: "Mercedes-Benz", modelo: "Actros / Axor", motor: "OM 470", veiculosAplicados: 2, itens: [
    { id: "i10", descricao: "Troca de óleo do motor", sistema: "Motor", intervaloKm: 40000, custoEstimado: 1240 },
    { id: "i11", descricao: "Limpeza do DPF", sistema: "Pós-tratamento", intervaloKm: 150000, custoEstimado: 3400 },
    { id: "i12", descricao: "Filtro de ureia (ARLA)", sistema: "Pós-tratamento", intervaloKm: 120000, custoEstimado: 520 },
  ]},
];

/* ---- Bloco 2: pneus ---- */
export const MOCK_PNEUS: Pneu[] = [
  { id: "pn1", fogo: "F-10241", marca: "Michelin", medida: "295/80 R22.5", veiculoId: "v1", posicao: "1DE", vidas: 0, maxVidas: 3, sulcoMm: 12.4, sulcoMinimoMm: 1.6, pressaoPsi: 118, kmAcumulado: 42800, custoAquisicao: 2890, instaladoEm: dAtras(180), status: "em_uso" },
  { id: "pn2", fogo: "F-10242", marca: "Michelin", medida: "295/80 R22.5", veiculoId: "v1", posicao: "1DD", vidas: 0, maxVidas: 3, sulcoMm: 12.1, sulcoMinimoMm: 1.6, pressaoPsi: 116, kmAcumulado: 42800, custoAquisicao: 2890, instaladoEm: dAtras(180), status: "em_uso" },
  { id: "pn3", fogo: "F-09877", marca: "Pirelli", medida: "295/80 R22.5", veiculoId: "v1", posicao: "2TEE", vidas: 1, maxVidas: 3, sulcoMm: 4.2, sulcoMinimoMm: 1.6, pressaoPsi: 112, kmAcumulado: 118400, custoAquisicao: 2650, instaladoEm: dAtras(410), status: "em_uso" },
  { id: "pn4", fogo: "F-09878", marca: "Pirelli", medida: "295/80 R22.5", veiculoId: "v1", posicao: "2TEI", vidas: 1, maxVidas: 3, sulcoMm: 2.1, sulcoMinimoMm: 1.6, pressaoPsi: 109, kmAcumulado: 121200, custoAquisicao: 2650, instaladoEm: dAtras(410), status: "em_uso" },
  { id: "pn5", fogo: "F-11002", marca: "Goodyear", medida: "295/80 R22.5", veiculoId: "v3", posicao: "1DE", vidas: 0, maxVidas: 3, sulcoMm: 9.8, sulcoMinimoMm: 1.6, pressaoPsi: 120, kmAcumulado: 61300, custoAquisicao: 2740, instaladoEm: dAtras(240), status: "em_uso" },
  { id: "pn6", fogo: "F-08120", marca: "Bridgestone", medida: "295/80 R22.5", veiculoId: "v5", posicao: "2TDE", vidas: 2, maxVidas: 3, sulcoMm: 1.4, sulcoMinimoMm: 1.6, pressaoPsi: 104, kmAcumulado: 198700, custoAquisicao: 2810, instaladoEm: dAtras(620), status: "em_uso" },
  { id: "pn7", fogo: "F-11540", marca: "Michelin", medida: "295/80 R22.5", vidas: 0, maxVidas: 3, sulcoMm: 14.0, sulcoMinimoMm: 1.6, kmAcumulado: 0, custoAquisicao: 2890, status: "estoque" },
  { id: "pn8", fogo: "F-07430", marca: "Pirelli", medida: "295/80 R22.5", vidas: 2, maxVidas: 3, sulcoMm: 1.8, sulcoMinimoMm: 1.6, kmAcumulado: 214500, custoAquisicao: 2650, status: "recapagem" },
  { id: "pn9", fogo: "F-06011", marca: "Goodyear", medida: "295/80 R22.5", vidas: 3, maxVidas: 3, sulcoMm: 0.9, sulcoMinimoMm: 1.6, kmAcumulado: 289300, custoAquisicao: 2740, status: "sucata" },
];

/* ---- Bloco 4: ocorrências de vídeo ---- */
const TIPOS_VIDEO: { t: TipoAlarmeVideo; r: "baixo" | "medio" | "alto"; n: number }[] = [
  { t: "distracao", r: "alto", n: 42 }, { t: "risco_colisao", r: "alto", n: 31 },
  { t: "proximidade_dianteira", r: "medio", n: 28 }, { t: "olhos_fechados", r: "alto", n: 24 },
  { t: "vibracao", r: "baixo", n: 17 }, { t: "colisao", r: "alto", n: 9 },
  { t: "bocejo", r: "medio", n: 14 }, { t: "sem_rosto", r: "medio", n: 11 },
  { t: "celular", r: "alto", n: 8 }, { t: "curva_brusca", r: "medio", n: 7 },
  { t: "excesso_velocidade", r: "alto", n: 6 }, { t: "fumando", r: "baixo", n: 5 },
  { t: "sos", r: "alto", n: 3 }, { t: "calibracao_anormal", r: "baixo", n: 4 },
  { t: "desconexao_eletrica", r: "medio", n: 2 }, { t: "baixa_voltagem", r: "baixo", n: 3 },
  { t: "fadiga", r: "alto", n: 2 }, { t: "freada_brusca", r: "medio", n: 6 },
];

const VEIC = ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10"];
const MOTS = ["m1", "m2", "m3", "m4", "m5"];

export const MOCK_OCORRENCIAS_VIDEO: OcorrenciaVideo[] = TIPOS_VIDEO.flatMap((cfg, gi) =>
  Array.from({ length: Math.min(cfg.n, 9) }, (_, i) => {
    const idx = gi * 7 + i;
    const status: OcorrenciaVideo["status"] =
      i === 0 ? "aguardando" : i === 1 ? "em_analise" : i < 4 ? "aguardando" : i < 7 ? "tratado" : "descartado";
    return {
      id: `ov${gi}-${i}`,
      tipo: cfg.t,
      risco: cfg.r,
      veiculoId: VEIC[idx % VEIC.length],
      motoristaId: MOTS[idx % MOTS.length],
      linhaId: ["l1", "l2", "l3"][idx % 3],
      em: hAtras(i * 3 + gi),
      imei: `86499306040${6200 + idx}`,
      duracaoS: 8 + (idx % 12),
      velocidadeKmh: 30 + (idx % 45),
      clipeDisponivel: idx % 5 !== 0,
      status,
      tratativa: status === "tratado" ? "Feedback aplicado ao motorista." : undefined,
      tratadoPor: status === "tratado" ? "Rosemeri Tuono" : undefined,
      tratadoEm: status === "tratado" ? hAtras(i) : undefined,
    };
  }),
);

/** Volume total por tipo — o gráfico usa o número real, não a amostra. */
export const MOCK_VOLUME_VIDEO: Record<string, number> = Object.fromEntries(
  TIPOS_VIDEO.map((c) => [c.t, c.n * 47]),
);

/* ---- Bloco 5: jornada e multas ---- */
const hoje = new Date().toISOString().slice(0, 10);
const marc = (tipo: string, hhmm: string, origem: "automatica" | "manual" = "automatica", local?: string) =>
  ({ tipo, em: `${hoje}T${hhmm}:00`, origem, local }) as Jornada["marcacoes"][number];

export const MOCK_JORNADAS: Jornada[] = [
  { id: "j1", motoristaId: "m1", matricula: "0000553731", data: hoje, linhaId: "l1", tabela: 4,
    marcacoes: [marc("inicio_jornada", "04:51", "automatica", "Garagem Central"), marc("inicio_direcao", "05:02"), marc("fim_direcao", "09:17"), marc("inicio_refeicao", "09:20", "automatica", "Terminal Pinheiros"), marc("fim_refeicao", "10:15"), marc("inicio_direcao", "10:22"), marc("fim_direcao", "13:37")],
    minutosTrabalhados: 466, minutosDirecao: 450, minutosEspera: 15, minutosRefeicao: 55, minutosExtras: 46, limiteExtrasMin: 120, fechada: false,
    infracoes: [{ tipo: "direcao_continua", descricao: "4h15 de direção contínua sem parada de 30 min", gravidade: "media", minutos: 255 }] },
  { id: "j2", motoristaId: "m2", matricula: "0000618362", data: hoje, linhaId: "l1", tabela: 21,
    marcacoes: [marc("inicio_jornada", "05:10"), marc("inicio_direcao", "05:18"), marc("fim_direcao", "08:40"), marc("inicio_refeicao", "08:45"), marc("fim_refeicao", "09:50"), marc("inicio_direcao", "09:58")],
    minutosTrabalhados: 402, minutosDirecao: 380, minutosEspera: 22, minutosRefeicao: 65, minutosExtras: 0, limiteExtrasMin: 120, fechada: false, infracoes: [] },
  { id: "j3", motoristaId: "m3", matricula: "0000974605", data: hoje, linhaId: "l2",
    marcacoes: [marc("inicio_jornada", "04:30"), marc("inicio_direcao", "04:40"), marc("fim_direcao", "12:10")],
    minutosTrabalhados: 540, minutosDirecao: 450, minutosEspera: 90, minutosRefeicao: 0, minutosExtras: 60, limiteExtrasMin: 120, fechada: false,
    infracoes: [
      { tipo: "intervalo_insuficiente", descricao: "Jornada sem intervalo de refeição registrado", gravidade: "grave", minutos: 0 },
      { tipo: "direcao_continua", descricao: "7h30 de direção contínua", gravidade: "grave", minutos: 450 },
    ] },
  { id: "j4", motoristaId: "m4", matricula: "0000555446", data: hoje, linhaId: "l3", tabela: 8,
    marcacoes: [marc("inicio_jornada", "06:00"), marc("inicio_direcao", "06:12"), marc("fim_direcao", "10:02"), marc("inicio_refeicao", "10:05"), marc("fim_refeicao", "11:10"), marc("inicio_direcao", "11:18"), marc("fim_direcao", "14:40"), marc("fim_jornada", "14:52")],
    minutosTrabalhados: 532, minutosDirecao: 432, minutosEspera: 35, minutosRefeicao: 65, minutosExtras: 52, limiteExtrasMin: 120, fechada: true, infracoes: [] },
];

export const MOCK_MULTAS: Multa[] = [
  { id: "mu1", ait: "AE-2026-884210", veiculoId: "v4", motoristaId: "m4", em: dAtras(9), local: "Av. Paulista, km 2", infracao: "Excesso de velocidade até 20%", gravidade: "media", pontos: 4, valor: 130.16, vencimento: dAtras(-21), prazoIndicacao: dAtras(-6), status: "pendente_indicacao" },
  { id: "mu2", ait: "AE-2026-881944", veiculoId: "v9", motoristaId: "m2", em: dAtras(24), local: "Rod. Ayrton Senna, km 21", infracao: "Avanço de sinal vermelho", gravidade: "gravissima", pontos: 7, valor: 293.47, vencimento: dAtras(-6), status: "indicada" },
  { id: "mu3", ait: "AE-2026-878330", veiculoId: "v3", em: dAtras(41), local: "Av. Aricanduva, 5555", infracao: "Estacionar em local proibido", gravidade: "media", pontos: 4, valor: 195.23, vencimento: dAtras(11), status: "em_recurso" },
  { id: "mu4", ait: "AE-2026-870112", veiculoId: "v1", motoristaId: "m1", em: dAtras(62), local: "Marginal Tietê", infracao: "Faixa exclusiva de ônibus", gravidade: "grave", pontos: 5, valor: 195.23, vencimento: dAtras(32), status: "paga" },
];

/* ---- Bloco 6: contratos ---- */




/* ---- Bloco 3: posições na linha ---- */
import type { Despacho, PosicaoNaLinha } from "@/types";

const agoraISO = () => new Date().toISOString();

export const MOCK_POSICOES_LINHA: PosicaoNaLinha[] = [
  { veiculoId: "v1", linhaId: "l1", itinerarioId: "it1", sentido: "ida", tabela: 4, motoristaId: "m1", ultimoPontoId: "p2", progresso: 0.45, desvioMin: 0, headwayAnteriorMin: 12, velocidadeKmh: 34, passageirosABordo: 48, lotacao: 80, em: agoraISO() },
  { veiculoId: "v2", linhaId: "l1", itinerarioId: "it1", sentido: "ida", tabela: 21, motoristaId: "m2", ultimoPontoId: "p1", progresso: 0.20, desvioMin: -6, headwayAnteriorMin: 6, velocidadeKmh: 41, passageirosABordo: 22, lotacao: 80, em: agoraISO() },
  { veiculoId: "v4", linhaId: "l1", itinerarioId: "it1", sentido: "ida", tabela: 19, motoristaId: "m4", ultimoPontoId: "p3", progresso: 0.70, desvioMin: 9, headwayAnteriorMin: 21, velocidadeKmh: 12, passageirosABordo: 71, lotacao: 80, em: agoraISO() },
  { veiculoId: "v6", linhaId: "l1", itinerarioId: "it1", sentido: "ida", tabela: 13, motoristaId: "m1", ultimoPontoId: "p4", progresso: 0.30, desvioMin: 3, headwayAnteriorMin: 11, velocidadeKmh: 28, passageirosABordo: 55, lotacao: 80, em: agoraISO() },
  { veiculoId: "v3", linhaId: "l1", itinerarioId: "it2", sentido: "volta", tabela: 3, motoristaId: "m3", ultimoPontoId: "p5", progresso: 0.15, desvioMin: 14, headwayAnteriorMin: 26, velocidadeKmh: 0, passageirosABordo: 12, lotacao: 80, em: agoraISO() },
  { veiculoId: "v5", linhaId: "l1", itinerarioId: "it2", sentido: "volta", tabela: 7, motoristaId: "m5", ultimoPontoId: "p4", progresso: 0.55, desvioMin: -4, headwayAnteriorMin: 7, velocidadeKmh: 46, passageirosABordo: 38, lotacao: 80, em: agoraISO() },
  { veiculoId: "v7", linhaId: "l1", itinerarioId: "it2", sentido: "volta", tabela: 9, motoristaId: "m2", ultimoPontoId: "p3", progresso: 0.80, desvioMin: 2, headwayAnteriorMin: 13, velocidadeKmh: 31, passageirosABordo: 63, lotacao: 80, em: agoraISO() },
];

export const MOCK_DESPACHOS: Despacho[] = [
  { id: "d1", tipo: "retido", veiculoId: "v2", linhaId: "l1", em: new Date(Date.now() - 12 * 60000).toISOString(), operador: "Rosemeri Tuono", motivo: "Adiantado 6 min — regularizar headway", minutos: 5 },
  { id: "d2", tipo: "reforco", veiculoId: "v8", linhaId: "l1", em: new Date(Date.now() - 40 * 60000).toISOString(), operador: "Vitor Duarte", motivo: "Intervalo de 21 min entre carros no pico" },
];

/* ---- Videotelemetria: tempo real e gravações ---- */
import type { DispositivoVideo, SolicitacaoGravacao, TrechoGravacao } from "@/types";

const CANAIS_PADRAO = [
  { numero: 1, nome: "CAM 1 — Frontal", posicao: "frontal" as const, online: true },
  { numero: 2, nome: "CAM 2 — Motorista (DMS)", posicao: "motorista" as const, online: true },
  { numero: 3, nome: "CAM 3 — Salão", posicao: "salao" as const, online: true },
  { numero: 4, nome: "CAM 4 — Porta", posicao: "porta" as const, online: true },
];

export const MOCK_DISPOSITIVOS_VIDEO: DispositivoVideo[] = [
  { imei: "864993060406221", veiculoId: "v1", modelo: "SS Vision 4CH", status: "gravando", canais: CANAIS_PADRAO, ultimaComunicacao: new Date(Date.now() - 8_000).toISOString(), armazenamentoPct: 62, retencaoDias: 21, gpsLat: -23.5629, gpsLng: -46.6544, velocidadeKmh: 34 },
  { imei: "864993060406238", veiculoId: "v2", modelo: "SS Vision 4CH", status: "gravando", canais: CANAIS_PADRAO, ultimaComunicacao: new Date(Date.now() - 12_000).toISOString(), armazenamentoPct: 71, retencaoDias: 18, gpsLat: -23.5505, gpsLng: -46.6333, velocidadeKmh: 41 },
  { imei: "864993060406245", veiculoId: "v3", modelo: "SS Vision 4CH", status: "online", canais: CANAIS_PADRAO.map((c) => (c.numero === 3 ? { ...c, online: false } : c)), ultimaComunicacao: new Date(Date.now() - 40_000).toISOString(), armazenamentoPct: 88, retencaoDias: 12, gpsLat: -23.5670, gpsLng: -46.7020, velocidadeKmh: 0 },
  { imei: "864993060406252", veiculoId: "v4", modelo: "SS Vision 4CH", status: "gravando", canais: CANAIS_PADRAO, ultimaComunicacao: new Date(Date.now() - 6_000).toISOString(), armazenamentoPct: 44, retencaoDias: 26, gpsLat: -23.5566, gpsLng: -46.6699, velocidadeKmh: 12 },
  { imei: "864993060406269", veiculoId: "v5", modelo: "SS Vision 2CH", status: "sem_sinal_gps", canais: CANAIS_PADRAO.slice(0, 2), ultimaComunicacao: new Date(Date.now() - 180_000).toISOString(), armazenamentoPct: 55, retencaoDias: 20, velocidadeKmh: 46 },
  { imei: "864993060406276", veiculoId: "v6", modelo: "SS Vision 4CH", status: "offline", canais: CANAIS_PADRAO.map((c) => ({ ...c, online: false })), ultimaComunicacao: new Date(Date.now() - 9 * 3_600_000).toISOString(), armazenamentoPct: 93, retencaoDias: 9 },
  { imei: "864993060406283", veiculoId: "v7", modelo: "SS Vision 4CH", status: "gravando", canais: CANAIS_PADRAO, ultimaComunicacao: new Date(Date.now() - 15_000).toISOString(), armazenamentoPct: 38, retencaoDias: 28, gpsLat: -23.5714, gpsLng: -46.7085, velocidadeKmh: 31 },
  { imei: "864993060406290", veiculoId: "v8", modelo: "SS Vision 4CH", status: "gravando", canais: CANAIS_PADRAO, ultimaComunicacao: new Date(Date.now() - 10_000).toISOString(), armazenamentoPct: 51, retencaoDias: 24, gpsLat: -23.5620, gpsLng: -46.5060, velocidadeKmh: 28 },
];

/** Trechos contínuos disponíveis — o dia é fatiado em blocos de gravação. */
export const MOCK_TRECHOS: TrechoGravacao[] = (() => {
  const out: TrechoGravacao[] = [];
  const base = new Date();
  base.setHours(4, 0, 0, 0);
  for (const v of ["v1", "v2", "v3", "v4", "v7", "v8"]) {
    for (let bloco = 0; bloco < 9; bloco++) {
      // Simula lacuna de gravação em alguns veículos — acontece na prática.
      if (v === "v3" && (bloco === 3 || bloco === 4)) continue;
      if (v === "v8" && bloco === 6) continue;
      const ini = new Date(base.getTime() + bloco * 2 * 3_600_000);
      const fim = new Date(ini.getTime() + 2 * 3_600_000);
      if (ini.getTime() > Date.now()) continue;
      for (const canal of [1, 2]) {
        out.push({
          id: `tr-${v}-${bloco}-${canal}`,
          veiculoId: v,
          canal,
          inicio: ini.toISOString(),
          fim: fim.toISOString(),
          local: bloco < 2 ? "servidor" : "dispositivo",
          tamanhoMb: 640 + bloco * 35,
        });
      }
    }
  }
  return out;
})();

export const MOCK_SOLICITACOES: SolicitacaoGravacao[] = [
  { id: "sg1", veiculoId: "v3", canal: 1, inicio: new Date(Date.now() - 5 * 3_600_000).toISOString(), fim: new Date(Date.now() - 4.5 * 3_600_000).toISOString(), solicitadoPor: "Rosemeri Tuono", solicitadoEm: new Date(Date.now() - 25 * 60_000).toISOString(), status: "disponivel", progressoPct: 100, motivo: "Análise de sinistro" },
  { id: "sg2", veiculoId: "v5", canal: 2, inicio: new Date(Date.now() - 8 * 3_600_000).toISOString(), fim: new Date(Date.now() - 7.5 * 3_600_000).toISOString(), solicitadoPor: "Vitor Duarte", solicitadoEm: new Date(Date.now() - 6 * 60_000).toISOString(), status: "baixando", progressoPct: 43, motivo: "Reclamação de passageiro" },
];

/* ---- Padrão de condução por linha ---- */
import type { PadraoLinha } from "@/types";

export const MOCK_PADROES_LINHA: PadraoLinha[] = [
  {
    id: "pdl1", linhaId: "l1", faixaHorariaId: null,
    indicadores: {
      verde: { esperado: 64 },
      extra_economica: { esperado: 31 },
      parado_motor_ligado: { esperado: 11 },
    },
    observacao: "Corredor com muitos semáforos; ociosidade maior que a média da frota.",
    atualizadoEm: new Date(Date.now() - 6 * 86_400_000).toISOString(), atualizadoPor: "Marco Taborda",
  },
  {
    id: "pdl2", linhaId: "l1", faixaHorariaId: "pico_manha",
    indicadores: {
      parado_motor_ligado: { esperado: 16 },
      verde: { esperado: 58 },
      baixa_velocidade: { esperado: 14 },
    },
    observacao: "Congestionamento entre a Paulista e o HC; ociosidade sobe muito.",
    atualizadoEm: new Date(Date.now() - 2 * 86_400_000).toISOString(), atualizadoPor: "Marco Taborda",
  },
  {
    id: "pdl3", linhaId: "l3", faixaHorariaId: null,
    indicadores: { verde: { esperado: 69 }, vermelha: { esperado: 2 } },
    observacao: "Via expressa, poucos pontos. Padrão mais exigente que o global.",
    atualizadoEm: new Date(Date.now() - 20 * 86_400_000).toISOString(), atualizadoPor: "Rafael Sabini",
  },
];

/**
 * Amostra observada por contexto, para o botão de sugestão. Em produção isso
 * sai das viagens realizadas; aqui é um resumo pré-calculado.
 */
export const MOCK_AMOSTRA_CONTEXTO: Record<string, { viagens: number; p75: Record<string, number> }> = {
  "l1|null": { viagens: 1284, p75: { verde: 63, extra_economica: 30, amarela: 9, vermelha: 3, parado_motor_ligado: 12, inercia: 19, baixa_velocidade: 9, sem_tracao: 4 } },
  "l1|pico_manha": { viagens: 342, p75: { verde: 57, extra_economica: 24, amarela: 12, vermelha: 4, parado_motor_ligado: 17, inercia: 15, baixa_velocidade: 15, sem_tracao: 6 } },
  "l1|entrepico": { viagens: 511, p75: { verde: 67, extra_economica: 34, amarela: 7, vermelha: 2, parado_motor_ligado: 8, inercia: 22, baixa_velocidade: 6, sem_tracao: 3 } },
  "l1|pico_tarde": { viagens: 298, p75: { verde: 56, extra_economica: 23, amarela: 13, vermelha: 5, parado_motor_ligado: 18, inercia: 14, baixa_velocidade: 16, sem_tracao: 6 } },
  "l1|noturno": { viagens: 133, p75: { verde: 71, extra_economica: 38, amarela: 6, vermelha: 2, parado_motor_ligado: 5, inercia: 25, baixa_velocidade: 4, sem_tracao: 2 } },
  "l2|null": { viagens: 967, p75: { verde: 61, extra_economica: 28, amarela: 10, vermelha: 3, parado_motor_ligado: 13, inercia: 18, baixa_velocidade: 10, sem_tracao: 4 } },
  "l3|null": { viagens: 604, p75: { verde: 70, extra_economica: 36, amarela: 6, vermelha: 2, parado_motor_ligado: 7, inercia: 23, baixa_velocidade: 5, sem_tracao: 3 } },
  "l3|pico_manha": { viagens: 21, p75: { verde: 66, extra_economica: 31, parado_motor_ligado: 9 } },
};

/* ---- Desempenho por viagem, para a nota contextual ---- */
import type { DesempenhoViagem } from "@/lib/scoring";

/**
 * Viagens com indicadores observados. Em produção isso vem do processamento da
 * telemetria por viagem; aqui é uma amostra que cobre motoristas em linhas e
 * faixas diferentes, para a nota contextual ter o que comparar.
 *
 * Os valores foram montados para reproduzir o caso descrito pelo cliente: o
 * mesmo motorista parece bom numa linha fácil e ruim numa difícil quando se usa
 * a média geral, e o quadro muda ao comparar com o padrão de cada linha.
 */
const gerarViagens = (): DesempenhoViagem[] => {
  const out: DesempenhoViagem[] = [];
  const cfgs: {
    mot: string; linha: string; veic: string; partidas: string[]; km: number;
    base: Record<string, number>;
  }[] = [
    // Marco: roda a 8207 no pico (difícil) e a 3450 no entrepico (fácil).
    { mot: "m1", linha: "l1", veic: "v1", partidas: ["06:12", "07:05", "06:48"], km: 18.4,
      base: { verde: 59, extra_economica: 26, amarela: 10, vermelha: 3, parado_motor_ligado: 15, inercia: 17, baixa_velocidade: 13, sem_tracao: 5 } },
    { mot: "m1", linha: "l3", veic: "v9", partidas: ["10:20", "11:40"], km: 11.2,
      base: { verde: 71, extra_economica: 37, amarela: 6, vermelha: 2, parado_motor_ligado: 6, inercia: 24, baixa_velocidade: 4, sem_tracao: 2 } },

    // Najla: só entrepico na 8207 — contexto mais leve.
    { mot: "m2", linha: "l1", veic: "v2", partidas: ["09:30", "13:15", "14:50"], km: 18.4,
      base: { verde: 64, extra_economica: 31, amarela: 8, vermelha: 3, parado_motor_ligado: 9, inercia: 20, baixa_velocidade: 7, sem_tracao: 4 } },

    // Remildo: pico da 8207, desempenho fraco mesmo para o contexto.
    { mot: "m3", linha: "l1", veic: "v3", partidas: ["06:30", "07:20", "17:10"], km: 18.4,
      base: { verde: 48, extra_economica: 17, amarela: 16, vermelha: 7, parado_motor_ligado: 23, inercia: 11, baixa_velocidade: 19, sem_tracao: 9 } },

    // Richard: noturno na 8207 — contexto fácil, números altos.
    { mot: "m4", linha: "l1", veic: "v8", partidas: ["20:40", "22:10", "21:25"], km: 18.4,
      base: { verde: 72, extra_economica: 39, amarela: 5, vermelha: 1, parado_motor_ligado: 4, inercia: 26, baixa_velocidade: 3, sem_tracao: 2 } },
    { mot: "m4", linha: "l3", veic: "v10", partidas: ["19:50"], km: 11.2,
      base: { verde: 68, extra_economica: 33, amarela: 7, vermelha: 2, parado_motor_ligado: 8, inercia: 21, baixa_velocidade: 6, sem_tracao: 3 } },

    // Rafael: pico tarde na 8207, com oscilação.
    { mot: "m5", linha: "l1", veic: "v5", partidas: ["17:30", "18:15"], km: 18.4,
      base: { verde: 55, extra_economica: 22, amarela: 13, vermelha: 5, parado_motor_ligado: 19, inercia: 13, baixa_velocidade: 17, sem_tracao: 7 } },
    { mot: "m5", linha: "l2", veic: "v6", partidas: ["12:40"], km: 15.0,
      base: { verde: 63, extra_economica: 29, amarela: 9, vermelha: 3, parado_motor_ligado: 11, inercia: 19, baixa_velocidade: 8, sem_tracao: 4 } },
  ];

  let n = 0;
  for (const c of cfgs) {
    for (const p of c.partidas) {
      n++;
      // Pequena variação por viagem, determinística, para não parecer sintético.
      const jitter = (chave: string) => Math.round((c.base[chave] ?? 0) * (1 + ((n % 5) - 2) * 0.02) * 10) / 10;
      out.push({
        id: `dv${n}`,
        motoristaId: c.mot,
        linhaId: c.linha,
        veiculoId: c.veic,
        partida: p,
        data: new Date(Date.now() - (n % 20) * 86_400_000).toISOString().slice(0, 10),
        km: c.km,
        observado: Object.fromEntries(Object.keys(c.base).map((k) => [k, jitter(k)])),
      });
    }
  }
  return out;
};

export const MOCK_DESEMPENHO_VIAGENS: DesempenhoViagem[] = gerarViagens();

export const desempenhoDoMotorista = (motoristaId: string) =>
  MOCK_DESEMPENHO_VIAGENS.filter((v) => v.motoristaId === motoristaId);

/** Mapeia nome → id, já que as telas de motorista navegam por nome. */
export const motoristaIdPorNome = (nome: string) =>
  MOCK_MOTORISTAS.find((m) => m.nome.toLowerCase() === nome.toLowerCase())?.id;

/* ------------------------------------------------------------------ */
/* Catálogo de manutenção do fabricante                                */
/* ------------------------------------------------------------------ */

import type { Montadora, ModeloVeiculo, ParametroManutencao, RegraAjuste } from "@/types";

/**
 * Semente do catálogo, extraída do levantamento de planos de manutenção
 * preventiva de fabricante (frota comercial Brasil, ano-modelo 2010+).
 *
 * A procedência de cada linha foi preservada: onde a fonte pública não trouxe o
 * número, o parâmetro entra como `nao_localizado` e NÃO dispara alerta — vira
 * pendência de confirmação com a concessionária. Estimar número nesse caso
 * seria pior que não ter.
 */

export const MOCK_MONTADORAS: Montadora[] = [
  { id: "mt-scania", nome: "Scania", tipo: "chassi" },
  { id: "mt-volvo", nome: "Volvo", tipo: "chassi" },
  { id: "mt-mb", nome: "Mercedes-Benz", tipo: "chassi" },
  { id: "mt-vw", nome: "VW / MAN", tipo: "chassi" },
  { id: "mt-iveco", nome: "Iveco", tipo: "chassi" },
  { id: "mt-agrale", nome: "Agrale", tipo: "chassi" },
  { id: "mt-byd", nome: "BYD", tipo: "encarroçado" },
  { id: "mt-volare", nome: "Marcopolo / Volare", tipo: "encarroçado" },
  { id: "mt-carroceria", nome: "Carrocerias (Marcopolo, Caio, Comil, Busscar)", tipo: "carroceria" },
];

export const MOCK_MODELOS: ModeloVeiculo[] = [
  // Scania — a base mais completa do levantamento.
  { id: "md-sc-k-dc13", montadoraId: "mt-scania", nome: "K / F (ônibus) — DC13", motor: "DC13 (13 L)", anos: "2010+", faseProconve: "Euro 5 / Euro 6", propulsao: "diesel" },
  { id: "md-sc-k-dc09", montadoraId: "mt-scania", nome: "K / F (ônibus) — DC09", motor: "DC09 (9 L)", anos: "2010+", faseProconve: "Euro 5 / Euro 6", propulsao: "diesel" },
  { id: "md-sc-k-dc07", montadoraId: "mt-scania", nome: "K / F (ônibus) — DC07", motor: "DC07 (7 L)", anos: "2010+", faseProconve: "Euro 5 / Euro 6", propulsao: "diesel" },

  // Volvo
  { id: "md-vo-urbano", montadoraId: "mt-volvo", nome: "B270F / B250R / B7R / B8R — urbano", motor: "MWM 7.2 / D8 / D11", anos: "2010+", faseProconve: "Euro 5/6", propulsao: "diesel" },
  { id: "md-vo-rodo", montadoraId: "mt-volvo", nome: "B270F / B250R / B290R / B7R / B8R / B9R / B11R", motor: "MWM 7.2 / D8 / D11 / D13", anos: "2010+", faseProconve: "Euro 5/6", propulsao: "diesel" },
  { id: "md-vo-bzl", montadoraId: "mt-volvo", nome: "BZL (elétrico)", motor: "Elétrico", anos: "2022+", faseProconve: "Zero emissão", propulsao: "eletrico" },

  // Mercedes-Benz — maior frota urbana do país e a maior lacuna de dados.
  { id: "md-mb-of", montadoraId: "mt-mb", nome: "OF / OH (urbano)", motor: "OM 924 / OM 926", anos: "2010+", faseProconve: "Euro 5 (P7) / Euro 6 (P8)", propulsao: "diesel" },
  { id: "md-mb-o500", montadoraId: "mt-mb", nome: "O-500 / OC-500", motor: "OM 457 / OM 471", anos: "2010+", faseProconve: "Euro 5 (P7) / Euro 6 (P8)", propulsao: "diesel" },

  // VW / MAN
  { id: "md-vw-volksbus", montadoraId: "mt-vw", nome: "Volksbus 15.190 / 17.230 / 17.260 / 18.280", motor: "MAN D08", anos: "2010+", faseProconve: "Euro 5/6", propulsao: "diesel" },

  // BYD
  { id: "md-byd-d9w", montadoraId: "mt-byd", nome: "D9W / D11B (elétrico)", motor: "2 motores de 150 kW no eixo traseiro", anos: "2018+", faseProconve: "Zero emissão", propulsao: "eletrico" },

  // Agrale
  { id: "md-ag-ma", montadoraId: "mt-agrale", nome: "MA 8.5 / MA 9.2 / MA 10.0 / MA 12.0", motor: "Cummins ISF 3.8 / MWM", anos: "2010+", propulsao: "diesel" },

  // Carrocerias
  { id: "md-carr-urbana", montadoraId: "mt-carroceria", nome: "Carrocerias urbanas e rodoviárias", anos: "2010+" },
];

const FONTE_SCANIA = "Scania — Prefácio da manutenção periódica 00:17-30, Séries L/P/G/R/S, Ed. 29 pt-BR";
const FONTE_VOLVO = "volvotrucks.com.br / volvopecas.com.br / oleocerto.com";
const FONTE_MB = "mercedes-benz-trucks.com.br / release MB OM 471";

let seqParam = 0;
const par = (p: Omit<ParametroManutencao, "id" | "ativo"> & { ativo?: boolean }): ParametroManutencao => ({
  id: `pm${++seqParam}`,
  ativo: p.ativo ?? true,
  ...p,
});

/** Óleo do motor Scania: seis intervalos, um por tipo de operação. */
const oleoScania = (modeloId: string, esp: string, km: Record<string, number>) =>
  (Object.entries(km) as [ParametroManutencao["tipoOperacao"] & string, number][]).map(([op, v]) =>
    par({
      modeloId, tipoOperacao: op as never, sistema: "Motor",
      item: "Óleo do motor + filtro de óleo", acao: "Trocar",
      intervaloKm: v, intervaloMeses: 18, intervaloHoras: null,
      especificacao: esp,
      obsUsoSevero:
        "Intervalo = distância OU 1,5 ano, o que ocorrer primeiro. Diesel 351-1000 ppm S: dividir por 1,5; 1001-2000 ppm: dividir por 2.",
      statusDado: "oficial", fonte: FONTE_SCANIA,
    }),
  );

export const MOCK_PARAMETROS: ParametroManutencao[] = [
  ...oleoScania("md-sc-k-dc13", "LDF-4 ou LDF-3", {
    longa_muito_leve: 120000, longa_leve: 90000, longa: 60000, longa_pesado: 45000, construcao: 20000, urbano: 45000,
  }),
  ...oleoScania("md-sc-k-dc09", "LDF-4 / LDF-3", {
    longa_muito_leve: 90000, longa_leve: 90000, longa: 60000, longa_pesado: 30000, construcao: 20000, urbano: 45000,
  }),
  ...oleoScania("md-sc-k-dc07", "LDF-4 / LDF-3", {
    longa_muito_leve: 60000, longa_leve: 60000, longa: 45000, longa_pesado: 30000, construcao: 20000, urbano: 45000,
  }),

  // Volvo — a regra de marcha-lenta é a base do ajuste adaptativo.
  par({ modeloId: "md-vo-urbano", tipoOperacao: "urbano", sistema: "Motor", item: "Óleo do motor + filtro", acao: "Trocar", intervaloKm: 30000, intervaloMeses: 12, intervaloHoras: null, especificacao: "VDS conforme fase (Euro 6 = VDS-4.5)", obsUsoSevero: "Rotas de baixa velocidade reduzem o intervalo de 40.000 para 30.000 km. Marcha-lenta acima de 30% reduz mais um nível.", statusDado: "divulgado", fonte: FONTE_VOLVO }),
  par({ modeloId: "md-vo-rodo", tipoOperacao: "longa", sistema: "Motor", item: "Óleo do motor + filtro", acao: "Trocar", intervaloKm: 40000, intervaloMeses: 12, intervaloHoras: null, especificacao: "VDS conforme fase", obsUsoSevero: "Exige filtro original Volvo. Velocidade média acima de 15 km/h.", statusDado: "divulgado", fonte: FONTE_VOLVO }),
  par({ modeloId: "md-vo-bzl", tipoOperacao: "urbano", sistema: "Trem de força elétrico", item: "Plano de manutenção do chassi elétrico", acao: "Inspecionar", intervaloKm: null, intervaloMeses: null, intervaloHoras: null, especificacao: "n/a — sem óleo de motor", statusDado: "nao_localizado", fonte: "Buscar manual do chassi BZL na Volvo Bus" }),

  // Mercedes-Benz — escopo conhecido, números não. Fica explícito.
  ...[
    ["Motor", "Óleo do motor + filtro de óleo", "Euro 5: MB 228.3 (15W-40 mineral). Euro 6 (OM 471): MB 228.31 / 228.51 Low-SAPS"],
    ["Alimentação", "Filtro de combustível", "Original MB"],
    ["Alimentação", "Filtro separador de água (racor)", "Original MB"],
    ["Admissão", "Filtro de ar", "Original MB"],
    ["Ar comprimido", "Filtro secador de ar (APU)", "Cartucho secador"],
    ["Transmissão", "Óleo da caixa de câmbio", "Conforme aplicação"],
    ["Eixo", "Óleo do diferencial / eixo traseiro", "Linha MB 235.x"],
    ["Arrefecimento", "Fluido de arrefecimento + aditivo", "Aditivo homologado MB (OAT/HOAT)"],
    ["Freios", "Lonas/pastilhas, tambores/discos", "Original MB"],
    ["Pós-tratamento", "Filtro de ureia / sistema SCR-ARLA 32", "ARLA 32 — ABNT NBR 16700"],
  ].flatMap(([sistema, item, esp]) =>
    ["md-mb-of", "md-mb-o500"].map((modeloId) =>
      par({
        modeloId, tipoOperacao: null, sistema, item, acao: "Trocar/Inspecionar",
        intervaloKm: null, intervaloMeses: null, intervaloHoras: null,
        especificacao: esp,
        obsUsoSevero: "Uso severo reduz o intervalo — ver manual do chassi.",
        statusDado: "nao_localizado",
        fonte: FONTE_MB + " — km exato por marco não localizado em fonte aberta",
      }),
    ),
  ),

  // VW / MAN
  par({ modeloId: "md-vw-volksbus", tipoOperacao: "urbano", sistema: "Geral", item: "Revisões escalonadas MP1 a MP5", acao: "Inspecionar/Trocar", intervaloKm: null, intervaloMeses: null, intervaloHoras: null, especificacao: "Grupo II = urbano", statusDado: "nao_localizado", fonte: "VW Caminhões e Ônibus — estrutura MP1-MP5 confirmada, km por marco não localizado" }),

  // BYD — elétrico, sem óleo de motor.
  ...[
    ["Freios", "Fluido de freio"],
    ["Freios", "Freio regenerativo a disco com ABS"],
    ["Freios", "Interruptor EPB (freio de estacionamento elétrico)"],
    ["Pneus", "Calibragem de pneus"],
    ["Tração", "Bateria de tração e componentes elétricos"],
    ["Segurança", "Sistema automático anti-incêndio"],
  ].map(([sistema, item]) =>
    par({
      modeloId: "md-byd-d9w", tipoOperacao: "urbano", sistema, item, acao: "Inspecionar",
      intervaloKm: null, intervaloMeses: 6, intervaloHoras: null,
      especificacao: "n/a — sem troca de óleo de motor",
      statusDado: "oficial", fonte: "BYD — manual do chassi D9W / D11B",
    }),
  ),

  // Carroceria — itens que o plano de chassi não cobre.
  ...[
    "Estrutura e reaperto de fixações",
    "Ar-condicionado (filtro, gás, limpeza do evaporador)",
    "Portas pneumáticas",
    "Elevador / rampa PCD",
    "Chicote elétrico",
    "Vedações e borrachas",
  ].map((item) =>
    par({
      modeloId: "md-carr-urbana", tipoOperacao: null, sistema: "Carroceria", item, acao: "Inspecionar",
      intervaloKm: null, intervaloMeses: null, intervaloHoras: null,
      statusDado: "nao_localizado",
      fonte: "Encarroçadoras — intervalo numérico não divulgado em fonte aberta",
    }),
  ),
];

/**
 * Regras de ajuste automático. A da Volvo é publicada pelo fabricante e usa um
 * dado que o sistema já coleta; as demais derivam do perfil de operação urbana
 * descrito pela Scania.
 */
export const MOCK_REGRAS_AJUSTE: RegraAjuste[] = [
  {
    id: "ra1", nome: "Marcha-lenta elevada reduz o intervalo",
    indicador: "parado_motor_ligado", operador: "maior_que", limiar: 30, fator: 0.7,
    montadoraId: "mt-volvo",
    fonte: "Volvo — marcha-lenta acima de 30% obriga a usar o intervalo imediatamente menor",
    ativa: true,
  },
  {
    id: "ra2", nome: "Marcha-lenta acima de 25% classifica como operação urbana",
    indicador: "parado_motor_ligado", operador: "maior_que", limiar: 25, fator: 1,
    montadoraId: "mt-scania",
    fonte: "Scania — perfil da Operação 4: marcha-lenta + PTO acima de 25%, mais de 250 paradas/dia, velocidade média abaixo de 40 km/h",
    ativa: true,
  },
  {
    id: "ra3", nome: "Velocidade média baixa reduz o intervalo",
    indicador: "velocidade_media", operador: "menor_que", limiar: 15, fator: 0.75,
    montadoraId: "mt-volvo",
    fonte: "Volvo — rotas de baixa velocidade reduzem o intervalo de 40.000 para 30.000 km",
    ativa: true,
  },
];

export const modelosDaMontadora = (montadoraId: string) =>
  MOCK_MODELOS.filter((m) => m.montadoraId === montadoraId);

export const parametrosDoModelo = (modeloId: string) =>
  MOCK_PARAMETROS.filter((p) => p.modeloId === modeloId);

/* ---- Execuções e sinais de operação, para a preventiva ---- */
import type { ExecucaoManutencao } from "@/types";

/** Vínculo veículo → modelo do catálogo. */
export const MOCK_VEICULO_MODELO: Record<string, { modeloId: string; montadoraId: string }> = {
  v1: { modeloId: "md-sc-k-dc13", montadoraId: "mt-scania" },
  v2: { modeloId: "md-sc-k-dc09", montadoraId: "mt-scania" },
  v3: { modeloId: "md-mb-of", montadoraId: "mt-mb" },
  v4: { modeloId: "md-vo-urbano", montadoraId: "mt-volvo" },
  v5: { modeloId: "md-vo-urbano", montadoraId: "mt-volvo" },
  v6: { modeloId: "md-sc-k-dc07", montadoraId: "mt-scania" },
  v7: { modeloId: "md-sc-k-dc13", montadoraId: "mt-scania" },
  v8: { modeloId: "md-vw-volksbus", montadoraId: "mt-vw" },
  v9: { modeloId: "md-mb-o500", montadoraId: "mt-mb" },
  v10: { modeloId: "md-byd-d9w", montadoraId: "mt-byd" },
};

/**
 * Sinais de operação por veículo, usados para classificar o tipo de operação e
 * disparar as regras de ajuste. Vêm da telemetria já coletada.
 */
export const MOCK_SINAIS_OPERACAO: Record<string, Record<string, number>> = {
  v1: { parado_motor_ligado: 9, velocidade_media: 34, paradas_por_dia: 210 },
  v2: { parado_motor_ligado: 14, velocidade_media: 31, paradas_por_dia: 268 },
  v3: { parado_motor_ligado: 34, velocidade_media: 22, paradas_por_dia: 312 },
  v4: { parado_motor_ligado: 18, velocidade_media: 28, paradas_por_dia: 240 },
  v5: { parado_motor_ligado: 37, velocidade_media: 19, paradas_por_dia: 330 },
  v6: { parado_motor_ligado: 11, velocidade_media: 36, paradas_por_dia: 190 },
  v7: { parado_motor_ligado: 8, velocidade_media: 41, paradas_por_dia: 150 },
  v8: { parado_motor_ligado: 21, velocidade_media: 26, paradas_por_dia: 288 },
  v9: { parado_motor_ligado: 16, velocidade_media: 33, paradas_por_dia: 224 },
  v10: { parado_motor_ligado: 12, velocidade_media: 24, paradas_por_dia: 296 },
};

const diasAtrasIso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

/**
 * Histórico de execução. Foi montado para produzir uma distribuição realista:
 * alguns itens recém-feitos, outros no meio do intervalo, e alguns já vencidos.
 */
export const MOCK_EXECUCOES: ExecucaoManutencao[] = (() => {
  const out: ExecucaoManutencao[] = [];
  let n = 0;
  const add = (veiculoId: string, parametroId: string, diasAtras: number, kmAntes: number) => {
    const v = MOCK_VEICULOS.find((x) => x.id === veiculoId);
    if (!v) return;
    out.push({
      id: `ex${++n}`,
      veiculoId,
      parametroId,
      em: diasAtrasIso(diasAtras),
      odometro: Math.max(0, v.odometro - kmAntes),
    });
  };

  // Scania — óleo do motor na operação urbana (45.000 km).
  add("v1", MOCK_PARAMETROS.find((p) => p.modeloId === "md-sc-k-dc13" && p.tipoOperacao === "urbano")?.id ?? "", 90, 38000);
  add("v2", MOCK_PARAMETROS.find((p) => p.modeloId === "md-sc-k-dc09" && p.tipoOperacao === "urbano")?.id ?? "", 210, 46500);
  add("v6", MOCK_PARAMETROS.find((p) => p.modeloId === "md-sc-k-dc07" && p.tipoOperacao === "urbano")?.id ?? "", 40, 12000);
  add("v7", MOCK_PARAMETROS.find((p) => p.modeloId === "md-sc-k-dc13" && p.tipoOperacao === "urbano")?.id ?? "", 150, 33000);

  // Volvo urbano (30.000 km) — v5 tem marcha-lenta alta e sofre ajuste.
  const volvoOleo = MOCK_PARAMETROS.find((p) => p.modeloId === "md-vo-urbano" && p.sistema === "Motor")?.id ?? "";
  add("v4", volvoOleo, 120, 19000);
  add("v5", volvoOleo, 200, 24800);

  // BYD — itens por prazo, não por km.
  for (const p of MOCK_PARAMETROS.filter((x) => x.modeloId === "md-byd-d9w").slice(0, 4)) {
    add("v10", p.id, 160, 9000);
  }

  return out;
})();

export const execucoesDoVeiculo = (veiculoId: string) =>
  MOCK_EXECUCOES.filter((e) => e.veiculoId === veiculoId);
