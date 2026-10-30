/**
 * Gaveta Lateral de Canais (Live TV Channel Drawer).
 * Abre com OK na tela cheia ao vivo para troca rápida de canais sem sair do vídeo.
 */

import { Channel, Api } from '../core/Api';
import { SpatialNav } from '../core/SpatialNav';

export class ChannelDrawer {
  private element: HTMLElement;
  private categoryTitleEl: HTMLElement;
  private channelListEl: HTMLElement;
  private channels: Channel[] = [];
  private onSelectChannel?: (channel: Channel) => void;

  constructor(onSelectChannel: (channel: Channel) => void) {
    this.onSelectChannel = onSelectChannel;
    this.element = document.createElement('div');
    this.element.className = 'tv-channel-drawer hidden';
    this.element.id = 'tv-channel-drawer';

    this.element.innerHTML = `
      <div class="tv-drawer-category-title" id="drawer-cat-title">Todos os Canais</div>
      <div class="tv-drawer-channel-list tv-scroll-v" id="drawer-ch-list"></div>
    `;

    this.categoryTitleEl = this.element.querySelector('#drawer-cat-title')!;
    this.channelListEl = this.element.querySelector('#drawer-ch-list')!;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  open(channels: Channel[], currentChannel: Channel | null, category = 'Todos os Canais') {
    this.channels = channels;
    this.categoryTitleEl.textContent = category;
    this.channelListEl.innerHTML = '';

    channels.forEach((ch, idx) => {
      const item = document.createElement('div');
      item.className = `tv-drawer-channel-item nav-focusable ${currentChannel?.id === ch.id ? 'active' : ''}`;
      item.setAttribute('data-nav', 'true');
      item.id = `drawer-ch-${ch.id}`;

      const epg = Api.getNowNext(ch.name);
      const programTitle = epg.current?.title || 'Ao Vivo';

      item.innerHTML = `
        <span class="num">${ch.number}</span>
        ${ch.logo ? `<img src="${ch.logo}" onerror="this.style.display='none'" alt="" />` : ''}
        <div style="flex:1; overflow:hidden;">
          <div class="name">${ch.name}</div>
          <div style="font-size:14px; color:rgba(255,255,255,0.6); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${programTitle}</div>
        </div>
      `;

      item.addEventListener('click', () => {
        this.close();
        this.onSelectChannel?.(ch);
      });

      this.channelListEl.appendChild(item);
    });

    this.element.classList.remove('hidden');
    SpatialNav.setTrap(this.element);

    // Foca o canal atual ou o primeiro
    const target = currentChannel
      ? this.channelListEl.querySelector<HTMLElement>(`#drawer-ch-${currentChannel.id}`)
      : this.channelListEl.querySelector<HTMLElement>('.tv-drawer-channel-item');

    if (target) {
      SpatialNav.focus(target);
    }
  }

  close() {
    this.element.classList.add('hidden');
    SpatialNav.setTrap(null);
  }

  isOpen(): boolean {
    return !this.element.classList.contains('hidden');
  }
}
