/**
 * Tela On Demand (OnDemandScreen).
 * Hub unificado de Filmes, Séries, Animes e Doramas com filtros de categoria e trilhos por gênero.
 */

import { State } from '../core/State';
import { Api, VODItem } from '../core/Api';
import { HeroBanner } from '../components/HeroBanner';
import { Rail, CardModel } from '../components/Rail';
import { SpatialNav } from '../core/SpatialNav';

export type CategoryFilter = 'todos' | 'filmes' | 'series' | 'animes' | 'doramas';

export class OnDemandScreen {
  private element: HTMLElement;
  private scrollContainer: HTMLElement;
  private heroBanner: HeroBanner;
  private filterBar: HTMLElement;

  private currentFilter: CategoryFilter = 'todos';
  private genreRails: Map<string, Rail> = new Map();
  private azRail: Rail;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-ondemand-screen hidden';
    this.element.id = 'screen-ondemand';

    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'tv-screen-scroll tv-scroll-v';

    this.heroBanner = new HeroBanner();
    this.scrollContainer.appendChild(this.heroBanner.getElement());

    // Barra de Categorias Superiores (Pílulas / Chips)
    this.filterBar = document.createElement('div');
    this.filterBar.className = 'tv-category-chips';
    this.filterBar.style.display = 'flex';
    this.filterBar.style.gap = '16px';
    this.filterBar.style.padding = '0 70px 24px';
    this.renderCategoryChips();
    this.scrollContainer.appendChild(this.filterBar);

    // Trilhos de Gêneros Principais
    const mainGenres = [
      'Ação',
      'Comédia',
      'Terror',
      'Ficção científica',
      'Animação',
      'Aventura',
      'Romance',
      'Drama',
      'Crime',
    ];

    mainGenres.forEach((g) => {
      const rail = new Rail(g, false);
      this.genreRails.set(g, rail);
      this.scrollContainer.appendChild(rail.getElement());
    });

    this.azRail = new Rail('Explorar de A a Z', false);
    this.scrollContainer.appendChild(this.azRail.getElement());

    this.element.appendChild(this.scrollContainer);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  private renderCategoryChips() {
    this.filterBar.innerHTML = '';

    const chips: { id: CategoryFilter; label: string; color: string }[] = [
      { id: 'todos', label: '🎬 Todos os Conteúdos', color: '#00e3ff' },
      { id: 'filmes', label: '🎥 Filmes', color: '#4FE3D0' },
      { id: 'series', label: '📺 Séries', color: '#7AA2FF' },
      { id: 'animes', label: '⚡ Animes', color: '#FFB454' },
      { id: 'doramas', label: '🌸 Doramas', color: '#FF7EB6' },
    ];

    chips.forEach((c) => {
      const chip = document.createElement('div');
      chip.className = `tv-btn nav-focusable ${this.currentFilter === c.id ? 'primary' : ''}`;
      chip.setAttribute('data-nav', 'true');
      chip.id = `chip-${c.id}`;
      chip.textContent = c.label;
      if (this.currentFilter === c.id) {
        chip.style.backgroundColor = c.color;
        chip.style.color = '#070709';
      }

      chip.addEventListener('click', () => {
        this.currentFilter = c.id;
        this.renderCategoryChips();
        this.filterAndPopulateRails();
      });

      this.filterBar.appendChild(chip);
    });
  }

  async enter() {
    this.element.classList.remove('hidden');
    this.heroBanner.setDefault(
      'On Demand',
      'Filmes · Séries · Animes · Doramas',
      'Explore milhares de títulos sob demanda catalogados por categoria e gênero.'
    );

    if (State.vodItems.length === 0) {
      State.vodItems = await Api.fetchFichas();
    }

    this.filterAndPopulateRails();

    setTimeout(() => {
      const firstChip = this.filterBar.querySelector<HTMLElement>('.tv-btn');
      if (firstChip) SpatialNav.focus(firstChip);
    }, 50);
  }

  leave() {
    this.element.classList.add('hidden');
  }

  private filterAndPopulateRails() {
    let items = State.vodItems;

    if (this.currentFilter === 'filmes') {
      items = items.filter((i) => !i.isSeries);
    } else if (this.currentFilter === 'series') {
      items = items.filter((i) => i.isSeries);
    } else if (this.currentFilter === 'animes') {
      items = items.filter((i) => i.genres?.some((g) => g.toLowerCase().includes('anime') || g.toLowerCase().includes('animação')));
    } else if (this.currentFilter === 'doramas') {
      items = items.filter((i) => i.genres?.some((g) => g.toLowerCase().includes('dorama') || g.toLowerCase().includes('coreano')));
    }

    this.genreRails.forEach((rail, genreName) => {
      const matching = items
        .filter((i) => i.genres?.some((g) => g.toLowerCase().includes(genreName.toLowerCase())))
        .slice(0, 20);

      if (matching.length === 0) {
        rail.getElement().style.display = 'none';
      } else {
        rail.getElement().style.display = 'block';
        rail.setCards(this.mapCards(matching));
      }
    });

    // Trilho A-Z
    const sortedAZ = [...items].sort((a, b) => a.title.localeCompare(b.title)).slice(0, 30);
    this.azRail.setCards(this.mapCards(sortedAZ));
  }

  private mapCards(items: VODItem[]): CardModel[] {
    return items.map((item) => ({
      id: `ondemand_${item.id}`,
      title: item.title,
      subtitle: item.genres?.slice(0, 2).join(' · ') || (item.isSeries ? 'Série' : 'Filme'),
      image: item.poster,
      badge: item.year || (item.isSeries ? 'SÉRIE' : '4K'),
      badgeColor: item.isSeries ? '#7aa2ff' : '#4fe3d0',
      onClick: () => {
        State.setScreen('ficha', { vod: item });
      },
      onFocus: () => {
        this.heroBanner.update(item);
      },
    }));
  }
}
