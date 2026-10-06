import { useEffect, useRef } from "react";

/**
 * Player de vídeo ao vivo: FLV (JIMI) com mpegts.js e HLS (Hikvision) com hls.js.
 *
 * Regras copiadas do FLVPlayer da plataforma de câmeras:
 * - começa mudo (o navegador bloqueia autoplay com som);
 * - erro de rede = câmera sem sinal → avisa a tela, que tenta reabrir o canal;
 * - erro recuperável do hls.js repetido 3 vezes em 10 s → recria o player
 *   (até 2 vezes); depois disso desiste e avisa a tela.
 * As bibliotecas são carregadas só quando o player abre (não pesam nas outras telas).
 */

export type ErroPlayer = { categoria: "rede" | "player"; motivo: string };

const JANELA_MS = 10_000;
const ERROS_NA_JANELA = 3;
const MAX_RECRIAR = 2;

export function PlayerAoVivo({
  url,
  formato,
  onErro,
}: {
  url: string;
  formato: "flv" | "hls";
  onErro: (e: ErroPlayer) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const erroRef = useRef(onErro);
  erroRef.current = onErro;

  useEffect(() => {
    let destruido = false;
    let liberar: () => void = () => {};
    const el = video.current;
    if (!el) return;
    el.muted = true;

    (async () => {
      if (formato === "hls") {
        const Hls = (await import("hls.js")).default;
        if (destruido) return;
        if (!Hls.isSupported()) {
          // Safari toca HLS nativo.
          el.src = url;
          el.play().catch(() => {});
          return;
        }
        let recriacoes = 0;
        let marcas: number[] = [];
        const montar = () => {
          if (destruido) return;
          const hls = new Hls();
          liberar = () => hls.destroy();
          hls.on(Hls.Events.ERROR, (_ev, d) => {
            if (d.fatal) {
              erroRef.current({
                categoria: d.type === Hls.ErrorTypes.NETWORK_ERROR ? "rede" : "player",
                motivo: d.details,
              });
              return;
            }
            const agora = Date.now();
            marcas = [...marcas.filter((t) => agora - t < JANELA_MS), agora];
            if (marcas.length >= ERROS_NA_JANELA) {
              marcas = [];
              hls.destroy();
              recriacoes += 1;
              if (recriacoes <= MAX_RECRIAR) montar();
              else
                erroRef.current({
                  categoria: "player",
                  motivo: `${d.details} repetiu depois de recriar o player`,
                });
            }
          });
          hls.loadSource(url);
          hls.attachMedia(el);
          el.play().catch(() => {});
        };
        montar();
      } else {
        const mpegts = (await import("mpegts.js")).default;
        if (destruido) return;
        if (!mpegts.isSupported()) {
          erroRef.current({ categoria: "player", motivo: "Este navegador não reproduz FLV." });
          return;
        }
        const p = mpegts.createPlayer(
          { type: "flv", isLive: true, url },
          { enableStashBuffer: false, liveBufferLatencyChasing: true },
        );
        liberar = () => {
          p.pause();
          p.unload();
          p.detachMediaElement();
          p.destroy();
        };
        p.on(mpegts.Events.ERROR, (tipo: string, detalhe: string) => {
          erroRef.current({
            categoria: tipo === mpegts.ErrorTypes.NETWORK_ERROR ? "rede" : "player",
            motivo: detalhe || tipo,
          });
        });
        p.attachMediaElement(el);
        p.load();
        Promise.resolve(p.play()).catch(() => {});
      }
    })();

    return () => {
      destruido = true;
      liberar();
    };
  }, [url, formato]);

  return (
    <video ref={video} controls playsInline className="h-full w-full bg-black object-contain" />
  );
}
