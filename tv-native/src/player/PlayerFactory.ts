/**
 * Fábrica do Player Inteligente.
 * Instancia o player de hardware nativo de acordo com a plataforma.
 */

import { Platform } from '../core/Platform';
import { TVPlayerInstance, PlayerEvents } from './TVPlayer';
import { TizenAVPlayer } from './TizenAVPlayer';
import { WebOSPlayer } from './WebOSPlayer';
import { HlsPlayer } from './HlsPlayer';

export class PlayerFactory {
  static create(videoElement: HTMLVideoElement, events: PlayerEvents): TVPlayerInstance {
    if (Platform.isTizen && (window as any).webapis?.avplay) {
      console.info('[SaimoTV] Usando player de hardware Tizen AVPlay');
      return new TizenAVPlayer(events);
    } else if (Platform.isWebOS) {
      console.info('[SaimoTV] Usando player acelerado LG webOS');
      return new WebOSPlayer(videoElement, events);
    } else {
      console.info('[SaimoTV] Usando player MSE/HLS padrão');
      return new HlsPlayer(videoElement, events);
    }
  }
}
