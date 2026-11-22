import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { ehTv } from '../plataforma/tv';

/**
 * Capa do TMDB num tamanho menor (w185) para as fileiras da TV: cada capa
 * decodificada ocupa memória de vídeo, que na TV é pouca. Com centenas de capas
 * em w342 a TV ficava sem memória: capas pretas, foco sumindo e tudo lento.
 */
function menorNaTv(src: string): string {
  return src.replace(/\/t\/p\/(w342|w500|w780|original)\//, '/t/p/w185/');
}

/**
 * <img> das fileiras. Fora da TV é o `loading="lazy"` nativo. Na TV (o Chromium
 * das TVs antigas não tem o nativo):
 * - só baixa quando chega perto da tela;
 * - solta a imagem quando fica longe (libera a memória; volta a baixar do cache
 *   do navegador se a pessoa voltar);
 * - usa a capa menor (w185), salvo `grande`.
 */
export function ImagemLazy({ src, grande, ...resto }: ImgHTMLAttributes<HTMLImageElement> & { src: string; grande?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  const naTv = ehTv();
  const usaObserver = naTv && typeof IntersectionObserver !== 'undefined';
  const [perto, setPerto] = useState(!usaObserver);

  useEffect(() => {
    if (!usaObserver || !ref.current) return;
    const el = ref.current;
    // Carrega a até ~1 tela de distância; solta além de ~3 telas (folga evita piscar).
    const carregar = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) setPerto(true); }, { rootMargin: '700px 500px' });
    const soltar = new IntersectionObserver((e) => { if (e.every((x) => !x.isIntersecting)) setPerto(false); }, { rootMargin: '2200px 2400px' });
    carregar.observe(el);
    soltar.observe(el);
    return () => { carregar.disconnect(); soltar.disconnect(); };
  }, [usaObserver]);

  const final = naTv && !grande ? menorNaTv(src) : src;
  return <img ref={ref} {...resto} src={perto ? final : undefined} loading="lazy" decoding="async" />;
}
