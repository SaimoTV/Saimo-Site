// ============================================================
// EXTRACTOR 404 - CURTITV NO SAIMO TV (canais ao vivo com sessao)
// Criado por 404 - assinatura permanente, nao remover
// ============================================================
// Endpoint unificado de streaming CurtiTV para todos os apps
// Resolve o token dinâmico por stream_id e reescreve a playlist HLS
// vinculando a sessão CURTITV_SITE exata aos segmentos.
// ============================================================

const ASSINATURA = "Criado por 404 - assinatura permanente, nao remover";
const BASE = "https://curtitvonline.com.br";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const REFERER = "https://curtitvonline.com.br/site.php";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, Accept, Origin, User-Agent",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range",
};

let cachedCookie: string | null = null;
let cookieExpires = 0;

async function obterSessao(forcarRenovacao = false): Promise<string> {
  const agora = Date.now();
  if (!forcarRenovacao && cachedCookie && agora < cookieExpires) {
    return cachedCookie;
  }

  // 1. Abre site.php para receber o cookie CURTITV_SITE
  const rSite = await fetch(`${BASE}/site.php`, {
    headers: { "User-Agent": UA, Referer: REFERER },
  });
  const setCookie = rSite.headers.get("set-cookie") || "";
  const match = setCookie.match(/CURTITV_SITE=([^;]+)/);
  if (!match) {
    if (cachedCookie) return cachedCookie;
    throw new Error("Não foi possível obter cookie de sessão CurtiTV");
  }

  const cookie = `CURTITV_SITE=${match[1]}`;

  // 2. Ativa a sessão no backend chamando site_api.php?type=live
  await fetch(`${BASE}/site_api.php?type=live&offset=0&featured=1`, {
    headers: { "User-Agent": UA, Referer: REFERER, Cookie: cookie },
  });

  cachedCookie = cookie;
  cookieExpires = agora + 15 * 60 * 1000; // 15 minutos de cache em memória
  return cookie;
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestGet: PagesFunction = async ({ request }) => {
  const reqUrl = new URL(request.url);
  const streamParam = reqUrl.searchParams.get("stream") || reqUrl.searchParams.get("canal") || reqUrl.searchParams.get("id");
  const segParam = reqUrl.searchParams.get("seg");
  const ckParam = reqUrl.searchParams.get("ck");

  try {
    // ------------------------------------------------------------------
    // CASO 1: Requisição de segmento TS (/api/curtitv?seg=...&ck=...)
    // ------------------------------------------------------------------
    if (segParam) {
      // O token HLS da CurtiTV é criptograficamente vinculado ao cookie da sessão.
      // Se ckParam vier na URL, usamos o cookie exato que gerou aquele token;
      // senão, obtemos ou usamos a sessão em cache.
      const cookie = ckParam ? `CURTITV_SITE=${ckParam}` : await obterSessao();
      const rawSeg = segParam.replace(/^\/+/, "");
      const segTarget = `${BASE}/${rawSeg}`;

      const headers: Record<string, string> = {
        "User-Agent": UA,
        Referer: REFERER,
        Cookie: cookie,
      };

      const range = request.headers.get("Range");
      if (range) headers["Range"] = range;

      const rSeg = await fetch(segTarget, { headers });

      if (!rSeg.ok) {
        return new Response(`Segment error: ${rSeg.status}`, {
          status: rSeg.status,
          headers: CORS_HEADERS,
        });
      }

      const resHeaders = new Headers(CORS_HEADERS);
      resHeaders.set("Content-Type", "video/mp2t");
      resHeaders.set("Cache-Control", "public, max-age=300");
      if (rSeg.headers.has("content-length")) {
        resHeaders.set("Content-Length", rSeg.headers.get("content-length")!);
      }
      if (rSeg.headers.has("content-range")) {
        resHeaders.set("Content-Range", rSeg.headers.get("content-range")!);
      }

      return new Response(rSeg.body, {
        status: rSeg.status,
        headers: resHeaders,
      });
    }

    // ------------------------------------------------------------------
    // CASO 2: Requisição de playlist HLS (/api/curtitv?stream=...)
    // ------------------------------------------------------------------
    if (streamParam) {
      // Limpa streamId se vier como curtitv://67430 ou 67430.m3u8
      const streamId = streamParam
        .replace(/^curtitv:\/\//, "")
        .replace(/\.m3u8$/i, "")
        .replace(/[^0-9]/g, "");

      if (!streamId) {
        return new Response(JSON.stringify({ error: "streamId inválido" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      let cookie = await obterSessao();
      let rToken = await fetch(`${BASE}/hls_token.php?stream=${streamId}&type=live`, {
        headers: { "User-Agent": UA, Referer: REFERER, Cookie: cookie },
      });

      if (rToken.status === 401) {
        cookie = await obterSessao(true);
        rToken = await fetch(`${BASE}/hls_token.php?stream=${streamId}&type=live`, {
          headers: { "User-Agent": UA, Referer: REFERER, Cookie: cookie },
        });
      }

      if (!rToken.ok) {
        return new Response(JSON.stringify({ error: "Falha ao obter token CurtiTV", status: rToken.status }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      const tokenJson = (await rToken.json()) as { ok?: boolean; url?: string; expires?: number };
      if (!tokenJson.ok || !tokenJson.url) {
        return new Response(JSON.stringify({ error: "Token não disponível", detalhe: tokenJson }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      const gatewayUrl = tokenJson.url.startsWith("http") ? tokenJson.url : `${BASE}/${tokenJson.url.replace(/^\/+/, "")}`;
      let rGateway = await fetch(gatewayUrl, {
        headers: { "User-Agent": UA, Referer: REFERER, Cookie: cookie },
      });

      if (!rGateway.ok) {
        // Se falhou, pode ser que o token precisou de nova sessão
        cookie = await obterSessao(true);
        rToken = await fetch(`${BASE}/hls_token.php?stream=${streamId}&type=live`, {
          headers: { "User-Agent": UA, Referer: REFERER, Cookie: cookie },
        });
        const novoToken = (await rToken.json()) as { ok?: boolean; url?: string };
        if (novoToken.ok && novoToken.url) {
          const novaGw = novoToken.url.startsWith("http") ? novoToken.url : `${BASE}/${novoToken.url.replace(/^\/+/, "")}`;
          rGateway = await fetch(novaGw, {
            headers: { "User-Agent": UA, Referer: REFERER, Cookie: cookie },
          });
        }
      }

      if (!rGateway.ok) {
        return new Response(JSON.stringify({ error: "Falha ao carregar gateway HLS", status: rGateway.status }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      const manifestText = await rGateway.text();
      const origin = reqUrl.origin;
      const ckClean = cookie.replace("CURTITV_SITE=", "").trim();

      // Reescreve todas as linhas de segmentos para passarem pelo /api/curtitv?seg=...&ck=...
      const reescrito = manifestText
        .split("\n")
        .map((linha) => {
          const trim = linha.trim();
          if (!trim || trim.startsWith("#")) {
            return linha;
          }
          const segPath = trim.startsWith("/") ? trim.slice(1) : trim;
          return `${origin}/api/curtitv?seg=${encodeURIComponent(segPath)}&ck=${ckClean}`;
        })
        .join("\n");

      return new Response(reescrito, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          ...CORS_HEADERS,
        },
      });
    }

    return new Response(
      JSON.stringify({
        status: "online",
        servico: "CurtiTV 404 Relay SaimoTV",
        assinatura: ASSINATURA,
        uso: "/api/curtitv?stream=<id>",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "Erro no relay CurtiTV",
        detalhe: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }
};
