/**
 * Player Nativo para Samsung Smart TV (Tizen OS).
 * Utiliza webapis.avplay diretamente no decodificador de hardware,
 * garantindo reprodução 4K/HDR sem travar o processador da TV.
 */

import Hls from 'hls.js';
import {
  TVPlayerInstance, PlaybackSource, PlayerEvents, AudioTrack, SubtitleTrack,
  devePreferirHlsJs, ehMidiaProgressiva, exigeCabecalho,
} from './TVPlayer';
import { HlsPlayer } from './HlsPlayer';

export class TizenAVPlayer implements TVPlayerInstance {
  private rect = [0, 0, 1920, 1080];
  private video: HTMLVideoElement;
  private avplay: any;
  private events: PlayerEvents;
  private fallbackHls: HlsPlayer | null = null;
  private backend: 'none' | 'avplay' | 'hls' = 'none';
  private currentSource: PlaybackSource | null = null;
  private triedHls = false;
  private triedAvplay = false;
  private playGen = 0;
  private currentDuration = 0;
  private currentPosition = 0;
  private timer: any = null;
  private isPrepared = false;

  constructor(videoElement: HTMLVideoElement, events: PlayerEvents) {
    this.video = videoElement;
    this.events = events;
    this.avplay = (window as any).webapis?.avplay;
  }

  private setMseActive(active: boolean) {
    document.documentElement.classList.toggle('tizen-mse-ativo', active);
    if (active) {
      const [x, y, w, h] = this.rect;
      Object.assign(this.video.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    }
  }

  private ensureHlsPlayer(): HlsPlayer {
    if (!this.fallbackHls) {
      this.fallbackHls = new HlsPlayer(this.video, {
        onTimeUpdate: (c, d) => {
          if (this.backend === 'hls') this.events.onTimeUpdate?.(c, d);
        },
        onBuffering: (b) => {
          if (this.backend === 'hls') this.events.onBuffering?.(b);
        },
        onEnded: () => {
          if (this.backend === 'hls') this.events.onEnded?.();
        },
        onTracksReady: (a, s) => {
          if (this.backend === 'hls') this.events.onTracksReady?.(a, s);
        },
        onError: (msg) => {
          if (this.backend !== 'hls') return;
          const gen = this.playGen;
          const src = this.currentSource;
          if (!this.triedAvplay && src && this.avplay) {
            console.warn('[TizenAVPlayer] hls.js falhou, tentando AVPlay nativo');
            this.fallbackHls?.stop();
            this.setMseActive(false);
            this.startAvplay(src, gen);
            return;
          }
          this.events.onError?.(msg);
        },
      });
    }
    return this.fallbackHls;
  }

  private stopAvplay() {
    this.isPrepared = false;
    this.currentPosition = 0;
    this.currentDuration = 0;
    clearInterval(this.timer);
    if (!this.avplay) return;
    // Chamadas em try/catch separados: stop() falha em IDLE/NONE e não pode pular o close().
    try { this.avplay.stop(); } catch {}
    try { this.avplay.close(); } catch {}
  }

  private handleAvplayError(gen: number, msg: string) {
    if (gen !== this.playGen || this.backend !== 'avplay') return;
    this.stopAvplay();
    const src = this.currentSource;
    if (!this.triedHls && src && Hls.isSupported() && !exigeCabecalho(src) && !ehMidiaProgressiva(src.url)) {
      this.triedHls = true;
      console.warn('[TizenAVPlayer] Fallback para hls.js após erro AVPlay:', msg);
      void this.startHls(src, gen);
      return;
    }
    this.events.onError?.(msg);
  }

  private async startHls(source: PlaybackSource, gen: number): Promise<void> {
    if (gen !== this.playGen) return;
    this.stopAvplay();
    this.backend = 'hls';
    this.setMseActive(true);
    try {
      await this.ensureHlsPlayer().play(source);
    } catch (e: any) {
      if (gen !== this.playGen || this.backend !== 'hls') return;
      this.events.onError?.(e?.message || 'Erro no player HLS no Tizen');
    }
  }

  private startAvplay(source: PlaybackSource, gen: number): void {
    if (!this.avplay) {
      this.events.onError?.('Tizen webapis.avplay não disponível');
      return;
    }
    if (gen !== this.playGen) return;

    this.triedAvplay = true;
    this.fallbackHls?.stop();
    this.setMseActive(false);
    this.stopAvplay();
    this.backend = 'avplay';

    try {
      this.avplay.open(source.url);

      // Tela cheia no plano de hardware de vídeo
      try {
        this.avplay.setDisplayRect(this.rect[0], this.rect[1], this.rect[2], this.rect[3]);
        this.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO');
      } catch {}

      // Otimização de Buffers para Live e VOD (alguns modelos antigos não suportam todas as chaves)
      try {
        if (source.isLive) {
          this.avplay.setBufferingParam?.('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', 1);
          this.avplay.setBufferingParam?.('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', 2);
        } else {
          this.avplay.setBufferingParam?.('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', 3);
          this.avplay.setBufferingParam?.('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', 5);
        }
      } catch {}

      // Headers (Referer, User-Agent e proxyHeaders.request de addons Stremio)
      const headerMap: Record<string, string> = {};
      if (source.headers) {
        const keys = Object.keys(source.headers);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const v = source.headers[k];
          if (k && v) headerMap[k] = v;
        }
      }
      if (source.referer && !headerMap.Referer && !headerMap.referer) {
        headerMap.Referer = source.referer;
      }
      const ua = source.userAgent || headerMap['User-Agent'] || headerMap['user-agent'];
      if (ua) {
        try { this.avplay.setStreamingProperty?.('USER_AGENT', ua); } catch {}
        delete headerMap['User-Agent'];
        delete headerMap['user-agent'];
      }
      const headerKeys = Object.keys(headerMap);
      if (headerKeys.length > 0) {
        let customHeaders = '';
        for (let i = 0; i < headerKeys.length; i++) {
          const k = headerKeys[i];
          customHeaders += `${k}: ${headerMap[k]}\r\n`;
        }
        try { this.avplay.setStreamingProperty?.('CUSTOM_MESSAGE', customHeaders); } catch {}
      }

      // ClearKey DRM para canais e filmes DASH protegidos
      if (source.clearKey) {
        const [kid, key] = source.clearKey.split(':');
        if (kid && key) {
          const drmParam = JSON.stringify({
            drm_type: 'CLEARKEY',
            keys: [{ key_id: kid, key: key }],
          });
          try { this.avplay.setDrm?.('CLEARKEY', 'SetProperties', drmParam); } catch {}
        }
      }

      this.avplay.setListener({
        onbufferingstart: () => {
          if (gen === this.playGen) this.events.onBuffering?.(true);
        },
        onbufferingcomplete: () => {
          if (gen === this.playGen) this.events.onBuffering?.(false);
        },
        oncurrentplaytime: (timeMs: number) => {
          if (gen !== this.playGen) return;
          this.currentPosition = timeMs / 1000;
          this.events.onTimeUpdate?.(this.currentPosition, this.currentDuration);
        },
        onstreamcompleted: () => {
          if (gen === this.playGen) this.events.onEnded?.();
        },
        onerror: (eventType: any) => {
          console.error('[TizenAVPlayer] Erro de reprodução:', eventType);
          this.handleAvplayError(gen, `Erro AVPlay: ${eventType}`);
        },
      });

      this.avplay.prepareAsync(
        () => {
          if (gen !== this.playGen || this.backend !== 'avplay') return;
          this.isPrepared = true;
          this.avplay.play();
          try {
            this.currentDuration = (this.avplay.getDuration() || 0) / 1000;
          } catch {}
          this.extractTracks();
        },
        (err: any) => {
          console.error('[TizenAVPlayer] Falha no prepareAsync:', err);
          this.handleAvplayError(gen, 'Falha ao preparar stream no Tizen');
        }
      );
    } catch (e: any) {
      console.error('[TizenAVPlayer] Exceção ao abrir fluxo:', e);
      this.handleAvplayError(gen, e?.message || 'Erro inesperado no Tizen');
    }
  }

