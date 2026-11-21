export const onRequest = (): Response =>
  new Response('google-site-verification: google659f6dc1534fac3c.html', {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
