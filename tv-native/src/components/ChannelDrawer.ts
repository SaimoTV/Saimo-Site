/**
 * Gaveta Lateral de Canais (Live TV Channel Drawer).
 * Abre com OK na tela cheia ao vivo para troca rápida de canais e escolha de fontes sem sair do vídeo.
 */

import { Channel, Api } from '../core/Api';
import { SpatialNav } from '../core/SpatialNav';

export class ChannelDrawer {
  private element: HTMLElement;
  private categoryTitleEl: HTMLElement;
  private channelListEl: HTMLElement;
  private channels: Channel[] = [];
  private onSelectChannel?: (channel: Channel) => void;
  private onOpenChannelSources?: (channel: Channel) => void;

  constructor(
    onSelectChannel: (channel: Channel) => void,
    onOpenChannelSources?: (channel: Channel) => void
  ) {
    this.onSelectChannel = onSelectChannel;
    this.onOpenChannelSources = onOpenChannelSources;
    this.element = document.createElement('div');
    this.element.className = 'tv-channel-drawer hidden';
    this.element.id = 'tv-channel-drawer';

    this.element.innerHTML = `
      <div class="tv-drawer-category-title" id="drawer-cat-title" style="padding-bottom:12px;">Todos os Canais</div>
      <div class="tv-drawer-channel-list tv-scroll-v" id="drawer-ch-list" style="flex:1;"></div>
      <div class="tv-drawer-footer" style="padding:14px 20px; font-size:14px; color:#94a3b8; border-top:1px solid rgba(255,255,255,0.1); background:#0c0c12; display:flex; justify-content:space-between; align-items:center;">
        <span>[OK] Assistir</span>
        <span style="color:#00e3ff; font-weight:700;">[▶ / Direita] Fontes</span>
        <span>[Voltar] Fechar</span>
      </div>
    `;

    this.categoryTitleEl = this.element.querySelector('#drawer-cat-title')!;
    this.channelListEl = this.element.querySelector('#drawer-ch-list')!;

    // Atalho: Seta para a Direita ou Play abre o seletor de fontes do canal focado na lista
    this.element.addEventListener('keydown', (e) => {
      if (e.keyCode === 39 || e.keyCode === 415 || e.keyCode === 19) { // RIGHT ou PLAY
        const focused = document.activeElement as HTMLElement;
        if (focused && focused.id && focused.id.startsWith('drawer-ch-')) {
          const chId = focused.id.replace('drawer-ch-', '');
          const ch = this.channels.find((c) => c.id === chId);
          if (ch) {
            e.preventDefault();
            e.stopPropagation();
            this.close();
            this.onOpenChannelSources?.(ch);
          }
        }
      }
    });
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
      const variantCount = ch.variants?.length || 1;

      item.innerHTML = `
        <span class="num">${ch.number}</span>
        ${ch.logo ? `<img src="${ch.logo}" onerror="this.style.display='none'" alt="" />` : ''}
        <div style="flex:1; overflow:hidden;">
          <div class="name">${ch.name}</div>
          <div style="font-size:14px; color:rgba(255,255,255,0.6); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${programTitle}</div>
        </div>
        ${variantCount > 1 ? `<span class="sources-tag" style="font-size:12px; background:rgba(0,227,255,0.15); color:#00e3ff; border:1px solid #00e3ff; padding:2px 8px; border-radius:10px; margin-right:4px; font-weight:700; white-space:nowrap;">${variantCount} fontes [▶]</span>` : ''}
      `;

      item.addEventListener('click', (ev) => {
        const target = ev.target as HTMLElement;
        if (target && (target.classList.contains('sources-tag') || target.closest('.sources-tag'))) {
          ev.stopPropagation();
          this.close();
          this.onOpenChannelSources?.(ch);
          return;
        }
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
