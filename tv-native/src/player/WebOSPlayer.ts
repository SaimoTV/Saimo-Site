/**
 * Player Nativo para LG Smart TV (webOS).
 * Utiliza o elemento de vídeo acelerado pelo hardware do webOS
 * sem bloqueios de CORS por rodar em app empacotado.
 */

import Hls from 'hls.js';
import { TVPlayerInstance, PlaybackSource, PlayerEvents, AudioTrack, SubtitleTrack } from './TVPlayer';

const PROXY_TV = 'https://saimo-tv.pages.dev';

export class WebOSPlayer implements TVPlayerInstance {
  private video: HTMLVideoElement;
  private events: PlayerEvents;
  private hls: Hls | null = null;
  private currentSource: PlaybackSource | null = null;
  private triedHlsFallback = false;
  private triedNativeFallback = false;
  private hlsPrimeiro = false;
  private triedProxy = false;
  private token = 0;
  private vigia: ReturnType<typeof setTimeout> | null = null;

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
      this.limpaVigia();
      this.events.onBuffering?.(false);
    });

    this.video.addEventListener('ended', () => {
      this.events.onEnded?.();
    });

    this.video.addEventListener('error', () => {
      if (this.hls) return; // erros do hls.js chegam pelo evento dele
      if (!this.triedHlsFallback && this.currentSource && Hls.isSupported()) {
        const u = this.currentSource.url.toLowerCase();
        if (u.includes('.m3u8') || u.includes('master.txt') || u.includes('hls')) {
          this.triedHlsFallback = true;
          console.warn('[WebOSPlayer] Fallback para hls.js após erro nativo');
          this.playWithHls(this.currentSource.url);
          return;
        }
      }
      const err = this.video.error;
      this.events.onError?.(`Erro webOS Video: code ${err?.code || 'desconhecido'}`);
    });

    this.video.addEventListener('loadedmetadata', () => {
      this.extractTracks();
    });
  }

  private playWithHls(url: string, urlNativa: string = url) {
    this.destroyHls();
    const extraHeaders = this.currentSource?.headers;
    const hls = new Hls({
      enableWorker: false,
      lowLatencyMode: false,
      // Falha rápida: o caminho direto precisa desistir cedo para o proxy ter tempo.
      // (o proxy pode demorar mais, principalmente na primeira chamada)
      manifestLoadingTimeOut: url.indexOf(PROXY_TV) === 0 ? 20000 : 6000,
      manifestLoadingMaxRetry: url.indexOf(PROXY_TV) === 0 ? 1 : 0,
      xhrSetup: extraHeaders
        ? (xhr) => {
            const forbidden = ['user-agent', 'referer', 'origin', 'host', 'cookie', 'content-length'];
            const keys = Object.keys(extraHeaders);
            for (let i = 0; i < keys.length; i++) {
              const k = keys[i];
              if (forbidden.indexOf(k.toLowerCase()) >= 0) continue;
              const v = extraHeaders[k];
              if (v) {
                try {
                  xhr.setRequestHeader(k, v);
                } catch {
                  /* ignora header não aceito pelo WebView */
                }
              }
            }
          }
        : undefined,
    });
    this.hls = hls;
    hls.loadSource(url);
    hls.attachMedia(this.video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      this.video.play().catch((e: any) => {
        this.events.onError?.(e?.message || 'Falha ao reproduzir HLS');
      });
    });
    hls.on(Hls.Events.ERROR, (_ev, data) => {
      if (this.hls !== hls) return; // instância antiga (fonte já trocada)
      if (data.fatal) {
        if (this.hlsPrimeiro && !this.triedProxy && url === this.currentSource?.url) {
          // Direto falhou (rede da TV, DNS, bloqueio): tenta pelo proxy do site.
          this.triedProxy = true;
          const px = `${PROXY_TV}/api/proxy?url=${encodeURIComponent(url)}`;
          this.playWithHls(px, url);
          return;
        }
        if (this.hlsPrimeiro && !this.triedNativeFallback) {
          // hls.js não deu conta: deixa o decodificador nativo da LG tentar.
          this.triedNativeFallback = true;
          this.destroyHls();
          this.video.src = urlNativa;
          this.video.load();
          this.video.play().catch(() => {});
          return;
        }
        this.events.onError?.(`Erro HLS webOS: ${data.details || data.type}`);
      }
    });
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
    this.currentSource = source;
    const meu = ++this.token;
    this.limpaVigia();
    // Fonte que nem erro dá (rede presa, "stalled"): sem 'playing' em 30 s, passa para a próxima.
    this.vigia = setTimeout(() => {
      if (meu !== this.token) return;
      this.events.onError?.('Fonte sem resposta (30 s)');
    }, 30000);
    this.triedHlsFallback = false;
    this.triedNativeFallback = false;
    this.triedProxy = false;
    this.hlsPrimeiro = false;

    // Igual ao navegador: HLS sem headers próprios vai pelo hls.js (o nativo da LG
    // recusa fontes que o hls.js toca). Com headers, o caminho nativo segue primeiro.
    // Fonte que exige Referer/User-Agent: o WebView não os envia (nem o hls.js, nem o nativo),
    // então vai pelo proxy do site, que os coloca. É o mesmo contrato do site (`/api/proxy`).
    if ((source.referer || source.userAgent) && Hls.isSupported()) {
      let px = `${PROXY_TV}/api/proxy?url=${encodeURIComponent(source.url)}`;
      if (source.referer) px += `&referer=${encodeURIComponent(source.referer)}`;
      if (source.userAgent) px += `&ua=${encodeURIComponent(source.userAgent)}`;
      this.triedHlsFallback = true;
      this.triedProxy = true;
      this.hlsPrimeiro = true;
      this.playWithHls(px, source.url);
      return;
    }

    const hlsLike = /\.m3u8|\.txt|workers\.dev/i.test(source.url);
    if (hlsLike && !source.headers && !source.referer && Hls.isSupported()) {
      this.triedHlsFallback = true;
      this.hlsPrimeiro = true;
      this.playWithHls(source.url);
      return;
    }

    this.video.src = source.url;
    this.video.load();

    try {
      await this.video.play();
    } catch (e: any) {
      // Rejeição de um play() antigo (cortado pelo pause() da troca de fonte): ignora.
      if (meu !== this.token) return;
      if (!this.triedHlsFallback && Hls.isSupported()) {
        const u = source.url.toLowerCase();
        if (u.includes('.m3u8') || u.includes('master.txt') || u.includes('hls')) {
          this.triedHlsFallback = true;
          this.playWithHls(source.url);
          return;
        }
      }
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

  private limpaVigia() {
    if (this.vigia) { clearTimeout(this.vigia); this.vigia = null; }
  }

  stop() {
    this.limpaVigia();
    this.token++;
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
