/**
 * Estilo das legendas: fonte, tamanho, cor, fundo e posição.
 *
 * As legendas saem do próprio <video> (faixas de texto), que se estilizam por
 * `::cue`. O estilo vira uma folha de estilo escrita aqui sempre que muda; a
 * posição é um atributo de cada fala (`line`), aplicado nas faixas do vídeo.
 */

const CHAVE = 'saimo-legenda-estilo';
const EVENTO = 'saimo-legenda-estilo-mudou';

export interface EstiloDeLegenda {
  fonte: 'padrao' | 'classica' | 'mono' | 'arredondada';
  tamanho: 'pequena' | 'media' | 'grande' | 'enorme';
  cor: 'branco' | 'amarelo' | 'ciano' | 'verde';
  fundo: 'nenhum' | 'sombra' | 'translucido' | 'preto';
  posicao: 'baixo' | 'alto' | 'topo';
}

export const PADRAO: EstiloDeLegenda = { fonte: 'padrao', tamanho: 'media', cor: 'branco', fundo: 'translucido', posicao: 'baixo' };

export const OPCOES = {
  fonte: [['padrao', 'Padrão'], ['classica', 'Clássica'], ['mono', 'Monoespaçada'], ['arredondada', 'Arredondada']],
  tamanho: [['pequena', 'Pequena'], ['media', 'Média'], ['grande', 'Grande'], ['enorme', 'Enorme']],
  cor: [['branco', 'Branco'], ['amarelo', 'Amarelo'], ['ciano', 'Ciano'], ['verde', 'Verde']],
  fundo: [['nenhum', 'Sem fundo'], ['sombra', 'Contorno'], ['translucido', 'Caixa translúcida'], ['preto', 'Caixa preta']],
  posicao: [['baixo', 'Embaixo'], ['alto', 'Mais acima'], ['topo', 'No topo']],
} as const;

const FONTES = {
  padrao: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  classica: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  arredondada: "ui-rounded, 'Trebuchet MS', 'Segoe UI', sans-serif",
} as const;
const TAMANHOS = { pequena: '0.95em', media: '1.25em', grande: '1.7em', enorme: '2.2em' } as const;
const CORES = { branco: '#ffffff', amarelo: '#ffe14d', ciano: '#4fe3d0', verde: '#7ee787' } as const;

export function estiloAtual(): EstiloDeLegenda {
  try {
    const e = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    const ok = <K extends keyof EstiloDeLegenda>(k: K) => (OPCOES[k] as readonly (readonly [string, string])[]).some(([v]) => v === e[k]) ? e[k] : PADRAO[k];
    return { fonte: ok('fonte'), tamanho: ok('tamanho'), cor: ok('cor'), fundo: ok('fundo'), posicao: ok('posicao') };
  } catch {
    return PADRAO;
  }
}

/** A linha (contada de baixo para cima, como `VTTCue.line` negativo). */
export function linhaDaLegenda(): number {
  const p = estiloAtual().posicao;
  return p === 'topo' ? 1 : p === 'alto' ? -7 : -2;
}

export function cssDaLegenda(e: EstiloDeLegenda = estiloAtual()): string {
  const fundo = e.fundo === 'nenhum' ? 'transparent' : e.fundo === 'preto' ? '#000' : e.fundo === 'translucido' ? 'rgba(0,0,0,0.72)' : 'transparent';
  const sombra = e.fundo === 'sombra' || e.fundo === 'nenhum'
    ? '0 0 3px #000, 0 0 3px #000, 1px 1px 2px #000, -1px -1px 2px #000' : 'none';
  return `.movie-video::cue, video::cue { background: ${fundo}; color: ${CORES[e.cor]}; font-family: ${FONTES[e.fonte]}; font-size: ${TAMANHOS[e.tamanho]}; line-height: 1.3; text-shadow: ${sombra}; }`;
}

/** Aplica a posição em todas as falas de todas as faixas do vídeo. */
export function posicionarFalas(video: HTMLVideoElement): void {
  const linha = linhaDaLegenda();
  for (let i = 0; i < video.textTracks.length; i++) {
    const cues = video.textTracks[i].cues;
    if (!cues) continue;
    for (let j = 0; j < cues.length; j++) {
      const c = cues[j] as VTTCue;
      if ('line' in c) { c.snapToLines = true; c.line = linha; }
    }
  }
}

export function aplicarEstiloDeLegenda(): void {
  let folha = document.getElementById('saimo-legenda-css') as HTMLStyleElement | null;
  if (!folha) {
    folha = document.createElement('style');
    folha.id = 'saimo-legenda-css';
    document.head.appendChild(folha);
  }
  folha.textContent = cssDaLegenda();
}

export function definirEstiloDeLegenda(parcial: Partial<EstiloDeLegenda>): void {
  try { localStorage.setItem(CHAVE, JSON.stringify({ ...estiloAtual(), ...parcial })); } catch { /* sem espaço */ }
  aplicarEstiloDeLegenda();
  window.dispatchEvent(new Event(EVENTO));
}

export function aoMudarEstiloDeLegenda(fn: () => void): () => void {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}
