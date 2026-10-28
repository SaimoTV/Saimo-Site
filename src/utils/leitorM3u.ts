/**
 * Leitor de lista .m3u do usuário (puro: sem navegador, sem rede).
 *
 * Segue a especificação única dos cinco clientes (ESPEC_LISTAS_M3U.md) e é
 * conferido contra o gabarito em tests/minhasListas.test.mjs. Nunca lança:
 * texto estranho vira lista vazia.
 */

// ───────────────────────────── leitor ─────────────────────────────

export interface FonteLida {
  url: string;
  referer: string | null;
  ua: string | null;
  keyId: string | null;
  key: string | null;
  qualidade: string | null;
}

export interface CanalLido {
  nome: string;
  grupo: string | null;
  logo: string | null;
  fontes: FonteLida[];
}

const LIMITE_CANAIS = 20000;
const TAG_RUIM = /\d{3,4}[pi]|not 24\/7|geo-?blocked|backup|vertical|\bsd\b|\bhd\b|fhd|\b4k\b/i;
const RESOLUCAO = /(\d{3,4}[pi])/i;

/** Chave de comparação do nome: minúsculas, sem acentos, só letras e números. */
export function chaveDoNome(nome: string): string {
  return nome.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function atributo(linha: string, nome: string): string | null {
  const m = new RegExp(`(?:^|[\\s:])${nome.replace(/[-]/g, '\\-')}="([^"]*)"`).exec(linha);
  return m ? m[1].trim() : null;
}

/** O texto depois da primeira vírgula fora de aspas. */
function nomeExibido(linha: string): string {
  let dentro = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') dentro = !dentro;
    else if (c === ',' && !dentro) return linha.slice(i + 1).trim();
  }
  return '';
}

/** Tira do fim os "(720p)", "[Not 24/7]"...; devolve o nome e a resolução, se houver. */
function tirarTags(nome: string): { nome: string; qualidade: string | null } {
  let qualidade: string | null = null;
  for (;;) {
    const m = /\s*[(\[]([^)\]]*)[)\]]\s*$/.exec(nome);
    if (!m || !TAG_RUIM.test(m[1])) break;
    const r = RESOLUCAO.exec(m[1]);
    if (r && qualidade === null) qualidade = r[1].toLowerCase();
    nome = nome.slice(0, m.index);
  }
  return { nome: nome.trim(), qualidade };
}

interface Pendente {
  exibido: string;
  tvgName: string | null;
  tvgId: string | null;
  logo: string | null;
  grupo: string | null;
}

const SEM_DADOS: Pendente = { exibido: '', tvgName: null, tvgId: null, logo: null, grupo: null };

/** Lê o texto de uma lista .m3u. Nunca lança: texto estranho vira lista vazia. */
export function lerM3u(texto: string): CanalLido[] {
  try {
    return lerSemRede(texto);
  } catch {
    return [];
  }
}

