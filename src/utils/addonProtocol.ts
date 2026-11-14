/**
 * Protocolo Stremio e regras puras de Addons / Sincronização (`{t: "dados"}`).
 *
 * Implementação clean-room e compatível com ES5 (Chromium 38+ / Smart TVs)
 * e Node ESM para testes unitários, sem dependências de Node ou DOM.
 */

export const SAIMO_ADDONS_KEY = 'saimo_addons_v1';
export const SAIMO_DEBRID_KEY = 'saimo_debrid_v1';
export const SAIMO_IMDB_CACHE_KEY = 'saimo_imdb_cache_v1';

export type StremioResourceName = 'catalog' | 'meta' | 'stream' | 'subtitles' | string;

export interface StremioResourceObject {
  name: StremioResourceName;
  types?: string[];
  idPrefixes?: string[];
}

export interface StremioCatalogExtra {
  name: string;
  isRequired?: boolean;
  options?: string[];
  optionsLimit?: number;
}

export interface StremioCatalogDecl {
  type: string;
  id: string;
  name?: string;
  extra?: StremioCatalogExtra[];
  genres?: string[];
}

export interface StremioManifestBehaviorHints {
  configurable?: boolean;
  configurationRequired?: boolean;
  adult?: boolean;
  p2p?: boolean;
}

export interface StremioManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  logo?: string;
  background?: string;
  types: string[];
  resources: Array<string | StremioResourceObject>;
  catalogs: StremioCatalogDecl[];
  idPrefixes?: string[];
  behaviorHints?: StremioManifestBehaviorHints;
}

export interface NormalizedResource {
  name: string;
  types: string[];
  idPrefixes: string[];
}

export interface AddonRecord {
  id: string;
  baseUrl: string;
  manifestUrl: string;
  queryString: string;
  manifest: StremioManifest;
  enabled: boolean;
  addedAt: number;
  order: number;
}

export interface StremioSubtitle {
  id?: string;
  url: string;
  lang: string;
}

export interface StremioStreamBehaviorHints {
  notWebReady?: boolean;
  bingeGroup?: string;
  countryWhitelist?: string[];
  proxyHeaders?: {
    request?: Record<string, string>;
    response?: Record<string, string>;
  };
  videoHash?: string;
  videoSize?: number;
  filename?: string;
}

export interface StremioStream {
  name?: string;
  title?: string;
  description?: string;
  url?: string;
  ytId?: string;
  infoHash?: string;
  fileIdx?: number;
  sources?: string[];
  externalUrl?: string;
  subtitles?: StremioSubtitle[];
  behaviorHints?: StremioStreamBehaviorHints;
}

export interface StremioMetaPreview {
  id: string;
  type: string;
  name: string;
  poster?: string;
  posterShape?: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
  genres?: string[];
  year?: number | string;
}

export interface StremioVideo {
  id: string;
  title?: string;
  name?: string;
  season?: number;
  episode?: number;
  number?: number;
  overview?: string;
  thumbnail?: string;
  released?: string;
}

export interface StremioMeta extends StremioMetaPreview {
  videos?: StremioVideo[];
  runtime?: string;
  cast?: string[];
  director?: string[];
  country?: string;
  links?: Array<{ name: string; category: string; url: string }>;
}

export type DebridProviderId = 'torbox' | 'realdebrid' | 'alldebrid' | 'premiumize';

export interface DebridAccountConfig {
  provider: DebridProviderId;
  apiKey: string;
  enabled: boolean;
  /** Opt-in explícito: chaves Debrid só viajam no sync `{t: "dados"}` se marcado pelo usuário. */
  syncWithConnect?: boolean;
}

export interface DadosSyncAddonInput {
  id?: string;
  url?: string;
  baseUrl?: string;
  manifestUrl?: string;
  queryString?: string;
  manifest?: Partial<StremioManifest>;
  enabled?: boolean;
  addedAt?: number;
  order?: number;
}

export interface DadosSyncPayload {
  t?: string;
  canais?: unknown;
  filmes?: unknown;
  minhasListas?: unknown;
  addons?: DadosSyncAddonInput[];
  debrid?: Array<Partial<DebridAccountConfig>>;
}

export interface NormalizedAddonUrlResult {
  ok: boolean;
  baseUrl?: string;
  manifestUrl?: string;
  queryString?: string;
  error?: string;
}

