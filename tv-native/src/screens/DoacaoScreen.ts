/**
 * Apoie o Saimo TV: por que doar, o QR code para abrir no celular e o link
 * escrito. Mesmo texto do site, sem nada que a TV não abra (o pagamento é
 * feito no celular, pelo QR).
 */

import { icone } from '../components/Icones';

export const LINK_DOACAO = 'https://deflow.exchange/pt/qr/saimo-tv';
const LINK_VISIVEL = 'deflow.exchange/pt/qr/saimo-tv';

export class DoacaoScreen {
  private element: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-doacao hidden';
    this.element.id = 'screen-doacao';
    this.element.innerHTML = `
      <div class="tv-doacao-corpo">
        <div class="tv-doacao-texto">
          <div class="tv-doacao-tag">${icone('favorite')}<span>Comunidade Saimo TV</span></div>
          <h1 class="tv-doacao-titulo">Ajude a manter tudo <span>100% gratuito</span></h1>
          <p class="tv-doacao-sub">Sem anúncios, sem mensalidade e livre para todo mundo.</p>
          <p class="tv-doacao-historia">Manter servidores rápidos, a transmissão e as atualizações de todo dia custa dinheiro todo mês. Quem puder ajudar com qualquer valor faz uma diferença enorme para o Saimo TV continuar no ar para todos.</p>
          <div class="tv-doacao-vantagens">
            <div class="tv-doacao-vantagem">${icone('block')}<div><strong>Zero anúncios</strong><span>Nada interrompendo o que você assiste</span></div></div>
            <div class="tv-doacao-vantagem">${icone('bolt')}<div><strong>Servidores rápidos</strong><span>Transmissão estável e em alta qualidade</span></div></div>
            <div class="tv-doacao-vantagem">${icone('favorite')}<div><strong>Sem mensalidade</strong><span>Canais, filmes e séries para todo mundo</span></div></div>
          </div>
        </div>
        <div class="tv-doacao-qr-cartao">
          <div class="tv-doacao-qr-titulo">Aponte a câmera do celular</div>
          <img class="tv-doacao-qr" src="img/doacao-qr.png" alt="QR code para doar" />
          <div class="tv-doacao-link">${LINK_VISIVEL}</div>
          <div class="tv-doacao-pix">Pix ou cripto, pagamento seguro pela Deflow</div>
        </div>
      </div>
    `;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  enter() {
    this.element.classList.remove('hidden');
  }

  leave() {
    this.element.classList.add('hidden');
  }
}
