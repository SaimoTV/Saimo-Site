/**
 * Diálogo "Escolher Fonte" (Source Selector Modal).
 * Lista todas as origens disponíveis com qualidade, servidor e status de conexão.
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
      <div class="tv-modal-content" style="max-width:860px; width:92%; background:#10141e; border:1px solid #00e3ff; border-radius:24px; padding:36px 44px; box-shadow:0 30px 90px rgba(0,0,0,0.95);">
        <div class="tv-modal-title" id="source-modal-title" style="font-size:32px; font-weight:800; color:#00e3ff; margin-bottom:6px;">Escolher Fonte</div>
        <div style="font-size:16px; color:#94a3b8; margin-bottom:24px;">Selecione um servidor alternativo caso o sinal atual apresente travamentos ou instabilidade.</div>
        <div id="source-modal-list" style="display:flex; flex-direction:column; gap:12px; max-height:520px; overflow-y:auto; padding-right:8px;"></div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:24px; padding-top:16px; border-top:1px solid rgba(255,255,255,0.1); font-size:15px; color:#64748b;">
          <span>Controle: [Cima/Baixo] Navegar</span>
          <span>[OK] Conectar · [Voltar] Fechar</span>
        </div>
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

    if (!variants || variants.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.padding = '30px';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.color = '#94a3b8';
      emptyMsg.style.fontSize = '18px';
      emptyMsg.textContent = 'Nenhuma fonte extra cadastrada para este canal no momento.';
      this.listEl.appendChild(emptyMsg);
    } else {
      variants.forEach((v, idx) => {
        const isString = typeof v === 'string';
        const quality = !isString ? (v as ChannelVariant).quality || 'HD' : 'HD';
        const urlStr = isString ? (v as string) : (v as ChannelVariant).url;

        let host = 'Servidor CDN';
        try {
          host = new URL(urlStr).hostname.replace('www.', '');
        } catch (e) {}

        const btn = document.createElement('div');
        const isActive = (idx === currentIndex);
        btn.className = `tv-btn nav-focusable ${isActive ? 'primary' : ''}`;
        btn.setAttribute('data-nav', 'true');
        btn.style.display = 'flex';
        btn.style.justifyContent = 'space-between';
        btn.style.alignItems = 'center';
        btn.style.width = '100%';
        btn.style.padding = '16px 24px';
        btn.style.borderRadius = '14px';
        btn.style.fontSize = '18px';
        btn.style.cursor = 'pointer';

        btn.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-weight:700;">${isActive ? '✓ ' : ''}Fonte ${idx + 1}</span>
            <span style="font-size:13px; background:rgba(255,255,255,0.15); padding:2px 8px; border-radius:6px; color:#ffffff;">${quality}</span>
            ${isActive ? '<span style="font-size:13px; color:#0b0e14; font-weight:700; background:#00e3ff; padding:2px 8px; border-radius:6px;">EM USO</span>' : ''}
          </div>
          <span style="font-size:14px; opacity:0.8; font-family:monospace;">${host}</span>
        `;

        btn.addEventListener('click', () => {
          this.close();
          this.onSelectVariant?.(idx);
        });

        this.listEl.appendChild(btn);
      });
    }

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