export interface ParsedManifestResult {
  ok: boolean;
  manifest?: StremioManifest;
  error?: string;
  isNuvioJs?: boolean;
}

export interface AddonWebCompat {
  playable: boolean;
  needsDebrid: boolean;
  needsNativeOrCors: boolean;
  badge?: string;
  reason?: string;
}

export const NUVIO_JS_PLUGIN_ERROR =
  'Este endereço é de um repositório de scripts JS (formato Nuvio/local), não de um addon HTTP compatível com o protocolo Stremio. Informe a URL de um addon Stremio (/manifest.json) com campo "resources".';

function isPcharOrPctEncoded(ch: string): boolean {
  const c = ch.charCodeAt(0);
  // unreserved: A-Z a-z 0-9 - . _ ~
  if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57)) return true;
  if (ch === '-' || ch === '.' || ch === '_' || ch === '~') return true;
  // sub-delims: ! $ & ' ( ) * + , ; = plus : @
  if ('!$&\'()*+,;=:@'.indexOf(ch) !== -1) return true;
  return false;
}

function encodePathSegmentSafe(seg: string): string {
  let out = '';
  for (let i = 0; i < seg.length; i++) {
    const ch = seg.charAt(i);
    if (ch === '%' && i + 2 < seg.length && /^[0-9A-Fa-f]{2}$/.test(seg.slice(i + 1, i + 3))) {
      out += seg.slice(i, i + 3);
      i += 2;
      continue;
    }
    if (isPcharOrPctEncoded(ch)) {
      out += ch;
    } else {
      try {
        out += encodeURIComponent(ch);
      } catch {
        out += '%' + seg.charCodeAt(i).toString(16).toUpperCase();
      }
    }
  }
  return out;
}

/**
 * Normaliza uma URL de addon Stremio:
 * - converte `stremio://` em `https://`
 * - preserva `?query`
 * - remove `/manifest.json` no fim mantendo o path de configuração (ex.: `/providers=yts|eztv`)
 * - aplica percent-encoding seguro por segmento sem duplicar `%XX`
 */
export function normalizeAddonUrl(rawInput: string | null | undefined): NormalizedAddonUrlResult {
  let raw = (rawInput || '').trim();
  if (!raw) {
    return { ok: false, error: 'Informe a URL do addon Stremio.' };
  }
  if (/[\r\n\t]/.test(raw)) {
    return { ok: false, error: 'A URL do addon contém caracteres inválidos.' };
  }

  if (/^stremio:\/\//i.test(raw)) {
    raw = 'https://' + raw.slice('stremio://'.length);
  } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    if (!/^https?:\/\//i.test(raw)) {
      return { ok: false, error: 'Use apenas endereços http://, https:// ou stremio://.' };
    }
  } else {
    raw = 'https://' + raw;
  }

  // Separa fragmento (#...) e query string (?...) manualmente (sem depender de URLSearchParams)
  const hashIdx = raw.indexOf('#');
  const withoutHash = hashIdx >= 0 ? raw.slice(0, hashIdx) : raw;
  const qIdx = withoutHash.indexOf('?');
  const preQuery = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;
  const queryString = qIdx >= 0 ? withoutHash.slice(qIdx) : '';

  const schemeEnd = preQuery.indexOf('://');
  if (schemeEnd < 0) {
    return { ok: false, error: 'Endereço inválido.' };
  }
  const scheme = preQuery.slice(0, schemeEnd).toLowerCase();
  const rest = preQuery.slice(schemeEnd + 3);
  const slashIdx = rest.indexOf('/');
  const host = slashIdx >= 0 ? rest.slice(0, slashIdx) : rest;
  let path = slashIdx >= 0 ? rest.slice(slashIdx) : '';

  if (!host || /\s/.test(host) || host.indexOf('.') === -1 && host.indexOf(':') === -1 && host !== 'localhost') {
    if (!host || /\s/.test(host)) {
      return { ok: false, error: 'Domínio do addon inválido.' };
    }
  }

  // Remove barras extras no fim e o sufixo /manifest.json (preservando path de configuração)
  path = path.replace(/\/+$/, '');
  if (/\/manifest\.json$/i.test(path)) {
    path = path.slice(0, path.length - '/manifest.json'.length);
  } else if (/^manifest\.json$/i.test(path)) {
    path = '';
  }
  path = path.replace(/\/+$/, '');

  let encodedPath = '';
  if (path) {
    const parts = path.split('/');
    const encodedParts: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      if (i === 0 && parts[i] === '') {
        encodedParts.push('');
      } else if (parts[i] !== '') {
        encodedParts.push(encodePathSegmentSafe(parts[i]));
      }
    }
    encodedPath = encodedParts.join('/');
  }

  const baseUrl = scheme + '://' + host + encodedPath;
  const manifestUrl = baseUrl + '/manifest.json' + queryString;

  return {
    ok: true,
    baseUrl,
    manifestUrl,
    queryString,
  };
}

