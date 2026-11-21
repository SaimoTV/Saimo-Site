/**
 * País e categoria de cada canal, para o filtro de país do painel e a grade
 * País × Categoria (`/grade`).
 *
 * De onde vem o país:
 *   - catálogo do Saimo: o campo opcional `pais:` (código de duas letras, "BR");
 *   - lista M3U: `tvg-country`, ou o sufixo do `tvg-id` ("globo.br",
 *     "SomeTV.us@HD"), que é como a iptv-org marca o país.
 * Canal sem nenhum dos dois fica em "Sem país".
 */
import type { Channel } from '../types/channel';

export const SEM_PAIS = 'Sem país';
export const SEM_CATEGORIA = 'Outros';

/** Código de duas letras, em maiúsculas, ou `null` se o texto não for um. */
export function normalizarPais(bruto: string | null | undefined): string | null {
  const t = (bruto ?? '').trim();
  if (!/^[a-z]{2}$/i.test(t)) return null;
  const c = t.toUpperCase();
  // "UK" é como muita lista escreve; o código ISO é GB.
  return c === 'UK' ? 'GB' : c;
}

/** País pelo `tvg-country` (o primeiro, se vier lista) ou pelo sufixo do `tvg-id`. */
export function paisDoM3u(tvgCountry: string | null, tvgId: string | null): string | null {
  const primeiro = tvgCountry?.split(/[;,|]/)[0];
  const declarado = normalizarPais(primeiro);
  if (declarado) return declarado;
  const m = /\.([a-z]{2})(?:@|$)/i.exec(tvgId ?? '');
  return m ? normalizarPais(m[1]) : null;
}

let nomes: Intl.DisplayNames | null | undefined;
const cacheNomes = new Map<string, string>();

/** Nome do país em português ("BR" → "Brasil"); sem suporte do navegador, o próprio código. */
export function nomeDoPais(codigo: string): string {
  if (codigo === SEM_PAIS) return SEM_PAIS;
  const pronto = cacheNomes.get(codigo);
  if (pronto) return pronto;
  if (nomes === undefined) {
    try { nomes = new Intl.DisplayNames(['pt-BR'], { type: 'region' }); } catch { nomes = null; }
  }
  let nome = codigo;
  try { nome = nomes?.of(codigo) ?? codigo; } catch { /* código desconhecido */ }
  cacheNomes.set(codigo, nome);
  return nome;
}

export function paisDoCanal(c: Channel): string {
  return c.country || SEM_PAIS;
}

/** Categorias fixas da iptv-org (em inglês), no nome que o resto do site usa. */
const TRADUCAO: Record<string, string> = {
  animation: 'Animação',
  auto: 'Automóveis',
  business: 'Negócios',
  classic: 'Clássicos',
  comedy: 'Comédia',
  cooking: 'Culinária',
  culture: 'Cultura',
  documentary: 'Documentarios',
  education: 'Educação',
  entertainment: 'Entretenimento',
  family: 'Família',
  general: 'Geral',
  kids: 'Infantil',
  legislative: 'Legislativo',
  lifestyle: 'Estilo de vida',
  movies: 'Filmes',
  music: 'Música',
  news: 'Noticias',
  outdoor: 'Ao ar livre',
  public: 'Pública',
  relax: 'Relaxamento',
  religious: 'Religiosos',
  science: 'Ciência',
  series: 'Series',
  shop: 'Compras',
  sports: 'Esportes',
  travel: 'Viagem',
  weather: 'Clima',
  xxx: 'Adulto',
  undefined: SEM_CATEGORIA,
};

/**
 * Categoria para a grade: o `group-title` original quando o canal veio de
 * "Minhas listas" (lá a seção do painel é sempre "Minhas listas"), senão a
 * seção do painel.
 */
export function categoriaDoCanal(c: Channel): string {
  if (c.group) return TRADUCAO[c.group.trim().toLowerCase()] ?? c.group.trim();
  return c.category || SEM_CATEGORIA;
}

/** Países presentes nos canais, do que tem mais canais para o que tem menos. */
export function contarPaises(canais: Channel[]): { codigo: string; nome: string; total: number }[] {
  const conta = new Map<string, number>();
  for (const c of canais) {
    const p = paisDoCanal(c);
    conta.set(p, (conta.get(p) ?? 0) + 1);
  }
  return [...conta.entries()]
    .map(([codigo, total]) => ({ codigo, nome: nomeDoPais(codigo), total }))
    .sort((a, b) => {
      if (a.codigo === SEM_PAIS) return 1;
      if (b.codigo === SEM_PAIS) return -1;
      return b.total - a.total || a.nome.localeCompare(b.nome, 'pt-BR');
    });
}

// ───────────────────────────── continentes ─────────────────────────────

export const SEM_CONTINENTE = 'Outros';

/** Códigos ISO de cada continente; as Américas em três, que é como quem está no Brasil procura. */
const POR_CONTINENTE: Record<string, string> = {
  'América do Sul': 'AR BO BR CL CO EC FK GF GY PY PE SR UY VE',
  'América Central e Caribe': 'AG AI AW BS BB BZ BQ VG KY CR CU CW DM DO SV GD GP GT HT HN JM MQ MS NI PA PR BL KN LC MF VC SX TT TC VI',
  'América do Norte': 'CA US MX GL BM PM',
  Europa: 'AL AD AT BY BE BA BG HR CY CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB VA AX SJ',
  África: 'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW',
  Ásia: 'AF AM AZ BH BD BT BN KH CN GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE',
  Oceania: 'AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF',
};

/** Ordem de exibição dos continentes. */
export const CONTINENTES = [...Object.keys(POR_CONTINENTE), SEM_CONTINENTE];

const CONTINENTE_DO_PAIS = new Map<string, string>();
for (const [continente, codigos] of Object.entries(POR_CONTINENTE)) {
  for (const c of codigos.split(' ')) CONTINENTE_DO_PAIS.set(c, continente);
}

/** Continente de um código de país; "Sem país" ou código desconhecido dão "Outros". */
export function continenteDoPais(codigo: string): string {
  return CONTINENTE_DO_PAIS.get(codigo) ?? SEM_CONTINENTE;
}

export function continenteDoCanal(c: Channel): string {
  return continenteDoPais(paisDoCanal(c));
}

// ───────────────────────────── eixos da grade ─────────────────────────────

export type Eixo = 'pais' | 'continente' | 'categoria';

export const ROTULO_EIXO: Record<Eixo, string> = { pais: 'País', continente: 'Continente', categoria: 'Categoria' };

/** Valor do canal num eixo (código do país, nome do continente ou categoria). */
export function valorNoEixo(c: Channel, eixo: Eixo): string {
  if (eixo === 'pais') return paisDoCanal(c);
  if (eixo === 'continente') return continenteDoCanal(c);
  return categoriaDoCanal(c);
}

/** O que mostrar de um valor do eixo: o nome do país em português, ou o próprio texto. */
export function rotuloNoEixo(valor: string, eixo: Eixo): string {
  return eixo === 'pais' ? nomeDoPais(valor) : valor;
}
