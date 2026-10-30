/**
 * Plataforma Smart TV: Samsung Tizen, LG webOS e Navegador (Dev/Simulador).
 * Normaliza teclas do controle remoto, captura botões de mídia e saída do app.
 */

export type TVBrand = 'tizen' | 'webos' | 'browser';

export interface TVKeys {
  UP: number;
  DOWN: number;
  LEFT: number;
  RIGHT: number;
  ENTER: number;
  BACK: number;
  PLAY_PAUSE: number;
  PLAY: number;
  PAUSE: number;
  STOP: number;
  FAST_FORWARD: number;
  REWIND: number;
  CH_UP: number;
  CH_DOWN: number;
  RED: number;
  GREEN: number;
  YELLOW: number;
  BLUE: number;
  NUM_0: number;
  NUM_9: number;
}

export class Platform {
  static brand: TVBrand = 'browser';
  static isTizen = false;
  static isWebOS = false;

  static init() {
    const ua = navigator.userAgent;
    if (typeof (window as any).tizen !== 'undefined' || ua.includes('Tizen')) {
      this.brand = 'tizen';
      this.isTizen = true;
    } else if (
      typeof (window as any).webOS !== 'undefined' ||
      typeof (window as any).PalmSystem !== 'undefined' ||
      ua.includes('Web0S') ||
      ua.includes('webOS')
    ) {
      this.brand = 'webos';
      this.isWebOS = true;
    } else {
      this.brand = 'browser';
    }

    console.info(`[SaimoTV] Plataforma detectada: ${this.brand.toUpperCase()}`);

    if (this.isTizen) {
      this.registerTizenKeys();
    }
  }

  private static registerTizenKeys() {
    try {
      const tizen = (window as any).tizen;
      if (tizen && tizen.tvinputdevice) {
        const keysToRegister = [
          'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop',
          'MediaFastForward', 'MediaRewind',
          'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue',
          'ChannelUp', 'ChannelDown', 'Info',
          '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
        ];
        tizen.tvinputdevice.registerKeyBatch(keysToRegister);
        console.info('[SaimoTV] Teclas registradas no Tizen com sucesso.');
      }
    } catch (e) {
      console.warn('[SaimoTV] Aviso ao registrar teclas Tizen:', e);
    }
  }

  static isBackKey(keyCode: number): boolean {
    return keyCode === 10009 || keyCode === 461 || keyCode === 8 || keyCode === 27;
  }

  static isEnterKey(keyCode: number): boolean {
    return keyCode === 13;
  }

  static isArrowKey(keyCode: number): boolean {
    return keyCode >= 37 && keyCode <= 40;
  }

  static isNumberKey(keyCode: number): boolean {
    return (keyCode >= 48 && keyCode <= 57) || (keyCode >= 96 && keyCode <= 105);
  }

  static getNumber(keyCode: number): number {
    if (keyCode >= 48 && keyCode <= 57) return keyCode - 48;
    if (keyCode >= 96 && keyCode <= 105) return keyCode - 96;
    return -1;
  }

  static exitApp() {
    if (this.isTizen) {
      try {
        (window as any).tizen.application.getCurrentApplication().exit();
      } catch (e) {
        window.close();
      }
    } else if (this.isWebOS) {
      try {
        window.close();
      } catch (e) {
        console.log('webOS exit');
      }
    } else {
      console.log('[SaimoTV] Sair do app (Simulador)');
    }
  }
}
