/**
 * Painel "Canais" da TV Box: seções em pílulas, lista à esquerda e prévia do
 * vídeo à direita. A lista desenha só as linhas visíveis: com centenas de canais,
 * um elemento por canal travava a TV.
 */

import { Channel, Api } from '../core/Api';
import { SpatialNav } from '../core/SpatialNav';
import { Storage } from '../core/Storage';
import { State } from '../core/State';

const LINHAS = 3;
const ORDEM = ['TV Aberta', 'Filmes e Séries', 'Esportes', 'Notícias', 'Infantil', 'Documentários', 'Pluto TV', '24 Horas', 'Variedades'];

function hora(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export class ChannelDrawer {
  private element: HTMLElement;
  private chipsEl: HTMLElement;
  private listaEl: HTMLElement;
  private contaEl: HTMLElement;
  private totalEl: HTMLElement;
  private infoEl: HTMLElement;
  private todos: Channel[] = [];
  private filtrados: Channel[] = [];
  private secoes: string[] = [];
  private secao = 0;
  private foco = 0;
  private topo = 0;
  private area: 'lista' | 'chips' = 'lista';
  private escolhendo = false;

  constructor(
    private onSelectChannel: (channel: Channel) => void,
    private onOpenChannelSources?: (channel: Channel) => void,
    private onSubir?: () => void,
    private onMulti?: () => void
  ) {
    this.element = document.createElement('div');
    this.element.className = 'tv-painel-canais hidden';
    this.element.id = 'tv-channel-drawer';
    this.element.innerHTML = `
      <div class="tv-painel-fundo a"></div><div class="tv-painel-fundo b"></div><div class="tv-painel-fundo c"></div>
      <div class="tv-painel-titulo">Canais</div>
      <div class="tv-painel-conta"><b id="pc-conta"></b><span id="pc-total"></span></div>
      <div class="tv-painel-chips"><div id="pc-chips"></div></div>
      <div class="tv-painel-lista" id="pc-lista"></div>
      <div class="tv-painel-dica">OK assiste  ·  esquerda: seções  ·  direita: fontes  ·  vermelha: favorita  ·  verde: guia</div>
      <div class="tv-painel-info" id="pc-info"></div>
    `;
    this.chipsEl = this.element.querySelector('#pc-chips')!;
    this.listaEl = this.element.querySelector('#pc-lista')!;
    this.contaEl = this.element.querySelector('#pc-conta')!;
    this.totalEl = this.element.querySelector('#pc-total')!;
    this.infoEl = this.element.querySelector('#pc-info')!;
    window.addEventListener('keydown', (e) => this.teclas(e), true);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  open(channels: Channel[], atual: Channel | null) {
    this.todos = channels;
    const vistas = new Set(channels.map((c) => c.category || 'Outros'));
    this.secoes = ORDEM.filter((s) => vistas.has(s));
    vistas.forEach((s) => { if (!this.secoes.includes(s)) this.secoes.push(s); });
    if (Storage.getFavoriteChannels().size > 0) this.secoes.unshift('Favoritos');
    if (!this.escolhendo) this.secoes.push('Multi tela');

    const i = atual ? this.secoes.indexOf(atual.category) : -1;
    this.secao = i >= 0 ? i : 0;
    this.area = 'lista';
    this.filtrar();
    if (atual) {
      const p = this.filtrados.findIndex((c) => c.id === atual.id);
      if (p >= 0) this.foco = p;
    }
    this.element.classList.remove('hidden');
    SpatialNav.pausado = true;
    this.desenhar();
  }

  close() {
    this.element.classList.add('hidden');
    SpatialNav.pausado = false;
    this.escolhendo = false;
    this.element.querySelector('.tv-painel-titulo')!.textContent = 'Canais';
  }

  /** Multi tela: a mesma lista, agora para escolher a segunda tela. */
  escolherSegunda(channels: Channel[], atual: Channel | null) {
    this.escolhendo = true;
    this.element.querySelector('.tv-painel-titulo')!.textContent = 'Segunda tela';
    this.element.classList.add('hidden');
    this.open(channels, atual);
  }

  estaEscolhendo(): boolean {
    return this.escolhendo;
  }

  isOpen(): boolean {
    return !this.element.classList.contains('hidden');
  }

  private filtrar() {
    const nome = this.secoes[this.secao];
    const favs = Storage.getFavoriteChannels();
    this.filtrados = this.todos.filter((c) => (nome === 'Favoritos' ? favs.has(c.name) : (c.category || 'Outros') === nome));
    this.foco = 0;
    this.topo = 0;
  }

  private desenhar() {
    this.contaEl.textContent = String(this.filtrados.length);
    this.totalEl.textContent = String(this.todos.length);

    let html = '';
    this.secoes.forEach((s, i) => {
      const classe = i !== this.secao ? '' : this.area === 'chips' ? 'foco' : 'atual';
      html += `<span id="pc-chip-${i}" class="tv-chip ${classe}">${s}</span>`;
    });
    this.chipsEl.innerHTML = html;
    const chip = this.chipsEl.querySelector<HTMLElement>(`#pc-chip-${this.secao}`);
    const fim = chip ? chip.offsetLeft + chip.offsetWidth : 0;
    this.chipsEl.style.transform = `translateX(${Math.min(0, 760 - fim)}px)`;

    if (this.foco < this.topo) this.topo = this.foco;
    if (this.foco >= this.topo + LINHAS) this.topo = this.foco - LINHAS + 1;
    this.listaEl.innerHTML = this.filtrados.slice(this.topo, this.topo + LINHAS).map((c, i) => {
      const focado = this.area === 'lista' && this.topo + i === this.foco;
      const epg = Api.getNowNext(c.name).current;
      return `<div class="tv-canal ${focado ? 'foco' : ''}">
        <span class="n">${c.number}</span>
        <span class="l">${c.logo ? `<img src="${c.logo}" alt="" onerror="this.style.display='none'" />` : ''}</span>
        <span class="t">
          ${focado ? `<i>${(c.category || '').toUpperCase()}</i>` : ''}
          <b>${c.name}</b>
          ${epg ? `<em>${epg.title}</em><u><s style="width:${Math.round(epg.progress * 100)}%"></s></u>` : ''}
        </span>
      </div>`;
    }).join('');
    this.mostrarInfo();
  }

  private mostrarInfo() {
    const c = this.filtrados[this.foco];
    if (!c) { this.infoEl.innerHTML = ''; return; }
    const { current, next } = Api.getNowNext(c.name);
    this.infoEl.innerHTML = `<div class="c">${c.number}  ${c.name}</div>
      <div class="p">${current ? current.title : 'Ao vivo'}</div>
      ${current ? `<div class="h">${hora(current.start)} – ${hora(current.stop)}  ·  faltam ${current.remainingMin} min</div>` : ''}
      ${next ? `<div class="h">A seguir: ${next.title}</div>` : ''}`;
  }

  private teclas(e: KeyboardEvent) {
    if (!this.isOpen() || !SpatialNav.pausado) return;
    const k = e.keyCode;
    if (SpatialNav.noMenu()) {
      if (k !== 40) return;
      SpatialNav.limpar();
      this.area = 'lista';
      e.preventDefault();
      e.stopImmediatePropagation();
      this.desenhar();
      return;
    }
    // Vermelha ou Menu: favorita o canal em foco.
    if (k === 403 || k === 10182 || k === 82) {
      const c = this.filtrados[this.foco];
      if (c) Storage.toggleFavoriteChannel(c.name);
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    // Verde (ou GUIDE): o guia de programação completo.
    if (k === 404 || k === 458) {
      e.preventDefault();
      e.stopImmediatePropagation();
      State.setScreen('guide');
      return;
    }
    if (![37, 38, 39, 40, 13].includes(k)) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    if (this.area === 'chips') {
      if (k === 37 && this.secao > 0) this.secao--;
      else if (k === 39 && this.secao < this.secoes.length - 1) this.secao++;
      else if (k === 13 && this.secoes[this.secao] === 'Multi tela') { this.onMulti?.(); return; }
      else if (k === 40 || k === 13) this.area = 'lista';
      else if (k === 38) { this.onSubir?.(); return; }
      else return;
      if (k === 37 || k === 39) this.filtrar();
    } else {
      if (k === 40 && this.foco < this.filtrados.length - 1) this.foco++;
      else if (k === 38 && this.foco > 0) this.foco--;
      else if (k === 37 || k === 38) this.area = 'chips';
      else if (k === 39) { const c = this.filtrados[this.foco]; if (c) this.onOpenChannelSources?.(c); return; }
      else if (k === 13) { const c = this.filtrados[this.foco]; if (c) this.onSelectChannel(c); return; }
      else return;
    }
    this.desenhar();
  }
}
