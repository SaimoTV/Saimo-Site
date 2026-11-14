/**
 * Cliente compartilhado de Addons Stremio, Bridge TMDB <-> IMDb e Sync (`{t: "dados"}`).
 *
 * ES5-safe (compatível com Chromium 38+ via Babel/tv_es5 e Node) e compartilhado entre
 * Web (`src/services/addons.ts`) e Smart TV nativa (`tv-native/src/core/Addons.ts`).
 */

import {
  SAIMO_ADDONS_KEY,
  SAIMO_DEBRID_KEY,
  SAIMO_IMDB_CACHE_KEY,
  addonSupportsResource,
  applyDadosSyncMerge,
  buildAddonEndpointUrl,
  buildDadosSyncExport,
  buildStremioMediaId,
  normalizeAddonUrl,
  parseStremioManifest,
  type AddonRecord,
  type DadosSyncPayload,
  type DebridAccountConfig,
  type StremioManifest,
  type StremioMeta,
  type StremioMetaPreview,
  type StremioStream,
  type StremioSubtitle,
} from './addonProtocol.ts';

export const TMDB_CLIENT_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';
export const TMDB_CLIENT_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG_W500 = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';

export interface TmdbDiscoveryItem {
  tmdbId: number;
  imdbId?: string;
  type: 'movie' | 'series';
  title: string;
  year: string;
  poster: string;
  backdrop: string;
  overview: string;
  rating: number;
}

export interface TmdbDiscoveryRail {
  id: string;
  title: string;
  type: 'movie' | 'series' | 'mixed';
  items: TmdbDiscoveryItem[];
}

export interface TmdbBridgeMatch {
  tmdbId: number;
  imdbId?: string;
  type: 'movie' | 'series';
  title: string;
  year: string;
  poster: string;
  backdrop: string;
  overview: string;
  rating: number;
}

export interface AddonStreamEntry {
  addon: AddonRecord;
  stream: StremioStream;
}

export interface AddonSubtitleEntry {
  addon: AddonRecord;
  subtitle: StremioSubtitle;
}

export interface AddonInstallResult {
  ok: boolean;
  addon?: AddonRecord;
  error?: string;
}

export interface AddonTestResult {
  ok: boolean;
  latencyMs?: number;
  manifest?: StremioManifest;
  error?: string;
}

interface ImdbCacheState {
  tmdbToImdb: Record<string, string>;
  imdbToTmdb: Record<string, TmdbBridgeMatch>;
  order: string[];
}

const MAX_IMDB_CACHE = 400;
let memoryImdbCache: ImdbCacheState | null = null;
let discoveryPromise: Promise<TmdbDiscoveryRail[]> | null = null;
let discoveryTimestamp = 0;
const DISCOVERY_TTL_MS = 10 * 60 * 1000;

export function loadAddonsFromStorage(): AddonRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SAIMO_ADDONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is AddonRecord => Boolean(item && typeof item === 'object' && item.manifest && item.baseUrl))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch {
    return [];
  }
}

export function saveAddonsToStorage(addons: AddonRecord[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAIMO_ADDONS_KEY, JSON.stringify(addons));
    }
  } catch {
    /* armazenamento indisponível */
  }
}

export function loadDebridFromStorage(): DebridAccountConfig[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(SAIMO_DEBRID_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DebridAccountConfig[]) : [];
  } catch {
    return [];
  }
}

