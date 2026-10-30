/**
 * Gerenciador de Armazenamento Local e Preferências Persistentes.
 * Guarda configurações, progresso de VOD ("Continuar Assistindo"),
 * canais/filmes favoritos e histórico.
 */

export interface VODProgress {
  title: string;
  position: number;      // segundos assistidos
  duration: number;      // duração total em segundos
  percent: number;       // 0 a 100
  updatedAt: number;     // timestamp
  season?: number;
  episode?: number;
  episodeTitle?: string;
  url?: string;
}

export interface TVPreferences {
  abrirEm: 'canal' | 'inicio';
  zeroDelay: 'off' | 'equilibrado' | 'agressivo';
  audioInteligente: boolean;
  upscaling: 'off' | 'hd' | '4k';
  versaoAudio: 'dub' | 'leg';
  proximoAutomatico: boolean;
  pularAutomatico: boolean;
  tamanhoLegenda: number; // 0=pequeno, 1=normal, 2=grande, 3=enorme
  legendaFundo: boolean;
  ultimoCanal: string;
  urlCanais: string;
  urlFilmes: string;
}

const DEFAULT_PREFS: TVPreferences = {
  abrirEm: 'inicio',
  zeroDelay: 'equilibrado',
  audioInteligente: true,
  upscaling: 'off',
  versaoAudio: 'dub',
  proximoAutomatico: true,
  pularAutomatico: true,
  tamanhoLegenda: 1,
  legendaFundo: true,
  ultimoCanal: '',
  urlCanais: 'https://canais-saimo.pages.dev/',
  urlFilmes: 'https://filmes-saimo.pages.dev/',
};

export class Storage {
  private static PREFS_KEY = 'saimo_tv_prefs';
  private static PROGRESS_KEY = 'saimo_tv_vod_progress';
  private static FAV_CHANNELS_KEY = 'saimo_tv_fav_channels';
  private static FAV_VOD_KEY = 'saimo_tv_fav_vod';

  static getPrefs(): TVPreferences {
    try {
      const data = localStorage.getItem(this.PREFS_KEY);
      if (data) return { ...DEFAULT_PREFS, ...JSON.parse(data) };
    } catch (e) {}
    return { ...DEFAULT_PREFS };
  }

  static savePrefs(prefs: Partial<TVPreferences>) {
    try {
      const current = this.getPrefs();
      const updated = { ...current, ...prefs };
      localStorage.setItem(this.PREFS_KEY, JSON.stringify(updated));
    } catch (e) {}
  }

  // Progresso de Filmes e Episódios (Continuar Assistindo)
  static getProgress(title: string): VODProgress | null {
    const all = this.getAllProgress();
    return all[title] || null;
  }

  static getAllProgress(): Record<string, VODProgress> {
    try {
      const data = localStorage.getItem(this.PROGRESS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {}
    return {};
  }

  static saveProgress(prog: VODProgress) {
    try {
      const all = this.getAllProgress();
      // Não salva se viu menos de 30 segundos ou se já terminou (mais de 95%)
      if (prog.position < 30 || (prog.duration > 0 && prog.position / prog.duration > 0.95)) {
        if (prog.duration > 0 && prog.position / prog.duration > 0.95) {
          delete all[prog.title];
          localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(all));
        }
        return;
      }
      prog.percent = Math.round((prog.position / prog.duration) * 100);
      prog.updatedAt = Date.now();
      all[prog.title] = prog;
      localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  static removeProgress(title: string) {
    try {
      const all = this.getAllProgress();
      delete all[title];
      localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  // Favoritos
  static getFavoriteChannels(): Set<string> {
    try {
      const data = localStorage.getItem(this.FAV_CHANNELS_KEY);
      if (data) return new Set(JSON.parse(data));
    } catch (e) {}
    return new Set();
  }

  static toggleFavoriteChannel(name: string): boolean {
    const favs = this.getFavoriteChannels();
    const isFav = favs.has(name);
    if (isFav) favs.delete(name);
    else favs.add(name);
    localStorage.setItem(this.FAV_CHANNELS_KEY, JSON.stringify(Array.from(favs)));
    return !isFav;
  }

  static getFavoriteVOD(): Set<string> {
    try {
      const data = localStorage.getItem(this.FAV_VOD_KEY);
      if (data) return new Set(JSON.parse(data));
    } catch (e) {}
    return new Set();
  }

  static toggleFavoriteVOD(title: string): boolean {
    const favs = this.getFavoriteVOD();
    const isFav = favs.has(title);
    if (isFav) favs.delete(title);
    else favs.add(title);
    localStorage.setItem(this.FAV_VOD_KEY, JSON.stringify(Array.from(favs)));
    return !isFav;
  }
}
