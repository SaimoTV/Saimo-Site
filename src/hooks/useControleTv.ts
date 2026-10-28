import { useEffect, useRef } from 'react';
import { ehTv } from '../plataforma/tv';
import { useDpad } from '../contexts/dpadContexto';

/**
 * O controle remoto no "Ao vivo" das TVs Samsung/LG.
 *
 * Com o canal em tela cheia os controles somem, e o D-pad não acha nada visível
 * para focar: setas e OK não faziam nada, e o Voltar saía do app. Aqui:
 * - setas cima/baixo trocam de canal (como o CH+/CH− da TV, que também vale);
 * - OK e setas laterais abrem a lista de canais, já com o foco no canal no ar;
 * - Voltar com a lista aberta fecha a lista (vídeo em tela cheia); em tela cheia, volta à
 *   tela anterior (nunca sai do app daqui).
 * - Multi tela: em tela cheia as setas laterais trocam a tela ativa (som e troca de canal vão
 *   para ela), OK abre a lista para escolher o canal dela, e Voltar desliga a multi tela.
 */
export function useControleTv(o: {
  ativo: boolean;
  painelAberto: boolean;
  controlesVisiveis: boolean;
  abrirPainel: () => void;
  fecharPainel: () => void;
  proximo: () => void;
  anterior: () => void;
  voltar: () => void;
  /** Favorita (ou desfavorita) um canal pelo id. Usado no Enter longo sobre a linha do canal. */
  favoritar?: (idDoCanal: string) => void;
  /** Multi tela ligada: setas laterais trocam o lado ativo (o do som e da lista). */
  multiTela?: boolean;
  trocarLado?: () => void;
  sairDaMultiTela?: () => void;
}) {
  const { registerBackHandler, setFocus } = useDpad();
  const ref = useRef(o);
  useEffect(() => { ref.current = o; });

  // Ligou a multi tela: o foco vai para a lista, para escolher o canal da tela 2.
  useEffect(() => {
    if (!ehTv() || !o.multiTela) return;
    const t = window.setTimeout(() => {
      const linha = document.querySelector<HTMLElement>('.painel-linha-canal');
      if (linha) setFocus(linha);
    }, 300);
    return () => window.clearTimeout(t);
  }, [o.multiTela, setFocus]);

  // Ao entrar no Ao vivo (lista aberta), o foco já vai para a lista de canais: é o que se
  // quer fazer com o controle ali, e não andar pela barra do topo.
  useEffect(() => {
    if (!ehTv() || !o.painelAberto) return;
    const t = window.setTimeout(() => {
      const atual = document.querySelector('.dpad-focused');
      if (atual?.classList.contains('painel-linha-canal')) return;
      const linha = document.querySelector<HTMLElement>('.painel-linha-canal.no-ar')
        ?? document.querySelector<HTMLElement>('.painel-linha-canal');
      if (linha) setFocus(linha);
    }, 1700);
    return () => window.clearTimeout(t);
  }, [o.painelAberto, setFocus]);

  useEffect(() => {
    if (!ehTv()) return;

    const mostrarControles = () => {
      document.querySelector('.video-player-container')?.dispatchEvent(new CustomEvent('dpad-enter'));
    };
    const abrir = () => {
      ref.current.abrirPainel();
      mostrarControles();
      // O foco vai para o canal no ar (ou o primeiro) assim que a lista aparece.
      window.setTimeout(() => {
        const linha = document.querySelector<HTMLElement>('.painel-linha-canal.no-ar')
          ?? document.querySelector<HTMLElement>('.painel-linha-canal');
        if (linha) setFocus(linha);
      }, 200);
    };

    // Enter longo sobre a linha de um canal favorita o canal, em vez de trocar para ele.
    // O Enter curto (ao soltar antes do tempo) troca de canal, como o clique da linha.
    const MS_ENTER_LONGO = 550;
    let alvoEnter: HTMLElement | null = null;
    let enterTimer = 0;
    let enterLongoDisparou = false;
    let segurandoEnter = false;

    const aoApertar = (e: KeyboardEvent) => {
      const s = ref.current;
      if (!s.ativo) return;
      const codigo = e.keyCode;
      const consumir = () => { e.preventDefault(); e.stopPropagation(); };
      // CH+/CH−: Samsung 427/428, LG PageUp/PageDown (33/34).
      if (codigo === 427 || codigo === 33) { consumir(); s.proximo(); mostrarControles(); return; }
      if (codigo === 428 || codigo === 34) { consumir(); s.anterior(); mostrarControles(); return; }
      // Da lista de canais, a seta para a direita vai direto aos botões do player (multi tela,
      // fontes, áudio…): pela posição na tela o D-pad ia parar nas abas do alto da lista.
      // A lista é fechada, pois o foco sai dela e vai para os controles do player.
      const ativo = document.activeElement as HTMLElement | null;
      // Enter longo sobre a linha de um canal: favorita, em vez de trocar para ele. Um temporizador
      // dispara o favoritar; se soltar antes (Enter curto) a troca de canal acontece no "keyup".
      if (e.key === 'Enter' && ativo?.classList.contains('painel-linha-canal')) {
        consumir();
        if (segurandoEnter) return; // repetições do controle enquanto a tecla fica pressionada
        segurandoEnter = true;
        enterLongoDisparou = false;
        alvoEnter = ativo;
        const idDoCanal = ativo.getAttribute('data-channel-id');
        enterTimer = window.setTimeout(() => {
          enterLongoDisparou = true;
          if (idDoCanal) s.favoritar?.(idDoCanal);
        }, MS_ENTER_LONGO);
        return;
      }
      // Nas pílulas de categoria (fileira horizontal que rola de lado), as setas laterais andam
      // de uma pílula para a vizinha. Pela geometria o D-pad pulava as pílulas fora da parte
      // visível da fileira (ficam "cortadas" à direita), saindo da área antes do fim da lista.
      if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && ativo?.classList.contains('painel-pilula')) {
        const pilulas = Array.from(document.querySelectorAll<HTMLElement>('.painel-pilulas-scroll .painel-pilula'))
          .filter((b) => b.getClientRects().length > 0);
        const i = pilulas.indexOf(ativo);
        const vizinha = e.key === 'ArrowRight' ? pilulas[i + 1] : pilulas[i - 1];
        if (i !== -1 && vizinha) { consumir(); setFocus(vizinha); return; }
        // Nos extremos (primeira/última) deixa o D-pad seguir para fora da fileira.
      }
      if (e.key === 'ArrowRight' && ativo?.classList.contains('painel-linha-canal')) {
        const botoes = Array.from(document.querySelectorAll<HTMLElement>('.video-player-container .control-btn'))
          .filter((b) => b.getClientRects().length > 0);
        if (botoes.length) {
          consumir();
          s.fecharPainel();
          mostrarControles();
          setFocus(botoes[0]);
          return;
        }
      }
      // Dos botões do player, a seta para a esquerda no primeiro volta para a lista.
      if (e.key === 'ArrowLeft' && s.painelAberto && ativo?.classList.contains('control-btn')) {
        const botoes = Array.from(document.querySelectorAll<HTMLElement>('.video-player-container .control-btn'))
          .filter((b) => b.getClientRects().length > 0);
        if (botoes[0] === ativo) {
          const linha = document.querySelector<HTMLElement>('.painel-linha-canal.no-ar')
            ?? document.querySelector<HTMLElement>('.painel-linha-canal');
          if (linha) { consumir(); setFocus(linha); return; }
        }
      }
      if (s.painelAberto || s.controlesVisiveis) return; // aí o D-pad cuida
      if (s.multiTela && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        consumir(); s.trocarLado?.(); mostrarControles(); return;
      }
      switch (e.key) {
        case 'ArrowUp': consumir(); s.proximo(); mostrarControles(); break;
        case 'ArrowDown': consumir(); s.anterior(); mostrarControles(); break;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'Enter': consumir(); abrir(); break;
      }
    };
    window.addEventListener('keydown', aoApertar, true);

    const aoSoltar = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !segurandoEnter) return;
      window.clearTimeout(enterTimer);
      segurandoEnter = false;
      const alvo = alvoEnter;
      alvoEnter = null;
      // Soltou antes do tempo do Enter longo: é um Enter curto, que troca para o canal.
      if (!enterLongoDisparou && alvo) {
        e.preventDefault();
        e.stopPropagation();
        alvo.click();
      }
    };
    window.addEventListener('keyup', aoSoltar, true);

    const tirar = registerBackHandler(() => {
      const s = ref.current;
      if (!s.ativo) return false;
      if (s.painelAberto) { s.fecharPainel(); return true; }
      if (s.multiTela && s.sairDaMultiTela) { s.sairDaMultiTela(); return true; }
      s.voltar();
      return true;
    });
    return () => {
      window.removeEventListener('keydown', aoApertar, true);
      window.removeEventListener('keyup', aoSoltar, true);
      window.clearTimeout(enterTimer);
      tirar();
    };
  }, [registerBackHandler, setFocus]);
}
