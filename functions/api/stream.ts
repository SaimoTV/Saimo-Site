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
const REDEFLIX_BASE = 'https://redeflixapi.click';
const NIXPLAY_BASE = 'https://nixplay.lat';
const NIXPLAY_USER = 'saimo-vods';
const NIXPLAY_PASS = '221097';
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
  const relPath = isSerie
    ? `/serie/${tmdbId}/${season}/${episode}`
    : `/filme/${tmdbId}`;
  const servidores = versao === 'leg' ? ['legendado', 'default'] : ['default', 'legendado'];
  const baseHeaders: Record<string, string> = {
    'User-Agent': AGENTE,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://redeflixapi.click/',
  };

  // 1. Tenta carregar o HTML da página do título (tenta HTTP puro primeiro para evitar 520 de TLS cross-zone, depois HTTPS)
  let html = '';
  let usedBase = 'http://redeflixapi.click';
  for (const base of ['http://redeflixapi.click', 'https://redeflixapi.click']) {
    try {
      const pagina = `${base}${relPath}`;
      const c1 = new AbortController();
      const t1 = setTimeout(() => c1.abort(), 3500);
      const r1 = await fetch(pagina, { headers: baseHeaders, signal: c1.signal });
      clearTimeout(t1);
      if (debugObj) debugObj[base] = { status: r1.status, ok: r1.ok, pagina };
      if (r1.ok) {
        html = await r1.text();
        usedBase = base;
        break;
      }
    } catch (e: any) {
      if (debugObj) debugObj[`${base}Err`] = e?.message;
    }
  }

  if (!html) {
    try {
      const cProxy = new AbortController();
      const tProxy = setTimeout(() => cProxy.abort(), 6000);
      const pagina = `https://redeflixapi.click${relPath}`;
      const rProxy = await fetch(`https://r.jina.ai/${pagina}`, {
        headers: { 'X-Return-Format': 'html', 'User-Agent': AGENTE },
        signal: cProxy.signal,
      });
      clearTimeout(tProxy);
      if (debugObj) debugObj.rProxy = { status: rProxy.status, ok: rProxy.ok };
      if (rProxy.ok) {
        html = await rProxy.text();
      }
    } catch (e: any) {
      if (debugObj) debugObj.rProxyErr = e?.message;
    }
  }

  if (!html) return null;

  // 2. Extrai fastLaunchTickets direto do HTML
  let fastTickets: Record<string, string> = {};
  const fastMatch = /fastLaunchTickets\s*=\s*({[^}]+})/.exec(html);
  if (fastMatch?.[1]) {
    try { fastTickets = JSON.parse(fastMatch[1]); } catch (_) {}
  }
  if (debugObj) debugObj.fastTickets = fastTickets;

  for (const servidor of servidores) {
    try {
      let launchTicket = fastTickets[servidor] || '';

      // Fallback para playback-resolve se fastLaunchTickets não tiver para o servidor
      if (!launchTicket) {
        const m = /playbackResolveTicket\s*=\s*["']([^"']+)["']/.exec(html);
        if (m?.[1]) {
          const c2 = new AbortController();
          const t2 = setTimeout(() => c2.abort(), 4000);
          const r2Headers: Record<string, string> = {
            'User-Agent': AGENTE,
            'X-Requested-With': 'RedeFlixPlayer',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'Referer': `${usedBase}${relPath}`,
            'Origin': usedBase,
          };
          const r2 = await fetch(`${usedBase}/playback-resolve.php`, {
            method: 'POST',
            headers: r2Headers,
            body: JSON.stringify({ ticket: m[1], server: servidor }),
            signal: c2.signal,
          });
          clearTimeout(t2);
          if (r2.ok) {
            const j2 = (await r2.json()) as { launchTicket?: string };
            launchTicket = j2?.launchTicket || '';
          }
        }
      }

      if (!launchTicket) continue;

      // 3. Resolve a URL final no source.php (tenta usedBase e fallback)
      for (const base of [usedBase, 'http://redeflixapi.click', 'https://redeflixapi.click']) {
        try {
          const c3 = new AbortController();
          const t3 = setTimeout(() => c3.abort(), 4000);
          const r3Headers: Record<string, string> = {
            'User-Agent': AGENTE,
            'X-Requested-With': 'RedeFlixPlayer',
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'Referer': `${base}/playerkys/index.html`,
            'Origin': base,
          };
          const r3 = await fetch(`${base}/playerkys/source.php`, {
            method: 'POST',
            headers: r3Headers,
            body: JSON.stringify({ ticket: launchTicket }),
            signal: c3.signal,
          });
          clearTimeout(t3);
          if (debugObj) debugObj.r3 = { status: r3.status, ok: r3.ok, base };
          if (!r3.ok) continue;
          const j3 = (await r3.json()) as { url?: string };
          if (debugObj) debugObj.finalUrl = j3?.url;
          if (j3?.url) return j3.url;
        } catch (e: any) {
          if (debugObj) debugObj.r3Err = e?.message;
        }
      }
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
    const baseHeaders: Record<string, string> = {
      'User-Agent': customAgent || (url.includes('froststream') ? AGENTE_FROST : AGENTE),
      'Accept': 'application/json',
    };
    if (clientIp && !url.includes('fenixhub.online')) {
      baseHeaders['X-Forwarded-For'] = clientIp;
    }
    // Os provedores limitam os IPs da Cloudflare (429): o que já responderam fica
    // guardado 1 h, e cada título deixa de gastar uma consulta por pessoa.
    const chave = new Request(url);
    const guardado = await caches.default.match(chave);
    if (guardado) {
      const text = await guardado.text();
      return { streams: (JSON.parse(text) as { streams?: StreamItem[] }).streams || [], status: 200, raw: 'cache' };
    }
    const res = await fetch(url, {
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
    if (data.streams?.length) {
      await caches.default.put(chave, new Response(text, { headers: { 'Cache-Control': 'public, max-age=3600' } }));
    }
    return { streams: data.streams || [], status: res.status, raw: text.slice(0, 200) };
  } catch (e: any) {
    return { streams: [], status: 0, err: e?.message || String(e) };
  } finally {
    clearTimeout(timer);
  }
}

async function buscarFenixComFallbackAnime(
  urlPrincipal: string,
  urlAnime: string,
  timeoutMs: number = 5000,
  clientIp?: string,
): Promise<AddonResult> {
  const primeiro = await buscarAddon(urlPrincipal, timeoutMs, undefined, clientIp);
  if (primeiro.streams.length > 0 || primeiro.status === 429) {
    return primeiro;
  }
  const segundo = await buscarAddon(urlAnime, timeoutMs, undefined, clientIp);
  if (segundo.streams.length > 0 || segundo.status === 429) {
    return segundo;
  }
  return primeiro.status ? primeiro : segundo;
}

const ANIMESFHD_BASE = 'https://animesfhd.net/stremio';
const TMDB_PUBLIC_KEY = '15d2ea6d0dc1d476efbca3eba2b9bbfb';

function normTituloAnime(s: string): string {
  return s
    .replace(/\s*\((?:dublado|legendado|dub|leg|tv|movie|filme|\d{4})\)\s*/gi, ' ')
    .replace(/\s*[—\-–]\s*\d+ª\s*temporada\s*/gi, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function buscarJsonCacheado<T = any>(url: string, cacheTtl: number, timeoutMs: number = 4500): Promise<T | null> {
  const chave = new Request(url);
  try {
    const hit = await caches.default.match(chave);
    if (hit) return (await hit.json()) as T;
  } catch {}
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': AGENTE, 'Accept': 'application/json' },
      cache: 'no-store',
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    const data = JSON.parse(text) as T;
    if (text.length > 25) {
      await caches.default.put(
        chave,
        new Response(text, { headers: { 'Cache-Control': `public, max-age=${cacheTtl}` } }),
      );
    }
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function buscarAnimesFHD(
  cleanId: string,
  isSerie: boolean,
  season: string,
  episode: string,
  versao: string,
  debugObj?: any,
): Promise<string | null> {
  if (!/^\d+$/.test(cleanId)) return null;
  const endpointTipo = isSerie ? 'tv' : 'movie';
  const ptData = await buscarJsonCacheado<any>(
    `https://api.themoviedb.org/3/${endpointTipo}/${cleanId}?api_key=${TMDB_PUBLIC_KEY}&language=pt-BR&include_image_language=en,ja,pt,null&append_to_response=images,alternative_titles`,
    86400,
    4000,
  );
  if (!ptData) return null;
  const origLang = String(ptData.original_language || '').toLowerCase();
  const ehAnimacao = Array.isArray(ptData.genres) && ptData.genres.some((g: any) => Number(g?.id) === 16);
  if (origLang !== 'ja' && !ehAnimacao) {
    if (debugObj) debugObj.skipped = `not-anime:${origLang}`;
    return null;
  }

  const posterPrincipal: string = ptData.poster_path || '';
  const backdropPrincipal: string = ptData.backdrop_path || '';
  const posterPaths = new Set<string>();
  const backdropPaths = new Set<string>();
  if (posterPrincipal) posterPaths.add(posterPrincipal);
  if (backdropPrincipal) backdropPaths.add(backdropPrincipal);
  for (const p of ptData.images?.posters || []) {
    if (p?.file_path) posterPaths.add(String(p.file_path));
  }
  for (const b of ptData.images?.backdrops || []) {
    if (b?.file_path) backdropPaths.add(String(b.file_path));
  }

  const candidatosBusca: string[] = [];
  const altList = ptData.alternative_titles?.results || ptData.alternative_titles?.titles || [];
  const rawNames = [
    ptData.name,
    ptData.title,
    ptData.original_name,
    ptData.original_title,
    ...altList.map((a: any) => a?.title),
  ];
  for (const cand of rawNames) {
    if (typeof cand !== 'string' || !/[a-zA-Z0-9]{2,}/.test(cand)) continue;
    const limpo = cand.trim();
    if (!candidatosBusca.includes(limpo)) candidatosBusca.push(limpo);
    if (limpo.includes(':')) {
      const curto = limpo.split(':')[0].trim();
      if (curto.length >= 4 && !candidatosBusca.includes(curto)) candidatosBusca.push(curto);
    }
  }
  if (candidatosBusca.length < 2) {
    const enData = await buscarJsonCacheado<any>(
      `https://api.themoviedb.org/3/${endpointTipo}/${cleanId}?api_key=${TMDB_PUBLIC_KEY}&language=en-US`,
      86400,
      3500,
    );
    const enNome = enData?.name || enData?.title;
    if (typeof enNome === 'string' && /[a-zA-Z0-9]{2,}/.test(enNome) && !candidatosBusca.includes(enNome.trim())) {
      candidatosBusca.push(enNome.trim());
    }
  }
  const titulosAlvo = new Set(candidatosBusca.map(normTituloAnime).filter(t => t.length >= 2));
  const tipoAfhd = isSerie ? 'series' : 'movie';
  const catAfhd = isSerie ? 'afhd-populares' : 'afhd-filmes';

  const achados: Array<{ id: string; name: string; score: number }> = [];
  const vistos = new Set<string>();
  const termosConsulta = candidatosBusca.slice(0, 3);
  const cats = await Promise.all(
    termosConsulta.map(termo =>
      buscarJsonCacheado<{ metas?: Array<{ id: string; name?: string; poster?: string; background?: string }> }>(
        `${ANIMESFHD_BASE}/catalog/${tipoAfhd}/${catAfhd}/search=${encodeURIComponent(termo)}.json`,
        3600,
        4500,
      ),
    ),
  );
  for (const cat of cats) {
    for (const m of cat?.metas || []) {
      if (!m?.id || vistos.has(m.id)) continue;
      let score = 0;
      const posterFile = m.poster ? `/${m.poster.split('/').pop() || ''}` : '';
      const bgFile = m.background ? `/${m.background.split('/').pop() || ''}` : '';
      if (posterPrincipal && posterFile === posterPrincipal) score += 120;
      else if (posterFile && posterPaths.has(posterFile)) score += 100;
      else if (backdropPrincipal && bgFile === backdropPrincipal) score += 90;
      else if (bgFile && backdropPaths.has(bgFile)) score += 75;
      const nomeNorm = normTituloAnime(m.name || '');
      if (nomeNorm && titulosAlvo.has(nomeNorm)) score += 50;
      if (score === 0) continue;
      const ehDubMeta = /\bdublado\b/i.test(m.name || '');
      if (versao === 'dub' && ehDubMeta) score += 15;
      else if (versao === 'leg' && !ehDubMeta) score += 5;
      vistos.add(m.id);
      achados.push({ id: m.id, name: m.name || '', score });
    }
  }

  achados.sort((a, b) => b.score - a.score);
  if (debugObj) debugObj.matches = achados.slice(0, 4);
  if (achados.length === 0) return null;

  const sNum = parseInt(season, 10) || 1;
  const eNum = parseInt(episode, 10) || 1;
  let absEp = eNum;
  if (isSerie && sNum > 1 && Array.isArray(ptData.seasons)) {
    let soma = 0;
    for (const sn of ptData.seasons) {
      const n = Number(sn?.season_number || 0);
      if (n > 0 && n < sNum) soma += Number(sn?.episode_count || 0);
    }
    if (soma > 0) absEp = soma + eNum;
  }

  for (const cand of achados.slice(0, 2)) {
    let streamTargetId = cand.id;
    if (isSerie) {
      const meta = await buscarJsonCacheado<{ meta?: { videos?: Array<{ id: string; season?: number; episode?: number }> } }>(
        `${ANIMESFHD_BASE}/meta/series/${encodeURIComponent(cand.id)}.json`,
        3600,
        4500,
      );
      const vids = meta?.meta?.videos || [];
      const epMatch =
        vids.find(v => Number(v.season || 1) === sNum && Number(v.episode) === eNum) ||
        (sNum > 1 ? vids.find(v => Number(v.episode) === absEp) : undefined);
      if (!epMatch?.id) continue;
      streamTargetId = epMatch.id;
    }

    const stRes = await buscarJsonCacheado<{ streams?: StreamItem[] }>(
      `${ANIMESFHD_BASE}/stream/${tipoAfhd}/${encodeURIComponent(streamTargetId)}.json`,
      1800,
      4500,
    );
    const brutos = (stRes?.streams || []).filter(st => !!st.url && !SERVIDORES_MORTOS.some(h => st.url!.includes(h)));
    if (brutos.length === 0) continue;

    // Prioriza versão pedida e streams MP4 diretos (s5/s13) antes de playlist HLS (.m3u8)
    const peso = (st: StreamItem): number => {
      let p = classificar(st) === versao ? 0 : 10;
      const u = st.url || '';
      if (u.includes('playlist=.m3u8') || u.includes('.m3u8')) p += 4;
      else if (u.includes('/api/v/s5') || u.includes('/api/v/s13')) p += 0;
      else p += 2;
      return p;
    };
    const ordenadosAf = [...brutos].sort((a, b) => peso(a) - peso(b));
    if (debugObj) debugObj.streams = ordenadosAf.map(s => ({ title: s.title, url: s.url }));
    const resultadosAf = await Promise.all(ordenadosAf.slice(0, 4).map(st => respondeVideo(normalizar(st.url!))));
    const valido = resultadosAf.find((u): u is string => !!u);
    if (valido) return valido;
  }
  return null;
}

// O catálogo de apoio (fichas e fontes) fica num endereço de configuração do
// projeto (variável CATALOGO_FILMES no Cloudflare Pages), não neste código. Sem
// ela, o relay segue com o que o provedor listou e não consulta catálogo.
let CATALOGO_BASE = '';

// As bases de filmes e séries vêm do indice.txt publicado, como nos apps:
// nenhum endereço de fonte fica neste código.
let BASES_CACHE: Record<string, string> = {};
let basesLidasEm = 0;

async function carregarBases(): Promise<void> {
  if (!CATALOGO_BASE) return;
  if (Object.keys(BASES_CACHE).length > 0 && Date.now() - basesLidasEm < 10 * 60 * 1000) return;
  const res = await fetch(`${CATALOGO_BASE}/indice.txt`);
  if (!res.ok) return;
  const bases: Record<string, string> = {};
  for (const linha of (await res.text()).split('\n')) {
    const m = /^base:\s*(\d+)\s+(\S+)/.exec(linha);
    if (m) bases[m[1]] = m[2];
  }
  if (Object.keys(bases).length > 0) {
    BASES_CACHE = bases;
    basesLidasEm = Date.now();
  }
}

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

const FILMES_INEDITOS = new Set([
  '1514026', // Buddy (2026) - Inédito/sem stream; scrapers puxam filme indiano homônimo de 2024
  '1058424', // Hope: O Primeiro Impacto (2026)
  '1400940', // Clayface (2026)
  '1257147', // Minha Melhor Amiga (2026) - estreia na Netflix em 02/11/2026
  '969681',  // Homem-Aranha: Um Novo Dia (2026)
  '1273221', // Todo Mundo em Pânico (2026)
  '936075',  // Michael (2026)
  '552524',  // Lilo & Stitch (2025)
  '1291595', // Sobrenatural: Agora Entre Nós (2026)
  '83533',   // Avatar: Fogo e Cinzas (2025)
  '1038392', // Invocação do Mal 4: O Último Ritual (2025)
  '1506560', // Clash of the Thundermans (2026)
  '1367642', // Uma Segunda Chance (2026)
  '1228834', // The Fix (2026)
  '1127110', // Diablo: Caçada Mortal (2025)
  '1137844', // Mayday (2026)
  '1503762', // Razão e Sensibilidade (2026)
  '941109',  // Jogo Sujo (2025)
  '1384216', // Ponto Sem Retorno (2026)
  '340666',  // Animals. (2026)
  '1283515', // Verity (2026)
  '1571955', // Colisão Implacável (2026)
  '1153576', // Street Fighter (2026)
  '1248832', // Digger (2026)
  '1561726', // Masterplan (2026)
  '1204680', // Coyote vs. Acme (2026)
  '1288069', // Tenzing (2026)
  '1541477', // Eu, Você, Nós (2026)
  '1453407', // Noite Brutal (2026)
  '1433583', // The Weight (2026)
  '1657630', // El despertar (2026)
  '1187326', // As Aventuras de Tadeo e a Lâmpada Mágica (2026)
  '1284046', // Protocolo de Extermínio (2026)
  '1263337', // Coração Selvagem (2026)
  '1288445', // Codigo Vinganca (2026)
]);

async function buscarNoCatalogo(id: string, isSerie: boolean, season: string, episode: string, versao: string): Promise<string | null> {
  if (FILMES_INEDITOS.has(id) || !CATALOGO_BASE) return null;
  await carregarBases().catch(() => {});
  const CATALOG_BASE = CATALOGO_BASE;
  try {
    const fichasRes = await fetch(`${CATALOG_BASE}/fichas.txt?t=${Date.now()}`);
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
    const l = (inicial >= 'A' && inicial <= 'Z') ? inicial : '%23';

    if (!isSerie) {
      const fRes = await fetch(`${CATALOG_BASE}/filmes-${l}.txt?t=${Date.now()}`);
      if (!fRes.ok) return null;
      const fTxt = await fRes.text();
      const normAlvo = tituloAchado.toLowerCase().replace(/[^a-z0-9]/g, '');
      const anoAlvo = tituloAchado.match(/\((\d{4})\)/)?.[1];
      for (const linha of fTxt.split('\n')) {
        const p = linha.split('\t');
        if (p.length >= 2) {
          const normLinha = p[0].toLowerCase().replace(/[^a-z0-9]/g, '');
          const anoLinha = p[0].match(/\((\d{4})\)/)?.[1];
          // Se o alvo tem ano, não pode casar com filme de ano diferente nem homônimo antigo sem ano
          if (anoAlvo && anoLinha && anoAlvo !== anoLinha) continue;
          if (anoAlvo && !anoLinha && parseInt(anoAlvo) >= 2025) continue;
          if (normLinha === normAlvo) {
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
  'governosptx.org',
  'desativado.invalid',
  'acaidopt.org',
  'corruptx.org',
  'fenixbot.squareweb.app',
  'play.betteranime.net',
  'lightspeedst.net',
  '1a-1791.com',
  'aniplay.online',
  'fontez22.ddns.net',
  'wtvplus.co',
  'vids.st',
  'tityos.feralhosting.com',
  'cdn3.playmycnvs.com',
  's2.mywallpapers4k.com',
  'cdn-s01.mywallpaper-4k-image.net',
  'cdn-s01.pixel-sus-4k-image.com',
  'llanfairpwllgwyngy.com',
  'vz-38d44df0-6af.b-cdn.net',
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
    const finalUrl = normalizar(r.url || alvo);
    if (finalUrl.includes('bloqueado.mp4') || finalUrl.includes('googlevideo.com') || SERVIDORES_MORTOS.some(h => finalUrl.includes(h))) return null;
    const cl = r.headers.get('content-length');
    if (cl === '0') return null;
    if (r.status >= 400 || !r.body) return null;
    // Só o primeiro pedaço: servidor que ignora o Range mandaria o filme inteiro.
    const leitor = r.body.getReader();
    const { value } = await leitor.read();
    leitor.cancel().catch(() => {});
    const corpo = (value ?? new Uint8Array()).slice(0, 1024);
    const inicio = new TextDecoder().decode(corpo.slice(0, 16)).trimStart();
    if (inicio.startsWith('#EXTM3U')) {
      return normalizar(alvo.includes('embedplayer2.xyz') ? (r.url || alvo) : alvo);
    }
    if (corpo.length === 0 || corpo[0] === 0x3c /* < */ || corpo[0] === 0x7b /* { */) return null;

    // Se a URL original usa token assinado com redirect (ex: Fenix /r/..., Zeus, Badger),
    // sempre devolve a URL original 'alvo' para que o player do cliente faça o redirecionamento
    // com seu próprio IP residencial e não receba HTTP 403 "Assinatura inválida".
    if (alvo.includes('/r/') || alvo.includes('fenixhub.online') || alvo.includes('fenixflix')) {
      return normalizar(alvo);
    }
    return finalUrl;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Testa se a URL determinística do NixPlay possui vídeo real ativo.
 * NixPlay responde HTTP 302 redirecionando para Cloudflare R2 com vídeo quando existe,
 * ou HTTP 200 com texto "ERRO: Vídeo não encontrado..." quando não existe.
 */
async function testarNixplay(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const r = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': AGENTE,
        'Range': 'bytes=0-1023',
      },
      redirect: 'manual',
      signal: ctrl.signal,
    });
    // Status 301, 302, 307 ou 308: confere se o destino do redirect não é um servidor morto.
    if (r.status === 301 || r.status === 302 || r.status === 307 || r.status === 308) {
      const loc = (r.headers.get('Location') || '').trim();
      await r.body?.cancel().catch(() => {});
      if (!loc) return null;
      const locLow = loc.toLowerCase();
      if (SERVIDORES_MORTOS.some(h => locLow.includes(h))) {
        return null;
      }
      if (locLow.includes('.r2.cloudflarestorage.com/') || locLow.includes('hubby-dmca.com')) {
        return url;
      }
      // Redirecionamentos de terceiros desconhecidos no NixPlay: valida antes de entregar.
      const ok = await respondeVideo(loc);
      return ok ? url : null;
    }
    // Caso responda 200/206 com corpo de vídeo direto
    if (r.status === 200 || r.status === 206) {
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('video/') || ct.includes('octet-stream')) {
        return url;
      }
      const corpo = await r.text();
      if (!corpo.includes('ERRO:') && !corpo.includes('não encontrado')) {
        return url;
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const onRequestGet: PagesFunction<{ CATALOGO_FILMES?: string }> = async ({ request, env }) => {
  CATALOGO_BASE = String(env?.CATALOGO_FILMES ?? '').trim().replace(/\/+$/, '');
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

  const BLACKLIST_IDS = new Set(['1400940', '1058424', '1514026']); // 1400940 = Clayface (2026), 1058424 = Hope (2026), 1514026 = Buddy (2026)
  if (BLACKLIST_IDS.has(cleanId)) {
    return new Response(JSON.stringify({ error: 'Título indisponível ou somente em cartaz nos cinemas' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
  const prefixId = cleanId.startsWith('tt') ? cleanId : `tmdb:${cleanId}`;
  const isSerie = tipo === 'series' || tipo === 'tv';

  // PRIORIDADE #1: Nixplay oficial (ultra-rápido, determinístico por TMDB ID, acervo ilimitado)
  if (/^\d+$/.test(cleanId)) {
    const sufixoLang = versao === 'leg' ? '?lang=leg' : '';
    const nixUrl = isSerie
      ? `${NIXPLAY_BASE}/series/${NIXPLAY_USER}/${NIXPLAY_PASS}/${cleanId}/${season}/${episode}.mp4${sufixoLang}`
      : `${NIXPLAY_BASE}/movie/${NIXPLAY_USER}/${NIXPLAY_PASS}/${cleanId}.mp4${sufixoLang}`;
    const nixDisponivel = await testarNixplay(nixUrl);
    if (nixDisponivel) {
      const headers = new Headers();
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Cache-Control', 'public, max-age=1800');

      if (querJson) {
        headers.set('Content-Type', 'application/json');
        return new Response(JSON.stringify({
          url: nixUrl,
          tipo,
          id: cleanId,
          temporada: isSerie ? parseInt(season, 10) : undefined,
          episodio: isSerie ? parseInt(episode, 10) : undefined,
          versao,
          server: 'nixplay',
        }), { status: 200, headers });
      }

      headers.set('Location', nixUrl);
      return new Response(null, { status: 302, headers });
    }
  }

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
  const fenixAnimeUrl = isSerie
    ? `${FENIX_BASE}/stream/anime/${prefixId}:${season}:${episode}.json`
    : `${FENIX_BASE}/stream/anime/${prefixId}.json`;

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
    buscarFenixComFallbackAnime(fenixUrl, fenixAnimeUrl, 5000, clientIp),
    buscarAddon(magnetUrl, 4000, undefined, clientIp),
    buscarAddon(hollyUrl, 4000, undefined, clientIp),
  ];
  if (frostUrl && !FILMES_INEDITOS.has(cleanId)) {
    consultas.push(buscarAddon(frostUrl, 5000, AGENTE_FROST, clientIp));
  }
  const fenixImdb = (imdbId && !cleanId.startsWith('tt'))
    ? (isSerie ? `${FENIX_BASE}/stream/series/${imdbId}:${season}:${episode}.json` : `${FENIX_BASE}/stream/movie/${imdbId}.json`)
    : null;
  const fenixAnimeImdb = (imdbId && !cleanId.startsWith('tt'))
    ? (isSerie ? `${FENIX_BASE}/stream/anime/${imdbId}:${season}:${episode}.json` : `${FENIX_BASE}/stream/anime/${imdbId}.json`)
    : null;
  if (fenixImdb && fenixAnimeImdb) {
    consultas.push(buscarFenixComFallbackAnime(fenixImdb, fenixAnimeImdb, 5000, clientIp));
  }
  const aliasId = TMDB_ALIASES[cleanId];
  if (aliasId) {
    const aliasFenix = isSerie
      ? `${FENIX_BASE}/stream/series/tmdb:${aliasId}:${season}:${episode}.json`
      : `${FENIX_BASE}/stream/movie/tmdb:${aliasId}.json`;
    const aliasFenixAnime = isSerie
      ? `${FENIX_BASE}/stream/anime/tmdb:${aliasId}:${season}:${episode}.json`
      : `${FENIX_BASE}/stream/anime/tmdb:${aliasId}.json`;
    consultas.push(buscarFenixComFallbackAnime(aliasFenix, aliasFenixAnime, 5000, clientIp));
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
    // Minha Melhor Amiga (2026): FrostStream e listas antigas entregam o filme italiano de 2014 (Una donna per amica) ou Pokémon
    if (cleanId === '1257147' && (st.url.includes('froststream') || st.url.includes('249904.mp4') || st.url.includes('78879.mp4'))) {
      return false;
    }
    // Apocalipse Z: Novo Mundo (2026): Provedores entregam o filme anterior (O Princípio do Fim)
    if (cleanId === '1507696' && (st.url.includes('54606.mp4') || st.url.includes('47748.mp4') || st.url.includes('64484.mp4') || (st.title && st.title.toLowerCase().includes('princípio')))) {
      return false;
    }
    // Filmes inéditos / não lançados que recebem streams de filmes antigos homônimos
    if (cleanId === '969681' && (st.url.includes('09d89b1f0482cc99118dab08') || st.url.includes('311018.mp4') || st.url.includes('310642.mp4'))) {
      return false;
    }
    if (cleanId === '1273221' && (st.url.includes('628d9896b729b1cb52c3bb4a') || st.url.includes('309257.mp4') || st.url.includes('19950.mp4'))) {
      return false;
    }
    if (cleanId === '936075' && (st.url.includes('306260.mp4') || st.url.includes('306261.mp4') || st.url.includes('301385.mp4'))) {
      return false;
    }
    if (cleanId === '552524' && (st.url.includes('35e556752717d78a474e6bd4d576a7eb') || st.url.includes('16001.mp4'))) {
      return false;
    }
    if (cleanId === '1291595' && st.url.includes('52018.mp4')) {
      return false;
    }
    if (cleanId === '83533' && (st.url.includes('91edabea842aefc574c16aca') || st.url.includes('251106.mp4') || st.url.includes('256143.mp4'))) {
      return false;
    }
    if (cleanId === '1038392' && (st.url.includes('a8435a9da193b4189be4ab4a') || st.url.includes('256452.mp4'))) {
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
      const limpo = normalizar(doCatalogo);
      const resp = await respondeVideo(limpo);
      escolhido = resp || (limpo.includes('nixplay.lat') ? '' : limpo);
    }
  }

  if (escolhido && escolhido.includes('embedplayer2.xyz')) {
    escolhido = escolhido.replace(/\/master\.(?:m3u8|txt)(?:\?[^"'\s]*)?/, '/master.txt');
  }

  let animesFhdDebug: any = {};
  if (!escolhido) {
    try {
      const afhdUrl = await buscarAnimesFHD(cleanId, isSerie, season, episode, versao, animesFhdDebug);
      animesFhdDebug.url = afhdUrl;
      if (afhdUrl) {
        escolhido = afhdUrl;
      }
    } catch (e: any) {
      animesFhdDebug.error = e?.message || String(e);
    }
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
      animesFhdDebug,
      redeflixDebug,
      urlsConsultadas: { fenixUrl, fenixAnimeUrl, magnetUrl, hollyUrl, frostUrl, fenixImdb, fenixAnimeImdb },
      resultadosAddons: resultados.map((r, i) => ({ status: r.status, err: r.err, count: r.streams.length, raw: r.raw })),
      testados,
      ordenadosCount: ordenados.length,
      todosCount: todos.length,
      ordenados: ordenados.map(o => ({ name: o.name, title: o.title, url: o.url })),
    }, null, 2), { status: 200, headers: dbgHeaders });
  }

  let ehFallback = false;
  if (!escolhido) {
    // Fontes do Catálogo Saimo (especialmente Nixplay) já passaram por respondeVideo acima;
    // se falharam, não devem voltar como fallback sem verificação no lugar de 404.
    const validos = ordenados.filter(
      st => !SERVIDORES_MORTOS.some(h => st.url!.includes(h)) && !st.url!.includes('nixplay.lat'),
    );
    if (validos.length === 0) {
      // Fallback para Nixplay dublado se o pedido foi legendado mas não havia cópia legendada em nenhum servidor
      if (/^\d+$/.test(cleanId) && versao === 'leg') {
        const nixDubFallback = isSerie
          ? `${NIXPLAY_BASE}/series/${NIXPLAY_USER}/${NIXPLAY_PASS}/${cleanId}/${season}/${episode}.mp4`
          : `${NIXPLAY_BASE}/movie/${NIXPLAY_USER}/${NIXPLAY_PASS}/${cleanId}.mp4`;
        const dubDisponivel = await testarNixplay(nixDubFallback);
        if (dubDisponivel) {
          escolhido = nixDubFallback;
          ehFallback = true;
        }
      }

      if (!escolhido) {
        // Provedor limitando não quer dizer que o título não existe: quem audita o
        // acervo precisa distinguir, senão filme bom sai do app.
        const limitado = resultados.some(r => r.status === 429);
        return new Response(JSON.stringify({
          error: 'Este título só funciona nos aplicativos do Saimo TV. No site não vai funcionar.',
          somenteApp: true,
        }), {
          status: limitado ? 503 : 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
        });
      }
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

  // Vídeo http vai como está (3.3: o proxy do site saiu). Os apps abrem http;
  // o navegador não (conteúdo misto) e mostra "abre no aplicativo".

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