export function saveDebridToStorage(accounts: DebridAccountConfig[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAIMO_DEBRID_KEY, JSON.stringify(accounts));
    }
  } catch {
    /* armazenamento indisponível */
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 10000): Promise<{ ok: boolean; status: number; data: unknown; corsOrNetError?: boolean }> {
  const hasAbort = typeof AbortController === 'function';
  const ctrl = hasAbort ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const init: RequestInit = { cache: 'no-store' };
    if (ctrl) init.signal = ctrl.signal;
    const resp = await fetch(url, init);
    let data: unknown = null;
    try {
      data = await resp.json();
    } catch {
      data = null;
    }
    return { ok: resp.ok, status: resp.status, data };
  } catch {
    return { ok: false, status: 0, data: null, corsOrNetError: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function installAddonRecordFromUrl(
  rawUrl: string,
  currentAddons: AddonRecord[],
): Promise<{ result: AddonInstallResult; nextAddons: AddonRecord[] }> {
  const norm = normalizeAddonUrl(rawUrl);
  if (!norm.ok || !norm.baseUrl || !norm.manifestUrl) {
    return {
      result: { ok: false, error: norm.error || 'URL de addon inválida.' },
      nextAddons: currentAddons,
    };
  }

  const fetched = await fetchJsonWithTimeout(norm.manifestUrl, 12000);
  if (fetched.corsOrNetError) {
    return {
      result: {
        ok: false,
        error: 'Não foi possível conectar ao manifesto (verifique a URL ou se o addon libera CORS neste aparelho).',
      },
      nextAddons: currentAddons,
    };
  }
  if (!fetched.ok && !fetched.data) {
    return {
      result: { ok: false, error: 'O servidor do addon respondeu erro HTTP ' + fetched.status + '.' },
      nextAddons: currentAddons,
    };
  }

  const parsed = parseStremioManifest(fetched.data);
  if (!parsed.ok || !parsed.manifest) {
    return {
      result: { ok: false, error: parsed.error || 'Manifesto Stremio inválido.' },
      nextAddons: currentAddons,
    };
  }

  const manifest = parsed.manifest;
  const next = currentAddons.slice();
  let existingIdx = -1;
  for (let i = 0; i < next.length; i++) {
    if (next[i].manifestUrl === norm.manifestUrl) {
      existingIdx = i;
      break;
    }
  }

  const record: AddonRecord = {
    id:
      existingIdx >= 0
        ? next[existingIdx].id
        : manifest.id + '_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1000),
    baseUrl: norm.baseUrl,
    manifestUrl: norm.manifestUrl,
    queryString: norm.queryString || '',
    manifest,
    enabled: existingIdx >= 0 ? next[existingIdx].enabled : true,
    addedAt: existingIdx >= 0 ? next[existingIdx].addedAt : Date.now(),
    order: existingIdx >= 0 ? next[existingIdx].order : next.length,
  };

  if (existingIdx >= 0) {
    next[existingIdx] = record;
  } else {
    next.push(record);
  }
  saveAddonsToStorage(next);
  return { result: { ok: true, addon: record }, nextAddons: next };
}

export async function testAddonRecord(addon: AddonRecord): Promise<AddonTestResult> {
  const start = Date.now();
  const fetched = await fetchJsonWithTimeout(addon.manifestUrl, 10000);
  const latencyMs = Date.now() - start;
  if (fetched.corsOrNetError) {
    return {
      ok: false,
      latencyMs,
      error: 'Falha de rede ou bloqueio de CORS ao testar este addon.',
    };
  }
  if (!fetched.ok && !fetched.data) {
    return { ok: false, latencyMs, error: 'HTTP ' + fetched.status };
  }
  const parsed = parseStremioManifest(fetched.data);
  if (!parsed.ok || !parsed.manifest) {
    return { ok: false, latencyMs, error: parsed.error || 'Manifesto inválido.' };
  }
  return { ok: true, latencyMs, manifest: parsed.manifest };
}

function getImdbCache(): ImdbCacheState {
  if (memoryImdbCache) return memoryImdbCache;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SAIMO_IMDB_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ImdbCacheState>;
        memoryImdbCache = {
          tmdbToImdb: parsed.tmdbToImdb || {},
          imdbToTmdb: parsed.imdbToTmdb || {},
          order: Array.isArray(parsed.order) ? parsed.order : [],
        };
        return memoryImdbCache;
      }
    }
  } catch {
    /* cache ignorado */
  }
  memoryImdbCache = { tmdbToImdb: {}, imdbToTmdb: {}, order: [] };
  return memoryImdbCache;
}

