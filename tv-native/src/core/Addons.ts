/**
 * Gerenciador de Addons (protocolo Stremio) e Debrid client-side no motor Smart TV nativo.
 * Reutiliza os módulos puros compartilhados de protocol/client (zero código copiado GPL).
 */

import {
  AddonRecord,
  DadosSyncPayload,
  DebridAccountConfig,
  DebridProviderId,
  StremioMetaPreview,
  StremioStream,
  addonSupportsResource,
  formatAddonStreamLabel,
  formatStreamByteSize,
} from '../../../src/utils/addonProtocol';
import {
  AddonInstallResult,
  AddonTestResult,
  TmdbDiscoveryItem,
  applyConnectDadosPayload,
  discoverTmdbPopular,
  exportConnectDadosPayload,
  fetchAddonCatalog,
  fetchMetaFromAddons,
  fetchStreamsFromAddons,
  fetchSubtitlesFromAddons,
  fetchTmdbSeasonEpisodes,
  fetchTmdbSeriesSeasonsCount,
  installAddonRecordFromUrl,
  loadAddonsFromStorage,
  loadDebridFromStorage,
  resolveImdbToTmdb,
  resolveTmdbToImdb,
  saveAddonsToStorage,
  saveDebridToStorage,
  searchAddonsCatalogs,
  searchTmdbMulti,
  testAddonRecord,
} from '../../../src/utils/addonClient';
import {
  DEBRID_PROVIDERS,
  DebridAccountCheckResult,
  DebridResolveResult,
  checkDebridAccount,
  resolveTorrentAcrossDebrid,
} from '../../../src/utils/debridProtocol';
import { DestaqueFila, VODItem } from './Api';
import { State } from './State';

export interface TvAddonStreamOption {
  url: string;
  label: string;
  detail?: string;
  badge?: string;
  addonName: string;
  headers?: Record<string, string>;
  infoHash?: string;
  fileIdx?: number;
  trackers?: string[];
  bingeGroup?: string;
  subtitles?: { url: string; lang: string; label?: string }[];
  debridResolved?: boolean;
}

export const PENDING_ADDON_STREAM_URL = 'addon-stream://pending';
const DEBRID_PENDING_PREFIX = 'addon-stream://debrid/';

export function makeTvDebridPendingUrl(infoHash: string, fileIdx?: number): string {
  const idx = typeof fileIdx === 'number' && !isNaN(fileIdx) ? String(fileIdx) : '';
  return DEBRID_PENDING_PREFIX + String(infoHash || '').toLowerCase() + '/' + idx;
}

export function isTvDebridPendingUrl(url: string): boolean {
  return typeof url === 'string' && url.indexOf(DEBRID_PENDING_PREFIX) === 0;
}

export function isTvPendingLazyUrl(url: string): boolean {
  return url === PENDING_ADDON_STREAM_URL || isTvDebridPendingUrl(url);
}

function parseDebridPendingUrl(url: string): { infoHash: string; fileIdx?: number } | null {
  if (!isTvDebridPendingUrl(url)) return null;
  const rest = url.slice(DEBRID_PENDING_PREFIX.length);
  const slash = rest.indexOf('/');
  const infoHash = slash >= 0 ? rest.slice(0, slash) : rest;
  const idxRaw = slash >= 0 ? rest.slice(slash + 1) : '';
  const idxNum = idxRaw !== '' ? parseInt(idxRaw, 10) : NaN;
  return {
    infoHash: infoHash.trim().toLowerCase(),
    fileIdx: !isNaN(idxNum) ? idxNum : undefined,
  };
}

