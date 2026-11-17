/**
 * Controle parental: a senha que libera o conteúdo adulto. Padrão 0000, trocável
 * nos Ajustes; vale para o aparelho todo (não é de perfil). No perfil Kids o
 * conteúdo adulto nunca destranca, nem com a senha.
 */
import { sha256 } from './sha256';
import { ehKids } from './kids';

export const SENHA_PADRAO = '0000';
const CHAVE = 'saimo-parental-senha';

const hash = (senha: string) => sha256(`saimo-parental:${senha}`);

export function conferirSenha(senha: string): boolean {
  if (ehKids()) return false;
  let guardada: string | null = null;
  try { guardada = localStorage.getItem(CHAVE); } catch { /* sem armazenamento */ }
  return guardada ? hash(senha) === guardada : senha === SENHA_PADRAO;
}

export function senhaEhPadrao(): boolean {
  try { return !localStorage.getItem(CHAVE); } catch { return true; }
}

/** Troca a senha (a atual tem de conferir). Nova: 4 números. */
export function trocarSenha(atual: string, nova: string): boolean {
  if (!conferirSenha(atual) || !/^\d{4}$/.test(nova)) return false;
  try { localStorage.setItem(CHAVE, hash(nova)); } catch { return false; }
  return true;
}
