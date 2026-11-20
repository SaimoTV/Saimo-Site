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
  const [vencido, setVencido] = useState(false);
  const [rodada, setRodada] = useState(0);

  // Um código por rodada: quando vence, para de perguntar e mostra "Gerar novo QR"
  // (cada pergunta ao servidor é cobrada; aba esquecida aberta não pergunta para sempre).
  useEffect(() => {
    let vivo = true;
    const dorme = (ms: number) => new Promise((r) => setTimeout(r, ms));
    void (async () => {
      let pedido;
      for (let tentativa = 0; vivo && !pedido; tentativa++) {
        try { pedido = await pedirCodigoDaTv(); } catch (e) {
          if (!vivo) return;
          if (tentativa >= 2) { setSituacao(e instanceof Error ? e.message : 'Sem conexão agora'); setVencido(true); return; }
          setSituacao('Sem conexão: tentando de novo…');
          await dorme(10_000);
        }
      }
      if (!vivo || !pedido) return;
      setCodigo(pedido.codigo);
      setQr(buildQrSvg(pedido.url, 240));
      setSituacao('Esperando o celular…');
      const inicio = Date.now();
      while (vivo && Date.now() < pedido.expiraEm) {
        // Rápido no começo (quem vai ler o QR lê logo) e mais espaçado depois:
        // 8 s nos 2 primeiros minutos, então 15 s, e 20 s depois de 5 min.
        const passou = Date.now() - inicio;
        await dorme(passou < 120_000 ? pedido.intervaloMs : passou < 300_000 ? 15_000 : 20_000);
        if (!vivo) return;
        // Aba escondida ou janela sem foco (a pessoa foi para outro programa): não pergunta.
        if (document.visibilityState === 'hidden' || !document.hasFocus()) continue;
        let r: boolean | null;
        try { r = await conferirAprovacao(pedido); } catch { r = false; }
        if (r === true) { setSituacao('Pronto! Sincronizando…'); return; }
        if (r === null) break;
      }
      if (!vivo) return;
      setSituacao('O código venceu.');
      setVencido(true);
    })();
    return () => { vivo = false; };
  }, [rodada]);

  return (
    <div className="conta-caixa" data-testid="conta-qr">
      <p>No celular com o Saimo e a sua conta, leia o QR com a câmera. Ou abra Ajustes &gt; Conta Saimo &gt; Entrar numa TV e digite o código:</p>
      <div className="conta-qr-linha">
        {qr && !vencido ? <div className="conta-qr" dangerouslySetInnerHTML={{ __html: qr }} /> : <div className="conta-qr" />}
        <div>
          <div className="conta-qr-codigo">{vencido ? '' : codigo || '…'}</div>
          <p className="conta-dica">{situacao}</p>
          {vencido && <button type="button" className="ajustes-botao" onClick={() => { setVencido(false); setCodigo(''); setQr(''); setSituacao('Pedindo um código…'); setRodada((n) => n + 1); }} data-testid="conta-novo-qr">Gerar novo QR</button>}
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
