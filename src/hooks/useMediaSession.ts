import { useEffect } from 'react';
import { ehTv } from '../plataforma/tv';

/**
 * Título, capa e botões do vídeo nos controles do sistema: a tela de bloqueio
 * do celular, a notificação de mídia do Android, as teclas de mídia do
 * teclado e o controle do fone Bluetooth.
 */
export function useMediaSession(opcoes: {
  titulo?: string;
  subtitulo?: string;
  capa?: string;
  aoTocar?: () => void;
  aoPausar?: () => void;
  aoVoltar?: () => void;
  aoAvancar?: () => void;
  aoProximo?: () => void;
  aoAnterior?: () => void;
}) {
  const { titulo, subtitulo, capa, aoTocar, aoPausar, aoVoltar, aoAvancar, aoProximo, aoAnterior } = opcoes;
  useEffect(() => {
    // Na TV (Samsung Tizen e LG webOS) as teclas são tratadas direto pelo app (tv.ts);
    // registrar MediaSession na TV conflita com o pipeline nativo de vídeo (canais ao vivo e filmes).
    if (ehTv()) return;
    if (!('mediaSession' in navigator) || !titulo) return;
    const ms = navigator.mediaSession;
    if (typeof MediaMetadata !== 'undefined') {
      try {
        ms.metadata = new MediaMetadata({
          title: titulo,
          artist: subtitulo ?? 'Saimo TV',
          artwork: capa ? [{ src: capa, sizes: '512x512' }] : [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
        });
      } catch { /* sem suporte completo */ }
    }
    const acoes: [MediaSessionAction, (() => void) | undefined][] = [
      ['play', aoTocar], ['pause', aoPausar], ['seekbackward', aoVoltar], ['seekforward', aoAvancar],
      ['nexttrack', aoProximo], ['previoustrack', aoAnterior],
    ];
    for (const [acao, fn] of acoes) {
      if (fn) {
        try { ms.setActionHandler(acao, fn); } catch { /* ação não suportada neste navegador */ }
      }
    }
    return () => {
      for (const [acao] of acoes) {
        try { ms.setActionHandler(acao, null); } catch { /* idem */ }
      }
    };
  }, [titulo, subtitulo, capa, aoTocar, aoPausar, aoVoltar, aoAvancar, aoProximo, aoAnterior]);
}
