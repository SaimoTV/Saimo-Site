/**
 * DoacaoModal.tsx
 *
 * Mensagem elegante, bonita e discreta sobre doações para manter o Saimo TV
 * 100% gratuito, sem anúncios e sem mensalidade.
 *
 * - Botão flutuante sutil que acompanha todas as telas da plataforma.
 * - Ao clicar, abre modal informativo com explicação e botão direto para Deflow.
 * - Desaparece IMEDIATAMENTE e COMPLETAMENTE em qualquer modo de tela cheia,
 *   theater mode ou player de vídeo/filme.
 */

import { useState, useEffect, useCallback } from 'react';
import { elementoEmTelaCheia, EVENTOS_TELA_CHEIA } from '../utils/telaCheia';
import { LINK_DOACAO, EVENTO_ABRIR_DOACAO } from '../services/doacaoService';
import './DoacaoModal.css';

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
  const [copiado, setCopiado] = useState(false);
  const deveOcultar = useOcultarDoacao();

  // Escuta evento global para abrir o modal de outros componentes
  useEffect(() => {
    const aoAbrir = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR_DOACAO, aoAbrir);
    return () => window.removeEventListener(EVENTO_ABRIR_DOACAO, aoAbrir);
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

  const aoCopiarLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(LINK_DOACAO);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Fallback simples caso a Clipboard API seja bloqueada
      const input = document.createElement('input');
      input.value = LINK_DOACAO;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    }
  }, []);

  // Se o player estiver em tela cheia ou cinema, não renderiza absolutamente nada
  if (deveOcultar) {
    return null;
  }

  return (
    <>
      {/* Botão flutuante discreto */}
      {!aberto && (
        <button
          type="button"
          className="saimo-doacao-trigger"
          onClick={() => setAberto(true)}
          title="Apoie o projeto Saimo TV"
          aria-label="Apoiar o projeto Saimo TV"
        >
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

            <div className="saimo-doacao-cabecalho">
              <div className="saimo-doacao-tag">
                <span className="saimo-doacao-tag-ponto" />
                <span>Comunidade Saimo TV</span>
              </div>
              <h2 id="doacao-titulo" className="saimo-doacao-titulo">
                Ajude a manter tudo <span className="saimo-doacao-destaque">100% gratuito</span>
              </h2>
              <p className="saimo-doacao-subtitulo">
                Sem anúncios chatos, sem mensalidades e livre para todo mundo.
              </p>
            </div>

            <div className="saimo-doacao-historia">
              <p>
                O <strong>Saimo TV</strong> nasceu com um propósito claro: oferecer canais ao vivo, filmes e séries com rapidez e qualidade, <strong>sem propagandas invasivas e sem cobrar assinaturas</strong>.
              </p>
              <p>
                Manter servidores velozes, infraestrutura de transmissão e atualizações diárias gera custos reais todos os meses.
              </p>
              <div className="saimo-doacao-destaque-bloco">
                <span className="saimo-doacao-destaque-icone">💡</span>
                <p>
                  <strong>Quem puder ajudar com qualquer valor</strong>, cada contribuição faz uma diferença enorme para manter as máquinas ligadas e tudo livre de anúncios para todos!
                </p>
              </div>
            </div>

            <div className="saimo-doacao-vantagens">
              <div className="saimo-doacao-vantagem-item">
                <div className="saimo-doacao-vantagem-icone">🚫</div>
                <div className="saimo-doacao-vantagem-conteudo">
                  <strong>Zero Anúncios</strong>
                  <span>Nenhum comercial ou popup interrompendo você</span>
                </div>
              </div>
              <div className="saimo-doacao-vantagem-item">
                <div className="saimo-doacao-vantagem-icone">⚡</div>
                <div className="saimo-doacao-vantagem-conteudo">
                  <strong>Servidores Rápidos</strong>
                  <span>Streaming estável, liso e com alta largura de banda</span>
                </div>
              </div>
              <div className="saimo-doacao-vantagem-item">
                <div className="saimo-doacao-vantagem-icone">💜</div>
                <div className="saimo-doacao-vantagem-conteudo">
                  <strong>Sem Mensalidade</strong>
                  <span>Acesso livre a todos os canais, filmes e séries</span>
                </div>
              </div>
            </div>

            <div className="saimo-doacao-acoes">
              <a
                href={LINK_DOACAO}
                target="_blank"
                rel="noopener noreferrer"
                className="saimo-doacao-btn-principal"
              >
                <span className="saimo-doacao-btn-icon">💜</span>
                <span>Fazer Doação via Deflow (Pix / Cripto)</span>
                <svg
                  className="saimo-doacao-seta"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M7 17l9.2-9.2M17 17V8H8" />
                </svg>
              </a>

              <button
                type="button"
                onClick={aoCopiarLink}
                className={`saimo-doacao-btn-copiar ${copiado ? 'copiado' : ''}`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="16"
                  height="16"
                  aria-hidden="true"
                >
                  {copiado ? (
                    <polyline points="20 6 9 17 4 12" />
                  ) : (
                    <>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </>
                  )}
                </svg>
                <span>{copiado ? 'Link copiado com sucesso!' : 'Copiar link de doação'}</span>
              </button>
            </div>

            <div className="saimo-doacao-rodape">
              <span>🔒 Pagamento seguro via Pix ou Criptomoedas através da Deflow Exchange.</span>
              <span className="saimo-doacao-agradecimento">
                Muito obrigado a cada um que apoia o projeto! 🍿✨
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
