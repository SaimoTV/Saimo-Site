/**
 * O que a pessoa já assistiu: filmes e episódios concluídos, e o tempo total
 * de tela. Alimenta as estatísticas dos Ajustes e o "✓ Assistido" dos
 * episódios, que também pode ser marcado e desmarcado à mão.
 *
 * Guardado por perfil (ver perfis.ts). Cada título concluído vira uma entrada
 * pequena; o tempo assistido é um contador só, somado de 5 em 5 segundos
 * enquanto o vídeo toca.
 */

const CHAVE = 'saimo-assistidos';
const EVENTO = 'saimo-assistidos-mudou';

export interface Concluido {
  /** Título da obra. */
  t: string;
  /** Série (episódio) ou filme. */
  s: boolean;
  /** Temporada e episódio, quando é série. */
  T?: number;
  E?: number;
  /** Duração em segundos (0 quando marcado à mão e a duração é desconhecida). */
  d: number;
  /** Quando foi concluído (ms). */
  q: number;
  /** Marcado à mão. */
  m?: boolean;
}

interface Dados {
  itens: Record<string, Concluido>;
  /** Segundos assistidos no total. */
  tempo: number;
}

function ler(): Dados {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return { itens: d && typeof d.itens === 'object' && d.itens ? d.itens : {}, tempo: Number(d?.tempo) || 0 };
  } catch {
    return { itens: {}, tempo: 0 };
  }
}

function gravar(d: Dados): void {
  try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch { /* sem espaço: segue sem guardar */ }
}

function avisar(): void {
  window.dispatchEvent(new Event(EVENTO));
}

export function chaveDe(titulo: string, temporada?: number, episodio?: number): string {
  return temporada && episodio ? `s|${titulo}|${temporada}|${episodio}` : `f|${titulo}`;
}

export function ehAssistido(titulo: string, temporada?: number, episodio?: number): boolean {
  return chaveDe(titulo, temporada, episodio) in ler().itens;
}

/** Marca como concluído (o player chama sozinho ao passar de 90%; a pessoa pode marcar à mão). */
export function marcarAssistido(titulo: string, temporada?: number, episodio?: number, duracao = 0, aMao = false): void {
  const dados = ler();
  const k = chaveDe(titulo, temporada, episodio);
  if (dados.itens[k] && !aMao) return;
  dados.itens[k] = {
    t: titulo, s: !!(temporada && episodio), ...(temporada && episodio ? { T: temporada, E: episodio } : {}),
    d: Math.round(duracao), q: Date.now(), ...(aMao ? { m: true } : {}),
  };
  gravar(dados);
  avisar();
}

export function desmarcarAssistido(titulo: string, temporada?: number, episodio?: number): void {
  const dados = ler();
  delete dados.itens[chaveDe(titulo, temporada, episodio)];
  gravar(dados);
  avisar();
}

/** Soma tempo assistido (segundos). Pequeno e frequente: não avisa a tela. */
export function somarTempo(segundos: number): void {
  if (!(segundos > 0) || segundos > 120) return;
  const dados = ler();
  dados.tempo += segundos;
  gravar(dados);
}

export interface Estatisticas {
  tempoTotal: number;
  filmes: number;
  episodios: number;
  series: number;
  /** Horas de conteúdo concluído (pela duração gravada). */
  concluidoSegundos: number;
  /** Concluídos nos últimos 30 dias. */
  ultimos30: number;
  /** Série com mais episódios concluídos. */
  maisVista: { titulo: string; episodios: number } | null;
}

export function estatisticas(): Estatisticas {
  const { itens, tempo } = ler();
  const lista = Object.values(itens);
  const filmes = lista.filter((i) => !i.s).length;
  const eps = lista.filter((i) => i.s);
  const porSerie = new Map<string, number>();
  for (const e of eps) porSerie.set(e.t, (porSerie.get(e.t) || 0) + 1);
  const top = [...porSerie.entries()].sort((a, b) => b[1] - a[1])[0];
  const corte = Date.now() - 30 * 86400000;
  return {
    tempoTotal: tempo,
    filmes,
    episodios: eps.length,
    series: porSerie.size,
    concluidoSegundos: lista.reduce((s, i) => s + (i.d || 0), 0),
    ultimos30: lista.filter((i) => i.q >= corte).length,
    maisVista: top ? { titulo: top[0], episodios: top[1] } : null,
  };
}

export function limparAssistidos(): void {
  localStorage.removeItem(CHAVE);
  avisar();
}

export function aoMudarAssistidos(fn: () => void): () => void {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}

/** "1 h 05 min", "42 min", "3 d 4 h". */
export function duracaoLegivel(segundos: number): string {
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${String(min % 60).padStart(2, '0')} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}
