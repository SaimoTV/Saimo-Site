/**
 * Busca Global Inteligente (SearchScreen).
 * Teclado virtual integrado otimizado para controle remoto, busca instantânea
 * em tempo real através de canais, filmes, séries e animes sem repaints pesados.
 */

import { State } from '../core/State';
import { Api, Channel, VODItem } from '../core/Api';
import { Addons } from '../core/Addons';
import { VirtualKeyboard } from '../components/VirtualKeyboard';
import { Rail, CardModel } from '../components/Rail';
import { SpatialNav } from '../core/SpatialNav';
import { buscarPessoas, creditosDe } from '../../../src/services/tmdbService';

const RECENTES = 'saimo-buscas-recentes';
const lerRecentes = (): string[] => {
  try { const l = JSON.parse(localStorage.getItem(RECENTES) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
};

function normBusca(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function palavrasPerto(a: string, b: string): boolean {
  if (a === b || a.includes(b)) return true;
  if (b.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  let diffs = 0, i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diffs > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return diffs + (a.length - i) + (b.length - j) <= 1;
}

function casarComTolerancia(tituloNorm: string, queryNorm: string): boolean {
  if (!queryNorm) return false;
  if (tituloNorm.includes(queryNorm)) return true;
  const qWords = queryNorm.split(' ').filter(Boolean);
  if (qWords.length === 0) return false;
  const tWords = tituloNorm.split(' ').filter(Boolean);
  return qWords.every((qw) => tWords.some((tw) => palavrasPerto(tw, qw)));
}

export class SearchScreen {
  private element: HTMLElement;
  private inputDisplay: HTMLElement;
  private keyboard: VirtualKeyboard;
  private resultsContainer: HTMLElement;

  private currentQuery = '';
  private debounceTimer: any = null;
  private searchGen = 0;

  private channelsRail: Rail;
  private vodRail: Rail;
  private pessoasRail: Rail;
  private recentesRail: Rail;
  private pessoasGen = 0;
  private pessoasTimer: any = null;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-search-screen hidden';
    this.element.id = 'screen-search';

    const layout = document.createElement('div');
    layout.className = 'tv-search-layout';

    // Coluna Esquerda: Campo de Busca + Teclado Virtual
    const leftCol = document.createElement('div');
    leftCol.className = 'tv-search-left';

    this.inputDisplay = document.createElement('div');
    this.inputDisplay.className = 'tv-search-input-box';
    this.inputDisplay.innerHTML = `<span id="search-query-text" style="color:rgba(255,255,255,0.5);">Digite para buscar...</span>`;
    leftCol.appendChild(this.inputDisplay);

    this.keyboard = new VirtualKeyboard({
      onKeyInput: (char) => this.appendChar(char),
      onBackspace: () => this.backspace(),
      onClear: () => this.clearQuery(),
      onSearch: () => this.focusResults(),
    });
    leftCol.appendChild(this.keyboard.getElement());

    // Coluna Direita: Trilhos de Resultados
    this.resultsContainer = document.createElement('div');
    this.resultsContainer.className = 'tv-search-right tv-scroll-v';

    this.channelsRail = new Rail('Canais Encontrados', true);
    this.vodRail = new Rail('Filmes & Séries Encontrados', false);

    this.pessoasRail = new Rail('Atores e Diretores', false);
    this.recentesRail = new Rail('Buscas Recentes', false);
    this.resultsContainer.appendChild(this.recentesRail.getElement());
    this.resultsContainer.appendChild(this.channelsRail.getElement());
    this.resultsContainer.appendChild(this.pessoasRail.getElement());
    this.resultsContainer.appendChild(this.vodRail.getElement());

    layout.appendChild(leftCol);
    layout.appendChild(this.resultsContainer);
    this.element.appendChild(layout);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  enter() {
    this.element.classList.remove('hidden');

    if (State.channels.length === 0) {
      State.channels = Api.getCachedChannelsSync();
      if (State.channels.length === 0) {
        Api.fetchChannels().then((c) => { State.channels = c; }).catch(() => {});
      }
    }

    Api.fetchFichas().then((v) => {
      State.vodItems = v;
      if (this.currentQuery.trim()) this.performSearch();
    }).catch(() => {});

    this.mostrarRecentes();
    this.keyboard.focusFirst();
  }

  leave() {
    this.element.classList.add('hidden');
  }

  private appendChar(char: string) {
    this.currentQuery += char;
    this.updateQueryDisplay();
    this.scheduleSearch();
  }

  private backspace() {
    if (this.currentQuery.length > 0) {
      this.currentQuery = this.currentQuery.slice(0, -1);
      this.updateQueryDisplay();
      this.scheduleSearch();
    }
  }

  private clearQuery() {
    this.currentQuery = '';
    this.updateQueryDisplay();
    this.scheduleSearch();
  }

  private updateQueryDisplay() {
    const textEl = this.inputDisplay.querySelector('#search-query-text');
    if (textEl) {
      if (this.currentQuery) {
        textEl.textContent = this.currentQuery;
        (textEl as HTMLElement).style.color = '#ffffff';
      } else {
        textEl.textContent = 'Digite para buscar...';
        (textEl as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
      }
    }
  }

  private scheduleSearch() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.performSearch();
    }, 150);
  }

  private mostrarRecentes() {
    const lista = lerRecentes();
    if (this.currentQuery.trim() || lista.length === 0) {
      this.recentesRail.getElement().style.display = 'none';
      return;
    }
    this.recentesRail.getElement().style.display = 'block';
    this.recentesRail.setCards(lista.map((t, i) => ({
      id: 'search_recent_' + i,
      title: t,
      subtitle: 'Buscar de novo',
      image: '',
      onClick: () => { this.currentQuery = t; this.updateQueryDisplay(); this.scheduleSearch(); },
    })));
  }

  private guardarRecente(q: string) {
    if (q.length < 2) return;
    const nova = [q].concat(lerRecentes().filter((x) => x !== q)).slice(0, 8);
    try { localStorage.setItem(RECENTES, JSON.stringify(nova)); } catch (e) { /* sem espaço */ }
  }

  /** Atores e diretores pelo nome: o que fizeram e existe no acervo (cruza pelo id do TMDB). */
  private buscarPessoasNoAcervo(q: string) {
    clearTimeout(this.pessoasTimer);
    const gen = ++this.pessoasGen;
    if (q.length < 4) { this.pessoasRail.getElement().style.display = 'none'; return; }
    this.pessoasTimer = setTimeout(() => {
      buscarPessoas(q).then((pessoas) => {
        const ids = pessoas.filter((p) => p.area === 'Atuação' || p.area === 'Direção').slice(0, 2);
        return Promise.all(ids.map((p) => creditosDe(p.id)));
      }).then((listas) => {
        if (gen !== this.pessoasGen) return;
        const pool = Api.getSearchPool();
        const porTmdb: { [k: string]: VODItem } = {};
        for (let i = 0; i < pool.length; i++) {
          if (pool[i].tmdbId) porTmdb[(pool[i].isSeries ? 's' : 'f') + pool[i].tmdbId] = pool[i];
        }
        const vistos: { [k: string]: boolean } = {};
        const achados: VODItem[] = [];
        for (let l = 0; l < listas.length; l++) {
          for (let i = 0; i < listas[l].length && achados.length < 25; i++) {
            const c = listas[l][i];
            const item = porTmdb[(c.serie ? 's' : 'f') + c.id];
            if (item && !vistos[item.id]) { vistos[item.id] = true; achados.push(item); }
          }
        }
        if (achados.length === 0) { this.pessoasRail.getElement().style.display = 'none'; return; }
        this.pessoasRail.getElement().style.display = 'block';
        this.pessoasRail.setCards(achados.map((v) => ({
          id: 'search_pessoa_' + v.id,
          title: v.title,
          subtitle: v.genres ? v.genres.slice(0, 2).join(' · ') : '',
          image: v.poster,
          badge: v.year || (v.isSeries ? 'SÉRIE' : ''),
          badgeColor: v.isSeries ? '#7aa2ff' : '#4fe3d0',
          onClick: () => { this.guardarRecente(q); State.setScreen('ficha', { vod: v }); },
        })));
      }).catch(() => {});
    }, 450);
  }

  private performSearch() {
    const q = this.currentQuery.trim().toLowerCase();
    this.mostrarRecentes();
    this.buscarPessoasNoAcervo(q);
    if (!q) {
      this.searchGen++;
      this.pessoasRail.getElement().style.display = 'none';
      this.channelsRail.getElement().style.display = 'none';
      this.vodRail.getElement().style.display = 'none';
      return;
    }

    // Busca Canais
    const matchedChannels = State.channels.filter((c) => c.name.toLowerCase().includes(q));
    if (matchedChannels.length > 0) {
      this.channelsRail.getElement().style.display = 'block';
      this.channelsRail.setCards(
        matchedChannels.slice(0, 15).map((c) => ({
          id: `search_ch_${c.id}`,
          title: c.name,
          subtitle: c.category,
          image: c.logo,
          onClick: () => {
            this.guardarRecente(q);
            State.setScreen('live', { channel: c });
          },
        }))
      );
    } else {
      this.channelsRail.getElement().style.display = 'none';
    }

    // Busca Filmes e Séries usando getSearchPool() com normalização de acentos e tolerância a erro de digitação
    const pool = Api.getSearchPool();
    const qNorm = normBusca(q);
    const matchedVOD: VODItem[] = [];
    const fuzzyVOD: VODItem[] = [];
    const matchedTmdbIds = new Set<string>();
    const seenIds = new Set<string>();

    for (let i = 0; i < pool.length; i++) {
      const v = pool[i];
      const tNorm = normBusca(v.title);
      if (
        tNorm.includes(qNorm) ||
        v.title.toLowerCase().includes(q) ||
        v.genres?.some((g) => normBusca(g).includes(qNorm))
      ) {
        matchedVOD.push(v);
        seenIds.add(v.id);
        if (v.tmdbId) matchedTmdbIds.add(`${v.isSeries ? 's' : 'f'}:${v.tmdbId}`);
        if (matchedVOD.length >= 25) break;
      } else if (fuzzyVOD.length < 25 && casarComTolerancia(tNorm, qNorm)) {
        fuzzyVOD.push(v);
        if (v.tmdbId) matchedTmdbIds.add(`${v.isSeries ? 's' : 'f'}:${v.tmdbId}`);
      }
    }

    for (let i = 0; i < fuzzyVOD.length && matchedVOD.length < 25; i++) {
      if (!seenIds.has(fuzzyVOD[i].id)) {
        seenIds.add(fuzzyVOD[i].id);
        matchedVOD.push(fuzzyVOD[i]);
      }
    }

    if (matchedTmdbIds.size > 0 && matchedVOD.length < 25) {
      for (let i = 0; i < pool.length && matchedVOD.length < 25; i++) {
        const v = pool[i];
        if (v.tmdbId && matchedTmdbIds.has(`${v.isSeries ? 's' : 'f'}:${v.tmdbId}`) && !seenIds.has(v.id)) {
          seenIds.add(v.id);
          matchedVOD.push(v);
        }
      }
    }

    const renderVodMatches = (items: VODItem[]) => {
      if (items.length > 0) {
        this.vodRail.getElement().style.display = 'block';
        this.vodRail.setCards(
          items.slice(0, 25).map((v) => ({
            id: `search_vod_${v.id}`,
            title: v.title,
            subtitle: v.genres?.slice(0, 2).join(' · '),
            image: v.poster,
            badge: v.year || (v.isSeries ? 'SÉRIE' : '4K'),
            badgeColor: v.isSeries ? '#7aa2ff' : '#4fe3d0',
            onClick: () => {
              this.guardarRecente(q);
              State.setScreen('ficha', { vod: v });
            },
          }))
        );
      } else {
        this.vodRail.getElement().style.display = 'none';
      }
    };

    renderVodMatches(matchedVOD);

    const gen = ++this.searchGen;
    if (Addons.hasEnabled() && (!Api.enderecoSaimo('filmes') || matchedVOD.length < 10)) {
      Addons.searchCatalogsAndTmdb(q)
        .then((addonItems) => {
          if (gen !== this.searchGen || !addonItems || addonItems.length === 0) return;
          const combined: VODItem[] = matchedVOD.slice();
          const seen = new Set(combined.map((x) => `${x.title.toLowerCase()}:${Boolean(x.isSeries)}`));
          for (let i = 0; i < addonItems.length && combined.length < 25; i++) {
            const k = `${addonItems[i].title.toLowerCase()}:${Boolean(addonItems[i].isSeries)}`;
            if (!seen.has(k)) {
              seen.add(k);
              combined.push(addonItems[i]);
            }
          }
          renderVodMatches(combined);
        })
        .catch(() => {});
    }
  }

  private focusResults() {
    const firstCard =
      this.channelsRail.getFirstCard() ||
      this.vodRail.getFirstCard();
    if (firstCard) {
      SpatialNav.focus(firstCard);
    }
  }
}
