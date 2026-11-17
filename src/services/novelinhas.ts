/**
 * Novelinhas: minisséries verticais (720x1280, ~1 min por episódio) da
 * RedeFlix, publicadas em `novelinhas.txt` no endereço dos filmes por
 * atualizar_novelinhas.py.
 *
 *   base: https://.../novelinhas/
 *   id  título  pasta  episódios  áudio(dub|leg)  capa  gêneros  sinopse
 *
 * Episódio N = base + pasta + "/episode-" + N com três dígitos + ".mp4".
 */
import { linkFilmes } from './listas';

export interface Novelinha {
  id: string;
  titulo: string;
  pasta: string;
  episodios: number;
  dublada: boolean;
  capa: string;
  generos: string[];
  sinopse: string;
}

let pedido: Promise<{ base: string; lista: Novelinha[] }> | null = null;
let pedidoDe = '';

export function carregarNovelinhas(): Promise<{ base: string; lista: Novelinha[] }> {
  const endereco = linkFilmes();
  if (!endereco) return Promise.resolve({ base: '', lista: [] });
  if (pedido && pedidoDe === endereco) return pedido;
  pedidoDe = endereco;
  pedido = fetch(`${endereco}novelinhas.txt`)
    .then((r) => (r.ok ? r.text() : ''))
    .then((texto) => {
      let base = '';
      const lista: Novelinha[] = [];
      for (const linha of texto.split('\n')) {
        if (!linha || linha[0] === '#') continue;
        if (linha.startsWith('base:')) { base = linha.slice(5).trim(); continue; }
        const c = linha.split('\t');
        if (c.length < 6) continue;
        const episodios = Number(c[3]) || 0;
        if (!episodios) continue;
        lista.push({
          id: c[0],
          titulo: c[1],
          pasta: c[2],
          episodios,
          dublada: c[4] === 'dub',
          capa: c[5],
          generos: (c[6] || '').split(',').map((g) => g.trim()).filter(Boolean),
          sinopse: c[7] || '',
        });
      }
      return { base, lista };
    })
    .catch(() => {
      pedido = null;
      return { base: '', lista: [] };
    });
  return pedido;
}

export function urlEpisodio(base: string, n: Novelinha, ep: number): string {
  return `${base}${n.pasta}/episode-${String(ep).padStart(3, '0')}.mp4`;
}

/* ── Onde a pessoa parou: episódio e segundo, por novelinha ── */
const CHAVE = 'saimo-novelinhas-progresso';

export interface Parada { ep: number; t: number; quando: number }

function lerTudo(): Record<string, Parada> {
  try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch { return {}; }
}

export function paradaDe(id: string): Parada | null {
  return lerTudo()[id] || null;
}

export function guardarParada(id: string, ep: number, t: number): void {
  const tudo = lerTudo();
  tudo[id] = { ep, t: Math.floor(t), quando: Date.now() };
  // Só as 60 mais recentes: é uma lista de "continue assistindo", não um histórico.
  const chaves = Object.keys(tudo).sort((a, b) => tudo[b].quando - tudo[a].quando);
  for (const k of chaves.slice(60)) delete tudo[k];
  try { localStorage.setItem(CHAVE, JSON.stringify(tudo)); } catch { /* sem espaço: segue sem guardar */ }
}

export function emAndamento(): { id: string; parada: Parada }[] {
  const tudo = lerTudo();
  return Object.entries(tudo)
    .map(([id, parada]) => ({ id, parada }))
    .sort((a, b) => b.parada.quando - a.parada.quando);
}
