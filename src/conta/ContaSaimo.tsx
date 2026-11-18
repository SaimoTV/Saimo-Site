import { useEffect, useState } from 'react';
import {
  aoMudarConta, apagarConta, aprovarTv, codigoDoQr, entrarComCodigo, estadoConta, pedirCodigo, sair, sincronizar,
} from './conta';
import './conta.css';

function haQuanto(ms: number): string {
  if (!ms) return 'ainda não sincronizou';
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return 'sincronizado agora';
  if (min < 60) return `sincronizado há ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `sincronizado há ${h} h` : `sincronizado há ${Math.floor(h / 24)} d`;
}

export function useConta() {
  const [conta, setConta] = useState(estadoConta());
  useEffect(() => aoMudarConta(setConta), []);
  return conta;
}

/** Entrar com o e-mail: pede o código e confere. */
export function EntrarComEmail({ texto }: { texto?: string }) {
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [esperando, setEsperando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  const tentar = async (f: () => Promise<void>) => {
    setOcupado(true); setAviso('');
    try { await f(); } catch (e) { setAviso(e instanceof Error ? e.message : 'Não deu certo'); } finally { setOcupado(false); }
  };

  return (
    <div className="conta-caixa" data-testid="conta-sem-login">
      <p>{texto ?? 'Opcional: entre com o seu e-mail para guardar perfis, onde parou, favoritos, listas e addons na sua conta e ter tudo em qualquer aparelho. Sem conta, tudo continua só neste navegador.'}</p>
      {!esperando ? (
        <form className="conta-linha" onSubmit={(e) => {
          e.preventDefault();
          void tentar(async () => {
            const r = await pedirCodigo(email);
            setEsperando(true);
            if (r.codigoDev) setCodigo(r.codigoDev); // só no servidor de teste
          });
        }}>
          <input className="conta-campo" type="email" autoComplete="email" placeholder="Seu e-mail" value={email}
            onChange={(e) => setEmail(e.target.value)} data-testid="conta-email" />
          <button className="ajustes-botao destaque" disabled={ocupado || !email.includes('@')} data-testid="conta-enviar-codigo">
            {ocupado ? 'Enviando…' : 'Receber código por e-mail'}
          </button>
        </form>
      ) : (
        <>
          <p>Digite o código de 6 números que chegou em {email.trim()}.</p>
          <form className="conta-linha" onSubmit={(e) => { e.preventDefault(); void tentar(() => entrarComCodigo(email, codigo)); }}>
            <input className="conta-campo conta-codigo" inputMode="numeric" maxLength={6} placeholder="000000" value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} data-testid="conta-codigo" />
            <button className="ajustes-botao destaque" disabled={ocupado || codigo.length !== 6} data-testid="conta-entrar">
              {ocupado ? 'Entrando…' : 'Entrar'}
            </button>
            <button type="button" className="ajustes-botao" onClick={() => { setEsperando(false); setCodigo(''); }}>Usar outro e-mail</button>
          </form>
        </>
      )}
      {aviso && <p className="conta-erro">{aviso}</p>}
    </div>
  );
}

/** Aprovar uma TV pelo código do QR (ABCD-2345). */
export function AprovarTv({ inicial = '', aoAprovar }: { inicial?: string; aoAprovar?: (tv: string) => void }) {
  const [tv, setTv] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  useEffect(() => { if (inicial) setTv(inicial); }, [inicial]);
  const valido = (codigoDoQr(tv) ?? '').length === 8;
  return (
    <>
      <form className="conta-linha" onSubmit={(e) => {
        e.preventDefault();
        setOcupado(true); setAviso('');
        aprovarTv(codigoDoQr(tv) ?? tv)
          .then((nome) => { setTv(''); setAviso(`Pronto: ${nome} entrou na sua conta.`); aoAprovar?.(nome); })
          .catch((err) => setAviso(err instanceof Error ? err.message : 'Não deu certo'))
          .finally(() => setOcupado(false));
      }}>
        <input className="conta-campo conta-codigo" maxLength={9} placeholder="ABCD-2345" value={tv}
          onChange={(e) => setTv(e.target.value.toUpperCase())} data-testid="conta-codigo-tv" />
        <button className="ajustes-botao destaque" disabled={ocupado || !valido} data-testid="conta-aprovar-tv">
          {ocupado ? 'Aprovando…' : 'Entrar nesta TV'}
        </button>
      </form>
      {aviso && <p className={aviso.startsWith('Pronto') ? 'conta-ok' : 'conta-erro'}>{aviso}</p>}
    </>
  );
}

/**
 * Ajustes > Conta Saimo (opcional). Sem conta: entrar com o e-mail. Com conta:
 * sincroniza perfis, onde parou, favoritos, listas e addons, e aprova TVs.
 */
export function ContaSaimo() {
  const conta = useConta();
  const [aviso, setAviso] = useState('');

  if (!conta.token) return <EntrarComEmail />;

  return (
    <div className="conta-caixa" data-testid="conta-logada">
      <div className="conta-quem">
        <strong>{conta.email ?? 'Conta Saimo'}</strong>
        <span>{conta.sincronizando ? 'sincronizando…' : conta.erro ?? haQuanto(conta.sincronizadaEm)}</span>
      </div>
      <div className="ajustes-botoes">
        <button className="ajustes-botao" disabled={conta.sincronizando} onClick={() => void sincronizar(true)} data-testid="conta-sincronizar">
          Sincronizar agora
        </button>
      </div>

      <h3>Entrar numa TV</h3>
      <p>Na TV, abra Ajustes &gt; Conta Saimo e digite aqui o código que aparece nela (ou leia o QR com o celular).</p>
      <AprovarTv />

      <div className="ajustes-botoes conta-fim">
        <button className="ajustes-botao" onClick={() => { if (confirm('Sair da conta? Os dados continuam neste navegador.')) void sair(); }} data-testid="conta-sair">
          Sair da conta
        </button>
        <button className="ajustes-botao perigo" onClick={() => {
          if (!confirm('Apagar a conta e tudo o que ela guarda no servidor? Os dados deste navegador continuam aqui. Não dá para desfazer.')) return;
          apagarConta().catch((e) => setAviso(e instanceof Error ? e.message : 'Não deu certo'));
        }}>
          Apagar conta
        </button>
      </div>
      {aviso && <p className="conta-erro">{aviso}</p>}
    </div>
  );
}
