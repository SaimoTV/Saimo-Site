/**
 * Minhas listas: o usuário cola o link de uma lista .m3u comum (ou escolhe um
 * arquivo) e os canais entram no site na categoria "Minhas listas".
 *
 * A lista fica só neste navegador: os metadados no localStorage e o resultado já
 * lido no IndexedDB (uma lista passa fácil de alguns MB, e o localStorage
 * guarda 5 MB para o site inteiro). Nada vai para os servidores do Saimo: o
 * proxy do site só repassa o texto quando o navegador não consegue pedir direto.
 *
 * O leitor segue a especificação única dos cinco clientes (ESPEC_LISTAS_M3U.md) e
 * é conferido contra o gabarito em tests/minhasListas.test.mjs.
 */

import type { Channel, ChannelSource } from '../types/channel';
import { proxyBase } from '../utils/streamUrl';

import { chaveDoNome, ehRestrito, lerM3u } from '../utils/leitorM3u';
import type { CanalLido } from '../utils/leitorM3u';

export { chaveDoNome, ehRestrito, lerM3u };
export type { CanalLido, FonteLida } from '../utils/leitorM3u';

// ───────────────────────────── baixar ─────────────────────────────

export class ErroDeLista extends Error {}

const PRAZO_MS = 30_000;
const LIMITE_BYTES = 30 * 1024 * 1024;

async function lerComLimite(r: Response): Promise<string> {
  if (!r.body) return r.text();
  const leitor = r.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > LIMITE_BYTES) {
      leitor.cancel().catch(() => {});
      throw new ErroDeLista('A lista passa de 30 MB');
    }
    pedacos.push(value);
  }
  const todo = new Uint8Array(total);
  let ponto = 0;
  for (const p of pedacos) { todo.set(p, ponto); ponto += p.byteLength; }
  return new TextDecoder('utf-8').decode(todo);
}

async function pedir(url: string, prazo: number): Promise<string> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), prazo);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await lerComLimite(r);
  } finally {
    window.clearTimeout(timer);
  }
}

/** Confere se o texto é de uma lista .m3u e a lê. Lança ErroDeLista com a mensagem para a pessoa. */
export function lerListaBaixada(texto: string): CanalLido[] {
  const limpo = texto.replace(/^﻿+/, '').trimStart();
  if (!limpo.toUpperCase().startsWith('#EXTM3U') && !/#EXTINF/i.test(limpo)) {
    throw new ErroDeLista('Isso não parece uma lista .m3u');
  }
  const canais = lerM3u(texto);
  if (!canais.length) throw new ErroDeLista('Essa lista não tem canais');
  return canais;
}

/**
 * Baixa a lista pelo link. Tenta direto (quando o servidor libera o acesso do
 * navegador, de graça); se não der, pede ao proxy do site, que repassa o
 * texto (um pedido por atualização).
 */
export async function baixarLista(link: string): Promise<CanalLido[]> {
  if (!/^https?:\/\//i.test(link.trim())) throw new ErroDeLista('O link precisa começar com http:// ou https://');
  const url = link.trim();
  let texto: string | null = null;
  // Página https não pode pedir http (conteúdo misto): vai direto ao proxy.
  const direto = !(window.location.protocol === 'https:' && url.startsWith('http://'));
  if (direto) {
    try { texto = await pedir(url, 12_000); } catch (e) {
      if (e instanceof ErroDeLista) throw e;
    }
  }
  if (texto === null) {
    try {
      texto = await pedir(`${proxyBase()}/api/proxy?raw=1&url=${encodeURIComponent(url)}`, PRAZO_MS);
    } catch (e) {
      if (e instanceof ErroDeLista) throw e;
      throw new ErroDeLista('Não consegui baixar essa lista');
    }
  }
  return lerListaBaixada(texto);
}

// ───────────────────────────── guardar ─────────────────────────────

export interface MinhaLista {
  id: string;
  nome: string;
  /** O link que a pessoa colou; `null` para lista vinda de arquivo. */
  link: string | null;
  atualizadaEm: number;
  ativa: boolean;
  total: number;
}

const CHAVE = 'saimo-minhas-listas';
const EVENTO = 'saimo-minhas-listas-mudou';
const BANCO = 'saimo-minhas-listas';
const ARMAZEM = 'canais';
export const MAXIMO_LISTAS = 10;
const DOZE_HORAS = 12 * 60 * 60 * 1000;

const emMemoria = new Map<string, CanalLido[]>();

export function listas(): MinhaLista[] {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(bruto) ? bruto.filter((l) => l && typeof l.id === 'string') : [];
  } catch {
    return [];
  }
}

function salvarListas(l: MinhaLista[]): void {
  try { localStorage.setItem(CHAVE, JSON.stringify(l)); } catch { /* sem armazenamento */ }
  window.dispatchEvent(new Event(EVENTO));
}

export function aoMudar(fn: () => void): () => void {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ARMAZEM);
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => falha(pedido.error);
  });
}

