/**
 * Onde começa e acaba a abertura, a recapitulação e os créditos de um título.
 *
 * Os tempos vêm do TheIntroDB (theintrodb.org), banco aberto em que a
 * comunidade marca esses trechos; a consulta é pelo id do TMDB. Sem marca, o
 * botão não aparece — antes era um "+30 s" nos primeiros cinco minutos.
 */
export type TipoTrecho = 'abertura' | 'recapitulacao' | 'creditos' | 'previa';
export interface Trecho { tipo: TipoTrecho; inicio: number; fim: number | null }

const guardadas = new Map<string, Trecho[]>();

export async function buscarPulos(tmdbId?: number, temporada = 0, episodio = 0): Promise<Trecho[]> {
  if (!tmdbId) return [];
  const chave = `${tmdbId}|${temporada}|${episodio}`;
  const pronta = guardadas.get(chave);
  if (pronta) return pronta;
  let url = `https://api.theintrodb.org/v3/media?tmdb_id=${tmdbId}`;
  if (temporada > 0) url += `&season=${temporada}&episode=${episodio}`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return [];
    const json = await r.json();
    const out: Trecho[] = [];
    const campos: [string, TipoTrecho][] = [
      ['intro', 'abertura'], ['recap', 'recapitulacao'], ['credits', 'creditos'], ['preview', 'previa'],
    ];
    for (const [campo, tipo] of campos) {
      for (const t of (json?.[campo] ?? []) as { start_ms: number | null; end_ms: number | null }[]) {
        const inicio = (t.start_ms ?? 0) / 1000;
        const fim = t.end_ms == null ? null : t.end_ms / 1000;
        // Trecho de menos de três segundos é marcação errada.
        if (fim != null && fim - inicio < 3) continue;
        // Trecho sem fim só é válido para créditos; abertura/recap/prévia sem fim é dado quebrado
        // que prenderia o botão na tela ou pularia o vídeo inteiro até o final.
        if (tipo !== 'creditos' && fim == null) continue;
        // Recapitulação ("Previously on...") só acontece no comecinho do episódio (primeiros 5 min)
        // e não dura mais de 5 minutos. Marcações fora disso invadem o episódio de verdade.
        if (tipo === 'recapitulacao' && fim != null && (inicio > 300 || fim - inicio > 300 || fim > 420)) continue;
        out.push({ tipo, inicio, fim });
      }
    }
    guardadas.set(chave, out);
    return out;
  } catch {
    return [];
  }
}

export function trechoEm(trechos: Trecho[], t: number, _duracao: number): Trecho | null {
  return trechos.find((x) => {
    if (x.tipo === 'creditos' || x.fim == null) return false;
    return t >= x.inicio && t < x.fim - 1;
  }) ?? null;
}

export function inicioDosCreditos(trechos: Trecho[], duracao: number): number | null {
  const c = trechos.find((x) => x.tipo === 'creditos');
  return c && c.inicio > duracao / 2 ? c.inicio : null;
}

export const rotuloTrecho: Record<TipoTrecho, string> = {
  abertura: 'Pular abertura',
  recapitulacao: 'Pular recapitulação',
  previa: 'Pular prévia',
  creditos: 'Pular créditos',
};
