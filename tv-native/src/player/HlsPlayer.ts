/**
 * Player HLS/MSE com hls.js leve.
 * Usado no Navegador/Simulador de Desenvolvimento e como segunda tentativa.
 */

import Hls from 'hls.js';
import { TVPlayerInstance, PlaybackSource, PlayerEvents, AudioTrack, SubtitleTrack } from './TVPlayer';

export class HlsPlayer implements TVPlayerInstance {
  private video: HTMLVideoElement;
  private hls: Hls | null = null;
  private events: PlayerEvents;

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
      this.events.onError?.('Erro no elemento de vídeo');
    });
  }

  async play(source: PlaybackSource): Promise<void> {
    this.stop();

    const isHls = source.url.includes('.m3u8');

    if (isHls && Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: false, // Em TVs antigas web workers podem causar overhead de memória
        lowLatencyMode: Boolean(source.isLive),
        backBufferLength: source.isLive ? 15 : 60,
        maxBufferSize: 30 * 1000 * 1000,
        maxBufferLength: 20,
      });

      this.hls.loadSource(source.url);
      this.hls.attachMedia(this.video);

      this.hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        this.video.play().catch(() => {});
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

      this.hls.on(Hls.Events.ERROR, (_, errData) => {
        if (errData.fatal) {
          switch (errData.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('[HlsPlayer] Erro fatal de rede, tentando recuperar...');
              this.hls?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[HlsPlayer] Erro fatal de mídia, recuperando...');
              this.hls?.recoverMediaError();
              break;
            default:
              this.events.onError?.(`Erro HLS fatal: ${errData.details}`);
              this.stop();
              break;
          }
        }
      });
    } else {
      // Reprodução HTML5 direta (MP4 progressivo)
      this.video.src = source.url;
      try {
        await this.video.play();
      } catch (e: any) {
        this.events.onError?.(e.message || 'Erro ao tocar vídeo direto');
      }
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

  stop() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
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
