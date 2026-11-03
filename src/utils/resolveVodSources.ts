import type { MovieSource } from '../types/movie';
import { httpsFirst } from './sourceOrder';
import { proxyBase } from './streamUrl';

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

/**
 * `null` quando o servidor afirma que não há vídeo (404): o episódio ainda não
 * saiu em lugar nenhum. Tocar o endereço mesmo assim dava "formato inválido".
 * Limite do provedor (503), rede ou demora mantêm a fonte para o player tentar.
 */
async function resolverDinamica(source: MovieSource, signal: AbortSignal): Promise<MovieSource | null> {
  try {
    const endereco = new URL(source.url);
    endereco.searchParams.set('json', '1');
    const response = await fetch(endereco.href, { signal });
    if (response.status === 404) return null;
    if (!response.ok) return source;
    const data = await response.json();
    return typeof data.url === 'string' && data.url ? { ...source, url: data.url } : source;
  } catch { return source; }
}

/** Resolve ao abrir o título: URLs assinadas não ficam gravadas no catálogo. */
export async function resolveVodSources(original: MovieSource[], signal: AbortSignal): Promise<MovieSource[]> {
  const sources = (await Promise.all(original.map(source =>
    ehEnderecoDinamico(source.url) ? resolverDinamica(source, signal) : source)))
    .filter((source): source is MovieSource => source !== null);
  const candidates = sources.filter(source => {
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
  return httpsFirst([...resolved, ...remaining]).filter(source => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}
