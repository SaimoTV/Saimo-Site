/**
 * Ficha Completa de Detalhes de Filmes e Séries (FichaScreen).
 * 100% Idêntica ao FichaActivity.kt do TV Box:
 * - Backdrop de cinema em tela cheia com máscara degradê
 * - Resolução em tempo real de fontes reais via Api.resolveMovieSources / Api.resolveSeriesEpisodes
 * - Metadados do TMDB: nota oficial, sinopse, elenco com fotos redondas
 * - Seletor de Temporadas e trilho de Episódios com fontes prontas para tocar
 */

import { State } from '../core/State';
import { VODItem, Api } from '../core/Api';
import { Storage } from '../core/Storage';
import { SourceModal } from '../components/SourceModal';
import { Rail, CardModel } from '../components/Rail';
import { SpatialNav } from '../core/SpatialNav';

export class FichaScreen {
  private element: HTMLElement;
  private backdropEl: HTMLImageElement;
  private posterEl: HTMLImageElement;
  private titleEl: HTMLElement;
  private badgesContainer: HTMLElement;
  private synopsisEl: HTMLElement;
  private actionsContainer: HTMLElement;
  private seasonsContainer: HTMLElement;
  private episodesRail: Rail;
  private castRail: Rail;
  private similarRail: Rail;
  private sourceModal: SourceModal;

  private currentItem: VODItem | null = null;
  private currentSeasonIdx = 0;

  constructor() {
    this.element = document.createElement('div');
    // `tv-screen`: é por ela que a navegação acha os botões da tela ativa. Sem
    // ela as setas só enxergavam o menu do topo (direita ia para Ao vivo).
    this.element.className = 'tv-screen tv-ficha-screen hidden';
    this.element.id = 'screen-ficha';

    this.backdropEl = document.createElement('img');
    this.backdropEl.className = 'tv-ficha-backdrop';
    this.element.appendChild(this.backdropEl);

    const content = document.createElement('div');
    content.className = 'tv-ficha-content tv-scroll-v';

    const topSection = document.createElement('div');
    topSection.className = 'tv-ficha-top';

    this.posterEl = document.createElement('img');
    this.posterEl.className = 'tv-ficha-poster';
    topSection.appendChild(this.posterEl);

    this.titleEl = document.createElement('div');
    this.titleEl.className = 'tv-ficha-title';

    this.badgesContainer = document.createElement('div');
    this.badgesContainer.className = 'tv-ficha-badges';

    this.synopsisEl = document.createElement('div');
    this.synopsisEl.className = 'tv-ficha-synopsis';

    this.actionsContainer = document.createElement('div');
    this.actionsContainer.className = 'tv-ficha-actions';

    const mainInfo = document.createElement('div');
    mainInfo.className = 'tv-ficha-main';
    mainInfo.appendChild(this.titleEl);
    mainInfo.appendChild(this.badgesContainer);
    mainInfo.appendChild(this.synopsisEl);
    mainInfo.appendChild(this.actionsContainer);

    topSection.appendChild(mainInfo);
    content.appendChild(topSection);

    // Seção de Séries (Temporadas e Episódios)
    this.seasonsContainer = document.createElement('div');
    this.seasonsContainer.className = 'tv-category-chips';
    this.seasonsContainer.style.display = 'none';
    this.seasonsContainer.style.gap = '12px';
    this.seasonsContainer.style.margin = '20px 0 10px';
    content.appendChild(this.seasonsContainer);

    this.episodesRail = new Rail('Episódios', true);
    this.episodesRail.getElement().style.display = 'none';
    content.appendChild(this.episodesRail.getElement());

    // Trilho de Elenco com Fotos
    this.castRail = new Rail('Elenco Principal', false);
    this.castRail.getElement().style.display = 'none';
    content.appendChild(this.castRail.getElement());

    // Trilho de Títulos Parecidos
    this.similarRail = new Rail('Títulos Parecidos', false);
    content.appendChild(this.similarRail.getElement());

    this.element.appendChild(content);

    this.sourceModal = new SourceModal();
    this.element.appendChild(this.sourceModal.getElement());
  }

  getElement(): HTMLElement {
    return this.element;
  }

  async enter() {
    this.element.classList.remove('hidden');
    const vod = State.currentVOD;
    if (!vod) {
      State.setScreen('home');
      return;
    }

    this.currentItem = vod;
    this.currentSeasonIdx = 0;
    State.currentVariantIndex = 0;
    this.sourceModal.close();
    // O título anterior não pode vazar: temporadas, episódios e elenco somem
    // até os dados deste chegarem.
    this.seasonsContainer.innerHTML = '';
    this.seasonsContainer.style.display = 'none';
    this.episodesRail.setCards([]);
    this.episodesRail.getElement().style.display = 'none';
    this.castRail.setCards([]);
    this.castRail.getElement().style.display = 'none';
    this.renderInitialDetails(vod);

    // Foca o botão assistir imediatamente
    setTimeout(() => {
      const playBtn = this.actionsContainer.querySelector<HTMLElement>('#ficha-btn-play');
      if (playBtn) SpatialNav.focus(playBtn);
    }, 50);

    // Resolve metadados TMDB e fontes reais em paralelo
    this.loadFullDetails(vod);
  }

