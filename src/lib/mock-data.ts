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
