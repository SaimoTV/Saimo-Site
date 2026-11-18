/**
 * "Continue assistindo" do site.
 *
 * O ponto de cada vídeo já era guardado (movie-progress-*), mas só pelo id do
 * vídeo — não dava para montar uma fileira com isso. Aqui fica também o
 * endereço do título no acervo, para o cartão abrir a ficha certa.
 */
import type { ItemDestaque } from './vodService';

const CHAVE = 'saimo-continuar';

export interface Andamento {
  origem: ItemDestaque;
  rotulo: string;
  fracao: number;
  quando: number;
  /** Ponto e duração em milissegundos (para a Conta Saimo e para retomar em outro aparelho). */
  pos?: number;
  dur?: number;
  temporada?: number;
  episodio?: number;
}

function ler(): Andamento[] {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

export function registrar(origem: ItemDestaque, rotulo: string, tempo: number, duracao: number, temporada?: number, episodio?: number) {
  if (!origem?.titulo || !duracao) return;
  const fracao = tempo / duracao;
  const resto = ler().filter((a) => a.origem.titulo !== origem.titulo);
  // Acabou (ou quase): sai da fileira — série fica, no próximo episódio.
  if (fracao >= 0.95 && origem.tipo === 'f') {
    localStorage.setItem(CHAVE, JSON.stringify(resto));
    return;
  }
  const novo: Andamento = {
    origem, rotulo, fracao: Math.min(fracao, 1), quando: Date.now(),
    pos: Math.round(tempo * 1000), dur: Math.round(duracao * 1000),
    ...(temporada && episodio ? { temporada, episodio } : {}),
  };
  localStorage.setItem(CHAVE, JSON.stringify([novo, ...resto].slice(0, 20)));
}

/**
 * Onde parou neste título (segundos), quando não há o ponto guardado pelo id do
 * vídeo: o que veio de outro aparelho pela Conta Saimo. Série: só o mesmo episódio.
 */
export function posicao(origem: ItemDestaque | undefined, temporada?: number, episodio?: number): number {
  if (!origem?.titulo) return 0;
  const a = ler().find((x) => x.origem.titulo === origem.titulo && (x.origem.ano || '') === (origem.ano || ''));
  if (!a?.pos) return 0;
  if (temporada && episodio && (a.temporada !== temporada || a.episodio !== episodio)) return 0;
  return a.pos / 1000;
}

export function lista(): Andamento[] {
  return ler().sort((a, b) => b.quando - a.quando);
}

export function remover(titulo: string) {
  const alvo = titulo.trim().toLowerCase();
  localStorage.setItem(
    CHAVE,
    JSON.stringify(ler().filter((a) => a.origem.titulo.trim().toLowerCase() !== alvo && a.origem.titulo !== titulo))
  );
  window.dispatchEvent(new CustomEvent('saimo-continuar-mudou'));
}