  leave() {
    this.element.classList.add('hidden');
    this.sourceModal.close();
  }

  private renderInitialDetails(item: VODItem) {
    this.titleEl.textContent = item.title;
    this.synopsisEl.textContent =
      item.overview || 'Carregando sinopse e detalhes do título...';

    if (item.poster) {
      this.posterEl.src = item.poster;
      this.backdropEl.src = item.backdrop || item.poster;
      this.posterEl.style.display = 'block';
      this.backdropEl.style.display = 'block';
    }

    this.renderBadges(item);
    this.renderActionButtons(item);
  }

  private renderBadges(item: VODItem) {
    this.badgesContainer.innerHTML = '';
    const addBadge = (text: string, cls = '') => {
      const b = document.createElement('span');
      b.className = `tv-ficha-badge ${cls}`;
      b.textContent = text;
      this.badgesContainer.appendChild(b);
    };

    if (item.isSeries) addBadge('Série', 'cyan');
    else addBadge('Filme', 'cyan');

    if (item.year) addBadge(item.year);
    if (item.rating) addBadge(`★ ${item.rating.toFixed(1)}`, 'rating');
    addBadge('4K UHD');

    if (item.genres && item.genres.length > 0) {
      addBadge(item.genres.slice(0, 3).join(' · '));
    }
  }

  private async loadFullDetails(item: VODItem) {
    // 1. Busca metadados TMDB (sinopse rica, backdrop 1280p, elenco)
    await Api.fetchTMDBDetails(item);
    // Outro título foi aberto enquanto os dados deste chegavam.
    if (this.currentItem !== item) return;
    if (item.backdrop) {
      this.backdropEl.src = item.backdrop;
    }
    if (item.overview) {
      this.synopsisEl.textContent = item.overview;
    }
    this.renderBadges(item);

    // 2. Resolve fontes reais de reprodução
    if (!item.isSeries) {
      const sources = await Api.resolveMovieSources(item);
      item.sources = sources;
      if (this.currentItem !== item) return;
      this.renderActionButtons(item);
    } else {
      await Api.resolveSeriesEpisodes(item);
      if (this.currentItem !== item) return;
      this.renderSeasonsAndEpisodes(item);
    }

    // 3. Renderiza Elenco
    if (item.cast && item.cast.length > 0) {
      this.castRail.getElement().style.display = 'block';
      this.castRail.setCards(
        item.cast.map((c) => ({
          id: `cast_${encodeURIComponent(c.name)}`,
          title: c.name,
          subtitle: c.character,
          image: c.photo,
          onClick: () => {},
        }))
      );
    }

    // 4. Renderiza Parecidos
    this.renderSimilarTitles(item);
    this.ligarNavegacao();
  }

  private renderActionButtons(item: VODItem) {
    this.actionsContainer.innerHTML = '';

    const progress = Storage.getProgress(item.title);
    const hasProgress = progress && progress.position > 30;

    // Botão Assistir
    const playBtn = document.createElement('div');
    playBtn.className = 'tv-btn primary nav-focusable';
    playBtn.setAttribute('data-nav', 'true');
    playBtn.id = 'ficha-btn-play';
    playBtn.innerHTML = hasProgress
      ? `Continuar (${Math.round(progress.position / 60)} min)`
      : 'Assistir';

    playBtn.addEventListener('click', () => {
      State.currentVariantIndex = 0;
      State.setScreen('player', { vod: item });
    });
    this.actionsContainer.appendChild(playBtn);

    // Botão Favoritar
    const favs = Storage.getFavoriteVOD();
    const isFav = favs.has(item.title);

    const favBtn = document.createElement('div');
    favBtn.className = 'tv-btn nav-focusable';
    favBtn.setAttribute('data-nav', 'true');
    favBtn.id = 'ficha-btn-fav';
    favBtn.innerHTML = isFav ? 'Nos favoritos' : 'Favoritar';

    favBtn.addEventListener('click', () => {
      const nowFav = Storage.toggleFavoriteVOD(item.title);
      favBtn.innerHTML = nowFav ? 'Nos favoritos' : 'Favoritar';
    });
    this.actionsContainer.appendChild(favBtn);
    this.ligarNavegacao();

    // Foco no Assistir, a não ser que a pessoa já tenha descido para outra parte da ficha.
    setTimeout(() => {
      const atual = SpatialNav.getCurrent();
      if (!atual || !this.element.contains(atual) || this.actionsContainer.contains(atual) || !document.body.contains(atual)) {
        SpatialNav.focus(playBtn);
      }
    }, 10);
  }

