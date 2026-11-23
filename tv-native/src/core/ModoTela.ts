/**
 * Ajuste da imagem do vídeo (Tela): ajustar, preencher (zoom), esticar, 16:9 e 4:3.
 * A escolha fica guardada e vale para filmes e séries.
 */

export type ModoTela = 'ajustar' | 'preencher' | 'esticar' | '16x9' | '4x3';

export const MODOS_TELA: { id: ModoTela; nome: string; sobre: string }[] = [
  { id: 'ajustar', nome: 'Ajustar à tela', sobre: 'Mostra o vídeo inteiro, com faixas pretas se preciso' },
  { id: 'preencher', nome: 'Preencher (zoom)', sobre: 'Corta as bordas e enche a tela, sem deformar' },
  { id: 'esticar', nome: 'Esticar', sobre: 'Enche a tela deformando a imagem' },
  { id: '16x9', nome: '16:9', sobre: 'Força a imagem em formato widescreen' },
  { id: '4x3', nome: '4:3', sobre: 'Força a imagem em formato antigo (faixas dos lados)' },
];

const CHAVE = 'saimo_tv_tela_modo';

export function modoTelaAtual(): ModoTela {
  try {
    const v = localStorage.getItem(CHAVE) as ModoTela | null;
    if (v && MODOS_TELA.some((m) => m.id === v)) return v;
  } catch { /* sem localStorage */ }
  return 'ajustar';
}

export function guardarModoTela(m: ModoTela) {
  try { localStorage.setItem(CHAVE, m); } catch { /* sem espaço */ }
}

/** Aplica o modo ao <video>; sem argumento, usa o guardado. */
export function aplicarModoTela(video: HTMLVideoElement | null, modo: ModoTela = modoTelaAtual()) {
  if (!video) return;
  video.style.objectFit = modo === 'preencher' ? 'cover' : modo === 'esticar' || modo === '16x9' || modo === '4x3' ? 'fill' : 'contain';
  video.style.left = modo === '4x3' ? '240px' : '0px';
  video.style.width = modo === '4x3' ? '1440px' : '1920px';
}

/** Volta o vídeo ao normal (ao sair do player: o Ao vivo usa o mesmo elemento). */
export function limparModoTela(video: HTMLVideoElement | null) {
  if (!video) return;
  video.style.objectFit = '';
  video.style.left = '';
  video.style.width = '';
}
