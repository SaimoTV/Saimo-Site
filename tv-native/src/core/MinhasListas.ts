/**
 * Minhas listas: listas .m3u do usuário, guardadas só na TV (dados no
 * localStorage, canais lidos no IndexedDB). O leitor é o mesmo do site.
 */

import { chaveDoNome, ehRestrito, lerM3u } from '../../../src/utils/leitorM3u';
import { canaisXtream, deLink, ErroXtream } from '../../../src/utils/xtream';
import type { CanalLido } from '../../../src/utils/leitorM3u';
import { State } from './State';
import type { Channel } from './Api';

export interface MinhaLista { id: string; nome: string; link: string; atualizadaEm: number; ativa: boolean; total: number; }

const CHAVE = 'saimo_tv_minhas_listas';
const DOZE_HORAS = 12 * 3600 * 1000;

function banco(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const p = indexedDB.open('saimo-minhas-listas', 1);
    p.onupgradeneeded = () => p.result.createObjectStore('canais');
    p.onsuccess = () => ok(p.result);
    p.onerror = () => falha(p.error);
  });
}

async function guardar(id: string, canais: CanalLido[] | null) {
  const bd = await banco();
  await new Promise<void>((ok) => {
    const t = bd.transaction('canais', 'readwrite');
    if (canais) t.objectStore('canais').put(canais, id); else t.objectStore('canais').delete(id);
    t.oncomplete = () => ok();
    t.onerror = () => ok();
  });
  bd.close();
}

async function ler(id: string): Promise<CanalLido[]> {
  const bd = await banco();
  const r = await new Promise<CanalLido[]>((ok) => {
    const p = bd.transaction('canais').objectStore('canais').get(id);
    p.onsuccess = () => ok(Array.isArray(p.result) ? p.result : []);
    p.onerror = () => ok([]);
  });
  bd.close();
  return r;
}

/** Baixa um texto (M3U ou resposta da API). Erro genérico, sem o endereço. */
async function buscarTexto(url: string): Promise<string> {
  const ctrl = new AbortController();
  const prazo = setTimeout(() => ctrl.abort(), 30000);
  let texto = '';
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', cache: 'no-store' });
    if (!r.ok) throw new Error();
    texto = await r.text();
  } catch {
    throw new Error('Não consegui baixar essa lista');
  } finally {
    clearTimeout(prazo);
  }
  if (texto.length > 30 * 1024 * 1024) throw new Error('A lista passa de 30 MB');
  return texto;
}

async function baixar(link: string): Promise<CanalLido[]> {
  if (!/^https?:\/\//i.test(link)) throw new Error('O link precisa começar com http:// ou https://');
  // Conta com usuário e senha (Xtream): lê pela API do servidor.
  const conta = deLink(link);
  if (conta) {
    try {
      return await canaisXtream(conta, buscarTexto, lerM3u);
    } catch (e) {
      throw e instanceof ErroXtream ? new Error(e.message) : e;
    }
  }
  const texto = await buscarTexto(link);
  const limpo = texto.replace(/^﻿+/, '').trimStart();
  if (!limpo.toUpperCase().startsWith('#EXTM3U') && !/#EXTINF/i.test(limpo)) throw new Error('Isso não parece uma lista .m3u');
  const canais = lerM3u(texto);
  if (!canais.length) throw new Error('Essa lista não tem canais');
  return canais;
}

export class MinhasListas {
  static listas(): MinhaLista[] {
    try {
      const l = JSON.parse(localStorage.getItem(CHAVE) || '[]');
      return Array.isArray(l) ? l : [];
    } catch {
      return [];
    }
  }

  private static salvar(l: MinhaLista[]) {
    localStorage.setItem(CHAVE, JSON.stringify(l));
  }

  static async adicionar(link: string, nome: string) {
    const atuais = this.listas();
    if (atuais.length >= 10) throw new Error('Já são 10 listas: remova uma antes');
    const canais = await baixar(link.trim());
    const id = Date.now().toString(36);
    await guardar(id, canais);
    this.salvar([...atuais, { id, nome: nome.trim() || `Lista ${atuais.length + 1}`, link: link.trim(), atualizadaEm: Date.now(), ativa: true, total: canais.length }]);
  }

  static async atualizar(id: string) {
    const l = this.listas().find((x) => x.id === id);
    if (!l) return;
    const canais = await baixar(l.link);
    await guardar(id, canais);
    this.salvar(this.listas().map((x) => (x.id === id ? { ...x, atualizadaEm: Date.now(), total: canais.length } : x)));
  }

  static alternar(id: string) {
    this.salvar(this.listas().map((x) => (x.id === id ? { ...x, ativa: !x.ativa } : x)));
  }

  static async remover(id: string) {
    await guardar(id, null);
    this.salvar(this.listas().filter((x) => x.id !== id));
  }

  /** Atualiza em silêncio as listas com mais de 12 h e devolve os canais ativos. */
  static async canais(): Promise<Channel[]> {
    const saida: Channel[] = [];
    for (const l of this.listas()) {
      if (!l.ativa) continue;
      if (Date.now() - l.atualizadaEm > DOZE_HORAS) {
        try { await this.atualizar(l.id); } catch { /* fica a guardada */ }
      }
      for (const c of await ler(l.id)) {
        if (!State.unlockedExtras && ehRestrito(c)) continue;
        saida.push({
          id: `minha-${l.id}-${chaveDoNome(c.nome)}`,
          number: 0,
          name: c.nome,
          category: 'Minhas listas',
          logo: c.logo || '',
          variants: c.fontes.map((f) => ({
            url: f.url,
            quality: f.qualidade || undefined,
            referer: f.referer || undefined,
            userAgent: f.ua || undefined,
            clearKey: f.keyId && f.key ? `${f.keyId}:${f.key}` : undefined,
          })),
        });
      }
    }
    return saida.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
}
