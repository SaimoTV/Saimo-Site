/**
 * Agenda de jogos do Saimo, montada a partir dos placares da ESPN.
 * Formato igual ao que os apps já leem (teams, league, time_start, players),
 * com `players` vazio: o canal é achado em cada app, quando existe. Jogo sem
 * canal também entra na lista.
 */
const LIGAS = [
  'soccer/bra.1', 'soccer/bra.2', 'soccer/bra.copa_do_brazil', 'soccer/conmebol.libertadores',
  'soccer/conmebol.sudamericana', 'soccer/uefa.champions', 'soccer/uefa.europa', 'soccer/eng.1',
  'soccer/esp.1', 'soccer/ita.1', 'soccer/ger.1', 'soccer/fra.1', 'soccer/por.1', 'soccer/ned.1',
  'soccer/arg.1', 'soccer/ksa.1', 'soccer/fifa.world', 'soccer/fifa.worldq.conmebol',
  'basketball/nba', 'football/nfl', 'baseball/mlb', 'hockey/nhl', 'mma/ufc',
];

interface Comp { homeAway?: string; score?: string; team?: { name?: string; displayName?: string; logo?: string } }

/** Hora de Brasília (-03:00) no formato ISO, que todos os apps entendem. */
function brt(ms: number): string {
  const d = new Date(ms - 3 * 3600_000);
  return d.toISOString().slice(0, 19) + '-03:00';
}

async function liga(caminho: string): Promise<unknown[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${caminho}/scoreboard`, { signal: ctrl.signal });
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
      saida.push({
        players: [],
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
