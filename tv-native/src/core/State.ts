/**
 * Gerenciador de Estado Reativo Global do Saimo TV.
 */

import { Channel, VODItem } from './Api';
import { Storage } from './Storage';

export type ScreenType =
  | 'favorites'
  | 'minhas'
  | 'live'
  | 'home'
  | 'ondemand'
  | 'ficha'
  | 'player'
  | 'guide'
  | 'events'
  | 'radios'
  | 'search'
  | 'settings'
  | 'doacao';

export type MenuTab =
  | 'buscar'
  | 'inicio'
  | 'ao_vivo'
  | 'eventos'
  | 'on_demand'
  | 'favoritos'
  | 'radios'
  | 'extras'
  | 'ajustes'
  | 'apoie';

export class State {
  static currentScreen: ScreenType = 'home';
  static previousScreen: ScreenType = 'home';
  static activeTab: MenuTab = 'inicio';
  private static iniciado = false;

  static channels: Channel[] = [];
  static currentChannel: Channel | null = null;
  static currentVariantIndex = 0;

  static vodItems: VODItem[] = [];
  static currentVOD: VODItem | null = null;
  static currentSeasonIndex = 0;
  static currentEpisodeIndex = 0;

  static unlockedExtras = false;
  static canalEscolhido = false;

  private static listeners: Map<string, Set<(val: any) => void>> = new Map();

  static on(event: string, callback: (val: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  static off(event: string, callback: (val: any) => void) {
    this.listeners.get(event)?.delete(callback);
  }

  static emit(event: string, data?: any) {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error(`[State] Erro no listener do evento ${event}:`, e);
      }
    });
  }

  static setScreen(screen: ScreenType, params?: { vod?: VODItem; channel?: Channel }) {
    // A primeira chamada sempre passa: é ela que abre a tela inicial.
    if (this.iniciado && this.currentScreen === screen && !params) return;
    this.iniciado = true;

    this.previousScreen = this.currentScreen;
    this.currentScreen = screen;

    if (params?.vod) this.currentVOD = params.vod;
    if (params?.channel) {
      this.currentChannel = params.channel;
      this.canalEscolhido = true;
      this.currentVariantIndex = 0;
    }

    // Sincroniza a aba correspondente no menu
    if (screen === 'home') this.activeTab = 'inicio';
    else if (screen === 'live' || screen === 'guide') this.activeTab = 'ao_vivo';
    else if (screen === 'ondemand') this.activeTab = 'on_demand';
    else if (screen === 'events') this.activeTab = 'eventos';
    else if (screen === 'radios') this.activeTab = 'radios';
    else if (screen === 'search') this.activeTab = 'buscar';
    else if (screen === 'settings' || screen === 'minhas') this.activeTab = 'ajustes';
    else if (screen === 'favorites') this.activeTab = 'favoritos';
    else if (screen === 'doacao') this.activeTab = 'apoie';

    console.info(`[SaimoTV] Navegando para tela: ${screen}`);
    this.emit('screen-changed', { screen, previous: this.previousScreen, params });
  }

  static unlockParental(pin: string): boolean {
    if (pin === '1010') {
      this.unlockedExtras = true;
      this.emit('extras-unlocked');
      return true;
    }
    return false;
  }
}
