/**
 * Interface Unificada do Player Smart TV.
 * Abstrai as peculiaridades do hardware da Samsung (AVPlay) e da LG (webOS).
 */

export interface PlaybackSource {
  url: string;
  title?: string;
  referer?: string;
  userAgent?: string;
  headers?: Record<string, string>;
  clearKey?: string;
  isLive?: boolean;
}

export interface AudioTrack {
  index: number;
  name: string;
  language: string;
}

export interface SubtitleTrack {
  index: number;
  name: string;
  language: string;
}

export interface PlayerEvents {
  onTimeUpdate?: (currentSeconds: number, durationSeconds: number) => void;
  onBuffering?: (isBuffering: boolean) => void;
  onError?: (errorMessage: string) => void;
  onEnded?: () => void;
  onTracksReady?: (audio: AudioTrack[], subtitles: SubtitleTrack[]) => void;
}

export interface TVPlayerInstance {
  play(source: PlaybackSource): Promise<void>;
  pause(): void;
  resume(): void;
  seek(seconds: number): void;
  stop(): void;
  destroy(): void;
  getDuration(): number;
  getCurrentTime(): number;
  setAudioTrack(index: number): void;
  setSubtitleTrack(index: number): void;
  /** Na Samsung o vídeo é um plano de hardware: a janela vai por aqui. */
  setRect?(x: number, y: number, w: number, h: number): void;
}

/** Fontes que exigem Referer ou User-Agent próprios (Chrome/XHR não consegue enviar). */
export function exigeCabecalho(source: PlaybackSource): boolean {
  if (source.referer || source.userAgent) return true;
  if (!source.headers) return false;
  const h = source.headers;
  return Boolean(h.Referer || h.referer || h['User-Agent'] || h['user-agent']);
}

/** Arquivo progressivo direto (MP4, MKV, MP3, AAC) que nunca deve passar pelo hls.js. */
export function ehMidiaProgressiva(url: string): boolean {
  return /\.(mp4|m4v|mkv|webm|avi|mov|flv|wmv|mp3|aac|m4a|flac|ogg|wav|opus)(\?|$)/i.test(url);
}

/** Streams com playlist disfarçada (.txt, error.txt, cloudfront-net.lat) onde decodificadores nativos das TVs falham. */
export function devePreferirHlsJs(source: PlaybackSource): boolean {
  if (exigeCabecalho(source) || ehMidiaProgressiva(source.url)) return false;
  const u = source.url.toLowerCase().split('?')[0];
  return u.endsWith('.txt') || u.includes('cloudfront-net.lat') || u.includes('workers.dev');
}

/** Headers extras permitidos em XMLHttpRequest (XHR proíbe referer/user-agent/cookie/origin/host). */
export function configurarXhrHeaders(headers?: Record<string, string>): ((xhr: XMLHttpRequest) => void) | undefined {
  if (!headers) return undefined;
  const forbidden = ['user-agent', 'referer', 'origin', 'host', 'cookie', 'content-length'];
  const allowed: [string, string][] = [];
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = headers[k];
    if (k && v && forbidden.indexOf(k.toLowerCase()) < 0) allowed.push([k, v]);
  }
  if (allowed.length === 0) return undefined;
  return (xhr: XMLHttpRequest) => {
    for (let i = 0; i < allowed.length; i++) {
      try { xhr.setRequestHeader(allowed[i][0], allowed[i][1]); } catch { /* header bloqueado pelo WebView */ }
    }
  };
}
