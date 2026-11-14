/**
 * Legendas externas de filmes e séries, pelo OpenSubtitles.
 *
 * O serviço é o addon público do Stremio para o OpenSubtitles
 * (opensubtitles-v3.strem.io): sem chave, sem cadastro, com CORS aberto, e
 * entrega o arquivo já em UTF-8. Só entende IMDb, então o id do TMDB que o
 * título já traz passa por `vod/imdb/` (gerar_imdb.py), em fragmentos de uns
 * 8 KB — baixa-se o fragmento do título aberto, nunca o mapa inteiro.
 *
 * Nada é baixado antes da hora: abrir um título custa uma lista de ~30 KB, e
 * o arquivo .srt (~40 KB) só vem quando a pessoa escolhe uma legenda.
 */

import { linkFilmes } from './listas';
import { getEnabledAddons } from './addons';
import { fetchSubtitlesFromAddons, resolveTmdbToImdb } from '../utils/addonClient';
import { addonSupportsResource } from '../utils/addonProtocol';

const OPENSUBTITLES = 'https://opensubtitles-v3.strem.io/subtitles';
const FRAGMENTOS = 100;

/** Idiomas oferecidos, na ordem em que aparecem, e quantas versões de cada. */
const IDIOMAS: { codigo: string; rotulo: string; limite: number }[] = [
  { codigo: 'pob', rotulo: 'Português (Brasil)', limite: 5 },
  { codigo: 'por', rotulo: 'Português (Portugal)', limite: 3 },
  { codigo: 'eng', rotulo: 'Inglês', limite: 3 },
  { codigo: 'spa', rotulo: 'Espanhol', limite: 2 },
];

export interface LegendaOpcao {
  id: string;
  idioma: string;
  rotulo: string;
  url: string;
  origem?: string;
}

export interface Fala {
  inicio: number;
  fim: number;
  texto: string;
}

const fragmentos = new Map<string, Promise<Map<number, string>>>();
const listas = new Map<string, Promise<LegendaOpcao[]>>();
const arquivos = new Map<string, Promise<Fala[]>>();

function fragmentoDe(tipo: 'f' | 's', tmdb: number): Promise<Map<number, string>> {
  // Sem endereço de filmes não há mapa de imdb para pedir.
  const VOD = linkFilmes();
  if (!VOD) return Promise.resolve(new Map<number, string>());
  const arquivoDoFragmento = `${tipo}-${String(tmdb % FRAGMENTOS).padStart(2, '0')}`;
  // Chave com o endereço: trocar de lista não reaproveita o mapa da anterior.
  const nome = `${VOD}${arquivoDoFragmento}`;
  let pronto = fragmentos.get(nome);
  if (!pronto) {
    pronto = fetch(`${VOD}imdb/${arquivoDoFragmento}.txt`)
      .then((r) => (r.ok ? r.text() : ''))
      .then((texto) => {
        const mapa = new Map<number, string>();
        for (const linha of texto.split('\n')) {
          const [id, imdb] = linha.split('\t');
          if (id && imdb) mapa.set(Number(id), imdb.trim());
        }
        return mapa;
      })
      .catch(() => new Map<number, string>());
    // Falha de rede não pode ficar guardada: a próxima abertura tenta de novo.
    pronto.then((m) => { if (!m.size) fragmentos.delete(nome); });
    fragmentos.set(nome, pronto);
  }
  return pronto;
}

/** Converte código de idioma de addon em rótulo legível e código normalizado. */
function rotuloIdiomaAddon(lang: string): { codigo: string; rotulo: string } {
  const clean = (lang || 'und').trim().toLowerCase();
  if (clean === 'pob' || clean === 'pt-br' || clean === 'pt_br' || clean === 'por-br') {
    return { codigo: 'pob', rotulo: 'Português (Brasil)' };
  }
  if (clean === 'por' || clean === 'pt' || clean === 'pt-pt') {
    return { codigo: 'por', rotulo: 'Português' };
  }
  if (clean === 'eng' || clean === 'en' || clean === 'en-us') {
    return { codigo: 'eng', rotulo: 'Inglês' };
  }
  if (clean === 'spa' || clean === 'es' || clean === 'es-419') {
    return { codigo: 'spa', rotulo: 'Espanhol' };
  }
  return { codigo: clean, rotulo: (lang || 'Outro').toUpperCase() };
}