  private renderSeasonsAndEpisodes(item: VODItem) {
    if (!item.seasons || item.seasons.length === 0) return;

    this.seasonsContainer.innerHTML = '';
    this.seasonsContainer.style.display = 'flex';
    this.episodesRail.getElement().style.display = 'block';

    item.seasons.forEach((season, sIdx) => {
      const tab = document.createElement('div');
      tab.className = `tv-btn nav-focusable ${sIdx === this.currentSeasonIdx ? 'primary' : ''}`;
      tab.setAttribute('data-nav', 'true');
      tab.id = `season-tab-${sIdx}`;
      tab.textContent = `Temporada ${season.seasonNumber}`;

      tab.addEventListener('click', () => {
        this.currentSeasonIdx = sIdx;
        this.renderSeasonsAndEpisodes(item);
        // As abas são refeitas: o foco volta para a aba escolhida.
        SpatialNav.focus(this.seasonsContainer.querySelector<HTMLElement>(`#season-tab-${sIdx}`));
      });

      this.seasonsContainer.appendChild(tab);
    });

    const currentSeason = item.seasons[this.currentSeasonIdx];
    const episodeCards: CardModel[] = (currentSeason?.episodes || []).map((ep, epIdx) => ({
      id: `ep_${currentSeason.seasonNumber}_${ep.episodeNumber}`,
      title: `${ep.episodeNumber}. ${ep.title}`,
      subtitle: ep.overview || `Temporada ${currentSeason.seasonNumber}`,
      image: ep.thumb || item.poster,
      onClick: () => {
        State.currentSeasonIndex = this.currentSeasonIdx;
        State.currentEpisodeIndex = epIdx;
        State.setScreen('player', { vod: item });
      },
    }));

    this.episodesRail.setCards(episodeCards);
    this.ligarNavegacao();
  }

  /**
   * Caminho das setas entre as faixas da ficha: botões, temporadas, episódios,
   * elenco e parecidos. A navegação por distância pulava as temporadas e subia
   * do episódio direto para o menu do topo.
   */
  private ligarNavegacao() {
    const visivel = (el: HTMLElement) => el.style.display !== 'none' && el.offsetParent !== null;
    const faixas: HTMLElement[][] = [];
    const botoes = [...this.actionsContainer.querySelectorAll<HTMLElement>('[data-nav="true"]')];
    if (botoes.length) faixas.push(botoes);
    if (visivel(this.seasonsContainer)) {
      const abas = [...this.seasonsContainer.querySelectorAll<HTMLElement>('[data-nav="true"]')];
      if (abas.length) faixas.push(abas);
    }
    for (const rail of [this.episodesRail, this.castRail, this.similarRail]) {
      if (!visivel(rail.getElement())) continue;
      const cards = [...rail.getElement().querySelectorAll<HTMLElement>('[data-nav="true"]')];
      if (cards.length) faixas.push(cards);
    }
    const ancora = (faixa: HTMLElement[]) =>
      faixa.find((el) => el.classList.contains('primary') && el.id.startsWith('season-tab')) || faixa[0];
    faixas.forEach((faixa, i) => {
      const acima = i > 0 ? ancora(faixas[i - 1]) : null;
      const abaixo = i + 1 < faixas.length ? ancora(faixas[i + 1]) : null;
      for (const el of faixa) {
        if (acima) el.setAttribute('data-nav-up', acima.id);
        else el.removeAttribute('data-nav-up');
        if (abaixo) el.setAttribute('data-nav-down', abaixo.id);
        else el.setAttribute('data-nav-down', 'none');
      }
    });
  }

  private renderSimilarTitles(item: VODItem) {
    const similar = State.vodItems
      .filter((v) => v.id !== item.id && v.genres?.some((g) => item.genres?.includes(g)))
      .slice(0, 16);

    if (similar.length === 0) {
      this.similarRail.getElement().style.display = 'none';
      this.ligarNavegacao();
      return;
    }

    this.similarRail.getElement().style.display = 'block';
    const cards: CardModel[] = similar.map((v) => ({
      id: `sim_${v.id}`,
      title: v.title,
      subtitle: v.genres?.slice(0, 2).join(' · '),
      image: v.poster,
      badge: v.year || (v.isSeries ? 'SÉRIE' : '4K'),
      badgeColor: v.isSeries ? '#7aa2ff' : '#4fe3d0',
      onClick: () => {
        State.setScreen('ficha', { vod: v });
      },
    }));

    this.similarRail.setCards(cards);
    this.ligarNavegacao();
  }
}
