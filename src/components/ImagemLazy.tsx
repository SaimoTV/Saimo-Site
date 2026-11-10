import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { ehTv } from '../plataforma/tv';

/**
 * <img> que só baixa quando chega perto da tela. O `loading="lazy"` nativo não existe no
 * Chromium das TVs mais antigas (Tizen/webOS), que baixavam e decodificavam todas as capas
 * de uma vez e travavam. Fora da TV continua sendo o atributo nativo.
 */
export function ImagemLazy({ src, ...resto }: ImgHTMLAttributes<HTMLImageElement> & { src: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const usaObserver = ehTv() && typeof IntersectionObserver !== 'undefined';
  const [perto, setPerto] = useState(!usaObserver);

  useEffect(() => {
    if (!usaObserver || perto || !ref.current) return;
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) { setPerto(true); obs.disconnect(); }
    }, { rootMargin: '600px 400px' });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [usaObserver, perto]);

  return <img ref={ref} {...resto} src={perto ? src : undefined} loading="lazy" decoding="async" />;
}
