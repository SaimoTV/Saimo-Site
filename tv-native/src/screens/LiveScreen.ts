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
import { HlsPlayer } from '../player/HlsPlayer';
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
  /** Fontes já tentadas no canal atual; acabadas, avisa em vez de rodar em círculo. */
  private tentadas = new Set<number>();
  /** Vigia: fonte que não anda em PRAZO_FONTE ms desce para a seguinte. */
  private vigia: any = null;
  private static PRAZO_FONTE = 12000;

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
        if (this.drawer.estaEscolhendo()) {
          this.entrarMulti(channel);
          return;
        }
        this.fecharPainel();
        if (State.currentChannel?.id !== channel.id) this.tuneChannel(channel);
      },
      (channel) => {
        this.openChannelSources(channel);
      },
      () => this.subirAoMenu(),
      () => this.drawer.escolherSegunda(State.channels, State.currentChannel)
    );

    this.sourceModal = new SourceModal();

    this.element.appendChild(this.drawer.getElement());
    this.element.appendChild(this.zapHud.getElement());
    this.element.appendChild(this.sourceModal.getElement());

    // Listener de Teclas Específicas do Ao Vivo
    window.addEventListener('keydown', (e) => this.handleKeyDown(e), true);
    State.on('player-erro', () => {
      if (State.currentScreen === 'live' && !this.player2 && State.currentChannel) this.fonteFalhou();
    });
  }

  getElement(): HTMLElement {
    return this.element;
  }

  enter() {
    this.element.classList.remove('hidden');
    this.sourceModal.close();

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
    // Pelo menu abre o painel; vindo de um cartão, já em tela cheia.
    if (State.previousScreen !== 'player' && !State.canalEscolhido) this.abrirPainel();
    else this.fecharPainel();
    State.canalEscolhido = false;
  }

  // ===== MULTI TELA =====
  // O canal principal segue no player da TV; o segundo vai por um <video> com
  // hls.js. Só existe enquanto a multi tela está aberta: em TV fraca, um segundo
  // player parado ainda segura decodificador e memória.
  private video2: HTMLVideoElement | null = null;
  private player2: HlsPlayer | null = null;
  private segundo: Channel | null = null;
  private avisoMulti: HTMLElement | null = null;
  private prazoMulti: any = null;

  private janela(x: number, y: number, w: number, h: number) {
    this.player.setRect?.(x, y, w, h);
    const v = document.getElementById('tv-video') as HTMLElement;
    Object.assign(v.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
  }

  private entrarMulti(canal: Channel) {
    this.drawer.close();
    this.zapHud.hide();
    this.janela(0, 270, 960, 540);
    State.emit('tela-cheia', true);
    if (!this.video2) {
      this.video2 = document.createElement('video');
      this.video2.className = 'tv-video-2';
      this.video2.muted = true;
      document.getElementById('app')!.insertBefore(this.video2, document.getElementById('tv-screens-container'));
      this.avisoMulti = document.createElement('div');
      this.avisoMulti.className = 'tv-multi-aviso';
      this.element.appendChild(this.avisoMulti);
    }
    this.video2.style.display = 'block';
    this.player2 = new HlsPlayer(this.video2, {});
    this.tocarSegundo(canal, 0);
  }

  private tocarSegundo(canal: Channel, fonte: number) {
    this.segundo = canal;
    const v = canal.variants[fonte];
    clearTimeout(this.prazoMulti);
    if (!v) {
      this.sairMulti();
      this.zapHud.hide();
      return;
    }
    this.avisoMulti!.textContent = `${canal.name}  ·  OK troca o som de tela  ·  VOLTAR sai da multi tela`;
    this.player2!.play({ url: v.url, isLive: true }).catch(() => {});
    // Fonte que não anda em 12 s desce para a seguinte; acabadas, a TV não aguenta.
    this.prazoMulti = setTimeout(() => {
      if (this.video2 && this.video2.currentTime === 0) this.tocarSegundo(canal, fonte + 1);
    }, 12000);
  }

  private trocarTelas() {
    const a = State.currentChannel;
    const b = this.segundo;
    if (!a || !b) return;
    this.tuneChannel(b);
    this.zapHud.hide();
    this.tocarSegundo(a, 0);
  }

  private sairMulti() {
    clearTimeout(this.prazoMulti);
    this.player2?.destroy();
    this.player2 = null;
    this.segundo = null;
    if (this.video2) this.video2.style.display = 'none';
    if (this.avisoMulti) this.avisoMulti.textContent = '';
    this.janela(0, 0, 1920, 1080);
  }

  private abrirPainel() {
    if (this.drawer.isOpen()) return;
    this.zapHud.hide();
    this.player.setRect?.(896, 130, 988, 556);
    const v = document.getElementById('tv-video') as HTMLElement;
    Object.assign(v.style, { left: '896px', top: '130px', width: '988px', height: '556px' });
    SpatialNav.limpar();
    this.drawer.open(State.channels, State.currentChannel);
    State.emit('tela-cheia', false);
  }

  private fecharPainel() {
    this.drawer.close();
    this.player.setRect?.(0, 0, 1920, 1080);
    const v = document.getElementById('tv-video') as HTMLElement;
    Object.assign(v.style, { left: '0', top: '0', width: '1920px', height: '1080px' });
    State.emit('tela-cheia', true);
  }

  private subirAoMenu() {
    const menu = document.getElementById('tv-menu-global');
    const aba = menu?.querySelector<HTMLElement>('.tv-menu-tab.active');
    if (aba) SpatialNav.focus(aba);
  }

  private tuneDefaultChannel() {
    if (!State.currentChannel && State.channels.length > 0) {
      const prefs = Storage.getPrefs();
      const last = State.channels.find((c) => c.name === prefs.ultimoCanal);
      State.currentChannel = last || State.channels[0];
    }

    if (State.currentChannel) {
      this.tuneChannel(State.currentChannel);
    }
  }

  leave() {
    this.element.classList.add('hidden');
    clearTimeout(this.vigia);
    this.zapHud.hide();
    if (this.player2) this.sairMulti();
    this.fecharPainel();
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
      (idx) => this.tuneChannel(channel, idx, true)
    );
  }

  /**
   * Sintoniza o canal. Sem índice, abre na fonte lembrada para o canal (a que a
   * pessoa escolheu ou a última que tocou). `manual`: escolha feita no seletor,
   * guardada na hora e ponto de partida para a troca automática.
   */
  async tuneChannel(channel: Channel, variantIndex?: number, manual = false) {
    const total = channel.variants?.length || 0;
    let idx = variantIndex ?? Storage.getFonteCanal(channel.name);
    if (idx >= total) idx = 0;
    if (this.isTuning && State.currentChannel?.id === channel.id && State.currentVariantIndex === idx) {
      return;
    }
    if (State.currentChannel?.id !== channel.id || manual || variantIndex === undefined) this.tentadas.clear();
    this.tentadas.add(idx);
    if (manual) Storage.setFonteCanal(channel.name, idx);

    this.isTuning = true;
    State.currentChannel = channel;
    State.currentVariantIndex = idx;

    // Salva nas preferências
    Storage.savePrefs({ ultimoCanal: channel.name });

    const variant = channel.variants[idx];
    if (!variant) {
      console.warn(`[LiveScreen] Canal ${channel.name} sem variantes de streaming.`);
      this.isTuning = false;
      return;
    }

    // Exibe o Zap HUD imediatamente (< 1ms)
    this.zapHud.show(channel, idx);
    this.vigiar(channel, idx);

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
      this.fonteFalhou();
    } finally {
      this.isTuning = false;
    }
  }

  /** Fonte que não andou no prazo é dada como morta; a que andou fica lembrada. */
  private vigiar(channel: Channel, idx: number) {
    clearTimeout(this.vigia);
    const inicio = this.player.getCurrentTime();
    this.vigia = setTimeout(() => {
      if (State.currentChannel?.id !== channel.id || State.currentVariantIndex !== idx) return;
      if (this.player.getCurrentTime() > inicio + 1) {
        Storage.setFonteCanal(channel.name, idx);
      } else {
        this.fonteFalhou();
      }
    }, LiveScreen.PRAZO_FONTE);
  }

  /** Desce para a próxima fonte ainda não tentada; acabadas, avisa. */
  private fonteFalhou() {
    const canal = State.currentChannel;
    if (!canal) return;
    clearTimeout(this.vigia);
    const total = canal.variants.length;
    for (let passo = 1; passo < total; passo++) {
      const proxima = (State.currentVariantIndex + passo) % total;
      if (!this.tentadas.has(proxima)) {
        console.info(`[LiveScreen] Alternando para a fonte ${proxima + 1} de ${canal.name}`);
        this.zapHud.aviso(`Fonte ${State.currentVariantIndex + 1} não abriu. Tentando a fonte ${proxima + 1}…`, 4);
        this.tuneChannel(canal, proxima);
        return;
      }
    }
    this.zapHud.aviso(total > 1
      ? 'Nenhuma fonte deste canal abriu agora. Tente de novo em alguns minutos.'
      : 'Este canal está fora do ar agora. Tente de novo em alguns minutos.');
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

    if (this.player2) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.keyCode === 13) this.trocarTelas();
      else if (e.keyCode === 10009 || e.keyCode === 461 || e.keyCode === 8 || e.keyCode === 27) this.sairMulti();
      return;
    }

    // Se o Drawer de Canais ou o Modal de Fontes estiver aberto, deixa o SpatialNav tratar
    if (this.drawer.isOpen() || this.sourceModal.isOpen()) {
      if (e.keyCode === 10009 || e.keyCode === 461 || e.keyCode === 8 || e.keyCode === 27) {
        // BACK: modal fecha; o painel deixa o Voltar ir para o Início
        if (this.sourceModal.isOpen()) {
          e.preventDefault();
          e.stopPropagation();
          this.sourceModal.close();
        }
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
      // OK mostra ou esconde a barra do canal
      e.preventDefault();
      e.stopPropagation();
      if (State.currentChannel) this.zapHud.show(State.currentChannel, State.currentVariantIndex);
    } else if (key === 37) {
      // ESQUERDA -> Painel de canais
      e.preventDefault();
      e.stopPropagation();
      this.abrirPainel();
    } else if (key === 39) {
      // DIREITA: escolher a fonte do canal (com uma fonte só, mostra a barra do canal)
      e.preventDefault();
      e.stopPropagation();
      if (State.currentChannel && State.currentChannel.variants.length > 1) {
        this.openCurrentChannelSources();
      } else if (State.currentChannel) {
        this.zapHud.show(State.currentChannel, State.currentVariantIndex);
      }
    } else if (key === 415 || key === 19 || key === 10252) {
      // PLAY / PAUSE: em transmissão ao vivo mantém o vídeo fluindo normalmente sem abrir nenhum modal
      e.preventDefault();
      e.stopPropagation();
    } else if (key === 10182 || key === 403 || key === 82) {
      // Tecla Vermelha ou Menu de Ferramentas Samsung: abre seletor manual sob demanda explícita
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
