/**
 * Ícone do veículo no mapa, pelo tipo do cadastro (`mova.unit_category`).
 *
 * Fica fora do MapaLeaflet de propósito: as telas importam daqui sem puxar o
 * Leaflet (que quebra a renderização no servidor).
 *
 * Desenhos: ícones do Lucide (licença ISC), em traço branco sobre o círculo
 * na cor da situação do veículo.
 */

export type TipoVeiculo = "caminhao" | "onibus" | "van" | "carro" | "moto" | "maquina";

/** Categoria do cadastro → ícone. Sem categoria, caminhão (o mais comum na base). */
export function tipoPorCategoria(id: number | null | undefined): TipoVeiculo {
  switch (id) {
    case 12: // Ônibus
    case 22: // Micro ônibus
      return "onibus";
    case 1: // Passeio
    case 2: // Pickup
    case 10: // Carro forte
    case 14: // Ambulância
      return "carro";
    case 15: // Van (desenho próprio: o PM pediu van com figura de van, 06/10/2026)
      return "van";
    case 9:
      return "moto";
    case 5: // Niveladora
    case 6: // Socadora
    case 8: // Máquina
    case 23: // Máquina 2
      return "maquina";
    default: // 3 Pesados, 7 Pipa, 20 Carreta, 21 Tanque e sem categoria
      return "caminhao";
  }
}

export const NOME_TIPO: Record<TipoVeiculo, string> = {
  caminhao: "Caminhão",
  onibus: "Ônibus",
  van: "Van",
  carro: "Carro",
  moto: "Moto",
  maquina: "Máquina",
};

const TRACOS: Record<TipoVeiculo, string> = {
  caminhao:
    '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  onibus:
    '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  van: '<path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3"/><path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  carro:
    '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  moto: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  maquina:
    '<path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20"/><path d="M16 18h-5"/><path d="M18 5a1 1 0 0 0-1 1v5.573"/><path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246"/><path d="M4 11V4"/><path d="M8 10.1V4"/><circle cx="18" cy="18" r="2"/><circle cx="7" cy="15" r="5"/>',
};

export function svgVeiculo(tipo: TipoVeiculo, tamanho = 18) {
  return `<svg viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRACOS[tipo]}</svg>`;
}

/**
 * Cor por situação — a mesma no marcador, na legenda e na lista. Leitura de
 * longe, num telão de CCO: verde andando, âmbar parado com motor ligado,
 * cinza desligado, grafite sem sinal; vermelho e laranja piscam porque
 * exigem ação.
 */
export const COR_SITUACAO: Record<string, string> = {
  em_viagem: "#2f9e44",
  ligado_parado: "#d6a419",
  desligado: "#7b8a9b",
  sem_transmissao: "#1c1c1c",
  evento_critico: "#c0392b",
  manutencao: "#e07b1a",
};