async function gravarCanais(id: string, canais: CanalLido[]): Promise<void> {
  emMemoria.set(id, canais);
  try {
    const bd = await abrirBanco();
    await new Promise<void>((ok, falha) => {
      const t = bd.transaction(ARMAZEM, 'readwrite');
      t.objectStore(ARMAZEM).put(canais, id);
      t.oncomplete = () => ok();
      t.onerror = () => falha(t.error);
    });
    bd.close();
  } catch { /* sem IndexedDB: vale só até fechar a página */ }
}

async function lerCanaisGuardados(id: string): Promise<CanalLido[]> {
  const memoria = emMemoria.get(id);
  if (memoria) return memoria;
  try {
    const bd = await abrirBanco();
    const canais = await new Promise<CanalLido[]>((ok) => {
      const pedido = bd.transaction(ARMAZEM).objectStore(ARMAZEM).get(id);
      pedido.onsuccess = () => ok(Array.isArray(pedido.result) ? pedido.result : []);
      pedido.onerror = () => ok([]);
    });
    bd.close();
    emMemoria.set(id, canais);
    return canais;
  } catch {
    return [];
  }
}

async function apagarCanais(id: string): Promise<void> {
  emMemoria.delete(id);
  try {
    const bd = await abrirBanco();
    await new Promise<void>((ok) => {
      const t = bd.transaction(ARMAZEM, 'readwrite');
      t.objectStore(ARMAZEM).delete(id);
      t.oncomplete = () => ok();
      t.onerror = () => ok();
    });
    bd.close();
  } catch { /* nada guardado */ }
}

function novoId(): string {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

/** Acrescenta uma lista já lida (do link ou de um arquivo). */
export async function adicionarLista(nome: string, link: string | null, canais: CanalLido[]): Promise<MinhaLista> {
  const atuais = listas();
  if (atuais.length >= MAXIMO_LISTAS) throw new ErroDeLista(`Já são ${MAXIMO_LISTAS} listas: remova uma antes`);
  const lista: MinhaLista = {
    id: novoId(),
    nome: nome.trim() || `Lista ${atuais.length + 1}`,
    link,
    atualizadaEm: Date.now(),
    ativa: true,
    total: canais.length,
  };
  await gravarCanais(lista.id, canais);
  salvarListas([...atuais, lista]);
  return lista;
}

/** Baixa de novo uma lista que veio de um link. */
export async function atualizarLista(id: string): Promise<void> {
  const lista = listas().find((l) => l.id === id);
  if (!lista?.link) throw new ErroDeLista('Esta lista veio de um arquivo: escolha o arquivo de novo');
  const canais = await baixarLista(lista.link);
  await gravarCanais(id, canais);
  salvarListas(listas().map((l) => (l.id === id ? { ...l, atualizadaEm: Date.now(), total: canais.length } : l)));
}

export function definirAtiva(id: string, ativa: boolean): void {
  salvarListas(listas().map((l) => (l.id === id ? { ...l, ativa } : l)));
}

export async function removerLista(id: string): Promise<void> {
  await apagarCanais(id);
  salvarListas(listas().filter((l) => l.id !== id));
}

let atualizando = false;
/** Ao abrir o site: atualiza, uma de cada vez e sem avisar, as listas com mais de 12 h. */
export async function atualizarVencidas(): Promise<void> {
  if (atualizando) return;
  atualizando = true;
  try {
    for (const l of listas()) {
      if (l.link && l.ativa && Date.now() - l.atualizadaEm > DOZE_HORAS) {
        try { await atualizarLista(l.id); } catch { /* mantém a que está guardada */ }
      }
    }
  } finally {
    atualizando = false;
  }
}

// ───────────────────────── do leitor para o site ─────────────────────────

/** Os canais lidos viram canais do site, na categoria "Minhas listas". */
export function paraCanais(lista: MinhaLista, lidos: CanalLido[], desbloqueado: boolean): Channel[] {
  const saida: Channel[] = [];
  for (const c of lidos) {
    if (!desbloqueado && ehRestrito(c)) continue;
    const sources: ChannelSource[] = c.fontes.map((f) => ({
      url: f.url,
      quality: f.qualidade ?? undefined,
      referer: f.referer ?? undefined,
      userAgent: f.ua ?? undefined,
      keyId: f.keyId ?? undefined,
      key: f.key ?? undefined,
    }));
    saida.push({
      id: `minha-${lista.id}-${chaveDoNome(c.nome)}`,
      name: c.nome,
      url: sources[0]?.url ?? '',
      logo: c.logo ?? undefined,
      category: 'Minhas listas',
      sources,
    });
  }
  return saida.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Os canais de todas as listas ativas, já no formato do site. */
export async function canaisDasListas(desbloqueado: boolean): Promise<Channel[]> {
  const todos: Channel[] = [];
  for (const l of listas()) {
    if (!l.ativa) continue;
    todos.push(...paraCanais(l, await lerCanaisGuardados(l.id), desbloqueado));
  }
  return todos;
}
