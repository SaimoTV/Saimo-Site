/**
 * Cartão do Programa no Ar (Zap HUD Banner).
 * Mostra número, logo, canal, programa atual com barra de progresso, tempo restante e próximo programa.
 */

import { Channel, Api, EpgProgram } from '../core/Api';

export class ZapHUD {
  private element: HTMLElement;
  private logoEl: HTMLImageElement;
  private channelNumEl: HTMLElement;
  private channelNameEl: HTMLElement;
  private qualityEl: HTMLElement;
  private currentProgramEl: HTMLElement;
  private currentTimingEl: HTMLElement;
  private progressBarEl: HTMLElement;
  private nextProgramEl: HTMLElement;
  private hideTimer: any = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-zap-hud hidden';
    this.element.id = 'tv-zap-hud';

    this.element.innerHTML = `
      <img class="tv-zap-logo" id="zap-logo" src="" alt="" />
      <div class="tv-zap-info">
        <div class="tv-zap-channel-line">
          <span id="zap-num">1</span>
          <span id="zap-name">Canal</span>
          <span id="zap-quality" style="font-size:14px; background:rgba(0,227,255,0.2); padding:2px 8px; border-radius:4px;">FHD</span>
        </div>
        <div class="tv-zap-current-program" id="zap-cur-prog">Sem programação</div>
        <div class="tv-zap-next-line">
          <span id="zap-timing">--:--</span>
          <span id="zap-next-prog">A seguir: --</span>
        </div>
        <div class="tv-zap-progress-container">
          <div class="tv-zap-progress-bar" id="zap-prog-bar" style="width: 0%;"></div>
        </div>
      </div>
    `;

    this.logoEl = this.element.querySelector('#zap-logo')!;
    this.channelNumEl = this.element.querySelector('#zap-num')!;
    this.channelNameEl = this.element.querySelector('#zap-name')!;
    this.qualityEl = this.element.querySelector('#zap-quality')!;
    this.currentProgramEl = this.element.querySelector('#zap-cur-prog')!;
    this.currentTimingEl = this.element.querySelector('#zap-timing')!;
    this.progressBarEl = this.element.querySelector('#zap-prog-bar')!;
    this.nextProgramEl = this.element.querySelector('#zap-next-prog')!;
  }

  getElement(): HTMLElement {
    return this.element;
  }

  show(channel: Channel, variantIndex = 0) {
    this.channelNumEl.textContent = String(channel.number);
    this.channelNameEl.textContent = channel.name;

    if (channel.logo) {
      this.logoEl.src = channel.logo;
      this.logoEl.style.display = 'block';
    } else {
      this.logoEl.style.display = 'none';
    }

    const currentVariant = channel.variants[variantIndex] || channel.variants[0];
    this.qualityEl.textContent = currentVariant?.quality || 'FHD';

    const epg = Api.getNowNext(channel.name);
    if (epg.current) {
      this.currentProgramEl.textContent = epg.current.title;
      const startStr = epg.current.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const stopStr = epg.current.stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.currentTimingEl.textContent = `${startStr} – ${stopStr} · faltam ${epg.current.remainingMin} min`;
      this.progressBarEl.style.width = `${Math.round(epg.current.progress * 100)}%`;
    } else {
      this.currentProgramEl.textContent = 'Transmissão ao Vivo';
      this.currentTimingEl.textContent = 'Programação ao vivo';
      this.progressBarEl.style.width = '100%';
    }

    if (epg.next) {
      const nextStartStr = epg.next.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.nextProgramEl.textContent = `·  A seguir: ${epg.next.title} (${nextStartStr})`;
      this.nextProgramEl.style.display = 'inline';
    } else {
      this.nextProgramEl.style.display = 'none';
    }

    this.element.classList.remove('hidden');

    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.hide();
    }, 5500);
  }

  hide() {
    this.element.classList.add('hidden');
  }

  isVisible(): boolean {
    return !this.element.classList.contains('hidden');
  }
}
