/**
 * Tela Inicial (HomeScreen) - 100% Idêntica ao TV Box (EscolhaActivity.kt).
 * Renderiza:
 * 1. Hero Showcase Banner no topo com backdrop em alta resolução e metadados instantâneos.
 * 2. Trilho "Continuar Assistindo" (quando houver filmes/séries em andamento).
 * 3. Trilho "Ao Vivo Agora" (canais abertos e favoritos com programa no ar e barra de progresso).
 * 4. Fileiras dinâmicas de destaques.txt ("Em alta", "Lançamentos", "Séries", "Animes", "Doramas").
 */

import { State } from '../core/State';
import { Api, VODItem, Channel, DestaqueFila } from '../core/Api';
import { Storage } from '../core/Storage';
import { HeroBanner } from '../components/HeroBanner';
import { Rail, CardModel } from '../components/Rail';
import { SpatialNav } from '../core/SpatialNav';

export class HomeScreen {
  private element: HTMLElement;
  private scrollContainer: HTMLElement;
  private heroBanner: HeroBanner;

  private continueRail: Rail;
  private liveRail: Rail;
  private dynamicRails: Rail[] = [];

  private isLoaded = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-home-screen hidden';
    this.element.id = 'screen-home';

    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'tv-screen-scroll tv-scroll-v';

    this.heroBanner = new HeroBanner();
    this.scrollContainer.appendChild(this.heroBanner.getElement());

    // Trilhos Locais Fixos
    this.continueRail = new Rail('Continuar Assistindo', false);
    this.liveRail = new Rail('Ao Vivo Agora', true);

    this.scrollContainer.appendChild(this.continueRail.getElement());
    this.scrollContainer.appendChild(this.liveRail.getElement());

    this.element.appendChild(this.scrollContainer);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  enter() {
    this.element.classList.remove('hidden');
    this.heroBanner.setDefault(
      'Saimo TV',
      'Filmes · Séries · Ao Vivo em 60 FPS',
      'Navegue com o controle remoto para explorar o acervo completo e sintonizar canais com zero delay.'
    );

    // 1. Carrega itens locais e dados em cache imediatamente no frame 0 (< 1ms)
    this.renderContinueWatching();
    this.renderLiveRailSync();
    this.loadDestaquesSync();

    // 2. Foco instantâneo para resposta a comandos do controle remoto
    this.focusFirstItem();

    // 3. Atualização em segundo plano não bloqueante (fire and forget)
    if (!this.isLoaded) {
      this.isLoaded = true;
      this.syncFreshData();
    }
  }

  leave() {
    this.element.classList.add('hidden');
  }

  private focusFirstItem() {
    const firstCard =
      this.continueRail.getFirstCard() ||
      this.liveRail.getFirstCard() ||
      (this.dynamicRails.length > 0 ? this.dynamicRails[0].getFirstCard() : null);

    if (firstCard) {
      SpatialNav.focus(firstCard);
    }
  }

  private syncFreshData() {
    Promise.all([
      Api.fetchChannels(),
      Api.fetchDestaques()
    ]).then(([channels, destaques]) => {
      if (channels && channels.length > 0) {
        State.channels = channels;
        this.renderLiveRailSync();
      }
      if (destaques && destaques.length > 0) {
        this.loadDestaquesSync();
      }
      if (!document.querySelector('.nav-focused')) {
        this.focusFirstItem();
      }
    }).catch((e) => console.warn('[HomeScreen] syncFreshData erro:', e));
  }

  private renderContinueWatching() {
    const allProgress = Storage.getAllProgress();
    const progressList = Object.values(allProgress).sort((a, b) => b.updatedAt - a.updatedAt);

    if (progressList.length === 0) {
      this.continueRail.getElement().style.display = 'none';
      return;
    }

    this.continueRail.getElement().style.display = 'block';
    const cards: CardModel[] = progressList.map((p) => ({
      id: `cont_${encodeURIComponent(p.title)}`,
      title: p.title,
      subtitle: p.episodeTitle || `${p.percent}% assistido`,
      progressPercent: p.percent,
      badge: `${p.percent}%`,
      badgeColor: '#00e3ff',
      onClick: () => {
        let vod = State.vodItems.find((v) => v.title === p.title);
        if (!vod) {
          vod = {
            id: `saved_${p.title}`,
            title: p.title,
            isSeries: Boolean(p.season && p.episode),
            poster: '',
            genres: [],
            sources: p.url ? [p.url] : undefined,
          };
        }
        State.setScreen('ficha', { vod });
      },
      onFocus: () => {
        this.heroBanner.setDefault(
          p.title,
          `Continuar assistindo · ${p.percent}% concluído`,
          p.episodeTitle ? `${p.episodeTitle}. Pressione OK para retomar a reprodução de onde parou.` : 'Pressione OK para retomar o vídeo de onde parou.'
        );
      },
    }));

    this.continueRail.setCards(cards);
  }

  private renderLiveRailSync() {
    const channels = State.channels.length > 0 ? State.channels : Api.getCachedChannelsSync();
    if (channels.length === 0) {
      this.liveRail.getElement().style.display = 'none';
      return;
    }
    State.channels = channels;
    this.liveRail.getElement().style.display = 'block';

    const favs = Storage.getFavoriteChannels();
    const chosenChannels = channels
      .filter((c) => favs.has(c.name) || c.category.includes('Aberta') || c.category.includes('Esporte'))
      .slice(0, 16);

    const cards: CardModel[] = chosenChannels.map((c) => {
      const epg = Api.getNowNext(c.name);
      return {
        id: `ch_rail_${c.id}`,
        title: c.name,
        subtitle: epg.current?.title || 'Ao Vivo',
        image: c.logo,
        progressPercent: epg.current ? Math.round(epg.current.progress * 100) : undefined,
        onClick: () => {
          State.setScreen('live', { channel: c });
        },
        onFocus: () => {
          this.heroBanner.setDefault(
            c.name,
            `Canal Ao Vivo · ${c.category}`,
            epg.current
              ? `No ar agora: ${epg.current.title} (${epg.current.remainingMin} min restantes). A seguir: ${epg.next?.title || 'Programação ao vivo'}.`
              : 'Transmissão ao vivo em alta definição com zero delay.'
          );
        },
      };
    });

    this.liveRail.setCards(cards);
  }

  private loadDestaquesSync() {
    const filas = Api.getCachedDestaquesSync();
    if (filas.length === 0) return;

    if (this.dynamicRails.length > 0 && this.dynamicRails.length === filas.length) {
      return;
    }

    this.dynamicRails.forEach((r) => r.getElement().remove());
    this.dynamicRails = [];

    filas.forEach((f) => {
      if (f.itens.length === 0) return;
      const rail = new Rail(f.titulo, false);
      rail.setCards(this.mapCards(f.itens));
      this.scrollContainer.appendChild(rail.getElement());
      this.dynamicRails.push(rail);
    });
  }

  private mapCards(items: VODItem[]): CardModel[] {
    return items.map((item) => ({
      id: `destaque_${item.id}`,
      title: item.title,
      subtitle: item.year ? `${item.year} · ${item.isSeries ? 'Série' : 'Filme'}` : (item.isSeries ? 'Série' : 'Filme'),
      image: item.poster,
      badge: item.year || (item.isSeries ? 'SÉRIE' : '4K'),
      badgeColor: item.isSeries ? '#7aa2ff' : '#4fe3d0',
      onClick: () => {
        State.setScreen('ficha', { vod: item });
      },
      onFocus: () => {
        this.heroBanner.update(item);
      },
    }));
  }
}
