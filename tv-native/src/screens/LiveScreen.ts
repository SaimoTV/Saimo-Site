/**
 * Tela de TV Ao Vivo em Tela Cheia (LiveScreen).
 * Zapeamento instantâneo via D-Pad (Cima/Baixo) e numérico (0-9),
 * integração com ZapHUD, Gaveta Lateral de Canais (OK) e failover automático de fontes.
 * Seletor de Fontes acessível por Direita, Play/Pause, Tools ou pelas Teclas Coloridas.
 */

import { State } from '../core/State';
import { Channel, Api } from '../core/Api';
import { Storage } from '../core/Storage';
import { TVPlayerInstance } from '../player/TVPlayer';
import { ZapHUD } from '../components/ZapHUD';
import { ChannelDrawer } from '../components/ChannelDrawer';
import { SourceModal } from '../components/SourceModal';
import { SpatialNav } from '../core/SpatialNav';

export class LiveScreen {
  private element: HTMLElement;
  private zapHud: ZapHUD;
  private drawer: ChannelDrawer;
  private sourceModal: SourceModal;
  private player: TVPlayerInstance;

  private numericBuffer = '';
  private numericTimer: any = null;
  private isTuning = false;

  constructor(player: TVPlayerInstance) {
    this.player = player;
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-live-screen hidden';
    this.element.id = 'screen-live';

    this.zapHud = new ZapHUD();
    this.zapHud.setOnOpenSources(() => {
      this.openCurrentChannelSources();
    });

    this.drawer = new ChannelDrawer(
      (channel) => {
        this.tuneChannel(channel);
      },
      (channel) => {
        this.openChannelSources(channel);
      }
    );

    this.sourceModal = new SourceModal();

    this.element.appendChild(this.zapHud.getElement());
    this.element.appendChild(this.drawer.getElement());
    this.element.appendChild(this.sourceModal.getElement());

    // Listener de Teclas Específicas do Ao Vivo
    window.addEventListener('keydown', (e) => this.handleKeyDown(e), true);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  enter() {
    this.element.classList.remove('hidden');

    if (State.channels.length === 0) {
      State.channels = Api.getCachedChannelsSync();
      if (State.channels.length === 0) {
        Api.fetchChannels().then((c) => {
          State.channels = c;
          if (!State.currentChannel && c.length > 0) {
            this.tuneDefaultChannel();
          }
        }).catch(() => {});
      }
    }

    if (State.channels.length > 0) {
      this.tuneDefaultChannel();
    }
  }

  private tuneDefaultChannel() {
    if (!State.currentChannel && State.channels.length > 0) {
      const prefs = Storage.getPrefs();
      const last = State.channels.find((c) => c.name === prefs.ultimoCanal);
      State.currentChannel = last || State.channels[0];
    }

    if (State.currentChannel) {
      this.tuneChannel(State.currentChannel, State.currentVariantIndex);
    }
  }

  leave() {
    this.element.classList.add('hidden');
    this.zapHud.hide();
    this.drawer.close();
    this.sourceModal.close();
    this.player.stop();
  }

  openCurrentChannelSources() {
    if (!State.currentChannel) return;
    this.openChannelSources(State.currentChannel, State.currentVariantIndex);
  }

  openChannelSources(channel: Channel, defaultVariant = 0) {
    const variants = channel.variants || [];
    this.sourceModal.open(
      channel.name,
      variants,
      defaultVariant,
      (idx) => this.tuneChannel(channel, idx)
    );
  }

  async tuneChannel(channel: Channel, variantIndex = 0) {
    if (this.isTuning && State.currentChannel?.id === channel.id && State.currentVariantIndex === variantIndex) {
      return;
    }

    this.isTuning = true;
    State.currentChannel = channel;
    State.currentVariantIndex = variantIndex;

    // Salva nas preferências
    Storage.savePrefs({ ultimoCanal: channel.name });

    const variant = channel.variants[variantIndex] || channel.variants[0];
    if (!variant) {
      console.warn(`[LiveScreen] Canal ${channel.name} sem variantes de streaming.`);
      this.isTuning = false;
      return;
    }

    // Exibe o Zap HUD imediatamente (< 1ms)
    this.zapHud.show(channel, variantIndex);

    try {
      await this.player.play({
        url: variant.url,
        title: channel.name,
        referer: variant.referer,
        userAgent: variant.userAgent,
        clearKey: variant.clearKey,
        isLive: true,
      });
    } catch (e) {
      console.warn(`[LiveScreen] Falha ao sintonizar ${channel.name}. Tentando próxima variante...`, e);
      this.failoverNextVariant();
    } finally {
      this.isTuning = false;
    }
  }

  private failoverNextVariant() {
    if (!State.currentChannel || State.currentChannel.variants.length <= 1) return;
    const nextIdx = (State.currentVariantIndex + 1) % State.currentChannel.variants.length;
    if (nextIdx !== State.currentVariantIndex) {
      console.info(`[LiveScreen] Alternando para variante ${nextIdx + 1} de ${State.currentChannel.name}`);
      this.tuneChannel(State.currentChannel, nextIdx);
    }
  }

  zapNext() {
    if (State.channels.length === 0) return;
    const curIdx = State.currentChannel ? State.channels.findIndex((c) => c.id === State.currentChannel!.id) : -1;
    const nextIdx = (curIdx + 1) % State.channels.length;
    this.tuneChannel(State.channels[nextIdx]);
  }

  zapPrev() {
    if (State.channels.length === 0) return;
    const curIdx = State.currentChannel ? State.channels.findIndex((c) => c.id === State.currentChannel!.id) : 0;
    const prevIdx = (curIdx - 1 + State.channels.length) % State.channels.length;
    this.tuneChannel(State.channels[prevIdx]);
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (State.currentScreen !== 'live') return;

    // Se o Drawer de Canais ou o Modal de Fontes estiver aberto, deixa o SpatialNav tratar
    if (this.drawer.isOpen() || this.sourceModal.isOpen()) {
      if (e.keyCode === 10009 || e.keyCode === 461 || e.keyCode === 8 || e.keyCode === 27) {
        // BACK fecha gaveta ou modal
        e.preventDefault();
        e.stopPropagation();
        this.drawer.close();
        this.sourceModal.close();
      }
      return;
    }

    const key = e.keyCode;

    // D-PAD CIMA / BAIXO -> Zapear Canal
    if (key === 38 || key === 427) {
      // UP / CH_UP
      e.preventDefault();
      e.stopPropagation();
      this.zapPrev();
    } else if (key === 40 || key === 428) {
      // DOWN / CH_DOWN
      e.preventDefault();
      e.stopPropagation();
      this.zapNext();
    } else if (key === 13) {
      // ENTER / OK -> Abre Drawer de Canais
      e.preventDefault();
      e.stopPropagation();
      if (!this.drawer.isOpen()) {
        this.drawer.open(State.channels, State.currentChannel);
      }
    } else if (key === 37) {
      // ESQUERDA -> Abre Menu Global
      e.preventDefault();
      e.stopPropagation();
      const menu = document.getElementById('tv-menu-global');
      if (menu) {
        const activeTab = menu.querySelector<HTMLElement>('.tv-menu-tab.active') || menu.querySelector<HTMLElement>('.tv-menu-tab');
        if (activeTab) SpatialNav.focus(activeTab);
      }
    } else if (
      key === 39 || // D-PAD DIREITA (Controle Samsung Smart TV)
      key === 415 || key === 19 || // PLAY / PAUSE (Samsung One Remote)
      key === 10182 || key === 457 || key === 10071 || // SAMSUNG TOOLS, INFO, GUIDE
      key === 403 || key === 404 || key === 405 || key === 406 || key === 82 // TECLAS COLORIDAS (VERMELHO, VERDE, AMARELO, AZUL) / R
    ) {
      // Abre seletor de fonte em qualquer controle Samsung ou Smart TV!
      e.preventDefault();
      e.stopPropagation();
      this.openCurrentChannelSources();
    } else if ((key >= 48 && key <= 57) || (key >= 96 && key <= 105)) {
      // Teclas Numéricas (0-9)
      const digit = key >= 96 ? key - 96 : key - 48;
      this.handleNumericInput(String(digit));
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private handleNumericInput(digit: string) {
    this.numericBuffer += digit;
    clearTimeout(this.numericTimer);

    // PIN Parental "1010"
    if (this.numericBuffer === '1010') {
      State.unlockParental('1010');
      this.numericBuffer = '';
      return;
    }

    // Aguarda 1.5s para confirmar número do canal digitado
    this.numericTimer = setTimeout(() => {
      const channelNum = parseInt(this.numericBuffer, 10);
      this.numericBuffer = '';
      const found = State.channels.find((c) => c.number === channelNum);
      if (found) {
        this.tuneChannel(found);
      }
    }, 1500);
  }
}
