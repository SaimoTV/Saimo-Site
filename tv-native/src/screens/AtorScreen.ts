/**
 * Uma pessoa do elenco: foto, quem é e as capas de tudo o que dá para assistir
 * com ela neste acervo (igual ao AtorActivity do TV Box). O cruzamento é pelo
 * id do TMDB, com o nome do título como segunda chance.
 */
import { State } from '../core/State';
import { Api, VODItem } from '../core/Api';
import { Rail, CardModel } from '../components/Rail';
import { SpatialNav } from '../core/SpatialNav';

function esc(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export class AtorScreen {
  private element: HTMLElement;
  private conteudo: HTMLElement;
  private cabeca: HTMLElement;
  private estado: HTMLElement;
  private rail: Rail;
  private atual = 0;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-ator-screen hidden';
    this.element.id = 'screen-ator';

    this.conteudo = document.createElement('div');
    this.conteudo.className = 'tv-ator-content tv-scroll-v';

    this.cabeca = document.createElement('div');
    this.cabeca.className = 'tv-ator-top';
    this.conteudo.appendChild(this.cabeca);

    this.estado = document.createElement('div');
    this.estado.className = 'tv-ator-estado';
    this.conteudo.appendChild(this.estado);

    this.rail = new Rail('No acervo', false);
    this.rail.getElement().style.display = 'none';
    this.conteudo.appendChild(this.rail.getElement());

    this.element.appendChild(this.conteudo);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  async enter() {
    this.element.classList.remove('hidden');
    const ator = State.currentAtor;
    if (!ator) { State.setScreen('home'); return; }
    const minha = ++this.atual;
    this.conteudo.scrollTop = 0;
    this.rail.getElement().style.display = 'none';
    this.rail.setCards([]);
    this.estado.textContent = 'Procurando no acervo…';
    this.cabeca.innerHTML = `
      <div class="tv-ator-foto">${ator.foto ? `<img src="${esc(ator.foto)}" alt="" />` : esc(ator.nome.charAt(0).toUpperCase())}</div>
      <div class="tv-ator-info">
        <div class="tv-ator-nome">${esc(ator.nome)}</div>
        <div class="tv-ator-dados"></div>
        <div class="tv-ator-bio"></div>
      </div>`;

    const perfil = await Api.fetchTMDBPessoa(ator.id);
    if (minha !== this.atual) return;
    if (perfil) {
      const foto = this.cabeca.querySelector<HTMLElement>('.tv-ator-foto')!;
      if (perfil.foto) foto.innerHTML = `<img src="${esc(perfil.foto)}" alt="" />`;
      if (perfil.nome) this.cabeca.querySelector('.tv-ator-nome')!.textContent = perfil.nome;
      this.cabeca.querySelector('.tv-ator-dados')!.textContent = perfil.dados.join('   ·   ');
      this.cabeca.querySelector('.tv-ator-bio')!.textContent = perfil.biografia;
    }

    const acervo = await Api.fetchFichas().catch(() => [] as VODItem[]);
    if (minha !== this.atual) return;
    const porId = new Map<string, VODItem>();
    const porTitulo = new Map<string, VODItem>();
    for (const v of acervo) {
      if (v.tmdbId) porId.set(`${v.isSeries ? 's' : 'f'}${v.tmdbId}`, v);
      porTitulo.set(`${v.isSeries ? 's' : 'f'}${semAcento(v.title)}`, v);
    }
    const achados: { v: VODItem; papel: string }[] = [];
    const vistos = new Set<string>();
    for (const c of perfil?.creditos || []) {
      const v = porId.get(`${c.serie ? 's' : 'f'}${c.tmdbId}`) || porTitulo.get(`${c.serie ? 's' : 'f'}${semAcento(c.titulo)}`);
      if (!v || vistos.has(v.id)) continue;
      vistos.add(v.id);
      achados.push({ v, papel: c.papel });
    }
    if (achados.length === 0) {
      this.estado.textContent = 'Nenhum título desta pessoa no seu acervo.';
      return;
    }
    this.estado.textContent = '';
    this.rail.getElement().style.display = 'block';
    const cards: CardModel[] = achados.map(({ v, papel }) => ({
      id: `ator_${v.id}`,
      title: v.title,
      subtitle: papel || (v.isSeries ? 'Série' : 'Filme'),
      image: v.poster,
      badge: v.year || (v.isSeries ? 'SÉRIE' : '4K'),
      badgeColor: v.isSeries ? '#7aa2ff' : '#4fe3d0',
      onClick: () => State.setScreen('ficha', { vod: v }),
    }));
    this.rail.setCards(cards);
    setTimeout(() => {
      SpatialNav.focus(this.rail.getElement().querySelector<HTMLElement>('[data-nav="true"]'));
      this.conteudo.scrollTop = 0; // o nome e a biografia ficam à vista
    }, 30);
  }

  leave() {
    this.atual++;
    this.element.classList.add('hidden');
  }
}
