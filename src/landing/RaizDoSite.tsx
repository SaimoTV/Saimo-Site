import type { ReactNode } from 'react';
import { ehAppDaTv, ehTv } from '../plataforma/tv';
import { Landing } from './Landing';

/** O site já foi aberto como app neste navegador? ("Abrir no navegador" grava isso.) */
function jaEntrou(): boolean {
  try { return localStorage.getItem('saimo-entrou') === '1'; } catch { return false; }
}

/** Aberto como app instalado (PWA, tela cheia própria)? */
function comoAppInstalado(): boolean {
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

/**
 * A raiz do site: quem chega pela primeira vez no navegador vê a apresentação
 * do projeto; a TV, o app instalado e quem já abriu o Saimo no navegador vão
 * direto ao app. A apresentação continua em /sobre.
 */
export function RaizDoSite({ app }: { app: ReactNode }) {
  if (ehTv() || ehAppDaTv() || comoAppInstalado() || jaEntrou() || import.meta.env.VITE_TV) return <>{app}</>;
  return <Landing />;
}