function metaPreviewToVodItem(preview: StremioMetaPreview): VODItem {
  const rawId = String(preview.id || '');
  const imdbId = preview.imdb_id || (rawId.indexOf('tt') === 0 ? rawId.split(':')[0] : undefined);
  const isSeries = preview.type === 'series' || preview.type === 'anime';
  return {
    id: 'addon_' + rawId.replace(/[^a-zA-Z0-9_-]/g, '_'),
    title: preview.name || 'Sem título',
    isSeries,
    imdbId,
    addonMetaId: rawId,
    addonType: isSeries ? 'series' : 'movie',
    poster: preview.poster || preview.background || '',
    backdrop: preview.background || preview.poster || '',
    genres: preview.genres || [],
    year: preview.releaseInfo ? String(preview.releaseInfo).slice(0, 4) : undefined,
    overview: preview.description || '',
    rating: preview.imdbRating ? parseFloat(preview.imdbRating) || undefined : undefined,
  };
}

function tmdbDiscoveryToVodItem(item: TmdbDiscoveryItem): VODItem {
  return {
    id: (item.isSeries ? 'tmdb_tv_' : 'tmdb_mv_') + String(item.tmdbId),
    title: item.title,
    isSeries: item.isSeries,
    tmdbId: item.tmdbId,
    poster: item.poster,
    backdrop: item.backdrop || item.poster,
    genres: item.genres || [],
    year: item.year,
    overview: item.overview,
    rating: item.rating,
  };
}

function collectCandidateIds(item: VODItem, resolvedImdb?: string | null): string[] {
  const out: string[] = [];
  const push = (val?: string | null) => {
    if (!val) return;
    const trimmed = String(val).trim();
    if (trimmed && out.indexOf(trimmed) === -1) out.push(trimmed);
  };
  push(resolvedImdb);
  push(item.imdbId);
  push(item.addonMetaId);
  if (item.tmdbId) push('tmdb:' + String(item.tmdbId));
  return out;
}

export class Addons {
  private static bridgeRegistered = false;

  static initBridge(): void {
    if (this.bridgeRegistered || typeof window === 'undefined') return;
    this.bridgeRegistered = true;

    const w = window as unknown as Record<string, unknown>;
    w.__SAIMO_RECEBER_DADOS__ = (payload: unknown) => Addons.applyDados(payload);

    window.addEventListener('saimo-connect-dados', ((ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (detail !== undefined) {
        Addons.applyDados(detail);
      }
    }) as EventListener);
  }

  static list(): AddonRecord[] {
    return loadAddonsFromStorage();
  }

  static enabledList(): AddonRecord[] {
    return loadAddonsFromStorage().filter((a) => a.enabled);
  }

  static hasEnabled(): boolean {
    return this.enabledList().length > 0;
  }

  static hasStreamAddons(): boolean {
    return this.enabledList().some((a) => addonSupportsResource(a, 'stream'));
  }

  static async install(rawUrl: string): Promise<AddonInstallResult> {
    const res = await installAddonRecordFromUrl(rawUrl, loadAddonsFromStorage());
    if (res.ok && res.addons) {
      saveAddonsToStorage(res.addons);
      State.emit('addons-changed', res.addons);
    }
    return res;
  }

