/**
 * Ponto de Entrada Principal do Saimo TV Nativo (Tizen & webOS).
 * Orquestra o ciclo de vida, roteador de telas, controle remoto e aceleração de vídeo.
 */

import './styles/tv.css';
import { Platform } from './core/Platform';
import { SpatialNav } from './core/SpatialNav';
import { State, ScreenType } from './core/State';
import { Storage } from './core/Storage';
import { Api } from './core/Api';
import { PlayerFactory } from './player/PlayerFactory';
import { MenuGlobal } from './components/MenuGlobal';

import { LiveScreen } from './screens/LiveScreen';
import { HomeScreen } from './screens/HomeScreen';
import { OnDemandScreen } from './screens/OnDemandScreen';
import { FichaScreen } from './screens/FichaScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import { GuideScreen } from './screens/GuideScreen';
import { EventsScreen } from './screens/EventsScreen';
import { RadiosScreen } from './screens/RadiosScreen';
import { SearchScreen } from './screens/SearchScreen';
import { SettingsScreen } from './screens/SettingsScreen';

class SaimoTVApp {
  private videoEl: HTMLVideoElement;
  private menuGlobal: MenuGlobal;
  private screensContainer: HTMLElement;

  private screens: Map<ScreenType, any> = new Map();
  private lastBackPress = 0;

  constructor() {
    Platform.init();
    SpatialNav.init();

    this.videoEl = document.getElementById('tv-video') as HTMLVideoElement;
    this.screensContainer = document.getElementById('tv-screens-container') as HTMLElement;

    // Instancia o player de hardware acelerado
    const player = PlayerFactory.create(this.videoEl, {
      onError: (err) => console.warn('[SaimoTV] Erro no player:', err),
    });

    // Menu Global do Topo
    this.menuGlobal = new MenuGlobal();
    const appEl = document.getElementById('app')!;
    appEl.insertBefore(this.menuGlobal.getElement(), this.screensContainer);

    // Registra todas as Telas
    this.screens.set('live', new LiveScreen(player));
    this.screens.set('home', new HomeScreen());
    this.screens.set('ondemand', new OnDemandScreen());
    this.screens.set('ficha', new FichaScreen());
    this.screens.set('player', new PlayerScreen(player));
    this.screens.set('guide', new GuideScreen());
    this.screens.set('events', new EventsScreen());
    this.screens.set('radios', new RadiosScreen(player));
    this.screens.set('search', new SearchScreen());
    this.screens.set('settings', new SettingsScreen());

    // Adiciona elementos das telas ao contêiner
    this.screens.forEach((screen) => {
      this.screensContainer.appendChild(screen.getElement());
    });

    // Escuta mudanças de tela do State
    State.on('screen-changed', ({ screen, previous }) => {
      this.handleScreenTransition(screen, previous);
    });

    // Listener Global de Tecla Voltar / Sair
    window.addEventListener('keydown', (e) => this.handleGlobalKeyDown(e), true);

    this.boot();
  }

  private async boot() {
    console.info('[SaimoTV] Iniciando aplicação nativa 1080p...');

    // Pré-carrega canais e destaques da tela inicial em background de forma assíncrona
    Api.fetchDestaques().catch(() => {});
    Api.fetchChannels().catch(() => {});

    const prefs = Storage.getPrefs();
    if (prefs.abrirEm === 'canal' && prefs.ultimoCanal) {
      State.setScreen('live');
    } else {
      State.setScreen('home');
    }
  }

  private handleScreenTransition(nextScreen: ScreenType, prevScreen: ScreenType) {
    const prevInstance = this.screens.get(prevScreen);
    if (prevInstance && typeof prevInstance.leave === 'function') {
      prevInstance.leave();
    }

    // Mostra/esconde o menu do topo
    const menuEl = this.menuGlobal.getElement();
    if (nextScreen === 'live' || nextScreen === 'player' || nextScreen === 'ficha') {
      menuEl.style.display = 'none';
    } else {
      menuEl.style.display = 'flex';
    }

    const nextInstance = this.screens.get(nextScreen);
    if (nextInstance && typeof nextInstance.enter === 'function') {
      nextInstance.enter();
    }
  }

  private handleGlobalKeyDown(e: KeyboardEvent) {
    if (Platform.isBackKey(e.keyCode)) {
      e.preventDefault();
      e.stopPropagation();

      const current = State.currentScreen;

      if (current === 'ficha') {
        State.setScreen(State.previousScreen === 'player' ? 'home' : State.previousScreen);
      } else if (current === 'player') {
        State.setScreen('ficha');
      } else if (current === 'live') {
        State.setScreen('home');
      } else if (current !== 'home') {
        State.setScreen('home');
      } else {
        // Na Home: duplo clique em VOLTAR em menos de 2s encerra o app
        const now = Date.now();
        if (now - this.lastBackPress < 2000) {
          Platform.exitApp();
        } else {
          this.lastBackPress = now;
          console.info('[SaimoTV] Pressione VOLTAR novamente para sair.');
        }
      }
    }
  }
}

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  new SaimoTVApp();
});
