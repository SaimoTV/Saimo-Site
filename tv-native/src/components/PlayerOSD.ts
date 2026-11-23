/**
 * Interface Sobreposta do Player VOD (Player OSD).
 * Barra de progresso com seek, seleção de faixas de áudio, legendas e carrossel de episódios.
 */

import { AudioTrack, SubtitleTrack } from '../player/TVPlayer';
import { SpatialNav } from '../core/SpatialNav';
import { icone } from './Icones';

export class PlayerOSD {
  private element: HTMLElement;
  private titleEl: HTMLElement;
  private sourceTagEl: HTMLElement;
  private currentTimeEl: HTMLElement;
  private durationEl: HTMLElement;
  private seekbarEl: HTMLElement;
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
  private onTelaAction?: () => void;
  private onVelocidadeAction?: () => void;
  private onEpisodiosAction?: () => void;
  private onProximoAction?: () => void;
  /** Série: ganha os botões Episódios e Próximo. */
  private serie = false;

  constructor(callbacks: {
    onSeek: (deltaSec: number) => void;
    onTogglePlay: () => void;
    onSelectAudio: () => void;
    onSelectSubtitle: () => void;
    onOpenSources: () => void;
    onSelectEpisode?: (epIndex: number) => void;
    onTela?: () => void;
    onVelocidade?: () => void;
    onEpisodios?: () => void;
    onProximo?: () => void;
  }) {
    this.onTelaAction = callbacks.onTela;
    this.onVelocidadeAction = callbacks.onVelocidade;
    this.onEpisodiosAction = callbacks.onEpisodios;
    this.onProximoAction = callbacks.onProximo;
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
        <div class="tv-osd-seekbar nav-focusable" id="osd-seekbar" data-nav="true" data-nav-up="none" data-nav-down="osd-btn-play" data-nav-left="none" data-nav-right="none" role="slider" aria-label="Barra de progresso">
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
    this.seekbarEl = this.element.querySelector('#osd-seekbar')!;
    this.seekbarFillEl = this.element.querySelector('#osd-seek-fill')!;
    this.buttonsContainer = this.element.querySelector('#osd-buttons')!;
    this.episodesDrawerEl = this.element.querySelector('#osd-episodes-drawer')!;

    this.seekbarEl.addEventListener('click', () => this.onTogglePlayAction?.());

    this.renderButtons();
  }

  getElement(): HTMLElement {
    return this.element;
  }

  getSeekbar(): HTMLElement {
    return this.seekbarEl;
  }

  getButtons(): HTMLElement[] {
    return Array.from(this.buttonsContainer.querySelectorAll<HTMLElement>('.tv-btn'));
  }

  focusSeekbar() {
    SpatialNav.focus(this.seekbarEl, false);
  }

  focusFirstButton() {
    const first = this.buttonsContainer.querySelector<HTMLElement>('.tv-btn');
    if (first) SpatialNav.focus(first, false);
  }

  isSeekbarFocused(): boolean {
    return SpatialNav.getCurrent() === this.seekbarEl;
  }

  isButtonFocused(): boolean {
    const cur = SpatialNav.getCurrent();
    return !!cur && this.buttonsContainer.contains(cur);
  }

  isFocusedWithin(): boolean {
    const cur = SpatialNav.getCurrent();
    return !!cur && this.element.contains(cur);
  }

  private jogando = true;

  /** Série: mostra Episódios e Próximo; filme: esconde. */
  setSerie(serie: boolean) {
    if (this.serie === serie) return;
    this.serie = serie;
    this.renderButtons();
  }

  /** O primeiro botão vira Reproduzir quando está pausado. */
  setPlaying(jogando: boolean) {
    this.jogando = jogando;
    const b = this.buttonsContainer.querySelector<HTMLElement>('#osd-btn-play');
    if (b) b.innerHTML = this.rotuloPlay();
  }

  private rotuloPlay(): string {
    return this.jogando ? `${icone('pause')}Pausar` : `${icone('play')}Reproduzir`;
  }

  private renderButtons() {
    this.buttonsContainer.innerHTML = '';

    const btns: { id: string; label: string; action: () => void }[] = [
      { id: 'osd-btn-play', label: this.rotuloPlay(), action: () => this.onTogglePlayAction?.() },
      { id: 'osd-btn-rew', label: `${icone('rew')}-10s`, action: () => this.onSeekAction?.(-10) },
      { id: 'osd-btn-fwd', label: `${icone('ff')}+10s`, action: () => this.onSeekAction?.(10) },
      { id: 'osd-btn-audio', label: `${icone('audio')}Áudio`, action: () => this.onSelectAudioAction?.() },
      { id: 'osd-btn-sub', label: `${icone('subs')}Legendas`, action: () => this.onSelectSubtitleAction?.() },
      { id: 'osd-btn-tela', label: `${icone('tela')}Tela`, action: () => this.onTelaAction?.() },
      { id: 'osd-btn-vel', label: `${icone('speed')}Velocidade`, action: () => this.onVelocidadeAction?.() },
    ];
    if (this.serie) {
      btns.push({ id: 'osd-btn-eps', label: `${icone('episodes')}Episódios`, action: () => this.onEpisodiosAction?.() });
      btns.push({ id: 'osd-btn-next', label: `${icone('next')}Próximo`, action: () => this.onProximoAction?.() });
    }
    btns.push({ id: 'osd-btn-src', label: `${icone('autorenew')}Fontes`, action: () => this.onOpenSourcesAction?.() });

    btns.forEach((b, idx) => {
      const btn = document.createElement('div');
      btn.className = 'tv-btn nav-focusable tv-osd-btn';
      btn.setAttribute('data-nav', 'true');
      btn.setAttribute('data-nav-up', 'osd-seekbar');
      btn.setAttribute('data-nav-down', 'none');
      if (idx === 0) btn.setAttribute('data-nav-left', 'none');
      if (idx === btns.length - 1) btn.setAttribute('data-nav-right', 'none');
      btn.id = b.id;
      btn.innerHTML = b.label;
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
    if (this.isFocusedWithin()) {
      SpatialNav.limpar();
    }
  }

  isVisible(): boolean {
    return !this.element.classList.contains('hidden');
  }
}