function lerSemRede(texto: string): CanalLido[] {
  const canais: CanalLido[] = [];
  const indice = new Map<string, CanalLido>();
  let pend: Pendente | null = null;
  let opts: { extgrp?: string; referer?: string; ua?: string; licTipo?: string; licChave?: string } = {};

  for (const bruta of texto.replace(/^﻿+/, '').split(/\r\n|\r|\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    if (linha.toUpperCase().startsWith('#EXTM3U')) continue;

    if (linha.startsWith('#EXTINF')) {
      pend = {
        exibido: nomeExibido(linha),
        tvgName: atributo(linha, 'tvg-name'),
        tvgId: atributo(linha, 'tvg-id'),
        logo: atributo(linha, 'tvg-logo'),
        grupo: atributo(linha, 'group-title'),
      };
      opts = {};
      continue;
    }
    if (linha.startsWith('#EXTGRP:')) { opts.extgrp = linha.slice(8).trim(); continue; }
    if (linha.startsWith('#EXTVLCOPT:')) {
      const kv = linha.slice(11);
      const i = kv.indexOf('=');
      if (i >= 0) {
        const k = kv.slice(0, i).trim().toLowerCase();
        const v = kv.slice(i + 1).trim();
        if (k === 'http-referrer' || k === 'http-referer') opts.referer = v;
        else if (k === 'http-user-agent') opts.ua = v;
      }
      continue;
    }
    if (linha.startsWith('#KODIPROP:')) {
      const kv = linha.slice(10);
      const i = kv.indexOf('=');
      if (i >= 0) {
        const k = kv.slice(0, i).trim().toLowerCase();
        const v = kv.slice(i + 1).trim();
        if (k === 'inputstream.adaptive.license_type') opts.licTipo = v.toLowerCase();
        else if (k === 'inputstream.adaptive.license_key') opts.licChave = v;
      }
      continue;
    }
    if (linha.startsWith('#')) continue;

    // Linha de endereço, com cabeçalhos no estilo Kodi: url|User-Agent=..&Referer=..
    let url = linha;
    const extra: Record<string, string> = {};
    const barra = linha.indexOf('|');
    if (barra >= 0) {
      const depois = linha.slice(barra + 1);
      if (depois.includes('=')) {
        url = linha.slice(0, barra).trim();
        for (const par of depois.split('&')) {
          const i = par.indexOf('=');
          if (i >= 0) extra[par.slice(0, i).trim().toLowerCase()] = par.slice(i + 1).trim();
        }
      }
    }
    if (!/^https?:\/\//i.test(url)) { pend = null; opts = {}; continue; }

    const p = pend ?? SEM_DADOS;
    const bruto = p.exibido || p.tvgName || p.tvgId || '';
    const { nome: semTags, qualidade } = bruto ? tirarTags(bruto) : { nome: '', qualidade: null };
    const nome = semTags || `Canal ${canais.length + 1}`;
    let grupo = p.grupo || opts.extgrp || null;
    if (grupo && grupo.includes(';')) grupo = grupo.split(';')[0].trim();
    grupo = grupo || null;
    const logo = p.logo && /^https?:\/\//i.test(p.logo) ? p.logo : null;
    const fonte: FonteLida = {
      url,
      referer: opts.referer || extra['referer'] || null,
      ua: opts.ua || extra['user-agent'] || null,
      keyId: null,
      key: null,
      qualidade,
    };
    if ((opts.licTipo ?? '').includes('clearkey') && /^[0-9a-f]{32}:[0-9a-f]{32}$/i.test(opts.licChave ?? '')) {
      const [kid, chave] = (opts.licChave as string).toLowerCase().split(':');
      fonte.keyId = kid;
      fonte.key = chave;
    }
    const k = chaveDoNome(nome);
    const existente = indice.get(k);
    if (existente) {
      if (!existente.fontes.some((f) => f.url === url)) existente.fontes.push(fonte);
      existente.grupo = existente.grupo || grupo;
      existente.logo = existente.logo || logo;
    } else if (canais.length < LIMITE_CANAIS) {
      const canal: CanalLido = { nome, grupo, logo, fontes: [fonte] };
      indice.set(k, canal);
      canais.push(canal);
    }
    pend = null;
    opts = {};
  }
  return canais;
}

// ─────────────────────────── conteúdo adulto ───────────────────────────

const ADULTO = /(?:^|[^a-z0-9])(?:adult|adulto|adultos|xxx|porn|porno|sexo|sex|erotic|erotico|hentai)(?:[^a-z0-9]|$)|\+18|18\+/;

/** Grupo ou nome de conteúdo adulto: só aparece depois do desbloqueio do controle parental. */
export function ehRestrito(canal: Pick<CanalLido, 'nome' | 'grupo'>): boolean {
  const texto = `${canal.grupo ?? ''} ${canal.nome}`
    .normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase()
    .replace(/adult swim/g, ' '); // "Adult Swim" é desenho animado
  return ADULTO.test(texto);
}
