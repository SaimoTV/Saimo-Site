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
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(masterUrl, { headers: { 'User-Agent': AGENTE }, signal: ctrl.signal });
    if (!r.ok) return null;
    const texto = await r.text();
    let melhorBw = -1;
    let melhorUrl: string | null = null;
    let pendente = -1;
    const baseDir = masterUrl.split('?')[0].substring(0, masterUrl.split('?')[0].lastIndexOf('/'));
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

async function buscarRedeFlix(tmdbId: string, isSerie: boolean, season: string, episode: string, versao: string, clientIp?: string, debugObj?: any): Promise<string | null> {
  if (!/^\d+$/.test(tmdbId)) return null;
  const pagina = isSerie
    ? `${REDEFLIX_BASE}/serie/${tmdbId}/${season}/${episode}`
    : `${REDEFLIX_BASE}/filme/${tmdbId}`;
  const servidores = versao === 'leg' ? ['legendado', 'default'] : ['default', 'legendado'];
  const baseHeaders: Record<string, string> = {
    'User-Agent': AGENTE,
    'Accept': 'text/html,*/*;q=0.8',
    'Referer': `${REDEFLIX_BASE}/`,
  };
  if (clientIp) {
    baseHeaders['X-Forwarded-For'] = clientIp;
  }
  for (const servidor of servidores) {
    try {
      const c1 = new AbortController();
      const t1 = setTimeout(() => c1.abort(), 4000);
      const r1 = await fetch(pagina, {
        headers: baseHeaders,
        signal: c1.signal,
      });
      clearTimeout(t1);
      if (debugObj) debugObj.r1 = { status: r1.status, ok: r1.ok };
      if (!r1.ok) continue;
      const html = await r1.text();
      const m = /playbackResolveTicket\s*=\s*["']([^"']+)["']/.exec(html);
      if (debugObj) debugObj.hasTicket = !!m?.[1];
      if (!m?.[1]) continue;
      const c2 = new AbortController();
      const t2 = setTimeout(() => c2.abort(), 4000);
      const r2Headers: Record<string, string> = {
        'User-Agent': AGENTE,
        'X-Requested-With': 'RedeFlixPlayer',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Referer': pagina,
        'Origin': REDEFLIX_BASE,
      };
      if (clientIp) {
        r2Headers['X-Forwarded-For'] = clientIp;
      }
      const r2 = await fetch(`${REDEFLIX_BASE}/playback-resolve.php`, {
        method: 'POST',
        headers: r2Headers,
        body: JSON.stringify({ ticket: m[1], server: servidor }),
        signal: c2.signal,
      });
      clearTimeout(t2);
      if (debugObj) debugObj.r2 = { status: r2.status, ok: r2.ok };
      if (!r2.ok) {
        if (debugObj) debugObj.r2Body = (await r2.text()).slice(0, 200);
        continue;
      }
      const j2 = (await r2.json()) as { launchTicket?: string };
      if (debugObj) debugObj.hasLaunch = !!j2?.launchTicket;
      if (!j2?.launchTicket) continue;
      const c3 = new AbortController();
      const t3 = setTimeout(() => c3.abort(), 4000);
      const r3Headers: Record<string, string> = {
        'User-Agent': AGENTE,
        'X-Requested-With': 'RedeFlixPlayer',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Referer': pagina,
        'Origin': REDEFLIX_BASE,
      };
      if (clientIp) {
        r3Headers['X-Forwarded-For'] = clientIp;
      }
      const r3 = await fetch(`${REDEFLIX_BASE}/playerkys/source.php`, {
        method: 'POST',
        headers: r3Headers,
        body: JSON.stringify({ ticket: j2.launchTicket }),
        signal: c3.signal,
      });
      clearTimeout(t3);
      if (debugObj) debugObj.r3 = { status: r3.status, ok: r3.ok };
      if (!r3.ok) continue;
      const j3 = (await r3.json()) as { url?: string };
      if (debugObj) debugObj.finalUrl = j3?.url;
      if (j3?.url) return j3.url;
    } catch (e: any) {
      if (debugObj) debugObj.err = e?.message || String(e);
    }
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
  raw?: string;
}

async function buscarAddon(url: string, timeoutMs: number = 5000, customAgent?: string, clientIp?: string): Promise<AddonResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const sep = url.includes('?') ? '&' : '?';
    const fetchUrl = `${url}${sep}_cf=${Date.now()}`;
    const baseHeaders: Record<string, string> = {
      'User-Agent': customAgent || (url.includes('froststream') ? AGENTE_FROST : AGENTE),
      'Accept': 'application/json',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    };
    if (clientIp) {
      baseHeaders['X-Forwarded-For'] = clientIp;
      baseHeaders['CF-Connecting-IP'] = clientIp;
    }
    const res = await fetch(fetchUrl, {
      headers: baseHeaders,
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) {
      return { streams: [], status: res.status, err: `HTTP ${res.status}` };
    }
    const text = await res.text();
    let data: { streams?: StreamItem[] } = {};
    try { data = JSON.parse(text); } catch {}
    return { streams: data.streams || [], status: res.status, raw: text.slice(0, 200) };
  } catch (e: any) {
    return { streams: [], status: 0, err: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

const BASES_CACHE: Record<string, string> = {
  '0': 'http://desativado.invalid/up.kiwi/movie/351921603109/34939156/',
  '1': 'http://desativado.invalid/up.kiwi/series/351921603109/34939156/',
  '2': 'http://tjtor8411.com:80/movie/Osiel123/Felicidade321/',
  '3': 'http://tjtor8411.com:80/series/Osiel123/Felicidade321/',
  '4': 'http://desativado.invalid/hubby.cx/movie/Pdsrv-vods/726216683528qroqv/',
  '5': 'http://desativado.invalid/hubby.cx/series/Pdsrv-vods/726216683528qroqv/',
  '6': 'http://proxy.nr3.xyz:80/movie/daniellytvc/danielly2396/',
  '7': 'http://proxy.nr3.xyz:80/series/daniellytvc/danielly2396/',
  '8': 'http://tvonhdbr.com:80/movie/493754/NqCxf1/',
  '9': 'http://tvonhdbr.com:80/series/493754/NqCxf1/',
  '10': 'http://corruptx.org:80/movie/3llohwk4g9/kwf099q30o/',
  '11': 'http://corruptx.org:80/series/3llohwk4g9/kwf099q30o/',
  '12': 'http://vaiagora.vip:80/movie/5q8VUj/5BeUd8/',
  '13': 'http://vaiagora.vip:80/series/5q8VUj/5BeUd8/',
  '14': 'http://vivlar.me:80/movie/497238/KK8Kdy/',
  '15': 'http://vivlar.me:80/series/497238/KK8Kdy/',
  '16': 'http://corruptx.org:80/movie/hfp5ejnrey/zq0u3kzads/',
  '17': 'http://corruptx.org:80/series/hfp5ejnrey/zq0u3kzads/',
};

function expandBaseUrl(u: string): string {
  const limpa = u.trim();
  if (!limpa) return '';
  if (limpa.startsWith('http://') || limpa.startsWith('https://')) return limpa;
  const m = /^(\d+):(.+)$/.exec(limpa);
  if (m) {
    const baseId = m[1];
    const path = m[2];
    const host = BASES_CACHE[baseId];
    if (host && !host.includes('desativado.invalid')) {
      const ext = path.includes('.') ? '' : '.mp4';
      return `${host}${path}${ext}`;
    }
  }
  return '';
}

async function buscarNoCatalogo(id: string, isSerie: boolean, season: string, episode: string, versao: string): Promise<string | null> {
  if (id === '1058424' || id === '1400940') return null; // Hope (2026) e Clayface (2026) são inéditos
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
    if (!tituloAchado) {
      const aliasId = TMDB_ALIASES[id];
      if (aliasId && aliasId !== id) {
        return buscarNoCatalogo(aliasId, isSerie, season, episode, versao);
      }
      return null;
    }

    const norm = tituloAchado.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim();
    const inicial = norm.charAt(0).toUpperCase();
    const l = (inicial >= 'A' && inicial <= 'Z') ? inicial : '#';

    if (!isSerie) {
      const fRes = await fetch(`${CATALOG_BASE}/filmes-${l}.txt`);
      if (!fRes.ok) return null;
      const fTxt = await fRes.text();
      const normAlvo = tituloAchado.toLowerCase().replace(/[^a-z0-9]/g, '');
      const baseAlvo = tituloAchado.split(' (')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const linha of fTxt.split('\n')) {
        const p = linha.split('\t');
        if (p.length >= 2) {
          const normLinha = p[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normLinha === normAlvo || (baseAlvo.length >= 3 && normLinha.startsWith(baseAlvo))) {
            for (let i = 1; i < p.length; i++) {
              if (p[i].startsWith(`${versao}=`) || p[i].startsWith('dub=') || p[i].startsWith('leg=')) {
                const urls = p[i].substring(4).split(',');
                for (const u of urls) {
                  const exp = expandBaseUrl(u);
                  if (exp && !exp.includes('api/stream') && !SERVIDORES_MORTOS.some(h => exp.includes(h))) return exp;
                }
              }
            }
          }
        }
      }
    } else {
      // 1. Consulta series-${l}.txt para achar a parte do arquivo de episódios
      const sIndexRes = await fetch(`${CATALOG_BASE}/series-${l}.txt`);
      let parte = '0';
      if (sIndexRes.ok) {
        const sIndexTxt = await sIndexRes.text();
        const normAlvo = tituloAchado.toLowerCase().replace(/[^a-z0-9]/g, '');
        const baseAlvo = tituloAchado.split(' (')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const linha of sIndexTxt.split('\n')) {
          const p = linha.split('\t');
          if (p.length >= 3) {
            const normP = p[0].toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normP === normAlvo || (baseAlvo.length >= 3 && normP.startsWith(baseAlvo))) {
              parte = p[2] || '0';
              break;
            }
          }
        }
      }

      // 2. Lê series-${l}-${parte}.txt
      const epRes = await fetch(`${CATALOG_BASE}/series-${l}-${parte}.txt`);
      if (epRes.ok) {
        const epTxt = await epRes.text();
        const normAlvo = tituloAchado.toLowerCase().replace(/[^a-z0-9]/g, '');
        const baseAlvo = tituloAchado.split(' (')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        let dentroDoBloco = false;
        let achouOutraVersao: string | null = null;

        for (const linha of epTxt.split('\n')) {
          const lTrim = linha.trim();
          if (lTrim.startsWith('@')) {
            const normHeader = lTrim.slice(1).toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normHeader === normAlvo || (baseAlvo.length >= 3 && normHeader.startsWith(baseAlvo))) {
              dentroDoBloco = true;
            } else if (dentroDoBloco) {
              break; // Saiu do bloco da série
            }
            continue;
          }
          if (!dentroDoBloco) continue;

          // Formato: season \t episode \t versao(dub/leg) \t urls
          const partes = linha.split('\t');
          if (partes.length >= 4) {
            const epSeason = partes[0].trim();
            const epNum = partes[1].trim();
            const epVersao = partes[2].trim().toLowerCase();
            const epUrls = partes[3].split(',');

            if (epSeason === season && epNum === episode) {
              for (const u of epUrls) {
                const urlLimpa = expandBaseUrl(u.trim());
                if (urlLimpa && !urlLimpa.includes('api/stream') && !SERVIDORES_MORTOS.some(h => urlLimpa.includes(h))) {
                  if (epVersao === versao || epVersao.startsWith(versao)) {
                    return urlLimpa;
                  }
                  if (!achouOutraVersao) achouOutraVersao = urlLimpa;
                }
              }
            }
          }
        }
        if (achouOutraVersao) return achouOutraVersao;
      }
    }
  } catch {}
  return null;
}

