/**
 * Menu Global do Topo do Saimo TV.
 * Abas: Buscar, Início, Ao Vivo, Eventos, On Demand, Favoritos, Rádios, Extras, Ajustes + Relógio.
 */

import { State, MenuTab } from '../core/State';
import { SpatialNav } from '../core/SpatialNav';

export class MenuGlobal {
  private element: HTMLElement;
  private clockElement: HTMLElement;
  private tabsContainer: HTMLElement;
  private clockTimer: any = null;

  constructor() {
    this.element = document.createElement('header');
    this.element.className = 'tv-menu-global';
    this.element.id = 'tv-menu-global';

    this.element.innerHTML = `
      <div class="tv-menu-logo">
        <img src="icons/icon-192.png" onerror="this.style.display='none'" alt="Saimo TV" />
        <span>SAIMO TV</span>
      </div>
      <nav class="tv-menu-tabs" id="tv-menu-tabs"></nav>
      <div class="tv-menu-clock" id="tv-menu-clock">00:00</div>
    `;

    this.tabsContainer = this.element.querySelector('#tv-menu-tabs')!;
    this.clockElement = this.element.querySelector('#tv-menu-clock')!;

    this.renderTabs();
    this.startClock();

    State.on('screen-changed', () => this.updateActiveTab());
    State.on('extras-unlocked', () => this.renderTabs());
  }

  getElement(): HTMLElement {
    return this.element;
  }

  private renderTabs() {
    this.tabsContainer.innerHTML = '';

    const tabs: { id: MenuTab; label: string; icon: string; screen: any }[] = [
      { id: 'buscar', label: 'Buscar', icon: '🔍', screen: 'search' },
      { id: 'inicio', label: 'Início', icon: '🏠', screen: 'home' },
      { id: 'ao_vivo', label: 'Ao Vivo', icon: '📺', screen: 'live' },
      { id: 'eventos', label: 'Eventos', icon: '⚽', screen: 'events' },
      { id: 'on_demand', label: 'On Demand', icon: '🎬', screen: 'ondemand' },
      { id: 'radios', label: 'Rádios', icon: '📻', screen: 'radios' },
      { id: 'ajustes', label: 'Ajustes', icon: '⚙️', screen: 'settings' },
    ];

    if (State.unlockedExtras) {
      tabs.splice(6, 0, { id: 'extras', label: 'Extras', icon: '🔒', screen: 'ondemand' });
    }

    tabs.forEach((t) => {
      const btn = document.createElement('div');
      btn.className = `tv-menu-tab nav-focusable ${State.activeTab === t.id ? 'active' : ''}`;
      btn.setAttribute('data-nav', 'true');
      btn.setAttribute('data-tab-id', t.id);
      btn.id = `menu-tab-${t.id}`;
      btn.textContent = `${t.icon} ${t.label}`;

      btn.addEventListener('click', () => {
        State.setScreen(t.screen);
      });

      this.tabsContainer.appendChild(btn);
    });
  }

  private updateActiveTab() {
    const tabs = this.tabsContainer.querySelectorAll<HTMLElement>('.tv-menu-tab');
    tabs.forEach((tab) => {
      const id = tab.getAttribute('data-tab-id');
      if (id === State.activeTab) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  private startClock() {
    const update = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      this.clockElement.textContent = `${h}:${m}`;
    };
    update();
    this.clockTimer = setInterval(update, 20000);
  }

  focus() {
    const active = this.tabsContainer.querySelector<HTMLElement>(`.tv-menu-tab[data-tab-id="${State.activeTab}"]`);
    if (active) SpatialNav.focus(active);
    else {
      const first = this.tabsContainer.querySelector<HTMLElement>('.tv-menu-tab');
      if (first) SpatialNav.focus(first);
    }
  }
}
