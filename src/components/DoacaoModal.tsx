/**
 * DoacaoModal.tsx
 *
 * Mensagem elegante, bonita, discreta e ARRASTÁVEL sobre doações para manter o Saimo TV
 * 100% gratuito, sem anúncios e sem mensalidade.
 *
 * - Botão flutuante totalmente ARRASTÁVEL (Mouse e Touch) para não atrapalhar nenhuma tela.
 * - Lembra a posição escolhida pelo usuário no localStorage.
 * - Ao clicar (sem arrastar), abre modal informativo com explicação e QR code e Pix copia e cola (Pix direto).
 * - Desaparece IMEDIATAMENTE e COMPLETAMENTE em qualquer modo de tela cheia,
 *   theater mode ou player de vídeo/filme.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { elementoEmTelaCheia, EVENTOS_TELA_CHEIA } from '../utils/telaCheia';
import { EVENTO_ABRIR_DOACAO } from '../services/doacaoService';
import { DoacaoConteudo } from './DoacaoConteudo';
import './DoacaoModal.css';

interface Posicao {
  x: number;
  y: number;
}

const CHAVE_POSICAO = 'saimo-doacao-pos-v2';

function lerPosicaoSalva(): Posicao | null {
  try {
    const salvo = localStorage.getItem(CHAVE_POSICAO);
    if (salvo) {
      const parsed = JSON.parse(salvo);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        const larguraJanela = typeof window !== 'undefined' ? window.innerWidth : 1000;
        const alturaJanela = typeof window !== 'undefined' ? window.innerHeight : 800;
        const x = Math.max(10, Math.min(larguraJanela - 100, parsed.x));
        const y = Math.max(10, Math.min(alturaJanela - 50, parsed.y));
        return { x, y };
      }
    }
  } catch {
    /* leitura inválida: mantém null */
  }
  return null;
}

/**
 * Detecta se a interface está em qualquer modo de reprodução de tela cheia ou imersivo:
 * - Tela cheia nativa do navegador (document.fullscreenElement)
 * - Overlay do MoviePlayer (.movie-player-overlay)
 * - Theater mode da TV (.tv-page.theater-mode)
 * - Celular deitado assistindo (.tv-page.deitado.tocando)
 * - Player em tela cheia (.movie-player.fullscreen, .video-player-container.fullscreen)
 */
function useOcultarDoacao(): boolean {
  const [ocultar, setOcultar] = useState<boolean>(() => {
    return (
      Boolean(elementoEmTelaCheia()) ||
      Boolean(document.querySelector('.movie-player-overlay')) ||
      Boolean(document.querySelector('.tv-page.theater-mode')) ||
      Boolean(document.querySelector('.tv-page.deitado.tocando')) ||
      Boolean(document.querySelector('.movie-player.fullscreen, .video-player-container.fullscreen'))
    );
  });

  useEffect(() => {
    const verificar = () => {
      const emTelaCheia = Boolean(elementoEmTelaCheia());
      const temOverlayFilme = Boolean(document.querySelector('.movie-player-overlay'));
      const temTeatro = Boolean(document.querySelector('.tv-page.theater-mode'));
      const temDeitadoTocando = Boolean(document.querySelector('.tv-page.deitado.tocando'));
      const temVideoFullscreen = Boolean(
        document.querySelector('.movie-player.fullscreen, .video-player-container.fullscreen')
      );

      setOcultar(emTelaCheia || temOverlayFilme || temTeatro || temDeitadoTocando || temVideoFullscreen);
    };

    verificar();

    EVENTOS_TELA_CHEIA.forEach((ev) => document.addEventListener(ev, verificar));
    window.addEventListener('resize', verificar);

    // Observa mudanças de classe no body para detectar abertura de players
    const observer = new MutationObserver(verificar);
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });

    return () => {
      EVENTOS_TELA_CHEIA.forEach((ev) => document.removeEventListener(ev, verificar));
      window.removeEventListener('resize', verificar);
      observer.disconnect();
    };
  }, []);

  return ocultar;
}

