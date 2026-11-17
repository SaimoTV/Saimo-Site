/**
 * Perfis na Samsung e na LG: "Quem está assistindo?", gerenciar e editar.
 * A lógica é a mesma do site (src/perfis/perfis.ts); aqui só a tela, no jeito
 * do controle remoto.
 */

import { SpatialNav } from '../core/SpatialNav';
import { State } from '../core/State';
import {
  AVATARES, MAX_NOME, MAX_PERFIS, PRINCIPAL, apagar, ativo, avatarUrl, conferirCodigo, criar, editar, entrar, idAtivo,
  marcarEscolhido, pedeCodigo, perfis, perguntarAoAbrir, definirPerguntar, type Perfil,
} from '../../../src/perfis/perfis';

type Modo = 'escolher' | 'gerenciar' | 'editar';

function esc(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function avatarHtml(p: Pick<Perfil, 'nome' | 'avatar'>, classe = ''): string {
  const url = avatarUrl(p.avatar);
  return url
    ? `<span class="tv-perfil-avatar ${classe}"><img src="${url}" alt="" /></span>`
    : `<span class="tv-perfil-avatar ${classe}"><b>${esc((p.nome.trim()[0] || '?').toUpperCase())}</b></span>`;
}

export class PerfisScreen {
  private element: HTMLElement;
  private modo: Modo = 'escolher';
  private editando: Perfil | null = null;
  private avatar = AVATARES[0] as string;
  private confirmarApagar = false;
  /** Código do Kids ativo já digitado nesta visita (gerenciar e editar). */
  private destrancado = false;
  private pedindo = false;
  private kids = false;
  /** Aberta na partida: VOLTAR não sai sem escolher. */
  obrigatoria = false;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-perfis tv-screen-scroll tv-scroll-v hidden';
    this.element.id = 'screen-perfis';
    State.on('perfis-voltar', () => this.voltar());
  }

  getElement(): HTMLElement {
    return this.element;
  }

  abrir(modo: 'escolher' | 'gerenciar') {
    this.modo = modo;
    if (State.currentScreen === 'perfis') this.desenhar();
    else State.setScreen('perfis');
  }

  enter() {
    this.element.classList.remove('hidden');
    this.desenhar();
  }

  leave() {
    this.element.classList.add('hidden');
    this.modo = 'escolher';
    this.obrigatoria = false;
    this.destrancado = false;
    this.pedindo = false;
  }

  /** Pede o código do perfil Kids `p` e, certo, roda `ok`. */
  private pedir(p: Perfil, motivo: string, ok: () => void) {
    if (!pedeCodigo(p) || (this.destrancado && p.id === idAtivo())) { ok(); return; }
    this.pedindo = true;
    this.element.innerHTML = '';
    this.element.appendChild(caixaDeCodigo({
      titulo: `Código do perfil ${p.nome}`,
      motivo,
      campos: ['••••'],
      aoConfirmar: (v) => {
        if (!conferirCodigo(p, v[0])) return 'Código errado. Tente de novo.';
        this.pedindo = false;
        if (p.id === idAtivo()) this.destrancado = true;
        ok();
        return null;
      },
      aoCancelar: () => { this.pedindo = false; this.desenhar(); },
    }));
  }

  /** VOLTAR do controle (o main.ts manda para cá). */
  private voltar() {
    if (this.pedindo) { this.pedindo = false; this.desenhar(); return; }
    if (this.modo === 'editar') { this.modo = 'gerenciar'; this.desenhar(); return; }
    if (this.modo === 'gerenciar') { this.modo = 'escolher'; this.desenhar(); return; }
    if (!this.obrigatoria) State.setScreen(State.previousScreen === 'perfis' ? 'home' : State.previousScreen);
  }

  private desenhar() {
    if (this.modo === 'editar') { this.desenharEdicao(); return; }
    const lista = perfis();
    const atual = idAtivo();
    const gerenciar = this.modo === 'gerenciar';
    const itens = lista.map((p) => `
      <div class="tv-perfil nav-focusable ${p.id === atual ? 'atual' : ''} ${gerenciar ? 'editando' : ''}" data-nav="true" data-id="${p.id}">
        <div class="tv-perfil-moldura">${avatarHtml(p)}${p.kids ? '<span class="tv-perfil-kids">KIDS</span>' : ''}${gerenciar ? '<span class="tv-perfil-lapis"></span>' : ''}</div>
        <div class="tv-perfil-nome">${esc(p.nome)}</div>
      </div>`).join('');
    const novo = lista.length < MAX_PERFIS ? `
      <div class="tv-perfil nav-focusable tv-perfil-novo" data-nav="true" data-id="novo">
        <div class="tv-perfil-moldura"><span class="tv-perfil-mais">+</span></div>
        <div class="tv-perfil-nome">Adicionar perfil</div>
      </div>` : '';
    this.element.innerHTML = `
      <div class="tv-perfis-titulo">${gerenciar ? 'Gerenciar perfis' : 'Quem está assistindo?'}</div>
      ${gerenciar ? '<div class="tv-perfis-sub">Escolha um perfil para mudar o nome ou o avatar.</div>' : ''}
      <div class="tv-perfis-grade">${itens}${novo}</div>
      <div class="tv-perfis-acoes">
        ${gerenciar
          ? '<div class="tv-btn nav-focusable" data-nav="true" data-acao="pronto">Pronto</div>'
          : `<div class="tv-btn nav-focusable" data-nav="true" data-acao="gerenciar">Gerenciar perfis</div>
             <div class="tv-btn nav-focusable" data-nav="true" data-acao="perguntar">Ao abrir: ${perguntarAoAbrir() ? 'perguntar o perfil' : 'entrar no último'}</div>`}
      </div>
      <div class="tv-perfis-nota">Cada perfil tem os seus favoritos, o que está assistindo e os recentes. As listas e os ajustes valem para todos. Até ${MAX_PERFIS} perfis.</div>`;

    this.element.querySelectorAll<HTMLElement>('.tv-perfil').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id')!;
        const atualP = ativo();
        if (id === 'novo') {
          this.pedir(atualP, 'Para criar um perfil, digite o código deste perfil Kids.', () => this.editar(null));
          return;
        }
        const p = perfis().find((x) => x.id === id);
        if (!p) return;
        if (gerenciar) { this.pedir(p, `Para editar o perfil ${p.nome}, digite o código dele.`, () => this.editar(p)); return; }
        const ir = () => {
          marcarEscolhido();
          this.obrigatoria = false;
          if (p.id === idAtivo()) State.setScreen('home');
          else entrar(p.id);
        };
        // Sair do Kids para outro perfil pede o código dele.
        if (p.id !== idAtivo()) this.pedir(atualP, `Para sair do perfil ${atualP.nome}, digite o código.`, ir);
        else ir();
      });
    });
    this.element.querySelectorAll<HTMLElement>('[data-acao]').forEach((el) => {
      el.addEventListener('click', () => {
        const a = el.getAttribute('data-acao');
        if (a === 'gerenciar') this.pedir(ativo(), 'Para gerenciar os perfis, digite o código deste perfil Kids.', () => { this.modo = 'gerenciar'; this.desenhar(); });
        else if (a === 'pronto') { this.modo = 'escolher'; this.desenhar(); }
        else if (a === 'perguntar') { definirPerguntar(!perguntarAoAbrir()); this.desenhar(); SpatialNav.focus(this.element.querySelector<HTMLElement>('[data-acao="perguntar"]')); }
      });
    });
    const foco = this.element.querySelector<HTMLElement>(`.tv-perfil[data-id="${atual}"]`) || this.element.querySelector<HTMLElement>('.tv-perfil');
    window.setTimeout(() => SpatialNav.focus(foco), 30);
  }

  private editar(p: Perfil | null) {
    this.editando = p;
    this.avatar = p ? p.avatar : (AVATARES.find((a) => !perfis().some((x) => x.avatar === a)) || AVATARES[0]);
    this.confirmarApagar = false;
    this.kids = p ? p.kids === true : false;
    this.modo = 'editar';
    this.desenhar();
  }

  private desenharEdicao() {
    const p = this.editando;
    const nomeAtual = (this.element.querySelector<HTMLInputElement>('#perfil-nome')?.value) ?? (p ? p.nome : '');
    this.element.innerHTML = `
      <div class="tv-perfis-titulo">${p ? 'Editar perfil' : 'Novo perfil'}</div>
      <div class="tv-perfis-editar-topo">
        <div id="perfil-previa">${avatarHtml({ nome: nomeAtual || '?', avatar: this.avatar }, 'grande')}</div>
        <input id="perfil-nome" class="tv-campo nav-focusable" data-nav="true" type="text" maxlength="${MAX_NOME}" placeholder="Nome do perfil" value="${esc(nomeAtual)}" />
      </div>
      <div class="tv-perfis-sub">Escolha um avatar</div>
      <div class="tv-perfis-avatares">
        ${AVATARES.map((a) => `<div class="tv-perfil-opcao nav-focusable ${a === this.avatar ? 'on' : ''}" data-nav="true" data-avatar="${a}"><img src="${avatarUrl(a)}" alt="" /></div>`).join('')}
      </div>
      ${p?.id === PRINCIPAL ? '' : `
      <div class="tv-perfis-kids nav-focusable" data-nav="true" data-acao="kids">Perfil Kids: ${this.kids ? 'ligado' : 'desligado'}</div>
      ${this.kids ? `<div class="tv-perfis-sub">Só filmes e séries até 12 anos, nada adulto. ${p?.kids ? 'Para trocar o código, preencha os dois campos.' : 'Escolha um código de 4 números para sair do Kids.'}</div>
      <div class="tv-perfis-kids-codigos">
        <input id="perfil-cod1" class="tv-campo nav-focusable" data-nav="true" type="password" inputmode="numeric" maxlength="4" placeholder="Código" />
        <input id="perfil-cod2" class="tv-campo nav-focusable" data-nav="true" type="password" inputmode="numeric" maxlength="4" placeholder="Repita o código" />
      </div>` : ''}`}
      <div class="tv-perfis-acoes">
        <div class="tv-btn nav-focusable" data-nav="true" data-acao="salvar">Salvar</div>
        <div class="tv-btn nav-focusable" data-nav="true" data-acao="cancelar">Cancelar</div>
        ${p && p.id !== PRINCIPAL ? `<div class="tv-btn nav-focusable tv-perfis-perigo" data-nav="true" data-acao="apagar">${this.confirmarApagar ? 'Apagar mesmo (favoritos e progresso somem)' : 'Apagar perfil'}</div>` : ''}
      </div>
      <div class="tv-perfis-aviso" id="perfil-aviso"></div>`;

    const campo = this.element.querySelector<HTMLInputElement>('#perfil-nome')!;
    // OK num campo abre o teclado da TV nele (nome e códigos do Kids).
    this.element.querySelectorAll<HTMLInputElement>('input').forEach((c) => {
      c.addEventListener('click', () => window.setTimeout(() => {
        c.focus();
        try { const n = c.value.length; c.setSelectionRange(n, n); } catch (e) { /* sem seleção */ }
      }, 30));
    });
    this.element.querySelectorAll<HTMLElement>('.tv-perfil-opcao').forEach((el) => {
      el.addEventListener('click', () => {
        this.avatar = el.getAttribute('data-avatar')!;
        this.element.querySelectorAll('.tv-perfil-opcao').forEach((o) => o.classList.toggle('on', o === el));
        this.element.querySelector('#perfil-previa')!.innerHTML = avatarHtml({ nome: campo.value || '?', avatar: this.avatar }, 'grande');
      });
    });
    this.element.querySelectorAll<HTMLElement>('[data-acao]').forEach((el) => {
      el.addEventListener('click', () => {
        const a = el.getAttribute('data-acao');
        if (a === 'cancelar') { this.modo = 'gerenciar'; this.desenhar(); return; }
        if (a === 'kids') {
          this.kids = !this.kids;
          this.desenharEdicao();
          SpatialNav.focus(this.element.querySelector<HTMLElement>('[data-acao="kids"]'));
          return;
        }
        if (a === 'apagar' && p) {
          if (!this.confirmarApagar) {
            this.confirmarApagar = true;
            this.desenharEdicao();
            SpatialNav.focus(this.element.querySelector<HTMLElement>('[data-acao="apagar"]'));
            return;
          }
          apagar(p.id);
          this.modo = 'gerenciar';
          this.desenhar();
          return;
        }
        if (a === 'salvar') {
          const nome = campo.value.trim();
          if (!nome) {
            this.element.querySelector('#perfil-aviso')!.textContent = 'Escreva um nome para o perfil.';
            SpatialNav.focus(campo);
            return;
          }
          let kidsArg: { codigo: string } | null | undefined;
          if (this.kids) {
            const c1 = (this.element.querySelector<HTMLInputElement>('#perfil-cod1')?.value || '').trim();
            const c2 = (this.element.querySelector<HTMLInputElement>('#perfil-cod2')?.value || '').trim();
            const precisa = !(p?.kids && p.codigo);
            if (c1 || c2 || precisa) {
              if (!/^\d{4}$/.test(c1)) { this.element.querySelector('#perfil-aviso')!.textContent = 'O código do Kids tem 4 números.'; return; }
              if (c1 !== c2) { this.element.querySelector('#perfil-aviso')!.textContent = 'Os dois códigos não são iguais.'; return; }
              kidsArg = { codigo: c1 };
            }
          } else if (p?.kids) kidsArg = null;
          if (p) editar(p.id, nome, this.avatar, kidsArg);
          else criar(nome, this.avatar, kidsArg ?? undefined);
          this.modo = 'gerenciar';
          this.desenhar();
        }
      });
    });
    window.setTimeout(() => SpatialNav.focus(p ? this.element.querySelector<HTMLElement>(`.tv-perfil-opcao.on`) : campo), 30);
  }
}

