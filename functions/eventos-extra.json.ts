/**
 * Agenda de jogos do Saimo: os jogos vêm dos placares da ESPN e os canais vêm
 * da grade de programação dos canais esportivos do Brasil (meuguia.tv).
 *
 * Um canal só entra em `players` quando a grade dele mostra o jogo ao vivo
 * (os dois times no título, perto do horário de início). Antes cada jogo levava
 * as emissoras dos EUA informadas pela ESPN mais uma lista fixa de canais
 * "prováveis" da liga, e por isso aparecia canal errado (NFL na RedeTV,
 * ESPN em jogo que a ESPN não passa, canais regionais americanos).
 *
 * Formato igual ao que os apps já leem (teams, league, time_start, players).
 * Horários em Brasília (-03:00). Jogo sem canal confirmado também entra.
 */

interface Liga {
  caminho: string;
  /** Duração típica de uma partida, em minutos. */
  duracao: number;
  /** Canais que passam todos os jogos da liga (não depende da grade). */
  sempre?: string[];
}

const LIGAS: Liga[] = [
  { caminho: 'soccer/bra.1', duracao: 120, sempre: ['premiere-clubes', 'premiere-2'] },
  { caminho: 'soccer/bra.2', duracao: 120, sempre: ['premiere-clubes', 'premiere-2'] },
  { caminho: 'soccer/bra.copa_do_brazil', duracao: 120 },
  { caminho: 'soccer/conmebol.libertadores', duracao: 120 },
  { caminho: 'soccer/conmebol.sudamericana', duracao: 120 },
  { caminho: 'soccer/uefa.champions', duracao: 120 },
  { caminho: 'soccer/uefa.europa', duracao: 120 },
  { caminho: 'soccer/uefa.nations', duracao: 120 },
  { caminho: 'soccer/eng.1', duracao: 120 },
  { caminho: 'soccer/esp.1', duracao: 120 },
  { caminho: 'soccer/ita.1', duracao: 120 },
  { caminho: 'soccer/ger.1', duracao: 120 },
  { caminho: 'soccer/fra.1', duracao: 120 },
  { caminho: 'soccer/por.1', duracao: 120 },
  { caminho: 'soccer/ned.1', duracao: 120 },
  { caminho: 'soccer/arg.1', duracao: 120 },
  { caminho: 'soccer/ksa.1', duracao: 120 },
  { caminho: 'soccer/fifa.world', duracao: 120 },
  { caminho: 'soccer/fifa.worldq.conmebol', duracao: 120 },
  { caminho: 'basketball/nba', duracao: 150 },
  { caminho: 'football/nfl', duracao: 210 },
  { caminho: 'baseball/mlb', duracao: 180 },
  { caminho: 'hockey/nhl', duracao: 150 },
  { caminho: 'mma/ufc', duracao: 300 },
];

/** Canais esportivos com grade no meuguia.tv (`m`): código → slugs exatos do catálogo. */
const GRADES_M: [string, string[]][] = [
  ['GRD', ['globo-sp', 'globo-rj', 'globo']],
  ['SPO', ['sportv']],
  ['SP2', ['sportv-2']],
  ['SP3', ['sportv-3']],
  ['121', ['premiere-clubes', 'premiere']],
  ['ESP', ['espn']],
  ['ES2', ['espn-2']],
  ['ES3', ['espn-3']],
  ['ES4', ['espn-4']],
  ['ES5', ['espn-5']],
  ['BAN', ['band-sp', 'band']],
  ['BSP', ['band-sports']],
  ['TNT', ['tnt']],
  ['SPA', ['space']],
  ['RTV', ['redetv']],
  ['REC', ['record-sp', 'record-rj', 'record']],
  ['SBT', ['sbt-sp', 'sbt-rj', 'sbt']],
  ['135', ['combate']],
];

