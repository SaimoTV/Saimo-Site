/**
 * Tela On Demand (OnDemandScreen) - Desempenho Instantâneo 0ms.
 * Catálogo categorizado de Filmes, Séries, Animes e Doramas com filtragem instantânea
 * e resposta imediata ao controle remoto.
 */

import { State } from '../core/State';
import { Api, VODItem, DestaqueFila } from '../core/Api';
import { HeroBanner } from '../components/HeroBanner';
import { Rail, CardModel } from '../components/Rail';
import { SpatialNav } from '../core/SpatialNav';
import { Escolha, OpcaoEscolha } from '../components/Escolha';
import { icone } from '../components/Icones';

export type CategoryFilter = 'todos' | 'filmes' | 'series' | 'animes' | 'doramas';

type Ordem = 'destaques' | 'novos' | 'az' | 'melhores' | 'populares';

/** Filtros do On Demand, como nos grandes serviços: gênero, ano, idade, nota e ordem. */
interface Filtros {
  genero: string;
  anos: [number, number] | null;
  rotuloAnos: string;
  idade: number | null;
  nota: number;
  ordem: Ordem;
}

const ORDENS: { id: Ordem; rotulo: string }[] = [
  { id: 'destaques', rotulo: 'Destaques' },
  { id: 'novos', rotulo: 'Mais novos' },
  { id: 'populares', rotulo: 'Mais populares' },
  { id: 'melhores', rotulo: 'Mais bem avaliados' },
  { id: 'az', rotulo: 'A–Z' },
];
const POR_FILEIRA = 24;
const MAX_FILEIRAS = 10;

export class OnDemandScreen {
  private element: HTMLElement;
  private scrollContainer: HTMLElement;
  private heroBanner: HeroBanner;
  private filterBar: HTMLElement;
  private railsContainer: HTMLElement;

  private currentFilter: CategoryFilter = 'todos';
  private dynamicRails: Rail[] = [];
  private isLoaded = false;
  private filtrosBar: HTMLElement;
  private escolha = new Escolha();
  private filtros: Filtros = { genero: '', anos: null, rotuloAnos: '', idade: null, nota: 0, ordem: 'destaques' };
  private geracao = 0;

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-ondemand-screen hidden';
    this.element.id = 'screen-ondemand';

    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'tv-screen-scroll tv-scroll-v';

    this.heroBanner = new HeroBanner();
    this.scrollContainer.appendChild(this.heroBanner.getElement());

    // Barra de Categorias Superiores (Pílulas / Chips)
    this.filterBar = document.createElement('div');
    this.filterBar.className = 'tv-category-chips';
    this.filterBar.style.display = 'flex';
    this.filterBar.style.gap = '16px';
    this.filterBar.style.padding = '0 70px 24px';
    this.renderCategoryChips();
    this.scrollContainer.appendChild(this.filterBar);

    // Filtros: gênero, ano, idade, nota e ordem (o acervo inteiro, não só os destaques)
    this.filtrosBar = document.createElement('div');
    this.filtrosBar.className = 'tv-filtros';
    this.scrollContainer.appendChild(this.filtrosBar);
    this.renderFiltros();

    this.railsContainer = document.createElement('div');
    this.railsContainer.className = 'tv-ondemand-rails';
    this.scrollContainer.appendChild(this.railsContainer);

