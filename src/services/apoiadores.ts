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
const FONTE_TETO = 46;

/** Lista de emergência caso nenhum arquivo de rede/disco possa ser lido */
export const APOIADORES_SEMENTE: Apoiador[] = [
  { nome: 'Michell C.', valor: 60 },
  { nome: 'Bruno C.', valor: 50 },
  { nome: 'Yuri D.', valor: 50 },
  { nome: 'Fabiano B.', valor: 30 },
  { nome: 'Luiz F.', valor: 10 },
  { nome: 'Edmundo G.', valor: 10 },
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
 * Regra de 3: quanto maior o valor em relação ao maior apoiador, maior a fonte
 * e mais forte e vermelho é a cor.
 */
export function calcularEstiloApoiador(apoiador: Apoiador, maior: number): ApoiadorEstilo {
  const t = calcularIntensidade(apoiador.valor, maior);

  // Tamanho proporcional: FONTE_MIN (14px) até FONTE_TETO (46px)
  const fontSizePx = Math.round(FONTE_MIN + t * (FONTE_TETO - FONTE_MIN));

  // Peso da fonte: 400 (normal) até 900 (black)
  const peso = t >= 0.85 ? 900 : t >= 0.60 ? 800 : t >= 0.30 ? 600 : 400;

  // Cor e brilho:
  // - Top (>= 85%): Vermelho vivo forte com brilho neon intenso
  // - Alto (60% a 85%): Vermelho coral vibrante
  // - Médio (30% a 60%): Âmbar / Dourado quente
  // - Baixo (< 30%): Cinza-azulado suave
  let color: string;
  let textShadow = '0 1px 4px rgba(0, 0, 0, 0.7)';
  const opacity = parseFloat((0.42 + t * 0.53).toFixed(2));

  if (t >= 0.85) {
    color = '#ff2244';
    textShadow = '0 0 16px rgba(255, 34, 68, 0.85), 0 2px 8px rgba(0, 0, 0, 0.9)';
  } else if (t >= 0.60) {
    color = '#f43f5e';
    textShadow = '0 0 10px rgba(244, 63, 94, 0.6), 0 1px 6px rgba(0, 0, 0, 0.85)';
  } else if (t >= 0.30) {
    color = '#f59e0b';
    textShadow = '0 0 8px rgba(245, 158, 11, 0.4), 0 1px 4px rgba(0, 0, 0, 0.8)';
  } else {
    color = '#cbd5e1';
  }

  // Duração: 20s (menores) a 15s (maiores)
  const durationSeconds = Math.round((20 - t * 5) * 10) / 10;

  return {
    fontSize: `${fontSizePx}px`,
    fontWeight: peso,
    color,
    opacity,
    textShadow,
    durationSeconds,
    intensity: t,
  };
}

/**
 * Carrega a lista de apoiadores com busca direta sem cache travado.
 */
export async function carregarApoiadores(): Promise<Apoiador[]> {
  const agora = Date.now();
  const urls: string[] = [
    `/apoiadores.txt?t=${agora}`,
  ];

  const baseCanais = linkCanais();
  if (baseCanais) {
    urls.push(`${baseCanais}apoiadores.txt?t=${agora}`);
  }

  for (const url of urls) {
    try {
      const resp = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
      if (!resp.ok) continue;
      const texto = await resp.text();
      const lista = parseApoiadoresTxt(texto);
      if (lista && lista.length > 0) {
        return lista;
      }
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
