/**
 * Player Nativo para Samsung Smart TV (Tizen OS).
 * Utiliza webapis.avplay diretamente no decodificador de hardware,
 * garantindo reprodução 4K/HDR sem travar o processador da TV.
 */

import { TVPlayerInstance, PlaybackSource, PlayerEvents, AudioTrack, SubtitleTrack } from './TVPlayer';

export class TizenAVPlayer implements TVPlayerInstance {
  private avplay: any;
  private events: PlayerEvents;
  private currentDuration = 0;
  private currentPosition = 0;
  private timer: any = null;
  private isPrepared = false;

  constructor(events: PlayerEvents) {
    this.events = events;
    this.avplay = (window as any).webapis?.avplay;
  }

  async play(source: PlaybackSource): Promise<void> {
    if (!this.avplay) {
      throw new Error('Tizen webapis.avplay não disponível');
    }

    this.stop();

    try {
      this.avplay.open(source.url);

      // Tela cheia no plano de hardware de vídeo
      this.avplay.setDisplayRect(0, 0, 1920, 1080);
      this.avplay.setDisplayMethod('PLAYER_DISPLAY_MODE_AUTO_ASPECT_RATIO');

      // Otimização de Buffers para Live e VOD
      if (source.isLive) {
        this.avplay.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', 1);
        this.avplay.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', 2);
      } else {
        this.avplay.setBufferingParam('PLAYER_BUFFER_FOR_PLAY', 'PLAYER_BUFFER_SIZE_IN_SECOND', 3);
        this.avplay.setBufferingParam('PLAYER_BUFFER_FOR_RESUME', 'PLAYER_BUFFER_SIZE_IN_SECOND', 5);
      }

      // Headers (Referer e User-Agent) se informados
      if (source.referer || source.userAgent) {
        let customHeaders = '';
        if (source.referer) customHeaders += `Referer: ${source.referer}\r\n`;
        if (source.userAgent) customHeaders += `User-Agent: ${source.userAgent}\r\n`;
        this.avplay.setStreamingProperty('CUSTOM_MESSAGE', customHeaders);
      }

      // ClearKey DRM para canais e filmes DASH protegidos
      if (source.clearKey) {
        const [kid, key] = source.clearKey.split(':');
        if (kid && key) {
          const drmParam = JSON.stringify({
            drm_type: 'CLEARKEY',
            keys: [{ key_id: kid, key: key }],
          });
          this.avplay.setDrm('CLEARKEY', 'SetProperties', drmParam);
        }
      }

      this.avplay.setListener({
        onbufferingstart: () => {
          this.events.onBuffering?.(true);
        },
        onbufferingcomplete: () => {
          this.events.onBuffering?.(false);
        },
        oncurrentplaytime: (timeMs: number) => {
          this.currentPosition = timeMs / 1000;
          this.events.onTimeUpdate?.(this.currentPosition, this.currentDuration);
        },
        onstreamcompleted: () => {
          this.events.onEnded?.();
        },
        onerror: (eventType: any) => {
          console.error('[TizenAVPlayer] Erro de reprodução:', eventType);
          this.events.onError?.(`Erro AVPlay: ${eventType}`);
        },
      });

      this.avplay.prepareAsync(
        () => {
          this.isPrepared = true;
          this.avplay.play();
          try {
            this.currentDuration = (this.avplay.getDuration() || 0) / 1000;
          } catch (e) {}
          this.extractTracks();
        },
        (err: any) => {
          console.error('[TizenAVPlayer] Falha no prepareAsync:', err);
          this.events.onError?.('Falha ao preparar stream no Tizen');
        }
      );
    } catch (e: any) {
      console.error('[TizenAVPlayer] Exceção ao abrir fluxo:', e);
      this.events.onError?.(e.message || 'Erro inesperado no Tizen');
    }
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
    try {
      if (this.isPrepared) this.avplay.pause();
    } catch (e) {}
  }

  resume() {
    try {
      if (this.isPrepared) this.avplay.play();
    } catch (e) {}
  }

  seek(seconds: number) {
    try {
      if (this.isPrepared) this.avplay.seekTo(seconds * 1000);
    } catch (e) {}
  }

  stop() {
    this.isPrepared = false;
    clearInterval(this.timer);
    try {
      this.avplay.stop();
      this.avplay.close();
    } catch (e) {}
  }

  destroy() {
    this.stop();
  }

  getDuration(): number {
    return this.currentDuration;
  }

  getCurrentTime(): number {
    return this.currentPosition;
  }

  setAudioTrack(index: number) {
    try {
      this.avplay.setSelectTrack('AUDIO', index);
    } catch (e) {}
  }

  setSubtitleTrack(index: number) {
    try {
      if (index === -1) {
        // Desligar legenda
      } else {
        this.avplay.setSelectTrack('TEXT', index);
      }
    } catch (e) {}
  }
}
