/** Eventos: jogos com canal nosso, em cartões, e o cabeçalho seguindo o foco. */

import { State } from '../core/State';
import { Api, SportsEvent } from '../core/Api';
import { SpatialNav } from '../core/SpatialNav';
import { HeroBanner } from '../components/HeroBanner';
import { Rail, CardModel } from '../components/Rail';

export class EventsScreen {
  private element: HTMLElement;
  private fileiras: HTMLElement;
  private hero = new HeroBanner();

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-events-screen hidden';
    this.element.id = 'screen-events';
    const rolagem = document.createElement('div');
    rolagem.className = 'tv-screen-scroll tv-scroll-v';
    rolagem.appendChild(this.hero.getElement());
    this.fileiras = document.createElement('div');
    rolagem.appendChild(this.fileiras);
    this.element.appendChild(rolagem);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  async enter() {
    this.element.classList.remove('hidden');
    this.hero.setDefault('Eventos', 'Carregando...', '');
    const jogos = await Api.fetchSportsEvents();
    if (State.currentScreen !== 'events') return;
    this.fileiras.innerHTML = '';
    if (!jogos.length) {
      this.hero.setDefault('Eventos', 'Nenhum jogo agora.', '');
      return;
    }
    this.fileira('Ao vivo agora', jogos.filter((j) => j.isLive));
    this.fileira('Começa em breve', jogos.filter((j) => !j.isLive));
    SpatialNav.focus(this.fileiras.querySelector<HTMLElement>('.tv-card'));
  }

  leave() {
    this.element.classList.add('hidden');
  }

  private fileira(titulo: string, jogos: SportsEvent[]) {
    if (!jogos.length) return;
    const hora = (j: SportsEvent) => new Date(j.startTime).toTimeString().slice(0, 5);
    const r = new Rail(titulo, true);
    r.setCards(jogos.map((j): CardModel => ({
      id: j.id,
      title: `${j.homeTeam} x ${j.awayTeam}`,
      subtitle: `${j.channelName || 'Sem canal'}  ·  ${j.league}`,
      image: j.homeShield,
      image2: j.awayShield,
      badge: j.isLive ? 'AO VIVO' : hora(j),
      onFocus: () => this.hero.setDefault(`${j.homeTeam} x ${j.awayTeam}`, `${j.league}  ·  ${hora(j)}`, j.channelName ? `No canal ${j.channelName}  ·  OK assiste` : 'Sem canal na lista'),
      onClick: () => {
        const canal = State.channels.find((c) => c.name === j.channelName);
        if (canal) State.setScreen('live', { channel: canal });
      },
    })));
    this.fileiras.appendChild(r.getElement());
  }
}