function saveImdbCache(cache: ImdbCacheState): void {
  while (cache.order.length > MAX_IMDB_CACHE) {
    const oldest = cache.order.shift();
    if (!oldest) continue;
    delete cache.tmdbToImdb[oldest];
    delete cache.imdbToTmdb[oldest];
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAIMO_IMDB_CACHE_KEY, JSON.stringify(cache));
    }
  } catch {
    /* quota cheia */
  }
}

function rememberImdbMapping(tmdbId: number, isSeries: boolean, imdbId: string, extra?: Partial<TmdbBridgeMatch>): void {
  if (!tmdbId || !imdbId) return;
  const cache = getImdbCache();
  const tKey = (isSeries ? 'tv:' : 'movie:') + tmdbId;
  cache.tmdbToImdb[tKey] = imdbId;
  cache.order.push(tKey);
  if (extra && extra.title) {
    cache.imdbToTmdb[imdbId] = {
      tmdbId,
      imdbId,
      type: isSeries ? 'series' : 'movie',
      title: extra.title,
      year: extra.year || '',
      poster: extra.poster || '',
      backdrop: extra.backdrop || '',
      overview: extra.overview || '',
      rating: extra.rating || 0,
    };
    cache.order.push(imdbId);
  }
  saveImdbCache(cache);
}

/** Resolve TMDB ID -> IMDb ID (`tt...`) usando cache local e TMDB `append_to_response=external_ids`. */
export async function resolveTmdbToImdb(tmdbId: number, isSeries: boolean): Promise<string | null> {
  if (!tmdbId) return null;
  const cache = getImdbCache();
  const key = (isSeries ? 'tv:' : 'movie:') + tmdbId;
  if (cache.tmdbToImdb[key]) return cache.tmdbToImdb[key];

  const media = isSeries ? 'tv' : 'movie';
  const url =
    TMDB_CLIENT_BASE +
    '/' +
    media +
    '/' +
    tmdbId +
    '?api_key=' +
    TMDB_CLIENT_KEY +
    '&append_to_response=external_ids';
  const res = await fetchJsonWithTimeout(url, 8000);
  if (!res.ok || !res.data || typeof res.data !== 'object') return null;

  const obj = res.data as Record<string, unknown>;
  const ext = (obj.external_ids as Record<string, unknown>) || {};
  const imdb = typeof ext.imdb_id === 'string' ? ext.imdb_id.trim() : typeof obj.imdb_id === 'string' ? obj.imdb_id.trim() : '';
  if (!imdb || imdb.indexOf('tt') !== 0) return null;

  const title = String(obj.title || obj.name || '');
  const dateStr = String(obj.release_date || obj.first_air_date || '');
  rememberImdbMapping(tmdbId, isSeries, imdb, {
    title,
    year: dateStr.slice(0, 4),
    poster: typeof obj.poster_path === 'string' && obj.poster_path ? TMDB_IMG_W500 + obj.poster_path : '',
    backdrop: typeof obj.backdrop_path === 'string' && obj.backdrop_path ? TMDB_IMG_ORIGINAL + obj.backdrop_path : '',
    overview: String(obj.overview || ''),
    rating: Number(obj.vote_average) || 0,
  });
  return imdb;
}

