/**
 * Guia de Programação EPG em Duas Colunas (GuideScreen).
 * Coluna esquerda: Lista de canais com logos.
 * Coluna direita: Programação completa com horários, progresso ao vivo e sinopse.
 */

import { State } from '../core/State';
import { Api, Channel, EpgProgram } from '../core/Api';
import { SpatialNav } from '../core/SpatialNav';

export class GuideScreen {
  private element: HTMLElement;
  private channelListEl: HTMLElement;
  private programmesContainer: HTMLElement;
  private selectedChannel: Channel | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-guide-screen hidden';
    this.element.id = 'screen-guide';

    const layout = document.createElement('div');
    layout.className = 'tv-guide-layout';

    this.channelListEl = document.createElement('div');
    this.channelListEl.className = 'tv-guide-channels tv-scroll-v';
    this.channelListEl.id = 'guide-channel-list';

    this.programmesContainer = document.createElement('div');
    this.programmesContainer.className = 'tv-guide-programmes tv-scroll-v';
    this.programmesContainer.id = 'guide-prog-list';

    layout.appendChild(this.channelListEl);
    layout.appendChild(this.programmesContainer);
    this.element.appendChild(layout);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  async enter() {
    this.element.classList.remove('hidden');

    if (State.channels.length === 0) {
      State.channels = await Api.fetchChannels();
    }
    await Api.fetchEPG();

    this.renderChannels();

    setTimeout(() => {
      const firstChannel = this.channelListEl.querySelector<HTMLElement>('.tv-guide-channel-item');
      if (firstChannel) SpatialNav.focus(firstChannel);
    }, 50);
  }

  leave() {
    this.element.classList.add('hidden');
  }

  private renderChannels() {
    this.channelListEl.innerHTML = '';

    State.channels.forEach((ch, idx) => {
      const item = document.createElement('div');
      item.className = 'tv-guide-channel-item nav-focusable';
      item.setAttribute('data-nav', 'true');
      item.id = `guide-ch-${ch.id}`;

      item.innerHTML = `
        <span style="font-weight:800; color:#00e3ff; width:36px;">${ch.number}</span>
        ${ch.logo ? `<img src="${ch.logo}" style="width:40px; height:40px; object-fit:contain;" alt="" />` : ''}
        <span style="font-weight:700; font-size:18px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ch.name}</span>
      `;

      item.addEventListener('nav-focus', () => {
        this.selectedChannel = ch;
        this.renderSchedule(ch);
      });

      item.addEventListener('click', () => {
        State.setScreen('live', { channel: ch });
      });

      this.channelListEl.appendChild(item);
    });

    if (State.channels.length > 0) {
      this.selectedChannel = State.channels[0];
      this.renderSchedule(this.selectedChannel);
    }
  }

  private renderSchedule(channel: Channel) {
    this.programmesContainer.innerHTML = '';

    const header = document.createElement('div');
    header.style.fontSize = '24px';
    header.style.fontWeight = '800';
    header.style.color = '#00e3ff';
    header.style.marginBottom = '12px';
    header.textContent = `Programação de ${channel.name}`;
    this.programmesContainer.appendChild(header);

    const epg = Api.getNowNext(channel.name);
    const hasEpg = Boolean(epg.current || epg.next);

    if (!hasEpg) {
      const empty = document.createElement('div');
      empty.className = 'tv-guide-prog-item live nav-focusable';
      empty.setAttribute('data-nav', 'true');
      empty.innerHTML = `
        <div class="tv-guide-prog-header">
          <span class="tv-guide-prog-title">Transmissão ao Vivo</span>
          <span class="tv-guide-prog-time">NO AR</span>
        </div>
        <div style="font-size:16px; opacity:0.7;">Grade em tempo real disponível na sintonização.</div>
      `;
      empty.addEventListener('click', () => {
        State.setScreen('live', { channel });
      });
      this.programmesContainer.appendChild(empty);
      return;
    }

    if (epg.current) {
      const curItem = document.createElement('div');
      curItem.className = 'tv-guide-prog-item live nav-focusable';
      curItem.setAttribute('data-nav', 'true');

      const start = epg.current.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const stop = epg.current.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      curItem.innerHTML = `
        <div class="tv-guide-prog-header">
          <span class="tv-guide-prog-title">${epg.current.title}</span>
          <span class="tv-guide-prog-time">● AO VIVO (${start} - ${stop})</span>
        </div>
        <div style="font-size:15px; opacity:0.8;">Faltam ${epg.current.remainingMin} minutos</div>
        <div class="tv-card-progress" style="position:relative; margin-top:8px; border-radius:3px;">
          <div class="tv-card-progress-bar" style="width: ${Math.round(epg.current.progress * 100)}%;"></div>
        </div>
      `;

      curItem.addEventListener('click', () => {
        State.setScreen('live', { channel });
      });

      this.programmesContainer.appendChild(curItem);
    }

    if (epg.next) {
      const nextItem = document.createElement('div');
      nextItem.className = 'tv-guide-prog-item nav-focusable';
      nextItem.setAttribute('data-nav', 'true');

      const start = epg.next.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const stop = epg.next.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      nextItem.innerHTML = `
        <div class="tv-guide-prog-header">
          <span class="tv-guide-prog-title">${epg.next.title}</span>
          <span class="tv-guide-prog-time">A SEGUIR (${start} - ${stop})</span>
        </div>
        <div style="font-size:15px; opacity:0.7;">Duração: ${epg.next.durationMin} min</div>
      `;

      this.programmesContainer.appendChild(nextItem);
    }
  }
}