/** Canais extras vindos do guiadetv.com (`g`) no epg-esportes.json: chave → slugs exatos. */
const GRADES_G: [string, string[]][] = [
  ['espn-6', ['espn-6']],
  ['premiere-2', ['premiere-2']],
  ['premiere-3', ['premiere-3']],
  ['premiere-4', ['premiere-4']],
  ['premiere-5', ['premiere-5']],
  ['premiere-6', ['premiere-6']],
  ['premiere-7', ['premiere-7']],
  ['sportynet', ['sportynet']],
  ['nsports', ['n-sports']],
];

const BRT = -3 * 3600_000;
const JANELA = 40 * 60_000;

interface Programa { inicio: number; titulo: string }

/** Hora de Brasília (-03:00) no formato ISO, que todos os apps entendem. */
function brt(ms: number): string {
  return new Date(ms + BRT).toISOString().slice(0, 19) + '-03:00';
}

function sem(acentos: string): string {
  return acentos.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const GENERICAS = new Set([
  'club', 'clube', 'futebol', 'football', 'sport', 'sports', 'esporte', 'esportes', 'sporting',
  'atletico', 'athletic', 'united', 'city', 'real', 'deportivo', 'calcio', 'associacao',
  'regatas', 'saint', 'santa', 'sociedade', 'esportiva', 'recreativo', 'fc', 'sc', 'ec', 'ac', 'cf', 'cd',
]);

const APELIDOS_TIME: Record<string, string[]> = {
  'atletico mg': ['atletico mineiro', 'mineiro'],
  'atletico mineiro': ['atletico mg'],
  'atletico go': ['atletico goianiense', 'goianiense'],
  'atletico goianiense': ['atletico go'],
  'athletico pr': ['athletico paranaense', 'paranaense'],
  'athletico paranaense': ['athletico pr'],
  'psv eindhoven': ['psv'],
  'paris saint germain': ['psg'],
  'internazionale': ['inter de milao', 'inter milan'],
  'rb bragantino': ['red bull bragantino', 'bragantino'],
  'red bull bragantino': ['rb bragantino', 'bragantino'],
};

interface TermosTime { frases: string[]; palavras: string[] }

/** Frases compostas e palavras que identificam o time (aceita siglas de 3+ letras como PSV). */
function palavrasDoTime(nomes: (string | undefined)[]): TermosTime {
  const frases = new Set<string>();
  const palavras = new Set<string>();
  for (const n of nomes) {
    if (!n) continue;
    const limpo = sem(n).replace(/[^a-z0-9]+/g, ' ').trim();
    if (!limpo) continue;
    for (const alias of APELIDOS_TIME[limpo] ?? []) frases.add(alias);
    const partes = limpo.split(' ').filter(Boolean);
    if (partes.length >= 2) frases.add(limpo);
    for (const p of partes) {
      if (p.length >= 3 && !GENERICAS.has(p)) palavras.add(p);
    }
  }
  return { frases: [...frases], palavras: [...palavras] };
}

/** Título de transmissão ao vivo, não reprise, resumo nem chamada futura. */
function aoVivo(titulo: string): boolean {
  const t = sem(titulo);
  if (/^(vt|reprise|compacto|hoje a partir|dia \d|pre[- ]?jogo)\b/.test(t)) return false;
  return !/(melhores momentos|highlights|reprise|compacto|gols da rodada|resenha|mesa[- ]redonda)/.test(t);
}

/**
 * Lê uma única vez o epg-esportes.json (~40 KB, fallback para epg-leve.json):
 * evita 18 downloads paralelos do epg.json de 2 MB que estouravam a Function.
 */
interface EpgCentral {
  em: number;
  g: Record<string, [number, number, string, string?][]>;
  m: Record<string, [number, number, string, string?][]>;
}
let central: EpgCentral | null = null;
let centralEmVoo: Promise<EpgCentral | null> | null = null;

async function gradeCentral(agora: number): Promise<EpgCentral | null> {
  if (central && agora - central.em < 10 * 60_000) return central;
  if (centralEmVoo) return centralEmVoo;
  centralEmVoo = (async () => {
    for (const url of [
      'https://canais-saimo.pages.dev/epg-esportes.json',
      'https://canais-saimo.pages.dev/epg-leve.json',
    ]) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const r = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
        if (!r.ok) continue;
        const d = (await r.json()) as { g?: EpgCentral['g']; m?: EpgCentral['m'] };
        if (d?.m || d?.g) {
          central = { em: Date.now(), g: d.g ?? {}, m: d.m ?? {} };
          return central;
        }
      } catch { /* tenta próximo */ }
    }
    return null;
  })().finally(() => { centralEmVoo = null; });
  return centralEmVoo;
}

