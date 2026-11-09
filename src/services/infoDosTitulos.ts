/**
 * Ano, nota (0 a 10), classificação indicativa e popularidade de cada título,
 * para os filtros do On Demand. Vem de `detalhes.txt` (gerar_detalhes.py, do
 * TMDB), lido uma vez por visita.
 */
import { linkFilmes } from './listas';

export interface Detalhe {
  ano: number;
  nota: number;
  /** 0 = Livre, 10 a 18 = idade; -1 = não informada. */
  idade: number;
  popularidade: number;
}

export type Detalhes = Map<string, Detalhe>;

let pedido: Promise<Detalhes> | null = null;

export function carregarDetalhes(): Promise<Detalhes> {
  if (pedido) return pedido;
  const base = linkFilmes();
  if (!base) return Promise.resolve(new Map());
  pedido = fetch(`${base}detalhes.txt`)
    .then((r) => (r.ok ? r.text() : ''))
    .then((texto) => {
      const mapa: Detalhes = new Map();
      for (const linha of texto.split('\n')) {
        if (!linha || linha[0] === '#') continue;
        const c = linha.split('\t');
        if (c.length < 6) continue;
        const idade = c[4] === 'L' ? 0 : c[4] ? Number(c[4]) : -1;
        mapa.set(`${c[0]}|${c[1]}`, {
          ano: Number(c[2]) || 0,
          nota: Number(c[3]) || 0,
          idade: Number.isFinite(idade) ? idade : -1,
          popularidade: Number(c[5]) || 0,
        });
      }
      return mapa;
    })
    .catch(() => {
      pedido = null;
      return new Map();
    });
  return pedido;
}

export function detalheDe(mapa: Detalhes | null, titulo: string, serie: boolean): Detalhe | undefined {
  if (!mapa) return undefined;
  const k = serie ? 's|' : 'f|';
  return mapa.get(k + titulo) || mapa.get(k + titulo.replace(/\s*\(\d{4}\)\s*$/, ''));
}

/** Faixas de ano para o filtro: os três últimos anos, as décadas e antes de 1990. */
export function faixasDeAno(): { rotulo: string; anos: [number, number] }[] {
  const atual = new Date().getFullYear();
  const out: { rotulo: string; anos: [number, number] }[] = [];
  for (let a = atual; a >= atual - 2; a--) out.push({ rotulo: String(a), anos: [a, a] });
  const decada = Math.floor(atual / 10) * 10;
  if (atual - 3 >= decada) out.push({ rotulo: `${decada}–${atual - 3}`, anos: [decada, atual - 3] });
  for (let d = decada - 10; d >= 1990; d -= 10) out.push({ rotulo: `Anos ${d}`, anos: [d, d + 9] });
  out.push({ rotulo: 'Antes de 1990', anos: [1, 1989] });
  return out;
}
