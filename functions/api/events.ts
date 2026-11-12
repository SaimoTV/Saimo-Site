/**
 * A agenda de jogos (para apps antigos que ainda chamam /api/events): só a
 * agenda do Saimo. Nenhum site de streaming de terceiros é consultado.
 */
const MONITOR = 'https://saimo-tv.pages.dev/eventos-extra.json';
const AGENTE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function buscar(url: string, prazoMs: number): Promise<string | null> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), prazoMs);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': AGENTE }, signal: controle.signal });
    return r.ok ? await r.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(relogio);
  }
}

export const onRequest: PagesFunction = async () => {
  const cabecalhos = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60',
  };
  const corpo = await buscar(MONITOR, 8000);
  if (corpo) return new Response(corpo, { headers: cabecalhos });
  return new Response(JSON.stringify({ error: 'sem agenda' }), {
    status: 502,
    headers: { ...cabecalhos, 'Cache-Control': 'no-store' },
  });
};