/** Mescla legendas externas com legendas inline enviadas dentro de `stream.subtitles`. */
export function mesclarLegendasComStream(
  externas: LegendaOpcao[],
  doStream?: Array<{ id?: string; url: string; lang: string }>,
): LegendaOpcao[] {
  if (!Array.isArray(doStream) || doStream.length === 0) return externas;
  const vistas = new Set(externas.map((l) => l.url));
  const extras: LegendaOpcao[] = [];
  doStream.forEach((s, idx) => {
    if (!s || !s.url || vistas.has(s.url)) return;
    vistas.add(s.url);
    const { codigo, rotulo } = rotuloIdiomaAddon(s.lang);
    extras.push({
      id: `stream-sub-${s.id ?? idx}`,
      idioma: codigo,
      rotulo: `${rotulo} · Stream`,
      url: s.url,
      origem: 'stream',
    });
  });
  return [...extras, ...externas];
}

/** As legendas do título, do melhor idioma para o pior (OpenSubtitles + addons ativos). */
export function buscarLegendas(
  tmdbId: number | undefined,
  serie: boolean,
  temporada = 0,
  episodio = 0,
  imdbHint?: string,
  addonMetaId?: string,
): Promise<LegendaOpcao[]> {
  if (!tmdbId && !imdbHint && !addonMetaId) return Promise.resolve([]);
  const subAddons = getEnabledAddons().filter((a) => addonSupportsResource(a, 'subtitles'));
  const subSig = subAddons.map((a) => a.id).join(',');
  const chave = `${serie ? 's' : 'f'}|${tmdbId ?? 0}|${imdbHint ?? ''}|${addonMetaId ?? ''}|${temporada}|${episodio}|${subSig}`;
  let pronta = listas.get(chave);
  if (!pronta) {
    pronta = (async () => {
      let imdb = imdbHint;
      if (!imdb && tmdbId) {
        imdb = (await fragmentoDe(serie ? 's' : 'f', tmdbId)).get(tmdbId);
        if (!imdb) {
          imdb = (await resolveTmdbToImdb(tmdbId, serie)) ?? undefined;
        }
      }

      const saida: LegendaOpcao[] = [];
      const urlsVistas = new Set<string>();

      // 1) OpenSubtitles v3 (se houver IMDb)
      const openSubPromise = (async () => {
        if (!imdb || !imdb.startsWith('tt')) return [] as LegendaOpcao[];
        const alvo = serie && temporada > 0 ? `series/${imdb}:${temporada}:${episodio}` : `movie/${imdb}`;
        const r = await fetch(`${OPENSUBTITLES}/${alvo}.json`);
        if (!r.ok) return [] as LegendaOpcao[];
        const json = await r.json() as { subtitles?: Record<string, unknown>[] };
        const out: LegendaOpcao[] = [];
        for (const idioma of IDIOMAS) {
          const doIdioma = (json.subtitles ?? []).filter((s) => s.lang === idioma.codigo && s.url);
          doIdioma.slice(0, idioma.limite).forEach((s, i) => {
            const versao = String(s.releaseGroup || s.releaseFormat || '').trim();
            out.push({
              id: `${idioma.codigo}-${s.id ?? i}`,
              idioma: idioma.codigo,
              rotulo: `${idioma.rotulo} · ${versao || i + 1}`,
              url: String(s.url),
            });
          });
        }
        return out;
      })().catch(() => [] as LegendaOpcao[]);

      // 2) Addons Stremio com recurso `subtitles`
      const candidates: string[] = [];
      if (imdb) candidates.push(imdb);
      if (addonMetaId && !candidates.includes(addonMetaId)) candidates.push(addonMetaId);
      if (tmdbId && !candidates.includes(`tmdb:${tmdbId}`)) candidates.push(`tmdb:${tmdbId}`);

      const addonSubPromise = (subAddons.length > 0 && candidates.length > 0)
        ? fetchSubtitlesFromAddons(
            subAddons,
            serie ? 'series' : 'movie',
            candidates,
            temporada > 0 ? temporada : undefined,
            episodio > 0 ? episodio : undefined,
          ).catch(() => [])
        : Promise.resolve([]);

      const [openList, addonList] = await Promise.all([openSubPromise, addonSubPromise]);

      for (const item of openList) {
        if (!urlsVistas.has(item.url)) {
          urlsVistas.add(item.url);
          saida.push(item);
        }
      }
      addonList.forEach(({ addon, subtitle }, i) => {
        if (!subtitle.url || urlsVistas.has(subtitle.url)) return;
        urlsVistas.add(subtitle.url);
        const { codigo, rotulo } = rotuloIdiomaAddon(subtitle.lang);
        saida.push({
          id: `addon-sub-${addon.id}-${subtitle.id ?? i}`,
          idioma: codigo,
          rotulo: `${rotulo} · ${addon.manifest.name}`,
          url: subtitle.url,
          origem: addon.manifest.name,
        });
      });

      return saida;
    })().catch(() => []);
    // Lista vazia por falha não fica guardada; vazia de verdade custa pouco.
    pronta.then((l) => { if (!l.length) setTimeout(() => listas.delete(chave), 60_000); });
    listas.set(chave, pronta);
  }
  return pronta;
}

