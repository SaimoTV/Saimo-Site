/**
 * Fonte preferida numa série: ao trocar de episódio (automático, botão
 * Próximo ou escolhendo outro da mesma série), mantém a fonte que a pessoa
 * estava usando. Cada episódio tem a própria lista, às vezes em outra ordem.
 * A versão de áudio (dublado/legendado) nunca muda: só concorrem as fontes
 * da mesma versão que estava tocando.
 */

export interface Fonte {
  url: string;
  /** "dub" ou "leg" — como vem do catálogo; ausente conta como dublado. */
  versao?: string;
  behaviorHints?: { bingeGroup?: string };
}

/** O que estava tocando: endereço, versão, bingeGroup e posição dentro da lista da versão. */
export interface FonteAnterior {
  url: string;
  versao: string;
  indiceNaVersao: number;
  bingeGroup?: string;
}

const versaoDe = (f: Fonte) => (f.versao === 'leg' ? 'leg' : 'dub');

function hostDe(url: string): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url.trim());
  return m ? m[1].toLowerCase() : '';
}

/**
 * Posição, em `lista`, da fonte a usar no episódio novo.
 * Prioriza `behaviorHints.bingeGroup` (padrão Stremio para maratonar séries),
 * depois fontes da versão que estava tocando (mesmo host, mesma posição).
 */
export function escolherFonte(lista: readonly Fonte[], anterior: FonteAnterior | null | undefined): number {
  if (!anterior || lista.length === 0) return 0;
  let candidatas = lista.map((_, i) => i).filter((i) => versaoDe(lista[i]) === anterior.versao);
  if (candidatas.length === 0) candidatas = lista.map((_, i) => i);
  if (anterior.bingeGroup) {
    const porGrupoMesmaVersao = candidatas.find((c) => lista[c].behaviorHints?.bingeGroup === anterior.bingeGroup);
    if (porGrupoMesmaVersao !== undefined) return porGrupoMesmaVersao;
    const porGrupoGeral = lista.findIndex((f) => f.behaviorHints?.bingeGroup === anterior.bingeGroup);
    if (porGrupoGeral !== -1) return porGrupoGeral;
  }
  const host = hostDe(anterior.url);
  if (host) {
    const i = candidatas.find((c) => hostDe(lista[c].url) === host);
    if (i !== undefined) return i;
  }
  const pos = anterior.indiceNaVersao;
  return pos >= 0 && pos < candidatas.length ? candidatas[pos] : candidatas[0];
}

// Só nesta sessão, em memória, e de uma série por vez.
let memoria: { serieId: string; anterior: FonteAnterior } | null = null;

/** Guarda a fonte que está de fato tocando (posição `indice` de `lista`). */
export function lembrarFonte(serieId: string | undefined, lista: readonly Fonte[], indice: number): void {
  const f = lista[indice];
  if (!serieId || !f) return;
  const versao = versaoDe(f);
  const indiceNaVersao = lista.slice(0, indice).filter((x) => versaoDe(x) === versao).length;
  memoria = {
    serieId,
    anterior: { url: f.url, versao, indiceNaVersao, bingeGroup: f.behaviorHints?.bingeGroup },
  };
}

/** Posição preferida para a lista do episódio da série; 0 se nada foi guardado. */
export function fontePreferida(serieId: string | undefined, lista: readonly Fonte[]): number {
  if (!serieId || !memoria || memoria.serieId !== serieId) return 0;
  return escolherFonte(lista, memoria.anterior);
}
