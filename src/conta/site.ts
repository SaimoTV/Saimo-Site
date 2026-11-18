/**
 * Como o site lê e grava os seus dados no pacote da Conta Saimo (./conta.ts).
 *
 * - Onde parou: `saimo-continuar` (um por título; a série guarda o último
 *   episódio). O ponto em ms (`pos`/`dur`) entrou na 3.3; o que é mais antigo
 *   que isso não tem a duração e fica só aqui.
 * - Títulos favoritos: `saimo-vod-favoritos`.
 * - Canais favoritos: `tv-favorites` guarda ids (o nome normalizado); o pacote
 *   leva nomes. Sai o que já tem nome conhecido (canais carregados nesta visita);
 *   o servidor junta por união, então nada se perde.
 * - Listas: os dois endereços (`saimo-link-*`, com `saimo-links-em`) e as
 *   Minhas listas que vieram de link.
 * - Addons e Debrid: o formato do Connect (utils/addonClient).
 */
import type { Adaptador, DadosDoPerfil } from './conta';
import { gravarNoPerfil, idAtivo, lerDoPerfil } from '../perfis/perfis';
import type { Andamento } from '../services/continuar';
import type { ItemDestaque } from '../services/vodService';
import { idDoCanal, nomeDoCanal } from '../services/catalogService';
import { definirLink, linkCanais, linkFilmes, linksEm, normalizarEndereco } from '../services/listas';
import { adicionarLista, aoMudar as aoMudarMinhas, baixarLista, listas as minhasListas } from '../services/minhasListas';
import { aoMudarAddons, aplicarDadosConnect, exportConnectDadosPayload } from '../services/addons';

type Obj = Record<string, any>;

const C_CONTINUAR = 'saimo-continuar';
const C_FAV_TITULOS = 'saimo-vod-favoritos';
const C_FAV_CANAIS = 'tv-favorites';

