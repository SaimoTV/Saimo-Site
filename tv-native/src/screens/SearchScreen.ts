/**
 * Busca Global Inteligente (SearchScreen).
 * Teclado virtual integrado otimizado para controle remoto, busca instantânea
 * em tempo real através de canais, filmes, séries e animes sem repaints pesados.
 */

import { State } from '../core/State';
import { Api, Channel, VODItem } from '../core/Api';
import { VirtualKeyboard } from '../components/VirtualKeyboard';
import { Rail, CardModel } from '../components/Rail';
import { SpatialNav } from '../core/SpatialNav';

export class SearchScreen {
  private element: HTMLElement;
  private inputDisplay: HTMLElement;
  private keyboard: VirtualKeyboard;
  private resultsContainer: HTMLElement;

  private currentQuery = '';
  private debounceTimer: any = null;

  private channelsRail: Rail;
  private vodRail: Rail;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-search-screen hidden';
    this.element.id = 'screen-search';

    const layout = document.createElement('div');
    layout.className = 'tv-search-layout';

    // Coluna Esquerda: Campo de Busca + Teclado Virtual
    const leftCol = document.createElement('div');
    leftCol.className = 'tv-search-left';

    this.inputDisplay = document.createElement('div');
    this.inputDisplay.className = 'tv-search-input-box';
    this.inputDisplay.innerHTML = `<span>🔍</span><span id="search-query-text" style="color:rgba(255,255,255,0.5);">Digite para buscar...</span>`;
    leftCol.appendChild(this.inputDisplay);

    this.keyboard = new VirtualKeyboard({
      onKeyInput: (char) => this.appendChar(char),
      onBackspace: () => this.backspace(),
      onClear: () => this.clearQuery(),
      onSearch: () => this.focusResults(),
    });
    leftCol.appendChild(this.keyboard.getElement());

    // Coluna Direita: Trilhos de Resultados
    this.resultsContainer = document.createElement('div');
    this.resultsContainer.className = 'tv-search-right tv-scroll-v';

    this.channelsRail = new Rail('Canais Encontrados', true);
    this.vodRail = new Rail('Filmes & Séries Encontrados', false);

    this.resultsContainer.appendChild(this.channelsRail.getElement());
    this.resultsContainer.appendChild(this.vodRail.getElement());

    layout.appendChild(leftCol);
    layout.appendChild(this.resultsContainer);
    this.element.appendChild(layout);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  enter() {
    this.element.classList.remove('hidden');

    if (State.channels.length === 0) {
      State.channels = Api.getCachedChannelsSync();
      if (State.channels.length === 0) {
        Api.fetchChannels().then((c) => { State.channels = c; }).catch(() => {});
      }
    }

    if (State.vodItems.length === 0) {
      Api.fetchFichas().then((v) => { State.vodItems = v; }).catch(() => {});
    }

    this.keyboard.focusFirst();
  }

  leave() {
    this.element.classList.add('hidden');
  }

  private appendChar(char: string) {
    this.currentQuery += char;
    this.updateQueryDisplay();
    this.scheduleSearch();
  }

  private backspace() {
    if (this.currentQuery.length > 0) {
      this.currentQuery = this.currentQuery.slice(0, -1);
      this.updateQueryDisplay();
      this.scheduleSearch();
    }
  }

  private clearQuery() {
    this.currentQuery = '';
    this.updateQueryDisplay();
    this.scheduleSearch();
  }

  private updateQueryDisplay() {
    const textEl = this.inputDisplay.querySelector('#search-query-text');
    if (textEl) {
      if (this.currentQuery) {
        textEl.textContent = this.currentQuery;
        (textEl as HTMLElement).style.color = '#ffffff';
      } else {
        textEl.textContent = 'Digite para buscar...';
        (textEl as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
      }
    }
  }

  private scheduleSearch() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.performSearch();
    }, 150);
  }

  private performSearch() {
    const q = this.currentQuery.trim().toLowerCase();
    if (!q) {
      this.channelsRail.getElement().style.display = 'none';
      this.vodRail.getElement().style.display = 'none';
      return;
    }

    // Busca Canais
    const matchedChannels = State.channels.filter((c) => c.name.toLowerCase().includes(q));
    if (matchedChannels.length > 0) {
      this.channelsRail.getElement().style.display = 'block';
      this.channelsRail.setCards(
        matchedChannels.slice(0, 15).map((c) => ({
          id: `search_ch_${c.id}`,
          title: c.name,
          subtitle: c.category,
          image: c.logo,
          onClick: () => {
            State.setScreen('live', { channel: c });
          },
        }))
      );
    } else {
      this.channelsRail.getElement().style.display = 'none';
    }

    // Busca Filmes e Séries usando getSearchPool() com interrupção rápida aos 25 itens
    const pool = Api.getSearchPool();
    const matchedVOD: VODItem[] = [];
    for (let i = 0; i < pool.length; i++) {
      const v = pool[i];
      if (
        v.title.toLowerCase().includes(q) ||
        v.genres?.some((g) => g.toLowerCase().includes(q))
      ) {
        matchedVOD.push(v);
        if (matchedVOD.length >= 25) break;
      }
    }

    if (matchedVOD.length > 0) {
      this.vodRail.getElement().style.display = 'block';
      this.vodRail.setCards(
        matchedVOD.slice(0, 25).map((v) => ({
          id: `search_vod_${v.id}`,
          title: v.title,
          subtitle: v.genres?.slice(0, 2).join(' · '),
          image: v.poster,
          badge: v.year || (v.isSeries ? 'SÉRIE' : '4K'),
          badgeColor: v.isSeries ? '#7aa2ff' : '#4fe3d0',
          onClick: () => {
            State.setScreen('ficha', { vod: v });
          },
        }))
      );
    } else {
      this.vodRail.getElement().style.display = 'none';
    }
  }

  private focusResults() {
    const firstCard =
      this.channelsRail.getFirstCard() ||
      this.vodRail.getFirstCard();
    if (firstCard) {
      SpatialNav.focus(firstCard);
    }
  }
}
