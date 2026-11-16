import type { Movie, MovieSource } from '../types/movie';
import { httpsFirst } from './sourceOrder';
import { proxyBase } from './streamUrl';
import { hasEnabledStreamAddons, resolveAddonStreamsForTitle } from '../services/addons';

function isAllowedTargetHost(hostname: string): boolean {
  return (
    hostname === 'dark-glade-b156.aa4f20382505.workers.dev' ||
    hostname === 'www-fontedecanais-live.77zzhf54vdll71.com' ||
    hostname.endsWith('.77zzhf54vdll71.com')
  );
}

/**
 * `/api/stream` só decide o destino ao ser chamado e pode cair em playlist HLS.
 * Sem o endereço final o player não reconhece o HLS e o navegador recusa o vídeo.
 */
function ehEnderecoDinamico(url: string): boolean {
  try { return new URL(url).pathname === '/api/stream'; } catch { return false; }
}

export type ResolvedMovieSources = MovieSource[] & {
  somenteApp?: boolean;
};

async function resolverRedeFlixDireto(url: string, signal: AbortSignal): Promise<string | null> {
  try {
    const u = new URL(url);
    const idRaw = (u.searchParams.get('id') || '').replace(/^tmdb:/, '');
    const cleanId = idRaw.split(':')[0];
    if (!cleanId || !/^\d+$/.test(cleanId)) return null;

    const tipo = (u.searchParams.get('tipo') || u.searchParams.get('type') || 'movie').toLowerCase();
    const isSerie = tipo === 'series' || tipo === 'tv';
    const s = u.searchParams.get('s') || u.searchParams.get('temporada') || '1';
    const e = u.searchParams.get('e') || u.searchParams.get('episodio') || '1';
    const versao = (u.searchParams.get('versao') || u.searchParams.get('v') || 'dub').toLowerCase();

    const pageUrl = isSerie
      ? `https://redeflixapi.click/serie/${cleanId}/${s}/${e}`
      : `https://redeflixapi.click/filme/${cleanId}`;

    const pageRes = await fetch(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal,
    });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();

    let launchTicket = '';
    const fastMatch = /fastLaunchTickets\s*=\s*(\{.*?\});/.exec(html);
    if (fastMatch?.[1]) {
      try {
        const tickets = JSON.parse(fastMatch[1]);
        launchTicket = versao === 'leg' ? (tickets.legendado || tickets.default) : (tickets.default || tickets.legendado);
      } catch (_) {}
    }
    if (!launchTicket) {
      const mTicket = /playbackResolveTicket\s*=\s*"([^"]+)"/.exec(html);
      if (mTicket?.[1]) launchTicket = mTicket[1];
    }
    if (!launchTicket) return null;

    const sourceRes = await fetch('https://redeflixapi.click/playerkys/source.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'RedeFlixPlayer',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://redeflixapi.click/playerkys/index.html',
        'Origin': 'https://redeflixapi.click',
      },
      body: JSON.stringify({ ticket: launchTicket }),
      signal,
    });
    if (!sourceRes.ok) return null;
    const j = await sourceRes.json();
    return j?.url || null;
  } catch {
    return null;
  }
}

/**
 * `null` quando o servidor afirma que não há vídeo (404): o episódio ainda não
 * saiu em lugar nenhum. Tocar o endereço mesmo assim dava "formato inválido".
 * Limite do provedor (503), rede ou demora mantêm a fonte para o player tentar.
 */
async function resolverDinamica(source: MovieSource, signal: AbortSignal): Promise<{ source: MovieSource | null; somenteApp?: boolean }> {
  try {
    const endereco = new URL(source.url);
    endereco.searchParams.set('json', '1');
    const response = await fetch(endereco.href, { signal });
    if (response.status === 404) {
      const direto = await resolverRedeFlixDireto(source.url, signal);
      if (direto) {
        return { source: { ...source, url: direto }, somenteApp: false };
      }
      try {
        const body = await response.json();
        return { source: null, somenteApp: !!body?.somenteApp };
      } catch {
        return { source: null, somenteApp: true };
      }
    }
    if (!response.ok) {
      const direto = await resolverRedeFlixDireto(source.url, signal);
      if (direto) return { source: { ...source, url: direto }, somenteApp: false };
      return { source };
    }
    const data = await response.json();
    if (typeof data.url === 'string' && data.url) {
      return {
        source: { ...source, url: data.url },
        somenteApp: !!data.somenteApp,
      };
    }
    const direto = await resolverRedeFlixDireto(source.url, signal);
    if (direto) return { source: { ...source, url: direto }, somenteApp: false };
    return {
      source,
      somenteApp: !!data.somenteApp,
    };
  } catch {
    const direto = await resolverRedeFlixDireto(source.url, signal);
    if (direto) return { source: { ...source, url: direto }, somenteApp: false };
    return { source };
  }
}