/**
 * Monta URL completa de recurso Stremio preservando `?queryString` de configuração.
 * Ex.: `buildAddonEndpointUrl(addon, 'stream/movie/tt0133093.json')`.
 */
export function buildAddonEndpointUrl(
  addon: Pick<AddonRecord, 'baseUrl' | 'queryString'>,
  resourcePath: string,
): string {
  const cleanBase = (addon.baseUrl || '').replace(/\/+$/, '');
  const cleanPath = (resourcePath || '').replace(/^\/+/, '');
  const qs = addon.queryString || '';
  return cleanBase + '/' + cleanPath + qs;
}

/** Detecta se o JSON corresponde a um repositório/plugin JS no formato Nuvio e não a um addon Stremio. */
export function detectNuvioJsPlugin(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i] as Record<string, unknown> | null;
      if (item && typeof item === 'object' && ('scrapers' in item || ('filename' in item && !('resources' in item)))) {
        return true;
      }
    }
    return false;
  }
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.scrapers) && !Array.isArray(obj.resources)) return true;
  if ((typeof obj.pluginsUrl === 'string' || typeof obj.scriptUrl === 'string') && !Array.isArray(obj.resources)) {
    return true;
  }
  return false;
}

/** Valida e interpreta um manifesto JSON no protocolo Stremio. */
export function parseStremioManifest(raw: unknown): ParsedManifestResult {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'O endereço não retornou um JSON válido de manifesto Stremio.' };
    }
  }

  if (detectNuvioJsPlugin(obj)) {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const rec = obj as Record<string, unknown>;
      if (Array.isArray(rec.scrapers)) {
        const name = typeof rec.name === 'string' && rec.name.trim() ? rec.name.trim() : 'Nuvio Plugin';
        const id = typeof rec.id === 'string' && rec.id.trim()
          ? rec.id.trim()
          : `nuvio.${name.toLowerCase().replace(/\s+/g, '-')}`;
        const version = typeof rec.version === 'string' && rec.version.trim() ? rec.version.trim() : '1.0.0';
        const scrapersCount = rec.scrapers.length;
        const description = typeof rec.description === 'string' && rec.description.trim()
          ? rec.description.trim()
          : `Repositório Nuvio (${scrapersCount} scrapers)`;
        return {
          ok: true,
          manifest: {
            id,
            name,
            version,
            description,
            types: ['movie', 'series'],
            idPrefixes: ['tt', 'tmdb:'],
            resources: ['stream'],
            catalogs: [],
          },
        };
      }
    }
    return { ok: false, isNuvioJs: true, error: NUVIO_JS_PLUGIN_ERROR };
  }

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: 'Manifesto Stremio inválido: esperado um objeto JSON.' };
  }

  const m = obj as Record<string, unknown>;
  const id = typeof m.id === 'string' ? m.id.trim() : '';
  const name = typeof m.name === 'string' ? m.name.trim() : '';
  const version = typeof m.version === 'string' ? m.version.trim() : '1.0.0';

  if (!id || !name) {
    return { ok: false, error: 'Manifesto Stremio inválido: campos "id" e "name" são obrigatórios.' };
  }

  if (!Array.isArray(m.resources) || m.resources.length === 0) {
    return { ok: false, error: 'Manifesto Stremio inválido: campo "resources" ausente ou vazio.' };
  }

  const resources: Array<string | StremioResourceObject> = [];
  for (let i = 0; i < m.resources.length; i++) {
    const r = m.resources[i];
    if (typeof r === 'string' && r.trim()) {
      resources.push(r.trim());
    } else if (r && typeof r === 'object' && typeof (r as Record<string, unknown>).name === 'string') {
      const ro = r as Record<string, unknown>;
      resources.push({
        name: String(ro.name).trim(),
        types: Array.isArray(ro.types) ? ro.types.filter((t): t is string => typeof t === 'string') : undefined,
        idPrefixes: Array.isArray(ro.idPrefixes) ? ro.idPrefixes.filter((p): p is string => typeof p === 'string') : undefined,
      });
    }
  }

  if (resources.length === 0) {
    return { ok: false, error: 'Manifesto Stremio inválido: nenhum recurso reconhecido.' };
  }

  const catalogs: StremioCatalogDecl[] = [];
  if (Array.isArray(m.catalogs)) {
    for (let i = 0; i < m.catalogs.length; i++) {
      const c = m.catalogs[i] as Record<string, unknown> | null;
      if (c && typeof c === 'object' && typeof c.type === 'string' && typeof c.id === 'string') {
        catalogs.push({
          type: c.type,
          id: c.id,
          name: typeof c.name === 'string' ? c.name : undefined,
          extra: Array.isArray(c.extra) ? (c.extra as StremioCatalogExtra[]) : undefined,
          genres: Array.isArray(c.genres) ? c.genres.filter((g): g is string => typeof g === 'string') : undefined,
        });
      }
    }
  }

  const typesSet: Record<string, boolean> = {};
  const types: string[] = [];
  if (Array.isArray(m.types)) {
    for (let i = 0; i < m.types.length; i++) {
      const t = m.types[i];
      if (typeof t === 'string' && t && !typesSet[t]) {
        typesSet[t] = true;
        types.push(t);
      }
    }
  }
  for (let i = 0; i < catalogs.length; i++) {
    const ct = catalogs[i].type;
    if (ct && !typesSet[ct]) {
      typesSet[ct] = true;
      types.push(ct);
    }
  }

  const idPrefixes = Array.isArray(m.idPrefixes)
    ? m.idPrefixes.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : undefined;

  const bhRaw = m.behaviorHints && typeof m.behaviorHints === 'object' ? (m.behaviorHints as Record<string, unknown>) : null;
  const behaviorHints: StremioManifestBehaviorHints | undefined = bhRaw
    ? {
        configurable: typeof bhRaw.configurable === 'boolean' ? bhRaw.configurable : undefined,
        configurationRequired:
          typeof bhRaw.configurationRequired === 'boolean' ? bhRaw.configurationRequired : undefined,
        adult: typeof bhRaw.adult === 'boolean' ? bhRaw.adult : undefined,
        p2p: typeof bhRaw.p2p === 'boolean' ? bhRaw.p2p : undefined,
      }
    : undefined;

  return {
    ok: true,
    manifest: {
      id,
      name,
      version,
      description: typeof m.description === 'string' ? m.description : undefined,
      logo: typeof m.logo === 'string' ? m.logo : undefined,
      background: typeof m.background === 'string' ? m.background : undefined,
      types,
      resources,
      catalogs,
      idPrefixes,
      behaviorHints,
    },
  };
}