  static toggle(id: string): AddonRecord[] {
    const next = loadAddonsFromStorage().map((a) =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    saveAddonsToStorage(next);
    State.emit('addons-changed', next);
    return next;
  }

  static remove(id: string): AddonRecord[] {
    const next = loadAddonsFromStorage().filter((a) => a.id !== id);
    saveAddonsToStorage(next);
    State.emit('addons-changed', next);
    return next;
  }

  static test(addon: AddonRecord): Promise<AddonTestResult> {
    return testAddonRecord(addon);
  }

  static getDebridAccounts(): DebridAccountConfig[] {
    return loadDebridFromStorage();
  }

  static hasDebrid(): boolean {
    return loadDebridFromStorage().some((a) => a.enabled && Boolean(a.apiKey));
  }

  static getDebridProviders() {
    return DEBRID_PROVIDERS;
  }

  static saveDebrid(config: DebridAccountConfig): DebridAccountConfig[] {
    const current = loadDebridFromStorage().filter((a) => a.provider !== config.provider);
    if (config.apiKey && config.apiKey.trim()) {
      current.push({
        provider: config.provider,
        apiKey: config.apiKey.trim(),
        enabled: config.enabled !== false,
        syncWithConnect: Boolean(config.syncWithConnect),
        updatedAt: Date.now(),
      });
    }
    saveDebridToStorage(current);
    State.emit('addons-changed', loadAddonsFromStorage());
    return current;
  }

  static removeDebrid(provider: DebridProviderId): DebridAccountConfig[] {
    const next = loadDebridFromStorage().filter((a) => a.provider !== provider);
    saveDebridToStorage(next);
    State.emit('addons-changed', loadAddonsFromStorage());
    return next;
  }

  static testDebrid(provider: DebridProviderId, apiKey: string): Promise<DebridAccountCheckResult> {
    return checkDebridAccount(provider, apiKey);
  }

  static async resolveDebridStream(
    infoHash: string,
    fileIdx?: number,
    trackers?: string[],
    displayName?: string
  ): Promise<DebridResolveResult> {
    const accounts = loadDebridFromStorage();
    return resolveTorrentAcrossDebrid(accounts, infoHash, fileIdx, trackers, displayName);
  }

  static applyDados(payload: unknown): { changedAddons: number; changedDebrid: number } {
    const res = applyConnectDadosPayload(payload);
    if (res.changedAddons > 0 || res.changedDebrid > 0) {
      State.emit('addons-changed', loadAddonsFromStorage());
    }
    return res;
  }

  static exportDados(): DadosSyncPayload {
    return exportConnectDadosPayload();
  }

  /**
   * Monta fileiras de catálogos dos addons habilitados + Descoberta TMDB
   * para desbloquear Início e On Demand quando não há listas M3U/Saimo configuradas.
   */
  static async discoverRails(): Promise<DestaqueFila[]> {
    const addons = this.enabledList();
    if (addons.length === 0) return [];

    const rails: DestaqueFila[] = [];
    const tarefas: Array<{ addon: AddonRecord; type: 'movie' | 'series'; id: string; name: string }> = [];

    for (let i = 0; i < addons.length && tarefas.length < 4; i++) {
      const addon = addons[i];
      const catalogs = addon.manifest.catalogs || [];
      for (let c = 0; c < catalogs.length && tarefas.length < 4; c++) {
        const cat = catalogs[c];
        if (!cat || !cat.id) continue;
        if (cat.type !== 'movie' && cat.type !== 'series') continue;
        let requiresExtra = false;
        if (Array.isArray(cat.extra)) {
          for (let e = 0; e < cat.extra.length; e++) {
            if (cat.extra[e] && cat.extra[e].isRequired) {
              requiresExtra = true;
              break;
            }
          }
        }
        if (requiresExtra) continue;
        const rawName = (cat.name || '').trim();
        const lowerName = rawName.toLowerCase();
        const prefixo = cat.type === 'series'
          ? (lowerName.indexOf('série') >= 0 || lowerName.indexOf('series') >= 0 || lowerName.indexOf('anime') >= 0 || lowerName.indexOf('dorama') >= 0 ? '' : 'Séries · ')
          : (lowerName.indexOf('filme') >= 0 ? '' : 'Filmes · ');
        tarefas.push({
          addon,
          type: cat.type,
          id: cat.id,
          name: prefixo + (rawName || (cat.type === 'series' ? 'Catálogo' : 'Catálogo')) + ' · ' + addon.name,
        });
      }
    }

    if (tarefas.length > 0) {
      const results = await Promise.all(
        tarefas.map((t) =>
          fetchAddonCatalog(t.addon, t.type, t.id)
            .then((metas) => ({ name: t.name, metas }))
            .catch(() => ({ name: t.name, metas: [] as StremioMetaPreview[] }))
        )
      );
      for (let i = 0; i < results.length; i++) {
        if (results[i].metas.length > 0) {
          rails.push({
            titulo: results[i].name,
            itens: results[i].metas.slice(0, 24).map(metaPreviewToVodItem),
          });
        }
      }
    }

    // Sempre inclui Descoberta TMDB como complemento rico para metadados e busca
    try {
      const tmdbRails = await discoverTmdbPopular();
      for (let i = 0; i < tmdbRails.length; i++) {
        if (tmdbRails[i].itens.length > 0) {
          rails.push({
            titulo: tmdbRails[i].titulo,
            itens: tmdbRails[i].itens.map(tmdbDiscoveryToVodItem),
          });
        }
      }
    } catch {
      // ignora falha de rede TMDB mantendo rails dos catálogos de addons
    }

    return rails;
  }

  /**
   * Busca combinada nos catálogos de addons com `search` + busca multi TMDB.
   */
  static async searchCatalogsAndTmdb(query: string): Promise<VODItem[]> {
    const addons = this.enabledList();
    if (addons.length === 0 || !query || !query.trim()) return [];

    const [catalogHits, tmdbHits] = await Promise.all([
      searchAddonsCatalogs(addons, query).catch(() => [] as StremioMetaPreview[]),
      searchTmdbMulti(query).catch(() => [] as TmdbDiscoveryItem[]),
    ]);

    const merged: VODItem[] = [];
    const seenKeys = new Set<string>();

    for (let i = 0; i < tmdbHits.length; i++) {
      const item = tmdbDiscoveryToVodItem(tmdbHits[i]);
      const key = item.title.toLowerCase() + ':' + String(item.isSeries);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        merged.push(item);
      }
    }
    for (let i = 0; i < catalogHits.length; i++) {
      const item = metaPreviewToVodItem(catalogHits[i]);
      const key = item.title.toLowerCase() + ':' + String(item.isSeries);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        merged.push(item);
      }
    }

