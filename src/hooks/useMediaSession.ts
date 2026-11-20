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
  /** Ao vivo na TV: as ações de mídia da LG viram as setas (abrir a lista); o filme não usa. */
  midiaNaTv?: boolean;
}) {
  const { titulo, subtitulo, capa, aoTocar, aoPausar, aoVoltar, aoAvancar, aoProximo, aoAnterior, midiaNaTv } = opcoes;
  useEffect(() => {
    if (!('mediaSession' in navigator) || !titulo) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({
      title: titulo,
      artist: subtitulo ?? 'Saimo TV',
      artwork: capa ? [{ src: capa, sizes: '512x512' }] : [{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    });
    // Na TV (LG, Samsung) "voltar/avançar" do sistema nunca mexe no tempo: a LG
    // manda as setas do controle por aqui mesmo com o foco nos botões do player.
    // Na TV o tempo só anda pela barra de progresso em foco (MoviePlayer).
    // Um manipulador vazio (e não nenhum): assim a TV entrega a ação para nós, que a ignoramos.
    const nada = () => { /* na TV, o tempo é da barra */ };
    const soSemFoco = (fn?: () => void) => (ehTv() && !midiaNaTv ? (fn ? nada : undefined) : fn);
    const acoes: [MediaSessionAction, (() => void) | undefined][] = [
      ['play', aoTocar], ['pause', aoPausar], ['seekbackward', soSemFoco(aoVoltar)], ['seekforward', soSemFoco(aoAvancar)],
      ['nexttrack', aoProximo], ['previoustrack', aoAnterior],
    ];
    for (const [acao, fn] of acoes) {
      try { ms.setActionHandler(acao, fn ?? null); } catch { /* ação não suportada */ }
    }
    return () => {
      for (const [acao] of acoes) {
        try { ms.setActionHandler(acao, null); } catch { /* idem */ }
      }
    };
  }, [titulo, subtitulo, capa, aoTocar, aoPausar, aoVoltar, aoAvancar, aoProximo, aoAnterior, midiaNaTv]);
}
