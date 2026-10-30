/**
 * Tela de Rádios Nacionais e Regionais (RadiosScreen).
 * Estações catalogadas por gênero musical e estado, reprodução de áudio streaming nativa e status em tempo real.
 */

import { State } from '../core/State';
import { Api, RadioStation } from '../core/Api';
import { TVPlayerInstance } from '../player/TVPlayer';
import { Rail, CardModel } from '../components/Rail';
import { SpatialNav } from '../core/SpatialNav';

export class RadiosScreen {
  private element: HTMLElement;
  private scrollContainer: HTMLElement;
  private player: TVPlayerInstance;
  private playingRadio: RadioStation | null = null;
  private nowPlayingBanner: HTMLElement;

  private genreRails: Map<string, Rail> = new Map();

  constructor(player: TVPlayerInstance) {
    this.player = player;
    this.element = document.createElement('div');
    this.element.className = 'tv-screen tv-radios-screen hidden';
    this.element.id = 'screen-radios';

    this.scrollContainer = document.createElement('div');
    this.scrollContainer.className = 'tv-screen-scroll tv-scroll-v';
    this.scrollContainer.style.padding = '100px 70px 40px';

    this.nowPlayingBanner = document.createElement('div');
    this.nowPlayingBanner.style.padding = '24px 32px';
    this.nowPlayingBanner.style.background = 'linear-gradient(90deg, #141419 0%, #1c1c24 100%)';
    this.nowPlayingBanner.style.borderRadius = '16px';
    this.nowPlayingBanner.style.marginBottom = '34px';
    this.nowPlayingBanner.style.display = 'none';
    this.scrollContainer.appendChild(this.nowPlayingBanner);

    const genres = ['Notícias', 'Rock', 'Sertanejo', 'Pop', 'Gospel', 'Geral'];
    genres.forEach((g) => {
      const rail = new Rail(`Rádios · ${g}`, true);
      this.genreRails.set(g, rail);
      this.scrollContainer.appendChild(rail.getElement());
    });

    this.element.appendChild(this.scrollContainer);
  }

  getElement(): HTMLElement {
    return this.element;
  }

  async enter() {
    this.element.classList.remove('hidden');

    const stations = await Api.fetchRadios();
    this.populateRails(stations);

    setTimeout(() => {
      const firstCard = this.scrollContainer.querySelector<HTMLElement>('.tv-card');
      if (firstCard) SpatialNav.focus(firstCard);
    }, 50);
  }

  leave() {
    this.element.classList.add('hidden');
    // Não interrompe áudio imediatamente se a pessoa apenas abriu menu, mas para ao sair de rádios
    this.player.stop();
  }

  private populateRails(stations: RadioStation[]) {
    this.genreRails.forEach((rail, genreName) => {
      const matching = stations.filter(
        (s) => s.genre?.toLowerCase().includes(genreName.toLowerCase()) || (genreName === 'Geral' && !s.genre)
      );

      if (matching.length === 0) {
        rail.getElement().style.display = 'none';
      } else {
        rail.getElement().style.display = 'block';
        rail.setCards(
          matching.map((st) => ({
            id: `radio_${encodeURIComponent(st.name)}`,
            title: st.name,
            subtitle: st.genre || 'Estação de Rádio',
            image: st.logo,
            onClick: () => this.playRadio(st),
          }))
        );
      }
    });
  }

  private async playRadio(station: RadioStation) {
    this.playingRadio = station;
    this.nowPlayingBanner.style.display = 'flex';
    this.nowPlayingBanner.style.alignItems = 'center';
    this.nowPlayingBanner.style.justifyContent = 'space-between';

    this.nowPlayingBanner.innerHTML = `
      <div style="display:flex; align-items:center; gap:20px;">
        ${station.logo ? `<img src="${station.logo}" style="width:64px; height:64px; object-fit:contain; border-radius:8px;" alt="" />` : ''}
        <div>
          <div style="font-size:24px; font-weight:800; color:#00e3ff;">${station.name}</div>
          <div style="font-size:16px; opacity:0.7;">${station.genre} · Transmissão em Alta Qualidade</div>
        </div>
      </div>
      <div style="padding:8px 18px; border-radius:20px; background:rgba(0,227,255,0.2); font-weight:700; color:#00e3ff;">
        ● TRANSMITINDO AO VIVO
      </div>
    `;

    try {
      await this.player.play({
        url: station.url,
        title: station.name,
        isLive: true,
      });
    } catch (e) {
      console.error('[RadiosScreen] Erro ao reproduzir rádio:', e);
    }
  }
}
