/**
 * Tela On Demand (OnDemandScreen) - Desempenho Instantâneo 0ms.
 * Catálogo categorizado de Filmes, Séries, Animes e Doramas com filtragem instantânea
 * e resposta imediata ao controle remoto.
 */

import { State } from '../core/State';
import { Api, VODItem, DestaqueFila } from '../core/Api';
import { HeroBanner } from '../components/HeroBanner';
import { Rail, CardModel } from '../components/Rail';
import { SpatialNav } from '../core/SpatialNav';

export type CategoryFilter = 'todos' | 'filmes' | 'series' | 'animes' | 'doramas';

export class OnDemandScreen {
  private element: HTMLElement;
  private scrollContainer: HTMLElement;
  private heroBanner: HeroBanner;
  private filterBar: HTMLElement;
  private railsContainer: HTMLElement;

  private currentFilter: CategoryFilter = 'todos';
  private dynamicRails: Rail[] = [];
  private isLoaded = false;

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

    this.railsContainer = document.createElement('div');
    this.railsContainer.className = 'tv-ondemand-rails';
    this.scrollContainer.appendChild(this.railsContainer);

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
        if (this.currentFilter === c.id) return;
        this.currentFilter = c.id;
        this.renderCategoryChips();
        this.filterAndPopulateRails();
        const activeChip = this.filterBar.querySelector<HTMLElement>(`#chip-${c.id}`);
        if (activeChip) SpatialNav.focus(activeChip);
      });

      this.filterBar.appendChild(chip);
    });
  }

  enter() {
    this.element.classList.remove('hidden');
    this.heroBanner.setDefault(
      'On Demand',
      'Filmes · Séries · Animes · Doramas',
      'Explore milhares de títulos sob demanda catalogados por categoria e gênero com zero delay.'
    );

    // 1. Popula trilhos instantaneamente com cache local (<1ms)
    this.filterAndPopulateRails();

    // 2. Foca no chip da categoria ativa imediatamente
    const activeChip = this.filterBar.querySelector<HTMLElement>(`#chip-${this.currentFilter}`) ||
                       this.filterBar.querySelector<HTMLElement>('.tv-btn');
    if (activeChip) {
      SpatialNav.focus(activeChip);
    }

    // 3. Atualização não bloqueante em background se necessário
    if (!this.isLoaded) {
      this.isLoaded = true;
      Api.fetchDestaques().then((destaques) => {
        if (destaques && destaques.length > 0) {
          this.filterAndPopulateRails();
        }
      }).catch(() => {});
    }
  }

  leave() {
    this.element.classList.add('hidden');
  }

  private filterAndPopulateRails() {
    const allFilas = Api.getCachedDestaquesSync();
    if (allFilas.length === 0) return;

    // Filtra as fileiras correspondentes à categoria atual
    let matchingFilas: DestaqueFila[] = [];

    if (this.currentFilter === 'todos') {
      matchingFilas = allFilas;
    } else if (this.currentFilter === 'filmes') {
      matchingFilas = allFilas.filter((f) => {
        const t = f.titulo.toLowerCase();
        return !t.includes('série') && !t.includes('anime') && !t.includes('dorama');
      });
    } else if (this.currentFilter === 'series') {
      matchingFilas = allFilas.filter((f) => {
        const t = f.titulo.toLowerCase();
        return t.includes('série');
      });
    } else if (this.currentFilter === 'animes') {
      matchingFilas = allFilas.filter((f) => f.titulo.toLowerCase().includes('anime'));
    } else if (this.currentFilter === 'doramas') {
      matchingFilas = allFilas.filter((f) => f.titulo.toLowerCase().includes('dorama'));
    }

    // Limpa os trilhos existentes do contêiner
    this.railsContainer.innerHTML = '';
    this.dynamicRails = [];

    // Cria os trilhos dinâmicos
    matchingFilas.forEach((f) => {
      if (f.itens.length === 0) return;
      const rail = new Rail(f.titulo, false);
      rail.setCards(this.mapCards(f.itens));
      this.railsContainer.appendChild(rail.getElement());
      this.dynamicRails.push(rail);
    });

    // Trilho A-Z rápido e sem travamento de CPU (baseado no conjunto de títulos da categoria)
    const itemsMap = new Map<string, VODItem>();
    matchingFilas.forEach((f) => {
      f.itens.forEach((it) => {
        if (!itemsMap.has(it.title)) itemsMap.set(it.title, it);
      });
    });

    const uniqueItems = Array.from(itemsMap.values());
    if (uniqueItems.length > 0) {
      const sortedAZ = uniqueItems.slice(0, 35).sort((a, b) => a.title.localeCompare(b.title));
      const azRail = new Rail('Explorar de A a Z', false);
      azRail.setCards(this.mapCards(sortedAZ));
      this.railsContainer.appendChild(azRail.getElement());
      this.dynamicRails.push(azRail);
    }
  }

  private mapCards(items: VODItem[]): CardModel[] {
    return items.map((item) => ({
      id: `ondemand_${item.id}`,
      title: item.title,
      subtitle: item.year ? `${item.year} · ${item.isSeries ? 'Série' : 'Filme'}` : (item.isSeries ? 'Série' : 'Filme'),
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
