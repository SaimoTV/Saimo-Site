import { useEffect, useState } from 'react';
import {
  aoMudarConta, apagarConta, aprovarTv, codigoDoQr, definirSenha, entrarComCodigo, entrarComSenha, estadoConta, pedirCodigo, sair, sincronizar,
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

/**
 * Entrar na conta: com a senha (quem criou uma) ou com o código de 6 números
 * que chega no e-mail. "Criar ou trocar a senha" também passa pelo código:
 * prova que o e-mail é de quem pede.
 */
export function EntrarComEmail({ texto, emailFixo, aoTerminar }: { texto?: string; emailFixo?: string; aoTerminar?: () => void }) {
  type Modo = 'email' | 'senha' | 'codigo' | 'definir';
  const [modo, setModo] = useState<Modo>(emailFixo ? 'definir' : 'email');
  const [email, setEmail] = useState(emailFixo ?? '');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoPedido, setCodigoPedido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');

  const tentar = async (f: () => Promise<void>) => {
    setOcupado(true); setAviso('');
    try { await f(); } catch (e) { setAviso(e instanceof Error ? e.message : 'Não deu certo'); } finally { setOcupado(false); }
  };
  const mandarCodigo = () => tentar(async () => {
    try {
      const r = await pedirCodigo(email);
      if (r.codigoDev) setCodigo(r.codigoDev); // só no servidor de teste
    } catch (e) {
      // Pediu há menos de 1 minuto: o código que já chegou continua valendo (10 min).
      if (!(e instanceof Error && /minuto/.test(e.message))) throw e;
    }
    setCodigoPedido(true);
  });
  const emailOk = email.includes('@');
  const voltar = () => { setModo('email'); setSenha(''); setCodigo(''); setCodigoPedido(false); setAviso(''); };

  return (
    <div className="conta-caixa" data-testid="conta-sem-login">
      {!emailFixo && <p>{texto ?? 'Opcional: entre para guardar perfis, onde parou, favoritos, listas e addons na sua conta e ter tudo em qualquer aparelho. Sem conta, tudo continua só neste navegador.'}</p>}

      {modo === 'email' && (
        <form className="conta-linha" onSubmit={(e) => { e.preventDefault(); if (emailOk) setModo('senha'); }}>
          <input className="conta-campo" type="email" autoComplete="email" placeholder="Seu e-mail" value={email}
            onChange={(e) => setEmail(e.target.value)} data-testid="conta-email" />
          <button className="ajustes-botao destaque" disabled={!emailOk} data-testid="conta-com-senha">Entrar com senha</button>
          <button type="button" className="ajustes-botao" disabled={ocupado || !emailOk} data-testid="conta-enviar-codigo"
            onClick={() => { setModo('codigo'); void mandarCodigo(); }}>
            Receber código por e-mail
          </button>
        </form>
      )}

      {modo === 'senha' && (
        <>
          <p>{email.trim()}</p>
          <form className="conta-linha" onSubmit={(e) => { e.preventDefault(); void tentar(() => entrarComSenha(email, senha)); }}>
            <input className="conta-campo" type="password" autoComplete="current-password" placeholder="Senha" value={senha}
              onChange={(e) => setSenha(e.target.value)} data-testid="conta-senha" />
            <button className="ajustes-botao destaque" disabled={ocupado || !senha} data-testid="conta-entrar-senha">
              {ocupado ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
          <div className="conta-linha">
            <button type="button" className="ajustes-botao" onClick={() => { setModo('definir'); setSenha(''); void mandarCodigo(); }} data-testid="conta-esqueci">
              Esqueci a senha / criar senha
            </button>
            <button type="button" className="ajustes-botao" onClick={voltar}>Usar outro e-mail</button>
          </div>
        </>
      )}

      {modo === 'codigo' && (
        <>
          <p>{codigoPedido ? `Digite o código de 6 números que chegou em ${email.trim()}.` : 'Enviando o código…'}</p>
          <form className="conta-linha" onSubmit={(e) => { e.preventDefault(); void tentar(() => entrarComCodigo(email, codigo)); }}>
            <input className="conta-campo conta-codigo" inputMode="numeric" maxLength={6} placeholder="000000" value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} data-testid="conta-codigo" />
            <button className="ajustes-botao destaque" disabled={ocupado || codigo.length !== 6} data-testid="conta-entrar">
              {ocupado ? 'Entrando…' : 'Entrar'}
            </button>
            <button type="button" className="ajustes-botao" onClick={voltar}>Usar outro e-mail</button>
          </form>
        </>
      )}

      {modo === 'definir' && (
        <>
          <p>
            {codigoPedido ? `Chegou um código de 6 números em ${email.trim()}. Digite o código e a senha nova (pelo menos 8 caracteres).`
              : emailFixo ? `Para criar ou trocar a senha, mandamos um código para ${email.trim()}.` : 'Enviando o código…'}
          </p>
          {emailFixo && !codigoPedido ? (
            <div className="conta-linha">
              <button className="ajustes-botao destaque" disabled={ocupado} onClick={() => void mandarCodigo()} data-testid="conta-pedir-codigo-senha">
                {ocupado ? 'Enviando…' : 'Mandar o código'}
              </button>
              {aoTerminar && <button type="button" className="ajustes-botao" onClick={aoTerminar}>Cancelar</button>}
            </div>
          ) : (
            <form className="conta-linha" onSubmit={(e) => {
              e.preventDefault();
              void tentar(async () => { await definirSenha(email, codigo, senha); aoTerminar?.(); });
            }}>
              <input className="conta-campo conta-codigo" inputMode="numeric" maxLength={6} placeholder="000000" value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} data-testid="conta-codigo-senha" />
              <input className="conta-campo" type="password" autoComplete="new-password" placeholder="Senha nova" value={senha}
                onChange={(e) => setSenha(e.target.value)} data-testid="conta-senha-nova" />
              <button className="ajustes-botao destaque" disabled={ocupado || codigo.length !== 6 || senha.length < 8} data-testid="conta-salvar-senha">
                {ocupado ? 'Salvando…' : 'Salvar senha e entrar'}
              </button>
              <button type="button" className="ajustes-botao" onClick={aoTerminar ?? voltar}>{aoTerminar ? 'Cancelar' : 'Voltar'}</button>
            </form>
          )}
          {emailFixo && <p className="conta-dica">Trocar uma senha que já existia tira a conta dos outros aparelhos (entram de novo com a senha nova ou o QR).</p>}
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
  const [mexendoNaSenha, setMexendoNaSenha] = useState(false);

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
        {conta.email && !mexendoNaSenha && (
          <button className="ajustes-botao" onClick={() => setMexendoNaSenha(true)} data-testid="conta-criar-senha">Criar ou trocar a senha</button>
        )}
      </div>
      {mexendoNaSenha && conta.email && (
        <EntrarComEmail emailFixo={conta.email} aoTerminar={() => setMexendoNaSenha(false)} />
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
