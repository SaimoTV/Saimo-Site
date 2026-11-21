/**
 * Player HLS/MSE com hls.js leve.
 * Usado no Navegador/Simulador de Desenvolvimento e como segunda tentativa.
 */

import Hls from 'hls.js';
import {
  TVPlayerInstance, PlaybackSource, PlayerEvents, AudioTrack, SubtitleTrack,
  ehMidiaProgressiva, configurarXhrHeaders,
} from './TVPlayer';

const PLAYLIST_FATAL = new Set<string>([
  Hls.ErrorDetails.MANIFEST_LOAD_ERROR,
  Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT,
  Hls.ErrorDetails.MANIFEST_PARSING_ERROR,
  Hls.ErrorDetails.LEVEL_LOAD_ERROR,
  Hls.ErrorDetails.LEVEL_EMPTY_ERROR,
]);

export class HlsPlayer implements TVPlayerInstance {
  private video: HTMLVideoElement;
  private hls: Hls | null = null;
  private events: PlayerEvents;
  private playGen = 0;
  private currentSource: PlaybackSource | null = null;
  private triedDirectFallback = false;

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
      // Com o hls.js no comando, ele mesmo se recupera dos erros de mídia e
      // avisa os fatais pelo evento dele. Repassar este derrubava a fonte que
      // estava tocando (a troca de fonte sem motivo).
      if (this.hls || !this.currentSource) return;
      this.events.onError?.('Erro no elemento de vídeo');
    });
  }

  private playDirect(source: PlaybackSource, gen: number): Promise<void> {
    this.destroyHls();
    this.video.src = source.url;
    this.video.load();
    return this.video.play().catch((e: any) => {
      if (gen !== this.playGen) return;
      if (e?.name === 'AbortError') return;
      this.events.onError?.(e?.message || 'Erro ao tocar vídeo direto');
    });
  }

  async play(source: PlaybackSource): Promise<void> {
    this.stop();
    const gen = ++this.playGen;
    this.currentSource = source;
    this.triedDirectFallback = false;

    if (!ehMidiaProgressiva(source.url) && Hls.isSupported()) {
      let retries = 0;
      const hls = new Hls({
        enableWorker: false, // Em TVs antigas web workers podem causar overhead de memória
        lowLatencyMode: Boolean(source.isLive),
        backBufferLength: source.isLive ? 15 : 60,
        maxBufferSize: 30 * 1000 * 1000,
        maxBufferLength: 20,
        xhrSetup: configurarXhrHeaders(source.headers),
      });
      this.hls = hls;

      hls.loadSource(source.url);
      hls.attachMedia(this.video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        if (gen !== this.playGen) return;
        this.video.play().catch((e: any) => {
          if (gen !== this.playGen || e?.name === 'AbortError') return;
          this.events.onError?.(e?.message || 'Falha ao reproduzir HLS');
        });
        const audioTracks: AudioTrack[] = (data.audioTracks || []).map((t, idx) => ({
          index: idx,
          name: t.name || `Áudio ${idx + 1}`,
          language: t.lang || 'und',
        }));
        const subTracks: SubtitleTrack[] = (data.subtitleTracks || []).map((t, idx) => ({
          index: idx,
          name: t.name || `Legenda ${idx + 1}`,
          language: t.lang || 'und',
        }));
        this.events.onTracksReady?.(audioTracks, subTracks);
      });

      hls.on(Hls.Events.ERROR, (_, errData) => {
        if (gen !== this.playGen || !errData.fatal) return;
        // Stream sem extensão (rádio AAC/MP3, TS cru): se não é claramente HLS, tenta <video> direto uma vez.
        const urlLower = source.url.toLowerCase();
        const explicitHls = urlLower.includes('.m3u8') || urlLower.includes('.txt') || urlLower.includes('cloudfront-net.lat');
        if (errData.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR && !explicitHls && !this.triedDirectFallback) {
          this.triedDirectFallback = true;
          void this.playDirect(source, gen);
          return;
        }
        if (PLAYLIST_FATAL.has(errData.details) || retries >= 3) {
          const msg = `Erro HLS fatal: ${errData.details}`;
          this.destroyHls();
          this.events.onError?.(msg);
          return;
        }
        retries++;
        if (errData.type === Hls.ErrorTypes.NETWORK_ERROR) {
          console.warn('[HlsPlayer] Erro fatal de rede, tentando recuperar...');
          this.hls?.startLoad();
        } else if (errData.type === Hls.ErrorTypes.MEDIA_ERROR) {
          console.warn('[HlsPlayer] Erro fatal de mídia, recuperando...');
          this.hls?.recoverMediaError();
        } else {
          const msg = `Erro HLS fatal: ${errData.details}`;
          this.destroyHls();
          this.events.onError?.(msg);
        }
      });
    } else {
      await this.playDirect(source, gen);
    }
  }

  pause() {
    this.video.pause();
  }

  resume() {
    this.video.play();
  }

  seek(seconds: number) {
    this.video.currentTime = Math.max(0, Math.min(seconds, this.video.duration || seconds));
  }

  private destroyHls() {
    if (this.hls) {
      try {
        this.hls.destroy();
      } catch {}
      this.hls = null;
    }
  }

  stop() {
    this.playGen++;
    this.currentSource = null;
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
    if (this.hls && index >= 0) {
      this.hls.audioTrack = index;
    }
  }

  setSubtitleTrack(index: number) {
    if (this.hls) {
      this.hls.subtitleTrack = index;
    }
  }
}
