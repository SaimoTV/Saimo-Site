/**
 * DoacaoConteudo.tsx
 *
 * O texto, o QR e o botão do Pix direto, no mesmo desenho do modal. É usado pelo
 * modal flutuante (DoacaoModal) e pela página /apoie (ApoiePagina).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PIX_COPIA_E_COLA, PIX_FAVORECIDO, TEXTO_PIX_DIRETO } from '../services/doacaoService';
import './DoacaoModal.css';

/** Copia o Pix copia e cola; `copiado` fica ligado por 2,5 s depois. */
function useCopiarPix() {
  const [copiado, setCopiado] = useState(false);
  const relogio = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(relogio.current), []);

  const copiar = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(PIX_COPIA_E_COLA);
    } catch {
      // Fallback simples caso a Clipboard API seja bloqueada
      const input = document.createElement('input');
      input.value = PIX_COPIA_E_COLA;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopiado(true);
    window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(() => setCopiado(false), 2500);
  }, []);

  return { copiado, copiar };
}

/** Ícone de traço (estilo Feather), herda a cor do texto em volta. */
function IconeSvg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="18"
      height="18"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function DoacaoConteudo({ tituloId = 'doacao-titulo' }: { tituloId?: string }) {
  const { copiado, copiar: aoCopiarPix } = useCopiarPix();
  return (
    <>
    <div className="saimo-doacao-cabecalho">
      <div className="saimo-doacao-tag">
        <span className="saimo-doacao-tag-ponto" />
        <span>Comunidade Saimo TV</span>
      </div>
      <h2 id={tituloId} className="saimo-doacao-titulo">
        Ajude a manter o Saimo TV <span className="saimo-doacao-destaque">100% gratuito</span>
      </h2>
      <p className="saimo-doacao-subtitulo">
        Sem anúncios e sem mensalidade.
      </p>
    </div>

    <div className="saimo-doacao-historia">
      <p>
        O <strong>Saimo TV</strong> é um player: ele toca as listas e os links que você mesmo adiciona. O app e o site não trazem nenhum canal, filme ou série dentro; o que você assiste vem das suas próprias listas.
      </p>
      <p>
        O desenvolvimento, as atualizações e a hospedagem do site custam dinheiro todo mês.
      </p>
      <div className="saimo-doacao-destaque-bloco">
        <span className="saimo-doacao-destaque-icone">
          <IconeSvg>
            <path d="M9 18h6" />
            <path d="M10 21h4" />
            <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
          </IconeSvg>
        </span>
        <p>
          <strong>Quem puder ajudar com qualquer valor</strong> faz uma diferença enorme para o Saimo TV continuar gratuito, atualizado e sem anúncios.
        </p>
      </div>
    </div>

    <div className="saimo-doacao-vantagens">
      <div className="saimo-doacao-vantagem-item">
        <div className="saimo-doacao-vantagem-icone">
          <IconeSvg>
            <circle cx="12" cy="12" r="9" />
            <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
          </IconeSvg>
        </div>
        <div className="saimo-doacao-vantagem-conteudo">
          <strong>Zero anúncios</strong>
          <span>Nada interrompendo o que você usa</span>
        </div>
      </div>
      <div className="saimo-doacao-vantagem-item">
        <div className="saimo-doacao-vantagem-icone">
          <IconeSvg>
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15" />
          </IconeSvg>
        </div>
        <div className="saimo-doacao-vantagem-conteudo">
          <strong>Atualizações constantes</strong>
          <span>Melhorias e correções para o app e o site</span>
        </div>
      </div>
      <div className="saimo-doacao-vantagem-item">
        <div className="saimo-doacao-vantagem-icone">
          <IconeSvg>
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" />
          </IconeSvg>
        </div>
        <div className="saimo-doacao-vantagem-conteudo">
          <strong>Sem mensalidade</strong>
          <span>O app é gratuito para todo mundo</span>
        </div>
      </div>
    </div>

    <div className="saimo-doacao-pix">
      <div className="saimo-doacao-pix-selo">Pix direto</div>
      <img
        className="saimo-doacao-pix-qr"
        src="/doacao-pix-qr.png"
        alt="QR code do Pix direto para Gabriel Saimo Ferreira"
        width={200}
        height={200}
      />
      <div className="saimo-doacao-pix-nome">{PIX_FAVORECIDO}</div>
      <p className="saimo-doacao-pix-texto">{TEXTO_PIX_DIRETO}</p>
    </div>

    <div className="saimo-doacao-acoes">
      <button
        type="button"
        onClick={aoCopiarPix}
        className={`saimo-doacao-btn-principal saimo-doacao-btn-pix ${copiado ? 'copiado' : ''}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          width="18"
          height="18"
          aria-hidden="true"
        >
          {copiado ? (
            <polyline points="20 6 9 17 4 12" />
          ) : (
            <>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </>
          )}
        </svg>
        <span>{copiado ? 'Código copiado' : 'Copiar Pix copia e cola'}</span>
      </button>
    </div>

    <div className="saimo-doacao-rodape">
      <span>Pix direto para Gabriel Saimo Ferreira, feito no app do seu banco. Nenhum dado de pagamento passa pelo Saimo TV.</span>
      <span className="saimo-doacao-agradecimento">
        Muito obrigado a cada um que apoia o projeto!
      </span>
    </div>
    </>
  );
}
