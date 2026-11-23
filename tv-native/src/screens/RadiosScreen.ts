/** Rádios por estilo; OK toca em tela cheia e cima/baixo trocam a estação. */

import { State } from '../core/State';
import { Api, RadioStation } from '../core/Api';
import { TVPlayerInstance } from '../player/TVPlayer';
import { Rail } from '../components/Rail';
import { SpatialNav } from '../core/SpatialNav';
import { HeroBanner } from '../components/HeroBanner';

const ESTILOS = ['Rock', 'Notícias e esporte', 'Gospel e católicas', 'Pop e hits', 'Sertanejo, MPB e samba', 'Clássica e jazz', 'Outras'];

export class RadiosScreen {
  private element: HTMLElement;
  private grade: HTMLElement;
  private fileiras: HTMLElement;
  private tocando: HTMLElement;
  private hero = new HeroBanner();
  private estacoes: RadioStation[] = [];
  private atual = -1;

  constructor(private player: TVPlayerInstance) {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-radios-screen hidden';
    this.element.id = 'screen-radios';

    this.grade = document.createElement('div');
    this.grade.className = 'tv-screen-scroll tv-scroll-v com-hero';
    this.element.appendChild(this.hero.getElement());
    this.fileiras = document.createElement('div');
    this.grade.appendChild(this.fileiras);

    this.tocando = document.createElement('div');
    this.tocando.className = 'tv-radio-tocando hidden';

    this.element.appendChild(this.grade);
    this.element.appendChild(this.tocando);
    window.addEventListener('keydown', (e) => this.teclas(e), true);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  async enter() {
    this.element.classList.remove('hidden');
    if (!this.estacoes.length) this.estacoes = await Api.fetchRadios();
    if (State.currentScreen !== 'radios') return;
    this.fileiras.innerHTML = '';
    ESTILOS.forEach((estilo) => {
      const lista = this.estacoes.filter((s) => s.genre === estilo);
      if (!lista.length) return;
      const r = new Rail(estilo, true);
      // Uma fileira leva no máximo 40: centenas de cartões travariam a TV.
      r.setCards(lista.slice(0, 40).map((s) => ({
        id: `radio_${this.estacoes.indexOf(s)}`,
        title: s.name,
        image: s.logo,
        onFocus: () => this.hero.setDefault(s.name, `Rádio ao vivo  ·  ${s.genre}`, 'OK toca  ·  na rádio, cima e baixo trocam de estação'),
        onClick: () => this.tocar(this.estacoes.indexOf(s)),
      })));
      this.fileiras.appendChild(r.getElement());
    });
    SpatialNav.focus(this.fileiras.querySelector<HTMLElement>('.tv-card'));
  }

  leave() {
    this.fechar();
    this.element.classList.add('hidden');
  }

  private tocar(i: number) {
    this.atual = i;
    const s = this.estacoes[i];
    this.tocando.innerHTML = `
      <div class="logo">${s.logo ? `<img src="${s.logo}" alt="" onerror="this.style.display='none'" />` : ''}</div>
      <div class="selo">AO VIVO</div>
      <div class="nome">${s.name}</div>
      <div class="info">${s.genre}  ·  Estação ${i + 1} de ${this.estacoes.length}</div>
      <div class="dica">cima e baixo trocam de estação  ·  VOLTAR mostra todas as rádios</div>`;
    this.grade.classList.add('hidden');
    this.tocando.classList.remove('hidden');
    SpatialNav.limpar();
    SpatialNav.pausado = true;
    State.emit('tela-cheia', true);
    this.player.play({ url: s.url, title: s.name, isLive: true }).catch(() => {});
  }

  private fechar() {
    if (this.tocando.classList.contains('hidden')) return;
    this.player.stop();
    SpatialNav.pausado = false;
    this.tocando.classList.add('hidden');
    this.grade.classList.remove('hidden');
    State.emit('tela-cheia', false);
  }

  private teclas(e: KeyboardEvent) {
    if (State.currentScreen !== 'radios' || this.tocando.classList.contains('hidden')) return;
    const k = e.keyCode;
    const total = this.estacoes.length;
    if (k === 38) this.tocar((this.atual - 1 + total) % total);
    else if (k === 40) this.tocar((this.atual + 1) % total);
    else if (k === 10009 || k === 461 || k === 8 || k === 27 || k === 37) {
      this.fechar();
      SpatialNav.focus(this.fileiras.querySelector<HTMLElement>('.tv-card'));
    } else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}
