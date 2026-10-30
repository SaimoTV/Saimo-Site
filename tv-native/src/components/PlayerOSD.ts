/**
 * Interface Sobreposta do Player VOD (Player OSD).
 * Barra de progresso com seek, seleção de faixas de áudio, legendas e carrossel de episódios.
 */

import { AudioTrack, SubtitleTrack } from '../player/TVPlayer';
import { SpatialNav } from '../core/SpatialNav';

export class PlayerOSD {
  private element: HTMLElement;
  private titleEl: HTMLElement;
  private sourceTagEl: HTMLElement;
  private currentTimeEl: HTMLElement;
  private durationEl: HTMLElement;
  private seekbarFillEl: HTMLElement;
  private buttonsContainer: HTMLElement;
  private episodesDrawerEl: HTMLElement;
  private hideTimer: any = null;

  private onSeekAction?: (deltaSec: number) => void;
  private onTogglePlayAction?: () => void;
  private onSelectAudioAction?: () => void;
  private onSelectSubtitleAction?: () => void;
  private onOpenSourcesAction?: () => void;
  private onSelectEpisodeAction?: (epIndex: number) => void;

  constructor(callbacks: {
    onSeek: (deltaSec: number) => void;
    onTogglePlay: () => void;
    onSelectAudio: () => void;
    onSelectSubtitle: () => void;
    onOpenSources: () => void;
    onSelectEpisode?: (epIndex: number) => void;
  }) {
    this.onSeekAction = callbacks.onSeek;
    this.onTogglePlayAction = callbacks.onTogglePlay;
    this.onSelectAudioAction = callbacks.onSelectAudio;
    this.onSelectSubtitleAction = callbacks.onSelectSubtitle;
    this.onOpenSourcesAction = callbacks.onOpenSources;
    this.onSelectEpisodeAction = callbacks.onSelectEpisode;

    this.element = document.createElement('div');
    this.element.className = 'tv-player-osd hidden';
    this.element.id = 'tv-player-osd';

    this.element.innerHTML = `
      <div class="tv-osd-title-line">
        <div class="tv-osd-title" id="osd-title">Filme</div>
        <div class="tv-osd-source-tag" id="osd-source-tag">Fonte 1 (FHD)</div>
      </div>
      <div class="tv-osd-progress-line">
        <span class="tv-osd-time" id="osd-cur-time">00:00</span>
        <div class="tv-osd-seekbar">
          <div class="tv-osd-seekbar-fill" id="osd-seek-fill" style="width: 0%;"></div>
        </div>
        <span class="tv-osd-time" id="osd-duration">00:00</span>
      </div>
      <div class="tv-osd-buttons" id="osd-buttons"></div>
      <div id="osd-episodes-drawer" style="display:none; margin-top:14px; overflow-x:hidden;"></div>
    `;

    this.titleEl = this.element.querySelector('#osd-title')!;
    this.sourceTagEl = this.element.querySelector('#osd-source-tag')!;
    this.currentTimeEl = this.element.querySelector('#osd-cur-time')!;
    this.durationEl = this.element.querySelector('#osd-duration')!;
    this.seekbarFillEl = this.element.querySelector('#osd-seek-fill')!;
    this.buttonsContainer = this.element.querySelector('#osd-buttons')!;
    this.episodesDrawerEl = this.element.querySelector('#osd-episodes-drawer')!;

    this.renderButtons();
  }

  getElement(): HTMLElement {
    return this.element;
  }

  private renderButtons() {
    this.buttonsContainer.innerHTML = '';

    const btns = [
      { id: 'osd-btn-play', label: '⏯ Pausar', action: () => this.onTogglePlayAction?.() },
      { id: 'osd-btn-rew', label: '⏪ -10s', action: () => this.onSeekAction?.(-10) },
      { id: 'osd-btn-fwd', label: '⏩ +10s', action: () => this.onSeekAction?.(10) },
      { id: 'osd-btn-audio', label: '🔊 Áudio', action: () => this.onSelectAudioAction?.() },
      { id: 'osd-btn-sub', label: '💬 Legendas', action: () => this.onSelectSubtitleAction?.() },
      { id: 'osd-btn-src', label: '🔄 Fontes', action: () => this.onOpenSourcesAction?.() },
    ];

    btns.forEach((b) => {
      const btn = document.createElement('div');
      btn.className = 'tv-btn nav-focusable';
      btn.setAttribute('data-nav', 'true');
      btn.id = b.id;
      btn.textContent = b.label;
      btn.addEventListener('click', b.action);
      this.buttonsContainer.appendChild(btn);
    });
  }

  setInfo(title: string, sourceLabel: string) {
    this.titleEl.textContent = title;
    this.sourceTagEl.textContent = sourceLabel;
  }

  updateProgress(currentSec: number, durationSec: number) {
    this.currentTimeEl.textContent = this.formatTime(currentSec);
    this.durationEl.textContent = this.formatTime(durationSec);

    const percent = durationSec > 0 ? Math.min(100, (currentSec / durationSec) * 100) : 0;
    this.seekbarFillEl.style.width = `${percent}%`;
  }

  private formatTime(sec: number): string {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const remainM = m % 60;
    const remainS = s % 60;

    if (h > 0) {
      return `${h}:${String(remainM).padStart(2, '0')}:${String(remainS).padStart(2, '0')}`;
    }
    return `${String(remainM).padStart(2, '0')}:${String(remainS).padStart(2, '0')}`;
  }

  show() {
    this.element.classList.remove('hidden');
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.hide();
    }, 5000);
  }

  hide() {
    this.element.classList.add('hidden');
  }

  isVisible(): boolean {
    return !this.element.classList.contains('hidden');
  }
}
