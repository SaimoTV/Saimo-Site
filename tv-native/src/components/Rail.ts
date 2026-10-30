/**
 * Trilho Horizontal de Alta Fluidez (Smart TV Rail Component).
 * Desenhado para rolagem de 60 FPS com aceleração de GPU e retenção de foco.
 */

import { SpatialNav } from '../core/SpatialNav';

export interface CardModel {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  progressPercent?: number;
  badge?: string;
  badgeColor?: string;
  onClick: () => void;
  onFocus?: () => void;
  extraData?: any;
}

export class Rail {
  private element: HTMLElement;
  private titleEl: HTMLElement;
  private countEl: HTMLElement;
  private itemsContainer: HTMLElement;
  private isWide = false;

  constructor(title: string, isWide = false) {
    this.isWide = isWide;
    this.element = document.createElement('div');
    this.element.className = 'tv-rail';

    this.element.innerHTML = `
      <div class="tv-rail-header">
        <span class="tv-rail-title">${title}</span>
        <span class="tv-rail-count" style="font-size:16px; opacity:0.6;"></span>
      </div>
      <div class="tv-rail-items tv-scroll-h"></div>
    `;

    this.titleEl = this.element.querySelector('.tv-rail-title')!;
    this.countEl = this.element.querySelector('.tv-rail-count')!;
    this.itemsContainer = this.element.querySelector('.tv-rail-items')!;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  setCards(cards: CardModel[]) {
    this.itemsContainer.innerHTML = '';
    this.countEl.textContent = cards.length > 0 ? `(${cards.length})` : '';

    cards.forEach((card, idx) => {
      const cardEl = document.createElement('div');
      cardEl.className = `tv-card nav-focusable ${this.isWide ? 'wide' : ''}`;
      cardEl.setAttribute('data-nav', 'true');
      cardEl.id = `card-${card.id}`;

      // Conteúdo do Card
      let innerHtml = '';
      if (this.isWide) {
        innerHtml = `
          <div class="tv-card-wide-inner">
            ${card.image ? `<img class="tv-card-img" src="${card.image}" onerror="this.style.display='none'" loading="lazy" alt="" />` : '<div class="tv-card-placeholder"></div>'}
            <div class="tv-card-wide-info">
              <div class="tv-card-title">${card.title}</div>
              ${card.subtitle ? `<div class="tv-card-subtitle">${card.subtitle}</div>` : ''}
              ${card.progressPercent !== undefined ? `
                <div class="tv-card-progress-bar">
                  <div class="tv-card-progress-fill" style="width: ${card.progressPercent}%"></div>
                </div>` : ''}
            </div>
          </div>
        `;
      } else {
        innerHtml = `
          <div class="tv-card-poster-wrap">
            ${card.image ? `<img class="tv-card-img" src="${card.image}" onerror="this.style.display='none'" loading="lazy" alt="" />` : '<div class="tv-card-placeholder"></div>'}
            ${card.badge ? `<span class="tv-card-badge" style="background:${card.badgeColor || '#00e3ff'}">${card.badge}</span>` : ''}
            ${card.progressPercent !== undefined ? `
              <div class="tv-card-progress-bar">
                <div class="tv-card-progress-fill" style="width: ${card.progressPercent}%"></div>
              </div>` : ''}
          </div>
          <div class="tv-card-title">${card.title}</div>
          ${card.subtitle ? `<div class="tv-card-subtitle">${card.subtitle}</div>` : ''}
        `;
      }

      cardEl.innerHTML = innerHtml;

      cardEl.addEventListener('click', () => {
        card.onClick();
      });

      cardEl.addEventListener('nav-focus', () => {
        card.onFocus?.();
      });

      this.itemsContainer.appendChild(cardEl);
    });
  }

  getFirstCard(): HTMLElement | null {
    return this.itemsContainer.querySelector<HTMLElement>('.tv-card');
  }
}
