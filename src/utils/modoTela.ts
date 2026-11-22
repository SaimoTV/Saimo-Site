/**
 * Como o vídeo ocupa a tela (filme e ao vivo), como na TV Box:
 * - ajustar: o vídeo inteiro, com faixas se a proporção não bate;
 * - zoom: preenche cortando as faixas (corta um pouco das bordas);
 * - esticar: preenche deformando;
 * - 16:9 e 4:3: força a proporção.
 * A escolha fica guardada no aparelho e vale para os dois players.
 */
export type ModoTela = 'ajustar' | 'zoom' | 'esticar' | '16:9' | '4:3';

const CHAVE = 'saimo-modo-tela';
const ORDEM: ModoTela[] = ['ajustar', 'zoom', 'esticar', '16:9', '4:3'];
export const NOME_DO_MODO: Record<ModoTela, string> = {
  ajustar: 'Ajustar (imagem inteira)',
  zoom: 'Zoom (sem faixas)',
  esticar: 'Esticar (preencher)',
  '16:9': '16:9',
  '4:3': '4:3',
};
export const EVENTO_MODO_TELA = 'saimo-modo-tela-mudou';

export function lerModoTela(): ModoTela {
  try {
    const v = localStorage.getItem(CHAVE) as ModoTela | null;
    if (v && ORDEM.includes(v)) return v;
  } catch { /* sem armazenamento */ }
  return 'ajustar';
}

export function gravarModoTela(m: ModoTela): void {
  try { localStorage.setItem(CHAVE, m); } catch { /* sem armazenamento */ }
  window.dispatchEvent(new Event(EVENTO_MODO_TELA));
}

export function proximoModoTela(m: ModoTela): ModoTela {
  return ORDEM[(ORDEM.indexOf(m) + 1) % ORDEM.length];
}

/** A classe do <video> (CSS em index.css). */
export function classeDoModo(m: ModoTela): string {
  return `tela-${m.replace(':', 'x')}`;
}
