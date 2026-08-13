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
  { id: "v1", placa: "BCA7A56", marca: "Volvo", modelo: "FH 540", ano: 2022, operacao: "Longa distância", situacao: "em_rota", kml: 2.9, odometro: 812977 },
  { id: "v2", placa: "SXD1J61", marca: "Scania", modelo: "R 450", ano: 2021, operacao: "Longa distância", situacao: "em_rota", kml: 3.1, odometro: 489020 },
  { id: "v3", placa: "EBZ3590", marca: "Mercedes-Benz", modelo: "Actros 2651", ano: 2020, operacao: "Regional", situacao: "parado", kml: 2.6, odometro: 913006 },
  { id: "v4", placa: "QHH1360", marca: "DAF", modelo: "XF 480", ano: 2023, operacao: "Regional", situacao: "parado", kml: 2.8, odometro: 174320 },
  { id: "v5", placa: "LUO5I08", marca: "Volvo", modelo: "FH 460", ano: 2019, operacao: "Urbano", situacao: "manutencao", kml: 2.4, odometro: 1024500 },
  { id: "v6", placa: "JBE6H85", marca: "Iveco", modelo: "S-Way 480", ano: 2022, operacao: "Longa distância", situacao: "sem_sinal", kml: 2.7, odometro: 322110 },
  { id: "v7", placa: "SB157940", marca: "Scania", modelo: "P 320", ano: 2018, operacao: "Urbano", situacao: "parado", kml: 3.4, odometro: 640980 },
  { id: "v8", placa: "AYK7080", marca: "Volkswagen", modelo: "Constellation 25.460", ano: 2021, operacao: "Regional", situacao: "em_rota", kml: 3.0, odometro: 401220 },
  { id: "v9", placa: "TPA1106", marca: "Mercedes-Benz", modelo: "Axor 2544", ano: 2020, operacao: "Longa distância", situacao: "em_rota", kml: 2.5, odometro: 634210 },
  { id: "v10", placa: "GAP4C73", marca: "Ford", modelo: "Cargo 2429", ano: 2017, operacao: "Urbano", situacao: "parado", kml: 3.2, odometro: 201774 },
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
  { id: "a2", nome: "Cerca violada — Pátio", tipo: "cerca", condicao: "Saída fora de janela", severidade: "critico", canais: ["App", "SMS"], ativo: true },
  { id: "a3", nome: "Motor ligado parado", tipo: "ociosidade", condicao: "> 15 min parado", severidade: "atencao", canais: ["App"], ativo: true },
  { id: "a4", nome: "Pane seca iminente", tipo: "combustivel", condicao: "Nível < 8%", severidade: "atencao", canais: ["App", "E-mail"], ativo: false },
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
