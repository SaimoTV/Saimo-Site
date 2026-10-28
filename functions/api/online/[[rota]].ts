/**
 * Telemetria desligada: nada é contado nem guardado. A rota só existe para apps
 * antigos que ainda batem aqui; a resposta manda amostra 0% (eles param de enviar).
 */
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' };

export const onRequest = async ({ request }: { request: Request }): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const rota = new URL(request.url).pathname.replace(/^\/api\/online/, '') || '/';
  if (request.method !== 'POST') return new Response('Não encontrado', { status: 404 });
  if (rota === '/v1/hello') {
    return new Response(JSON.stringify({
      heartbeatSeconds: 86400, amostra: false, amostraPct: 0,
      serverTime: Math.floor(Date.now() / 1000),
    }), { headers: { ...cors, 'content-type': 'application/json' } });
  }
  return new Response(null, { status: 204, headers: cors });
};
