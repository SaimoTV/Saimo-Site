/**
 * Logo que serve de carregamento: aparece apagada e em tons de cinza e vai
 * ganhando cor da esquerda para a direita enquanto o vídeo abre. Sem medida real
 * de progresso, a cor avança sozinha e desacelera perto do fim (até 92 % em
 * 12 s); ao `esconder()` (o vídeo começou) a imagem já está quase toda colorida.
 * Não usa nada além de CSS 2D simples: roda nos navegadores antigos das TVs.
 */
export class LogoCarregando {
  private static el: HTMLDivElement | null = null;

  static mostrar(logo?: string | null): void {
    const imagem = logo || '/icons/icon-192.png';
    this.esconder();
    const el = document.createElement('div');
    el.className = 'tv-logo-carregando';
    el.innerHTML = `<img class="base" src="${imagem.replace(/"/g, '&quot;')}" alt=""><div class="cor"><img src="${imagem.replace(/"/g, '&quot;')}" alt=""></div>`;
    // Troca para a logo do Saimo se a do canal/filme não carregar.
    el.querySelectorAll('img').forEach((i) => { i.onerror = () => { i.onerror = null; i.src = '/icons/icon-192.png'; }; });
    document.body.appendChild(el);
    this.el = el;
    // Reflow antes de ligar a animação.
    void el.offsetWidth;
    el.classList.add('anda');
  }

  static esconder(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }
}
