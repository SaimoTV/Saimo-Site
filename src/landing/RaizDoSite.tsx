import type { ReactNode } from 'react';
import { ehAppDaTv, ehTv } from '../plataforma/tv';
import { Landing } from './Landing';

/** Aberto como app instalado (PWA, tela cheia própria)? */
function comoAppInstalado(): boolean {
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

/**
 * A raiz do site é a apresentação do projeto, sempre. O app no navegador fica em
 * /home ("Abrir no navegador"). Só a TV (pacote ou navegador da TV) e o app
 * instalado (PWA) abrem direto no app, porque lá não há apresentação a ver.
 * A apresentação também responde em /sobre (links antigos).
 */
export function RaizDoSite({ app }: { app: ReactNode }) {
  if (ehTv() || ehAppDaTv() || comoAppInstalado() || import.meta.env.VITE_TV) return <>{app}</>;
  return <Landing />;
}
