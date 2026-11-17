/**
 * DoacaoConteudo.tsx
 *
 * O texto, o QR e o botão do Pix direto, no mesmo desenho do modal. É usado pelo
 * modal flutuante (DoacaoModal) e pela página /apoie (ApoiePagina).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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
        Ajude a manter tudo <span className="saimo-doacao-destaque">100% gratuito</span>
      </h2>
      <p className="saimo-doacao-subtitulo">
        Sem anúncios chatos, sem mensalidades e livre para todo mundo.
      </p>
    </div>

    <div className="saimo-doacao-historia">
      <p>
        O <strong>Saimo TV</strong> nasceu com um propósito claro: oferecer canais ao vivo, filmes e séries com rapidez e qualidade, <strong>sem propagandas invasivas e sem cobrar assinaturas</strong>.
      </p>
      <p>
        Manter servidores velozes, infraestrutura de transmissão e atualizações diárias gera custos reais todos os meses.
      </p>
      <div className="saimo-doacao-destaque-bloco">
        <span className="saimo-doacao-destaque-icone">💡</span>
        <p>
          <strong>Quem puder ajudar com qualquer valor</strong>, cada contribuição faz uma diferença enorme para manter as máquinas ligadas e tudo livre de anúncios para todos!
        </p>
      </div>
    </div>

    <div className="saimo-doacao-vantagens">
      <div className="saimo-doacao-vantagem-item">
        <div className="saimo-doacao-vantagem-icone">🚫</div>
        <div className="saimo-doacao-vantagem-conteudo">
          <strong>Zero Anúncios</strong>
          <span>Nenhum comercial ou popup interrompendo você</span>
        </div>
      </div>
      <div className="saimo-doacao-vantagem-item">
        <div className="saimo-doacao-vantagem-icone">⚡</div>
        <div className="saimo-doacao-vantagem-conteudo">
          <strong>Servidores Rápidos</strong>
          <span>Streaming estável, liso e com alta largura de banda</span>
        </div>
      </div>
      <div className="saimo-doacao-vantagem-item">
        <div className="saimo-doacao-vantagem-icone">💜</div>
        <div className="saimo-doacao-vantagem-conteudo">
          <strong>Sem Mensalidade</strong>
          <span>Acesso livre a todos os canais, filmes e séries</span>
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
        Muito obrigado a cada um que apoia o projeto! 🍿✨
      </span>
    </div>
    </>
  );
}
