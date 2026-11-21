const ROTAS: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/app', changefreq: 'weekly', priority: '0.9' },
  { path: '/tv', changefreq: 'daily', priority: '0.9' },
  { path: '/movies', changefreq: 'daily', priority: '0.9' },
  { path: '/home', changefreq: 'daily', priority: '0.8' },
  { path: '/radios', changefreq: 'weekly', priority: '0.7' },
  { path: '/eventos', changefreq: 'daily', priority: '0.7' },
  { path: '/formato', changefreq: 'monthly', priority: '0.6' },
  { path: '/suporte', changefreq: 'monthly', priority: '0.6' },
  { path: '/sobre', changefreq: 'monthly', priority: '0.6' },
  { path: '/privacidade', changefreq: 'yearly', priority: '0.3' },
  { path: '/termos', changefreq: 'yearly', priority: '0.3' },
  { path: '/conteudo', changefreq: 'yearly', priority: '0.3' },
];

export const onRequest = ({ request }: { request: Request }): Response => {
  const url = new URL(request.url);
  const host = url.hostname === 'www.saimo-tv.com.br' ? 'https://www.saimo-tv.com.br' : 'https://saimo-tv.com.br';
  const hoje = new Date().toISOString().slice(0, 10);

  const urlsXml = ROTAS.map(
    (r) => `  <url>
    <loc>${host}${r.path}</loc>
    <lastmod>${hoje}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`,
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
};
