/** Ajustes > Minhas listas: adicionar pelo link e cuidar das listas guardadas. */

import { SpatialNav } from '../core/SpatialNav';
import { MinhasListas } from '../core/MinhasListas';
import { Api } from '../core/Api';
import { State } from '../core/State';
import { linkDoFormulario } from '../../../src/utils/xtream';
import { normalizarEndereco } from '../../../src/utils/enderecoLista';
import { Storage } from '../core/Storage';

export class MinhasListasScreen {
  private element: HTMLElement;
  private corpo: HTMLElement;
  private aviso: HTMLElement;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-minhas tv-screen-scroll tv-scroll-v hidden';
    this.element.id = 'screen-minhas';
    this.element.innerHTML = `
      <div class="tv-minhas-titulo">Minhas listas</div>
      <div class="tv-minhas-ajuda">Cole o link da sua lista M3U: só isso já basta. Usuário e senha são opcionais, para listas que pedem login. Ela fica só neste aparelho.</div>
      <input id="ml-link" class="tv-campo nav-focusable" data-nav="true" type="text" placeholder="Link da lista (M3U) ou servidor" />
      <input id="ml-usuario" class="tv-campo nav-focusable" data-nav="true" type="text" placeholder="Usuário (opcional: deixe em branco se a lista é só um link)" />
      <input id="ml-senha" class="tv-campo nav-focusable" data-nav="true" type="password" placeholder="Senha (opcional)" />
      <input id="ml-nome" class="tv-campo nav-focusable" data-nav="true" type="text" placeholder="Nome (opcional)" />
      <div id="ml-add" class="tv-btn nav-focusable" data-nav="true">Adicionar lista</div>
      <div id="ml-aviso" class="tv-minhas-aviso"></div>
      <div id="ml-corpo"></div>
      <div class="tv-minhas-titulo tv-minhas-sub">Endereços do Saimo (opcional)</div>
      <div class="tv-minhas-ajuda">Para quem tem uma lista no formato do Saimo: o endereço da lista de canais e o da lista de filmes e séries.</div>
      <input id="ml-url-canais" class="tv-campo nav-focusable" data-nav="true" type="text" placeholder="Endereço da lista de canais" />
      <input id="ml-url-filmes" class="tv-campo nav-focusable" data-nav="true" type="text" placeholder="Endereço da lista de filmes e séries" />
      <div id="ml-url-salvar" class="tv-btn nav-focusable" data-nav="true">Salvar endereços</div>
    `;
    this.element.querySelector('#ml-url-salvar')!.addEventListener('click', () => this.salvarEnderecos());
    this.corpo = this.element.querySelector('#ml-corpo')!;
    this.aviso = this.element.querySelector('#ml-aviso')!;
    this.element.querySelector('#ml-add')!.addEventListener('click', () => this.adicionar());
    this.element.querySelectorAll<HTMLInputElement>('input').forEach((c) => {
      c.addEventListener('click', () => c.focus());
    });
  }

  getElement(): HTMLElement {
    return this.element;
  }

  enter() {
    this.element.classList.remove('hidden');
    this.aviso.textContent = '';
    this.element.querySelector<HTMLInputElement>('#ml-url-canais')!.value = Api.enderecoSaimo('canais');
    this.element.querySelector<HTMLInputElement>('#ml-url-filmes')!.value = Api.enderecoSaimo('filmes');
    this.desenhar();
    SpatialNav.focus(this.element.querySelector<HTMLElement>('#ml-link'));
  }

  leave() {
    this.element.classList.add('hidden');
  }

  private async fazer(msg: string, acao: () => Promise<void> | void) {
    this.aviso.textContent = msg;
    try {
      await acao();
      this.aviso.textContent = '';
      State.channels = await Api.fetchChannels(true);
    } catch (e: any) {
      this.aviso.textContent = e.message || 'Não consegui baixar essa lista';
    }
    this.desenhar();
  }

  /** Os dois endereços no formato do Saimo (em branco = lista desligada). */
  private salvarEnderecos() {
    const c = this.element.querySelector<HTMLInputElement>('#ml-url-canais')!.value.trim();
    const f = this.element.querySelector<HTMLInputElement>('#ml-url-filmes')!.value.trim();
    const nc = c ? normalizarEndereco(c) : '';
    const nf = f ? normalizarEndereco(f) : '';
    if ((c && !nc) || (f && !nf)) { this.aviso.textContent = 'Esse endereço não parece válido'; return; }
    Storage.savePrefs({ urlCanais: nc || '', urlFilmes: nf || '' });
    this.aviso.textContent = 'Endereços salvos. Recarregando…';
    // Recarrega: todas as telas leem a lista de novo, sem restos da anterior.
    window.setTimeout(() => window.location.reload(), 600);
  }

  private adicionar() {
    const link = this.element.querySelector<HTMLInputElement>('#ml-link')!;
    const nome = this.element.querySelector<HTMLInputElement>('#ml-nome')!;
    const usuario = this.element.querySelector<HTMLInputElement>('#ml-usuario')!;
    const senha = this.element.querySelector<HTMLInputElement>('#ml-senha')!;
    // Com usuário e senha, o campo de cima é o servidor; sem eles, é o link da lista.
    const f = linkDoFormulario(link.value, usuario.value, senha.value);
    if ('erro' in f) { this.aviso.textContent = f.erro; return; }
    this.fazer('Baixando a lista...', async () => {
      await MinhasListas.adicionar(f.link, nome.value);
      link.value = '';
      nome.value = '';
      usuario.value = '';
      senha.value = '';
    });
  }

  private desenhar() {
    this.corpo.innerHTML = '';
    MinhasListas.listas().forEach((l) => {
      const horas = Math.floor((Date.now() - l.atualizadaEm) / 3600000);
      const quando = horas < 1 ? 'atualizada agora' : horas < 24 ? `atualizada há ${horas} h` : `atualizada há ${Math.floor(horas / 24)} d`;
      const linha = document.createElement('div');
      linha.className = 'tv-minha-lista';
      linha.innerHTML = `<div class="t"><b>${l.nome.replace(/</g, '&lt;')}</b><span>${l.total} canais  ·  ${quando}${l.ativa ? '' : '  ·  desativada'}</span></div>`;
      const botao = (texto: string, f: () => void) => {
        const b = document.createElement('div');
        b.className = 'tv-btn nav-focusable';
        b.setAttribute('data-nav', 'true');
        b.textContent = texto;
        b.addEventListener('click', f);
        linha.appendChild(b);
      };
      botao('Atualizar', () => this.fazer('Atualizando a lista...', () => MinhasListas.atualizar(l.id)));
      botao(l.ativa ? 'Desativar' : 'Ativar', () => this.fazer('', () => MinhasListas.alternar(l.id)));
      let confirmar = false;
      botao('Remover', () => {
        if (confirmar) this.fazer('', () => MinhasListas.remover(l.id));
        else { confirmar = true; this.aviso.textContent = `Aperte OK de novo para remover ${l.nome}`; }
      });
      this.corpo.appendChild(linha);
    });
  }
}