/** Servidores que deixaram de servir os arquivos (403 permanente ou offline): nunca entregar. */
const SERVIDORES_MORTOS = [
  'pub-bda823ef358c448ea310cdf9539f9628.r2.dev',
  'praia13.com',
  '123flmsfree.com',
  'vod-limit-media',
  'cdn.hermesnewone.com',
  'speed2.megafilmeshd9.com',
  'cdn-sv01.maximaimg.online',
  'strm15.uqload.vc',
  'megaembed.com',
  'clickhost.xyz',
  'playercdnx.workers.dev',
  '146.0.32.89',
  'corruptx.org',
  'governosptx.org',
  'desativado.invalid',
];

/** Aliases para títulos recém-lançados ou sequências que compartilham acervo nos provedores */
const TMDB_ALIASES: Record<string, string> = {
};

/**
 * HTTPS só onde se sabe que existe. O `new URL` some com o `:80` explícito
 * (porta padrão do http), então a checagem antiga virava `https://host:80/`,
 * endereço que nunca abre: os addons entregam quase tudo em http numa porta 80.
 */
function normalizar(url: string): string {
  if (!url) return '';
  if (/^https:\/\/[^/]+:80\//.test(url)) return 'http://' + url.slice(8);
  if (url.startsWith('http://')) {
    // Se tem porta explícita (como :80 ou :8080), não força https pois quebra o handshake TLS
    if (/:[0-9]+\//.test(url)) return url;
    try {
      const u = new URL(url);
      if (!u.port && (/\.(workers\.dev|pages\.dev|r2\.dev|b-cdn\.net)$/i.test(u.hostname) || u.hostname === 'cdn.vdcdpstop.lat')) {
        return 'https://' + url.slice(7);
      }
    } catch { /* fica como veio */ }
  }
  return url;
}

/**
 * Servidores que exigem cabeçalhos específicos para entregar a URL final.
 * FrostStream redireciona (302) para o servidor real de vídeo quando chamado com Referer e User-Agent Kodi.
 */
async function desmascararFrost(url: string): Promise<string | null> {
  if (!url.includes('froststream.cloutteam.com')) return url;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': AGENTE_FROST,
        'Referer': 'https://froststream.cloutteam.com/',
      },
      redirect: 'manual',
      signal: ctrl.signal,
    });
    const loc = r.headers.get('Location');
    return loc ? normalizar(loc) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pede o começo do vídeo (ou a playlist) e devolve o endereço final, depois
 * dos redirecionamentos, quando há vídeo de verdade; null quando não.
 */
