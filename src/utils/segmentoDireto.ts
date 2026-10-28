/**
 * Segmentos de vídeo direto da origem, sem passar pelo proxy do site.
 *
 * O proxy reescreve a playlist para que cada segmento também passe por ele, e
 * cada segmento é um pedido pago às Pages Functions (milhões por dia). Quando o
 * segmento é https e o servidor dele aceita o navegador (CORS), não há motivo
 * para o desvio: este carregador de fragmentos do hls.js tira o endereço de
 * dentro do `/api/proxy?url=...`, pede direto e, se der qualquer problema
 * (CORS, 403, demora, resposta que não é vídeo), refaz o mesmo pedido pelo
 * proxy na hora. O resultado fica lembrado por servidor, então a tentativa
 * frustrada acontece uma vez só por servidor e o canal nunca deixa de tocar.
 *
 * Fica de fora o que o navegador não consegue repetir sozinho: segmento http
 * (página https bloqueia), pedido com `ua` ou `referer` com caminho e servidores cujo
 * corpo o proxy conserta (TS disfarçado de PNG).
 */

import Hls, { type HlsConfig, type Loader, type LoaderCallbacks, type LoaderConfiguration, type LoaderContext, type LoaderStats } from 'hls.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Estado = 'ok' | 'proxy';

const CHAVE = 'saimo-segmento-direto';
const VALIDADE_MS = 6 * 60 * 60 * 1000;
// O proxy mexe no corpo destes: direto o player recebe lixo.
const SEMPRE_PROXY = /tiktokcdn\.(com|live)|s1001604\.lat/i;

let memoria: Record<string, { e: Estado; em: number }> | null = null;

function lerMemoria(): Record<string, { e: Estado; em: number }> {
  if (memoria) return memoria;
  memoria = {};
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    const agora = Date.now();
    for (const [h, v] of Object.entries<any>(salvo)) {
      if (v && (v.e === 'ok' || v.e === 'proxy') && agora - v.em < VALIDADE_MS) memoria[h] = v;
    }
  } catch { /* sem armazenamento: só na memória */ }
  return memoria;
}

function estadoDe(host: string): Estado | undefined {
  return lerMemoria()[host]?.e;
}

function marcar(host: string, e: Estado): void {
  const m = lerMemoria();
  if (m[host]?.e === e) return;
  m[host] = { e, em: Date.now() };
  try { localStorage.setItem(CHAVE, JSON.stringify(m)); } catch { /* sem armazenamento */ }
}

/** Endereço direto escondido num `.../api/proxy?url=...`, quando dá para pedir direto. */
export function enderecoDireto(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (!u.pathname.endsWith('/api/proxy')) return null;
  // O proxy põe nos segmentos o `referer` da origem da playlist por padrão; só
  // um referer com caminho ou um `ua` próprio indicam exigência do servidor que
  // o navegador não repete. Se a origem fizer questão, a tentativa cai no proxy.
  if (u.searchParams.has('ua')) return null;
  const referer = u.searchParams.get('referer');
  if (referer) {
    try { if (new URL(referer).pathname.length > 1) return null; } catch { return null; }
  }
  const alvo = u.searchParams.get('url');
  if (!alvo || !alvo.startsWith('https://')) return null;
  let host: string;
  try { host = new URL(alvo).host; } catch { return null; }
  if (SEMPRE_PROXY.test(host)) return null;
  if (estadoDe(host) === 'proxy') return null;
  return alvo;
}

/** Corpo que não é vídeo: página de erro em HTML/JSON ou vazio. */
function pareceVideo(data: unknown): boolean {
  if (!(data instanceof ArrayBuffer) || data.byteLength === 0) return false;
  const b = new Uint8Array(data, 0, 1)[0];
  return b !== 0x3c && b !== 0x7b; // '<' ou '{'
}

function copiarStats(de: LoaderStats, para: LoaderStats): void {
  para.aborted = de.aborted;
  para.loaded = de.loaded;
  para.total = de.total;
  para.chunkCount = de.chunkCount;
  para.bwEstimate = de.bwEstimate;
  Object.assign(para.loading, de.loading);
  Object.assign(para.parsing, de.parsing);
  Object.assign(para.buffering, de.buffering);
}

