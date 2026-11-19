/**
 * Perfis: cada um com os seus favoritos, onde parou e recentes; as listas, as
 * fontes e os ajustes são do aparelho todo. Contrato comum dos apps em
 * SaimoPlayer/docs/perfis.md.
 *
 * Como o site guarda: o perfil principal usa as chaves de sempre (quem já usava
 * não perde nada); os outros, a mesma chave com o sufixo `@<id>`. Em vez de
 * mexer em cada módulo, `instalarChavesPorPerfil` troca a chave na entrada do
 * localStorage, antes de qualquer módulo ler. Trocar de perfil recarrega a
 * página, então nada do perfil anterior fica na memória.
 */

import { sha256 } from './sha256';

export interface Perfil {
  id: string;
  nome: string;
  avatar: string;
  /** Quando nome ou avatar mudaram por último (ms). */
  em: number;
  /** Perfil infantil: só o que é liberado (perfis/kids.ts), e sair dele pede o código. */
  kids?: boolean;
  /** SHA-256 de `saimo-kids:<id>:<código>`; o código em si nunca é guardado. */
  codigo?: string;
}

export interface Remocao { id: string; em: number }

export const PRINCIPAL = 'principal';
export const MAX_PERFIS = 10;
export const MAX_NOME = 20;


export function hashCodigo(id: string, codigo: string): string {
  return sha256(`saimo-kids:${id}:${codigo}`);
}

/** Código de 4 dígitos do perfil Kids confere? Perfil comum: sempre. */
export function conferirCodigo(p: Perfil, codigo: string): boolean {
  if (!p.kids || !p.codigo) return true;
  return hashCodigo(p.id, codigo) === p.codigo;
}

/** Sair deste perfil (ou editar, ou abrir os Ajustes) pede o código? */
export function pedeCodigo(p: Perfil): boolean {
  return !!p.kids && !!p.codigo;
}

/** Os avatares, na ordem da grade (ids de SaimoPlayer/docs/avatares/ids.txt). */
export const AVATARES = [
  'gato', 'cachorro', 'raposa', 'urso', 'panda', 'coelho', 'coruja', 'pinguim', 'sapo', 'leao', 'coala',
  'robo', 'alien', 'monstro', 'dino', 'polvo', 'pintinho', 'tigre', 'astronauta', 'abelha', 'fantasma',
] as const;

/** Chaves que são de cada perfil. */
const DO_PERFIL = new Set([
  'tv-favorites', 'tv-last-channel', 'saimo-vod-favoritos', 'saimo-continuar', 'saimo-buscas-recentes',
  'saimo-radios-recentes', 'saimo-novelinhas-progresso', 'current-movie-id', 'saimo-assistidos', 'saimo-novos-episodios',
  // App da Samsung e da LG (tv-native), que usa este mesmo módulo.
  'saimo_tv_fav_channels', 'saimo_tv_fav_vod', 'saimo_tv_vod_progress', 'saimo_tv_ultimo_canal',
  'saimo_novelinhas_parada',
]);
const PREFIXOS_DO_PERFIL = ['movie-progress-'];

const CHAVE_PERFIS = 'saimo-perfis';
const CHAVE_ATIVO = 'saimo-perfil-ativo';
const CHAVE_REMOVIDOS = 'saimo-perfis-removidos';
const CHAVE_PERGUNTAR = 'saimo-perfil-perguntar';
/** Nesta aba o perfil já foi escolhido (não pergunta de novo ao recarregar). */
const CHAVE_ESCOLHIDO = 'saimo-perfil-escolhido';

export function ehDoPerfil(chave: string): boolean {
  return DO_PERFIL.has(chave) || PREFIXOS_DO_PERFIL.some((p) => chave.startsWith(p));
}

/** A chave de um dado de perfil para um perfil qualquer. */
export function chaveDoPerfil(chave: string, id: string): string {
  return id === PRINCIPAL ? chave : `${chave}@${id}`;
}

/* ───────────── acesso cru (sem a troca de chave) ───────────── */

type Cru = { get: (k: string) => string | null; set: (k: string, v: string) => void; del: (k: string) => void };
let cru: Cru = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* cheio ou bloqueado */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* bloqueado */ } },
};

