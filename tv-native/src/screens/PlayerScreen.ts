/**
 * Player de Vídeo em Tela Cheia para Filmes e Séries (PlayerScreen).
 * Integração com TVPlayer, OSD interativo, salvamento contínuo de progresso ("Continuar de onde parou"),
 * auto-skip de aberturas e encerramento com contagem regressiva para o próximo episódio.
 */

import { painelFechouHa } from '../components/Escolha';
import { MODOS_TELA, aplicarModoTela, guardarModoTela, limparModoTela, modoTelaAtual } from '../core/ModoTela';
import { resolverDinamica } from '../core/Dinamica';
import { State } from '../core/State';
import { marcarAssistido, somarTempo } from '../../../src/services/assistidos';
import { estiloAtual } from '../../../src/plataforma/legendaEstilo';
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
      onTela: () => this.selectTela(),
      onVelocidade: () => this.selectVelocidade(),
      onEpisodios: () => this.selectEpisodios(),
      onProximo: () => this.proximoManual(),
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
    this.aplicarEstiloDaLegenda();
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
    SpatialNav.limpar();
    this.velocidade = 1;
    this.osd.setPlaying(true);
    this.osd.setSerie(Boolean(vod.isSeries));
    aplicarModoTela(document.getElementById('tv-video') as HTMLVideoElement | null);
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
      // Série: só retoma se o que foi salvo é deste mesmo episódio (antes o episódio 2 abria no minuto do 1).
      const mesmoEpisodio = !vod.isSeries ||
        (saved?.season === State.currentSeasonIndex + 1 && saved?.episode === State.currentEpisodeIndex + 1);
      if (saved && mesmoEpisodio && saved.position > 30 && (!saved.duration || saved.position / saved.duration < 0.95)) {
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
    const v = document.getElementById('tv-video') as HTMLVideoElement | null;
    limparModoTela(v);
    if (v) v.playbackRate = 1;
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
        this.temProximoEpisodio() &&
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
    // Estatísticas: o tempo de tela (a cada 2 s tocando) e a conclusão (passou de 90%).
    if (this.isPlaying) somarTempo(2);
    if (this.duration > 0 && this.currentTime / this.duration >= 0.9) {
      const serie = State.currentVOD.isSeries;
      marcarAssistido(State.currentVOD.title, serie ? State.currentSeasonIndex + 1 : undefined, serie ? State.currentEpisodeIndex + 1 : undefined, this.duration);
    }
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

  /** Fonte, tamanho, cor, fundo e posição da legenda (Ajustes > Legendas). */
  private aplicarEstiloDaLegenda() {
    const e = estiloAtual();
    const tamanho = { pequena: 28, media: 36, grande: 48, enorme: 60 }[e.tamanho];
    const cor = { branco: '#ffffff', amarelo: '#ffe14d', ciano: '#4fe3d0', verde: '#7ee787' }[e.cor];
    const fonte = { padrao: 'inherit', classica: 'Georgia, serif', mono: 'monospace', arredondada: '"Trebuchet MS", sans-serif' }[e.fonte];
    const fundo = e.fundo === 'preto' ? 'background:#000;padding:2px 14px;border-radius:6px;'
      : e.fundo === 'translucido' ? 'background:rgba(0,0,0,.72);padding:2px 14px;border-radius:6px;' : '';
    const sombra = e.fundo === 'sombra' || e.fundo === 'nenhum' ? 'text-shadow:0 0 4px #000,0 0 4px #000,2px 2px 3px #000,-2px -2px 3px #000;' : 'text-shadow:none;';
    const posicao = e.posicao === 'topo' ? 'top:90px;' : e.posicao === 'alto' ? 'bottom:260px;' : 'bottom:120px;';
    this.subOverlayEl.style.cssText =
      `position:fixed; left:8%; right:8%; ${posicao} text-align:center; pointer-events:none; z-index:45; font-size:${tamanho}px; line-height:1.35; font-weight:700; color:${cor}; font-family:${fonte}; ${sombra} ${fundo} white-space:pre-line;`;
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
    this.osd.setPlaying(this.isPlaying);
    this.osd.show();
  }

  selectAudio() {
    // Lista as faixas do vídeo (antes só trocava às cegas para a faixa 1).
    const faixas = State.faixasAudio;
    if (faixas.length < 2) {
      this.osd.setInfo(this.tituloAtual, faixas.length === 1 ? 'Este vídeo tem uma faixa de áudio só' : 'Faixas de áudio indisponíveis neste vídeo');
      this.osd.show();
      return;
    }
    this.subtitleModal.abrir('Áudio', faixas.map((f, i) => ({
      rotulo: f.name || f.language || `Faixa ${i + 1}`,
      marcada: i === this.faixaAudio,
      aoEscolher: () => { this.faixaAudio = i; this.player.setAudioTrack(f.index ?? i); },
    })));
  }

  private faixaAudio = 0;
  private velocidade = 1;

  selectTela() {
    const atual = modoTelaAtual();
    this.subtitleModal.abrir('Tela', MODOS_TELA.map((m) => ({
      rotulo: `${m.nome}  ·  ${m.sobre}`,
      marcada: m.id === atual,
      aoEscolher: () => {
        guardarModoTela(m.id);
        aplicarModoTela(document.getElementById('tv-video') as HTMLVideoElement | null, m.id);
      },
    })));
  }

  selectVelocidade() {
    const opcoes = [0.5, 0.75, 1, 1.25, 1.5, 2];
    this.subtitleModal.abrir('Velocidade', opcoes.map((v) => ({
      rotulo: v === 1 ? 'Normal (1×)' : `${v}×`,
      marcada: v === this.velocidade,
      aoEscolher: () => {
        this.velocidade = v;
        const el = document.getElementById('tv-video') as HTMLVideoElement | null;
        if (el) el.playbackRate = v;
      },
    })));
  }

  selectEpisodios() {
    const vod = State.currentVOD;
    const temporadas = vod?.seasons || [];
    if (!vod?.isSeries || temporadas.length === 0) return;
    const abrirEpisodios = async (si: number) => {
      // Nomes reais dos episódios (TMDB), se ainda não vieram para esta temporada.
      await Api.fetchTMDBSeason(vod, si).catch(() => false);
      const t = temporadas[si];
      this.subtitleModal.abrir(`Temporada ${t.seasonNumber ?? si + 1}`, t.episodes.map((ep, i) => ({
        rotulo: `E${ep.episodeNumber ?? i + 1}  ·  ${ep.title || `Episódio ${i + 1}`}`,
        marcada: si === State.currentSeasonIndex && i === State.currentEpisodeIndex,
        aoEscolher: () => { State.currentSeasonIndex = si; this.switchEpisode(i); },
      })));
    };
    if (temporadas.length === 1) { abrirEpisodios(0); return; }
    this.subtitleModal.abrir('Temporadas', temporadas.map((t, si) => ({
      rotulo: `Temporada ${t.seasonNumber ?? si + 1}  ·  ${t.episodes.length} episódios`,
      marcada: si === State.currentSeasonIndex,
      aoEscolher: () => { setTimeout(() => abrirEpisodios(si), 0); },
    })));
  }

  /** Botão Próximo: vai ao episódio seguinte (ou à primeira da próxima temporada). */
  proximoManual() {
    const temporadas = State.currentVOD?.seasons || [];
    const t = temporadas[State.currentSeasonIndex];
    if (!t) return;
    if (State.currentEpisodeIndex + 1 < t.episodes.length) {
      this.switchEpisode(State.currentEpisodeIndex + 1);
    } else if (State.currentSeasonIndex + 1 < temporadas.length) {
      State.currentSeasonIndex++;
      this.switchEpisode(0);
    } else {
      this.osd.setInfo(this.tituloAtual, 'Este é o último episódio');
      this.osd.show();
    }
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
    // O tempo do episódio anterior não pode ser salvo como se fosse deste.
    this.currentTime = 0;
    this.duration = 0;
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

  /** Há episódio depois deste (na temporada ou na seguinte)? Sem isto o último episódio voltava ao primeiro. */
  private temProximoEpisodio(): boolean {
    const temporadas = State.currentVOD?.seasons || [];
    const t = temporadas[State.currentSeasonIndex];
    if (!t) return false;
    return State.currentEpisodeIndex + 1 < t.episodes.length || State.currentSeasonIndex + 1 < temporadas.length;
  }

  private playNextEpisode() {
    const temporadas = State.currentVOD?.seasons || [];
    const t = temporadas[State.currentSeasonIndex];
    if (t && State.currentEpisodeIndex + 1 >= t.episodes.length && State.currentSeasonIndex + 1 < temporadas.length) {
      State.currentSeasonIndex++;
      State.currentEpisodeIndex = 0;
    } else {
      State.currentEpisodeIndex++;
    }
    this.currentTime = 0;
    this.duration = 0;
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
    // O OK que acabou de escolher uma opção num painel já foi tratado: não pausa o vídeo.
    if ((e.keyCode === 13 || e.key === 'Enter') && painelFechouHa() < 350) {
      e.preventDefault();
      return;
    }

    if (
      this.sourceModal.isOpen() ||
      this.subtitleModal.aberta() ||
      !this.nextEpisodeOverlay.classList.contains('hidden')
    ) {
      if (e.keyCode === 10009 || e.keyCode === 461 || e.keyCode === 8 || e.keyCode === 27) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.sourceModal.close();
        this.subtitleModal.fechar();
        this.hideNextEpisodePrompt();
      }
      return;
    }

    const key = e.keyCode;
    const isLeft = key === 37 || e.key === 'ArrowLeft' || e.key === 'Left';
    const isUp = key === 38 || e.key === 'ArrowUp' || e.key === 'Up';
    const isRight = key === 39 || e.key === 'ArrowRight' || e.key === 'Right';
    const isDown = key === 40 || e.key === 'ArrowDown' || e.key === 'Down';
    const isEnter = key === 13 || e.key === 'Enter';
    const isBack = key === 10009 || key === 461 || key === 8 || key === 27 || e.key === 'Escape' || e.key === 'Backspace';

    const osdVisible = this.osd.isVisible();
    const onSeekbar = osdVisible && this.osd.isSeekbarFocused();
    const onButtons = osdVisible && this.osd.isButtonFocused();

    if (isDown) {
      e.preventDefault();
      e.stopPropagation();
      this.osd.show();
      if (!osdVisible || (!onSeekbar && !onButtons)) {
        // Primeiro toque para baixo: foca na barra de progresso
        this.osd.focusSeekbar();
      } else if (onSeekbar) {
        // Já na barra de progresso: desce para as opções de baixo
        this.osd.focusFirstButton();
      }
    } else if (isUp) {
      e.preventDefault();
      e.stopPropagation();
      this.osd.show();
      if (!osdVisible || (!onSeekbar && !onButtons) || onButtons) {
        // Das opções de baixo (ou sem foco): sobe para a barra de progresso
        this.osd.focusSeekbar();
      }
    } else if (isLeft || isRight) {
      e.preventDefault();
      e.stopPropagation();
      this.osd.show();
      if (onButtons) {
        // Foco nas opções de baixo: navega apenas entre os botões, NUNCA avança ou volta o vídeo
        const buttons = this.osd.getButtons();
        const current = SpatialNav.getCurrent();
        const idx = current ? buttons.indexOf(current) : -1;
        if (idx >= 0) {
          const nextIdx = isLeft ? Math.max(0, idx - 1) : Math.min(buttons.length - 1, idx + 1);
          SpatialNav.focus(buttons[nextIdx], false);
        } else if (buttons.length > 0) {
          SpatialNav.focus(buttons[0], false);
        }
      } else {
        // Foco na barra de progresso (ou sem foco nas opções): foca na barra e avança/volta o vídeo
        this.osd.focusSeekbar();
        this.seekDelta(isLeft ? -10 : 10);
      }
    } else if (isEnter) {
      e.preventDefault();
      e.stopPropagation();
      if (onButtons) {
        this.osd.show();
        SpatialNav.getCurrent()?.click();
      } else {
        this.osd.show();
        this.osd.focusSeekbar();
        this.togglePlay();
      }
    } else if (isBack) {
      e.preventDefault();
      State.setScreen('ficha');
    }
  }
}
