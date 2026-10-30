/**
 * Diálogo "Escolher Fonte" (Source Selector Modal).
 * Lista todas as origens disponíveis com qualidade, servidor e status de failover.
 */

import { ChannelVariant } from '../core/Api';
import { SpatialNav } from '../core/SpatialNav';

export class SourceModal {
  private element: HTMLElement;
  private listEl: HTMLElement;
  private titleEl: HTMLElement;
  private onSelectVariant?: (index: number) => void;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-modal-overlay hidden';
    this.element.id = 'tv-source-modal';

    this.element.innerHTML = `
      <div class="tv-modal-content">
        <div class="tv-modal-title" id="source-modal-title">Escolher Fonte</div>
        <div id="source-modal-list" style="display:flex; flex-direction:column; gap:12px; max-height:450px; overflow-y:hidden;"></div>
      </div>
    `;

    this.titleEl = this.element.querySelector('#source-modal-title')!;
    this.listEl = this.element.querySelector('#source-modal-list')!;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  open(
    title: string,
    variants: (ChannelVariant | string)[],
    currentIndex = 0,
    onSelect: (index: number) => void
  ) {
    this.onSelectVariant = onSelect;
    this.titleEl.textContent = `Fontes de ${title}`;
    this.listEl.innerHTML = '';

    variants.forEach((v, idx) => {
      const isString = typeof v === 'string';
      const quality = !isString ? (v as ChannelVariant).quality || 'Qualidade Padrão' : 'Padrão';
      const urlStr = isString ? (v as string) : (v as ChannelVariant).url;

      let host = 'Servidor CDN';
      try {
        host = new URL(urlStr).hostname.replace('www.', '');
      } catch (e) {}

      const btn = document.createElement('div');
      btn.className = `tv-btn nav-focusable ${idx === currentIndex ? 'primary' : ''}`;
      btn.setAttribute('data-nav', 'true');
      btn.style.justifyContent = 'space-between';
      btn.style.width = '100%';

      btn.innerHTML = `
        <span>${idx === currentIndex ? '✓ ' : ''}Fonte ${idx + 1} · ${quality}</span>
        <span style="font-size:14px; opacity:0.7;">${host}</span>
      `;

      btn.addEventListener('click', () => {
        this.close();
        this.onSelectVariant?.(idx);
      });

      this.listEl.appendChild(btn);
    });

    this.element.classList.remove('hidden');
    SpatialNav.setTrap(this.element);

    const first = this.listEl.querySelector<HTMLElement>('.tv-btn');
    if (first) SpatialNav.focus(first);
  }

  close() {
    this.element.classList.add('hidden');
    SpatialNav.setTrap(null);
  }

  isOpen(): boolean {
    return !this.element.classList.contains('hidden');
  }
}