function lerJson<T>(chave: string, padrao: T): T {
  try {
    const v = cru.get(chave);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch { return padrao; }
}

/* ───────────── lista de perfis ───────────── */

function principalPadrao(): Perfil {
  return { id: PRINCIPAL, nome: 'Principal', avatar: 'gato', em: 0 };
}

function limparNome(nome: string): string {
  return nome.replace(/\s+/g, ' ').trim().slice(0, MAX_NOME);
}

export function perfis(): Perfil[] {
  const lista = lerJson<Perfil[]>(CHAVE_PERFIS, []).filter((p) => p && typeof p.id === 'string');
  if (!lista.some((p) => p.id === PRINCIPAL)) lista.unshift(principalPadrao());
  // O principal sempre primeiro; o resto na ordem de criação.
  return [lista.find((p) => p.id === PRINCIPAL)!, ...lista.filter((p) => p.id !== PRINCIPAL)].slice(0, MAX_PERFIS);
}

function gravar(lista: Perfil[]): void {
  cru.set(CHAVE_PERFIS, JSON.stringify(lista));
  avisar();
}

export function removidos(): Remocao[] {
  return lerJson<Remocao[]>(CHAVE_REMOVIDOS, []);
}

export function idAtivo(): string {
  const id = cru.get(CHAVE_ATIVO);
  return id && perfis().some((p) => p.id === id) ? id : PRINCIPAL;
}

export function ativo(): Perfil {
  const id = idAtivo();
  return perfis().find((p) => p.id === id) ?? perfis()[0];
}

function novoId(): string {
  const letras = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(9);
  try { crypto.getRandomValues(bytes); }
  catch { for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256); }
  return 'p' + Array.from(bytes, (b) => letras[b % letras.length]).join('');
}

export function criar(nome: string, avatar: string, kids?: { codigo: string }): Perfil | null {
  const lista = perfis();
  const limpo = limparNome(nome);
  if (!limpo || lista.length >= MAX_PERFIS) return null;
  const id = novoId();
  const p: Perfil = { id, nome: limpo, avatar, em: Date.now() };
  if (kids && /^\d{4}$/.test(kids.codigo)) { p.kids = true; p.codigo = hashCodigo(id, kids.codigo); }
  gravar([...lista, p]);
  return p;
}

/**
 * Muda nome e avatar. `kids`: undefined mantém como está; `null` tira o Kids;
 * `{ codigo }` liga (ou troca o código).
 */
export function editar(id: string, nome: string, avatar: string, kids?: { codigo: string } | null): void {
  const limpo = limparNome(nome);
  if (!limpo) return;
  gravar(perfis().map((p) => {
    if (p.id !== id) return p;
    const novo: Perfil = { ...p, nome: limpo, avatar, em: Date.now() };
    if (kids === null) { delete novo.kids; delete novo.codigo; }
    else if (kids && /^\d{4}$/.test(kids.codigo) && id !== PRINCIPAL) { novo.kids = true; novo.codigo = hashCodigo(id, kids.codigo); }
    return novo;
  }));
}

/** Apaga o perfil e os dados dele. O principal não sai. */
export function apagar(id: string): void {
  if (id === PRINCIPAL) return;
  apagarDados(id);
  gravar(perfis().filter((p) => p.id !== id));
  guardarRemocao({ id, em: Date.now() });
  if (cru.get(CHAVE_ATIVO) === id) cru.set(CHAVE_ATIVO, PRINCIPAL);
}

function apagarDados(id: string): void {
  const sufixo = `@${id}`;
  const apagar: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.endsWith(sufixo) && ehDoPerfil(k.slice(0, -sufixo.length))) apagar.push(k);
    }
  } catch { /* armazenamento bloqueado */ }
  apagar.forEach((k) => cru.del(k));
}

function guardarRemocao(r: Remocao): void {
  const lista = [r, ...removidos().filter((x) => x.id !== r.id)].sort((a, b) => b.em - a.em).slice(0, 50);
  cru.set(CHAVE_REMOVIDOS, JSON.stringify(lista));
}

/* ───────────── escolher ───────────── */

export function perguntarAoAbrir(): boolean {
  return cru.get(CHAVE_PERGUNTAR) !== '0';
}

export function definirPerguntar(sim: boolean): void {
  cru.set(CHAVE_PERGUNTAR, sim ? '1' : '0');
  avisar();
}

/** Abre a escolha ao entrar? Só com 2 ou mais perfis, e uma vez por aba. */
export function deveEscolherAoAbrir(): boolean {
  if (perfis().length < 2 || !perguntarAoAbrir()) return false;
  try { return sessionStorage.getItem(CHAVE_ESCOLHIDO) !== '1'; } catch { return true; }
}

export function marcarEscolhido(): void {
  try { sessionStorage.setItem(CHAVE_ESCOLHIDO, '1'); } catch { /* sem armazenamento */ }
}

/**
 * Entra no perfil. Mesmo perfil: só fecha a escolha. Outro: grava e recarrega
 * a página, para tudo (favoritos, progresso, recentes) ser lido do perfil novo.
 */
export function entrar(id: string): void {
  marcarEscolhido();
  if (id === idAtivo()) { avisar(); return; }
  cru.set(CHAVE_ATIVO, id);
  if (location.protocol === 'file:' || location.protocol === 'app:') { location.reload(); return; }
  const destino = location.pathname.startsWith('/tv') || location.pathname === '/' ? '/home' : location.pathname;
  location.replace(destino);
}

/** Onde ficam as imagens: o site serve os SVG em /avatares; o app da TV leva PNG em img/avatares. */
let caminhoAvatar = (id: string) => `/avatares/${id}.svg`;
export function definirCaminhoAvatar(f: (id: string) => string): void { caminhoAvatar = f; }

export function avatarUrl(avatar: string): string {
  return (AVATARES as readonly string[]).includes(avatar) ? caminhoAvatar(avatar) : '';
}

