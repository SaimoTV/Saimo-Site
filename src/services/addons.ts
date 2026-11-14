/**
 * Serviço Web / Mode-TV de Addons (Protocolo Stremio) + Descoberta TMDB.
 *
 * - Começa 100% vazio (zero addons pré-instalados).
 * - Toda requisição vai direto do navegador/aparelho ao addon/TMDB (sem proxy Cloudflare).
 * - Sincroniza via `{ t: "dados", addons?, debrid? }` retrocompatível com Saimo Connect.
 */

import { useSyncExternalStore } from 'react';
import type { MovieSource } from '../types/movie';
import type { ItemDestaque } from './vodService';

export interface AddonItemDestaque extends ItemDestaque {
  tmdbId?: number;
  imdbId?: string;
  addonMetaId?: string;
  addonId?: string;
  sinopse?: string;
  nota?: number;
  fundo?: string;
}
import {
  SAIMO_ADDONS_KEY,
  addonSupportsResource,
  formatAddonStreamLabel,
  inspectAddonStreamWebCompat,
  type AddonRecord,
  type DadosSyncPayload,
  type StremioMeta,
  type StremioMetaPreview,
} from '../utils/addonProtocol';
import {
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
  resolveImdbToTmdb,
  resolveTmdbToImdb,
  saveAddonsToStorage,
  searchAddonsCatalogs,
  searchTmdbMulti,
  testAddonRecord,
  type AddonInstallResult,
  type AddonStreamEntry,
  type AddonSubtitleEntry,
  type AddonTestResult,
  type TmdbDiscoveryItem,
  type TmdbDiscoveryRail,
} from '../utils/addonClient';
import { hasEnabledDebrid, refreshDebridFromStorage } from './debrid';

export type {
  AddonRecord,
  AddonInstallResult,
  AddonTestResult,
  AddonStreamEntry,
  AddonSubtitleEntry,
  TmdbDiscoveryItem,
  TmdbDiscoveryRail,
  DadosSyncPayload,
  StremioMeta,
  StremioMetaPreview,
};

export {
  discoverTmdbPopular,
  exportConnectDadosPayload,
  fetchAddonCatalog,
  fetchMetaFromAddons,
  fetchStreamsFromAddons,
  fetchSubtitlesFromAddons,
  fetchTmdbSeasonEpisodes,
  fetchTmdbSeriesSeasonsCount,
  resolveImdbToTmdb,
  resolveTmdbToImdb,
  searchAddonsCatalogs,
  searchTmdbMulti,
};

const EVENTO_ADDONS = 'saimo-addons-mudou';
let snapshotAddons: AddonRecord[] = loadAddonsFromStorage();

function emitirMudancaAddons(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTO_ADDONS));
  }
}

function atualizarSnapshot(lista: AddonRecord[]): void {
  snapshotAddons = lista;
  saveAddonsToStorage(lista);
  emitirMudancaAddons();
}

export function getAddons(): AddonRecord[] {
  return snapshotAddons;
}

export function getEnabledAddons(): AddonRecord[] {
  return snapshotAddons.filter((a) => a.enabled);
}

export function hasEnabledAddons(): boolean {
  return snapshotAddons.some((a) => a.enabled);
}

export function hasEnabledStreamAddons(): boolean {
  return snapshotAddons.some((a) => a.enabled && addonSupportsResource(a, 'stream'));
}

