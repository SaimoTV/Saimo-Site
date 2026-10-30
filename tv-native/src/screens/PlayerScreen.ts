/**
 * Player de Vídeo em Tela Cheia para Filmes e Séries (PlayerScreen).
 * Integração com TVPlayer, OSD interativo, salvamento contínuo de progresso ("Continuar de onde parou"),
 * auto-skip de aberturas e encerramento com contagem regressiva para o próximo episódio.
 */

import { State } from '../core/State';
import { Storage, VODProgress } from '../core/Storage';
import { Api } from '../core/Api';
import { TVPlayerInstance } from '../player/TVPlayer';
import { PlayerOSD } from '../components/PlayerOSD';
import { SourceModal } from '../components/SourceModal';
import { SpatialNav } from '../core/SpatialNav';

export class PlayerScreen {
  private element: HTMLElement;
  private player: TVPlayerInstance;
  private osd: PlayerOSD;
  private sourceModal: SourceModal;

  private isPlaying = false;
  private duration = 0;
  private currentTime = 0;
  private saveProgressTimer: any = null;
  private nextEpisodeOverlay: HTMLElement;
  private countdownTimer: any = null;

  private activeSources: string[] = [];

  constructor(player: TVPlayerInstance) {
    this.player = player;
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-player-screen hidden';
    this.element.id = 'screen-player';

    // OSD com Callbacks
    this.osd = new PlayerOSD({
      onSeek: (deltaSec) => this.seekDelta(deltaSec),
      onTogglePlay: () => this.togglePlay(),
      onSelectAudio: () => this.selectAudio(),
      onSelectSubtitle: () => this.selectSubtitle(),
      onOpenSources: () => this.openSources(),
      onSelectEpisode: (epIdx) => this.switchEpisode(epIdx),
    });

    this.sourceModal = new SourceModal();

    // Overlay de Próximo Episódio
    this.nextEpisodeOverlay = document.createElement('div');
    this.nextEpisodeOverlay.className = 'tv-modal-overlay hidden';
    this.nextEpisodeOverlay.innerHTML = `
      <div class="tv-modal-content" style="text-align:center;">
        <div class="tv-modal-title">Próximo Episódio</div>
        <p id="tv-next-ep-countdown" style="font-size:22px; margin-bottom:24px;">Iniciando em 10 segundos...</p>
        <div style="display:flex; justify-content:center; gap:20px;">
          <div class="tv-btn primary nav-focusable" id="btn-next-now" data-nav="true">▶ Assistir Agora</div>
          <div class="tv-btn nav-focusable" id="btn-next-cancel" data-nav="true">✕ Cancelar</div>
        </div>
      </div>
    `;

    this.element.appendChild(this.osd.getElement());
    this.element.appendChild(this.sourceModal.getElement());
    this.element.appendChild(this.nextEpisodeOverlay);

    this.setupNextEpisodeButtons();
    window.addEventListener('keydown', (e) => this.handleKeyDown(e), true);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  async enter() {
    this.element.classList.remove('hidden');
    const vod = State.currentVOD;
    if (!vod) {
      State.setScreen('home');
      return;
    }

    // Resolve fontes se ainda não resolvidas
    if (vod.isSeries) {
      if (!vod.seasons || vod.seasons.length === 0) {
        await Api.resolveSeriesEpisodes(vod);
      }
      const season = vod.seasons?.[State.currentSeasonIndex] || vod.seasons?.[0];
      const ep = season?.episodes?.[State.currentEpisodeIndex] || season?.episodes?.[0];
      this.activeSources = ep?.sources || vod.sources || [];
    } else {
      if (!vod.sources || vod.sources.length === 0) {
        await Api.resolveMovieSources(vod);
      }
      this.activeSources = vod.sources || [];
    }

    const title = vod.isSeries
      ? `${vod.title} - T${State.currentSeasonIndex + 1}E${State.currentEpisodeIndex + 1}`
      : vod.title;

    this.osd.setInfo(title, `Fonte ${State.currentVariantIndex + 1} de ${Math.max(1, this.activeSources.length)}`);
    this.osd.show();

    if (this.activeSources.length === 0) {
      console.warn(`[PlayerScreen] Nenhuma fonte encontrada para ${title}`);
      return;
    }

    const streamUrl = this.activeSources[State.currentVariantIndex] || this.activeSources[0];

    try {
      await this.player.play({
        url: streamUrl,
        title,
        isLive: false,
      });

      // Retomada: verifica se havia progresso salvo
      const saved = Storage.getProgress(vod.title);
      if (saved && saved.position > 30 && (!saved.duration || saved.position / saved.duration < 0.95)) {
        console.info(`[PlayerScreen] Retomando reprodução em ${saved.position}s`);
        this.player.seek(saved.position);
      }

      this.isPlaying = true;
      this.startProgressTracker();
    } catch (e) {
      console.warn('[PlayerScreen] Erro na fonte atual. Tentando failover automático...', e);
      this.failoverNextSource();
    }
  }

  leave() {
    this.element.classList.add('hidden');
    this.osd.hide();
    this.sourceModal.close();
    this.hideNextEpisodePrompt();
    clearInterval(this.saveProgressTimer);
    this.saveCurrentProgress();
    this.player.stop();
  }

  private failoverNextSource() {
    if (this.activeSources.length <= 1) return;
    State.currentVariantIndex = (State.currentVariantIndex + 1) % this.activeSources.length;
    this.enter();
  }

  private startProgressTracker() {
    clearInterval(this.saveProgressTimer);
    this.saveProgressTimer = setInterval(() => {
      this.currentTime = this.player.getCurrentTime();
      this.duration = this.player.getDuration();
      this.osd.updateProgress(this.currentTime, this.duration);
      this.saveCurrentProgress();

      // Pular abertura automático se configurado nas preferências
      const prefs = Storage.getPrefs();
      if (prefs.pularAutomatico && this.currentTime >= 15 && this.currentTime <= 25) {
        // Pula os primeiros 85 segundos se for início padrão de abertura
        console.info('[PlayerScreen] Auto-skip de abertura acionado');
        this.seekDelta(85);
      }

      // Verifica fim do episódio para séries
      if (
        State.currentVOD?.isSeries &&
        this.duration > 0 &&
        this.currentTime >= this.duration - 20 &&
        !this.countdownTimer
      ) {
        this.promptNextEpisode();
      }
    }, 2000);
  }

  private saveCurrentProgress() {
    if (!State.currentVOD || this.currentTime < 10) return;
    Storage.saveProgress({
      title: State.currentVOD.title,
      position: this.currentTime,
      duration: this.duration,
      percent: this.duration > 0 ? Math.round((this.currentTime / this.duration) * 100) : 0,
      updatedAt: Date.now(),
      season: State.currentSeasonIndex + 1,
      episode: State.currentEpisodeIndex + 1,
    });
  }

  seekDelta(deltaSec: number) {
    const target = Math.max(0, Math.min(this.duration, this.currentTime + deltaSec));
    this.player.seek(target);
    this.currentTime = target;
    this.osd.updateProgress(this.currentTime, this.duration);
    this.osd.show();
  }

  togglePlay() {
    if (this.isPlaying) {
      this.player.pause();
      this.isPlaying = false;
    } else {
      this.player.resume();
      this.isPlaying = true;
    }
    this.osd.show();
  }

  selectAudio() {
    this.player.setAudioTrack(1);
    this.osd.show();
  }

  selectSubtitle() {
    this.player.setSubtitleTrack(0);
    this.osd.show();
  }

  openSources() {
    if (this.activeSources.length === 0) return;
    const title = State.currentVOD?.title || 'Título';
    this.sourceModal.open(title, this.activeSources, State.currentVariantIndex, (idx) => {
      State.currentVariantIndex = idx;
      this.enter();
    });
  }

  switchEpisode(epIdx: number) {
    State.currentEpisodeIndex = epIdx;
    State.currentVariantIndex = 0;
    this.enter();
  }

  private promptNextEpisode() {
    const countdownEl = this.nextEpisodeOverlay.querySelector<HTMLElement>('#tv-next-ep-countdown');
    let timeLeft = 10;
    this.nextEpisodeOverlay.classList.remove('hidden');
    SpatialNav.setTrap(this.nextEpisodeOverlay);

    const btn = this.nextEpisodeOverlay.querySelector<HTMLElement>('#btn-next-now');
    if (btn) SpatialNav.focus(btn);

    this.countdownTimer = setInterval(() => {
      timeLeft--;
      if (countdownEl) countdownEl.textContent = `Iniciando em ${timeLeft} segundos...`;
      if (timeLeft <= 0) {
        this.hideNextEpisodePrompt();
        this.playNextEpisode();
      }
    }, 1000);
  }

  private hideNextEpisodePrompt() {
    clearInterval(this.countdownTimer);
    this.countdownTimer = null;
    this.nextEpisodeOverlay.classList.add('hidden');
    SpatialNav.setTrap(null);
  }

  private playNextEpisode() {
    State.currentEpisodeIndex++;
    State.currentVariantIndex = 0;
    this.enter();
  }

  private setupNextEpisodeButtons() {
    const playNowBtn = this.nextEpisodeOverlay.querySelector<HTMLElement>('#btn-next-now');
    const cancelBtn = this.nextEpisodeOverlay.querySelector<HTMLElement>('#btn-next-cancel');

    playNowBtn?.addEventListener('click', () => {
      this.hideNextEpisodePrompt();
      this.playNextEpisode();
    });

    cancelBtn?.addEventListener('click', () => {
      this.hideNextEpisodePrompt();
    });
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (State.currentScreen !== 'player') return;

    if (this.sourceModal.isOpen() || !this.nextEpisodeOverlay.classList.contains('hidden')) {
      if (e.keyCode === 10009 || e.keyCode === 461 || e.keyCode === 8 || e.keyCode === 27) {
        e.preventDefault();
        this.sourceModal.close();
        this.hideNextEpisodePrompt();
      }
      return;
    }

    const key = e.keyCode;

    if (key === 37) {
      // LEFT -> Rewind -10s
      e.preventDefault();
      this.seekDelta(-10);
    } else if (key === 39) {
      // RIGHT -> Fast-Forward +10s
      e.preventDefault();
      this.seekDelta(10);
    } else if (key === 38) {
      // UP -> Mostra OSD e foca primeiro botão
      e.preventDefault();
      this.osd.show();
      const firstBtn = this.osd.getElement().querySelector<HTMLElement>('.tv-btn');
      if (firstBtn) SpatialNav.focus(firstBtn);
    } else if (key === 40) {
      // DOWN -> Esconde OSD
      e.preventDefault();
      this.osd.hide();
    } else if (key === 13) {
      // OK -> Se OSD não estiver visível, alterna play/pause
      if (!this.osd.isVisible()) {
        e.preventDefault();
        this.togglePlay();
      }
    } else if (key === 10009 || key === 461 || key === 8 || key === 27) {
      // BACK -> Retorna para Ficha
      e.preventDefault();
      State.setScreen('ficha');
    }
  }
}