  async play(source: PlaybackSource): Promise<void> {
    if (!this.avplay && !Hls.isSupported()) {
      throw new Error('Tizen webapis.avplay não disponível');
    }

    this.stop();
    const gen = ++this.playGen;
    this.currentSource = source;
    this.triedHls = false;
    this.triedAvplay = false;

    if (devePreferirHlsJs(source) && Hls.isSupported()) {
      this.triedHls = true;
      await this.startHls(source, gen);
      return;
    }

    this.startAvplay(source, gen);
  }

  private extractTracks() {
    try {
      const trackList = this.avplay.getTotalTrackInfo();
      const audio: AudioTrack[] = [];
      const subs: SubtitleTrack[] = [];

      for (const track of trackList) {
        if (track.type === 'AUDIO') {
          audio.push({
            index: track.index,
            name: track.extra_info?.language || `Áudio ${audio.length + 1}`,
            language: track.extra_info?.language || 'und',
          });
        } else if (track.type === 'TEXT') {
          subs.push({
            index: track.index,
            name: track.extra_info?.language || `Legenda ${subs.length + 1}`,
            language: track.extra_info?.language || 'und',
          });
        }
      }
      this.events.onTracksReady?.(audio, subs);
    } catch (e) {}
  }

  pause() {
    if (this.backend === 'hls') { this.fallbackHls?.pause(); return; }
    try {
      if (this.isPrepared) this.avplay.pause();
    } catch (e) {}
  }

  resume() {
    if (this.backend === 'hls') { this.fallbackHls?.resume(); return; }
    try {
      if (this.isPrepared) this.avplay.play();
    } catch (e) {}
  }

  seek(seconds: number) {
    if (this.backend === 'hls') { this.fallbackHls?.seek(seconds); return; }
    try {
      if (this.isPrepared) this.avplay.seekTo(seconds * 1000);
    } catch (e) {}
  }

  stop() {
    this.playGen++;
    this.currentSource = null;
    this.backend = 'none';
    this.setMseActive(false);
    this.fallbackHls?.stop();
    this.stopAvplay();
  }

  setRect(x: number, y: number, w: number, h: number) {
    this.rect = [x, y, w, h];
    if (this.backend === 'hls') {
      Object.assign(this.video.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
      return;
    }
    try { this.avplay?.setDisplayRect(x, y, w, h); } catch { /* ainda sem vídeo */ }
  }

  destroy() {
    this.stop();
    this.fallbackHls?.destroy();
    this.fallbackHls = null;
  }

  getDuration(): number {
    if (this.backend === 'hls') return this.fallbackHls?.getDuration() ?? 0;
    return this.currentDuration;
  }

  getCurrentTime(): number {
    if (this.backend === 'hls') return this.fallbackHls?.getCurrentTime() ?? 0;
    return this.currentPosition;
  }

  setAudioTrack(index: number) {
    if (this.backend === 'hls') { this.fallbackHls?.setAudioTrack(index); return; }
    try {
      this.avplay.setSelectTrack('AUDIO', index);
    } catch (e) {}
  }

  setSubtitleTrack(index: number) {
    if (this.backend === 'hls') { this.fallbackHls?.setSubtitleTrack(index); return; }
    try {
      if (index === -1) {
        // Desligar legenda
      } else {
        this.avplay.setSelectTrack('TEXT', index);
      }
    } catch (e) {}
  }
}
