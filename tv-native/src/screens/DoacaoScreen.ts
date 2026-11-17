/**
 * Apoie o Saimo TV: por que doar, o QR code para abrir no celular e o link
 * Pix direto escrito. Mesmo texto do site, sem nada que a TV não abra (o
 * pagamento é feito no celular, pelo QR).
 */

import { icone } from '../components/Icones';

const FAVORECIDO = 'Gabriel Saimo Ferreira';
const TEXTO_PIX_DIRETO =
  'Agora o Pix é direto: o valor vai direto para o desenvolvedor, Gabriel Saimo Ferreira, sem intermediário. Aponte a câmera do celular para o QR code ou copie o código Pix e cole no app do seu banco.';

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
          <h1 class="tv-doacao-titulo">Ajude a manter o Saimo TV <span>100% gratuito</span></h1>
          <p class="tv-doacao-sub">Sem anúncios e sem mensalidade.</p>
          <p class="tv-doacao-historia">O Saimo TV é um player: ele toca as listas e os links que você mesmo adiciona. O app e o site não trazem nenhum canal, filme ou série dentro; o que você assiste vem das suas próprias listas. O desenvolvimento, as atualizações e a hospedagem do site custam dinheiro todo mês. Quem puder ajudar com qualquer valor faz uma diferença enorme para o Saimo TV continuar gratuito, atualizado e sem anúncios.</p>
          <div class="tv-doacao-vantagens">
            <div class="tv-doacao-vantagem">${icone('block')}<div><strong>Zero anúncios</strong><span>Nada interrompendo o que você usa</span></div></div>
            <div class="tv-doacao-vantagem">${icone('autorenew')}<div><strong>Atualizações constantes</strong><span>Melhorias e correções para o app e o site</span></div></div>
            <div class="tv-doacao-vantagem">${icone('favorite')}<div><strong>Sem mensalidade</strong><span>O app é gratuito para todo mundo</span></div></div>
          </div>
        </div>
        <div class="tv-doacao-qr-cartao">
          <div class="tv-doacao-qr-titulo">Aponte a câmera do celular</div>
          <img class="tv-doacao-qr" src="img/doacao-qr.png" alt="QR code do Pix direto" />
          <div class="tv-doacao-link">${FAVORECIDO}</div>
          <div class="tv-doacao-pix">Pix direto</div>
          <div class="tv-doacao-explica">${TEXTO_PIX_DIRETO}</div>
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
