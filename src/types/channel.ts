/**
 * Uma origem de reprodução do canal.
 *
 * O catálogo publicado guarda mais que o endereço: o Referer e o User-Agent que
 * certos CDNs exigem, e a chave ClearKey das fontes DASH. Um M3U não tem onde
 * guardar nada disso, e é por isso que o campo `url` sozinho não basta.
 */
export interface ChannelSource {
  url: string;
  quality?: string;
  /** O que diferencia a fonte das outras do canal ("Temporada 3"), quando o catálogo sabe. */
  name?: string;
  referer?: string;
  userAgent?: string;
  /** KID do ClearKey, em hexadecimal. */
  keyId?: string;
  /** Chave do ClearKey, em hexadecimal. */
  key?: string;
}

export interface Channel {
  id: string;
  name: string;
  /** Primeira fonte, mantida para quem só sabe ler um endereço. */
  url: string;
  logo?: string;
  category?: string;
  /** País do canal, código de duas letras ("BR"), quando a lista informa. */
  country?: string;
  /** `group-title` original do M3U, quando a seção do painel é outra ("Minhas listas"). */
  group?: string;
  channelNumber?: number;
  /** Todas as fontes, na ordem de preferência. */
  sources?: ChannelSource[];
}

export interface PlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  isFullscreen: boolean;
  isMirrored: boolean;
  isTheaterMode: boolean;
  isPiP: boolean;
  isLoading: boolean;
  error: string | null;
}
