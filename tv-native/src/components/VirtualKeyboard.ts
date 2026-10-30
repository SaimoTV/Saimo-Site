/**
 * Teclado Virtual de Alta Velocidade para Smart TVs (D-Pad).
 * Layout QWERTY com números, espaço, apagar, limpar e busca rápida.
 */

import { SpatialNav } from '../core/SpatialNav';

export class VirtualKeyboard {
  private element: HTMLElement;
  private onKeyInput: (char: string) => void;
  private onBackspace: () => void;
  private onClear: () => void;
  private onSearch: () => void;

  private static KEY_ROWS = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '-', '.', '@'],
  ];

  constructor(callbacks: {
    onKeyInput: (char: string) => void;
    onBackspace: () => void;
    onClear: () => void;
    onSearch: () => void;
  }) {
    this.onKeyInput = callbacks.onKeyInput;
    this.onBackspace = callbacks.onBackspace;
    this.onClear = callbacks.onClear;
    this.onSearch = callbacks.onSearch;

    this.element = document.createElement('div');
    this.element.className = 'tv-virtual-keyboard';
    this.element.id = 'tv-virtual-keyboard';

    this.render();
  }

  getElement(): HTMLElement {
    return this.element;
  }

  private render() {
    this.element.innerHTML = '';
    this.element.style.display = 'flex';
    this.element.style.flexDirection = 'column';
    this.element.style.gap = '8px';

    VirtualKeyboard.KEY_ROWS.forEach((row, rowIdx) => {
      const rowEl = document.createElement('div');
      rowEl.style.display = 'flex';
      rowEl.style.gap = '8px';

      row.forEach((key, colIdx) => {
        const btn = document.createElement('div');
        btn.className = 'tv-btn nav-focusable tv-key-btn';
        btn.setAttribute('data-nav', 'true');
        btn.id = `vk-key-${rowIdx}-${colIdx}`;
        btn.textContent = key;
        btn.style.minWidth = '48px';
        btn.style.height = '48px';
        btn.style.padding = '0';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.fontSize = '20px';
        btn.style.fontWeight = 'bold';

        btn.addEventListener('click', () => {
          this.onKeyInput(key);
        });

        rowEl.appendChild(btn);
      });

      this.element.appendChild(rowEl);
    });

    // Linha inferior de Ações (Espaço, Apagar, Limpar, Buscar)
    const actionRow = document.createElement('div');
    actionRow.style.display = 'flex';
    actionRow.style.gap = '8px';

    const spaceBtn = document.createElement('div');
    spaceBtn.className = 'tv-btn nav-focusable tv-key-btn';
    spaceBtn.setAttribute('data-nav', 'true');
    spaceBtn.id = 'vk-key-space';
    spaceBtn.textContent = 'ESPAÇO';
    spaceBtn.style.flex = '2';
    spaceBtn.style.height = '48px';
    spaceBtn.style.justifyContent = 'center';
    spaceBtn.addEventListener('click', () => this.onKeyInput(' '));
    actionRow.appendChild(spaceBtn);

    const backBtn = document.createElement('div');
    backBtn.className = 'tv-btn nav-focusable tv-key-btn';
    backBtn.setAttribute('data-nav', 'true');
    backBtn.id = 'vk-key-back';
    backBtn.textContent = '⌫ APAGAR';
    backBtn.style.flex = '1';
    backBtn.style.height = '48px';
    backBtn.style.justifyContent = 'center';
    backBtn.addEventListener('click', () => this.onBackspace());
    actionRow.appendChild(backBtn);

    const clearBtn = document.createElement('div');
    clearBtn.className = 'tv-btn nav-focusable tv-key-btn';
    clearBtn.setAttribute('data-nav', 'true');
    clearBtn.id = 'vk-key-clear';
    clearBtn.textContent = 'LIMPAR';
    clearBtn.style.flex = '1';
    clearBtn.style.height = '48px';
    clearBtn.style.justifyContent = 'center';
    clearBtn.addEventListener('click', () => this.onClear());
    actionRow.appendChild(clearBtn);

    this.element.appendChild(actionRow);
  }

  focusFirst() {
    const first = this.element.querySelector<HTMLElement>('#vk-key-0-0');
    if (first) SpatialNav.focus(first);
  }
}
