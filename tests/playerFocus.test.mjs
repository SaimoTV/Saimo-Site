import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSync } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Minimal DOM environment for testing PlayerOSD + PlayerScreen + SpatialNav
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.id = '';
    this.textContent = '';
    this.style = { cssText: '', display: '', visibility: '', width: '' };
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.listeners = new Map();
    this._classes = new Set();
    this._innerHTML = '';
    this.classList = {
      add: (...cls) => cls.forEach((c) => c && this._classes.add(c)),
      remove: (...cls) => cls.forEach((c) => this._classes.delete(c)),
      contains: (c) => this._classes.has(c),
      toggle: (c, force) => {
        const shouldAdd = force !== undefined ? force : !this._classes.has(c);
        if (shouldAdd) this._classes.add(c);
        else this._classes.delete(c);
      },
    };
  }

  get className() {
    return [...this._classes].join(' ');
  }

  set className(val) {
    this._classes = new Set(String(val || '').split(/\s+/).filter(Boolean));
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    const tokenRegex = /<\/?([a-zA-Z0-9]+)([^>]*)>/g;
    const stack = [this];
    let m;
    while ((m = tokenRegex.exec(html)) !== null) {
      const full = m[0];
      const tag = m[1].toLowerCase();
      const attrs = m[2] || '';
      if (full.startsWith('</')) {
        if (stack.length > 1) stack.pop();
      } else {
        const el = new MockElement(tag);
        const idMatch = attrs.match(/id="([^"]+)"/);
        if (idMatch) el.id = idMatch[1];
        const classMatch = attrs.match(/class="([^"]+)"/);
        if (classMatch) el.className = classMatch[1];
        for (const attrM of attrs.matchAll(/(data-[a-z-]+)="([^"]+)"/g)) {
          el.setAttribute(attrM[1], attrM[2]);
        }
        stack[stack.length - 1].appendChild(el);
        if (!full.endsWith('/>')) {
          stack.push(el);
        }
      }
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }

  get offsetParent() {
    return this.closest('.hidden') ? null : {};
  }

  setAttribute(k, v) {
    this.attributes.set(k, String(v));
  }

  getAttribute(k) {
    return this.attributes.get(k) ?? null;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  contains(target) {
    if (!target) return false;
    let cur = target;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  closest(selector) {
    let cur = this;
    while (cur) {
      if (matchesSelector(cur, selector)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const out = [];
    const visit = (node) => {
      for (const ch of node.children) {
        if (matchesSelector(ch, selector)) out.push(ch);
        visit(ch);
      }
    };
    visit(this);
    return out;
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  dispatchEvent(ev) {
    const fns = this.listeners.get(ev.type) || [];
    for (const fn of fns) fn(ev);
    return !ev.defaultPrevented;
  }

  click() {
    this.dispatchEvent({ type: 'click', defaultPrevented: false });
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 100, height: 40 };
  }
}

function matchesSelector(el, selector) {
  const parts = selector.split(',').map((s) => s.trim());
  return parts.some((part) => {
    if (part === '#screen-player:not(.hidden)') {
      return el.id === 'screen-player' && !el.classList.contains('hidden');
    }
    if (part.startsWith('#')) {
      return el.id === part.slice(1);
    }
    if (part.startsWith('.')) {
      const cls = part.slice(1).split(':')[0];
      if (part.includes(':not(.hidden)')) {
        return el.classList.contains(cls) && !el.classList.contains('hidden');
      }
      return el.classList.contains(cls);
    }
    if (part.startsWith('[data-nav="true"]')) {
      return el.getAttribute('data-nav') === 'true';
    }
    return false;
  });
}

const body = new MockElement('body');
const winListeners = [];
globalThis.window = {
  addEventListener: (type, fn) => {
    if (type === 'keydown') winListeners.push(fn);
  },
  removeEventListener: () => {},
  setTimeout: (fn) => setTimeout(fn, 0),
  clearTimeout: (id) => clearTimeout(id),
};
globalThis.document = {
  body,
  activeElement: null,
  createElement: (tag) => new MockElement(tag),
  getElementById: (id) => body.querySelector(`#${id}`),
  querySelector: (sel) => body.querySelector(sel),
  querySelectorAll: (sel) => body.querySelectorAll(sel),
};
globalThis.CustomEvent = class {
  constructor(type) {
    this.type = type;
  }
};
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Web0S' }, configurable: true });

function pressKey(keyCode, key) {
  let stoppedImmediate = false;
  const ev = {
    type: 'keydown',
    keyCode,
    key,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {},
    stopImmediatePropagation() {
      stoppedImmediate = true;
    },
  };
  for (const fn of winListeners) {
    if (stoppedImmediate) break;
    fn(ev);
  }
  return ev;
}

const outDir = mkdtempSync(join(tmpdir(), 'player-focus-'));
const bundlePath = join(outDir, 'bundle.mjs');
buildSync({
  stdin: {
    contents: `
      export { SpatialNav } from './tv-native/src/core/SpatialNav.ts';
      export { PlayerOSD } from './tv-native/src/components/PlayerOSD.ts';
      export { PlayerScreen } from './tv-native/src/screens/PlayerScreen.ts';
      export { State } from './tv-native/src/core/State.ts';
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundlePath,
  logLevel: 'error',
});

const { SpatialNav, PlayerScreen, State } = await import(bundlePath);

test('PlayerScreen: seta para baixo foca primeiro na barra de progresso, depois nos botões, e setas laterais nos botões NUNCA avançam ou voltam o vídeo', () => {
  SpatialNav.init();
  const seeks = [];
  let playToggled = 0;
  const mockPlayer = {
    play: async () => {},
    pause: () => {},
    resume: () => {},
    stop: () => {},
    seek: (sec) => seeks.push(sec),
    getCurrentTime: () => 100,
    getDuration: () => 3600,
    setAudioTrack: () => {},
    setSubtitleTrack: () => {},
  };

  const screen = new PlayerScreen(mockPlayer);
  body.appendChild(screen.getElement());
  screen.getElement().classList.remove('hidden');
  State.currentScreen = 'player';
  screen.duration = 3600;
  screen.currentTime = 100;
  screen.isPlaying = true;
  screen.osd.show();
  SpatialNav.limpar();

  // 1) Quando o usuário aperta PARA BAIXO pela primeira vez:
  // Deve focar na BARRA DE PROGRESSO (#osd-seekbar), e NÃO ir direto para os botões de baixo!
  pressKey(40, 'ArrowDown');
  assert.equal(SpatialNav.getCurrent()?.id, 'osd-seekbar', 'Primeiro ArrowDown deve focar na barra de progresso (#osd-seekbar)');
  assert.equal(seeks.length, 0, 'Focar na barra não deve alterar o tempo do vídeo');

  // 2) Com a barra de progresso em foco, DIREITA e ESQUERDA avançam e voltam o vídeo (+10s / -10s):
  pressKey(39, 'ArrowRight');
  assert.equal(SpatialNav.getCurrent()?.id, 'osd-seekbar', 'Foco permanece na barra de progresso após ArrowRight');
  assert.deepEqual(seeks, [110], 'ArrowRight na barra de progresso deve avançar +10s');

  pressKey(37, 'ArrowLeft');
  assert.equal(SpatialNav.getCurrent()?.id, 'osd-seekbar', 'Foco permanece na barra de progresso após ArrowLeft');
  assert.deepEqual(seeks, [110, 100], 'ArrowLeft na barra de progresso deve voltar -10s');

  // 3) Com a barra de progresso em foco, apertar PARA BAIXO desce para as opções de baixo (#osd-btn-play):
  pressKey(40, 'ArrowDown');
  assert.equal(SpatialNav.getCurrent()?.id, 'osd-btn-play', 'Segundo ArrowDown deve descer da barra para o primeiro botão (#osd-btn-play)');
  assert.equal(seeks.length, 2, 'Descer para os botões não deve alterar o tempo do vídeo');

  // 4) Com o foco nas opções de baixo, DIREITA e ESQUERDA devem APENAS navegar entre os botões e NUNCA avançar/voltar o vídeo!
  const expectedOrder = ['osd-btn-rew', 'osd-btn-fwd', 'osd-btn-audio', 'osd-btn-sub', 'osd-btn-src'];
  for (const expectedId of expectedOrder) {
    pressKey(39, 'ArrowRight');
    assert.equal(SpatialNav.getCurrent()?.id, expectedId, `ArrowRight deve mover foco para ${expectedId}`);
    assert.equal(seeks.length, 2, `ArrowRight em ${expectedId} NÃO PODE avançar o vídeo!`);
  }

  // Tentar ir mais para a direita no último botão: mantém no último botão e NÃO avança o vídeo
  pressKey(39, 'ArrowRight');
  assert.equal(SpatialNav.getCurrent()?.id, 'osd-btn-src', 'ArrowRight no último botão mantém foco nele');
  assert.equal(seeks.length, 2, 'ArrowRight no último botão NÃO PODE avançar o vídeo!');

  // Voltar para a esquerda por todos os botões até o primeiro:
  const reverseOrder = ['osd-btn-sub', 'osd-btn-audio', 'osd-btn-fwd', 'osd-btn-rew', 'osd-btn-play'];
  for (const expectedId of reverseOrder) {
    pressKey(37, 'ArrowLeft');
    assert.equal(SpatialNav.getCurrent()?.id, expectedId, `ArrowLeft deve mover foco para ${expectedId}`);
    assert.equal(seeks.length, 2, `ArrowLeft em ${expectedId} NÃO PODE voltar o vídeo!`);
  }

  // Tentar ir mais para a esquerda no primeiro botão: mantém no primeiro botão e NÃO volta o vídeo
  pressKey(37, 'ArrowLeft');
  assert.equal(SpatialNav.getCurrent()?.id, 'osd-btn-play', 'ArrowLeft no primeiro botão mantém foco nele');
  assert.equal(seeks.length, 2, 'ArrowLeft no primeiro botão NÃO PODE voltar o vídeo!');

  // 5) Apertar PARA CIMA em qualquer botão de baixo deve voltar o foco para a barra de progresso (#osd-seekbar):
  pressKey(39, 'ArrowRight'); // vai para osd-btn-rew
  pressKey(39, 'ArrowRight'); // vai para osd-btn-fwd
  assert.equal(SpatialNav.getCurrent()?.id, 'osd-btn-fwd');
  pressKey(38, 'ArrowUp');
  assert.equal(SpatialNav.getCurrent()?.id, 'osd-seekbar', 'ArrowUp nos botões deve subir para a barra de progresso (#osd-seekbar)');
  assert.equal(seeks.length, 2, 'Subir para a barra não deve alterar o tempo do vídeo');

  // 6) Se o OSD esconder por timeout e o usuário apertar PARA BAIXO novamente, deve focar primeiro na barra de progresso:
  screen.osd.hide();
  assert.equal(SpatialNav.getCurrent(), null, 'Esconder OSD deve limpar o foco interno');
  pressKey(40, 'ArrowDown');
  assert.equal(screen.osd.isVisible(), true, 'ArrowDown com OSD oculto deve mostrar o OSD');
  assert.equal(SpatialNav.getCurrent()?.id, 'osd-seekbar', 'ArrowDown com OSD oculto deve focar na barra de progresso primeiro');

  // 7) Mesmo se havia um botão de outra tela (ex: FichaScreen) focado antes, ArrowDown no player foca na barra de progresso:
  const staleBtn = new MockElement('div');
  staleBtn.id = 'btn-assistir-ficha';
  SpatialNav.focus(staleBtn, false);
  pressKey(40, 'ArrowDown');
  assert.equal(SpatialNav.getCurrent()?.id, 'osd-seekbar', 'ArrowDown após foco antigo de outra tela deve focar na barra de progresso');

  clearTimeout(screen.osd.hideTimer);
});