/** Normaliza `manifest.resources` (strings ou objetos) combinando com `manifest.types` e `manifest.idPrefixes`. */
export function normalizeManifestResources(manifest: StremioManifest): NormalizedResource[] {
  const out: NormalizedResource[] = [];
  const defaultTypes = Array.isArray(manifest.types) ? manifest.types : [];
  const defaultPrefixes = Array.isArray(manifest.idPrefixes) ? manifest.idPrefixes : [];

  for (let i = 0; i < manifest.resources.length; i++) {
    const r = manifest.resources[i];
    if (typeof r === 'string') {
      out.push({ name: r, types: defaultTypes.slice(), idPrefixes: defaultPrefixes.slice() });
    } else if (r && typeof r === 'object' && r.name) {
      out.push({
        name: r.name,
        types: r.types && r.types.length ? r.types.slice() : defaultTypes.slice(),
        idPrefixes: r.idPrefixes && r.idPrefixes.length ? r.idPrefixes.slice() : defaultPrefixes.slice(),
      });
    }
  }
  return out;
}

/** Verifica se o addon suporta recurso (`stream`, `meta`, `subtitles`, `catalog`), tipo e prefixo do ID. */
export function addonSupportsResource(
  addon: Pick<AddonRecord, 'enabled' | 'manifest'>,
  resourceName: string,
  mediaType?: string,
  mediaId?: string,
): boolean {
  if (!addon || !addon.enabled || !addon.manifest) return false;
  const normalized = normalizeManifestResources(addon.manifest);

  for (let i = 0; i < normalized.length; i++) {
    const res = normalized[i];
    if (res.name !== resourceName) continue;
    if (mediaType && res.types.length > 0 && res.types.indexOf(mediaType) === -1) continue;
    if (mediaId && res.idPrefixes.length > 0) {
      let matchedPrefix = false;
      for (let p = 0; p < res.idPrefixes.length; p++) {
        if (mediaId.indexOf(res.idPrefixes[p]) === 0) {
          matchedPrefix = true;
          break;
        }
      }
      if (!matchedPrefix) continue;
    }
    return true;
  }
  return false;
}

