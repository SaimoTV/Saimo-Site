/**
 * Bloqueio de extensões que capturam os endereços dos canais e filmes.
 *
 * Os "sniffers" de mídia (FlowPick, baixadores de vídeo e afins) se instalam
 * dentro da página trocando as funções do navegador por onde o vídeo passa:
 * fetch, XMLHttpRequest, MediaSource/SourceBuffer, URL.createObjectURL e o
 * `src` dos elementos de mídia. O site não troca nenhuma delas, então
 * qualquer uma que não seja a nativa denuncia uma extensão desse tipo
 * (`ganchoDeCaptura`). Além disso, as marcas conhecidas da FlowPick
 * (github.com/ezwebtools/flowpick):
 *
 *  - injeta `<script data-m3u8-injected>` e o mantém no documento;
 *  - define `window.__flowpickPageHook` no mundo da página;
 *  - conversa com a página por `postMessage` com `type` começando em "FLOWPICK_".
 *
 * Extensão que só observa a rede de fora da página (permissão webRequest)
 * não deixa rastro que um site consiga ver; contra essa só os apps.
 *
 * Detectada, o site para todo vídeo e não abre mais nenhum, sem aviso. A
 * extensão vê o tráfego de rede pelo navegador, então o que impede a captura
 * é não pedir nada enquanto ela está ativa.
 */

const EVENTO = 'saimo-extensao-bloqueada';

let detectada: string | null = null;

/** Nome da extensão detectada, ou null. Confere de novo a cada chamada (antes de tocar). */
export function extensaoBloqueada(): string | null {
  if (!detectada) verificarMarcas();
  return detectada;
}

function pararTodosOsVideos(): void {
  document.querySelectorAll('video, audio').forEach((m) => {
    const midia = m as HTMLMediaElement;
    try {
      midia.pause();
      midia.removeAttribute('src');
      midia.srcObject = null;
      midia.load();
    } catch { /* elemento já fora */ }
  });
}

function marcar(nome: string): void {
  if (!detectada) {
    detectada = nome;
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: nome }));
  }
  pararTodosOsVideos();
}

// O toString de referência vem de um iframe limpo: a extensão pode ter
// trocado o toString desta página para esconder as próprias trocas.
let toStringLimpo: ((this: unknown) => string) | null = null;
function codigoDe(fn: unknown): string {
  try {
    if (!toStringLimpo) {
      const quadro = document.createElement('iframe');
      quadro.style.display = 'none';
      document.documentElement.appendChild(quadro);
      toStringLimpo = (quadro.contentWindow as unknown as { Function: FunctionConstructor }).Function.prototype.toString;
      quadro.remove();
    }
    return toStringLimpo.call(fn);
  } catch {
    return Function.prototype.toString.call(fn);
  }
}

function nativa(fn: unknown): boolean {
  if (typeof fn !== 'function') return true; // função ausente não é gancho
  return /\{\s*\[native code\]\s*\}\s*$/.test(codigoDe(fn));
}

/** Nome da função do navegador trocada por uma extensão, ou null. */
function ganchoDeCaptura(): string | null {
  const w = window as unknown as Record<string, any>;
  const midia = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
  const alvos: Array<[string, unknown]> = [
    ['fetch', w.fetch],
    ['XMLHttpRequest.open', w.XMLHttpRequest?.prototype?.open],
    ['XMLHttpRequest.send', w.XMLHttpRequest?.prototype?.send],
    ['URL.createObjectURL', w.URL?.createObjectURL],
    ['MediaSource.addSourceBuffer', w.MediaSource?.prototype?.addSourceBuffer],
    ['SourceBuffer.appendBuffer', w.SourceBuffer?.prototype?.appendBuffer],
    ['HTMLMediaElement.src', midia?.set],
  ];
  for (const [nome, fn] of alvos) if (!nativa(fn)) return nome;
  return null;
}

function verificarMarcas(): void {
  if (document.querySelector('script[data-m3u8-injected]')) marcar('FlowPick');
  if ((window as unknown as Record<string, unknown>).__flowpickPageHook) marcar('FlowPick');
  const gancho = ganchoDeCaptura();
  if (gancho) marcar(`captura de mídia (${gancho})`);
}

/** Liga a vigilância. Chamar uma vez, antes de desenhar a página. */
export function vigiarExtensoes(): void {
  verificarMarcas();
  window.addEventListener('message', (e) => {
    const tipo = (e.data as { type?: unknown } | null)?.type;
    if (typeof tipo === 'string' && tipo.startsWith('FLOWPICK_')) marcar('FlowPick');
  });
  // O script dela entra em document_start e pode chegar depois do nosso; ela
  // o põe no <head> (ou no <html>). Só esses dois: observar a página inteira
  // dispararia a checagem a cada redesenho do React.
  const observador = new MutationObserver(verificarMarcas);
  observador.observe(document.documentElement, { childList: true });
  if (document.head) observador.observe(document.head, { childList: true });
  window.setInterval(verificarMarcas, 3000);
}

/** Avisa quando uma extensão for detectada (os players se desmontam). */
export function aoBloquearExtensao(fn: (nome: string) => void): () => void {
  const ouvir = (e: Event) => fn((e as CustomEvent<string>).detail);
  window.addEventListener(EVENTO, ouvir);
  return () => window.removeEventListener(EVENTO, ouvir);
}
