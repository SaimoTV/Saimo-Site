/**
 * Primeira tela para quem ainda não entrou numa conta: à esquerda entrar ou
 * criar a conta, à direita seguir sem login. A conta é opcional. Quem escolhe
 * "sem login" não vê esta tela de novo; a Conta Saimo segue como primeira
 * opção em Ajustes.
 */
import { estadoConta } from '../../../src/conta/conta';
import { caixaDaConta } from './ContaTela';
import { SpatialNav } from '../core/SpatialNav';

const CHAVE = 'saimo-boas-vindas-feito';

function jaEscolheu(): boolean {
  try { return localStorage.getItem(CHAVE) === '1'; } catch (e) { return false; }
}

export function mostrarBoasVindas(aoTerminar: () => void): void {
  if (estadoConta().token || jaEscolheu()) { aoTerminar(); return; }

  const fundo = document.createElement('div');
  fundo.className = 'tv-boasvindas';
  const terminar = () => { fundo.remove(); aoTerminar(); };

  const tela = () => {
    fundo.innerHTML = `
      <div class="tv-boasvindas-lado esquerda">
        <div class="tv-perfis-titulo">Entrar ou criar conta</div>
        <div class="tv-boasvindas-porque">Por que criar uma conta?</div>
        <ul>
          <li>Perfis, favoritos, listas e addons guardados e em qualquer aparelho.</li>
          <li>Continue de onde parou no celular, na TV e no computador.</li>
          <li>Trocou de aparelho ou reinstalou? Nada se perde.</li>
        </ul>
        <div class="tv-boasvindas-conta"></div>
      </div>
      <div class="tv-boasvindas-lado direita">
        <div class="tv-perfis-titulo">Entrar sem login</div>
        <div class="tv-perfis-sub"><b>A conta não é obrigatória.</b> Dá para usar o Saimo TV inteiro sem entrar: tudo fica guardado só nesta TV.</div>
        <div class="tv-perfis-sub">Crie a conta quando quiser, em Ajustes &gt; Conta Saimo.</div>
        <div class="tv-btn nav-focusable" data-nav="true" data-acao="sem">Entrar sem login</div>
      </div>`;
    fundo.querySelector('[data-acao="sem"]')!.addEventListener('click', () => {
      try { localStorage.setItem(CHAVE, '1'); } catch (e) { /* vale só nesta visita */ }
      terminar();
    });
    // O QR já aparece aqui; "E-mail e senha" troca o QR pelo formulário e "Voltar ao QR code" volta.
    fundo.querySelector('.tv-boasvindas-conta')!.appendChild(caixaDaConta(() => {
      if (estadoConta().token) terminar();
    }));
    setTimeout(() => {
      const b = fundo.querySelector<HTMLElement>('.tv-btn');
      if (b) SpatialNav.focus(b);
    }, 150);
  };

  document.body.appendChild(fundo);
  tela();
}
