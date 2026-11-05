/**
 * Player Nativo para LG Smart TV (webOS).
 * Utiliza o elemento de vídeo acelerado pelo hardware do webOS
 * sem bloqueios de CORS por rodar em app empacotado.
 */

import Hls from 'hls.js';
import { TVPlayerInstance, PlaybackSource, PlayerEvents, AudioTrack, SubtitleTrack } from './TVPlayer';

const TEMPO_LIMITE_INICIO_MS = 8000;

export class WebOSPlayer implements TVPlayerInstance {
  private video: HTMLVideoElement;
  private events: PlayerEvents;
  private hls: Hls | null = null;

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

    try {
      await this.iniciarNativo(source.url);
      return;
    } catch (erroNativo) {
      console.warn('[WebOSPlayer] Reprodução nativa falhou:', erroNativo);
      if (!Hls.isSupported()) throw erroNativo;
    }

    this.stop();
    await this.iniciarHls(source);
  }

  private aguardarInicio(preparar: (falhar: (erro: Error) => void) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let encerrado = false;
      const encerrar = (erro?: Error) => {
        if (encerrado) return;
        encerrado = true;
        clearTimeout(limite);
        this.video.removeEventListener('playing', aoTocar);
        this.video.removeEventListener('error', aoFalhar);
        if (erro) reject(erro);
        else resolve();
      };
      const aoTocar = () => encerrar();
      const aoFalhar = () => encerrar(new Error(`Erro webOS Video: code ${this.video.error?.code ?? 'desconhecido'}`));
      const limite = setTimeout(() => encerrar(new Error('Tempo esgotado ao iniciar a fonte')), TEMPO_LIMITE_INICIO_MS);
      this.video.addEventListener('playing', aoTocar);
      this.video.addEventListener('error', aoFalhar);
      preparar(encerrar);
    });
  }

  private iniciarNativo(url: string): Promise<void> {
    return this.aguardarInicio((falhar) => {
      this.video.src = url;
      this.video.load();
      this.video.play().catch((e: Error) => falhar(e));
    });
  }

  private iniciarHls(source: PlaybackSource): Promise<void> {
    return this.aguardarInicio((falhar) => {
      const hls = new Hls({
        enableWorker: false,
        lowLatencyMode: Boolean(source.isLive),
        backBufferLength: source.isLive ? 15 : 60,
        maxBufferSize: 30 * 1000 * 1000,
        maxBufferLength: 20,
      });
      this.hls = hls;
      let iniciou = false;
      this.video.addEventListener('playing', () => { iniciou = true; }, { once: true });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this.video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_, dados) => {
        if (!dados.fatal) return;
        if (!iniciou) {
          falhar(new Error(`Erro HLS fatal: ${dados.details}`));
          return;
        }
        if (dados.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
        else if (dados.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
        else this.events.onError?.(`Erro HLS fatal: ${dados.details}`);
      });

      hls.loadSource(source.url);
      hls.attachMedia(this.video);
    });
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