/* ───────────── avisos para a interface ───────────── */

const ouvintes = new Set<() => void>();
let versao = 0;
function avisar(): void { versao++; ouvintes.forEach((f) => f()); }
export function assinar(f: () => void): () => void { ouvintes.add(f); return () => { ouvintes.delete(f); }; }
export function versaoAtual(): number { return versao; }

/** Pede à interface que abra a escolha de perfil (do avatar da barra ou dos Ajustes). */
export const EVENTO_ABRIR = 'saimo-abrir-perfis';
export function abrirEscolha(modo: 'escolher' | 'gerenciar' = 'escolher'): void {
  window.dispatchEvent(new CustomEvent(EVENTO_ABRIR, { detail: modo }));
}

/* ───────────── a troca de chave ───────────── */

let instalado = false;

/**
 * Faz `localStorage.getItem('tv-favorites')` ler `tv-favorites@<id>` quando o
 * perfil ativo não é o principal. Chamar uma vez, antes de qualquer módulo que
 * leia dados de perfil.
 */
export function instalarChavesPorPerfil(): void {
  if (instalado || typeof Storage === 'undefined') return;
  instalado = true;
  const proto = Storage.prototype;
  const get = proto.getItem, set = proto.setItem, del = proto.removeItem;
  let ls: Storage | null = null;
  try { ls = window.localStorage; } catch { return; }
  cru = {
    get: (k) => { try { return get.call(ls, k); } catch { return null; } },
    set: (k, v) => { try { set.call(ls, k, v); } catch { /* cheio ou bloqueado */ } },
    del: (k) => { try { del.call(ls, k); } catch { /* bloqueado */ } },
  };
  // O ativo é lido uma vez: trocar de perfil recarrega a página.
  const id = idAtivo();
  if (id === PRINCIPAL) return;
  const traduzir = (alvo: Storage, k: string) => (alvo === ls && ehDoPerfil(String(k)) ? `${k}@${id}` : k);
  proto.getItem = function (this: Storage, k: string) { return get.call(this, traduzir(this, k)); };
  proto.setItem = function (this: Storage, k: string, v: string) { return set.call(this, traduzir(this, k), v); };
  proto.removeItem = function (this: Storage, k: string) { return del.call(this, traduzir(this, k)); };
}

/** Lê um dado de qualquer perfil, sem depender do ativo (para a sincronia). */
export function lerDoPerfil(chave: string, id: string): string | null {
  return cru.get(chaveDoPerfil(chave, id));
}

/** Grava um dado de qualquer perfil, sem depender do ativo (para a sincronia). */
export function gravarNoPerfil(chave: string, id: string, valor: string): void {
  cru.set(chaveDoPerfil(chave, id), valor);
}

/**
 * Junta os perfis que vieram de outro aparelho (Saimo Connect ou Conta Saimo),
 * com as regras de SaimoPlayer/docs/perfis.md: remoção mais nova que o perfil
 * apaga; perfil novo entra se houver vaga; nome, avatar e Kids ficam com o `em`
 * maior. Devolve os ids que existem aqui depois de juntar.
 */
export function mesclarPerfis(remotos: Perfil[], remocoes: Remocao[]): Set<string> {
  let lista = perfis();
  const minhasRemocoes = removidos();
  let mudou = false;
  for (const r of remocoes) {
    if (!r || typeof r.id !== 'string' || r.id === PRINCIPAL) continue;
    const local = lista.find((p) => p.id === r.id);
    if (local && local.em < Number(r.em)) {
      apagarDados(r.id);
      lista = lista.filter((p) => p.id !== r.id);
      if (cru.get(CHAVE_ATIVO) === r.id) cru.set(CHAVE_ATIVO, PRINCIPAL);
      mudou = true;
    }
    if (!minhasRemocoes.some((x) => x.id === r.id && x.em >= Number(r.em))) guardarRemocao({ id: r.id, em: Number(r.em) || 0 });
  }
  const todasRemocoes = removidos();
  for (const p of remotos) {
    if (!p || typeof p.id !== 'string' || !p.id) continue;
    const em = Number(p.em) || 0;
    if (todasRemocoes.some((r) => r.id === p.id && r.em >= em)) continue;
    const limpo = limparNome(String(p.nome ?? '')) || 'Perfil';
    const avatar = (AVATARES as readonly string[]).includes(p.avatar) ? p.avatar : 'gato';
    const novo: Perfil = { id: p.id, nome: limpo, avatar, em };
    if (p.kids && p.id !== PRINCIPAL) { novo.kids = true; if (p.codigo) novo.codigo = String(p.codigo); }
    const i = lista.findIndex((x) => x.id === p.id);
    if (i < 0) {
      if (lista.length >= MAX_PERFIS) continue;
      lista = [...lista, novo];
      mudou = true;
    } else if (em > lista[i].em) {
      lista = lista.map((x, j) => (j === i ? novo : x));
      mudou = true;
    }
  }
  if (mudou) gravar(lista);
  return new Set(perfis().map((p) => p.id));
}