const TEMPO = /(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{1,3})/;

function segundos(texto: string): number {
  const m = TEMPO.exec(texto);
  if (!m) return NaN;
  const horas = m[1] ? Number(m[1]) : 0;
  return horas * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4].padEnd(3, '0')) / 1000;
}

/** SRT (ou o que o servidor mandar em VTT) em falas; marcação de estilo que o vídeo não entende sai. */
export function lerLegenda(texto: string): Fala[] {
  const falas: Fala[] = [];
  const blocos = texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const bloco of blocos) {
    const linhas = bloco.split('\n');
    const i = linhas.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [de, ate] = linhas[i].split('-->');
    const inicio = segundos(de);
    const fim = segundos(ate);
    if (Number.isNaN(inicio) || Number.isNaN(fim) || fim <= inicio) continue;
    const fala = linhas.slice(i + 1).join('\n')
      .replace(/\{\\[^}]*\}/g, '')                    // {\an8}
      .replace(/<\/?(?:font|span|c)[^>]*>/gi, '')     // só <i>, <b>, <u> o vídeo aceita
      .trim();
    if (fala) falas.push({ inicio, fim, texto: fala });
  }
  return falas;
}

export function carregarLegenda(opcao: LegendaOpcao): Promise<Fala[]> {
  let pronto = arquivos.get(opcao.url);
  if (!pronto) {
    pronto = fetch(opcao.url)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(lerLegenda);
    pronto.catch(() => arquivos.delete(opcao.url));
    arquivos.set(opcao.url, pronto);
  }
  return pronto;
}

const IDIOMA_GUARDADO = 'legenda-idioma';

/** O idioma que a pessoa escolheu da última vez; '' é "desligadas". */
export function idiomaGuardado(): string {
  try { return localStorage.getItem(IDIOMA_GUARDADO) ?? ''; } catch { return ''; }
}

export function guardarIdioma(codigo: string): void {
  try { localStorage.setItem(IDIOMA_GUARDADO, codigo); } catch { /* sem armazenamento: só não lembra */ }
}
