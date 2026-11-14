/**
 * Agenda de jogos do Saimo, montada a partir dos placares da ESPN.
 * Formato igual ao que os apps já leem (teams, league, time_start, players),
 * preenchendo `players` com os canais prováveis da transmissão no Brasil
 * (e da própria ESPN quando informados) para vincular tanto com o catálogo
 * quanto com as listas adicionadas pelo usuário. Jogo sem canal na lista
 * também entra na agenda.
 */
const LIGAS: { caminho: string; canais: string[] }[] = [
  { caminho: 'soccer/bra.1', canais: ['premiere', 'premiere-2', 'premiere-clubes', 'sportv', 'sportv-2', 'globo', 'cazetv', 'record'] },
  { caminho: 'soccer/bra.2', canais: ['premiere', 'sportv', 'band', 'cazetv', 'canal-goat'] },
  { caminho: 'soccer/bra.copa_do_brazil', canais: ['premiere', 'sportv', 'globo', 'prime-video'] },
  { caminho: 'soccer/conmebol.libertadores', canais: ['espn', 'espn-2', 'espn-3', 'espn-4', 'paramount-plus', 'globo'] },
  { caminho: 'soccer/conmebol.sudamericana', canais: ['espn', 'espn-2', 'paramount-plus', 'sbt'] },
  { caminho: 'soccer/uefa.champions', canais: ['tnt', 'tnt-sports', 'space', 'max', 'sbt'] },
  { caminho: 'soccer/uefa.europa', canais: ['cazetv', 'band'] },
  { caminho: 'soccer/eng.1', canais: ['espn', 'espn-2', 'espn-3', 'espn-4', 'disney-plus'] },
  { caminho: 'soccer/esp.1', canais: ['espn', 'espn-2', 'espn-3', 'espn-4', 'disney-plus'] },
  { caminho: 'soccer/ita.1', canais: ['espn', 'espn-2', 'espn-3', 'cazetv', 'disney-plus'] },
  { caminho: 'soccer/ger.1', canais: ['cazetv', 'sportv', 'band', 'canal-goat'] },
  { caminho: 'soccer/fra.1', canais: ['cazetv'] },
  { caminho: 'soccer/por.1', canais: ['espn', 'espn-2', 'espn-3', 'disney-plus'] },
  { caminho: 'soccer/ned.1', canais: ['espn', 'espn-2', 'espn-3', 'disney-plus'] },
  { caminho: 'soccer/arg.1', canais: ['espn', 'espn-2', 'espn-3', 'disney-plus'] },
  { caminho: 'soccer/ksa.1', canais: ['band', 'bandsports', 'canal-goat'] },
  { caminho: 'soccer/fifa.world', canais: ['globo', 'sportv', 'cazetv'] },
  { caminho: 'soccer/fifa.worldq.conmebol', canais: ['globo', 'sportv'] },
  { caminho: 'basketball/nba', canais: ['espn', 'espn-2', 'prime-video', 'nba-league-pass'] },
  { caminho: 'football/nfl', canais: ['espn', 'espn-2', 'rede-tv', 'cazetv'] },
  { caminho: 'baseball/mlb', canais: ['espn', 'espn-2', 'espn-3', 'disney-plus'] },
  { caminho: 'hockey/nhl', canais: ['espn', 'espn-2', 'espn-3', 'disney-plus'] },
  { caminho: 'mma/ufc', canais: ['ufc-fight-pass', 'band'] },
];

interface Comp {
  homeAway?: string;
  score?: string;
  broadcasts?: { names?: string[] }[];
  geoBroadcasts?: { media?: { shortName?: string } }[];
  team?: { name?: string; displayName?: string; logo?: string };
}

/** Hora de Brasília (-03:00) no formato ISO, que todos os apps entendem. */
function brt(ms: number): string {
  const d = new Date(ms - 3 * 3600_000);
  return d.toISOString().slice(0, 19) + '-03:00';
}

function slugCanal(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\+/g, '-plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function canaisDoEvento(comp: Comp | undefined, padraoLiga: string[]): string[] {
  const vistos = new Set<string>();
  const slugs: string[] = [];
  const add = (s: string) => {
    if (s && !vistos.has(s)) {
      vistos.add(s);
      slugs.push(`https://saimo-tv/canal/${s}`);
    }
  };
  for (const b of comp?.broadcasts ?? []) {
    for (const n of b?.names ?? []) {
      const s = slugCanal(n);
      if (s.startsWith('espn-deportes')) add('espn');
      else if (s === 'espn-plus') add('disney-plus');
      else if (s) add(s);
    }
  }
  for (const gb of comp?.geoBroadcasts ?? []) {
    const n = gb?.media?.shortName;
    if (n) {
      const s = slugCanal(n);
      if (s.startsWith('espn-deportes')) add('espn');
      else if (s === 'espn-plus') add('disney-plus');
      else if (s) add(s);
    }
  }
  for (const s of padraoLiga) add(s);
  return slugs;
}

async function liga(item: { caminho: string; canais: string[] }): Promise<unknown[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${item.caminho}/scoreboard`, { signal: ctrl.signal });
    if (!r.ok) return [];
    const d: any = await r.json();
    const nomeLiga = d?.leagues?.[0]?.name ?? '';
    const logoLiga = d?.leagues?.[0]?.logos?.[0]?.href ?? '';
    const saida: unknown[] = [];
    for (const ev of d?.events ?? []) {
      const comp: Comp | undefined = ev?.competitions?.[0];
      const comps: Comp[] = (comp as any)?.competitors ?? [];
      const casa = comps.find(c => c.homeAway === 'home');
      const fora = comps.find(c => c.homeAway !== 'home');
      if (!casa || !fora) continue;
      const inicio = new Date(ev.date).getTime();
      if (isNaN(inicio)) continue;
      const st = ev?.status?.type;
      const estado: string = st?.state ?? '';
      if (estado === 'post') continue;
      saida.push({
        players: canaisDoEvento(comp, item.canais),
        time_start: brt(inicio),
        time_end: brt(inicio + 2 * 3600_000),
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

export const onRequestGet: PagesFunction = async () => {
  const jogos = (await Promise.all(LIGAS.map(liga))).flat() as { time_start: string }[];
  jogos.sort((a, b) => a.time_start.localeCompare(b.time_start));
  return new Response(JSON.stringify(jogos), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=120',
    },
  });
};
