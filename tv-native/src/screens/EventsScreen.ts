/**
 * Tela de Eventos Esportivos e Jogos Ao Vivo (EventsScreen).
 * Agenda de partidas de futebol, basquete, lutas e automobilismo com escudos dos times,
 * placar em tempo real e sintonização direta do canal transmissor a um clique de OK.
 */

import { State } from '../core/State';
import { Api, SportsEvent, Channel } from '../core/Api';
import { SpatialNav } from '../core/SpatialNav';

export class EventsScreen {
  private element: HTMLElement;
  private scrollContainer: HTMLElement;
  private events: SportsEvent[] = [];

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-events-screen hidden';
    this.element.id = 'screen-events';

    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'tv-screen-scroll tv-scroll-v';
    this.scrollContainer.style.padding = '100px 70px 40px';

    this.element.appendChild(this.scrollContainer);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  async enter() {
    this.element.classList.remove('hidden');

    if (State.channels.length === 0) {
      State.channels = await Api.fetchChannels();
    }

    this.scrollContainer.innerHTML = `
      <div style="font-size:36px; font-weight:900; margin-bottom:8px;">⚽ Jogos & Eventos Esportivos</div>
      <div style="font-size:18px; color:rgba(255,255,255,0.7); margin-bottom:30px;">
        Selecione uma partida para assistir diretamente no canal transmissor.
      </div>
      <div id="events-list-container" style="display:flex; flex-direction:column; gap:16px; max-width:1200px;"></div>
    `;

    this.events = await Api.fetchSportsEvents();
    this.renderEvents();

    setTimeout(() => {
      const first = this.scrollContainer.querySelector<HTMLElement>('.tv-match-card');
      if (first) SpatialNav.focus(first);
    }, 50);
  }

  leave() {
    this.element.classList.add('hidden');
  }

  private renderEvents() {
    const container = this.scrollContainer.querySelector('#events-list-container');
    if (!container) return;

    if (this.events.length === 0) {
      container.innerHTML = `
        <div style="padding:40px; background:#141419; border-radius:16px; text-align:center;">
          <div style="font-size:24px; font-weight:700; margin-bottom:8px;">Nenhum jogo com transmissão ao vivo no momento</div>
          <div style="font-size:16px; opacity:0.7;">Consulte a programação dos canais esportivos na aba Ao Vivo.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    this.events.forEach((ev, idx) => {
      const card = document.createElement('div');
      card.className = 'tv-match-card nav-focusable';
      card.setAttribute('data-nav', 'true');
      card.id = `event-card-${idx}`;

      const timeStr = new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      card.innerHTML = `
        <div class="tv-match-team">
          ${ev.homeShield ? `<img class="tv-match-shield" src="${ev.homeShield}" onerror="this.style.display='none'" alt="" />` : ''}
          <span style="font-size:22px; font-weight:800;">${ev.homeTeam}</span>
        </div>

        <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
          <div class="tv-match-score">${ev.score || 'VS'}</div>
          <div style="font-size:15px; font-weight:700; color:${ev.isLive ? '#ff4d4d' : '#00e3ff'};">
            ${ev.isLive ? '● AO VIVO' : timeStr} · ${ev.league}
          </div>
          ${ev.channelName ? `<div style="font-size:14px; opacity:0.8;">Canal: ${ev.channelName}</div>` : ''}
        </div>

        <div class="tv-match-team away">
          <span style="font-size:22px; font-weight:800;">${ev.awayTeam}</span>
          ${ev.awayShield ? `<img class="tv-match-shield" src="${ev.awayShield}" onerror="this.style.display='none'" alt="" />` : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        this.tuneEventChannel(ev);
      });

      container.appendChild(card);
    });
  }

  private tuneEventChannel(ev: SportsEvent) {
    if (!ev.channelName) {
      State.setScreen('live');
      return;
    }

    // Procura o canal por aproximação de nome
    const query = ev.channelName.toLowerCase().replace(/\s+/g, '');
    const found = State.channels.find((c) => {
      const cName = c.name.toLowerCase().replace(/\s+/g, '');
      return cName.includes(query) || query.includes(cName);
    });

    if (found) {
      State.setScreen('live', { channel: found });
    } else {
      State.setScreen('live');
    }
  }
}