/** Monta ID no padrão Stremio (ex.: `tt0133093`, `tt0944947:1:1`, `tmdb:603`). */
export function buildStremioMediaId(
  baseId: string,
  isSeries: boolean,
  season?: number,
  episode?: number,
): string {
  const clean = (baseId || '').trim();
  if (!clean) return '';
  if (!isSeries) return clean;
  if (typeof season === 'number' && season > 0 && typeof episode === 'number' && episode > 0) {
    // Se já veio com `:s:e`, mantém
    const colonParts = clean.split(':');
    if (colonParts.length >= 3 && /^\d+$/.test(colonParts[colonParts.length - 1])) {
      return clean;
    }
    return clean + ':' + season + ':' + episode;
  }
  return clean;
}

export function isUnsupportedWebVideoUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  return /\.(mkv|avi|flv|wmv|divx|ts|m2ts)$/.test(clean);
}

/** Classifica compatibilidade Web de um `StremioStream` sem usar proxy no servidor. */
export function inspectAddonStreamWebCompat(
  stream: StremioStream,
  hasDebrid: boolean,
  pageIsHttps: boolean,
): AddonWebCompat {
  if (!stream.url && stream.infoHash) {
    if (hasDebrid) {
      return {
        playable: true,
        needsDebrid: true,
        needsNativeOrCors: false,
        badge: 'Debrid',
        reason: 'Resolve sob demanda via conta Debrid.',
      };
    }
    return {
      playable: false,
      needsDebrid: true,
      needsNativeOrCors: false,
      badge: 'Requer Debrid',
      reason: 'Stream P2P/torrent exige uma chave Debrid em Ajustes > Addons.',
    };
  }

  if (!stream.url) {
    return {
      playable: false,
      needsDebrid: false,
      needsNativeOrCors: true,
      badge: 'Requer app nativo / CORS',
      reason: 'Stream sem URL direta reproduzível no navegador.',
    };
  }

  const reqHeaders = stream.behaviorHints && stream.behaviorHints.proxyHeaders && stream.behaviorHints.proxyHeaders.request;
  if (reqHeaders && Object.keys(reqHeaders).length > 0) {
    return {
      playable: false,
      needsDebrid: false,
      needsNativeOrCors: true,
      badge: 'Requer app nativo / CORS',
      reason: 'Exige cabeçalhos HTTP personalizados incompatíveis com reprodução direta no navegador.',
    };
  }

  if (stream.behaviorHints && stream.behaviorHints.notWebReady) {
    return {
      playable: false,
      needsDebrid: false,
      needsNativeOrCors: true,
      badge: 'Requer app nativo / CORS',
      reason: 'Marcado pelo addon como incompatível com navegador (notWebReady).',
    };
  }

  if (pageIsHttps && /^http:\/\//i.test(stream.url)) {
    return {
      playable: false,
      needsDebrid: false,
      needsNativeOrCors: true,
      badge: 'Requer app nativo / CORS',
      reason: 'Stream HTTP bloqueado por página HTTPS (conteúdo misto).',
    };
  }

  if (isUnsupportedWebVideoUrl(stream.url)) {
    return {
      playable: false,
      needsDebrid: false,
      needsNativeOrCors: true,
      badge: 'Requer app nativo / CORS',
      reason: 'Formato MKV/AVI/TS com suporte limitado em navegadores web.',
    };
  }

  return {
    playable: true,
    needsDebrid: false,
    needsNativeOrCors: false,
  };
}

