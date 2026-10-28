/**
 * Endpoint central de streaming para filmes e séries do Saimo TV.
 *
 * Resolve o stream sob demanda nos provedores (FenixFlix / Magnetflix)
 * e redireciona (HTTP 302) para a URL direta do vídeo com token fresco.
 *
 * Funciona de forma transparente em TODOS os aplicativos e no site:
 *   /api/stream?tipo=movie&id=533535
 *   /api/stream?tipo=series&id=194764&s=1&e=1&versao=dub
 */

const FENIX_BASE = 'https://fenixflix.fenixhub.online';
const MAGNET_BASE = 'https://magnetflix.flixbr.online';
const FROST_BASE = 'https://froststream.cloutteam.com';
const HOLLY_BASE = 'https://embedplayer2.xyz';
const REDEFLIX_BASE = 'https://redeflixapi.bar';
const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const AGENTE_FROST = 'OnePlay-Matrix/3.3.9 Kodi';

async function melhorVarianteHls(masterUrl: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(masterUrl, { headers: { 'User-Agent': AGENTE }, signal: ctrl.signal });
    if (!r.ok) return null;
    const texto = await r.text();
    let melhorBw = -1;
    let melhorUrl: string | null = null;
    let pendente = -1;
    const baseDir = masterUrl.substring(0, masterUrl.lastIndexOf('/'));
    for (const raw of texto.split('\n')) {
      const linha = raw.trim();
      if (linha.startsWith('#EXT-X-STREAM-INF')) {
        const m = /BANDWIDTH=(\d+)/.exec(linha);
        pendente = m ? parseInt(m[1], 10) : 0;
      } else if (pendente >= 0 && linha && !linha.startsWith('#')) {
        const u = linha.startsWith('http') ? linha : `${baseDir}/${linha}`;
        if (melhorUrl === null || pendente > melhorBw) {
          melhorBw = pendente;
          melhorUrl = u;
        }
        pendente = -1;
      }
    }
    return melhorUrl;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function buscarRedeFlix(tmdbId: string, isSerie: boolean, season: string, episode: string, versao: string): Promise<string | null> {
  if (!/^\d+$/.test(tmdbId)) return null;
  const pagina = isSerie
    ? `${REDEFLIX_BASE}/serie/${tmdbId}/${season}/${episode}`
    : `${REDEFLIX_BASE}/filme/${tmdbId}`;
  const servidores = versao === 'leg' ? ['legendado', 'default'] : ['default', 'legendado'];
  for (const servidor of servidores) {
    try {
      const r1 = await fetch(pagina, {
        headers: {
          'User-Agent': AGENTE,
          'Accept': 'text/html,*/*;q=0.8',
          'Referer': `${REDEFLIX_BASE}/`,
        },
      });
      if (!r1.ok) continue;
      const html = await r1.text();
      const m = /playbackResolveTicket\s*=\s*["']([^"']+)["']/.exec(html);
      if (!m?.[1]) continue;
      const r2 = await fetch(`${REDEFLIX_BASE}/playback-resolve.php`, {
        method: 'POST',
        headers: {
          'User-Agent': AGENTE,
          'X-Requested-With': 'RedeFlixPlayer',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Referer': pagina,
          'Origin': REDEFLIX_BASE,
        },
        body: JSON.stringify({ ticket: m[1], server: servidor }),
      });
      if (!r2.ok) continue;
      const j2 = (await r2.json()) as { launchTicket?: string };
      if (!j2?.launchTicket) continue;
      const r3 = await fetch(`${REDEFLIX_BASE}/playerkys/source.php`, {
        method: 'POST',
        headers: {
          'User-Agent': AGENTE,
          'X-Requested-With': 'RedeFlixPlayer',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Referer': pagina,
          'Origin': REDEFLIX_BASE,
        },
        body: JSON.stringify({ ticket: j2.launchTicket }),
      });
      if (!r3.ok) continue;
      const j3 = (await r3.json()) as { url?: string };
      if (j3?.url) return j3.url;
    } catch {}
  }
  return null;
}

interface StreamItem {
  name?: string;
  title?: string;
  url?: string;
  behaviorHints?: { bingeGroup?: string };
}

function classificar(s: StreamItem): 'dub' | 'leg' {
  const texto = `${s.name || ''} ${s.title || ''} ${s.behaviorHints?.bingeGroup || ''}`.toLowerCase();
  if (texto.includes('dub') || texto.includes('dual') || texto.includes('nacional') || texto.includes('🇧🇷') || texto.includes('pt-br') || texto.includes('português') || texto.includes('portugues')) {
    return 'dub';
  }
  if (texto.includes('leg') || texto.includes('sub') || texto.includes('legendado')) {
    return 'leg';
  }
  return 'dub';
}

interface AddonResult {
  streams: StreamItem[];
  status: number;
  err?: string;
}

async function buscarAddon(url: string, timeoutMs: number = 5000, customAgent?: string): Promise<AddonResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': customAgent || (url.includes('froststream') ? AGENTE_FROST : AGENTE), 'Accept': 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return { streams: [], status: res.status, err: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { streams?: StreamItem[] };
    return { streams: data.streams || [], status: res.status };
  } catch (e: any) {
    return { streams: [], status: 0, err: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

async function buscarNoCatalogo(id: string, isSerie: boolean, season: string, episode: string, versao: string): Promise<string | null> {
  const CATALOG_BASE = 'https://filmes-saimo.pages.dev';
  try {
    const fichasRes = await fetch(`${CATALOG_BASE}/fichas.txt`);
    if (!fichasRes.ok) return null;
    const fichasTxt = await fichasRes.text();
    const prefixoTipo = isSerie ? 's' : 'f';
    let tituloAchado = '';
    for (const linha of fichasTxt.split('\n')) {
      const p = linha.split('\t');
      if (p.length >= 3 && p[0] === prefixoTipo && p[2] === id) {
        tituloAchado = p[1];
        break;
      }
    }
    if (!tituloAchado) return null;

    const norm = tituloAchado.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
    const inicial = norm.charAt(0).toUpperCase();
    const l = (inicial >= 'A' && inicial <= 'Z') ? inicial : '#';

    if (!isSerie) {
      const fRes = await fetch(`${CATALOG_BASE}/filmes-${l}.txt`);
      if (!fRes.ok) return null;
      const fTxt = await fRes.text();
      for (const linha of fTxt.split('\n')) {
        const p = linha.split('\t');
        if (p.length >= 2 && (p[0] === tituloAchado || p[0].startsWith(tituloAchado.split(' (')[0]))) {
          for (let i = 1; i < p.length; i++) {
            if (p[i].startsWith(`${versao}=`) || p[i].startsWith('dub=') || p[i].startsWith('leg=')) {
              const urls = p[i].substring(4).split(',');
              for (const u of urls) {
                if (u && !u.includes('api/stream')) return u;
              }
            }
          }
        }
      }
    }
  } catch {}
  return null;
}

/** Servidores que deixaram de servir os arquivos (403 permanente): nunca entregar. */
const SERVIDORES_MORTOS = ['pub-bda823ef358c448ea310cdf9539f9628.r2.dev'];

/**
 * HTTPS só onde se sabe que existe. O `new URL` some com o `:80` explícito
 * (porta padrão do http), então a checagem antiga virava `https://host:80/`,
 * endereço que nunca abre: os addons entregam quase tudo em http numa porta 80.
 */
function normalizar(url: string): string {
  if (/^https:\/\/[^/]+:80\//.test(url)) return 'http://' + url.slice(8);
  if (url.startsWith('http://')) {
    try {
      if (/\.(workers\.dev|pages\.dev|r2\.dev)$/.test(new URL(url).hostname)) return 'https://' + url.slice(7);
    } catch { /* fica como veio */ }
  }
  return url;
}

/**
 * Pede o começo do vídeo (ou a playlist) e devolve o endereço final, depois
 * dos redirecionamentos, quando há vídeo de verdade; null quando não.
 */
async function respondeVideo(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': AGENTE, 'Range': 'bytes=0-1023' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    if (r.status >= 400 || !r.body) return null;
    // Só o primeiro pedaço: servidor que ignora o Range mandaria o filme inteiro.
    const leitor = r.body.getReader();
    const { value } = await leitor.read();
    leitor.cancel().catch(() => {});
    const corpo = (value ?? new Uint8Array()).slice(0, 1024);
    const inicio = new TextDecoder().decode(corpo.slice(0, 16)).trimStart();
    if (inicio.startsWith('#EXTM3U')) return r.url || url;
    if (corpo.length === 0 || corpo[0] === 0x3c /* < */ || corpo[0] === 0x7b /* { */) return null;
    return r.url || url;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const onRequestGet: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const tipo = (url.searchParams.get('tipo') || url.searchParams.get('type') || 'movie').toLowerCase();
  let id = (url.searchParams.get('id') || '').trim();
  const s = url.searchParams.get('s') || url.searchParams.get('t') || url.searchParams.get('temporada') || '1';
  const e = url.searchParams.get('e') || url.searchParams.get('ep') || url.searchParams.get('episodio') || '1';
  const versao = (url.searchParams.get('versao') || url.searchParams.get('v') || 'dub').toLowerCase();
  const querJson = url.searchParams.get('json') === '1';

  if (!id) {
    return new Response(JSON.stringify({ error: 'Parâmetro "id" é obrigatório' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Suporte a IDs combinados tipo "194764:1:1" no parâmetro id
  let season = s;
  let episode = e;
  if (id.includes(':')) {
    const partes = id.split(':');
    id = partes[0];
    if (partes.length >= 3) {
      season = partes[1];
      episode = partes[2];
    }
  }

  const cleanId = id.replace(/^(tmdb:|imdb:)/i, '');

  const BLACKLIST_IDS = new Set(['1400940']);
  if (BLACKLIST_IDS.has(cleanId)) {
    return new Response(JSON.stringify({ error: 'Título indisponível ou somente em cartaz nos cinemas' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
  const prefixId = cleanId.startsWith('tt') ? cleanId : `tmdb:${cleanId}`;
  const isSerie = tipo === 'series' || tipo === 'tv';

  let imdbId = cleanId.startsWith('tt') ? cleanId : '';
  if (!imdbId && /^\d+$/.test(cleanId)) {
    try {
      const extRes = await fetch(
        `https://api.themoviedb.org/3/${isSerie ? 'tv' : 'movie'}/${cleanId}/external_ids?api_key=15d2ea6d0dc1d476efbca3eba2b9bbfb`,
        { headers: { 'User-Agent': AGENTE, 'Accept': 'application/json' } }
      );
      if (extRes.ok) {
        const extData = (await extRes.json()) as { imdb_id?: string };
        if (extData?.imdb_id) {
          imdbId = extData.imdb_id;
        }
      }
    } catch {}
  }

  const fenixUrl = isSerie
    ? `${FENIX_BASE}/stream/series/${prefixId}:${season}:${episode}.json`
    : `${FENIX_BASE}/stream/movie/${prefixId}.json`;

  const magnetUrl = isSerie
    ? `${MAGNET_BASE}/stream/series/${prefixId}:${season}:${episode}.json`
    : `${MAGNET_BASE}/stream/movie/${prefixId}.json`;

  const frostUrl = imdbId ? (isSerie
    ? `${FROST_BASE}/stream/series/${imdbId}:${season}:${episode}.json`
    : `${FROST_BASE}/stream/movie/${imdbId}.json`) : null;

  const hollyUrl = isSerie
    ? `${HOLLY_BASE}/stream/series/${prefixId}:${season}:${episode}.json`
    : `${HOLLY_BASE}/stream/movie/${prefixId}.json`;

  // Busca em paralelo nas origens comuns (FenixFlix, Magnetflix, FrostStream, Hollymovies).
  let todos: StreamItem[] = [];
  for (let tentativa = 0; tentativa < 2 && todos.length === 0; tentativa++) {
    const consultas: Promise<AddonResult>[] = [
      buscarAddon(fenixUrl, 8000),
      buscarAddon(magnetUrl, 8000),
      buscarAddon(hollyUrl, 8000),
    ];
    if (frostUrl) {
      consultas.push(buscarAddon(frostUrl, 8000, AGENTE_FROST));
    }
    if (imdbId && !cleanId.startsWith('tt')) {
      const fenixImdb = isSerie
        ? `${FENIX_BASE}/stream/series/${imdbId}:${season}:${episode}.json`
        : `${FENIX_BASE}/stream/movie/${imdbId}.json`;
      consultas.push(buscarAddon(fenixImdb, 8000));
    }
    const resultados = await Promise.all(consultas);
    todos = resultados.flatMap(r => r.streams).filter(st => !!st.url);
  }

  // Filtra streams com arquivos de outros filmes associados erroneamente pelo provedor
  todos = todos.filter(st => {
    if (cleanId !== '432613' && st.url && (st.url.includes('98853.mp4') || st.url.includes('Cara.mp4') || st.url.includes('97968.mp4'))) {
      return false;
    }
    return true;
  });

  if (todos.length === 0) {
    const doCatalogo = await buscarNoCatalogo(cleanId, isSerie, season, episode, versao);
    if (doCatalogo) {
      todos = [{ url: doCatalogo, title: 'Catálogo Saimo' }];
    }
  }

  // Ordem: a versão pedida primeiro, depois as outras (legendado vale mais que nada).
  const ordenados = [
    ...todos.filter(st => classificar(st) === versao),
    ...todos.filter(st => classificar(st) !== versao),
  ].filter(st => !SERVIDORES_MORTOS.some(h => st.url!.includes(h)));

  // Testa antes de entregar: provedor costuma listar primeiro um link que já
  // morreu (o R2 de terceiros que passou a dar 403) com um bom logo atrás.
  // Os quatro testados ao mesmo tempo (no máximo 5 s no total); vale o
  // primeiro, na ordem de preferência, que respondeu com vídeo.
  const testados = await Promise.all(ordenados.slice(0, 4).map(st => respondeVideo(normalizar(st.url!))));
  let escolhido = testados.find((u): u is string => !!u) ?? '';
  let ehUsoUnico = false;

  if (escolhido && escolhido.includes('embedplayer2.xyz') && escolhido.endsWith('.m3u8')) {
    const melhor = await melhorVarianteHls(escolhido);
    if (melhor) escolhido = melhor;
  }

  // 404: cadeia RedeFlix (3 saltos, uso unico) entra no FIM, fora do probe e sem cache.
  if (!escolhido) {
    const redeflixUrl = await buscarRedeFlix(cleanId, isSerie, season, episode, versao);
    if (redeflixUrl) {
      escolhido = redeflixUrl;
      ehUsoUnico = true;
    }
  }

  if (!escolhido) {
    if (ordenados.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum stream disponível para este título' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
      });
    }
    escolhido = normalizar(ordenados[0].url!);
  }

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Cache-Control', ehUsoUnico ? 'no-store' : 'public, max-age=600');

  if (querJson) {
    headers.set('Content-Type', 'application/json');
    return new Response(JSON.stringify({
      url: escolhido,
      tipo,
      id: cleanId,
      temporada: isSerie ? parseInt(season, 10) : undefined,
      episodio: isSerie ? parseInt(episode, 10) : undefined,
      versao,
    }), { status: 200, headers });
  }

  headers.set('Location', escolhido);
  return new Response(null, { status: 302, headers });
};

export const onRequestHead = onRequestGet;

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
};
