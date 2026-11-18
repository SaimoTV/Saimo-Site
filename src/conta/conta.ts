/**
 * Conta Saimo (opcional) no site e no app da Samsung e da LG (tv-native).
 *
 * Sem conta, nada muda: os dados ficam no aparelho. Com conta, perfis, onde
 * parou, favoritos, listas e addons vão para o servidor (SaimoConta, um
 * Cloudflare Worker) e voltam em qualquer aparelho. O que viaja é o mesmo
 * pacote do Saimo Connect (`{t:"dados"}`, SaimoPlayer/docs/perfis.md); cada app
 * diz como ler e gravar os seus dados por um `Adaptador` (site: ./site.ts;
 * Samsung e LG: tv-native/src/core/ContaTv.ts).
 *
 * Site: entra com o e-mail (código de 6 números) e aprova TVs pelo código do QR.
 * TV: mostra o QR (pedirCodigoDaTv) e espera o celular aprovar (conferirAprovacao).
 */
import { MAX_PERFIS, mesclarPerfis, PRINCIPAL, perfis, removidos, type Perfil } from '../perfis/perfis';

/** Endereço do servidor. Em teste: VITE_CONTA_API=http://127.0.0.1:8787 no `vite`. */
const DO_BUILD = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_CONTA_API;
export const CONTA_API = (DO_BUILD || 'https://conta.saimo-tv.com.br').replace(/\/$/, '');

const CHAVE = 'saimo-conta-v1';
const DEZ_MIN = 10 * 60 * 1000;

type Obj = Record<string, any>;

export interface DadosDoPerfil { progresso: Obj[]; favTitulos: Obj[]; favCanais: string[] }

/** O que cada app sabe fazer com os seus dados. */
export interface Adaptador {
  /** Nome que aparece na lista de aparelhos da conta ("Saimo no Chrome"). */
  nomeDoAparelho(): string;
  dadosDoPerfil(id: string): DadosDoPerfil;
  /** Junta progresso e favoritos que vieram da conta aos de um perfil daqui. */
  juntarNoPerfil(id: string, chegou: Partial<DadosDoPerfil>): void;
  listas?(): Obj | undefined;
  aplicarListas?(l: Obj): Promise<void>;
  addons?(): { addons?: Obj[]; debrid?: Obj };
  aplicarAddons?(pacote: Obj): void;
  /** Avisa as telas que os dados mudaram (o site recarrega o que mostra). */
  avisarTelas?(): void;
  /** Chama `f` quando algo muda aqui (para mandar em alguns segundos). */
  aoMudarLocal?(f: () => void): void;
}

export interface EstadoConta {
  token: string | null;
  email: string | null;
  sincronizadaEm: number;
  erro: string | null;
  sincronizando: boolean;
}

let estado: EstadoConta = { token: null, email: null, sincronizadaEm: 0, erro: null, sincronizando: false };
const ouvintes = new Set<(e: EstadoConta) => void>();
let adaptador: Adaptador | null = null;

function lerSessao(): void {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (v?.token) estado = { ...estado, token: v.token, email: v.email ?? null, sincronizadaEm: Number(v.sincronizadaEm) || 0 };
  } catch { /* sem sessão */ }
}
lerSessao();

function gravarSessao(): void {
  try {
    if (!estado.token) localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, JSON.stringify({ token: estado.token, email: estado.email, sincronizadaEm: estado.sincronizadaEm }));
  } catch { /* armazenamento bloqueado: vale só nesta visita */ }
}

export function estadoConta(): EstadoConta { return estado; }
export function aoMudarConta(f: (e: EstadoConta) => void): () => void { ouvintes.add(f); return () => { ouvintes.delete(f); }; }
function mudar(parcial: Partial<EstadoConta>): void {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((f) => { try { f(estado); } catch { /* ouvinte não derruba */ } });
}

export class ErroConta extends Error {}

