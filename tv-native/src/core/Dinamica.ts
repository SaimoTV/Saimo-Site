/**
 * `/api/stream` só escolhe o destino quando chamado e pode cair em HLS sem
 * extensão nenhuma no endereço: o player tratava como vídeo comum e falhava
 * com formato inválido. Aqui ele vira o endereço final antes de tocar.
 *
 * Devolve `null` quando o servidor afirma (404) que não há vídeo em provedor
 * nenhum, e o próprio endereço quando não deu para saber (rede, limite).
 */
export async function resolverDinamica(url: string): Promise<string | null> {
  if (!/^https?:\/\/[^/]+\/api\/stream\?/i.test(url)) return url;
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), 12000);
  try {
    const r = await fetch(url + '&json=1', { signal: controle.signal });
    if (r.status === 404) return null;
    if (!r.ok) return url;
    const destino = String((await r.json())?.url ?? '');
    if (!destino) return url;
    // A TV abre http direto: o proxy do site (barrado pela Cloudflare) sai do caminho.
    const proxy = destino.match(/\/api\/proxy\?(?:.*&)?url=([^&]+)/);
    if (proxy) {
      const dentro = decodeURIComponent(proxy[1]);
      if (/^https?:\/\//.test(dentro)) return dentro;
    }
    return destino;
  } catch {
    return url;
  } finally {
    clearTimeout(limite);
  }
}
