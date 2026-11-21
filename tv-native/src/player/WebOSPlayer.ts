/**
 * Player Nativo para LG Smart TV (webOS).
 * Utiliza o elemento de vídeo acelerado pelo hardware do webOS
 * sem bloqueios de CORS por rodar em app empacotado.
 */

import Hls from 'hls.js';
import {
  TVPlayerInstance, PlaybackSource, PlayerEvents, AudioTrack, SubtitleTrack,
  ehMidiaProgressiva, devePreferirHlsJs, configurarXhrHeaders,
} from './TVPlayer';

const PLAYLIST_FATAL = new Set<string>([
  Hls.ErrorDetails.MANIFEST_LOAD_ERROR,
  Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT,
  Hls.ErrorDetails.MANIFEST_PARSING_ERROR,
  Hls.ErrorDetails.LEVEL_LOAD_ERROR,
  Hls.ErrorDetails.LEVEL_EMPTY_ERROR,
]);

export class WebOSPlayer implements TVPlayerInstance {
  private video: HTMLVideoElement;
  private events: PlayerEvents;
  private hls: Hls | null = null;
  private currentSource: PlaybackSource | null = null;
  private triedHlsFallback = false;
  private triedNative = false;
  private handlingFailure = false;
  private playGen = 0;

  constructor(videoElement: HTMLVideoElement, events: PlayerEvents) {
    this.video = videoElement;
    this.events = events;
    this.setupListeners();
  }

  private setupListeners() {
    this.video.addEventListener('timeupdate', () => {
      this.events.onTimeUpdate?.(this.video.currentTime, this.video.duration || 0);
    });

    this.video.addEventListener('waiting', () => {
      this.events.onBuffering?.(true);
    });

    this.video.addEventListener('playing', () => {
      this.events.onBuffering?.(false);
    });

    this.video.addEventListener('ended', () => {
      this.events.onEnded?.();
    });

    this.video.addEventListener('error', () => {
      // Com hls.js ativo, quem trata e reporta falhas é o próprio hls.js.
      if (this.hls || !this.currentSource) return;
      const err = this.video.error;
      this.handleNativeFailure(this.playGen, `Erro webOS Video: code ${err?.code || 'desconhecido'}`);
    });

    this.video.addEventListener('loadedmetadata', () => {
      this.extractTracks();
    });
  }

  private handleNativeFailure(gen: number, message: string) {
    if (gen !== this.playGen || this.handlingFailure) return;
    this.handlingFailure = true;
    const src = this.currentSource;
    if (!this.triedHlsFallback && src && Hls.isSupported() && !ehMidiaProgressiva(src.url)) {
      this.triedHlsFallback = true;
      console.warn('[WebOSPlayer] Fallback para hls.js após erro nativo');
      this.playWithHls(src.url, gen);
      return;
    }
    this.events.onError?.(message);
  }

