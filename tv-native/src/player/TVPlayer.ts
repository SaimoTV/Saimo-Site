/**
 * Interface Unificada do Player Smart TV.
 * Abstrai as peculiaridades do hardware da Samsung (AVPlay) e da LG (webOS).
 */

export interface PlaybackSource {
  url: string;
  title?: string;
  referer?: string;
  userAgent?: string;
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
}
