import './logo-carregando.css';

/**
 * Logo que serve de carregamento: aparece apagada e vai ganhando cor da
 * esquerda para a direita enquanto o vídeo abre. Não há medida real de
 * progresso, então a cor avança sozinha e desacelera perto do fim (nunca
 * completa antes de o vídeo começar); quando o player some com o overlay, a
 * imagem já está quase toda colorida.
 */
export function LogoCarregando({ src, nome }: { src?: string; nome?: string }) {
  const imagem = src || '/icons/icon-192.png';
  return (
    <div className="logo-carregando" role="status" aria-label={nome ? `Carregando ${nome}` : 'Carregando'}>
      <img className="lc-base" src={imagem} alt="" draggable={false} />
      <div className="lc-cor">
        <img src={imagem} alt="" draggable={false} />
      </div>
    </div>
  );
}