function casouTime(tituloLimpo: string, termos: TermosTime): boolean {
  if (!termos.frases.length && !termos.palavras.length) return false;
  if (termos.frases.some(f => tituloLimpo.includes(f))) return true;
  return termos.palavras.some(w =>
    w.length <= 3 ? new RegExp(`\\b${w}\\b`).test(tituloLimpo) : tituloLimpo.includes(w),
  );
}

interface Comp {
  homeAway?: string;
  score?: string;
  team?: { name?: string; displayName?: string; shortDisplayName?: string; location?: string; logo?: string };
}

function canaisConfirmados(
  casa: TermosTime,
  fora: TermosTime,
  inicio: number,
  grades: Map<string[], Programa[]>,
): string[] {
  const achados: string[] = [];
  for (const [slugs, progs] of grades) {
    const bate = progs.some(p => {
      if (Math.abs(p.inicio - inicio) > JANELA) return false;
      const t = sem(p.titulo).replace(/[^a-z0-9]+/g, ' ').trim();
      return casouTime(t, casa) && casouTime(t, fora);
    });
    if (bate) {
      for (const s of slugs) if (!achados.includes(s)) achados.push(s);
    }
  }
  return achados;
}

interface RedeFlixCanal {
  name?: string;
  embed?: string;
}

interface RedeFlixJogo {
  id?: number | string;
  match?: string;
  league?: string;
  league_logo?: string;
  home?: string;
  away?: string;
  home_logo?: string;
  away_logo?: string;
  kickoff?: string;
  date?: string;
  status?: string;
  status_text?: string;
  score?: { home?: number | string | null; away?: number | string | null } | null;
  minute?: number | string | null;
  channels?: RedeFlixCanal[];
}

interface EventoSaida {
  players: string[];
  time_start: string;
  time_end: string;
  teams: { home: { name: string; image: string }; away: { name: string; image: string } };
  league: { name: string; image: string };
  estado: string;
  placar: string;
  tempo: string;
  _inicio?: number;
  _casa?: TermosTime;
  _fora?: TermosTime;
}