  private playWithHls(url: string, gen: number) {
    this.destroyHls();
    this.handlingFailure = false;
    // Remove o src nativo anterior para o <video> não disparar erros residuais.
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();

    let retries = 0;
    const hls = new Hls({
      enableWorker: false,
      lowLatencyMode: Boolean(this.currentSource?.isLive),
      backBufferLength: this.currentSource?.isLive ? 15 : 60,
      maxBufferSize: 30 * 1000 * 1000,
      maxBufferLength: 20,
      xhrSetup: configurarXhrHeaders(this.currentSource?.headers),
    });
    this.hls = hls;
    hls.loadSource(url);
    hls.attachMedia(this.video);
    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      if (gen !== this.playGen) return;
      this.video.play().catch((e: any) => {
        if (gen !== this.playGen || e?.name === 'AbortError') return;
        this.events.onError?.(e?.message || 'Falha ao reproduzir HLS');
      });
      const audio: AudioTrack[] = (data.audioTracks || []).map((t, idx) => ({
        index: idx,
        name: t.name || `Áudio ${idx + 1}`,
        language: t.lang || 'und',
      }));
      const subs: SubtitleTrack[] = (data.subtitleTracks || []).map((t, idx) => ({
        index: idx,
        name: t.name || `Legenda ${idx + 1}`,
        language: t.lang || 'und',
      }));
      if (audio.length || subs.length) this.events.onTracksReady?.(audio, subs);
    });
    hls.on(Hls.Events.ERROR, (_ev, data) => {
      if (gen !== this.playGen || !data.fatal) return;
      // CDN sem CORS pode falhar no XHR do hls.js, mas abrir no decodificador nativo sem CORS.
      if (!this.triedNative && this.currentSource && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        console.warn('[WebOSPlayer] hls.js falhou na rede, tentando decodificador nativo sem CORS');
        this.destroyHls();
        void this.playNative(this.currentSource, gen);
        return;
      }
      if (PLAYLIST_FATAL.has(data.details) || retries >= 3) {
        const msg = `Erro HLS webOS: ${data.details || data.type}`;
        this.destroyHls();
        this.events.onError?.(msg);
        return;
      }
      retries++;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        this.hls?.startLoad();
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        this.hls?.recoverMediaError();
      } else {
        const msg = `Erro HLS webOS: ${data.details || data.type}`;
        this.destroyHls();
        this.events.onError?.(msg);
      }
    });
  }

  private async playNative(source: PlaybackSource, gen: number): Promise<void> {
    if (gen !== this.playGen) return;
    this.triedNative = true;
    this.handlingFailure = false;
    this.video.src = source.url;
    this.video.load();

    try {
      await this.video.play();
    } catch (e: any) {
      if (gen !== this.playGen || this.hls || e?.name === 'AbortError') return;
      console.warn('[WebOSPlayer] Erro ao iniciar vídeo no webOS:', e);
      this.handleNativeFailure(gen, e?.message || 'Falha ao reproduzir');
    }
  }

  private destroyHls() {
    if (this.hls) {
      try {
        this.hls.destroy();
      } catch {}
      this.hls = null;
    }
  }

  async play(source: PlaybackSource): Promise<void> {
    this.stop();
    const gen = ++this.playGen;
    this.currentSource = source;
    this.triedHlsFallback = false;
    this.triedNative = false;
    this.handlingFailure = false;

    if (devePreferirHlsJs(source) && Hls.isSupported()) {
      this.triedHlsFallback = true;
      this.playWithHls(source.url, gen);
      return;
    }

    await this.playNative(source, gen);
  }

  private extractTracks() {
    const audio: AudioTrack[] = [];
    const subs: SubtitleTrack[] = [];

    // webOS AudioTracks
    const anyVideo = this.video as any;
    if (anyVideo.audioTracks) {
      for (let i = 0; i < anyVideo.audioTracks.length; i++) {
        const t = anyVideo.audioTracks[i];
        audio.push({
          index: i,
          name: t.label || t.language || `Áudio ${i + 1}`,
          language: t.language || 'und',
        });
      }
    }

    // TextTracks
    if (this.video.textTracks) {
      for (let i = 0; i < this.video.textTracks.length; i++) {
        const t = this.video.textTracks[i];
        subs.push({
          index: i,
          name: t.label || t.language || `Legenda ${i + 1}`,
          language: t.language || 'und',
        });
      }
    }

    this.events.onTracksReady?.(audio, subs);
  }

  pause() {
    this.video.pause();
  }

  resume() {
    this.video.play().catch(() => {});
  }

  seek(seconds: number) {
    this.video.currentTime = Math.max(0, Math.min(seconds, this.video.duration || seconds));
  }

  stop() {
    this.playGen++;
    this.currentSource = null;
    this.handlingFailure = false;
    this.destroyHls();
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
  }

  destroy() {
    this.stop();
  }

  getDuration(): number {
    return this.video.duration || 0;
  }

  getCurrentTime(): number {
    return this.video.currentTime || 0;
  }

  setAudioTrack(index: number) {
    const anyVideo = this.video as any;
    if (anyVideo.audioTracks) {
      for (let i = 0; i < anyVideo.audioTracks.length; i++) {
        anyVideo.audioTracks[i].enabled = i === index;
      }
    }
  }

  setSubtitleTrack(index: number) {
    if (this.video.textTracks) {
      for (let i = 0; i < this.video.textTracks.length; i++) {
        this.video.textTracks[i].mode = i === index ? 'showing' : 'disabled';
      }
    }
  }
}
