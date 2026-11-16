/**
 * Player de Vídeo em Tela Cheia para Filmes e Séries (PlayerScreen).
 * Integração com TVPlayer, OSD interativo, salvamento contínuo de progresso ("Continuar de onde parou"),
 * auto-skip de aberturas e encerramento com contagem regressiva para o próximo episódio.
 */

import { resolverDinamica } from '../core/Dinamica';
import { State } from '../core/State';
import { Storage } from '../core/Storage';
import { Api } from '../core/Api';
import {
  Addons,
  PENDING_ADDON_STREAM_URL,
  TvAddonStreamOption,
  isTvDebridPendingUrl,
} from '../core/Addons';
import { TVPlayerInstance } from '../player/TVPlayer';
import { PlayerOSD } from '../components/PlayerOSD';
import { SourceModal, SourceModalOption } from '../components/SourceModal';
import { Escolha, OpcaoEscolha } from '../components/Escolha';
import { SpatialNav } from '../core/SpatialNav';
import { LogoCarregando } from '../components/LogoCarregando';

interface SubCue {
  start: number;
  end: number;
  text: string;
}

function parseSubtitleTimestamp(raw: string): number {
  const clean = String(raw || '').trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return NaN;
}

function parseSubtitleCues(text: string): SubCue[] {
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\n+/);
  const cues: SubCue[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split('\n').filter((l) => l.trim() !== '');
    if (lines.length < 2) continue;
    let timeLineIdx = -1;
    for (let l = 0; l < lines.length; l++) {
      if (lines[l].indexOf('-->') >= 0) {
        timeLineIdx = l;
        break;
      }
    }
    if (timeLineIdx < 0) continue;
    const arrowParts = lines[timeLineIdx].split('-->');
    const start = parseSubtitleTimestamp(arrowParts[0]);
    const endPart = (arrowParts[1] || '').trim().split(/\s+/)[0];
    const end = parseSubtitleTimestamp(endPart);
    if (isNaN(start) || isNaN(end)) continue;
    const body = lines
      .slice(timeLineIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    if (body) cues.push({ start, end, text: body });
  }
  return cues;
}

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
  private activeSourceOptions: Array<TvAddonStreamOption | null> = [];
  private preferredBingeGroup?: string;
  private lastSeriesTitle = '';
  private userPickedVariantExplicitly = false;
  private externalSubtitles: { url: string; lang: string; label: string }[] = [];
  private currentExtSubIndex = -1;
  private currentSubCues: SubCue[] = [];
  private subTimer: any = null;
  private subOverlayEl: HTMLElement;
  private subtitleModal = new Escolha();

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

    this.subOverlayEl = document.createElement('div');
    this.subOverlayEl.id = 'tv-sub-overlay';
    this.subOverlayEl.style.cssText =
      'position:fixed; left:8%; right:8%; bottom:120px; text-align:center; pointer-events:none; z-index:45; font-size:36px; line-height:1.35; font-weight:700; color:#fff; text-shadow:0 2px 6px #000, 0 0 12px rgba(0,0,0,.95); white-space:pre-line;';

    this.element.appendChild(this.subOverlayEl);
    this.element.appendChild(this.osd.getElement());
    this.element.appendChild(this.sourceModal.getElement());
    this.element.appendChild(this.subtitleModal.getElement());
    this.element.appendChild(this.nextEpisodeOverlay);

    this.setupNextEpisodeButtons();
    window.addEventListener('keydown', (e) => this.handleKeyDown(e), true);
    // Erro do player chega depois do play(): a fonte que caiu dá lugar à seguinte.
    State.on('player-erro', () => {
      if (State.currentScreen === 'player') this.failoverNextSource();
    });
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

    if (vod.isSeries) {
      if (this.lastSeriesTitle !== vod.title) {
        this.lastSeriesTitle = vod.title;
        this.preferredBingeGroup = undefined;
      }
      if (!vod.seasons || vod.seasons.length === 0) {
        await Api.resolveSeriesEpisodes(vod);
        if ((!vod.seasons || vod.seasons.length === 0) && Addons.hasEnabled()) {
          await Addons.resolveSeriesEpisodes(vod);
        }
      }
      const season = vod.seasons?.[State.currentSeasonIndex] || vod.seasons?.[0];
      const ep = season?.episodes?.[State.currentEpisodeIndex] || season?.episodes?.[0];
      const rawEpSources = (ep?.sources || vod.sources || []).filter((u) => u && u !== PENDING_ADDON_STREAM_URL);
      let addonOpts: TvAddonStreamOption[] = [];
      if (season && ep && (rawEpSources.length === 0 || Addons.hasStreamAddons())) {
        addonOpts = await Addons.resolveMediaStreams(vod, season.seasonNumber, ep.episodeNumber).catch(() => []);
      }
      this.buildActiveSources(rawEpSources, addonOpts);
    } else {
      this.preferredBingeGroup = undefined;
      if (!vod.sources || vod.sources.length === 0) {
        await Api.resolveMovieSources(vod);
      }
      let addonOpts = vod.addonStreams || [];
      if (Addons.hasStreamAddons() && addonOpts.length === 0) {
        addonOpts = await Addons.resolveMediaStreams(vod).catch(() => []);
        vod.addonStreams = addonOpts;
      }
      this.buildActiveSources(vod.sources || [], addonOpts);
    }

    if (vod.isSeries && this.preferredBingeGroup && State.currentVariantIndex === 0 && !this.userPickedVariantExplicitly) {
      const bingeIdx = this.activeSourceOptions.findIndex(
        (opt) => opt && opt.bingeGroup === this.preferredBingeGroup
      );
      if (bingeIdx >= 0) {
        State.currentVariantIndex = bingeIdx;
      }
    }
    this.userPickedVariantExplicitly = false;

    const chave = `${vod.title}|${vod.isSeries ? `${State.currentSeasonIndex}:${State.currentEpisodeIndex}` : ''}`;
    if (chave !== this.chaveAtual) { this.chaveAtual = chave; this.falhas = 0; }

    const seasonNumForTitle = vod.seasons?.[State.currentSeasonIndex]?.seasonNumber || (State.currentSeasonIndex + 1);
    const epNumForTitle = vod.seasons?.[State.currentSeasonIndex]?.episodes?.[State.currentEpisodeIndex]?.episodeNumber || (State.currentEpisodeIndex + 1);
    const title = vod.isSeries
      ? `${vod.title} - T${seasonNumForTitle}E${epNumForTitle}`
      : vod.title;

    this.osd.setInfo(title, `Fonte ${State.currentVariantIndex + 1} de ${Math.max(1, this.activeSources.length)}`);
    this.osd.show();

    this.tituloAtual = title;
    if (this.activeSources.length === 0) {
      console.warn(`[PlayerScreen] Nenhuma fonte encontrada para ${title}`);
      this.osd.setInfo(title, 'Este título ainda não está disponível em nenhuma fonte. Tente de novo mais tarde.');
      return;
    }

    const chosenIdx = Math.min(State.currentVariantIndex, this.activeSources.length - 1);
    const pedida = this.activeSources[chosenIdx] || this.activeSources[0];
    const chosenOpt = this.activeSourceOptions[chosenIdx] || null;
    if (chosenOpt?.bingeGroup) {
      this.preferredBingeGroup = chosenOpt.bingeGroup;
    }

    let streamUrl: string | null = null;
    if (isTvDebridPendingUrl(pedida)) {
      this.osd.setInfo(title, 'Resolvendo torrent no Debrid...');
      try {
        streamUrl = await Addons.resolvePendingStreamUrl(pedida, chosenOpt || undefined);
        this.activeSources[chosenIdx] = streamUrl;
        if (chosenOpt) {
          chosenOpt.url = streamUrl;
          chosenOpt.debridResolved = true;
        }
      } catch (debErr: any) {
        console.warn('[PlayerScreen] Erro Debrid:', debErr);
        this.osd.setInfo(title, debErr?.message || 'Não foi possível resolver torrent no Debrid.');
        this.failoverNextSource();
        return;
      }
    } else {
      streamUrl = await resolverDinamica(pedida);
    }

    if (streamUrl === null) {
      // O servidor afirma que não há vídeo em provedor nenhum: nem tenta tocar.
      this.osd.setInfo(title, 'Este título ainda não está disponível em nenhuma fonte. Tente de novo mais tarde.');
      this.failoverNextSource();
      return;
    }

    this.clearExternalSubtitles();
    Addons.fetchMediaSubtitles(
      vod,
      vod.isSeries ? seasonNumForTitle : undefined,
      vod.isSeries ? epNumForTitle : undefined,
      chosenOpt?.subtitles
    )
      .then((subs) => {
        if (State.currentScreen === 'player' && this.tituloAtual === title) {
          this.externalSubtitles = subs;
        }
      })
      .catch(() => {});

    try {
      LogoCarregando.mostrar((vod as { poster?: string; logo?: string }).poster || (vod as { logo?: string }).logo);
      await this.player.play({
        url: streamUrl,
        title,
        headers: chosenOpt?.headers,
        isLive: false,
      });
      LogoCarregando.esconder();

      // Retomada: verifica se havia progresso salvo
      const saved = Storage.getProgress(vod.title);
      if (saved && saved.position > 30 && (!saved.duration || saved.position / saved.duration < 0.95)) {
        console.info(`[PlayerScreen] Retomando reprodução em ${saved.position}s`);
        this.player.seek(saved.position);
      }

      this.isPlaying = true;
      this.startProgressTracker();
    } catch (e) {
      LogoCarregando.esconder();
      console.warn('[PlayerScreen] Erro na fonte atual. Tentando failover automático...', e);
      this.failoverNextSource();
    }
  }

  leave() {
    LogoCarregando.esconder();
    this.element.classList.add('hidden');
    this.osd.hide();
    this.sourceModal.close();
    this.subtitleModal.fechar();
    this.clearExternalSubtitles();
    this.hideNextEpisodePrompt();
    clearInterval(this.saveProgressTimer);
    this.saveCurrentProgress();
    this.player.stop();
  }

  private buildActiveSources(baseUrls: string[], addonOpts: TvAddonStreamOption[]) {
    const urls: string[] = [];
    const opts: Array<TvAddonStreamOption | null> = [];
    for (let i = 0; i < baseUrls.length; i++) {
      const u = baseUrls[i];
      if (!u || u === PENDING_ADDON_STREAM_URL) continue;
      if (urls.indexOf(u) === -1) {
        const matched = addonOpts.find((o) => o.url === u) || null;
        urls.push(u);
        opts.push(matched);
      }
    }
    for (let i = 0; i < addonOpts.length; i++) {
      const opt = addonOpts[i];
      if (!opt || !opt.url) continue;
      if (urls.indexOf(opt.url) === -1) {
        urls.push(opt.url);
        opts.push(opt);
      }
    }
    this.activeSources = urls;
    this.activeSourceOptions = opts;
  }

  private clearExternalSubtitles() {
    clearInterval(this.subTimer);
    this.subTimer = null;
    this.currentSubCues = [];
    this.currentExtSubIndex = -1;
    this.subOverlayEl.textContent = '';
  }

  private async activateExternalSubtitle(idx: number) {
    const sub = this.externalSubtitles[idx];
    if (!sub) return;
    this.clearExternalSubtitles();
    try {
      const res = await fetch(sub.url);
      if (!res.ok) return;
      const text = await res.text();
      this.currentSubCues = parseSubtitleCues(text);
      this.currentExtSubIndex = idx;
      this.player.setSubtitleTrack(-1);
      this.subTimer = setInterval(() => {
        const now = this.player.getCurrentTime();
        let activeText = '';
        for (let i = 0; i < this.currentSubCues.length; i++) {
          const cue = this.currentSubCues[i];
          if (now >= cue.start && now <= cue.end) {
            activeText = cue.text;
            break;
          }
        }
        if (this.subOverlayEl.textContent !== activeText) {
          this.subOverlayEl.textContent = activeText;
        }
      }, 250);
    } catch {
      /* falha ao baixar legenda externa */
    }
  }

  /** Fontes que já falharam neste título; esgotadas, para de rodar em círculo. */
  private falhas = 0;
  private chaveAtual = '';

  private tituloAtual = '';

  private failoverNextSource() {
    this.falhas++;
    if (this.falhas >= this.activeSources.length) {
      this.osd.setInfo(this.tituloAtual, 'Nenhuma fonte deste título abriu agora. Tente de novo mais tarde.');
      this.osd.show();
      return;
    }
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
    const opcoes: OpcaoEscolha[] = [
      {
        rotulo: 'Desativar legendas',
        marcada: this.currentExtSubIndex === -1,
        aoEscolher: () => {
          this.clearExternalSubtitles();
          this.player.setSubtitleTrack(-1);
        },
      },
      {
        rotulo: 'Faixa interna do vídeo (Track 1)',
        marcada: false,
        aoEscolher: () => {
          this.clearExternalSubtitles();
          this.player.setSubtitleTrack(0);
        },
      },
    ];

    for (let i = 0; i < this.externalSubtitles.length; i++) {
      const idx = i;
      const sub = this.externalSubtitles[i];
      opcoes.push({
        rotulo: sub.label,
        marcada: this.currentExtSubIndex === idx,
        aoEscolher: () => {
          this.activateExternalSubtitle(idx);
        },
      });
    }

    this.subtitleModal.abrir('Legendas', opcoes);
  }

  openSources() {
    if (this.activeSources.length === 0) return;
    const title = State.currentVOD?.title || 'Título';
    const modalOptions: (SourceModalOption | string)[] = this.activeSources.map((url, idx) => {
      const opt = this.activeSourceOptions[idx];
      return opt
        ? {
            url,
            label: opt.label,
            detail: opt.detail,
            badge: opt.badge || opt.addonName,
          }
        : { url, label: `Fonte ${idx + 1}`, quality: 'HD' };
    });
    this.sourceModal.open(title, modalOptions, State.currentVariantIndex, (idx) => {
      this.userPickedVariantExplicitly = true;
      this.preferredBingeGroup = this.activeSourceOptions[idx]?.bingeGroup;
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
