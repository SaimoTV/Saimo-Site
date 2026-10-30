/**
 * Player Nativo para LG Smart TV (webOS).
 * Utiliza o elemento de vídeo acelerado pelo hardware do webOS
 * sem bloqueios de CORS por rodar em app empacotado.
 */

import { TVPlayerInstance, PlaybackSource, PlayerEvents, AudioTrack, SubtitleTrack } from './TVPlayer';

export class WebOSPlayer implements TVPlayerInstance {
  private video: HTMLVideoElement;
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
      const err = this.video.error;
      this.events.onError?.(`Erro webOS Video: code ${err?.code || 'desconhecido'}`);
    });

    this.video.addEventListener('loadedmetadata', () => {
      this.extractTracks();
    });
  }

  async play(source: PlaybackSource): Promise<void> {
    this.stop();

    this.video.src = source.url;
    this.video.load();

    try {
      await this.video.play();
    } catch (e: any) {
      console.warn('[WebOSPlayer] Erro ao iniciar vídeo no webOS:', e);
      this.events.onError?.(e.message || 'Falha ao reproduzir');
    }
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
    this.video.play();
  }

  seek(seconds: number) {
    this.video.currentTime = Math.max(0, Math.min(seconds, this.video.duration || seconds));
  }

  stop() {
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
