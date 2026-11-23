/**
 * Aparência: cor de destaque, fundo e animações.
 *
 * O CSS do site tem as cores escritas à mão em centenas de lugares. Na
 * compilação (vite.config.ts, `temaCss`) cada uma delas vira `var(--saimo-…,
 * cor original)`; aqui só se definem as variáveis. Sem escolha, nada é
 * definido e o site fica exatamente como era.
 */

const CHAVE = 'saimo-tema';
const EVENTO = 'saimo-tema-mudou';

export interface Destaque { id: string; nome: string; acento: string; roxo: string }

/** `acento` troca o verde-água; `roxo` troca o violeta (botões, foco, degradês). */
export const DESTAQUES: Destaque[] = [
  { id: 'oceano', nome: 'Oceano', acento: '#4fe3d0', roxo: '#8b5cf6' },
  { id: 'por-do-sol', nome: 'Pôr do sol', acento: '#ffb454', roxo: '#ef4444' },
  { id: 'floresta', nome: 'Floresta', acento: '#7ee787', roxo: '#22c55e' },
  { id: 'rosa', nome: 'Rosa', acento: '#ff7eb6', roxo: '#d946ef' },
  { id: 'safira', nome: 'Safira', acento: '#7aa2ff', roxo: '#3b82f6' },
  { id: 'ouro', nome: 'Ouro', acento: '#fbbf24', roxo: '#f97316' },
];

export type Fundo = 'escuro' | 'amoled' | 'grafite';
export const FUNDOS: { id: Fundo; nome: string; cor: string }[] = [
  { id: 'escuro', nome: 'Escuro', cor: '#0a0a0a' },
  { id: 'amoled', nome: 'Preto total', cor: '#000000' },
  { id: 'grafite', nome: 'Grafite', cor: '#14161c' },
];

export type Animacoes = 'suaves' | 'reduzidas';

/** Acessibilidade: o conteúdo das telas maior (o menu do topo fica igual, para sempre caber). */
export type Tamanho = 'normal' | 'grande' | 'muito-grande' | 'enorme';
export const TAMANHOS: { id: Tamanho; nome: string }[] = [
  { id: 'normal', nome: 'Normal' },
  { id: 'grande', nome: 'Grande' },
  { id: 'muito-grande', nome: 'Muito grande' },
  { id: 'enorme', nome: 'Enorme' },
];

/** Acessibilidade: cada uma liga um `data-*` no <html> que o CSS (index.css) usa. */
export interface Acessibilidade {
  tamanho: Tamanho;
  negrito: boolean;
  contraste: boolean;
  focoForte: boolean;
  espacado: boolean;
}

export interface Tema extends Acessibilidade { destaque: string; fundo: Fundo; animacoes: Animacoes }

const PADRAO: Tema = {
  destaque: 'oceano', fundo: 'escuro', animacoes: 'suaves',
  tamanho: 'normal', negrito: false, contraste: false, focoForte: false, espacado: false,
};

/** Escreve as escolhas de acessibilidade como atributos (no <html> ou numa prévia). */
export function marcarAcessibilidade(el: HTMLElement, a: Acessibilidade): void {
  if (a.tamanho === 'normal') delete el.dataset.tamanho; else el.dataset.tamanho = a.tamanho;
  for (const [chave, ligado] of [['negrito', a.negrito], ['contraste', a.contraste], ['focoForte', a.focoForte], ['espacado', a.espacado]] as const) {
    if (ligado) el.dataset[chave] = ''; else delete el.dataset[chave];
  }
}

export function temaAtual(): Tema {
  try {
    const t = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return {
      destaque: DESTAQUES.some((d) => d.id === t.destaque) ? t.destaque : PADRAO.destaque,
      fundo: FUNDOS.some((f) => f.id === t.fundo) ? t.fundo : PADRAO.fundo,
      animacoes: t.animacoes === 'reduzidas' ? 'reduzidas' : 'suaves',
      tamanho: TAMANHOS.some((x) => x.id === t.tamanho) ? t.tamanho : PADRAO.tamanho,
      negrito: t.negrito === true,
      contraste: t.contraste === true,
      focoForte: t.focoForte === true,
      espacado: t.espacado === true,
    };
  } catch {
    return PADRAO;
  }
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function misturar(hex: string, com: [number, number, number], parte: number): string {
  const [r, g, b] = rgb(hex);
  const m = (a: number, b2: number) => Math.round(a + (b2 - a) * parte);
  return `#${[m(r, com[0]), m(g, com[1]), m(b, com[2])].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function aplicarTema(): void {
  const t = temaAtual();
  const raiz = document.documentElement;
  const vars = ['--saimo-acento', '--saimo-acento-rgb', '--saimo-roxo', '--saimo-roxo-rgb', '--saimo-roxo-claro', '--saimo-roxo-escuro', '--saimo-fundo'];
  vars.forEach((v) => raiz.style.removeProperty(v));
  if (t.destaque !== 'oceano') {
    const d = DESTAQUES.find((x) => x.id === t.destaque)!;
    raiz.style.setProperty('--saimo-acento', d.acento);
    raiz.style.setProperty('--saimo-acento-rgb', rgb(d.acento).join(', '));
    raiz.style.setProperty('--saimo-roxo', d.roxo);
    raiz.style.setProperty('--saimo-roxo-rgb', rgb(d.roxo).join(', '));
    raiz.style.setProperty('--saimo-roxo-claro', misturar(d.roxo, [255, 255, 255], 0.35));
    raiz.style.setProperty('--saimo-roxo-escuro', misturar(d.roxo, [0, 0, 0], 0.25));
  }
  if (t.fundo !== 'escuro') raiz.style.setProperty('--saimo-fundo', FUNDOS.find((f) => f.id === t.fundo)!.cor);
  raiz.dataset.animacoes = t.animacoes;
  marcarAcessibilidade(raiz, t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.fundo === 'escuro' ? '#0a0a0a' : FUNDOS.find((f) => f.id === t.fundo)!.cor);
}

export function definirTema(parcial: Partial<Tema>): void {
  const novo = { ...temaAtual(), ...parcial };
  try { localStorage.setItem(CHAVE, JSON.stringify(novo)); } catch { /* sem espaço */ }
  aplicarTema();
  window.dispatchEvent(new Event(EVENTO));
}

export function aoMudarTema(fn: () => void): () => void {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}

export function iniciarTema(): void {
  aplicarTema();
}