    this.element.appendChild(this.scrollContainer);
    this.element.appendChild(this.escolha.getElement());
  }

  private filtrando(): boolean {
    const f = this.filtros;
    return !!f.genero || !!f.anos || f.idade !== null || f.nota > 0 || f.ordem !== 'destaques';
  }

  private renderFiltros() {
    const f = this.filtros;
    const botoes: { id: string; rotulo: string; ativo: boolean; abrir: () => void }[] = [
      { id: 'genero', rotulo: `Gênero: ${f.genero || 'Todos'}`, ativo: !!f.genero, abrir: () => this.escolherGenero() },
      { id: 'ano', rotulo: `Ano: ${f.rotuloAnos || 'Todos'}`, ativo: !!f.anos, abrir: () => this.escolherAno() },
      { id: 'idade', rotulo: `Idade: ${f.idade === null ? 'Todas' : f.idade === 0 ? 'Livre' : `até ${f.idade} anos`}`, ativo: f.idade !== null, abrir: () => this.escolherIdade() },
      { id: 'nota', rotulo: `Nota: ${f.nota ? `${f.nota} ou mais` : 'Qualquer'}`, ativo: f.nota > 0, abrir: () => this.escolherNota() },
      { id: 'ordem', rotulo: `Ordem: ${ORDENS.find((o) => o.id === f.ordem)!.rotulo}`, ativo: f.ordem !== 'destaques', abrir: () => this.escolherOrdem() },
    ];
    if (this.filtrando()) {
      botoes.push({ id: 'limpar', rotulo: 'Limpar filtros', ativo: false, abrir: () => {
        this.filtros = { genero: '', anos: null, rotuloAnos: '', idade: null, nota: 0, ordem: 'destaques' };
        this.aplicarFiltros('limpar');
      } });
    }
    this.filtrosBar.innerHTML = '';
    for (const b of botoes) {
      const el = document.createElement('div');
      el.className = `tv-filtro nav-focusable ${b.ativo ? 'ativo' : ''}`;
      el.setAttribute('data-nav', 'true');
      el.id = `filtro-${b.id}`;
      el.innerHTML = `<span>${b.rotulo}</span>${b.id === 'limpar' ? '' : icone('expand')}`;
      el.addEventListener('click', b.abrir);
      this.filtrosBar.appendChild(el);
    }
  }

  /** Refaz a tela e devolve o foco ao botão que mudou. */
  private aplicarFiltros(botao: string) {
    this.renderFiltros();
    this.filterAndPopulateRails();
    const alvo = this.filtrosBar.querySelector<HTMLElement>(`#filtro-${botao}`) || this.filtrosBar.querySelector<HTMLElement>('.tv-filtro');
    if (alvo) SpatialNav.focus(alvo);
  }

  private abrirEscolha(titulo: string, botao: string, opcoes: { rotulo: string; marcada: boolean; aplicar: () => void }[]) {
    const lista: OpcaoEscolha[] = opcoes.map((o) => ({
      rotulo: o.rotulo,
      marcada: o.marcada,
      aoEscolher: () => { o.aplicar(); this.aplicarFiltros(botao); },
    }));
    this.escolha.abrir(titulo, lista);
  }

  private async escolherGenero() {
    const todos = await Api.fetchFichas();
    const generos = new Set<string>();
    for (const v of todos) for (const g of v.genres) if (g && !/^\d+$/.test(g)) generos.add(g);
    const lista = [...generos].sort((a, b) => a.localeCompare(b));
    this.abrirEscolha('Gênero', 'genero', [
      { rotulo: 'Todos', marcada: !this.filtros.genero, aplicar: () => { this.filtros.genero = ''; } },
      ...lista.map((g) => ({ rotulo: g, marcada: this.filtros.genero === g, aplicar: () => { this.filtros.genero = g; } })),
    ]);
  }

  private escolherAno() {
    const atual = new Date().getFullYear();
    const faixas: { rotulo: string; anos: [number, number] | null }[] = [{ rotulo: 'Todos', anos: null }];
    for (let a = atual; a >= atual - 2; a--) faixas.push({ rotulo: String(a), anos: [a, a] });
    const decada = Math.floor(atual / 10) * 10;
    if (atual - 3 >= decada) faixas.push({ rotulo: `${decada}–${atual - 3}`, anos: [decada, atual - 3] });
    for (let d = decada - 10; d >= 1990; d -= 10) faixas.push({ rotulo: `Anos ${d}`, anos: [d, d + 9] });
    faixas.push({ rotulo: 'Antes de 1990', anos: [1, 1989] });
    this.abrirEscolha('Ano', 'ano', faixas.map((f) => ({
      rotulo: f.rotulo,
      marcada: f.anos === null ? !this.filtros.anos : !!this.filtros.anos && this.filtros.anos[0] === f.anos[0] && this.filtros.anos[1] === f.anos[1],
      aplicar: () => { this.filtros.anos = f.anos; this.filtros.rotuloAnos = f.anos ? f.rotulo : ''; },
    })));
  }

  private escolherIdade() {
    const opcoes: { rotulo: string; idade: number | null }[] = [
      { rotulo: 'Todas', idade: null }, { rotulo: 'Livre', idade: 0 },
      ...[10, 12, 14, 16].map((i) => ({ rotulo: `Até ${i} anos`, idade: i })),
    ];
    this.abrirEscolha('Classificação indicativa', 'idade', opcoes.map((o) => ({
      rotulo: o.rotulo, marcada: this.filtros.idade === o.idade, aplicar: () => { this.filtros.idade = o.idade; },
    })));
  }

  private escolherNota() {
    this.abrirEscolha('Nota mínima', 'nota', [0, 6, 7, 8].map((n) => ({
      rotulo: n ? `${n} ou mais` : 'Qualquer', marcada: this.filtros.nota === n, aplicar: () => { this.filtros.nota = n; },
    })));
  }

  private escolherOrdem() {
    this.abrirEscolha('Ordem', 'ordem', ORDENS.map((o) => ({
      rotulo: o.rotulo, marcada: this.filtros.ordem === o.id, aplicar: () => { this.filtros.ordem = o.id; },
    })));
  }

  /** Com filtro ativo: o acervo inteiro filtrado, em fileiras de até 24 títulos. */
  private async mostrarResultados() {
    const geracao = ++this.geracao;
    this.railsContainer.innerHTML = '<div class="tv-filtro-aviso">Procurando no acervo…</div>';
    this.dynamicRails = [];
    const [todos] = await Promise.all([Api.fetchFichas(), Api.fetchDetalhes()]);
    if (geracao !== this.geracao) return;
    const f = this.filtros;
    const cat = this.currentFilter;
    let base = todos.length > 0 ? todos : Api.getDestaquesFlat();
    if (cat === 'filmes') base = base.filter((v) => !v.isSeries);
    else if (cat === 'series') base = base.filter((v) => v.isSeries);
    else if (cat === 'animes') base = base.filter((v) => v.isSeries && v.genres.includes('Animação'));
    else if (cat === 'doramas') {
      const nomes = new Set(Api.getCachedDestaquesSync().filter((x) => x.titulo.toLowerCase().includes('dorama'))
        .flatMap((x) => x.itens.map((i) => i.title)));
      base = base.filter((v) => nomes.has(v.title));
    }
    const anoDe = (v: VODItem) => Api.detalheDe(v)?.ano || parseInt((v.title.match(/\((\d{4})\)\s*$/) || [])[1] || v.year || '0', 10) || 0;
    let lista = base.filter((v) => {
      if (!v.poster) return false;
      if (f.genero && !v.genres.includes(f.genero)) return false;
      const d = Api.detalheDe(v);
      if (f.anos) { const a = anoDe(v); if (a < f.anos[0] || a > f.anos[1]) return false; }
      if (f.idade !== null && !(d && d.idade >= 0 && d.idade <= f.idade)) return false;
      if (f.nota > 0 && !(d && d.nota >= f.nota)) return false;
      return true;
    });
    const nome = (v: VODItem) => v.title.toLowerCase();
    if (f.ordem === 'az') lista.sort((a, b) => nome(a).localeCompare(nome(b)));
    else if (f.ordem === 'melhores') lista.sort((a, b) => (Api.detalheDe(b)?.nota || 0) - (Api.detalheDe(a)?.nota || 0));
    else if (f.ordem === 'novos') lista.sort((a, b) => anoDe(b) - anoDe(a));
    else lista.sort((a, b) => (Api.detalheDe(b)?.popularidade || 0) - (Api.detalheDe(a)?.popularidade || 0));

    // O mesmo título cadastrado duas vezes (com e sem o ano no nome) aparece uma vez só.
    const vistos = new Set<string>();
    lista = lista.filter((v) => {
      const chave = `${v.isSeries ? 's' : 'f'}|${v.tmdbId || v.title.replace(/\s*\(\d{4}\)\s*$/, '').toLowerCase()}`;
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    });

    this.railsContainer.innerHTML = '';
    if (lista.length === 0) {
      this.railsContainer.innerHTML = '<div class="tv-filtro-aviso">Nenhum título com esses filtros. Tente afrouxar algum deles.</div>';
      return;
    }
    const total = lista.length;
    lista = lista.slice(0, POR_FILEIRA * MAX_FILEIRAS);
    for (let i = 0; i < lista.length; i += POR_FILEIRA) {
      const titulo = i === 0 ? `Resultados · ${total.toLocaleString('pt-BR')} títulos` : 'Mais resultados';
      const rail = new Rail(titulo, false);
      rail.setCards(this.mapCards(lista.slice(i, i + POR_FILEIRA)));
      this.railsContainer.appendChild(rail.getElement());
      this.dynamicRails.push(rail);
    }
  }

  getElement(): HTMLElement {
    return this.element;
  }

  private renderCategoryChips() {
    this.filterBar.innerHTML = '';

    const chips: { id: CategoryFilter; label: string; color: string }[] = [
      { id: 'todos', label: 'Todos os Conteúdos', color: '#00e3ff' },
      { id: 'filmes', label: 'Filmes', color: '#4FE3D0' },
      { id: 'series', label: 'Séries', color: '#7AA2FF' },
      { id: 'animes', label: 'Animes', color: '#FFB454' },
      { id: 'doramas', label: 'Doramas', color: '#FF7EB6' },
    ];

    chips.forEach((c) => {
      const chip = document.createElement('div');
      chip.className = `tv-btn nav-focusable ${this.currentFilter === c.id ? 'primary' : ''}`;
      chip.setAttribute('data-nav', 'true');
      chip.id = `chip-${c.id}`;
      chip.textContent = c.label;
      if (this.currentFilter === c.id) {
        chip.style.backgroundColor = c.color;
        chip.style.color = '#070709';
      }

      chip.addEventListener('click', () => {
        if (this.currentFilter === c.id) return;
        this.currentFilter = c.id;
        this.renderCategoryChips();
        this.filterAndPopulateRails();
        const activeChip = this.filterBar.querySelector<HTMLElement>(`#chip-${c.id}`);
        if (activeChip) SpatialNav.focus(activeChip);
      });

      this.filterBar.appendChild(chip);
    });
  }

  enter() {
    this.element.classList.remove('hidden');
    this.heroBanner.setDefault(
      'On Demand',
      'Filmes · Séries · Animes · Doramas',
      'Explore milhares de títulos sob demanda catalogados por categoria e gênero com zero delay.'
    );

    // 1. Popula trilhos instantaneamente com cache local (<1ms)
    this.filterAndPopulateRails();

    // 2. Foca no chip da categoria ativa imediatamente
    const activeChip = this.filterBar.querySelector<HTMLElement>(`#chip-${this.currentFilter}`) ||
                       this.filterBar.querySelector<HTMLElement>('.tv-btn');
    if (activeChip) {
      SpatialNav.focus(activeChip);
    }

    // 3. Atualização não bloqueante em background se necessário
    if (!this.isLoaded) {
      this.isLoaded = true;
      Api.fetchDestaques().then((destaques) => {
        if (destaques && destaques.length > 0) {
          this.filterAndPopulateRails();
        }
      }).catch(() => {});
    }
  }

  leave() {
    this.element.classList.add('hidden');
  }

  private filterAndPopulateRails() {
    if (this.filtrando()) {
      this.mostrarResultados();
      return;
    }
    this.geracao++;
    const allFilas = Api.getCachedDestaquesSync();
    if (allFilas.length === 0) return;

    // Filtra as fileiras correspondentes à categoria atual
    let matchingFilas: DestaqueFila[] = [];

    if (this.currentFilter === 'todos') {
      matchingFilas = allFilas;
    } else if (this.currentFilter === 'filmes') {
      matchingFilas = allFilas.filter((f) => {
        const t = f.titulo.toLowerCase();
        return !t.includes('série') && !t.includes('anime') && !t.includes('dorama');
      });
    } else if (this.currentFilter === 'series') {
      matchingFilas = allFilas.filter((f) => {
        const t = f.titulo.toLowerCase();
        return t.includes('série');
      });
    } else if (this.currentFilter === 'animes') {
      matchingFilas = allFilas.filter((f) => f.titulo.toLowerCase().includes('anime'));
    } else if (this.currentFilter === 'doramas') {
      matchingFilas = allFilas.filter((f) => f.titulo.toLowerCase().includes('dorama'));
    }

    // Limpa os trilhos existentes do contêiner
    this.railsContainer.innerHTML = '';
    this.dynamicRails = [];

    // Cria os trilhos dinâmicos
    matchingFilas.forEach((f) => {
      if (f.itens.length === 0) return;
      const rail = new Rail(f.titulo, false);
      rail.setCards(this.mapCards(f.itens));
      this.railsContainer.appendChild(rail.getElement());
      this.dynamicRails.push(rail);
    });

    // Trilho A-Z rápido e sem travamento de CPU (baseado no conjunto de títulos da categoria)
    const itemsMap = new Map<string, VODItem>();
    matchingFilas.forEach((f) => {
      f.itens.forEach((it) => {
        if (!itemsMap.has(it.title)) itemsMap.set(it.title, it);
      });
    });

    const uniqueItems = Array.from(itemsMap.values());
    if (uniqueItems.length > 0) {
      const sortedAZ = uniqueItems.slice(0, 35).sort((a, b) => a.title.localeCompare(b.title));
      const azRail = new Rail('Explorar de A a Z', false);
      azRail.setCards(this.mapCards(sortedAZ));
      this.railsContainer.appendChild(azRail.getElement());
      this.dynamicRails.push(azRail);
    }
  }

  private mapCards(items: VODItem[]): CardModel[] {
    return items.map((item) => ({
      id: `ondemand_${item.id}`,
      title: item.title,
      subtitle: item.year ? `${item.year} · ${item.isSeries ? 'Série' : 'Filme'}` : (item.isSeries ? 'Série' : 'Filme'),
      image: item.poster,
      badge: item.year || (item.isSeries ? 'SÉRIE' : '4K'),
      badgeColor: item.isSeries ? '#7aa2ff' : '#4fe3d0',
      onClick: () => {
        State.setScreen('ficha', { vod: item });
      },
      onFocus: () => {
        this.heroBanner.update(item);
      },
    }));
  }
}