/**
 * Caixa de código pelo controle: título, explicação e um ou dois campos de 4
 * números. `aoConfirmar` devolve a mensagem de erro, ou null quando deu certo.
 * Serve ao Kids (sair, editar, Ajustes) e ao controle parental.
 */
export function caixaDeCodigo(opts: {
  titulo: string;
  motivo: string;
  campos: string[];
  aoConfirmar: (valores: string[]) => string | null;
  aoCancelar: () => void;
}): HTMLElement {
  const caixa = document.createElement('div');
  caixa.className = 'tv-codigo';
  caixa.innerHTML = `
    <div class="tv-perfis-titulo">${esc(opts.titulo)}</div>
    <div class="tv-perfis-sub">${esc(opts.motivo)}</div>
    ${opts.campos.map((c, i) => `<input class="tv-campo tv-codigo-campo nav-focusable" data-nav="true" data-i="${i}" type="password" inputmode="numeric" maxlength="4" placeholder="${esc(c)}" />`).join('')}
    <div class="tv-perfis-aviso"></div>
    <div class="tv-perfis-acoes">
      <div class="tv-btn nav-focusable" data-nav="true" data-acao="ok">Confirmar</div>
      <div class="tv-btn nav-focusable" data-nav="true" data-acao="cancelar">Cancelar</div>
    </div>`;
  const campos = Array.from(caixa.querySelectorAll<HTMLInputElement>('input'));
  const aviso = caixa.querySelector<HTMLElement>('.tv-perfis-aviso')!;
  const confirmar = () => {
    const erro = opts.aoConfirmar(campos.map((c) => c.value.replace(/\D/g, '').slice(0, 4)));
    if (erro) { aviso.textContent = erro; campos.forEach((c) => { c.value = ''; }); SpatialNav.focus(campos[0]); }
  };
  campos.forEach((c) => {
    c.addEventListener('click', () => window.setTimeout(() => c.focus(), 30));
    c.addEventListener('input', () => {
      c.value = c.value.replace(/\D/g, '').slice(0, 4);
      aviso.textContent = '';
      if (c.value.length === 4 && c === campos[campos.length - 1]) confirmar();
    });
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmar(); });
  });
  caixa.querySelector('[data-acao="ok"]')!.addEventListener('click', confirmar);
  caixa.querySelector('[data-acao="cancelar"]')!.addEventListener('click', () => opts.aoCancelar());
  window.setTimeout(() => SpatialNav.focus(campos[0]), 40);
  return caixa;
}
