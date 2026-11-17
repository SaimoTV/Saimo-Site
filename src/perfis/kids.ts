/**
 * Perfil Kids: o que aparece. Contrato em SaimoPlayer/docs/perfis.md.
 *
 * Filmes e séries só com classificação indicativa conhecida de Livre a 12 anos
 * (do detalhes.txt da lista); sem classificação, escondido. O filtro mora na
 * leitura do catálogo (vodService), então grades, fileiras, busca e fichas já
 * recebem a lista limpa. Conteúdo adulto nunca destranca no Kids.
 */
import { ativo } from './perfis';
import { carregarDetalhes, detalheDe, type Detalhes } from '../services/infoDosTitulos';

export const IDADE_MAXIMA_KIDS = 12;

export function ehKids(): boolean {
  try { return ativo().kids === true; } catch { return false; }
}

/** Liberado para o Kids? Só com classificação conhecida até 12 anos. */
export function liberadoNoKids(mapa: Detalhes | null, titulo: string, serie: boolean, nomeCompleto?: string): boolean {
  const d = detalheDe(mapa, titulo, serie) ?? (nomeCompleto ? detalheDe(mapa, nomeCompleto, serie) : undefined);
  return !!d && d.idade >= 0 && d.idade <= IDADE_MAXIMA_KIDS;
}

/** Fora do Kids devolve a lista como veio; no Kids, só o que é liberado. */
export async function filtrarKids<T>(itens: T[], titulo: (t: T) => string, serie: (t: T) => boolean | 'qualquer',
  nomeCompleto?: (t: T) => string): Promise<T[]> {
  if (!ehKids()) return itens;
  const mapa = await carregarDetalhes();
  return itens.filter((t) => {
    const s = serie(t);
    const nome = nomeCompleto?.(t);
    if (s === 'qualquer') return liberadoNoKids(mapa, titulo(t), true, nome) || liberadoNoKids(mapa, titulo(t), false, nome);
    return liberadoNoKids(mapa, titulo(t), s, nome);
  });
}