async function api(metodo: string, rota: string, corpo?: unknown, token: string | null = estado.token): Promise<any> {
  let r: Response;
  try {
    r = await fetch(CONTA_API + rota, {
      method: metodo,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroConta('Sem conexão com a conta Saimo agora');
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && token) {
    // Sessão encerrada em outro lugar (sair de todos, conta apagada).
    mudar({ token: null, email: null, sincronizadaEm: 0 });
    gravarSessao();
  }
  if (!r.ok) throw new ErroConta(j?.mensagem || 'Não deu certo: tente de novo');
  return j;
}

const nome = () => (adaptador?.nomeDoAparelho() || 'Saimo').slice(0, 60);

/* ───────────── entrar e sair ───────────── */

/** Manda o código de 6 números para o e-mail. Em teste o servidor devolve o código (`codigoDev`). */
export function pedirCodigo(email: string): Promise<{ codigoDev?: string }> {
  return api('POST', '/v1/email/codigo', { email: email.trim() }, null);
}

export async function entrarComCodigo(email: string, codigo: string): Promise<void> {
  const j = await api('POST', '/v1/email/entrar', { email: email.trim(), codigo: codigo.trim(), aparelho: nome() }, null);
  entrou(j.token, j.conta?.email ?? email.trim().toLowerCase());
}

/** Entrar com e-mail e senha (para quem criou uma). */
export async function entrarComSenha(email: string, senha: string): Promise<void> {
  const j = await api('POST', '/v1/senha/entrar', { email: email.trim(), senha, aparelho: nome() }, null);
  entrou(j.token, j.conta?.email ?? email.trim().toLowerCase());
}

/**
 * Criar a conta com senha, pôr uma senha na conta ou trocar a esquecida: com o
 * código que chegou no e-mail (pedirCodigo antes). Trocar encerra as outras sessões.
 */
export async function definirSenha(email: string, codigo: string, senha: string): Promise<void> {
  const j = await api('POST', '/v1/senha/definir', { email: email.trim(), codigo: codigo.trim(), senha, aparelho: nome() }, null);
  entrou(j.token, j.conta?.email ?? email.trim().toLowerCase());
}

/** Criar a conta com e-mail e senha (o e-mail não é verificado: é só o login). */
export async function cadastrar(email: string, senha: string): Promise<void> {
  const j = await api('POST', '/v1/senha/cadastrar', { email: email.trim(), senha, aparelho: nome() }, null);
  entrou(j.token, j.conta?.email ?? email.trim().toLowerCase());
}

/** Trocar a senha de quem está logado (os outros aparelhos saem da conta). */
export async function trocarSenha(senhaAtual: string, senhaNova: string): Promise<void> {
  await api('POST', '/v1/senha/trocar', { senhaAtual, senhaNova });
}

function entrou(token: string, email: string | null): void {
  ultimoEnviado = '';
  mudar({ token, email, erro: null });
  gravarSessao();
  void sincronizar(true);
}

export async function sair(): Promise<void> {
  try { await api('POST', '/v1/sair'); } catch { /* sai daqui de qualquer jeito */ }
  ultimoEnviado = '';
  mudar({ token: null, email: null, sincronizadaEm: 0, erro: null });
  gravarSessao();
}

/** Apaga a conta e o que ela guarda no servidor (os dados daqui continuam). */
export async function apagarConta(): Promise<void> {
  await api('DELETE', '/v1/conta');
  ultimoEnviado = '';
  mudar({ token: null, email: null, sincronizadaEm: 0, erro: null });
  gravarSessao();
}

/** Quem está logado aprova a TV que mostra o QR (ou o código ABCD-2345). Devolve o nome da TV. */
export async function aprovarTv(codigo: string): Promise<string> {
  if (!estado.token) throw new ErroConta('Entre na sua conta primeiro');
  const j = await api('POST', '/v1/tv/aprovar', { codigo });
  return String(j.aparelho ?? 'A TV');
}

/** O código da TV num link do QR (…/conectar?c=ABCD2345) ou digitado (ABCD-2345). */
export function codigoDoQr(texto: string): string | null {
  const m = /[?&]c=([A-Za-z0-9-]{8,9})/.exec(texto) ?? /^([A-Za-z0-9]{4}-?[A-Za-z0-9]{4})$/.exec(texto.trim());
  return m ? m[1].toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
}

/* ───────────── a TV entra pelo celular ───────────── */

export interface PedidoTv { aparelhoCodigo: string; codigo: string; url: string; expiraEm: number; intervaloMs: number }

export async function pedirCodigoDaTv(): Promise<PedidoTv> {
  const j = await api('POST', '/v1/tv/pedir', { aparelho: nome() }, null);
  return {
    aparelhoCodigo: String(j.aparelhoCodigo), codigo: String(j.codigo), url: String(j.url),
    expiraEm: Number(j.expiraEm) || Date.now() + 600_000, intervaloMs: (Number(j.intervalo) || 5) * 1000,
  };
}

/** `true` quando o celular aprovou (já entra); `false` se ainda espera; `null` se o código venceu. */
export async function conferirAprovacao(p: PedidoTv): Promise<boolean | null> {
  const j = await api('POST', '/v1/tv/estado', { aparelhoCodigo: p.aparelhoCodigo }, null);
  if (j.estado === 'aprovado' && j.token) { entrou(String(j.token), j.conta?.email ?? null); return true; }
  return j.estado === 'vencido' ? null : false;
}

/* ───────────── o pacote ───────────── */

/** Monta o pacote `{t:"dados"}` com tudo deste aparelho. */
export function montarPacote(a: Adaptador): Obj {
  const lista = perfis();
  const daqui = lista.map((p) => {
    const d = a.dadosDoPerfil(p.id);
    return {
      id: p.id, nome: p.nome, avatar: p.avatar, em: p.em,
      ...(p.kids ? { kids: true, codigo: p.codigo ?? '' } : {}),
      progresso: d.progresso, favTitulos: d.favTitulos, favCanais: d.favCanais,
    };
  });
  const principal = daqui.find((p) => p.id === PRINCIPAL);
  const listas = a.listas?.();
  const extras = a.addons?.() ?? {};
  return {
    t: 'dados',
    // Os campos de sempre levam o perfil principal (apps sem perfis).
    progresso: principal?.progresso ?? [], favTitulos: principal?.favTitulos ?? [], favCanais: principal?.favCanais ?? [],
    perfis: daqui,
    perfisRemovidos: removidos(),
    ...(listas ? { listas } : {}),
    ...(Array.isArray(extras.addons) ? { addons: extras.addons } : {}),
    ...(extras.debrid ? { debrid: extras.debrid } : {}),
  };
}

/** Junta o pacote que veio da conta ao que este aparelho tem. */
export function aplicarPacote(a: Adaptador, p: Obj): void {
  if (!p || typeof p !== 'object') return;
  if (Array.isArray(p.perfis)) {
    const remotos = (p.perfis as Obj[]).filter((x) => x && typeof x.id === 'string').slice(0, MAX_PERFIS * 2);
    const existem = mesclarPerfis(
      remotos.map((x) => ({
        id: x.id, nome: String(x.nome ?? ''), avatar: String(x.avatar ?? ''), em: Number(x.em) || 0,
        ...(x.kids ? { kids: true, codigo: String(x.codigo ?? '') } : {}),
      }) as Perfil),
      Array.isArray(p.perfisRemovidos) ? p.perfisRemovidos : []);
    for (const x of remotos) if (existem.has(x.id)) a.juntarNoPerfil(x.id, x);
  } else {
    a.juntarNoPerfil(PRINCIPAL, p);
  }
  // Listas novas são baixadas em segundo plano: uma lista lenta ou fora do ar não segura o resto.
  if (p.listas && a.aplicarListas) void a.aplicarListas(p.listas).catch(() => { /* lista fora do ar: segue */ });
  if ((Array.isArray(p.addons) || p.debrid) && a.aplicarAddons) { try { a.aplicarAddons(p); } catch { /* mantém os daqui */ } }
  a.avisarTelas?.();
}

/* ───────────── sincronizar ───────────── */

let ultimoEnviado = '';
let emCurso: Promise<void> | null = null;
let aplicandoAte = 0;

/**
 * Baixa o que a conta tem, junta aqui (regras do Connect) e manda o que este
 * aparelho tem; o servidor junta de novo e guarda. Só manda quando mudou.
 */
export function sincronizar(forcar = false): Promise<void> {
  const a = adaptador;
  if (!estado.token || !a) return Promise.resolve();
  if (emCurso) return emCurso;
  emCurso = (async () => {
    mudar({ sincronizando: true });
    try {
      const remoto = await api('GET', '/v1/dados');
      if (remoto?.dados) {
        aplicandoAte = Date.now() + 3000;
        aplicarPacote(a, remoto.dados);
      }
      const pacote = montarPacote(a);
      const texto = JSON.stringify(pacote);
      if (forcar || texto !== ultimoEnviado) {
        await api('PUT', '/v1/dados', { dados: pacote });
        ultimoEnviado = texto;
      }
      mudar({ sincronizadaEm: Date.now(), erro: null });
      gravarSessao();
    } catch (e) {
      mudar({ erro: e instanceof Error ? e.message : 'Não consegui sincronizar' });
    } finally {
      mudar({ sincronizando: false });
      emCurso = null;
    }
  })();
  return emCurso;
}

let agendado: ReturnType<typeof setTimeout> | null = null;
/** Algo mudou aqui: manda em alguns segundos (várias mudanças viram um envio só). */
export function agendar(ms = 15000): void {
  if (!estado.token || Date.now() < aplicandoAte) return;
  if (agendado) clearTimeout(agendado);
  agendado = setTimeout(() => { agendado = null; void sincronizar(); }, ms);
}

let iniciada = false;
/** Na abertura: liga a sincronia (abrir, voltar para a aba, mudanças, a cada 10 min). */
export function iniciarConta(a: Adaptador): void {
  adaptador = a;
  if (iniciada) return;
  iniciada = true;
  a.aoMudarLocal?.(() => agendar());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - estado.sincronizadaEm > 60_000) void sincronizar();
  });
  setInterval(() => { if (document.visibilityState !== 'hidden') void sincronizar(); }, DEZ_MIN);
  if (estado.token) setTimeout(() => void sincronizar(), 3000);
}