export function criarCarregadorDireto(): HlsConfig['fLoader'] {
  const Base: new (config: HlsConfig) => Loader<LoaderContext> = Hls.DefaultConfig.loader as any;
  const LoadStatsCls = (Hls as any).LoadStats as (new () => LoaderStats) | undefined;
  const statsVazio = (): LoaderStats => (LoadStatsCls ? new LoadStatsCls() : {
    aborted: false, loaded: 0, retry: 0, total: 0, chunkCount: 0, bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 }, parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 },
  } as LoaderStats);

  class CarregadorDireto implements Loader<LoaderContext> {
    context: LoaderContext | null = null;
    stats: LoaderStats = statsVazio();
    private atual: Loader<LoaderContext> | null = null;
    private relogio: ReturnType<typeof setTimeout> | null = null;
    // Enquanto a tentativa direta corre: encerra-a e avisa o hls.js do abort.
    private cancelarDireto: (() => void) | null = null;
    private readonly config: HlsConfig;

    constructor(config: HlsConfig) {
      this.config = config;
    }

    load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>): void {
      this.context = context;
      const original = context.url;
      const direto = enderecoDireto(original);
      if (!direto) {
        this.pelo(original, context, config, callbacks);
        return;
      }
      const host = new URL(direto).host;
      let acabou = false;
      this.cancelarDireto = () => {
        if (acabou) return;
        acabou = true;
        this.limparRelogio();
        try { this.atual?.abort(); this.atual?.destroy(); } catch { /* já encerrado */ }
        this.atual = null;
        this.stats.aborted = true;
        callbacks.onAbort?.(this.stats, context, null);
      };
      const voltar = () => {
        if (acabou) return;
        acabou = true;
        this.cancelarDireto = null;
        this.limparRelogio();
        const tentativa = this.atual;
        this.atual = null;
        try { tentativa?.abort(); tentativa?.destroy(); } catch { /* já encerrado */ }
        marcar(host, 'proxy');
        this.pelo(original, context, config, callbacks);
      };
      // Servidor ainda não testado: pouca paciência, o proxy está logo atrás.
      this.relogio = setTimeout(voltar, estadoDe(host) === 'ok' ? 12000 : 5000);
      const tentativa = new Base(this.config);
      this.atual = tentativa;
      const ctxDireto: LoaderContext = { ...context, url: direto };
      tentativa.load(ctxDireto, { ...config, maxRetry: 0, retryDelay: 0 } as LoaderConfiguration, {
        onSuccess: (resp, stats, _ctx, net) => {
          if (acabou) return;
          if (!pareceVideo(resp.data)) { voltar(); return; }
          acabou = true;
          this.cancelarDireto = null;
          this.limparRelogio();
          marcar(host, 'ok');
          copiarStats(stats, this.stats);
          callbacks.onSuccess({ ...resp, url: original }, this.stats, context, net);
        },
        onError: () => voltar(),
        onTimeout: () => voltar(),
        onAbort: () => { /* abort vem de fora (this.abort) ou de voltar() */ },
        onProgress: undefined,
      });
    }

    /** Pedido comum, pelo endereço dado (o do proxy). */
    private pelo(url: string, context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>): void {
      const loader = new Base(this.config);
      this.atual = loader;
      const repassar = (stats: LoaderStats) => { copiarStats(stats, this.stats); return this.stats; };
      loader.load({ ...context, url }, config, {
        onSuccess: (resp, stats, _ctx, net) => callbacks.onSuccess(resp, repassar(stats), context, net),
        onError: (err, _ctx, net, stats) => callbacks.onError(err, context, net, repassar(stats)),
        onTimeout: (stats, _ctx, net) => callbacks.onTimeout(repassar(stats), context, net),
        onAbort: callbacks.onAbort ? (stats, _ctx, net) => callbacks.onAbort!(repassar(stats), context, net) : undefined,
        onProgress: callbacks.onProgress
          ? (stats, _ctx, data, net) => callbacks.onProgress!(repassar(stats), context, data, net)
          : undefined,
      });
    }

    private limparRelogio(): void {
      if (this.relogio) clearTimeout(this.relogio);
      this.relogio = null;
    }

    abort(): void {
      if (this.cancelarDireto) {
        const cancelar = this.cancelarDireto;
        this.cancelarDireto = null;
        cancelar();
        return;
      }
      this.limparRelogio();
      this.stats.aborted = true;
      try { this.atual?.abort(); } catch { /* já encerrado */ }
    }

    destroy(): void {
      this.cancelarDireto = null;
      this.limparRelogio();
      try { this.atual?.destroy(); } catch { /* já encerrado */ }
      this.atual = null;
      this.context = null;
    }

    getResponseHeader(name: string): string | null {
      return (this.atual as any)?.getResponseHeader?.(name) ?? null;
    }

    getCacheAge(): number | null {
      return (this.atual as any)?.getCacheAge?.() ?? null;
    }
  }

  return CarregadorDireto as unknown as HlsConfig['fLoader'];
}