async function respondeVideo(url: string): Promise<string | null> {
  let alvo = url;
  if (alvo.includes('froststream.cloutteam.com')) {
    const d = await desmascararFrost(alvo);
    if (!d) return null;
    alvo = d;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const testHeaders: Record<string, string> = {
      'User-Agent': AGENTE,
      'Accept': '*/*',
      'Range': 'bytes=0-1023',
    };
    if (alvo.includes('embedplayer2.xyz')) {
      testHeaders['Referer'] = 'https://embedplayer2.xyz/';
    }
    const r = await fetch(alvo, {
      headers: testHeaders,
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
    if (inicio.startsWith('#EXTM3U')) return normalizar(r.url || alvo);
    if (corpo.length === 0 || corpo[0] === 0x3c /* < */ || corpo[0] === 0x7b /* { */) return null;
    return normalizar(r.url || alvo);
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
  const querDebug = url.searchParams.get('debug') === '1';
  const clientIp = request.headers.get('cf-connecting-ip') || '';

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

  const BLACKLIST_IDS = new Set(['1400940', '1058424']); // 1400940 = Clayface (2026), 1058424 = Hope (2026)
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
  const consultas: Promise<AddonResult>[] = [
    buscarAddon(fenixUrl, 5000, undefined, clientIp),
    buscarAddon(magnetUrl, 5000, undefined, clientIp),
    buscarAddon(hollyUrl, 5000, undefined, clientIp),
  ];
  if (frostUrl) {
    consultas.push(buscarAddon(frostUrl, 5000, AGENTE_FROST, clientIp));
  }
  if (imdbId && !cleanId.startsWith('tt')) {
    const fenixImdb = isSerie
      ? `${FENIX_BASE}/stream/series/${imdbId}:${season}:${episode}.json`
      : `${FENIX_BASE}/stream/movie/${imdbId}.json`;
    consultas.push(buscarAddon(fenixImdb, 5000, undefined, clientIp));
  }
  const aliasId = TMDB_ALIASES[cleanId];
  if (aliasId) {
    const aliasFenix = isSerie
      ? `${FENIX_BASE}/stream/series/tmdb:${aliasId}:${season}:${episode}.json`
      : `${FENIX_BASE}/stream/movie/tmdb:${aliasId}.json`;
    consultas.push(buscarAddon(aliasFenix, 5000, undefined, clientIp));
  }
  const resultados = await Promise.all(consultas);
  todos = resultados.flatMap(r => r.streams).filter(st => !!st.url);

  // Filtra streams com arquivos de outros filmes associados erroneamente ou em servidores mortos
  todos = todos.filter(st => {
    if (!st.url) return false;
    if (SERVIDORES_MORTOS.some(h => st.url!.includes(h))) return false;
    if (cleanId !== '432613' && (st.url.includes('98853.mp4') || st.url.includes('Cara.mp4') || st.url.includes('97968.mp4'))) {
      return false;
    }
    if (cleanId === '1058424' && (st.url.includes('313329.mp4') || st.url.includes('313368.mp4') || st.url.includes('Impacto.mp4'))) {
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
  // Os quatro testados ao mesmo tempo (no máximo 4 s no total); vale o
  // primeiro, na ordem de preferência, que respondeu com vídeo.
  const testados = await Promise.all(ordenados.slice(0, 4).map(st => respondeVideo(normalizar(st.url!))));
  let escolhido = testados.find((u): u is string => !!u) ?? '';
  let ehUsoUnico = false;

  if (!escolhido) {
    const doCatalogo = await buscarNoCatalogo(cleanId, isSerie, season, episode, versao);
    if (doCatalogo) {
      const resp = await respondeVideo(normalizar(doCatalogo));
      escolhido = resp || normalizar(doCatalogo);
    }
  }

  if (escolhido && escolhido.includes('embedplayer2.xyz')) {
    escolhido = escolhido.replace(/\/master\.(?:m3u8|txt)(?:\?[^"'\s]*)?/, '/master.txt');
  }

  let redeflixDebug: any = {};
  // Cadeia RedeFlix: entra quando nenhum addon respondeu vídeo válido
  if (!escolhido) {
    try {
      const redeflixUrl = await buscarRedeFlix(cleanId, isSerie, season, episode, versao, clientIp, redeflixDebug);
      redeflixDebug.redeflixUrl = redeflixUrl;
      if (redeflixUrl) {
        escolhido = redeflixUrl;
        ehUsoUnico = true;
      }
    } catch (e: any) {
      redeflixDebug.error = e?.message || String(e);
    }
  }

  if (querDebug) {
    const dbgHeaders = new Headers();
    dbgHeaders.set('Access-Control-Allow-Origin', '*');
    dbgHeaders.set('Content-Type', 'application/json');
    dbgHeaders.set('Cache-Control', 'no-store');
    return new Response(JSON.stringify({
      escolhido,
      ehUsoUnico,
      ehFallback: false,
      redeflixDebug,
      urlsConsultadas: { fenixUrl, magnetUrl, hollyUrl, frostUrl, fenixImdb: (imdbId && !cleanId.startsWith('tt')) ? `${FENIX_BASE}/stream/movie/${imdbId}.json` : null },
      resultadosAddons: resultados.map((r, i) => ({ status: r.status, err: r.err, count: r.streams.length, raw: r.raw })),
      testados,
      ordenadosCount: ordenados.length,
      todosCount: todos.length,
      ordenados: ordenados.map(o => ({ name: o.name, title: o.title, url: o.url })),
    }, null, 2), { status: 200, headers: dbgHeaders });
  }

  let ehFallback = false;
  if (!escolhido) {
    const validos = ordenados.filter(st => !SERVIDORES_MORTOS.some(h => st.url!.includes(h)));
    if (validos.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum stream disponível para este título' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
      });
    }
    let candidato = normalizar(validos[0].url!);
    if (candidato.includes('froststream.cloutteam.com')) {
      const d = await desmascararFrost(candidato);
      if (d) candidato = d;
    }
    escolhido = candidato;
    ehFallback = true;
  }

  escolhido = normalizar(escolhido);

  // Se a requisição veio de HTTPS (navegador no site) e a URL do vídeo ainda for HTTP
  // (servidor legado na porta 80 sem SSL), entrega através do proxy interno para
  // evitar bloqueio de Conteúdo Misto (Mixed Content) pelo navegador!
  if (escolhido.startsWith('http://') && request.url.startsWith('https://')) {
    const reqOrigin = new URL(request.url).origin;
    escolhido = `${reqOrigin}/api/proxy?url=${encodeURIComponent(escolhido)}`;
  }

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  // Se for uso único (RedeFlix) ou fallback não verificado, nunca armazena cache na borda!
  headers.set('Cache-Control', (ehUsoUnico || ehFallback) ? 'no-store' : 'public, max-age=600');

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
