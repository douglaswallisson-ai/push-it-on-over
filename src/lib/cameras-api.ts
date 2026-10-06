import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usandoMock } from "@/lib/modo";

/**
 * Câmeras ao vivo com dados reais (ss-fleet-core, endpoints/cameras.py).
 *
 * Mesmo caminho da tela "Vídeos Online" da plataforma de câmeras: JIMI JC450
 * em FLV e Hikvision G40/G40 PRO em HLS. O navegador fala só com o nosso
 * backend, que guarda as chaves e confere o acesso ao veículo.
 */

export type VeiculoCamera = {
  unit_id: number;
  placa: string;
  prefixo: string | null;
  codigo: string | null;
  modelo_id: number | null;
  modelo: string | null;
  ultima_posicao: string | null;
  velocidade: number | null;
  ignicao: boolean | null;
  latitude: number | null;
  longitude: number | null;
  endereco: string | null;
  motorista: string | null;
  ponto: string | null;
  cerca: string | null;
  integracao: "jimi" | "hikvision" | null;
  /** O modelo tem vídeo ao vivo (MV03 não tem, nem na plataforma de câmeras). */
  ao_vivo: boolean;
  /** null = não deu para consultar (serviço fora do ar ou não configurado). */
  online: boolean | null;
};

export type RespostaCameras = {
  veiculos: VeiculoCamera[];
  canais: number;
  configurado: { jimi: boolean; hikvision: boolean };
  avisos: string[];
};

export type Transmissao = { url: string; formato: "flv" | "hls"; canal: number };

const B = "/api/v1/cameras";

export const camerasQuery = (g?: string) =>
  queryOptions({
    queryKey: ["cameras", "veiculos", g ?? ""],
    queryFn: () => api.get<RespostaCameras>(`${B}/veiculos?group_id=${g}`),
    enabled: !usandoMock() && Boolean(g),
    refetchInterval: 60_000,
  });

export const Cameras = {
  abrir: (unit_id: number, canal: number) =>
    api.post<Transmissao>(`${B}/ao-vivo`, { unit_id, canal }),
};
