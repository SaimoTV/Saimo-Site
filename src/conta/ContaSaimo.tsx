import { useEffect, useState } from 'react';
import {
  aoMudarConta, apagarConta, aprovarTv, cadastrar, codigoDoQr, definirSenha, entrarComSenha, estadoConta, pedirCodigo, sair, sincronizar, trocarSenha,
} from './conta';
import { EntrarComQrOuEmail } from './EntrarComQr';
import './conta.css';

/** ABCD2345 vira ABCD-2345 enquanto digita; o que não é letra ou número some. */
function mascaraDoCodigo(texto: string): string {
  const limpo = texto.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return limpo.length > 4 ? `${limpo.slice(0, 4)}-${limpo.slice(4)}` : limpo;
}

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

/**
 * Entrar ou criar a conta com e-mail e senha. O e-mail não é verificado: é só
 * o nome de login.
 */
export function EntrarComEmail({ texto }: { texto?: string }) {
  const [criando, setCriando] = useState(false);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const [recuperando, setRecuperando] = useState(false);

  const emailOk = email.includes('@');
  const pronto = emailOk && (criando ? senha.length >= 8 : senha.length > 0);
  const enviar = async () => {
    setOcupado(true); setAviso('');
    try {
      if (criando) await cadastrar(email, senha); else await entrarComSenha(email, senha);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Não deu certo');
      setSenha('');
    } finally { setOcupado(false); }
  };

  return (
    <div className="conta-caixa" data-testid="conta-sem-login">
      <p>{texto ?? 'Opcional: entre para guardar perfis, onde parou, favoritos, listas e addons na sua conta e ter tudo em qualquer aparelho. Sem conta, tudo continua só neste navegador.'}</p>
      <form className="conta-linha" onSubmit={(e) => { e.preventDefault(); if (pronto && !ocupado) void enviar(); }}>
        <input className="conta-campo" type="email" autoComplete="email" placeholder="Seu e-mail" value={email}
          onChange={(e) => setEmail(e.target.value)} data-testid="conta-email" />
        <input className="conta-campo" type="password" autoComplete={criando ? 'new-password' : 'current-password'}
          placeholder={criando ? 'Crie uma senha (8 ou mais)' : 'Senha'} value={senha}
          onChange={(e) => setSenha(e.target.value)} data-testid="conta-senha" />
        <button className="ajustes-botao destaque" disabled={ocupado || !pronto} data-testid={criando ? 'conta-criar' : 'conta-entrar-senha'}>
          {ocupado ? 'Um momento…' : criando ? 'Criar conta' : 'Entrar'}
        </button>
      </form>
      <div className="conta-linha">
        <button type="button" className="ajustes-botao" onClick={() => { setCriando(!criando); setAviso(''); setSenha(''); }} data-testid="conta-alternar">
          {criando ? 'Já tenho conta: entrar' : 'Não tenho conta: criar'}
        </button>
      </div>
      {!criando && (
        <div className="conta-linha">
          <button type="button" className="ajustes-botao" onClick={() => setRecuperando(true)} data-testid="conta-esqueci">Esqueci a senha</button>
        </div>
      )}
      {recuperando && <RecuperarSenha emailInicial={email} aoFechar={() => setRecuperando(false)} />}
      {aviso && <p className="conta-erro">{aviso}</p>}
    </div>
  );
}

/**
 * Esqueci a senha: o código vai ao e-mail da conta e, com ele, a pessoa cria
 * uma senha nova e já entra. Os outros aparelhos saem (quem sabia a antiga).
 */
