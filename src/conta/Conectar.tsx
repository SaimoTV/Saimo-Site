import { useNavigate, useSearchParams } from 'react-router-dom';
import { AprovarTv, EntrarComEmail, useConta } from './ContaSaimo';
import { codigoDoQr } from './conta';
import './conta.css';

/**
 * /conectar?c=ABCD2345: aonde leva o QR da TV. Com o app Saimo no celular, o
 * link abre o app; sem o app, abre aqui. Logado: um toque aprova a TV. Sem
 * conta: entra com o e-mail aqui mesmo e aprova em seguida.
 */
export default function Conectar() {
  const [busca] = useSearchParams();
  const navigate = useNavigate();
  const conta = useConta();
  const bruto = busca.get('c') ?? '';
  const codigo = codigoDoQr(`?c=${bruto}`) ?? '';
  const legivel = codigo.length === 8 ? `${codigo.slice(0, 4)}-${codigo.slice(4)}` : '';

  return (
    <main className="conectar">
      <h1>Entrar na TV com a Conta Saimo</h1>
      {legivel && <p className="conectar-codigo">{legivel}</p>}
      {!conta.token ? (
        <>
          <p>Primeiro entre na sua conta. Depois é só confirmar a TV.</p>
          <EntrarComEmail texto="Entre com o seu e-mail (chega um código de 6 números)." />
        </>
      ) : (
        <>
          <p>Conta: <strong>{conta.email}</strong>. Confira se o código é o mesmo que aparece na TV e confirme.</p>
          <AprovarTv inicial={legivel} />
        </>
      )}
      <p className="conectar-rodape">
        No celular com o app Saimo: Ajustes &gt; Conta Saimo &gt; Entrar numa TV.
        {' '}<button className="ajustes-botao" onClick={() => navigate('/home')}>Ir para o Saimo</button>
      </p>
    </main>
  );
}
