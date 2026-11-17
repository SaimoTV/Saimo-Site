/**
 * Player das novelinhas (minisséries em pé da RedeFlix) na TV.
 *
 * Vídeo HTML5 simples (os episódios são MP4 diretos): fica no meio da tela,
 * com faixas pretas dos lados. Cima/baixo (e canal +/-) trocam de episódio,
 * OK pausa, e no fim de um episódio o seguinte entra sozinho. Onde parou
 * fica guardado por novelinha.
 */
import { State } from '../core/State';
import { Api, Novelinha } from '../core/Api';

const CHAVE = 'saimo_novelinhas_parada';

function paradas(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch { return {}; }
}

export function paradaDaNovelinha(id: string): number {
  return paradas()[id] || 0;
}

function guardar(id: string, ep: number) {
  const tudo = paradas();
  tudo[id] = ep;
  const chaves = Object.keys(tudo);
  if (chaves.length > 60) delete tudo[chaves[0]];
  try { localStorage.setItem(CHAVE, JSON.stringify(tudo)); } catch { /* sem espaço */ }
}

export class NovelinhaScreen {
  private element: HTMLElement;
  private video: HTMLVideoElement;
  private titulo: HTMLElement;
  private episodio: HTMLElement;
  private topo: HTMLElement;
  private palco!: HTMLElement;
  private barra: HTMLElement;
  private n: Novelinha | null = null;
  private ep = 1;
  private esconder: number | undefined;
  private tecla = (e: KeyboardEvent) => this.onKey(e);

  constructor() {
    this.element = document.createElement('div');
    this.element.className = 'tv-screen hidden';
    this.element.id = 'screen-novelinha';
    this.element.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:50;';
    // O vídeo em pé no meio da tela: uma caixa de largura total que centraliza.
    const palco = document.createElement('div');
    palco.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;';
    this.palco = palco;
    this.video = document.createElement('video');
    this.video.style.cssText = 'height:100%;width:100%;object-fit:contain;background:#000;';
    this.video.autoplay = true;
    this.video.setAttribute('playsinline', '');
    this.video.addEventListener('ended', () => this.ir(this.ep + 1, true));
    this.video.addEventListener('timeupdate', () => {
      const d = this.video.duration;
      this.barra.style.width = d ? `${(this.video.currentTime / d) * 100}%` : '0%';
    });
    this.topo = document.createElement('div');
    this.topo.style.cssText = 'position:absolute;top:40px;left:60px;padding:22px 30px;background:rgba(0,0,0,.6);border-radius:16px;color:#fff;transition:opacity .4s;';
    this.titulo = document.createElement('div');
    this.titulo.style.cssText = 'font-size:38px;font-weight:700;';
    this.episodio = document.createElement('div');
    this.episodio.style.cssText = 'font-size:26px;opacity:.8;margin-top:6px;';
    const dica = document.createElement('div');
    dica.style.cssText = 'font-size:20px;opacity:.55;margin-top:8px;';
    dica.textContent = 'Cima e baixo trocam de episódio · OK pausa · Voltar sai';
    this.topo.append(this.titulo, this.episodio, dica);
    const trilho = document.createElement('div');
    trilho.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:6px;background:rgba(255,255,255,.2);';
    this.barra = document.createElement('div');
    this.barra.style.cssText = 'height:100%;width:0;background:#FF7EB6;';
    trilho.appendChild(this.barra);
    this.palco.appendChild(this.video);
    this.element.append(this.palco, this.topo, trilho);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  enter() {
    const n = State.currentNovelinha;
    this.element.classList.remove('hidden');
    if (!n) { State.setScreen('ondemand'); return; }
    this.n = n;
    this.titulo.textContent = n.titulo;
    window.addEventListener('keydown', this.tecla, true);
    const parada = paradaDaNovelinha(n.id);
    this.ir(parada >= 1 && parada <= n.episodios ? parada : 1, false);
  }

  leave() {
    window.removeEventListener('keydown', this.tecla, true);
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.element.classList.add('hidden');
  }

  private ir(ep: number, sozinho: boolean) {
    const n = this.n;
    if (!n) return;
    if (ep > n.episodios) { if (sozinho) State.setScreen('ondemand'); return; }
    if (ep < 1) return;
    this.ep = ep;
    this.video.src = Api.urlNovelinha(n, ep);
    this.video.play().catch(() => {});
    guardar(n.id, ep);
    this.mostrar();
  }

  private mostrar() {
    const n = this.n;
    if (!n) return;
    this.episodio.textContent = `Episódio ${this.ep} de ${n.episodios} · ${n.dublada ? 'Dublado' : 'Legendado'}`;
    this.topo.style.opacity = '1';
    if (this.esconder) clearTimeout(this.esconder);
    this.esconder = window.setTimeout(() => { this.topo.style.opacity = '0'; }, 4000);
  }

  private onKey(e: KeyboardEvent) {
    if (State.currentScreen !== 'novelinha') return;
    const k = e.keyCode;
    // 40 baixo, 427 canal+ / 38 cima, 428 canal- / 13 OK, 10252 play-pause
    if (k === 40 || k === 427) this.ir(this.ep + 1, false);
    else if (k === 38 || k === 428) this.ir(this.ep - 1, false);
    else if (k === 13 || k === 10252 || k === 415 || k === 19) {
      if (this.video.paused) this.video.play().catch(() => {}); else this.video.pause();
      this.mostrar();
    } else return;
    e.preventDefault();
    e.stopPropagation();
  }
}
