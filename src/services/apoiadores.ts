/**
 * Serviço de carregamento e estilização dos Apoiadores do Saimo TV.
 *
 * Regra de 3 (proporcional): o maior apoiador da lista vira a referência (100%)
 * e recebe o teto de tamanho/cor; todos os outros ficam proporcionais a ele.
 *   t = valor / maiorValor
 * Assim, quem deu R$ 1000 sempre fica maior que quem deu R$ 300, e o teto
 * visual (fonte máxima) nunca é ultrapassado.
 */
import { linkCanais } from './listas';

export interface Apoiador {
  nome: string;
  valor: number;
}

export interface ApoiadorEstilo {
  fontSize: string;
  fontWeight: number;
  color: string;
  opacity: number;
  textShadow: string;
  durationSeconds: number;
  intensity: number; // 0 a 1 (1 = maior apoiador)
}

/** Fonte mínima e teto absoluto (px). */
const FONTE_MIN = 13;
const FONTE_TETO = 44;

const CHAVE_CACHE = 'saimo-apoiadores-cache-v5';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos

/** Lista de emergência caso nenhum arquivo de rede/disco possa ser lido */
export const APOIADORES_SEMENTE: Apoiador[] = [
  { nome: 'Yuri D.', valor: 50 },
  { nome: 'Fabiano B.', valor: 30 },
  { nome: 'Luiz F.', valor: 10 },
  { nome: 'Edmundo G.', valor: 10 },
  { nome: 'Michell C.', valor: 10 },
  { nome: 'Everton C.', valor: 10 },
  { nome: 'Anderson C.', valor: 10 },
  { nome: 'Rafael C.', valor: 7.28 },
  { nome: 'Alexon E.', valor: 5 },
  { nome: 'Andriane L.', valor: 5 },
  { nome: 'Fabricio S.', valor: 5 },
  { nome: 'William G.', valor: 2 },
];

/**
 * Converte o texto do arquivo em lista de Apoiador.
 * Aceita uma entrada por linha ou várias separadas por vírgula, no formato
 * "Nome = 10", "Nome<TAB>10", "Nome;10", "Nome: R$ 10" ou "Nome 10".
 */
export function parseApoiadoresTxt(texto: string): Apoiador[] {
  const resultado: Apoiador[] = [];
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  for (const linha of linhas) {
    // Várias entradas na mesma linha separadas por vírgula (ex.: "Luiz F. =10, Edmundo G. = 10")
    const entradas = linha.includes('=') ? linha.split(',') : [linha];
    for (const bruta of entradas) {
      const m = bruta.trim().match(/^(.+?)\s*(?:=|\t|;|:)?\s*(?:R\$)?\s*(\d+(?:[.,]\d+)?)\s*$/i);
      if (!m) continue;
      const nome = m[1].replace(/[=\t;:]+$/, '').trim();
      const valor = parseFloat(m[2].replace(',', '.'));
      if (nome && Number.isFinite(valor) && valor > 0) resultado.push({ nome, valor });
    }
  }

  return resultado.length > 0 ? resultado : APOIADORES_SEMENTE;
}

/** Maior valor da lista (referência dos 100%). */
export function maiorValor(lista: Apoiador[]): number {
  return lista.reduce((m, a) => (a.valor > m ? a.valor : m), 0) || 1;
}

/** Regra de 3: intensidade proporcional ao maior apoiador, em [0, 1]. */
export function calcularIntensidade(valor: number, maior: number): number {
  return Math.min(1, Math.max(0, valor / maior));
}

/**
 * Retorna as propriedades de estilo CSS para renderizar o apoiador.
 */
export function calcularEstiloApoiador(apoiador: Apoiador, maior: number): ApoiadorEstilo {
  const t = calcularIntensidade(apoiador.valor, maior);

  // Tamanho proporcional: FONTE_MIN + t * (FONTE_TETO - FONTE_MIN), nunca passa do teto
  const fontSizePx = Math.round(FONTE_MIN + t * (FONTE_TETO - FONTE_MIN));

  // Peso da fonte: 400 (normal) até 800 (extra bold)
  const peso = 400 + Math.round(t * 4) * 100;

  // Cor (HSL): cinza-azulado frio -> âmbar -> vermelho forte
  let hue: number;
  let sat: number;
  let light: number;
  if (t <= 0.5) {
    const f = t / 0.5;
    hue = Math.round(210 - f * 172); // 210 -> 38
    sat = Math.round(25 + f * 60); // 25% -> 85%
    light = Math.round(75 - f * 10); // 75% -> 65%
  } else {
    const f = (t - 0.5) / 0.5;
    hue = Math.round(38 - f * 38); // 38 -> 0
    sat = Math.round(85 + f * 11); // 85% -> 96%
    light = Math.round(65 - f * 7); // 65% -> 58%
  }

  // Opacidade: 0.35 (suave) a 0.85 (nítido)
  const opacity = parseFloat((0.35 + t * 0.5).toFixed(2));

  // Brilho vermelho para os maiores
  let textShadow = '0 1px 4px rgba(0, 0, 0, 0.7)';
  if (t >= 0.6) {
    const alphaGlow = (0.25 + (t - 0.6) * 0.5).toFixed(2);
    textShadow = `0 0 14px rgba(255, 45, 65, ${alphaGlow}), 0 1px 6px rgba(0, 0, 0, 0.9)`;
  }

  // Duração: 20s (menores) a 16s (maiores)
  const durationSeconds = Math.round((20 - t * 4) * 10) / 10;

  return {
    fontSize: `${fontSizePx}px`,
    fontWeight: peso,
    color: `hsl(${hue}, ${sat}%, ${light}%)`,
    opacity,
    textShadow,
    durationSeconds,
    intensity: t,
  };
}

/**
 * Carrega a lista de apoiadores com estratégia de cache e fallbacks resilientes.
 */
export async function carregarApoiadores(): Promise<Apoiador[]> {
  try {
    const cached = sessionStorage.getItem(CHAVE_CACHE);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && Array.isArray(parsed.dados) && Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        return parsed.dados;
      }
    }
  } catch {
    // sessionStorage indisponível
  }

  const baseCanais = linkCanais();
  const urls: string[] = [];
  if (baseCanais) urls.push(`${baseCanais}apoiadores.txt`);
  urls.push('/apoiadores.txt');

  for (const url of urls) {
    try {
      const resp = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(4000) });
      if (!resp.ok) continue;
      const lista = parseApoiadoresTxt(await resp.text());
      try {
        sessionStorage.setItem(CHAVE_CACHE, JSON.stringify({ dados: lista, timestamp: Date.now() }));
      } catch {
        // ignorar erro de storage
      }
      return lista;
    } catch {
      // tenta próxima url
    }
  }

  return APOIADORES_SEMENTE;
}

/**
 * Sorteia um apoiador da lista com distribuição ponderada.
 * Permite repetição para preencher densamente o fundo da tela.
 */
export function sortearApoiador(lista: Apoiador[]): Apoiador {
  if (lista.length === 0) return APOIADORES_SEMENTE[0];
  if (lista.length === 1) return lista[0];

  const maior = maiorValor(lista);
  // peso = 1 + t * 1.2 (o maior aparece com frequência ligeiramente maior, mas todos aparecem bastante)
  const pesos = lista.map((a) => 1 + calcularIntensidade(a.valor, maior) * 1.2);
  const soma = pesos.reduce((s, p) => s + p, 0);

  let r = Math.random() * soma;
  for (let i = 0; i < lista.length; i++) {
    r -= pesos[i];
    if (r <= 0) return lista[i];
  }
  return lista[0];
}
