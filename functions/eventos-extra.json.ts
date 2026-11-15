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
  { caminho: 'soccer/bra.1', duracao: 120, sempre: ['premiere'] },
  { caminho: 'soccer/bra.2', duracao: 120, sempre: ['premiere'] },
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
  { caminho: 'basketball/nba', duracao: 150, sempre: ['nba-league-pass'] },
  { caminho: 'football/nfl', duracao: 210 },
  { caminho: 'baseball/mlb', duracao: 180 },
  { caminho: 'hockey/nhl', duracao: 150 },
  { caminho: 'mma/ufc', duracao: 300 },
];

/** Canais esportivos com grade no meuguia.tv: código → nome do canal (vira o slug). */
const GRADES: [string, string][] = [
  ['GRD', 'Globo'], ['SPO', 'SporTV'], ['SP2', 'SporTV 2'], ['SP3', 'SporTV 3'],
  ['121', 'Premiere Clubes'], ['ESP', 'ESPN'], ['ES2', 'ESPN 2'], ['ES3', 'ESPN 3'],
  ['ES4', 'ESPN 4'], ['ES5', 'ESPN 5'], ['BAN', 'Band'], ['BSP', 'BandSports'],
  ['TNT', 'TNT'], ['SPA', 'Space'], ['RTV', 'RedeTV'], ['REC', 'Record'],
  ['SBT', 'SBT'], ['135', 'Combate'],
];

const BRT = -3 * 3600_000;
const JANELA = 40 * 60_000;

interface Programa { inicio: number; titulo: string }

/** Hora de Brasília (-03:00) no formato ISO, que todos os apps entendem. */
function brt(ms: number): string {
  return new Date(ms + BRT).toISOString().slice(0, 19) + '-03:00';
}

function sem(acentos: string): string {
  return acentos.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function slugCanal(nome: string): string {
  return sem(nome).replace(/\+/g, '-plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const GENERICAS = new Set([
  'club', 'clube', 'futebol', 'football', 'sport', 'sports', 'esporte', 'esportes', 'sporting',
  'atletico', 'athletic', 'united', 'city', 'real', 'deportivo', 'calcio', 'associacao',
  'regatas', 'saint', 'santa', 'sociedade', 'esportiva', 'recreativo', 'fc', 'sc', 'ec',
]);

/** Palavras que identificam o time ("Athletico Paranaense" → athletico, paranaense). */
function palavrasDoTime(nomes: (string | undefined)[]): string[] {
  const set = new Set<string>();
  for (const n of nomes) {
    if (!n) continue;
    for (const p of sem(n).split(/[^a-z0-9]+/)) {
      if (p.length >= 4 && !GENERICAS.has(p)) set.add(p);
    }
  }
  return [...set];
}

/** Título de transmissão ao vivo, não reprise nem resumo. */
function aoVivo(titulo: string): boolean {
  const t = sem(titulo);
  if (/^(vt|reprise|compacto)\b/.test(t)) return false;
  return !/(melhores momentos|highlights|reprise|compacto|gols da rodada|resenha|mesa[- ]redonda)/.test(t);
}

/** Lê a grade de um canal: dias em "domingo, 15/11" e horários de Brasília. */
function lerGrade(html: string, agora: number): Programa[] {
  const limpo = html.replace(/<!--[\s\S]*?-->/g, '');
  const re = /<li class="subheader[^"]*">([^<]*)<\/li>|<div class=.lileft time.>\s*(\d{1,2}):(\d{2})\s*<\/div>\s*<div class="licontent">\s*<h2>([^<]*)<\/h2>/g;
  const anoAgora = new Date(agora + BRT).getUTCFullYear();
  const progs: Programa[] = [];
  let dia = -1;
  let mes = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(limpo))) {
    if (m[1] !== undefined) {
      const d = /(\d{1,2})\/(\d{1,2})/.exec(m[1]);
      if (d) { dia = +d[1]; mes = +d[2] - 1; }
      continue;
    }
    if (dia < 0) continue;
    let ano = anoAgora;
    // Grade de 31/12 para 01/01: o mês que "voltou" é do ano seguinte.
    if (mes === 0 && new Date(agora + BRT).getUTCMonth() === 11) ano += 1;
    const inicio = Date.UTC(ano, mes, dia, +m[2], +m[3]) - BRT;
    progs.push({ inicio, titulo: m[4].replace(/&amp;/g, '&').trim() });
  }
  return progs;
}

async function grade(codigo: string, agora: number): Promise<Programa[]> {
  const url = `https://meuguia.tv/programacao/canal/${codigo}`;
  const chave = new Request(`https://saimo-cache.invalid/grade/${codigo}`);
  let cache: Cache | undefined;
  try {
    cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
    const salvo = cache ? await cache.match(chave) : undefined;
    if (salvo) return (await salvo.json()) as Programa[];
  } catch { /* sem cache segue para a rede */ }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!r.ok) return [];
    const progs = lerGrade(await r.text(), agora).filter(p => aoVivo(p.titulo));
    try {
      if (cache) await cache.put(chave, new Response(JSON.stringify(progs), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' },
      }));
    } catch { /* cache é só atalho */ }
    return progs;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

interface Comp {
  homeAway?: string;
  score?: string;
  team?: { name?: string; displayName?: string; shortDisplayName?: string; location?: string; logo?: string };
}

function canaisConfirmados(casa: string[], fora: string[], inicio: number, grades: Map<string, Programa[]>): string[] {
  if (!casa.length || !fora.length) return [];
  const achados: string[] = [];
  for (const [nome, progs] of grades) {
    const bate = progs.some(p => {
      if (Math.abs(p.inicio - inicio) > JANELA) return false;
      const t = sem(p.titulo);
      return casa.some(w => t.includes(w)) && fora.some(w => t.includes(w));
    });
    if (bate) achados.push(slugCanal(nome));
  }
  return achados;
}

async function liga(item: Liga, grades: Map<string, Programa[]>): Promise<unknown[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${item.caminho}/scoreboard?lang=pt&region=br`, { signal: ctrl.signal });
    if (!r.ok) return [];
    const d: any = await r.json();
    const nomeLiga = d?.leagues?.[0]?.name ?? '';
    const logoLiga = d?.leagues?.[0]?.logos?.[0]?.href ?? '';
    const saida: unknown[] = [];
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
      });
    }
    return saida;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
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
  const listas = await Promise.all(GRADES.map(([codigo]) => grade(codigo, agora)));
  const grades = new Map<string, Programa[]>();
  GRADES.forEach(([, nome], i) => grades.set(nome, listas[i]));
  const jogos = (await Promise.all(LIGAS.map(l => liga(l, grades)))).flat() as { time_start: string }[];
  jogos.sort((a, b) => a.time_start.localeCompare(b.time_start));
  return new Response(JSON.stringify(jogos), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=120',
    },
  });
}