/** Resolve ao abrir o título: URLs assinadas não ficam gravadas no catálogo. Fontes de addons/Debrid nunca vão ao proxy. */
export async function resolveVodSources(
  original: MovieSource[],
  signal: AbortSignal,
  movieContext?: Pick<Movie, 'type' | 'tmdbId' | 'imdbId' | 'addonMetaId' | 'seasonNumber' | 'episodeNumber'>,
): Promise<ResolvedMovieSources> {
  const temPendente = original.some((s) => s.url === 'addon-stream://pending');
  let baseOriginal = original.filter((s) => s.url !== 'addon-stream://pending');
  const precisaAddons =
    Boolean(movieContext) &&
    (temPendente || (hasEnabledStreamAddons() && !baseOriginal.some((s) => Boolean(s.addonId))));

  if (precisaAddons && movieContext) {
    try {
      const addonRes = await resolveAddonStreamsForTitle({
        tmdbId: movieContext.tmdbId,
        imdbId: movieContext.imdbId,
        addonMetaId: movieContext.addonMetaId,
        isSeries: movieContext.type === 'series',
        season: movieContext.seasonNumber,
        episode: movieContext.episodeNumber,
      });
      if (addonRes.sources.length > 0) {
        baseOriginal = [...baseOriginal, ...addonRes.sources];
      }
    } catch {
      /* falha ao consultar addons fica silenciosa e mantém demais fontes */
    }
  }

  let indicouSomenteApp = false;
  const resolvedDynamics = await Promise.all(baseOriginal.map(async source => {
    if (source.addonId || source.infoHash || source.url.startsWith('addon-debrid://')) {
      return source;
    }
    if (ehEnderecoDinamico(source.url)) {
      const res = await resolverDinamica(source, signal);
      if (res.somenteApp) indicouSomenteApp = true;
      return res.source;
    }
    return source;
  }));
  const sources = resolvedDynamics.filter((source): source is MovieSource => source !== null);
  const candidates = sources.filter(source => {
    if (source.addonId || source.infoHash || source.url.startsWith('addon-debrid://')) return false;
    try {
      const url = new URL(source.url);
      if (url.protocol === 'http:' && url.hostname === 'dbonline.tech-cdn.top') return true;
      if (['http:', 'https:'].includes(url.protocol) && url.hostname === 'hubby-dmca.com') return true;
      return false;
    } catch { return false; }
  }).slice(0, 3);
  const resolvedPairs = await Promise.all(candidates.map(async source => {
    try {
      const response = await fetch(`${proxyBase()}/api/resolve-vod?url=${encodeURIComponent(source.url)}`, { signal });
      if (!response.ok) return null;
      const data = await response.json();
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || !isAllowedTargetHost(url.hostname)) return null;
      return { original: source.url, resolved: { ...source, url: url.href, originalUrl: source.url } as MovieSource };
    } catch { return null; }
  }));
  const resolvedHubbyOriginals = new Set<string>();
  const resolved: MovieSource[] = [];
  for (const pair of resolvedPairs) {
    if (!pair) continue;
    resolved.push(pair.resolved);
    try {
      if (new URL(pair.original).hostname === 'hubby-dmca.com') {
        resolvedHubbyOriginals.add(pair.original);
      }
    } catch { /* ignore */ }
  }
  const remaining = sources.filter(s => !resolvedHubbyOriginals.has(s.url));
  const seen = new Set<string>();
  const finalSources: ResolvedMovieSources = httpsFirst([...resolved, ...remaining]).filter(source => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
  finalSources.somenteApp = indicouSomenteApp;
  return finalSources;
}
