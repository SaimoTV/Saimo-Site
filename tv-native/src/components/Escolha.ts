/**
 * Lista de opções sobre a tela (gênero, ano, idade, nota, ordem): uma por
 * linha, a marcada com destaque. OK escolhe, Voltar fecha sem mudar nada.
 */

import { SpatialNav } from '../core/SpatialNav';
import { Platform } from '../core/Platform';

export interface OpcaoEscolha {
  rotulo: string;
  marcada: boolean;
  aoEscolher: () => void;
}

export class Escolha {
  private element: HTMLElement;
  private lista: HTMLElement;
  private titulo: HTMLElement;
  private devolverFoco: HTMLElement | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-modal-overlay hidden';
    this.element.innerHTML = `
      <div class="tv-modal-content tv-escolha">
        <div class="tv-escolha-titulo"></div>
        <div class="tv-escolha-lista"></div>
      </div>
    `;
    this.titulo = this.element.querySelector('.tv-escolha-titulo')!;
    this.lista = this.element.querySelector('.tv-escolha-lista')!;
    window.addEventListener('keydown', (e) => {
      if (!this.aberta() || !Platform.isBackKey(e.keyCode)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      this.fechar();
    }, true);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  aberta(): boolean {
    return !this.element.classList.contains('hidden');
  }

  abrir(titulo: string, opcoes: OpcaoEscolha[]) {
    this.devolverFoco = SpatialNav.getCurrent();
    this.titulo.textContent = titulo;
    this.lista.innerHTML = '';
    let marcada: HTMLElement | null = null;
    for (const o of opcoes) {
      const b = document.createElement('div');
      b.className = `tv-btn nav-focusable ${o.marcada ? 'primary' : ''}`;
      b.setAttribute('data-nav', 'true');
      b.textContent = o.rotulo;
      b.addEventListener('click', () => {
        this.fechar();
        o.aoEscolher();
      });
      this.lista.appendChild(b);
      if (o.marcada) marcada = b;
    }
    this.element.classList.remove('hidden');
    SpatialNav.setTrap(this.element);
    SpatialNav.focus(marcada || this.lista.querySelector<HTMLElement>('.tv-btn'));
  }

  fechar() {
    this.element.classList.add('hidden');
    SpatialNav.setTrap(null);
    if (this.devolverFoco && document.body.contains(this.devolverFoco)) SpatialNav.focus(this.devolverFoco);
  }
}