    return merged;
  }

  /**
   * Preenche temporadas e episódios para séries sem lista M3U/VOD (via addon `meta` ou TMDB).
   */
  static async resolveSeriesEpisodes(item: VODItem): Promise<boolean> {
    const addons = this.enabledList();
    if (addons.length === 0) return false;

    let imdbId = item.imdbId;
    if (!imdbId && item.tmdbId) {
      imdbId = (await resolveTmdbToImdb(item.tmdbId, true).catch(() => null)) || undefined;
      if (imdbId) item.imdbId = imdbId;
    }

    // 1. Tenta buscar `meta` dos addons instalados (inclui animes/séries não-IMDb e Kitsu)
    const ids = collectCandidateIds(item, imdbId);
    if (ids.length > 0) {
      const meta = await fetchMetaFromAddons(addons, 'series', ids).catch(() => null);
      if (meta) {
        if (!item.overview && meta.description) item.overview = meta.description;
        if (!item.backdrop && meta.background) item.backdrop = meta.background;
        if (!item.poster && meta.poster) item.poster = meta.poster;
        if (meta.imdb_id && !item.imdbId) item.imdbId = meta.imdb_id;

        if (Array.isArray(meta.videos) && meta.videos.length > 0) {
          const seasonsMap = new Map<number, NonNullable<VODItem['seasons']>[number]['episodes']>();
          for (let i = 0; i < meta.videos.length; i++) {
            const v = meta.videos[i];
            const sNum = typeof v.season === 'number' && v.season >= 0 ? v.season : 1;
            if (sNum === 0) continue; // ignora especiais S00 por padrão na grade principal
            const epNum = typeof v.episode === 'number' && v.episode > 0 ? v.episode : (i + 1);
            if (!seasonsMap.has(sNum)) seasonsMap.set(sNum, []);
            seasonsMap.get(sNum)!.push({
              episodeNumber: epNum,
              title: v.title || v.name || `Episódio ${epNum}`,
              sources: [PENDING_ADDON_STREAM_URL],
              thumb: v.thumbnail,
              overview: v.overview,
            });
          }
          if (seasonsMap.size > 0) {
            const sortedSeasons: NonNullable<VODItem['seasons']> = [];
            Array.from(seasonsMap.keys())
              .sort((a, b) => a - b)
              .forEach((sNum) => {
                const eps = seasonsMap.get(sNum)!.sort((a, b) => a.episodeNumber - b.episodeNumber);
                sortedSeasons.push({ seasonNumber: sNum, episodes: eps });
              });
            item.seasons = sortedSeasons;
            return true;
          }
        }
      }
    }

    // 2. Se não veio do meta addon (ou veio sem videos[]), preenche temporadas pelo TMDB
    if (!item.tmdbId && item.imdbId) {
      const bridge = await resolveImdbToTmdb(item.imdbId, 'series').catch(() => null);
      if (bridge) item.tmdbId = bridge.tmdbId;
    }

    if (item.tmdbId) {
      const seasonNums = await fetchTmdbSeriesSeasonsCount(item.tmdbId).catch(() => [] as number[]);
      if (seasonNums.length > 0) {
        const cap = seasonNums.slice(0, 15);
        const epLists = await Promise.all(
          cap.map((sNum) =>
            fetchTmdbSeasonEpisodes(item.tmdbId!, sNum)
              .then((eps) => ({ sNum, eps }))
              .catch(() => ({ sNum, eps: [] }))
          )
        );
        const seasons: NonNullable<VODItem['seasons']> = [];
        for (let i = 0; i < epLists.length; i++) {
          const { sNum, eps } = epLists[i];
          if (eps.length > 0) {
            seasons.push({
              seasonNumber: sNum,
              episodes: eps.map((ep) => ({
                episodeNumber: ep.episodeNumber,
                title: ep.title,
                sources: [PENDING_ADDON_STREAM_URL],
                thumb: ep.thumb,
                overview: ep.overview,
              })),
            });
          }
        }
        if (seasons.length > 0) {
          item.seasons = seasons;
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Consulta `/stream/` de todos os addons habilitados para o título/episódio atual.
   * No motor nativo Smart TV (Tizen/webOS), URLs `.mkv` e `proxyHeaders.request` são reproduzíveis.
   */
  static async resolveMediaStreams(
    item: VODItem,
    season?: number,
    episode?: number
  ): Promise<TvAddonStreamOption[]> {
    const addons = this.enabledList();
    if (addons.length === 0) return [];

    let imdbId = item.imdbId;
    if (!imdbId && item.tmdbId) {
      imdbId = (await resolveTmdbToImdb(item.tmdbId, item.isSeries).catch(() => null)) || undefined;
      if (imdbId) item.imdbId = imdbId;
    }

    // Caso o card tenha vindo apenas com `addonMetaId` de algum catálogo e precisemos resolver TMDB <-> IMDb
    if (!imdbId && item.addonMetaId && item.addonMetaId.indexOf('tt') === 0) {
      imdbId = item.addonMetaId.split(':')[0];
      item.imdbId = imdbId;
    }

    const ids = collectCandidateIds(item, imdbId);
    if (ids.length === 0) return [];

    const mediaType: 'movie' | 'series' = item.isSeries ? 'series' : 'movie';
    const entries = await fetchStreamsFromAddons(addons, mediaType, ids, season, episode).catch(() => []);
    const hasDebrid = this.hasDebrid();

    const options: TvAddonStreamOption[] = [];
    for (let i = 0; i < entries.length; i++) {
      const { addon, stream } = entries[i];
      const converted = this.mapStremioStream(stream, addon.name, hasDebrid);
      if (converted) options.push(converted);
    }
    return options;
  }

  private static mapStremioStream(
    stream: StremioStream,
    addonName: string,
    hasDebrid: boolean
  ): TvAddonStreamOption | null {
    const { rotulo, detalhe } = formatAddonStreamLabel(stream, addonName);
    const reqHeaders = stream.behaviorHints?.proxyHeaders?.request;
    const bingeGroup = stream.behaviorHints?.bingeGroup;
    const subs = Array.isArray(stream.subtitles)
      ? stream.subtitles
          .filter((s) => Boolean(s && s.url))
          .map((s) => ({ url: s.url, lang: s.lang || 'und', label: s.lang || 'Addon' }))
      : undefined;

    if (stream.url && (stream.url.indexOf('http://') === 0 || stream.url.indexOf('https://') === 0)) {
      const lower = stream.url.toLowerCase();
      const badge = lower.indexOf('.mkv') >= 0
        ? 'MKV (TV Nativa)'
        : (reqHeaders ? 'Headers' : undefined);
      const sizeStr = formatStreamByteSize(stream.behaviorHints?.videoSize);
      const extraDetail = [detalhe, sizeStr].filter(Boolean).join(' · ');
      return {
        url: stream.url,
        label: rotulo,
        detail: extraDetail || addonName,
        badge,
        addonName,
        headers: reqHeaders,
        bingeGroup,
        subtitles: subs,
      };
    }

    if (stream.infoHash) {
      const hash = String(stream.infoHash).trim().toLowerCase();
      return {
        url: makeTvDebridPendingUrl(hash, stream.fileIdx),
        label: rotulo,
        detail: detalhe || addonName,
        badge: hasDebrid ? 'Debrid on-demand' : 'Requer Debrid',
        addonName,
        infoHash: hash,
        fileIdx: stream.fileIdx,
        trackers: stream.sources,
        bingeGroup,
        subtitles: subs,
      };
    }

    return null;
  }

  /**
   * Resolve URL lazy de Debrid (`addon-stream://debrid/...`) no momento em que o usuário abre/troca a fonte.
   */
  static async resolvePendingStreamUrl(
    url: string,
    option?: TvAddonStreamOption
  ): Promise<string> {
    const parsed = parseDebridPendingUrl(url);
    const infoHash = option?.infoHash || parsed?.infoHash;
    const fileIdx = typeof option?.fileIdx === 'number' ? option.fileIdx : parsed?.fileIdx;
    if (!infoHash) {
      throw new Error('Fonte torrent inválida (sem infoHash).');
    }
    const res = await this.resolveDebridStream(infoHash, fileIdx, option?.trackers, option?.label);
    if (!res.ok || !res.url) {
      throw new Error(res.erro || 'Não foi possível resolver este torrent via Debrid.');
    }
    return res.url;
  }

  /**
   * Mescla legendas vindas dentro do `stream.subtitles[]` + addons do recurso `subtitles`.
   */
  static async fetchMediaSubtitles(
    item: VODItem,
    season?: number,
    episode?: number,
    streamSubs?: { url: string; lang: string; label?: string }[]
  ): Promise<{ url: string; lang: string; label: string }[]> {
    const out: { url: string; lang: string; label: string }[] = [];
    const seen = new Set<string>();

    const pushSub = (url: string, lang: string, label: string) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      out.push({ url, lang: lang || 'pt', label: label || lang || 'Legenda' });
    };

    if (Array.isArray(streamSubs)) {
      for (let i = 0; i < streamSubs.length; i++) {
        const s = streamSubs[i];
        pushSub(s.url, s.lang, s.label || `${(s.lang || 'EXT').toUpperCase()} (Stream)`);
      }
    }

    const addons = this.enabledList();
    if (addons.length > 0) {
      let imdbId = item.imdbId;
      if (!imdbId && item.tmdbId) {
        imdbId = (await resolveTmdbToImdb(item.tmdbId, item.isSeries).catch(() => null)) || undefined;
      }
      const ids = collectCandidateIds(item, imdbId);
      if (ids.length > 0) {
        const mediaType: 'movie' | 'series' = item.isSeries ? 'series' : 'movie';
        const addonSubs = await fetchSubtitlesFromAddons(addons, mediaType, ids, season, episode).catch(() => []);
        for (let i = 0; i < addonSubs.length; i++) {
          const entry = addonSubs[i];
          const langCode = String(entry.subtitle.lang || 'und').toUpperCase();
          pushSub(entry.subtitle.url, entry.subtitle.lang || 'und', `${langCode} (${entry.addon.name})`);
        }
      }
    }

    return out;
  }
}