export function DoacaoModal() {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<Posicao | null>(lerPosicaoSalva);
  const [arrastando, setArrastando] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const dragRef = useRef({
    ativo: false,
    inicioX: 0,
    inicioY: 0,
    btnX: 0,
    btnY: 0,
    moveu: false,
    ultimoX: 0,
    ultimoY: 0,
  });

  const deveOcultar = useOcultarDoacao();

  // Escuta evento global para abrir o modal de outros componentes
  useEffect(() => {
    const aoAbrir = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR_DOACAO, aoAbrir);
    return () => window.removeEventListener(EVENTO_ABRIR_DOACAO, aoAbrir);
  }, []);

  // Mantém a posição dentro dos limites se a tela for redimensionada
  useEffect(() => {
    const aoRedimensionar = () => {
      setPosicao((atual) => {
        if (!atual) return null;
        const btnLargura = btnRef.current?.offsetWidth || 160;
        const btnAltura = btnRef.current?.offsetHeight || 44;
        const clampedX = Math.max(10, Math.min(window.innerWidth - btnLargura - 10, atual.x));
        const clampedY = Math.max(10, Math.min(window.innerHeight - btnAltura - 10, atual.y));
        if (clampedX !== atual.x || clampedY !== atual.y) {
          return { x: clampedX, y: clampedY };
        }
        return atual;
      });
    };
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);

  // Fecha com a tecla Esc
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(false);
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aberto]);

  // Bloqueia scroll do body enquanto o modal estiver aberto
  useEffect(() => {
    if (aberto) {
      const estiloOriginal = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = estiloOriginal;
      };
    }
  }, [aberto]);

  const fechar = useCallback(() => {
    setAberto(false);
  }, []);

  // Controle de Arraste (Pointer Events universais para Mouse e Touch)
  const aoPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return; // Apenas clique principal

    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragRef.current = {
      ativo: true,
      inicioX: e.clientX,
      inicioY: e.clientY,
      btnX: rect.left,
      btnY: rect.top,
      moveu: false,
      ultimoX: rect.left,
      ultimoY: rect.top,
    };

    setArrastando(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ponteiro não capturado */
    }
  };

  const aoPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.ativo) return;

    const dx = e.clientX - dragRef.current.inicioX;
    const dy = e.clientY - dragRef.current.inicioY;

    // Distância mínima para diferenciar clique simples de arraste
    if (!dragRef.current.moveu && Math.hypot(dx, dy) > 5) {
      dragRef.current.moveu = true;
    }

    if (dragRef.current.moveu) {
      const btnLargura = btnRef.current?.offsetWidth || 160;
      const btnAltura = btnRef.current?.offsetHeight || 44;

      const novoX = Math.max(10, Math.min(window.innerWidth - btnLargura - 10, dragRef.current.btnX + dx));
      const novoY = Math.max(10, Math.min(window.innerHeight - btnAltura - 10, dragRef.current.btnY + dy));

      dragRef.current.ultimoX = novoX;
      dragRef.current.ultimoY = novoY;

      setPosicao({ x: novoX, y: novoY });
    }
  };

  const aoPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.ativo) return;

    const moveu = dragRef.current.moveu;
    const finalX = dragRef.current.ultimoX;
    const finalY = dragRef.current.ultimoY;

    dragRef.current.ativo = false;
    setArrastando(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* captura já liberada */
    }

    if (moveu) {
      // Salva a nova posição escolhida pelo usuário
      try {
        localStorage.setItem(CHAVE_POSICAO, JSON.stringify({ x: finalX, y: finalY }));
      } catch {
        /* storage indisponível */
      }
    } else {
      // Se não arrastou, abre o modal!
      setAberto(true);
    }
  };

  const aoPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    dragRef.current.ativo = false;
    setArrastando(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* captura cancelada */
    }
  };

  const aoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Suporte a ativação por teclado
    if (e.detail === 0) {
      setAberto(true);
    }
  };

  // Se o player estiver em tela cheia ou cinema, não renderiza absolutamente nada
  if (deveOcultar) {
    return null;
  }

  return (
    <>
      {/* Botão flutuante discreto e arrastável */}
      {!aberto && (
        <button
          ref={btnRef}
          type="button"
          className={`saimo-doacao-trigger ${arrastando ? 'arrastando' : ''}`}
          style={
            posicao
              ? {
                  left: `${posicao.x}px`,
                  top: `${posicao.y}px`,
                  right: 'auto',
                  bottom: 'auto',
                }
              : undefined
          }
          onPointerDown={aoPointerDown}
          onPointerMove={aoPointerMove}
          onPointerUp={aoPointerUp}
          onPointerCancel={aoPointerCancel}
          onClick={aoClick}
          title="Arraste para onde quiser ou clique para apoiar"
          aria-label="Apoiar o projeto Saimo TV (arrastável)"
        >
          {/* Alça visual de arraste */}
          <span className="saimo-doacao-grip" aria-hidden="true" title="Arraste">
            <svg viewBox="0 0 10 16" width="6" height="12" fill="currentColor">
              <circle cx="2" cy="2" r="1.5" />
              <circle cx="8" cy="2" r="1.5" />
              <circle cx="2" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="2" cy="14" r="1.5" />
              <circle cx="8" cy="14" r="1.5" />
            </svg>
          </span>

          <span className="saimo-doacao-trigger-glow" aria-hidden="true" />
          <span className="saimo-doacao-trigger-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </span>
          <span className="saimo-doacao-trigger-texto">Apoie o Saimo TV</span>
          <span className="saimo-doacao-trigger-badge">Sem ads</span>
        </button>
      )}

      {/* Modal explicativo */}
      {aberto && (
        <div
          className="saimo-doacao-backdrop"
          onClick={fechar}
          role="dialog"
          aria-modal="true"
          aria-labelledby="doacao-titulo"
        >
          <div className="saimo-doacao-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="saimo-doacao-fechar"
              onClick={fechar}
              aria-label="Fechar"
            >
              ✕
            </button>

            <DoacaoConteudo />
          </div>
        </div>
      )}
    </>
  );
}