const SLUGS_REDEFLIX: Record<string, string[]> = {
  cazetv: ['cazetv', 'cazetv-1', 'cazetv-2', 'cazetv-3', 'cazetv-4'],
  'espn-1': ['espn'],
  espn1: ['espn'],
  espn: ['espn'],
  'espn-2': ['espn-2'],
  'espn-3': ['espn-3'],
  'espn-4': ['espn-4'],
  'espn-5': ['espn-5'],
  'espn-6': ['espn-6'],
  'canal-goat': ['canal-goat-jogo-1', 'canal-goat'],
  redetv: ['redetv', 'rede-tv'],
  'redetv+': ['redetv', 'rede-tv'],
  'premiere-1': ['premiere-clubes', 'premiere'],
  premiere: ['premiere-clubes', 'premiere'],
  'premiere-clubes': ['premiere-clubes', 'premiere'],
  'premiere-2': ['premiere-2'],
  'premiere-3': ['premiere-3'],
  'premiere-4': ['premiere-4'],
  'premiere-5': ['premiere-5'],
  'premiere-6': ['premiere-6'],
  'premiere-7': ['premiere-7'],
  'premiere-8': ['premiere-8'],
  'globo-sp': ['globo-sp', 'globo'],
  globo: ['globo-sp', 'globo'],
  'globo-rj': ['globo-rj'],
  'record-sp': ['record-sp', 'record'],
  record: ['record-sp', 'record'],
  'record-rj': ['record-rj'],
  'sbt-sp': ['sbt-sp', 'sbt'],
  sbt: ['sbt-sp', 'sbt'],
  'sbt-rj': ['sbt-rj'],
  'band-sp': ['band-sp', 'band'],
  band: ['band-sp', 'band'],
  'band-rj': ['band-rj'],
  'band-sports': ['band-sports-hd', 'band-sports'],
  xsports: ['x-sports', 'xsports'],
  'x-sports': ['x-sports', 'xsports'],
  sportv: ['sportv'],
  'sportv-2': ['sportv-2'],
  'sportv-3': ['sportv-3'],
  sportynet: ['sportynet', 'sportynet-1'],
  nsports: ['n-sports'],
  'n-sports': ['n-sports'],
  tnt: ['tnt'],
  space: ['space'],
  combate: ['combate'],
  paramount: ['paramount-plus-1', 'paramount-jogo-1', 'paramount-jogo-2', 'paramount-jogo-3', 'paramount-4'],
  'paramount+': ['paramount-plus-1', 'paramount-jogo-1', 'paramount-jogo-2', 'paramount-jogo-3', 'paramount-4'],
  disney: ['disney-plus-1', 'disney-01', 'disney-02', 'disney-03'],
  'disney+': ['disney-plus-1', 'disney-01', 'disney-02', 'disney-03'],
  'amazon-prime': ['amazon-prime-video-01', 'amazon-prime-video-02'],
  'prime-video': ['amazon-prime-video-01', 'amazon-prime-video-02'],
  max: ['max', 'max-01', 'max-02', 'max-03'],
  'hbo-max': ['max', 'max-01', 'max-02', 'max-03'],
};

function slugsCanalRedeFlix(ch: RedeFlixCanal): string[] {
  const candidatos: string[] = [];
  const embedSlug = (ch.embed ?? '').split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
  const nomeSlug = sem(ch.name ?? '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (const chave of [embedSlug, nomeSlug]) {
    if (!chave) continue;
    for (const s of SLUGS_REDEFLIX[chave] ?? [chave]) {
      if (!candidatos.includes(s)) candidatos.push(s);
    }
  }
  return candidatos;
}

