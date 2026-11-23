/**
 * Ajustes > Aparência e acessibilidade > Acessibilidade, na TV Samsung e LG.
 * As escolhas aparecem primeiro na prévia (à direita); só "Aplicar" leva para o app todo.
 */
import { SpatialNav } from '../core/SpatialNav';
import { Platform } from '../core/Platform';
import { TAMANHOS, definirTema, marcarAcessibilidade, temaAtual, type Acessibilidade } from '../../../src/plataforma/tema';

function esc(t: string): string {
  return t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const PADRAO: Acessibilidade = { tamanho: 'normal', negrito: false, contraste: false, focoForte: false, espacado: false, legivel: false, destacar: false };

function atual(): Acessibilidade {
  const t = temaAtual();
  return { tamanho: t.tamanho, negrito: t.negrito, contraste: t.contraste, focoForte: t.focoForte, espacado: t.espacado, legivel: t.legivel, destacar: t.destacar };
}

const igual = (a: Acessibilidade, b: Acessibilidade) => JSON.stringify(a) === JSON.stringify(b);

export function caixaDeAcessibilidade(fechar: () => void): HTMLElement {
  const caixa = document.createElement('div');
  caixa.className = 'tv-acess';
  let aplicado = atual();
  let rascunho = { ...aplicado };

  caixa.innerHTML = `
    <div class="tv-acess-opcoes"></div>
    <div class="tv-acess-previa previa-acess">
      <div class="previa-conteudo">
        <h3>Prévia</h3>
        <div class="tv-acess-cartoes">
          <div class="tv-acess-cartao foco"><div class="tv-acess-capa"></div><b>A Odisseia</b><small>2026 · Aventura</small></div>
          <div class="tv-acess-cartao"><div class="tv-acess-capa"></div><b>Série do domingo</b><small>T2 · E5</small></div>
        </div>
        <div class="tv-acess-dica">OK abre · VOLTAR vai ao menu</div>
      </div>
    </div>`;
  const lista = caixa.querySelector<HTMLElement>('.tv-acess-opcoes')!;
  const previa = caixa.querySelector<HTMLElement>('.tv-acess-previa')!;

  const linhas: { id: string; titulo: string; valor: () => string; acao: () => void }[] = [
    { id: 'tamanho', titulo: 'Tamanho do texto e do menu', valor: () => TAMANHOS.find((t) => t.id === rascunho.tamanho)!.nome + ' · OK troca',
      acao: () => { const i = TAMANHOS.findIndex((t) => t.id === rascunho.tamanho); rascunho.tamanho = TAMANHOS[(i + 1) % TAMANHOS.length].id; } },
    { id: 'negrito', titulo: 'Texto em negrito', valor: () => (rascunho.negrito ? 'Ligado' : 'Desligado'), acao: () => { rascunho.negrito = !rascunho.negrito; } },
    { id: 'contraste', titulo: 'Alto contraste', valor: () => (rascunho.contraste ? 'Ligado' : 'Desligado'), acao: () => { rascunho.contraste = !rascunho.contraste; } },
    { id: 'foco', titulo: 'Foco reforçado', valor: () => (rascunho.focoForte ? 'Ligado · contorno amarelo' : 'Desligado'), acao: () => { rascunho.focoForte = !rascunho.focoForte; } },
    { id: 'espaco', titulo: 'Mais espaço no texto', valor: () => (rascunho.espacado ? 'Ligado' : 'Desligado'), acao: () => { rascunho.espacado = !rascunho.espacado; } },
    { id: 'legivel', titulo: 'Fonte mais legível', valor: () => (rascunho.legivel ? 'Ligado · letras simples' : 'Desligado'), acao: () => { rascunho.legivel = !rascunho.legivel; } },
    { id: 'destacar', titulo: 'Destacar botões', valor: () => (rascunho.destacar ? 'Ligado · com borda' : 'Desligado'), acao: () => { rascunho.destacar = !rascunho.destacar; } },
    { id: 'aplicar', titulo: 'Aplicar', valor: () => (igual(rascunho, aplicado) ? 'Nada mudou ainda' : 'Leva estas escolhas para o app inteiro'),
      acao: () => { if (!igual(rascunho, aplicado)) { definirTema(rascunho); aplicado = { ...rascunho }; } } },
    { id: 'desfazer', titulo: 'Desfazer', valor: () => 'Volta ao que está aplicado', acao: () => { rascunho = { ...aplicado }; } },
    { id: 'padrao', titulo: 'Voltar ao padrão', valor: () => 'Normal, sem negrito, foco comum', acao: () => { rascunho = { ...PADRAO }; } },
    { id: 'fechar', titulo: 'Fechar', valor: () => 'Volta aos Ajustes', acao: () => fechar() },
  ];

  const atualizar = () => {
    marcarAcessibilidade(previa, rascunho);
    linhas.forEach((l) => {
      const v = lista.querySelector(`#acess-${l.id} .tv-settings-item-value`);
      if (v) v.textContent = l.valor();
    });
  };

  linhas.forEach((l) => {
    const item = document.createElement('div');
    item.className = 'tv-settings-item nav-focusable';
    item.setAttribute('data-nav', 'true');
    item.id = `acess-${l.id}`;
    item.innerHTML = `<span class="tv-settings-item-title">${esc(l.titulo)}</span><span class="tv-settings-item-value">${esc(l.valor())}</span>`;
    item.addEventListener('click', () => { l.acao(); if (l.id !== 'fechar') atualizar(); });
    lista.appendChild(item);
  });
  atualizar();

  // VOLTAR fecha esta tela (e não sai dos Ajustes).
  const aoVoltar = (e: KeyboardEvent) => {
    if (!caixa.isConnected || !Platform.isBackKey(e.keyCode)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    window.removeEventListener('keydown', aoVoltar, true);
    fechar();
  };
  window.addEventListener('keydown', aoVoltar, true);

  setTimeout(() => { const i = lista.querySelector<HTMLElement>('.tv-settings-item'); if (i) SpatialNav.focus(i); }, 50);
  return caixa;
}
