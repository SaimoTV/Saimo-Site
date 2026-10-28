/**
 * Mesma função de proxy, no formato que a Vercel espera.
 *
 * A produção do site roda no Cloudflare Pages (functions/api/proxy.ts). Este
 * arquivo reexporta o mesmo handler para que os dois ambientes nunca divirjam:
 * uma correção de CDN feita em um vale para o outro, e antes disso as duas
 * cópias já haviam saído de sincronia.
 *
 * Roda no runtime Node, não no Edge, e isso é o ponto: o Edge da Vercel usa a
 * mesma infraestrutura da Cloudflare, e boa parte dos CDNs desta lista responde
 * 403 para os IPs de lá. O Node roda em outra rede, que eles aceitam — é por
 * isso que vale manter esta cópia de pé mesmo com o site hospedado na
 * Cloudflare, com `VITE_PROXY_BASE` apontando para cá.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { onRequest } from '../functions/api/proxy';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const host = req.headers.host ?? 'localhost';
  const protocolo = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'https';
  const url = `${protocolo}://${host}${req.url ?? '/'}`;

  const cabecalhos = new Headers();
  // Só o Range atravessa: o resto é do pedido do navegador para o site, e a
  // função monta os seus próprios cabeçalhos para falar com a origem.
  if (req.headers.range) cabecalhos.set('range', String(req.headers.range));

  const resposta = await onRequest({
    request: new Request(url, { method: req.method ?? 'GET', headers: cabecalhos }),
  });

  res.statusCode = resposta.status;
  resposta.headers.forEach((valor, chave) => res.setHeader(chave, valor));

  if (!resposta.body || req.method === 'HEAD') {
    res.end();
    return;
  }

  // O corpo sai em pedaços, sem passar o filme inteiro pela memória. Se o
  // player desistir no meio, a leitura é cancelada junto.
  const leitor = resposta.body.getReader();
  res.on('close', () => { void leitor.cancel().catch(() => {}); });
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      if (!res.write(value)) {
        await new Promise((pronto) => res.once('drain', pronto));
      }
    }
  } catch {
    // Conexão interrompida: nada a fazer além de fechar.
  }
  res.end();
}