async function jogosRedeFlix(agora: number): Promise<EventoSaida[]> {
  let raw: { games?: RedeFlixJogo[] } | null = null;
  for (const url of [
    'http://redeflixapi.click/list-games-ids.json',
    'https://redeflixapi.click/list-games-ids.json',
    'https://canais-saimo.pages.dev/eventos-redeflix.json',
  ]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        signal: ctrl.signal,
      }).finally(() => clearTimeout(t));
      if (!r.ok) continue;
      const j = (await r.json()) as { games?: RedeFlixJogo[] };
      if (Array.isArray(j?.games)) {
        raw = j;
        break;
      }
    } catch { /* tenta espelho */ }
  }
  if (!raw?.games?.length) return [];

  const saida: EventoSaida[] = [];
  for (const g of raw.games) {
    if (!g.date || !g.kickoff || !g.home || !g.away) continue;
    const hora = g.kickoff.length === 5 ? `${g.kickoff}:00` : g.kickoff;
    const inicio = Date.parse(`${g.date}T${hora}-03:00`);
    if (isNaN(inicio)) continue;

    const stRaw = (g.status ?? '').toLowerCase();
    const stTxt = (g.status_text ?? '').toUpperCase();
    let estado: 'pre' | 'in' | 'post' = 'pre';
    if (stRaw === 'live' || stRaw === 'in' || stTxt.includes('AO VIVO') || stTxt.includes('INTERVALO')) {
      estado = 'in';
    } else if (stRaw === 'finished' || stRaw === 'post' || stTxt.includes('ENCERRADO')) {
      estado = 'post';
    }

    const duracaoMs = 150 * 60_000;
    const fimMs = estado === 'in'
      ? Math.max(inicio + duracaoMs, agora + 30 * 60_000)
      : inicio + (estado === 'post' ? 120 * 60_000 : duracaoMs);

    const sc = g.score;
    const temPlacar = estado !== 'pre' && sc && sc.home != null && sc.away != null;
    const placar = temPlacar ? `${sc!.home} x ${sc!.away}` : '';
    const min = g.minute != null && String(g.minute).trim() !== '' ? `${String(g.minute).replace(/[^\d+]/g, '')}'` : '';
    const tempo = estado === 'in' ? (min || (stTxt && stTxt !== 'AGENDADO' ? stTxt : 'AO VIVO')) : '';

    const slugs: string[] = [];
    for (const ch of g.channels ?? []) {
      for (const s of slugsCanalRedeFlix(ch)) {
        if (!slugs.includes(s)) slugs.push(s);
      }
    }

    saida.push({
      players: slugs.map(s => `https://saimo-tv/canal/${s}`),
      time_start: brt(inicio),
      time_end: brt(fimMs),
      teams: {
        home: { name: g.home, image: g.home_logo ?? '' },
        away: { name: g.away, image: g.away_logo ?? '' },
      },
      league: { name: g.league ?? '', image: g.league_logo ?? '' },
      estado,
      placar,
      tempo,
      _inicio: inicio,
      _casa: palavrasDoTime([g.home]),
      _fora: palavrasDoTime([g.away]),
    });
  }
  return saida;
}

async function liga(item: Liga, grades: Map<string[], Programa[]>): Promise<EventoSaida[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${item.caminho}/scoreboard?lang=pt&region=br`, { signal: ctrl.signal });
    if (!r.ok) return [];
    const d: any = await r.json();
    const nomeLiga = d?.leagues?.[0]?.name ?? '';
    const logoLiga = d?.leagues?.[0]?.logos?.[0]?.href ?? '';
    const saida: EventoSaida[] = [];
    for (const ev of d?.events ?? []) {
      const comps: Comp[] = ev?.competitions?.[0]?.competitors ?? [];
      const casa = comps.find(c => c.homeAway === 'home');
      const fora = comps.find(c => c.homeAway !== 'home');
      if (!casa || !fora) continue;
      const inicio = new Date(ev.date).getTime();
      if (isNaN(inicio)) continue;
      const st = ev?.status?.type;
      const estado: string = st?.state ?? '';
      if (estado === 'post') continue;
      const pCasa = palavrasDoTime([casa.team?.displayName, casa.team?.shortDisplayName, casa.team?.name, casa.team?.location]);
      const pFora = palavrasDoTime([fora.team?.displayName, fora.team?.shortDisplayName, fora.team?.name, fora.team?.location]);
      const canais = canaisConfirmados(pCasa, pFora, inicio, grades);
      for (const s of item.sempre ?? []) if (!canais.includes(s)) canais.push(s);
      saida.push({
        players: canais.map(s => `https://saimo-tv/canal/${s}`),
        time_start: brt(inicio),
        time_end: brt(inicio + item.duracao * 60_000),
        teams: {
          home: { name: casa.team?.displayName ?? casa.team?.name ?? '', image: casa.team?.logo ?? '' },
          away: { name: fora.team?.displayName ?? fora.team?.name ?? '', image: fora.team?.logo ?? '' },
        },
        league: { name: nomeLiga, image: logoLiga },
        estado,
        placar: estado === 'pre' ? '' : `${casa.score ?? 0} x ${fora.score ?? 0}`,
        tempo: estado === 'in' ? st?.shortDetail ?? '' : '',
        _inicio: inicio,
        _casa: pCasa,
        _fora: pFora,
      });
    }
    return saida;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