function lerLista<T>(chave: string, id: string): T[] {
  try {
    const v = JSON.parse(lerDoPerfil(chave, id) || '[]');
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

const tipoDoPacote = (t: string) => (t === 'f' ? 'f' : 's');
const txt = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

function episodioDoRotulo(rotulo: string): [number, number] {
  const m = /T(\d+)\s*:\s*E(\d+)/i.exec(rotulo || '');
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

export function dadosDoPerfil(id: string): DadosDoPerfil {
  const progresso = lerLista<Andamento>(C_CONTINUAR, id)
    .filter((a) => a?.origem?.titulo && num(a.pos) > 0 && num(a.dur) > 0)
    .map((a) => {
      const serie = tipoDoPacote(a.origem.tipo) === 's';
      const [t, e] = a.temporada && a.episodio ? [a.temporada, a.episodio] : episodioDoRotulo(a.rotulo);
      return {
        tipo: serie ? 's' : 'f', titulo: a.origem.titulo, ano: a.origem.ano || '', letra: a.origem.letra || '',
        temporada: serie ? t : 0, episodio: serie ? e : 0,
        pos: Math.round(num(a.pos)), dur: Math.round(num(a.dur)), em: num(a.quando),
      };
    })
    .filter((p) => p.tipo === 'f' || (p.temporada > 0 && p.episodio > 0));
  const favTitulos = lerLista<ItemDestaque>(C_FAV_TITULOS, id)
    .filter((f) => f?.titulo)
    .map((f) => ({ tipo: tipoDoPacote(f.tipo), titulo: f.titulo, ano: f.ano || '', letra: f.letra || '' }));
  const favCanais = lerLista<string>(C_FAV_CANAIS, id)
    .map((c) => nomeDoCanal(c))
    .filter((n): n is string => !!n);
  return { progresso, favTitulos, favCanais };
}

export function juntarNoPerfil(id: string, chegou: Partial<DadosDoPerfil>): void {
  // Onde parou: por título, vale o mais recente.
  if (Array.isArray(chegou.progresso) && chegou.progresso.length) {
    const atuais = lerLista<Andamento>(C_CONTINUAR, id);
    let mudou = false;
    for (const p of chegou.progresso) {
      const titulo = txt(p?.titulo);
      const pos = num(p?.pos), dur = num(p?.dur), em = num(p?.em);
      if (!titulo || !(pos > 0) || !(dur > 0)) continue;
      const serie = p.tipo === 's';
      if (serie && !(num(p.temporada) > 0 && num(p.episodio) > 0)) continue;
      // Filme visto até o fim não volta para "Continue assistindo".
      if (!serie && pos / dur >= 0.95) continue;
      const ano = txt(p.ano);
      const i = atuais.findIndex((a) => a.origem?.titulo === titulo && (a.origem.ano || '') === ano);
      const local = i >= 0 ? atuais[i] : undefined;
      if (local && num(local.quando) >= em) continue;
      const origem: ItemDestaque = local?.origem ?? { tipo: serie ? 's' : 'f', titulo, letra: txt(p.letra), ano, capa: '' };
      const novo: Andamento = {
        origem,
        rotulo: serie ? `${titulo} · T${p.temporada}:E${p.episodio}` : titulo,
        fracao: Math.min(pos / dur, 1), quando: em, pos, dur,
        ...(serie ? { temporada: num(p.temporada), episodio: num(p.episodio) } : {}),
      };
      if (i >= 0) atuais[i] = novo; else atuais.push(novo);
      mudou = true;
    }
    if (mudou) {
      atuais.sort((a, b) => num(b.quando) - num(a.quando));
      gravarNoPerfil(C_CONTINUAR, id, JSON.stringify(atuais.slice(0, 20)));
    }
  }

  // Títulos favoritos: união (os que chegaram entram no fim).
  if (Array.isArray(chegou.favTitulos) && chegou.favTitulos.length) {
    const atuais = lerLista<ItemDestaque>(C_FAV_TITULOS, id);
    const tem = (t: string, tipo: string, ano: string) =>
      atuais.some((x) => x.titulo === t && tipoDoPacote(x.tipo) === tipo && (x.ano || '') === ano);
    let mudou = false;
    for (const f of chegou.favTitulos) {
      const titulo = txt(f?.titulo);
      if (!titulo) continue;
      const tipo = tipoDoPacote(txt(f.tipo)), ano = txt(f.ano);
      if (tem(titulo, tipo, ano)) continue;
      atuais.push({ tipo, titulo, letra: txt(f.letra), ano, capa: '' });
      mudou = true;
    }
    if (mudou) gravarNoPerfil(C_FAV_TITULOS, id, JSON.stringify(atuais));
  }

  // Canais favoritos: união pelos ids do site.
  if (Array.isArray(chegou.favCanais) && chegou.favCanais.length) {
    const atuais = lerLista<string>(C_FAV_CANAIS, id);
    const novos = chegou.favCanais.filter((n) => typeof n === 'string' && n).map(idDoCanal).filter((c) => !atuais.includes(c));
    if (novos.length) gravarNoPerfil(C_FAV_CANAIS, id, JSON.stringify([...atuais, ...new Set(novos)]));
  }
}

function listas(): Obj {
  return {
    canais: linkCanais(), filmes: linkFilmes(), em: linksEm(),
    minhas: minhasListas().filter((l) => !!l.link).map((l) => ({ nome: l.nome, link: l.link as string })),
  };
}

async function aplicarListas(l: Obj): Promise<void> {
  const em = num(l.em);
  const local = linksEm();
  const ler = (v: unknown): string | null => (typeof v === 'string' ? normalizarEndereco(v) ?? '' : null);
  const canais = ler(l.canais), filmes = ler(l.filmes);
  if (canais !== null && filmes !== null) {
    let c = linkCanais(), f = linkFilmes();
    if (em > local) { c = canais; f = filmes; }
    else if (local === 0) { if (canais) c = canais; if (filmes) f = filmes; }
    const quando = em > local ? em : Date.now();
    if (c !== linkCanais()) definirLink('canais', c, quando);
    if (f !== linkFilmes()) definirLink('filmes', f, quando);
  }
  const minhas: Obj[] = Array.isArray(l.minhas) ? l.minhas : [];
  for (const m of minhas) {
    const link = txt(m?.link).trim();
    if (!/^https?:\/\//i.test(link) || minhasListas().some((x) => x.link === link)) continue;
    try { await adicionarLista(txt(m.nome), link, await baixarLista(link)); } catch { /* fora do ar ou no limite: segue */ }
  }
}

/** Avisa as telas abertas: favoritos e "Continue assistindo" do perfil ativo. */
function avisarTelas(): void {
  const id = idAtivo();
  for (const chave of [C_FAV_CANAIS, C_FAV_TITULOS, C_CONTINUAR]) {
    const v = lerDoPerfil(chave, id);
    // `useLocalStorage` escuta o evento de outra aba; a chave é a de sempre (o perfil já é o ativo).
    try { window.dispatchEvent(new StorageEvent('storage', { key: chave, newValue: v })); } catch { /* navegador antigo */ }
  }
  window.dispatchEvent(new Event('saimo-vod-favoritos-mudou'));
  window.dispatchEvent(new CustomEvent('saimo-continuar-mudou'));
}

function nomeDoAparelho(): string {
  const ua = navigator.userAgent;
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
  const so = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iPhone' : /Linux/.test(ua) ? 'Linux' : '';
  return `Site no ${nav}${so ? ` (${so})` : ''}`;
}

/** Mudanças daqui que vão para a conta. */
function aoMudarLocal(f: () => void): void {
  const chaves = new Set([C_FAV_CANAIS, C_FAV_TITULOS, C_CONTINUAR, 'saimo-perfis', 'saimo-perfis-removidos']);
  // O site grava direto no localStorage; olhar o setItem pega tudo, de qualquer tela.
  const proto = Storage.prototype;
  const set = proto.setItem;
  proto.setItem = function (this: Storage, k: string, v: string) {
    set.call(this, k, v);
    const base = String(k).split('@')[0];
    if (chaves.has(base) || base.startsWith('saimo-link-')) f();
  };
  aoMudarMinhas(f);
  aoMudarAddons(f);
}

export const adaptadorDoSite: Adaptador = {
  nomeDoAparelho,
  dadosDoPerfil,
  juntarNoPerfil,
  listas,
  aplicarListas,
  addons: () => exportConnectDadosPayload() as Obj,
  aplicarAddons: (p) => { aplicarDadosConnect(p); },
  avisarTelas,
  aoMudarLocal,
};

