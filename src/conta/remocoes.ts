/**
 * Registro do que foi removido ("onde parou", favoritos, Minhas listas), para a
 * sincronia não trazer de volta. Contrato em SaimoPlayer/docs/perfis.md:
 * cada remoção é `{…, em}` e um item só fica se for mais novo que ela (o item
 * sem `em` conta como 0). As mesmas regras do servidor (SaimoConta/src/juntar.ts).
 *
 * - Por perfil (`saimo-remocoes`): `prog` e `fav` ({tipo, titulo, ano, em};
 *   ano vazio vale para qualquer ano), `canal` ({nome, em}), e quando cada
 *   favorito entrou (`favEm`, `canalEm`).
 * - Minhas listas (`saimo-minhas-removidas`, do aparelho): `rem` ({link, em}) e `em` por link.
 */
import { gravarNoPerfil, lerDoPerfil } from '../perfis/perfis';

export type Obj = Record<string, any>;

export interface Registro {
  prog: Obj[];
  fav: Obj[];
  canal: Obj[];
  favEm: Record<string, number>;
  canalEm: Record<string, number>;
}

export interface RegistroListas { rem: Obj[]; em: Record<string, number> }

export const CHAVE_REMOCOES = 'saimo-remocoes';
const CHAVE_LISTAS = 'saimo-minhas-removidas';
const MAX = 300;
const VIDA = 180 * 24 * 3600_000;

const txt = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const mapa = (v: unknown): Record<string, number> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, number>) : {});

export const tipoDe = (x: Obj) => (x.tipo === 's' ? 's' : 'f');
export const chaveTitulo = (x: Obj) => `${tipoDe(x)}|${txt(x.titulo)}|${txt(x.ano)}`;
const chaveRemTitulo = (r: Obj) => (txt(r.titulo) ? chaveTitulo(r) : '');
const chaveRemCanal = (r: Obj) => txt(r.nome);
const chaveRemLink = (r: Obj) => txt(r.link).trim();

/** Junta remoções pela chave (vale o `em` maior); as velhas demais saem. */
function juntar(a: unknown, b: unknown, chave: (r: Obj) => string): Obj[] {
  const m = new Map<string, Obj>();
  const limite = Date.now() - VIDA;
  for (const r of [...arr(a), ...arr(b)]) {
    const k = chave(r);
    if (!k || !(num(r.em) > 0) || num(r.em) < limite) continue;
    const atual = m.get(k);
    if (!atual || num(r.em) > num(atual.em)) m.set(k, r);
  }
  return [...m.values()].sort((x, y) => num(y.em) - num(x.em)).slice(0, MAX);
}

/** O título foi removido depois de `emItem`? */
export function tituloRemovido(rem: Obj[], x: Obj, emItem: number): boolean {
  const ano = txt(x.ano);
  return rem.some((r) => tipoDe(r) === tipoDe(x) && txt(r.titulo) === txt(x.titulo)
    && (!txt(r.ano) || !ano || txt(r.ano) === ano) && num(r.em) >= emItem);
}

export function canalRemovido(r: Registro, nome: string, emItem = num(r.canalEm[nome])): boolean {
  return r.canal.some((c) => txt(c.nome) === nome && num(c.em) >= emItem);
}

export function lerRegistro(id: string): Registro {
  let v: Obj = {};
  try { v = JSON.parse(lerDoPerfil(CHAVE_REMOCOES, id) || '{}') ?? {}; } catch { /* vazio */ }
  return { prog: arr(v.prog), fav: arr(v.fav), canal: arr(v.canal), favEm: mapa(v.favEm), canalEm: mapa(v.canalEm) };
}

export function gravarRegistro(id: string, r: Registro): void {
  gravarNoPerfil(CHAVE_REMOCOES, id, JSON.stringify({
    prog: juntar(r.prog, [], chaveRemTitulo), fav: juntar(r.fav, [], chaveRemTitulo), canal: juntar(r.canal, [], chaveRemCanal),
    favEm: r.favEm, canalEm: r.canalEm,
  }));
}

/** Junta ao registro daqui as remoções que vieram da conta (perfil do pacote). */
export function juntarRegistro(r: Registro, chegou: Obj): Registro {
  const canalEm = { ...r.canalEm };
  for (const [n, em] of Object.entries(mapa(chegou.favCanaisEm))) if (num(em) > num(canalEm[n])) canalEm[n] = num(em);
  const favEm = { ...r.favEm };
  for (const f of arr(chegou.favTitulos)) {
    const k = chaveTitulo(f);
    if (num(f.em) > num(favEm[k])) favEm[k] = num(f.em);
  }
  return {
    prog: juntar(r.prog, chegou.progressoRemovido, chaveRemTitulo),
    fav: juntar(r.fav, chegou.favTitulosRemovidos, chaveRemTitulo),
    canal: juntar(r.canal, chegou.favCanaisRemovidos, chaveRemCanal),
    favEm, canalEm,
  };
}

/** Os campos do registro que vão no perfil do pacote. */
export function camposDoPacote(r: Registro): Obj {
  return {
    ...(r.prog.length ? { progressoRemovido: r.prog } : {}),
    ...(r.fav.length ? { favTitulosRemovidos: r.fav } : {}),
    ...(r.canal.length ? { favCanaisRemovidos: r.canal } : {}),
    ...(Object.keys(r.canalEm).length ? { favCanaisEm: r.canalEm } : {}),
  };
}

/* ───────────── Minhas listas ───────────── */

export function lerRegistroListas(): RegistroListas {
  let v: Obj = {};
  try { v = JSON.parse(localStorage.getItem(CHAVE_LISTAS) || '{}') ?? {}; } catch { /* vazio */ }
  return { rem: arr(v.rem), em: mapa(v.em) };
}

export function gravarRegistroListas(r: RegistroListas): void {
  try { localStorage.setItem(CHAVE_LISTAS, JSON.stringify({ rem: juntar(r.rem, [], chaveRemLink), em: r.em })); } catch { /* sem armazenamento */ }
}

export function juntarRegistroListas(r: RegistroListas, chegou: unknown): RegistroListas {
  return { rem: juntar(r.rem, chegou, chaveRemLink), em: r.em };
}

export function listaRemovida(r: RegistroListas, link: string, emItem = num(r.em[link])): boolean {
  return r.rem.some((x) => chaveRemLink(x) === link && num(x.em) >= emItem);
}

/** Lista com link removida aqui: anota. Lista adicionada: anota quando entrou. */
export function anotarLista(link: string | null | undefined, removida: boolean): void {
  if (!link) return;
  const r = lerRegistroListas();
  const agora = Date.now();
  if (removida) { r.rem.push({ link, em: agora }); delete r.em[link]; }
  else { r.em[link] = agora; r.rem = r.rem.filter((x) => chaveRemLink(x) !== link); }
  gravarRegistroListas(r);
}