/** Formata tamanho em bytes (ex.: `2.4 GB`) em ES5 puro. */
export function formatStreamByteSize(bytes?: number): string {
  if (!bytes || typeof bytes !== 'number' || bytes <= 0) return '';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return gb.toFixed(1) + ' GB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return Math.round(mb) + ' MB';
  return '';
}

/** Gera rótulo conciso de qualidade/fonte para a lista de fontes do player. */
export function formatAddonStreamLabel(stream: StremioStream, addonName: string): { rotulo: string; detalhe: string } {
  const joined = ((stream.name || '') + ' ' + (stream.title || '') + ' ' + (stream.description || '')).trim();
  const qMatch = /\b(4K|2160p|1080p|720p|480p|HDR10?\+?|DV|Dolby Vision|REMUX)\b/i.exec(joined);
  const langMatch = /\b(DUBLADO|PT-BR|PORTUGUESE|DUAL|LEGENDADO|ENG|MULTI)\b/i.exec(joined);
  const quality = qMatch ? qMatch[1].toUpperCase() : '';
  const lang = langMatch ? langMatch[1].toUpperCase() : '';
  const size = formatStreamByteSize(stream.behaviorHints && stream.behaviorHints.videoSize);

  const headParts: string[] = [];
  if (addonName) headParts.push(addonName);
  if (quality) headParts.push(quality);
  if (lang) headParts.push(lang);

  const rotulo = headParts.length > 0 ? headParts.join(' · ') : (stream.name || 'Addon');
  const rawDesc = (stream.title || stream.description || stream.name || '').replace(/\s+/g, ' ').trim();
  const detalheParts: string[] = [];
  if (rawDesc) detalheParts.push(rawDesc.slice(0, 90));
  if (size && rawDesc.indexOf(size) === -1) detalheParts.push(size);

  return {
    rotulo,
    detalhe: detalheParts.join(' · '),
  };
}

const VALID_DEBRID_PROVIDERS: DebridProviderId[] = ['torbox', 'realdebrid', 'alldebrid', 'premiumize'];

function isValidDebridProvider(p: unknown): p is DebridProviderId {
  return typeof p === 'string' && VALID_DEBRID_PROVIDERS.indexOf(p as DebridProviderId) !== -1;
}

/**
 * Mescla payloads `{ t: "dados", addons?, debrid? }` vindos do Saimo Connect / JSON import.
 * Retrocompatível: payloads `{ t: "dados" }` sem `addons` ou `debrid` não alteram nada e não lançam erro.
 */
