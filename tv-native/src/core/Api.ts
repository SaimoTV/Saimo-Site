/**
 * Conector de Dados e Parsers de Alto Desempenho.
 * Lê catalogo.txt, fichas.txt, destaques.txt, indice.txt, fatias por letra, EPG e eventos esportivos.
 * 100% compatível e com resolução fiel idêntica ao SaimoTV-Android (VodFormato, Detalhes, Destaques).
 */

import { Storage } from './Storage';
import { MinhasListas } from './MinhasListas';

export interface ChannelVariant {
  url: string;
  quality?: string;
  referer?: string;
  userAgent?: string;
  clearKey?: string;
}

export interface Channel {
  id: string;
  number: number;
  name: string;
  category: string;
  logo: string;
  variants: ChannelVariant[];
}

export interface EpgProgram {
  title: string;
  start: Date;
  stop: Date;
  durationMin: number;
  remainingMin: number;
  progress: number; // 0 a 1
}

/** Ano, nota (0 a 10), idade (0 = Livre, -1 = não informada) e popularidade. */
export interface Detalhe {
  ano: number;
  nota: number;
  idade: number;
  popularidade: number;
}

export interface VODItem {
  id: string;
  title: string;
  letra?: string;
  isSeries: boolean;
  tmdbId?: number;
  poster: string;
  genres: string[];
  year?: string;
  sources?: string[];
  overview?: string;
  rating?: number;
  duration?: string;
  backdrop?: string;
  trailer?: string;
  cast?: { name: string; character: string; photo?: string }[];
  seasons?: {
    seasonNumber: number;
    episodes: {
      episodeNumber: number;
      title: string;
      sources: string[];
      thumb?: string;
      overview?: string;
    }[];
  }[];
}

export interface DestaqueFila {
  titulo: string;
  itens: VODItem[];
}

export interface SportsEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeShield: string;
  awayShield: string;
  league: string;
  leagueLogo?: string;
  startTime: number;
  channelName: string;
  channelId?: string;
  score?: string;
  matchTime?: string;
  isLive: boolean;
}

export interface RadioStation {
  name: string;
  url: string;
  logo: string;
  genre: string;
}

export class Api {
  private static TMDB_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
  private static TMDB_BASE = 'https://api.themoviedb.org/3';

  private static channelsCache: Channel[] = [];
  private static epgCache: Map<string, EpgProgram[]> = new Map();
  private static vodCache: VODItem[] = [];
  private static destaquesCache: DestaqueFila[] = [];
  private static basesCache: string[] = [];
  private static fichasMap: Map<string, { tmdbId?: number; poster?: string; genres: string[] }> = new Map();

  /** Sem endereço, os pedidos falham na hora (".invalid" nunca resolve) e as telas ficam vazias. */
  private static readonly SEM_ENDERECO = 'https://sem-lista.invalid/';

  /** O endereço (no formato do Saimo) que a pessoa informou, ou '' se não há. */
  static enderecoSaimo(type: 'canais' | 'filmes'): string {
    const prefs = Storage.getPrefs();
    return ((type === 'canais' ? prefs.urlCanais : prefs.urlFilmes) || '').trim();
  }

  static getBaseUrl(type: 'canais' | 'filmes'): string {
    return this.enderecoSaimo(type) || this.SEM_ENDERECO;
  }

  /** Ainda não há lista nenhuma: nem endereço do Saimo, nem lista da própria pessoa. */
  static semListas(): boolean {
    return !this.enderecoSaimo('canais') && !this.enderecoSaimo('filmes') && MinhasListas.listas().length === 0;
  }

  // ===== CANAIS AO VIVO =====
  static getCachedChannelsSync(): Channel[] {
    if (this.channelsCache.length > 0) return this.channelsCache;
    const cached = Storage.getCachedChannels();
    if (cached && cached.length > 0) {
      this.channelsCache = cached;
      return cached;
    }
    return [];
  }