function mesmoJogo(a: EventoSaida, b: EventoSaida): boolean {
  if (!a._inicio || !b._inicio || Math.abs(a._inicio - b._inicio) > 4 * 3600_000) return false;
  if (!a._casa || !a._fora || !b._casa || !b._fora) return false;
  const h = sem(a.teams.home.name).replace(/[^a-z0-9]+/g, ' ').trim();
  const f = sem(a.teams.away.name).replace(/[^a-z0-9]+/g, ' ').trim();
  const h2 = sem(b.teams.home.name).replace(/[^a-z0-9]+/g, ' ').trim();
  const f2 = sem(b.teams.away.name).replace(/[^a-z0-9]+/g, ' ').trim();
  const direto = (casouTime(h, b._casa) && casouTime(f, b._fora)) || (casouTime(h2, a._casa) && casouTime(f2, a._fora));
  const invertido = (casouTime(h, b._fora) && casouTime(f, b._casa)) || (casouTime(h2, a._fora) && casouTime(f2, a._casa));
  return direto || invertido;
}

export const onRequestGet: PagesFunction = async (ctx) => {
  // A agenda inteira fica 60 s no cache da borda: com muitos apps abertos, só um
  // pedido por minuto por região vai à ESPN e à grade (menos CPU e subpedidos).
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const chave = new Request('https://saimo-cache.invalid/eventos-extra.json');
  if (cache) {
    const salvo = await cache.match(chave).catch(() => undefined);
    if (salvo) return salvo;
  }
  const resposta = await montarAgenda();
  if (cache) {
    const copia = resposta.clone();
    copia.headers.set('Cache-Control', 'public, max-age=60');
    ctx.waitUntil(cache.put(chave, copia).catch(() => undefined));
  }
  return resposta;
};

async function montarAgenda(): Promise<Response> {
  const agora = Date.now();
  const [doc, rfJogos] = await Promise.all([gradeCentral(agora), jogosRedeFlix(agora)]);
  const grades = new Map<string[], Programa[]>();
  const mapear = (lista?: [number, number, string, string?][]) =>
    (lista ?? [])
      .map(([ini, , titulo]) => ({ inicio: ini * 1000, titulo }))
      .filter((p) => aoVivo(p.titulo));
  if (doc) {
    for (const [codigo, slugs] of GRADES_M) grades.set(slugs, mapear(doc.m[codigo]));
    for (const [chave, slugs] of GRADES_G) grades.set(slugs, mapear(doc.g[chave]));
  }
  const espnJogos = (await Promise.all(LIGAS.map(l => liga(l, grades)))).flat();

  const final: EventoSaida[] = rfJogos.map((j) => {
    const par = espnJogos.find(e => mesmoJogo(j, e));
    const players = [...j.players];
    if (par) {
      for (const p of par.players) if (!players.includes(p)) players.push(p);
    }
    return {
      ...j,
      players,
      teams: {
        home: { name: j.teams.home.name, image: j.teams.home.image || par?.teams.home.image || '' },
        away: { name: j.teams.away.name, image: j.teams.away.image || par?.teams.away.image || '' },
      },
      league: { name: j.league.name || par?.league.name || '', image: j.league.image || par?.league.image || '' },
      estado: j.estado === 'in' || !par ? j.estado : par.estado,
      placar: j.placar || par?.placar || '',
      tempo: j.tempo || par?.tempo || '',
    };
  });

  for (const e of espnJogos) {
    if (!final.some(j => mesmoJogo(j, e))) final.push(e);
  }

  const limpos = final.map(({ _inicio, _casa, _fora, ...rest }) => rest);
  limpos.sort((a, b) => a.time_start.localeCompare(b.time_start));
  return new Response(JSON.stringify(limpos), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