export function applyDadosSyncMerge(
  currentAddons: AddonRecord[],
  currentDebrid: DebridAccountConfig[],
  dados: unknown,
): { addons: AddonRecord[]; debrid: DebridAccountConfig[]; addonsUpdated: number; debridUpdated: number } {
  const nextAddons = currentAddons.slice();
  const nextDebrid = currentDebrid.slice();
  let addonsUpdated = 0;
  let debridUpdated = 0;

  if (!dados || typeof dados !== 'object') {
    return { addons: nextAddons, debrid: nextDebrid, addonsUpdated, debridUpdated };
  }

  const payload = dados as DadosSyncPayload;
  // Se vier campo `t`, só processa se `t === 'dados'` (preserva segurança de protocolo)
  if (typeof payload.t === 'string' && payload.t !== 'dados') {
    return { addons: nextAddons, debrid: nextDebrid, addonsUpdated, debridUpdated };
  }

  if (Array.isArray(payload.addons)) {
    for (let i = 0; i < payload.addons.length; i++) {
      const incoming = payload.addons[i];
      if (!incoming || typeof incoming !== 'object') continue;

      const urlCandidate = incoming.manifestUrl || incoming.baseUrl || incoming.url || '';
      const norm = urlCandidate ? normalizeAddonUrl(urlCandidate) : null;
      if (!norm || !norm.ok || !norm.baseUrl || !norm.manifestUrl) continue;

      let parsedManifest: StremioManifest | null = null;
      if (incoming.manifest) {
        const res = parseStremioManifest(incoming.manifest);
        if (res.ok && res.manifest) {
          parsedManifest = res.manifest;
        } else {
          // Manifesto inválido ou Nuvio JS plugin é ignorado com segurança
          continue;
        }
      }

      // Procura por manifestUrl normalizada (ou id se não veio manifesto completo, mas manifestUrl bate)
      let matchIdx = -1;
      for (let j = 0; j < nextAddons.length; j++) {
        if (nextAddons[j].manifestUrl === norm.manifestUrl) {
          matchIdx = j;
          break;
        }
      }
      if (matchIdx === -1 && parsedManifest) {
        for (let j = 0; j < nextAddons.length; j++) {
          if (nextAddons[j].manifest.id === parsedManifest.id && nextAddons[j].baseUrl === norm.baseUrl) {
            matchIdx = j;
            break;
          }
        }
      }

      if (matchIdx >= 0) {
        const existing = nextAddons[matchIdx];
        nextAddons[matchIdx] = {
          id: existing.id,
          baseUrl: norm.baseUrl,
          manifestUrl: norm.manifestUrl,
          queryString: incoming.queryString !== undefined ? String(incoming.queryString) : (norm.queryString || existing.queryString),
          manifest: parsedManifest || existing.manifest,
          enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : existing.enabled,
          addedAt: typeof incoming.addedAt === 'number' ? incoming.addedAt : existing.addedAt,
          order: typeof incoming.order === 'number' ? incoming.order : existing.order,
        };
        addonsUpdated++;
      } else if (parsedManifest) {
        const recordId =
          typeof incoming.id === 'string' && incoming.id.trim()
            ? incoming.id.trim()
            : parsedManifest.id + '_' + (nextAddons.length + 1);
        nextAddons.push({
          id: recordId,
          baseUrl: norm.baseUrl,
          manifestUrl: norm.manifestUrl,
          queryString: norm.queryString || '',
          manifest: parsedManifest,
          enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : true,
          addedAt: typeof incoming.addedAt === 'number' ? incoming.addedAt : Date.now(),
          order: typeof incoming.order === 'number' ? incoming.order : nextAddons.length,
        });
        addonsUpdated++;
      }
    }
    nextAddons.sort((a, b) => a.order - b.order);
  }

  if (Array.isArray(payload.debrid)) {
    for (let i = 0; i < payload.debrid.length; i++) {
      const incoming = payload.debrid[i];
      if (!incoming || typeof incoming !== 'object') continue;
      if (!isValidDebridProvider(incoming.provider)) continue;
      const apiKey = typeof incoming.apiKey === 'string' ? incoming.apiKey.trim() : '';
      if (!apiKey) continue;

      let idx = -1;
      for (let j = 0; j < nextDebrid.length; j++) {
        if (nextDebrid[j].provider === incoming.provider) {
          idx = j;
          break;
        }
      }

      const item: DebridAccountConfig = {
        provider: incoming.provider,
        apiKey,
        enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : true,
        syncWithConnect: typeof incoming.syncWithConnect === 'boolean' ? incoming.syncWithConnect : false,
      };
      if (idx >= 0) {
        nextDebrid[idx] = item;
      } else {
        nextDebrid.push(item);
      }
      debridUpdated++;
    }
  }

  return { addons: nextAddons, debrid: nextDebrid, addonsUpdated, debridUpdated };
}

/** Gera payload `{ t: "dados" }` pronto para exportação/Connect incluindo apenas contas Debrid opt-in (`syncWithConnect === true`). */
export function buildDadosSyncExport(
  addons: AddonRecord[],
  debrid: DebridAccountConfig[],
): DadosSyncPayload {
  const optInDebrid = debrid.filter((d) => Boolean(d.syncWithConnect) && Boolean(d.apiKey && d.apiKey.trim()));
  const payload: DadosSyncPayload = {
    t: 'dados',
    addons: addons.map((a) => ({
      id: a.id,
      baseUrl: a.baseUrl,
      manifestUrl: a.manifestUrl,
      queryString: a.queryString,
      manifest: a.manifest,
      enabled: a.enabled,
      addedAt: a.addedAt,
      order: a.order,
    })),
  };
  if (optInDebrid.length > 0) {
    payload.debrid = optInDebrid.map((d) => ({
      provider: d.provider,
      apiKey: d.apiKey,
      enabled: d.enabled,
      syncWithConnect: true,
    }));
  }
  return payload;
}