/** Resolve IMDb ID (`tt...`) -> TMDB ID e metadados via `/find/{imdb_id}`. */
export async function resolveImdbToTmdb(
  imdbId: string,
  preferredType?: 'movie' | 'series',
): Promise<TmdbBridgeMatch | null> {
  const clean = (imdbId || '').trim();
  if (!clean || clean.indexOf('tt') !== 0) return null;

  const cache = getImdbCache();
  if (cache.imdbToTmdb[clean]) return cache.imdbToTmdb[clean];

  const url =
    TMDB_CLIENT_BASE +
    '/find/' +
    encodeURIComponent(clean) +
    '?api_key=' +
    TMDB_CLIENT_KEY +
    '&external_source=imdb_id&language=pt-BR';
  const res = await fetchJsonWithTimeout(url, 8000);
  if (!res.ok || !res.data || typeof res.data !== 'object') return null;

  const data = res.data as Record<string, unknown>;
  const movies = Array.isArray(data.movie_results) ? (data.movie_results as Array<Record<string, unknown>>) : [];
  const tv = Array.isArray(data.tv_results) ? (data.tv_results as Array<Record<string, unknown>>) : [];

  let chosen: Record<string, unknown> | null = null;
  let isSeries = false;

  if (preferredType === 'series' && tv.length > 0) {
    chosen = tv[0];
    isSeries = true;
  } else if (preferredType === 'movie' && movies.length > 0) {
    chosen = movies[0];
    isSeries = false;
  } else if (movies.length > 0) {
    chosen = movies[0];
    isSeries = false;
  } else if (tv.length > 0) {
    chosen = tv[0];
    isSeries = true;
  }

  if (!chosen || !chosen.id) return null;

  const match: TmdbBridgeMatch = {
    tmdbId: Number(chosen.id),
    imdbId: clean,
    type: isSeries ? 'series' : 'movie',
    title: String(chosen.title || chosen.name || ''),
    year: String(chosen.release_date || chosen.first_air_date || '').slice(0, 4),
    poster: typeof chosen.poster_path === 'string' && chosen.poster_path ? TMDB_IMG_W500 + chosen.poster_path : '',
    backdrop: typeof chosen.backdrop_path === 'string' && chosen.backdrop_path ? TMDB_IMG_ORIGINAL + chosen.backdrop_path : '',
    overview: String(chosen.overview || ''),
    rating: Number(chosen.vote_average) || 0,
  };
  rememberImdbMapping(match.tmdbId, isSeries, clean, match);
  return match;
}

function mapTmdbResult(raw: Record<string, unknown>, forceType?: 'movie' | 'series'): TmdbDiscoveryItem | null {
  const mt = forceType || (raw.media_type === 'tv' ? 'series' : raw.media_type === 'movie' ? 'movie' : null);
  if (!mt || !raw.id) return null;
  const title = String(raw.title || raw.name || '').trim();
  if (!title) return null;
  const poster = typeof raw.poster_path === 'string' && raw.poster_path ? TMDB_IMG_W500 + raw.poster_path : '';
  const backdrop = typeof raw.backdrop_path === 'string' && raw.backdrop_path ? TMDB_IMG_ORIGINAL + raw.backdrop_path : '';
  if (!poster && !backdrop) return null;
  const cachedImdb = getImdbCache().tmdbToImdb[(mt === 'series' ? 'tv:' : 'movie:') + Number(raw.id)];
  return {
    tmdbId: Number(raw.id),
    imdbId: cachedImdb,
    type: mt,
    title,
    year: String(raw.release_date || raw.first_air_date || '').slice(0, 4),
    poster: poster || backdrop,
    backdrop: backdrop || poster,
    overview: String(raw.overview || ''),
    rating: Number(raw.vote_average) || 0,
  };
}

