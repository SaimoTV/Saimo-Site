/**
 * Banner de Destaque Superior (Hero Showcase Banner).
 * Mostra pôster em alta definição, metadados, avaliação e sinopse do item em foco.
 */

import { VODItem } from '../core/Api';

export class HeroBanner {
  private element: HTMLElement;
  private bgEl: HTMLImageElement;
  private titleEl: HTMLElement;
  private metaEl: HTMLElement;
  private synopsisEl: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-hero-banner';
    this.element.id = 'tv-hero-banner';

    this.element.innerHTML = `
      <img class="tv-hero-bg" id="hero-bg" src="" alt="" />
      <div class="tv-hero-title" id="hero-title">Saimo TV</div>
      <div class="tv-hero-meta" id="hero-meta">Filmes · Séries · Ao Vivo</div>
      <div class="tv-hero-synopsis" id="hero-synopsis">Selecione um título para ver os detalhes e reproduzir.</div>
    `;

    this.bgEl = this.element.querySelector('#hero-bg')!;
    this.titleEl = this.element.querySelector('#hero-title')!;
    this.metaEl = this.element.querySelector('#hero-meta')!;
    this.synopsisEl = this.element.querySelector('#hero-synopsis')!;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  update(item: VODItem) {
    this.titleEl.textContent = item.title;
    if (item.poster) {
      this.bgEl.src = item.poster;
      this.bgEl.style.display = 'block';
    }

    const metaParts: string[] = [];
    if (item.year) metaParts.push(item.year);
    if (item.genres && item.genres.length > 0) metaParts.push(item.genres.slice(0, 3).join(', '));
    if (item.isSeries) metaParts.push('Série');
    else metaParts.push('Filme');

    this.metaEl.textContent = metaParts.join(' · ');
    this.synopsisEl.textContent = item.overview || 'Clique para assistir ou ver detalhes completos.';
  }

  setDefault(title: string, subtitle: string, desc: string, bgUrl = '') {
    this.titleEl.textContent = title;
    this.metaEl.textContent = subtitle;
    this.synopsisEl.textContent = desc;
    if (bgUrl) {
      this.bgEl.src = bgUrl;
      this.bgEl.style.display = 'block';
    } else {
      this.bgEl.style.display = 'none';
    }
  }
}
