/**
 * Conector de Dados e Parsers de Alto Desempenho.
 * Lê catalogo.txt, fichas.txt, destaques.txt, indice.txt, fatias por letra, EPG e eventos esportivos.
 * 100% compatível e com resolução fiel idêntica ao SaimoTV-Android (VodFormato, Detalhes, Destaques).
 */

import { Storage } from './Storage';

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

  static getBaseUrl(type: 'canais' | 'filmes'): string {
    const prefs = Storage.getPrefs();
    return type === 'canais' ? prefs.urlCanais : prefs.urlFilmes;
  }

  // ===== CANAIS AO VIVO =====
  static async fetchChannels(forceRefresh = false): Promise<Channel[]> {
    if (!forceRefresh && this.channelsCache.length > 0) {
      return this.channelsCache;
    }

    try {
      const url = `${this.getBaseUrl('canais')}catalogo.txt?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      this.channelsCache = this.parseChannels(text);
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

    return channels;
  }

  // ===== EPG (GUIA DE PROGRAMAÇÃO) =====
  static async fetchEPG(): Promise<void> {
    try {
      const url = `${this.getBaseUrl('canais')}guia.txt?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const text = await res.text();
      this.parseEPG(text);
    } catch (e) {}
  }

  private static parseEPG(text: string) {
    const lines = text.split('\n');
    const now = Date.now();
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length < 4) continue;
      const channelName = parts[0].trim();
      const start = new Date(parseInt(parts[1]) * 1000);
      const stop = new Date(parseInt(parts[2]) * 1000);
      const title = parts[3].trim();

      const durationMs = stop.getTime() - start.getTime();
      const remainingMs = stop.getTime() - now;
      const progress = Math.max(0, Math.min(1, (now - start.getTime()) / durationMs));

      const prog: EpgProgram = {
        title,
        start,
        stop,
        durationMin: Math.round(durationMs / 60000),
        remainingMin: Math.max(0, Math.round(remainingMs / 60000)),
        progress,
      };

      if (!this.epgCache.has(channelName)) {
        this.epgCache.set(channelName, []);
      }
      this.epgCache.get(channelName)!.push(prog);
    }
  }

  static getNowNext(channelName: string): { current?: EpgProgram; next?: EpgProgram } {
    const list = this.epgCache.get(channelName);
    if (!list || list.length === 0) return {};
    const now = Date.now();
    const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());

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
  static async fetchDestaques(): Promise<DestaqueFila[]> {
    if (this.destaquesCache.length > 0) return this.destaquesCache;
    try {
      const url = `${this.getBaseUrl('filmes')}destaques.txt?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) return [];
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

      this.destaquesCache = filas;
      return filas;
    } catch (e) {
      console.warn('[SaimoTV] Falha ao carregar destaques.txt:', e);
      return [];
    }
  }

  // ===== FICHAS DO ACERVO COMPLETO =====
  static async fetchFichas(): Promise<VODItem[]> {
    if (this.vodCache.length > 0) return this.vodCache;
    try {
      const url = `${this.getBaseUrl('filmes')}fichas.txt?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const text = await res.text();
      const items: VODItem[] = [];
      const lines = text.split('\n');

      for (const line of lines) {
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
      const url = 'https://embedtv.cc/api/jogos.php';
      const res = await fetch(url);
      if (!res.ok) return [];
      const json = await res.json();
      if (!Array.isArray(json)) return [];

      return json.map((j: any) => ({
        id: `jogo_${j.id || Math.random()}`,
        homeTeam: j.time1 || j.casa || 'Time Casa',
        awayTeam: j.time2 || j.fora || 'Time Fora',
        homeShield: j.logo1 || j.escudo1 || '',
        awayShield: j.logo2 || j.escudo2 || '',
        league: j.campeonato || j.liga || 'Futebol',
        startTime: j.data ? new Date(j.data).getTime() : Date.now(),
        channelName: j.canal || '',
        score: j.placar || '',
        matchTime: j.tempo || '',
        isLive: Boolean(j.ao_vivo || j.vivo),
      }));
    } catch (e) {
      return [];
    }
  }

  // ===== RÁDIOS =====
  static async fetchRadios(): Promise<RadioStation[]> {
    try {
      const url = `${this.getBaseUrl('canais')}radios.txt?t=${Date.now()}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const text = await res.text();
      const radios: RadioStation[] = [];

      for (const line of text.split('\n')) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          radios.push({
            name: parts[0].trim(),
            url: parts[1].trim(),
            logo: parts[2]?.trim() || '',
            genre: parts[3]?.trim() || 'Geral',
          });
        }
      }
      return radios;
    } catch (e) {
      return [];
    }
  }
}