/** Trilhos de descoberta do TMDB (usados para destravar Home/OnDemand quando não há lista M3U/VOD). */
export function discoverTmdbPopular(): Promise<TmdbDiscoveryRail[]> {
  if (discoveryPromise && Date.now() - discoveryTimestamp < DISCOVERY_TTL_MS) {
    return discoveryPromise;
  }

  const endpoints: Array<{ id: string; title: string; type: 'movie' | 'series'; path: string }> = [
    { id: 'tmdb_trending_movie', title: 'Filmes em Alta', type: 'movie', path: '/trending/movie/week' },
    { id: 'tmdb_trending_tv', title: 'Séries em Alta', type: 'series', path: '/trending/tv/week' },
    { id: 'tmdb_popular_movie', title: 'Filmes Populares', type: 'movie', path: '/movie/popular' },
    { id: 'tmdb_popular_tv', title: 'Séries Populares', type: 'series', path: '/tv/popular' },
  ];

  discoveryTimestamp = Date.now();
  discoveryPromise = Promise.all(
    endpoints.map(async (ep) => {
      const url = TMDB_CLIENT_BASE + ep.path + '?api_key=' + TMDB_CLIENT_KEY + '&language=pt-BR&page=1';
      const res = await fetchJsonWithTimeout(url, 8000);
      const rawResults =
        res.ok && res.data && typeof res.data === 'object' && Array.isArray((res.data as Record<string, unknown>).results)
          ? ((res.data as Record<string, unknown>).results as Array<Record<string, unknown>>)
          : [];
      const items: TmdbDiscoveryItem[] = [];
      for (let i = 0; i < rawResults.length; i++) {
        const mapped = mapTmdbResult(rawResults[i], ep.type);
        if (mapped) items.push(mapped);
      }
      return {
        id: ep.id,
        title: ep.title,
        type: ep.type,
        items,
      } as TmdbDiscoveryRail;
    }),
  )
    .then((rails) => rails.filter((r) => r.items.length > 0))
    .catch(() => {
      discoveryPromise = null;
      return [];
    });

  return discoveryPromise;
}

export async function searchTmdbMulti(query: string): Promise<TmdbDiscoveryItem[]> {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const url =
    TMDB_CLIENT_BASE +
    '/search/multi?api_key=' +
    TMDB_CLIENT_KEY +
    '&language=pt-BR&include_adult=false&query=' +
    encodeURIComponent(q);
  const res = await fetchJsonWithTimeout(url, 8000);
  if (!res.ok || !res.data || typeof res.data !== 'object') return [];
  const results = Array.isArray((res.data as Record<string, unknown>).results)
    ? ((res.data as Record<string, unknown>).results as Array<Record<string, unknown>>)
    : [];
  const out: TmdbDiscoveryItem[] = [];
  for (let i = 0; i < results.length; i++) {
    const mapped = mapTmdbResult(results[i]);
    if (mapped) out.push(mapped);
  }
  return out;
}

export async function fetchTmdbSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number,
): Promise<Array<{ episodeNumber: number; name: string; overview: string; still: string; seasonNumber: number }>> {
  if (!tmdbId || seasonNumber <= 0) return [];
  const url =
    TMDB_CLIENT_BASE +
    '/tv/' +
    tmdbId +
    '/season/' +
    seasonNumber +
    '?api_key=' +
    TMDB_CLIENT_KEY +
    '&language=pt-BR';
  const res = await fetchJsonWithTimeout(url, 8000);
  if (!res.ok || !res.data || typeof res.data !== 'object') return [];
  const eps = Array.isArray((res.data as Record<string, unknown>).episodes)
    ? ((res.data as Record<string, unknown>).episodes as Array<Record<string, unknown>>)
    : [];
  return eps
    .filter((e) => Number(e.episode_number) > 0)
    .map((e) => ({
      seasonNumber,
      episodeNumber: Number(e.episode_number),
      name: String(e.name || 'Episódio ' + e.episode_number),
      overview: String(e.overview || ''),
      still: typeof e.still_path === 'string' && e.still_path ? TMDB_IMG_W500 + e.still_path : '',
    }));
}

export async function fetchTmdbSeriesSeasonsCount(tmdbId: number): Promise<number[]> {
  if (!tmdbId) return [1];
  const url = TMDB_CLIENT_BASE + '/tv/' + tmdbId + '?api_key=' + TMDB_CLIENT_KEY + '&language=pt-BR';
  const res = await fetchJsonWithTimeout(url, 8000);
  if (!res.ok || !res.data || typeof res.data !== 'object') return [1];
  const seasons = Array.isArray((res.data as Record<string, unknown>).seasons)
    ? ((res.data as Record<string, unknown>).seasons as Array<Record<string, unknown>>)
    : [];
  const nums = seasons
    .map((s) => Number(s.season_number))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  return nums.length > 0 ? nums : [1];
}

