/**
 * Motor de Navegação Espacial 2D de Ultra-Baixa Latência para Smart TVs.
 * Calcula o próximo elemento na direção do D-Pad (Cima, Baixo, Esquerda, Direita),
 * centraliza a rolagem de trilhos e gerencia armadilhas de foco (modais/gavetas).
 */

export interface NavRect {
  x: number;
  y: number;
  width: number;
  height: number;
  center: { x: number; y: number };
}

export type Direction = 'up' | 'down' | 'left' | 'right';

export class SpatialNav {
  private static currentElement: HTMLElement | null = null;
  private static trapContainer: HTMLElement | null = null;
  private static previousFocusStack: HTMLElement[] = [];
  private static onSelectCallback?: (el: HTMLElement) => void;

  static init() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e), true);
  }

  static setTrap(container: HTMLElement | null) {
    this.trapContainer = container;
    if (container) {
      const first = container.querySelector<HTMLElement>('[data-nav="true"], button, input');
      if (first) this.focus(first);
    }
  }

  static pushFocus(el: HTMLElement) {
    if (this.currentElement) {
      this.previousFocusStack.push(this.currentElement);
    }
    this.focus(el);
  }

  static popFocus() {
    const prev = this.previousFocusStack.pop();
    if (prev && document.body.contains(prev)) {
      this.focus(prev);
    }
  }

  static focus(el: HTMLElement | null, scrollIntoView = true) {
    if (!el || el === this.currentElement) return;

    if (this.currentElement) {
      this.currentElement.classList.remove('nav-focused');
      this.currentElement.dispatchEvent(new CustomEvent('nav-blur'));
    }

    this.currentElement = el;
    el.classList.add('nav-focused');
    el.dispatchEvent(new CustomEvent('nav-focus'));

    if (scrollIntoView) {
      this.scrollToElement(el);
    }
  }

  static getCurrent(): HTMLElement | null {
    return this.currentElement;
  }

  static handleKeyDown(e: KeyboardEvent): boolean {
    const key = e.keyCode;

    let dir: Direction | null = null;
    if (key === 38) dir = 'up';
    else if (key === 40) dir = 'down';
    else if (key === 37) dir = 'left';
    else if (key === 39) dir = 'right';

    if (dir) {
      const handled = this.move(dir);
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
        return true;
      }
    } else if (key === 13) {
      // ENTER / OK
      if (this.currentElement) {
        e.preventDefault();
        e.stopPropagation();
        this.currentElement.click();
        this.currentElement.dispatchEvent(new CustomEvent('nav-select'));
        return true;
      }
    }

    return false;
  }

  static move(dir: Direction): boolean {
    if (!this.currentElement) {
      const all = this.getFocusables();
      if (all.length > 0) {
        this.focus(all[0]);
        return true;
      }
      return false;
    }

    // Permite que o elemento intercepte navegação específica (ex: data-nav-left="id")
    const customTargetId = this.currentElement.getAttribute(`data-nav-${dir}`);
    if (customTargetId) {
      if (customTargetId === 'none') return true; // Bloqueia movimento
      const customEl = document.getElementById(customTargetId);
      if (customEl) {
        this.focus(customEl);
        return true;
      }
    }

    const currentRect = this.getRect(this.currentElement);
    const candidates = this.getFocusables().filter((el) => el !== this.currentElement);

    let bestCandidate: HTMLElement | null = null;
    let minDistance = Infinity;

    for (const candidate of candidates) {
      const candidateRect = this.getRect(candidate);
      if (!this.isInDirection(currentRect, candidateRect, dir)) continue;

      const dist = this.calculateDistance(currentRect, candidateRect, dir);
      if (dist < minDistance) {
        minDistance = dist;
        bestCandidate = candidate;
      }
    }

    if (bestCandidate) {
      this.focus(bestCandidate);
      return true;
    }

    return false;
  }

  private static getFocusables(): HTMLElement[] {
    if (this.trapContainer) {
      const list = this.trapContainer.querySelectorAll<HTMLElement>(
        '[data-nav="true"]:not([disabled]):not([data-nav-disabled="true"])'
      );
      const result: HTMLElement[] = [];
      for (let i = 0; i < list.length; i++) {
        const el = list[i];
        if (el.offsetParent !== null && el.style.display !== 'none' && el.style.visibility !== 'hidden') {
          result.push(el);
        }
      }
      return result;
    }

    const activeScreen = document.querySelector<HTMLElement>('.tv-screen:not(.hidden)');
    const menuGlobal = document.querySelector<HTMLElement>('.tv-menu-global');

    const result: HTMLElement[] = [];

    // Inclui itens do menu do topo quando estiver visível
    if (menuGlobal && menuGlobal.style.display !== 'none') {
      const menuList = menuGlobal.querySelectorAll<HTMLElement>(
        '[data-nav="true"]:not([disabled]):not([data-nav-disabled="true"])'
      );
      for (let i = 0; i < menuList.length; i++) {
        const el = menuList[i];
        if (el.offsetParent !== null && el.style.display !== 'none' && el.style.visibility !== 'hidden') {
          result.push(el);
        }
      }
    }

    // Inclui itens da tela ativa
    if (activeScreen) {
      const screenList = activeScreen.querySelectorAll<HTMLElement>(
        '[data-nav="true"]:not([disabled]):not([data-nav-disabled="true"])'
      );
      for (let i = 0; i < screenList.length; i++) {
        const el = screenList[i];
        if (el.offsetParent !== null && el.style.display !== 'none' && el.style.visibility !== 'hidden') {
          result.push(el);
        }
      }
    }

    return result;
  }

  private static getRect(el: HTMLElement): NavRect {
    const b = el.getBoundingClientRect();
    return {
      x: b.left,
      y: b.top,
      width: b.width,
      height: b.height,
      center: {
        x: b.left + b.width / 2,
        y: b.top + b.height / 2,
      },
    };
  }

  private static isInDirection(from: NavRect, to: NavRect, dir: Direction): boolean {
    const threshold = 4;
    switch (dir) {
      case 'left':
        return to.center.x < from.center.x - threshold;
      case 'right':
        return to.center.x > from.center.x + threshold;
      case 'up':
        return to.center.y < from.center.y - threshold;
      case 'down':
        return to.center.y > from.center.y + threshold;
    }
  }

  private static calculateDistance(from: NavRect, to: NavRect, dir: Direction): number {
    const dx = to.center.x - from.center.x;
    const dy = to.center.y - from.center.y;

    // Penaliza o desvio perpendicular para favorecer elementos alinhados no mesmo trilho
    if (dir === 'left' || dir === 'right') {
      return Math.abs(dx) + Math.abs(dy) * 2.5;
    } else {
      return Math.abs(dy) + Math.abs(dx) * 2.5;
    }
  }

  private static scrollToElement(el: HTMLElement) {
    // 1. Rolagem horizontal no trilho pai (Instantânea a 60 FPS na GPU da TV)
    const rail = el.closest<HTMLElement>('.tv-rail-items, .tv-scroll-h');
    if (rail) {
      const railRect = rail.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetScroll =
        rail.scrollLeft + (elRect.left - railRect.left) - (railRect.width / 2 - elRect.width / 2);
      rail.scrollLeft = targetScroll;
    }

    // 2. Rolagem vertical na tela principal
    const screen = el.closest<HTMLElement>('.tv-screen-scroll, .tv-scroll-v');
    if (screen) {
      const screenRect = screen.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetScrollY =
        screen.scrollTop + (elRect.top - screenRect.top) - (screenRect.height / 2 - elRect.height / 2);
      screen.scrollTop = targetScrollY;
    }
  }
}
