/**
 * Avisos de episódios novos nas séries favoritas.
 *
 * O catálogo diz quantos episódios cada série tem (series-<letra>.txt). Para
 * cada série favorita guarda-se a contagem "já vista"; se o catálogo passa a
 * ter mais, nasce um aviso (fica até a pessoa abrir ou dispensar). A primeira
 * olhada numa série só marca a contagem, sem avisar.
 *
 * Roda ao abrir o site e a cada 30 minutos com ele aberto. Com a permissão do
 * navegador, também mostra uma notificação do sistema.
 */
import { lista as favoritos } from './vodFavoritos';
import { series, type ItemDestaque } from './vodService';

const CHAVE = 'saimo-novos-episodios';
const CHAVE_SISTEMA = 'saimo-notificar-sistema';
const EVENTO = 'saimo-novos-episodios-mudou';

export interface AvisoDeEpisodios {
  item: ItemDestaque;
  /** Episódios a mais desde a última vez que a pessoa viu a série. */
  novos: number;
  total: number;
  quando: number;
}

interface Dados {
  /** "s|Título|ano" -> contagem já vista. */
  vistos: Record<string, number>;
  avisos: AvisoDeEpisodios[];
}

function ler(): Dados {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE) || '{}');
    return { vistos: d?.vistos && typeof d.vistos === 'object' ? d.vistos : {}, avisos: Array.isArray(d?.avisos) ? d.avisos : [] };
  } catch {
    return { vistos: {}, avisos: [] };
  }
}

function gravar(d: Dados): void {
  try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch { /* sem espaço */ }
  window.dispatchEvent(new Event(EVENTO));
}

const chaveDe = (i: ItemDestaque) => `${i.tipo}|${i.titulo}|${i.ano || ''}`;

export function avisos(): AvisoDeEpisodios[] {
  return ler().avisos;
}

export function aoMudarAvisos(fn: () => void): () => void {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}

/** A pessoa viu a série (abriu ou dispensou): a contagem de agora vira a "vista". */
export function dispensarAviso(item: ItemDestaque): void {
  const d = ler();
  const k = chaveDe(item);
  const aviso = d.avisos.find((a) => chaveDe(a.item) === k);
  if (aviso) d.vistos[k] = aviso.total;
  d.avisos = d.avisos.filter((a) => chaveDe(a.item) !== k);
  gravar(d);
}

export function notificarNoSistema(): boolean {
  return localStorage.getItem(CHAVE_SISTEMA) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

/** Liga ou desliga as notificações do sistema (pede a permissão ao ligar). Devolve o estado final. */
export async function definirNotificarNoSistema(ligar: boolean): Promise<boolean> {
  if (!ligar) { localStorage.setItem(CHAVE_SISTEMA, '0'); return false; }
  if (typeof Notification === 'undefined') return false;
  const permissao = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  const ok = permissao === 'granted';
  localStorage.setItem(CHAVE_SISTEMA, ok ? '1' : '0');
  return ok;
}

let rodando = false;

export async function verificar(): Promise<void> {
  if (rodando) return;
  rodando = true;
  try {
    const dados = ler();
    const series_ = favoritos().filter((i) => i.tipo === 's' && i.letra);
    if (!series_.length) return;
    const porLetra = new Map<string, Awaited<ReturnType<typeof series>>>();
    let mudou = false;
    const criados: AvisoDeEpisodios[] = [];
    for (const item of series_) {
      let lista = porLetra.get(item.letra);
      if (!lista) {
        lista = await series(item.letra).catch(() => []);
        porLetra.set(item.letra, lista);
      }
      const achada = lista.find((s) => s.titulo === item.titulo && (s.ano || '') === (item.ano || ''))
        ?? lista.find((s) => s.titulo === item.titulo);
      if (!achada || !achada.episodios) continue;
      const k = chaveDe(item);
      const visto = dados.vistos[k];
      if (visto === undefined) { dados.vistos[k] = achada.episodios; mudou = true; continue; }
      const jaTem = dados.avisos.find((a) => chaveDe(a.item) === k);
      if (achada.episodios > visto) {
        const novos = achada.episodios - visto;
        if (!jaTem) {
          const aviso = { item, novos, total: achada.episodios, quando: Date.now() };
          dados.avisos.unshift(aviso);
          criados.push(aviso);
          mudou = true;
        } else if (jaTem.total !== achada.episodios) {
          jaTem.novos = novos;
          jaTem.total = achada.episodios;
          mudou = true;
        }
      } else if (achada.episodios < visto) {
        // O catálogo foi reorganizado (episódios renumerados): recomeça a conta sem avisar.
        dados.vistos[k] = achada.episodios;
        dados.avisos = dados.avisos.filter((a) => chaveDe(a.item) !== k);
        mudou = true;
      }
    }
    dados.avisos = dados.avisos.slice(0, 30);
    if (mudou) gravar(dados);
    if (criados.length && notificarNoSistema()) {
      for (const a of criados.slice(0, 3)) {
        try {
          new Notification(`${a.item.titulo}: ${a.novos} ${a.novos === 1 ? 'episódio novo' : 'episódios novos'}`, {
            body: 'Abra o Saimo TV para assistir.', tag: chaveDe(a.item), icon: '/icons/icon-192.png',
          });
        } catch { /* o navegador recusou */ }
      }
    }
  } finally {
    rodando = false;
  }
}

let ligado = false;

/** Liga a checagem periódica. Chamar uma vez. */
export function iniciarNovosEpisodios(): void {
  if (ligado) return;
  ligado = true;
  window.setTimeout(() => { void verificar(); }, 6000);
  window.setInterval(() => { void verificar(); }, 30 * 60 * 1000);
  window.addEventListener('saimo-vod-favoritos-mudou', () => { void verificar(); });
}
