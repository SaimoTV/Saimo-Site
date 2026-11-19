/**
 * Entrar na conta: fora do celular mostra já o QR (e o código) para o celular
 * com o Saimo aprovar; um botão troca o QR pelo e-mail e senha, e outro volta.
 * No celular (tela pequena e toque) vai direto para o e-mail e senha.
 */
import { useEffect, useState } from 'react';
import { conferirAprovacao, pedirCodigoDaTv } from './conta';
import { EntrarComEmail } from './ContaSaimo';
import { buildQrSvg } from '../utils/qrCode';
import { ehTv } from '../plataforma/tv';

function ehCelular(): boolean {
  if (ehTv()) return false;
  return window.innerWidth < 700 || (navigator.maxTouchPoints > 0 && window.innerWidth < 1000);
}

function PorQr({ aoUsarEmail }: { aoUsarEmail: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [qr, setQr] = useState('');
  const [situacao, setSituacao] = useState('Pedindo um código…');

  useEffect(() => {
    let vivo = true;
    void (async () => {
      while (vivo) {
        let pedido;
        try { pedido = await pedirCodigoDaTv(); } catch (e) {
          if (vivo) setSituacao(e instanceof Error ? e.message : 'Sem conexão: tentando de novo…');
          await new Promise((r) => setTimeout(r, 10_000));
          continue;
        }
        if (!vivo) return;
        setCodigo(pedido.codigo);
        setQr(buildQrSvg(pedido.url, 240));
        setSituacao('Esperando o celular…');
        while (vivo && Date.now() < pedido.expiraEm) {
          await new Promise((r) => setTimeout(r, pedido.intervaloMs));
          if (!vivo) return;
          let r: boolean | null;
          try { r = await conferirAprovacao(pedido); } catch { r = false; }
          if (r === true) { setSituacao('Pronto! Sincronizando…'); return; }
          if (r === null) break;
        }
      }
    })();
    return () => { vivo = false; };
  }, []);

  return (
    <div className="conta-caixa" data-testid="conta-qr">
      <p>No celular com o Saimo e a sua conta, leia o QR com a câmera. Ou abra Ajustes &gt; Conta Saimo &gt; Entrar numa TV e digite o código:</p>
      <div className="conta-qr-linha">
        {qr ? <div className="conta-qr" dangerouslySetInnerHTML={{ __html: qr }} /> : <div className="conta-qr" />}
        <div>
          <div className="conta-qr-codigo">{codigo || '…'}</div>
          <p className="conta-dica">{situacao}</p>
        </div>
      </div>
      <div className="conta-linha">
        <button type="button" className="ajustes-botao" onClick={aoUsarEmail} data-testid="conta-usar-email">Entrar com e-mail e senha</button>
      </div>
    </div>
  );
}

export function EntrarComQrOuEmail() {
  const [email, setEmail] = useState(ehCelular);
  if (email) {
    return (
      <>
        <EntrarComEmail texto=" " />
        {!ehCelular() && (
          <div className="conta-linha">
            <button type="button" className="ajustes-botao" onClick={() => setEmail(false)} data-testid="conta-usar-qr">Voltar ao QR code</button>
          </div>
        )}
      </>
    );
  }
  return <PorQr aoUsarEmail={() => setEmail(true)} />;
}