function buildExtraSegment(extra?: Record<string, string | number>): string {
  if (!extra) return '';
  const keys = Object.keys(extra);
  const parts: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const v = extra[k];
    if (v === undefined || v === null || v === '') continue;
    parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
  }
  return parts.join('&');
}

export async function fetchAddonCatalog(
  addon: AddonRecord,
  type: string,
  catalogId: string,
  extra?: Record<string, string | number>,
): Promise<StremioMetaPreview[]> {
  if (!addon || !addon.enabled) return [];
  const extraStr = buildExtraSegment(extra);
  const path = extraStr
    ? 'catalog/' + encodeURIComponent(type) + '/' + encodeURIComponent(catalogId) + '/' + extraStr + '.json'
    : 'catalog/' + encodeURIComponent(type) + '/' + encodeURIComponent(catalogId) + '.json';
  const url = buildAddonEndpointUrl(addon, path);
  const res = await fetchJsonWithTimeout(url, 9000);
  if (!res.ok || !res.data || typeof res.data !== 'object') return [];
  const metas = (res.data as Record<string, unknown>).metas;
  return Array.isArray(metas) ? (metas as StremioMetaPreview[]) : [];
}

function pickCandidateIdForAddon(
  addon: AddonRecord,
  resourceName: string,
  mediaType: string,
  candidateIds: string[],
  isSeries: boolean,
  season?: number,
  episode?: number,
): string | null {
  for (let i = 0; i < candidateIds.length; i++) {
    const base = candidateIds[i];
    if (!base) continue;
    if (addonSupportsResource(addon, resourceName, mediaType, base)) {
      return buildStremioMediaId(base, isSeries, season, episode);
    }
  }
  return null;
}

export async function fetchMetaFromAddons(
  addons: AddonRecord[],
  mediaType: 'movie' | 'series',
  candidateIds: string[],
): Promise<StremioMeta | null> {
  for (let i = 0; i < addons.length; i++) {
    const addon = addons[i];
    if (!addon.enabled) continue;
    const reqId = pickCandidateIdForAddon(addon, 'meta', mediaType, candidateIds, false);
    if (!reqId) continue;
    const url = buildAddonEndpointUrl(addon, 'meta/' + encodeURIComponent(mediaType) + '/' + encodeURIComponent(reqId) + '.json');
    const res = await fetchJsonWithTimeout(url, 8000);
    if (res.ok && res.data && typeof res.data === 'object' && (res.data as Record<string, unknown>).meta) {
      return (res.data as Record<string, unknown>).meta as StremioMeta;
    }
  }
  return null;
}

export async function fetchStreamsFromAddons(
  addons: AddonRecord[],
  mediaType: 'movie' | 'series',
  candidateIds: string[],
  season?: number,
  episode?: number,
): Promise<AddonStreamEntry[]> {
  const isSeries = mediaType === 'series';
  const enabled = addons.filter((a) => a.enabled);
  const results = await Promise.all(
    enabled.map(async (addon) => {
      const reqId = pickCandidateIdForAddon(addon, 'stream', mediaType, candidateIds, isSeries, season, episode);
      if (!reqId) return [] as AddonStreamEntry[];
      const url = buildAddonEndpointUrl(
        addon,
        'stream/' + encodeURIComponent(mediaType) + '/' + encodeURIComponent(reqId) + '.json',
      );
      const res = await fetchJsonWithTimeout(url, 12000);
      if (!res.ok || !res.data || typeof res.data !== 'object') return [] as AddonStreamEntry[];
      const streams = (res.data as Record<string, unknown>).streams;
      if (!Array.isArray(streams)) return [] as AddonStreamEntry[];
      return (streams as StremioStream[]).map((stream) => ({ addon, stream }));
    }),
  );

  const merged: AddonStreamEntry[] = [];
  for (let i = 0; i < results.length; i++) {
    for (let j = 0; j < results[i].length; j++) {
      merged.push(results[i][j]);
    }
  }
  return merged;
}