export function aoMudarAddons(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === SAIMO_ADDONS_KEY) {
      snapshotAddons = loadAddonsFromStorage();
      cb();
    }
  };
  window.addEventListener(EVENTO_ADDONS, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENTO_ADDONS, cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useAddons(): AddonRecord[] {
  return useSyncExternalStore(aoMudarAddons, getAddons, getAddons);
}

export function useTemAddons(): boolean {
  const addons = useAddons();
  return addons.some((a) => a.enabled);
}

export async function installAddonFromUrl(rawUrl: string): Promise<AddonInstallResult> {
  const { result, nextAddons } = await installAddonRecordFromUrl(rawUrl, snapshotAddons);
  if (result.ok) {
    snapshotAddons = nextAddons;
    emitirMudancaAddons();
  }
  return result;
}

export function toggleAddon(id: string): void {
  const next = snapshotAddons.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
  atualizarSnapshot(next);
}

export function removeAddon(id: string): void {
  const next = snapshotAddons.filter((a) => a.id !== id).map((a, idx) => ({ ...a, order: idx }));
  atualizarSnapshot(next);
}

export function testAddon(addon: AddonRecord): Promise<AddonTestResult> {
  return testAddonRecord(addon);
}

/** Aplica payload `{ t: "dados", addons?, debrid? }` recebido via Saimo Connect ou importação manual. */
export function aplicarDadosConnect(dados: unknown): { addonsUpdated: number; debridUpdated: number } {
  const res = applyConnectDadosPayload(dados);
  if (res.addonsUpdated > 0) {
    snapshotAddons = res.addons;
    emitirMudancaAddons();
  }
  if (res.debridUpdated > 0) {
    refreshDebridFromStorage();
  }
  return { addonsUpdated: res.addonsUpdated, debridUpdated: res.debridUpdated };
}

// Listener global opcional para mensagens `{ t: "dados" }` vindas de bridge nativo/Connect
if (typeof window !== 'undefined') {
  const w = window as Window & { __SAIMO_RECEBER_DADOS__?: (d: unknown) => unknown };
  w.__SAIMO_RECEBER_DADOS__ = (d: unknown) => aplicarDadosConnect(d);
  window.addEventListener('saimo-connect-dados', (ev: Event) => {
    const custom = ev as CustomEvent;
    if (custom.detail) aplicarDadosConnect(custom.detail);
  });
}

/** Constrói URL sintética estável para fontes `infoHash` resolvidas sob demanda pelo Debrid. */
export function makeDebridPendingUrl(infoHash: string, fileIdx?: number): string {
  const clean = (infoHash || '').trim().toLowerCase();
  return 'addon-debrid://' + clean + (typeof fileIdx === 'number' ? '/' + fileIdx : '');
}

export function isDebridPendingUrl(url: string): boolean {
  return Boolean(url && url.indexOf('addon-debrid://') === 0);
}

export function mapAddonStreamsToMovieSources(entries: AddonStreamEntry[]): MovieSource[] {
  const hasDebrid = hasEnabledDebrid();
  const pageIsHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
  const mapped: MovieSource[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const s = entry.stream;
    if (!s) continue;

    const url = s.url && s.url.trim() ? s.url.trim() : s.infoHash ? makeDebridPendingUrl(s.infoHash, s.fileIdx) : '';
    if (!url) continue;

    const compat = inspectAddonStreamWebCompat(s, hasDebrid, pageIsHttps);
    const { rotulo, detalhe } = formatAddonStreamLabel(s, entry.addon.manifest.name);
    const joined = ((s.name || '') + ' ' + (s.title || '') + ' ' + (s.description || '')).toLowerCase();
    const versao = /\b(dub|dublado|pt-br|portugu[eê]s)\b/.test(joined) ? 'dub' : /\b(leg|sub)\b/.test(joined) ? 'leg' : undefined;

    mapped.push({
      url,
      versao,
      rotulo,
      detalhe,
      addonId: entry.addon.id,
      addonName: entry.addon.manifest.name,
      infoHash: s.infoHash,
      fileIdx: s.fileIdx,
      trackers: s.sources,
      behaviorHints: s.behaviorHints,
      subtitles: s.subtitles,
      webAviso: compat.badge,
      webReproduzivel: compat.playable,
    });
  }

  // Prioridade: reproduzível direto HTTPS > Debrid pronto > nativo/CORS > requer Debrid
  return mapped.sort((a, b) => {
    const score = (x: MovieSource) => {
      if (x.webReproduzivel && !x.infoHash) return 0;
      if (x.webReproduzivel && x.infoHash) return 1;
      if (!x.webReproduzivel && x.webAviso !== 'Requer Debrid') return 2;
      return 3;
    };
    return score(a) - score(b);
  });
}

/** Constrói candidatos de ID no protocolo Stremio e busca streams nos addons ativos. */
export async function resolveAddonStreamsForTitle(params: {
  tmdbId?: number;
  imdbId?: string;
  addonMetaId?: string;
  isSeries: boolean;
  season?: number;
  episode?: number;
}): Promise<{ sources: MovieSource[]; imdbId?: string }> {
  const addons = getEnabledAddons().filter((a) => addonSupportsResource(a, 'stream'));
  if (addons.length === 0) return { sources: [], imdbId: params.imdbId };

  let imdbId = params.imdbId;
  if (!imdbId && params.tmdbId) {
    imdbId = (await resolveTmdbToImdb(params.tmdbId, params.isSeries)) || undefined;
  }

  const candidates: string[] = [];
  if (imdbId) candidates.push(imdbId);
  if (params.addonMetaId && candidates.indexOf(params.addonMetaId) === -1) candidates.push(params.addonMetaId);
  if (params.tmdbId) {
    const tmdbStr = 'tmdb:' + params.tmdbId;
    if (candidates.indexOf(tmdbStr) === -1) candidates.push(tmdbStr);
  }

  if (candidates.length === 0) return { sources: [], imdbId };

  const rawEntries = await fetchStreamsFromAddons(
    addons,
    params.isSeries ? 'series' : 'movie',
    candidates,
    params.season,
    params.episode,
  );
  return {
    sources: mapAddonStreamsToMovieSources(rawEntries),
    imdbId,
  };
}

/** Converte um item TMDB ou StremioMetaPreview para o formato `ItemDestaque` usado no Saimo Web. */
export function discoveryToItemDestaque(item: TmdbDiscoveryItem): AddonItemDestaque {
  const firstChar = item.title.trim().charAt(0).toUpperCase();
  return {
    tipo: item.type === 'series' ? 's' : 'f',
    titulo: item.title,
    letra: /[A-Z]/.test(firstChar) ? firstChar : '#',
    ano: item.year || '',
    capa: item.poster || item.backdrop,
    tmdbId: item.tmdbId,
    imdbId: item.imdbId,
    sinopse: item.overview,
    nota: item.rating,
    fundo: item.backdrop,
  };
}

export function metaPreviewToItemDestaque(meta: StremioMetaPreview, addonId?: string): AddonItemDestaque {
  const isSeries = meta.type === 'series';
  const title = (meta.name || meta.id).trim();
  const firstChar = title.charAt(0).toUpperCase();
  const yearMatch = /\d{4}/.exec(String(meta.releaseInfo || meta.year || ''));
  const tmdbMatch = /^tmdb:(\d+)$/.exec(meta.id);
  const imdbMatch = /^(tt\d+)$/.exec(meta.id);

  return {
    tipo: isSeries ? 's' : 'f',
    titulo: title,
    letra: /[A-Z]/.test(firstChar) ? firstChar : '#',
    ano: yearMatch ? yearMatch[0] : '',
    capa: meta.poster || meta.background || '',
    tmdbId: tmdbMatch ? Number(tmdbMatch[1]) : undefined,
    imdbId: imdbMatch ? imdbMatch[1] : undefined,
    addonMetaId: meta.id,
    addonId,
    sinopse: meta.description,
    nota: meta.imdbRating ? Number(meta.imdbRating) : undefined,
    fundo: meta.background,
  };
}

/** Carrega trilhos dos catálogos declarados pelos addons instalados (`resource: catalog`). */
export async function loadAddonCatalogRails(
  maxCatalogs = 6,
): Promise<Array<{ id: string; titulo: string; itens: AddonItemDestaque[]; type: string }>> {
  const addons = getEnabledAddons();
  const requests: Array<{ addon: AddonRecord; type: string; id: string; titulo: string }> = [];

  for (let i = 0; i < addons.length; i++) {
    const a = addons[i];
    if (!addonSupportsResource(a, 'catalog')) continue;
    const catalogs = a.manifest.catalogs || [];
    for (let c = 0; c < catalogs.length; c++) {
      const cat = catalogs[c];
      const hasRequiredExtra = Array.isArray(cat.extra) && cat.extra.some((ex) => Boolean(ex && ex.isRequired));
      if (hasRequiredExtra) continue;
      requests.push({
        addon: a,
        type: cat.type,
        id: cat.id,
        titulo: (a.manifest.name ? a.manifest.name + ' · ' : '') + (cat.name || cat.id),
      });
      if (requests.length >= maxCatalogs) break;
    }
    if (requests.length >= maxCatalogs) break;
  }

  if (requests.length === 0) return [];
  const fetched = await Promise.all(
    requests.map(async (req) => {
      const metas = await fetchAddonCatalog(req.addon, req.type, req.id);
      const itens = metas
        .filter((m) => Boolean(m && m.name && (m.poster || m.background)))
        .slice(0, 30)
        .map((m) => metaPreviewToItemDestaque(m, req.addon.id));
      return {
        id: req.addon.id + ':' + req.type + ':' + req.id,
        titulo: req.titulo,
        type: req.type,
        itens,
      };
    }),
  );
  return fetched.filter((r) => r.itens.length > 0);
}
