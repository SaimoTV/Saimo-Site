/**
 * Quando o site quebra ao abrir, em vez de tela preta: o erro e um botão que
 * limpa os dados deste site (listas, perfis, cache) e recarrega.
 *
 * Quase sempre é dado guardado por uma versão anterior que a versão nova não
 * esperava; limpando, o site abre como no primeiro acesso.
 */
import { Component, type ReactNode } from 'react';

async function limparTudo(): Promise<void> {
  try { localStorage.clear(); } catch { /* sem acesso */ }
  try { sessionStorage.clear(); } catch { /* sem acesso */ }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((regs || []).map((r) => r.unregister()));
  } catch { /* sem service worker */ }
  try {
    const nomes = await caches.keys();
    await Promise.all(nomes.map((n) => caches.delete(n)));
  } catch { /* sem cache */ }
  location.reload();
}

function textoDoErro(erro: unknown): string {
  if (erro instanceof Error) return `${erro.name}: ${erro.message}\n${(erro.stack || '').split('\n').slice(0, 4).join('\n')}`;
  return String(erro);
}

/** Desenha a tela de falha direto no DOM (serve antes do React existir). */
// eslint-disable-next-line react-refresh/only-export-components -- usada antes do React existir
export function mostrarFalha(erro: unknown): void {
  console.error('[Saimo] falha ao abrir:', erro);
  const raiz = document.getElementById('root') || document.body;
  raiz.innerHTML = '';
  const caixa = document.createElement('div');
  caixa.style.cssText = 'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px;background:#0a0a0a;color:#fff;font-family:Inter,system-ui,sans-serif;text-align:center;';
  const titulo = document.createElement('h1');
  titulo.textContent = 'O Saimo TV não conseguiu abrir';
  titulo.style.cssText = 'font-size:24px;margin:0;';
  const texto = document.createElement('p');
  texto.textContent = 'Algum dado guardado por uma versão anterior pode estar atrapalhando. Limpar os dados deste site resolve; as listas e favoritos guardados na Conta Saimo voltam ao entrar de novo.';
  texto.style.cssText = 'max-width:560px;opacity:.8;margin:0;line-height:1.5;';
  const detalhe = document.createElement('pre');
  detalhe.textContent = textoDoErro(erro);
  detalhe.style.cssText = 'max-width:90vw;white-space:pre-wrap;font-size:12px;opacity:.6;background:#16161c;padding:12px;border-radius:8px;text-align:left;';
  const botoes = document.createElement('div');
  botoes.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;';
  const limpar = document.createElement('button');
  limpar.textContent = 'Limpar os dados do site e recarregar';
  limpar.style.cssText = 'padding:12px 18px;border-radius:10px;border:0;background:#4fe3d0;color:#071311;font-weight:700;cursor:pointer;';
  limpar.onclick = () => { void limparTudo(); };
  const recarregar = document.createElement('button');
  recarregar.textContent = 'Tentar de novo';
  recarregar.style.cssText = 'padding:12px 18px;border-radius:10px;border:1px solid #444;background:transparent;color:#fff;cursor:pointer;';
  recarregar.onclick = () => location.reload();
  botoes.append(limpar, recarregar);
  caixa.append(titulo, texto, detalhe, botoes);
  raiz.appendChild(caixa);
}

/** O mesmo para erro de desenho do React (que sem isto desmonta a página inteira). */
export class ProtecaoDeFalha extends Component<{ children: ReactNode }, { erro: unknown }> {
  state = { erro: null as unknown };
  static getDerivedStateFromError(erro: unknown) { return { erro }; }
  componentDidCatch(erro: unknown) { setTimeout(() => mostrarFalha(erro), 0); }
  render() { return this.state.erro ? null : this.props.children; }
}