export async function fetchSubtitlesFromAddons(
  addons: AddonRecord[],
  mediaType: 'movie' | 'series',
  candidateIds: string[],
  season?: number,
  episode?: number,
): Promise<AddonSubtitleEntry[]> {
  const isSeries = mediaType === 'series';
  const enabled = addons.filter((a) => a.enabled);
  const results = await Promise.all(
    enabled.map(async (addon) => {
      const reqId = pickCandidateIdForAddon(addon, 'subtitles', mediaType, candidateIds, isSeries, season, episode);
      if (!reqId) return [] as AddonSubtitleEntry[];
      const url = buildAddonEndpointUrl(
        addon,
        'subtitles/' + encodeURIComponent(mediaType) + '/' + encodeURIComponent(reqId) + '.json',
      );
      const res = await fetchJsonWithTimeout(url, 8000);
      if (!res.ok || !res.data || typeof res.data !== 'object') return [] as AddonSubtitleEntry[];
      const subs = (res.data as Record<string, unknown>).subtitles;
      if (!Array.isArray(subs)) return [] as AddonSubtitleEntry[];
      return (subs as StremioSubtitle[])
        .filter((s) => Boolean(s && typeof s.url === 'string' && s.url.trim()))
        .map((subtitle) => ({ addon, subtitle }));
    }),
  );

  const merged: AddonSubtitleEntry[] = [];
  for (let i = 0; i < results.length; i++) {
    for (let j = 0; j < results[i].length; j++) {
      merged.push(results[i][j]);
    }
  }
  return merged;
}

/**
 * Busca títulos usando catálogos dos addons com suporte a `search` + TMDB search multi.
 */
export async function searchAddonsCatalogs(
  addons: AddonRecord[],
  query: string,
): Promise<StremioMetaPreview[]> {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const tasks: Promise<StremioMetaPreview[]>[] = [];

  for (let i = 0; i < addons.length; i++) {
    const addon = addons[i];
    if (!addon.enabled || !addonSupportsResource(addon, 'catalog')) continue;
    const catalogs = addon.manifest.catalogs || [];
    for (let c = 0; c < catalogs.length; c++) {
      const cat = catalogs[c];
      const supportsSearch = Array.isArray(cat.extra) && cat.extra.some((ex) => ex && ex.name === 'search');
      if (!supportsSearch) continue;
      tasks.push(fetchAddonCatalog(addon, cat.type, cat.id, { search: q }));
      if (tasks.length >= 6) break;
    }
    if (tasks.length >= 6) break;
  }

  if (tasks.length === 0) return [];
  const lists = await Promise.all(tasks.map((t) => t.catch(() => [] as StremioMetaPreview[])));
  const out: StremioMetaPreview[] = [];
  const seen: Record<string, boolean> = {};
  for (let i = 0; i < lists.length; i++) {
    for (let j = 0; j < lists[i].length; j++) {
      const m = lists[i][j];
      if (!m || !m.id || !m.name) continue;
      const key = m.type + ':' + m.id;
      if (seen[key]) continue;
      seen[key] = true;
      out.push(m);
    }
  }
  return out;
}

/** Aplica payload `{ t: "dados", addons?, debrid? }` no localStorage mantendo compatibilidade reversa. */
export function applyConnectDadosPayload(dados: unknown): {
  addons: AddonRecord[];
  debrid: DebridAccountConfig[];
  addonsUpdated: number;
  debridUpdated: number;
} {
  const currentAddons = loadAddonsFromStorage();
  const currentDebrid = loadDebridFromStorage();
  const merged = applyDadosSyncMerge(currentAddons, currentDebrid, dados);
  if (merged.addonsUpdated > 0) saveAddonsToStorage(merged.addons);
  if (merged.debridUpdated > 0) saveDebridToStorage(merged.debrid);
  return merged;
}

export function exportConnectDadosPayload(): DadosSyncPayload {
  return buildDadosSyncExport(loadAddonsFromStorage(), loadDebridFromStorage());
}