  static async fetchChannels(forceRefresh = false): Promise<Channel[]> {
    if (!forceRefresh && this.channelsCache.length > 0) {
      return this.channelsCache;
    }

    // Se temos em cache local, popula imediatamente para a UI não esperar
    const cached = Storage.getCachedChannels();
    if (cached && cached.length > 0 && this.channelsCache.length === 0) {
      this.channelsCache = cached;
    }

    // Sem endereço do Saimo: os canais são só os das listas da própria pessoa.
    if (!this.enderecoSaimo('canais')) {
      const minhas = await MinhasListas.canais().catch(() => []);
      minhas.forEach((c, i) => { c.number = i + 1; });
      this.channelsCache = minhas;
      return this.channelsCache;
    }

    try {
      const url = `${this.getBaseUrl('canais')}catalogo.txt`;
      const res = await fetch(url, { cache: 'default' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = this.parseChannels(text);
      if (parsed.length > 0) {
        Storage.setCachedChannels(parsed);
        const minhas = await MinhasListas.canais().catch(() => []);
        let n = parsed.length;
        minhas.forEach((c) => { c.number = ++n; });
        this.channelsCache = parsed.concat(minhas);
      }
      return this.channelsCache;
    } catch (e) {
      console.warn('[SaimoTV] Falha ao baixar catálogo de canais:', e);
      return this.channelsCache;
    }
  }

  private static parseChannels(text: string): Channel[] {
    const lines = text.split('\n');
    const channels: Channel[] = [];
    let current: Partial<Channel> | null = null;
    let currentVariant: Partial<ChannelVariant> | null = null;
    let channelNumber = 1;

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const key = line.substring(0, colonIdx).trim().toLowerCase();
      const val = line.substring(colonIdx + 1).trim();

      if (key === 'canal') {
        if (current && current.name && current.variants && current.variants.length > 0) {
          channels.push(current as Channel);
        }
        current = {
          id: `ch_${channelNumber}`,
          number: channelNumber++,
          name: val,
          category: 'Variedades',
          logo: '',
          variants: [],
        };
        currentVariant = null;
      } else if (current) {
        if (key === 'categoria') {
          current.category = val;
        } else if (key === 'logo') {
          current.logo = val;
        } else if (key === 'fonte') {
          currentVariant = { url: val };
          current.variants!.push(currentVariant as ChannelVariant);
        } else if (currentVariant) {
          if (key === 'qualidade') currentVariant.quality = val;
          else if (key === 'referer') currentVariant.referer = val;
          else if (key === 'agente') currentVariant.userAgent = val;
          else if (key === 'chave') currentVariant.clearKey = val;
        }
      }
    }

    if (current && current.name && current.variants && current.variants.length > 0) {
      channels.push(current as Channel);
    }

    // Mesma ordem de seções da TV Box; o número segue essa ordem.
    const ordem = ['TV Aberta', 'Filmes e Séries', 'Esportes', 'Notícias', 'Infantil', 'Documentários', 'Pluto TV', '24 Horas', 'Variedades'];
    const peso = (c: Channel) => { const i = ordem.indexOf(c.category); return i < 0 ? ordem.length : i; };
    channels.sort((a, b) => peso(a) - peso(b) || a.number - b.number);
    channels.forEach((c, i) => { c.number = i + 1; });
    return channels;
  }

  // ===== EPG (GUIA DE PROGRAMAÇÃO) =====
  // guia.txt diz o código de cada canal no meuguia.tv; a página do canal traz a programação.
  private static epgCarregando = false;

  static async fetchEPG(): Promise<void> {
    if (this.epgCarregando) return;
    this.epgCarregando = true;
    try {
      const res = await fetch(`${this.getBaseUrl('canais')}guia.txt`);
      if (!res.ok) return;
      const fila = (await res.text()).split('\n')
        .map((l) => l.trim().split('\t'))
        .filter((p) => p[0] === 'meuguia' && p.length >= 3);
      const trabalhador = async () => {
        for (let item = fila.shift(); item; item = fila.shift()) {
          try {
            const r = await fetch(`https://meuguia.tv/programacao/canal/${item[2]}`);
            if (r.ok) this.epgCache.set(item[1], this.lerMeuGuia(await r.text()));
          } catch { /* canal fica sem guia */ }
        }
      };
      // Poucas ao mesmo tempo: TV fraca e rede de casa.
      await Promise.all([trabalhador(), trabalhador(), trabalhador(), trabalhador()]);
    } catch { /* sem guia */ } finally {
      this.epgCarregando = false;
    }
  }

  /** Itens <li>: cabeçalho do dia e programas; o fim de um é o início do seguinte. Hora de Brasília. */
  private static lerMeuGuia(html: string): EpgProgram[] {
    const hoje = new Date(Date.now() - 3 * 3600 * 1000);
    let ano = hoje.getUTCFullYear();
    let mes = hoje.getUTCMonth() + 1;
    let dia = hoje.getUTCDate();
    const lista: { title: string; start: number }[] = [];
    for (const item of html.split('<li')) {
      if (item.includes('subheader')) {
        const d = /,\s*(\d+)\/(\d+)/.exec(item);
        if (d) { dia = +d[1]; mes = +d[2]; }
        continue;
      }
      const hora = /lileft time['"]>\s*(\d+):(\d+)/.exec(item);
      const titulo = /<h2>([^<]*)<\/h2>/.exec(item);
      if (!hora || !titulo) continue;
      const t = document.createElement('textarea');
      t.innerHTML = titulo[1];
      lista.push({ title: t.value.trim(), start: Date.UTC(ano, mes - 1, dia, +hora[1] + 3, +hora[2]) });
    }
    const agora = Date.now();
    return lista.map((p, i) => {
      const stop = i + 1 < lista.length ? lista[i + 1].start : p.start + 3600000;
      return { title: p.title, start: new Date(p.start), stop: new Date(stop), durationMin: Math.round((stop - p.start) / 60000), remainingMin: 0, progress: 0 };
    }).filter((p) => p.stop.getTime() > agora).slice(0, 12);
  }

  static getNowNext(channelName: string): { current?: EpgProgram; next?: EpgProgram } {
    const list = this.epgCache.get(channelName);
    if (!list || list.length === 0) return {};
    const now = Date.now();
    const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());
    for (const p of sorted) {
      const total = p.stop.getTime() - p.start.getTime();
      p.remainingMin = Math.max(0, Math.round((p.stop.getTime() - now) / 60000));
      p.progress = Math.max(0, Math.min(1, (now - p.start.getTime()) / total));
    }

    const currentIdx = sorted.findIndex((p) => now >= p.start.getTime() && now < p.stop.getTime());
    if (currentIdx !== -1) {
      return {
        current: sorted[currentIdx],
        next: sorted[currentIdx + 1],
      };
    }
    return {};
  }

  // ===== BASES DE VOD (INDICE.TXT) =====
  static async fetchBases(): Promise<string[]> {
    if (this.basesCache.length > 0) return this.basesCache;
    try {
      const url = `${this.getBaseUrl('filmes')}indice.txt?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const text = await res.text();
      const bases: string[] = [];

      for (const line of text.split('\n')) {
        if (line.startsWith('base:')) {
          const parts = line.substring(5).trim().split(' ');
          if (parts.length >= 2) {
            const idx = parseInt(parts[0], 10);
            const baseUri = parts[1].trim();
            bases[idx] = baseUri;
          }
        }
      }
      this.basesCache = bases;
      return bases;
    } catch (e) {
      return [];
    }
  }

  static montarUrl(valor: string, bases: string[]): string {
    const item = valor.trim();
    if (item.startsWith('https://') || item.startsWith('http://')) return item;
    const corte = item.indexOf(':');
    if (corte <= 0 || corte === item.length - 1) return '';
    const indice = parseInt(item.slice(0, corte), 10);
    if (isNaN(indice)) return '';
    const base = bases[indice];
    if (!base) return '';
    const resto = item.slice(corte + 1);
    return resto.includes('.') ? base + resto : `${base}${resto}.mp4`;
  }

  // ===== DESTAQUES DA TELA INICIAL (DESTAQUES.TXT) =====
  static getCachedDestaquesSync(): DestaqueFila[] {
    if (this.destaquesCache.length > 0) return this.destaquesCache;
    const cached = Storage.getCachedDestaques();
    if (cached && cached.length > 0) {
      this.destaquesCache = cached;
      return cached;
    }
    return [];
  }

  static async fetchDestaques(forceRefresh = false): Promise<DestaqueFila[]> {
    if (!forceRefresh && this.destaquesCache.length > 0) return this.destaquesCache;

    const cached = Storage.getCachedDestaques();
    if (cached && cached.length > 0 && this.destaquesCache.length === 0) {
      this.destaquesCache = cached;
    }

    try {
      const url = `${this.getBaseUrl('filmes')}destaques.txt`;
      const res = await fetch(url, { cache: 'default' });
      if (!res.ok) return this.destaquesCache;
      const text = await res.text();

      const filas: DestaqueFila[] = [];
      let currentFila: DestaqueFila | null = null;
      let baseCapa = 'https://image.tmdb.org/t/p/w342';

      for (let line of text.split('\n')) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;

        if (line.startsWith('capa:')) {
          baseCapa = line.substring(5).trim();
        } else if (line.startsWith('fila\t')) {
          const nomeFila = line.substring(5).trim();
          currentFila = { titulo: nomeFila, itens: [] };
          filas.push(currentFila);
        } else if (currentFila) {
          const cols = line.split('\t');
          if (cols.length < 3) continue;
          const tipo = cols[0].trim();
          const titulo = cols[1].trim();
          const letra = cols[2].trim();
          const ano = cols[3]?.trim() || '';
          const posterRel = cols[4]?.trim() || '';
          const trailer = cols[5]?.trim() || '';
          const isSeries = tipo !== 'f';

          const poster = posterRel ? (posterRel.startsWith('http') ? posterRel : `${baseCapa}${posterRel}`) : '';

          currentFila.itens.push({
            id: `${tipo}_${titulo}`,
            title: titulo,
            letra,
            isSeries,
            year: ano,
            poster,
            trailer,
            genres: [isSeries ? 'Série' : 'Filme'],
          });
        }
      }

      if (filas.length > 0) {
        this.destaquesCache = filas;
        Storage.setCachedDestaques(filas);
      }
      return this.destaquesCache;
    } catch (e) {
      console.warn('[SaimoTV] Falha ao carregar destaques.txt:', e);
      return this.destaquesCache;
    }
  }

  // ===== DETALHES (FILTROS DO ON DEMAND) =====
  // Ano, nota, classificação indicativa e popularidade de cada título
  // (detalhes.txt, gerado do TMDB). Chave: "f|título" ou "s|título".
  private static detalhesMap: Map<string, Detalhe> | null = null;
  private static detalhesPedido: Promise<Map<string, Detalhe>> | null = null;

  static detalhesProntos(): boolean {
    return !!this.detalhesMap && this.detalhesMap.size > 0;
  }

  static detalheDe(item: VODItem): Detalhe | undefined {
    const m = this.detalhesMap;
    if (!m) return undefined;
    const k = item.isSeries ? 's|' : 'f|';
    return m.get(k + item.title) || m.get(k + item.title.replace(/\s*\(\d{4}\)\s*$/, ''));
  }

  static fetchDetalhes(): Promise<Map<string, Detalhe>> {
    if (this.detalhesMap) return Promise.resolve(this.detalhesMap);
    if (this.detalhesPedido) return this.detalhesPedido;
    this.detalhesPedido = fetch(`${this.getBaseUrl('filmes')}detalhes.txt`, { cache: 'default' })
      .then((r) => (r.ok ? r.text() : ''))
      .then((texto) => {
        const mapa = new Map<string, Detalhe>();
        for (const linha of texto.split('\n')) {
          if (!linha || linha[0] === '#') continue;
          const c = linha.split('\t');
          if (c.length < 6) continue;
          const idade = c[4] === 'L' ? 0 : c[4] ? parseInt(c[4], 10) : -1;
          mapa.set(`${c[0]}|${c[1]}`, {
            ano: parseInt(c[2], 10) || 0,
            nota: parseFloat(c[3]) || 0,
            idade: isNaN(idade) ? -1 : idade,
            popularidade: parseInt(c[5], 10) || 0,
          });
        }
        this.detalhesMap = mapa;
        return mapa;
      })
      .catch(() => new Map<string, Detalhe>())
      .finally(() => { this.detalhesPedido = null; });
    return this.detalhesPedido;
  }

  // ===== FICHAS DO ACERVO COMPLETO =====
  static async fetchFichas(): Promise<VODItem[]> {
    if (this.vodCache.length > 0) return this.vodCache;
    try {
      const url = `${this.getBaseUrl('filmes')}fichas.txt`;
      const res = await fetch(url, { cache: 'default' });
      if (!res.ok) return [];
      const text = await res.text();
      const items: VODItem[] = [];
      const lines = text.split('\n');

      for (const line of lines) {
        if (!line || line[0] === '#' || line.startsWith('capa:')) continue;
        const p = line.split('\t');
        if (p.length < 5) continue;
        const isSeries = p[0] === 's';
        const title = p[1].trim();
        const tmdbId = parseInt(p[2]) || undefined;
        let poster = p[3].trim();
        if (poster && !poster.startsWith('http')) {
          poster = `https://image.tmdb.org/t/p/w500${poster}`;
        }
        const genres = p[4].split(',').map((g) => g.trim());

        // Extrai a letra do título
        const primeiraLetra = title.charAt(0).toUpperCase();
        const letra = /[A-Z]/.test(primeiraLetra) ? primeiraLetra : '#';

        const item: VODItem = {
          id: `${isSeries ? 's' : 'f'}_${title}`,
          title,
          letra,
          isSeries,
          tmdbId,
          poster,
          genres,
        };

        items.push(item);
        this.fichasMap.set(title, { tmdbId, poster, genres });
      }
      this.vodCache = items;
      return items;
    } catch (e) {
      return [];
    }
  }

  static getDestaquesFlat(): VODItem[] {
    const filas = this.getCachedDestaquesSync();
    const map = new Map<string, VODItem>();
    for (const f of filas) {
      for (const item of f.itens) {
        if (!map.has(item.title)) {
          map.set(item.title, item);
        }
      }
    }
    return Array.from(map.values());
  }

  static getSearchPool(): VODItem[] {
    if (this.vodCache.length > 0) return this.vodCache;
    return this.getDestaquesFlat();
  }

  // ===== RESOLUÇÃO REAL DE FONTES DE FILME =====
  static async resolveMovieSources(item: VODItem): Promise<string[]> {
    if (item.sources && item.sources.length > 0) return item.sources;

    const bases = await this.fetchBases();
    const letra = item.letra || item.title.charAt(0).toUpperCase();
    const gaveta = /[A-Z]/.test(letra) ? letra : '#';

    try {
      const url = `${this.getBaseUrl('filmes')}filmes-${gaveta}.txt?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const text = await res.text();

      for (const line of text.split('\n')) {
        const p = line.split('\t');
        if (p.length < 2) continue;
        const titulo = p[0].trim();

        if (titulo === item.title || titulo.startsWith(item.title)) {
          const sources: string[] = [];

          for (let i = 1; i < p.length; i++) {
            const campo = p[i].trim();
            const eqIdx = campo.indexOf('=');
            if (eqIdx > 0) {
              const urlsRaw = campo.substring(eqIdx + 1).split(',');
              for (const u of urlsRaw) {
                const finalUrl = this.montarUrl(u, bases);
                if (finalUrl) sources.push(finalUrl);
              }
            }
          }

          item.sources = sources;
          return sources;
        }
      }
    } catch (e) {
      console.warn(`[SaimoTV] Falha ao resolver fontes do filme ${item.title}:`, e);
    }

    return item.sources || [];
  }

  // ===== RESOLUÇÃO REAL DE EPISÓDIOS DE SÉRIES =====
  static async resolveSeriesEpisodes(item: VODItem): Promise<void> {
    if (item.seasons && item.seasons.length > 0) return;

    const bases = await this.fetchBases();
    const letra = item.letra || item.title.charAt(0).toUpperCase();
    const gaveta = /[A-Z]/.test(letra) ? letra : '#';

    try {
      // 1. Descobre o pedaço da série em series-{gaveta}.txt
      const indexUrl = `${this.getBaseUrl('filmes')}series-${gaveta}.txt?t=${Date.now()}`;
      const indexRes = await fetch(indexUrl);
      if (!indexRes.ok) return;
      const indexText = await indexRes.text();

      let pedaco = 0;
      for (const line of indexText.split('\n')) {
        const parts = line.split('\t');
        if (parts.length >= 3 && parts[0].trim() === item.title) {
          pedaco = parseInt(parts[2].trim(), 10) || 0;
          break;
        }
      }

      // 2. Baixa o pedaço series-{gaveta}-{pedaco}.txt
      const sliceUrl = `${this.getBaseUrl('filmes')}series-${gaveta}-${pedaco}.txt?t=${Date.now()}`;
      const sliceRes = await fetch(sliceUrl);
      if (!sliceRes.ok) return;
      const sliceText = await sliceRes.text();

      const seasonsMap = new Map<number, Map<number, { title: string; sources: string[] }>>();
      let dentroDaSerie = false;

      for (const line of sliceText.split('\n')) {
        if (line.startsWith('@')) {
          if (dentroDaSerie) break;
          const identity = line.substring(1).split('\t')[0].trim();
          if (identity === item.title) {
            dentroDaSerie = true;
          }
          continue;
        }

        if (!dentroDaSerie) continue;

        const cols = line.split('\t');
        if (cols.length < 4) continue;

        const temporadaNum = parseInt(cols[0].trim(), 10) || 1;
        const episodioNum = parseInt(cols[1].trim(), 10) || 1;
        const urlsRaw = cols[3].split(',');
        const urls: string[] = [];

        for (const u of urlsRaw) {
          const finalUrl = this.montarUrl(u, bases);
          if (finalUrl) urls.push(finalUrl);
        }

        if (!seasonsMap.has(temporadaNum)) {
          seasonsMap.set(temporadaNum, new Map());
        }

        if (!seasonsMap.get(temporadaNum)!.has(episodioNum)) {
          seasonsMap.get(temporadaNum)!.set(episodioNum, {
            title: `Episódio ${episodioNum}`,
            sources: urls,
          });
        } else {
          seasonsMap.get(temporadaNum)!.get(episodioNum)!.sources.push(...urls);
        }
      }

      const seasonsResult: any[] = [];
      seasonsMap.forEach((epsMap, seasonNum) => {
        const episodesList: any[] = [];
        epsMap.forEach((epData, epNum) => {
          episodesList.push({
            episodeNumber: epNum,
            title: epData.title,
            sources: epData.sources,
          });
        });
        episodesList.sort((a, b) => a.episodeNumber - b.episodeNumber);
        seasonsResult.push({
          seasonNumber: seasonNum,
          episodes: episodesList,
        });
      });

      seasonsResult.sort((a, b) => a.seasonNumber - b.seasonNumber);
      item.seasons = seasonsResult;
    } catch (e) {
      console.warn(`[SaimoTV] Falha ao resolver episódios de ${item.title}:`, e);
    }
  }

  // ===== ENRIQUECIMENTO TMDB (SINOPSE, BACKDROP, ELENCO) =====
  static async fetchTMDBDetails(item: VODItem): Promise<void> {
    const ficha = this.fichasMap.get(item.title);
    if (ficha?.tmdbId) item.tmdbId = ficha.tmdbId;

    if (!item.tmdbId) return;

    try {
      const type = item.isSeries ? 'tv' : 'movie';
      const url = `${this.TMDB_BASE}/${type}/${item.tmdbId}?api_key=${this.TMDB_KEY}&language=pt-BR&append_to_response=credits`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();

      item.overview = data.overview || item.overview;
      item.rating = data.vote_average || item.rating;

      if (data.backdrop_path) {
        item.backdrop = `https://image.tmdb.org/t/p/w1280${data.backdrop_path}`;
      }
      if (data.poster_path && !item.poster) {
        item.poster = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
      }

      if (data.genres && Array.isArray(data.genres)) {
        item.genres = data.genres.map((g: any) => g.name);
      }

      if (data.credits?.cast && Array.isArray(data.credits.cast)) {
        item.cast = data.credits.cast.slice(0, 15).map((c: any) => ({
          name: c.name,
          character: c.character,
          photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : undefined,
        }));
      }
    } catch (e) {}
  }

  // ===== EVENTOS ESPORTIVOS =====
  static async fetchSportsEvents(): Promise<SportsEvent[]> {
    try {
      // Agenda do Saimo (nenhum site de streaming de terceiros é consultado).
      const res = await fetch('https://saimo-tv.pages.dev/eventos-extra.json');
      if (!res.ok) return [];
      const json = await res.json();
      if (!Array.isArray(json)) return [];
      const agora = Date.now();
      const limpar = (t: string) =>
        t
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/\b(fhd|uhd|4k|hd|sd|h265|hevc|br|pt|tv)\b/g, '')
          .replace(/[^a-z0-9]/g, '');
      const canais = await this.fetchChannels();
      const grande = (u: string) => (u || '').replace('w_34,h_34', 'w_256,h_256');
      const saida: SportsEvent[] = [];
      for (const j of json) {
        if (!j.teams) continue;
        const players = Array.isArray(j.players) ? j.players : [];
        let canal: Channel | undefined;
        for (const p of players) {
          const apelido = limpar(String(p || '').split('/').pop() || '');
          if (!apelido) continue;
          canal =
            canais.find((c) => limpar(c.name) === apelido) ||
            canais.find((c) => limpar(c.name).includes(apelido));
          if (canal) break;
        }
        const inicio = new Date(j.time_start).getTime();
        const fim = j.time_end ? new Date(j.time_end).getTime() : inicio + 7200000;
        if (fim <= agora) continue;
        saida.push({
          id: `jogo_${j.id}`,
          homeTeam: j.teams.home.name,
          awayTeam: j.teams.away.name,
          homeShield: grande(j.teams.home.image),
          awayShield: grande(j.teams.away.image),
          league: j.league?.name || '',
          startTime: inicio,
          channelName: canal ? canal.name : '',
          isLive: agora >= inicio,
        });
      }
      return saida.sort((a, b) => a.startTime - b.startTime);
    } catch (e) {
      return [];
    }
  }

  /** Mesmos estilos da TV Box: rádio que cabe em dois fica no primeiro. */
  private static estiloDaRadio(nome: string): string {
    const n = `${nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()} `;
    const estilos: [string, string[]][] = [
      ['Rock', ['rock', 'metal', 'kiss', 'punk']],
      ['Notícias e esporte', ['news', 'noticia', 'cbn', 'gaucha', 'itatiaia', 'tupi', 'esporte', 'jornal', 'bandnews', 'radio globo', 'eldorado', 'bandeirantes']],
      ['Gospel e católicas', ['gospel', 'evangel', 'catolic', 'crista', 'louvor', 'aleluia', 'cancao nova', 'novo tempo', 'aparecida', 'fe ', 'deus', 'jesus', 'igreja', 'biblia']],
      ['Pop e hits', ['pop', 'hits', 'dance', 'mix', 'jovem pan', 'transamerica', 'energia', 'eletro', 'club', 'pulse', 'top']],
      ['Sertanejo, MPB e samba', ['sertanej', 'mpb', 'samba', 'pagode', 'forro', 'nativa', 'caipira', 'brega', 'axe', 'piseiro', 'moda de viola']],
      ['Clássica e jazz', ['classic', 'jazz', 'cultura', 'educativa', 'universit', 'instrumental', 'blues', 'lounge']],
    ];
    const achado = estilos.find(([, palavras]) => palavras.some((p) => n.includes(p)));
    return achado ? achado[0] : 'Outras';
  }

  static async fetchRadios(): Promise<RadioStation[]> {
    try {
      const url = `${this.getBaseUrl('canais')}radios.txt?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const text = await res.text();
      const radios: RadioStation[] = [];

      for (const line of text.split('\n')) {
        if (!line.trim() || line.startsWith('#')) continue;
        const parts = line.split('|');
        if (parts.length >= 2) {
          radios.push({ name: parts[0].trim(), url: parts[1].trim(), logo: parts[2]?.trim() || '', genre: this.estiloDaRadio(parts[0]) });
        }
      }
      return radios;
    } catch (e) {
      return [];
    }
  }
}