function RecuperarSenha({ emailInicial, aoFechar }: { emailInicial: string; aoFechar: () => void }) {
  const [email, setEmail] = useState(emailInicial);
  const [enviado, setEnviado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const pedir = async () => {
    setOcupado(true); setAviso('');
    try { await pedirCodigo(email); setEnviado(true); setAviso('Enviamos um código de 6 números para o seu e-mail (veja também o spam).'); }
    catch (e) { setAviso(e instanceof Error ? e.message : 'Não deu certo'); }
    finally { setOcupado(false); }
  };
  const trocar = async () => {
    setOcupado(true); setAviso('');
    try { await definirSenha(email, codigo, senha); aoFechar(); }
    catch (e) { setAviso(e instanceof Error ? e.message : 'Não deu certo'); }
    finally { setOcupado(false); }
  };
  return (
    <div className="conta-caixa" data-testid="conta-recuperar">
      <p><strong>Criar uma senha nova</strong></p>
      {!enviado ? (
        <form className="conta-linha" onSubmit={(e) => { e.preventDefault(); if (email.includes('@') && !ocupado) void pedir(); }}>
          <input className="conta-campo" type="email" autoComplete="email" placeholder="E-mail da conta" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="ajustes-botao destaque" disabled={ocupado || !email.includes('@')}>{ocupado ? 'Enviando…' : 'Enviar código'}</button>
        </form>
      ) : (
        <form className="conta-linha" onSubmit={(e) => { e.preventDefault(); if (codigo.length >= 6 && senha.length >= 8 && !ocupado) void trocar(); }}>
          <input className="conta-campo" inputMode="numeric" autoComplete="one-time-code" placeholder="Código do e-mail" value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} />
          <input className="conta-campo" type="password" autoComplete="new-password" placeholder="Senha nova (8 ou mais)" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <button className="ajustes-botao destaque" disabled={ocupado || codigo.length < 6 || senha.length < 8}>{ocupado ? 'Um momento…' : 'Salvar e entrar'}</button>
        </form>
      )}
      <div className="conta-linha">
        {enviado && <button type="button" className="ajustes-botao" disabled={ocupado} onClick={() => void pedir()}>Mandar outro código</button>}
        <button type="button" className="ajustes-botao" onClick={aoFechar}>Cancelar</button>
      </div>
      {aviso && <p className="conta-dica">{aviso}</p>}
    </div>
  );
}

/** Trocar a senha de quem está logado. */
export function TrocarSenha({ aoTerminar }: { aoTerminar: () => void }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  return (
    <div className="conta-caixa">
      <form className="conta-linha" onSubmit={(e) => {
        e.preventDefault();
        setOcupado(true); setAviso('');
        trocarSenha(atual, nova)
          .then(() => { setAviso('Pronto: senha trocada. Os outros aparelhos saíram da conta.'); setAtual(''); setNova(''); })
          .catch((err) => setAviso(err instanceof Error ? err.message : 'Não deu certo'))
          .finally(() => setOcupado(false));
      }}>
        <input className="conta-campo" type="password" autoComplete="current-password" placeholder="Senha atual" value={atual}
          onChange={(e) => setAtual(e.target.value)} data-testid="conta-senha-atual" />
        <input className="conta-campo" type="password" autoComplete="new-password" placeholder="Senha nova (8 ou mais)" value={nova}
          onChange={(e) => setNova(e.target.value)} data-testid="conta-senha-nova" />
        <button className="ajustes-botao destaque" disabled={ocupado || nova.length < 8} data-testid="conta-salvar-senha">
          {ocupado ? 'Salvando…' : 'Trocar a senha'}
        </button>
        <button type="button" className="ajustes-botao" onClick={aoTerminar}>Fechar</button>
      </form>
      <p className="conta-dica">Se a conta ainda não tem senha, deixe a atual em branco.</p>
      {aviso && <p className={aviso.startsWith('Pronto') ? 'conta-ok' : 'conta-erro'}>{aviso}</p>}
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
          onChange={(e) => setTv(mascaraDoCodigo(e.target.value))} autoCapitalize="characters" autoComplete="off" spellCheck={false} data-testid="conta-codigo-tv" />
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
  const [mexendoNaSenha, setMexendoNaSenha] = useState(false);

  if (!conta.token) return <EntrarComQrOuEmail />;

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
        {conta.email && !mexendoNaSenha && (
          <button className="ajustes-botao" onClick={() => setMexendoNaSenha(true)} data-testid="conta-criar-senha">Trocar a senha</button>
        )}
      </div>
      {mexendoNaSenha && conta.email && (
        <TrocarSenha aoTerminar={() => setMexendoNaSenha(false)} />
      )}

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
